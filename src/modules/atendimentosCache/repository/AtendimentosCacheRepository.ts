import pg from "pg";
import { GraphQLError } from "graphql";
import { CacheDbPool } from "../../../config/cacheDbPool.js";
import { logger } from "../../../shared/utils/logger.js";
import {
  REFRESH_CONNECTION_OPTIONS,
  REFRESH_LOCK_KEY,
} from "../atendimentosCacheConstants.js";
import {
  ADD_KEYS_AND_INDEXES,
  ANALYZE_TABLES,
  ARRAY_TYPES,
  INSERT_REFRESH_INFO,
  PREPARE_BUILD_SCHEMA,
  SELECT_REFRESH_INFO,
} from "../queries/atendimentosCacheQueries.js";
import { AtendimentosAggregatesQuery } from "../queries/AtendimentosAggregatesQuery.js";
import type {
  AtendimentosAggregateRow,
  AtendimentosAggregatesRequest,
  AtendimentosAggregatesResponse,
  AtendimentosCacheRows,
  AtendimentosCacheTable,
  AtendimentosDateRange,
} from "../types/atendimentosCache.types.js";

export class AtendimentosCacheRepository {
  private jobClient: pg.Client | null = null;
  private locked = false;
  private inTransaction = false;

  async acquireRefreshLock(): Promise<boolean> {
    const connectionString = process.env.CACHE_DATABASE_URL;
    if (!connectionString) {
      throw new Error("CACHE_DATABASE_URL is required to refresh the atendimentos cache.");
    }

    const client = new pg.Client({ connectionString, ...REFRESH_CONNECTION_OPTIONS });
    client.on("error", (error) =>
      logger.error(`Atendimentos cache connection error: ${error.message}`),
    );
    this.jobClient = client;
    await client.connect();

    const { rows } = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1::bigint) AS locked",
      [REFRESH_LOCK_KEY],
    );
    this.locked = rows[0].locked;
    return this.locked;
  }

  async prepareBuild(): Promise<void> {
    await this.requireLockedClient().query(PREPARE_BUILD_SCHEMA);
  }

  async insertBatch<T extends AtendimentosCacheTable>(
    table: T,
    rows: AtendimentosCacheRows[T][],
  ): Promise<void> {
    const columns = Object.entries(ARRAY_TYPES[table]) as [
      keyof AtendimentosCacheRows[T] & string,
      string,
    ][];
    await this.requireLockedClient().query(
      `INSERT INTO ${table} (${columns.map(([name]) => name).join(", ")})
       SELECT * FROM unnest(${columns.map(([, type], i) => `$${i + 1}::${type}[]`).join(", ")})`,
      columns.map(([name]) => rows.map((row) => row[name])),
    );
  }

  async finishBuild(
    snapshotAt: string,
    range: AtendimentosDateRange,
  ): Promise<void> {
    const client = this.requireLockedClient();
    await client.query(ADD_KEYS_AND_INDEXES);
    await client.query(INSERT_REFRESH_INFO, [snapshotAt, range.start, range.end]);
    await client.query(ANALYZE_TABLES);
  }

  async publish(): Promise<void> {
    const client = this.requireLockedClient();
    await client.query("BEGIN");
    this.inTransaction = true;
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("DROP SCHEMA IF EXISTS atendimentos CASCADE");
    await client.query("ALTER SCHEMA atendimentos_build RENAME TO atendimentos");
    await client.query("COMMIT");
    this.inTransaction = false;
  }

  // If ROLLBACK/unlock fails on a broken connection, ending the session still releases the lock.
  async closeJobClient(): Promise<void> {
    const client = this.jobClient;
    if (!client) return;
    this.jobClient = null;

    try {
      if (this.inTransaction) await client.query("ROLLBACK");
      if (this.locked) {
        await client.query("SELECT pg_advisory_unlock($1::bigint)", [
          REFRESH_LOCK_KEY,
        ]);
      }
    } finally {
      this.inTransaction = false;
      this.locked = false;
      await client.end();
    }
  }

  async getAggregates(
    request: AtendimentosAggregatesRequest,
  ): Promise<AtendimentosAggregatesResponse> {
    let client: pg.PoolClient | undefined;
    let inTransaction = false;
    let failed = false;
    const onClientError = (error: Error) => {
      failed = true;
      logger.error(`Atendimentos cache checked-out connection error: ${error.message}`);
    };

    try {
      const pool = CacheDbPool.get();
      if (!pool) throw this.unavailable("CACHE_DATABASE_URL is unset.");
      const query = AtendimentosAggregatesQuery.build(request);
      client = await pool.connect();
      // pg removes the pool's idle error listener while a client is checked out.
      client.on("error", onClientError);
      await client.query("BEGIN READ ONLY");
      inTransaction = true;

      // Holding refresh_info's table lock prevents publication between these two reads.
      const info = await client.query<{
        snapshotAt: string;
        stale: boolean;
        rangeStart: string;
        rangeEnd: string;
      }>(SELECT_REFRESH_INFO).catch((error: unknown) => {
        if (this.errorCode(error) === "42P01") throw this.unavailable(error);
        throw error;
      });
      if (info.rows.length === 0) {
        throw this.unavailable("No first generation: refresh_info contains no rows.");
      }
      if (info.rows.length !== 1) {
        throw new Error("Atendimentos cache refresh_info must contain exactly one row.");
      }

      const { rows } = await client.query<AtendimentosAggregateRow>(
        query.sql,
        query.parameters,
      );
      const { snapshotAt, stale, rangeStart, rangeEnd } = info.rows[0];
      const response: AtendimentosAggregatesResponse = {
        snapshotAt,
        stale,
        dateRange: { start: rangeStart, end: rangeEnd },
        truncated: rows.length > request.limit,
        rows: rows.slice(0, request.limit),
      };
      await client.query("COMMIT");
      inTransaction = false;
      return response;
    } catch (error) {
      failed = true;
      if (client && inTransaction) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          logger.error(
            `Atendimentos cache read rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
          );
        }
      }
      if (this.isUnavailable(error)) throw this.unavailable(error);
      throw error;
    } finally {
      client?.release(failed);
      client?.removeListener("error", onClientError);
    }
  }

  private unavailable(cause: unknown): GraphQLError {
    const code = this.errorCode(cause);
    const message = cause instanceof Error ? cause.message : String(cause);
    logger.error(
      `Atendimentos cache read unavailable${code ? ` (${code})` : ""}: ${message}${this.isReadTimeout(cause) ? " Narrow the aggregate request before retrying." : ""}`,
    );
    return new GraphQLError("Atendimentos cache is unavailable.", {
      extensions: { code: "SERVICE_UNAVAILABLE" },
    });
  }

  private errorCode(error: unknown): string {
    return error !== null && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  }

  private isUnavailable(error: unknown): boolean {
    const code = this.errorCode(error);
    return this.isReadTimeout(error) || code.startsWith("08") || [
      "ECONNREFUSED", "ECONNRESET", "ECONNABORTED", "ETIMEDOUT", "ENOTFOUND",
      "EAI_AGAIN", "EHOSTUNREACH", "EHOSTDOWN", "ENETUNREACH", "ENETDOWN",
      "ENETRESET", "EPIPE", "ERR_SOCKET_CLOSED", "53300", "57P01", "57P02", "57P03",
    ].includes(code) || (
      error instanceof Error &&
      /^(timeout exceeded when trying to connect|Connection terminated due to connection timeout|Connection terminated unexpectedly|Connection terminated|Client has encountered a connection error and is not queryable)$/.test(error.message)
    );
  }

  private isReadTimeout(error: unknown): boolean {
    return this.errorCode(error) === "57014" || (
      error instanceof Error && error.message === "Query read timeout"
    );
  }

  private requireLockedClient(): pg.Client {
    if (!this.jobClient || !this.locked) {
      throw new Error("Atendimentos cache refresh lock is not held.");
    }
    return this.jobClient;
  }
}
