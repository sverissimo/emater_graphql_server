import pg from "pg";
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
} from "../queries/atendimentosCacheQueries.js";
import type {
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

  private requireLockedClient(): pg.Client {
    if (!this.jobClient || !this.locked) {
      throw new Error("Atendimentos cache refresh lock is not held.");
    }
    return this.jobClient;
  }
}
