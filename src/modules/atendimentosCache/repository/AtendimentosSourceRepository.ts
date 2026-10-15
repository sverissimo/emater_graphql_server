import pg from "pg";
import { logger } from "../../../shared/utils/logger.js";
import {
  FETCH_SIZE,
  REFRESH_CONNECTION_OPTIONS,
} from "../atendimentosCacheConstants.js";
import {
  EXTRACTIONS,
  SELECT_SNAPSHOT_AT,
} from "../queries/atendimentosSourceQueries.js";
import type {
  AtendimentosDateRange,
  AtendimentosSourceRows,
  AtendimentosSourceTable,
} from "../types/atendimentosCache.types.js";

// Dedicated Demeter connection for the refresh job, outside Prisma's pool.
export class AtendimentosSourceRepository {
  private client: pg.Client | null = null;
  private inTransaction = false;

  async beginSnapshot(): Promise<string> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required to refresh the atendimentos cache.");
    }

    const client = new pg.Client({ connectionString, ...REFRESH_CONNECTION_OPTIONS });
    client.on("error", (error) =>
      logger.error(`Demeter source connection error: ${error.message}`),
    );
    this.client = client;
    await client.connect();

    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    this.inTransaction = true;
    // The first statement acquires the snapshot, so its clock time identifies it.
    const { rows } = await client.query<{ snapshot_at: string }>(SELECT_SNAPSHOT_AT);
    return rows[0].snapshot_at;
  }

  async extract<T extends AtendimentosSourceTable>(
    table: T,
    range: AtendimentosDateRange,
    onBatch: (rows: AtendimentosSourceRows[T][]) => Promise<void>,
  ): Promise<number> {
    const client = this.requireTransaction();
    const { sql, byDateRange } = EXTRACTIONS[table];
    await client.query(
      `DECLARE c NO SCROLL CURSOR FOR ${sql}`,
      byDateRange ? [range.start, range.endExclusive] : undefined,
    );

    let total = 0;
    for (;;) {
      const { rows } = await client.query(`FETCH ${FETCH_SIZE} FROM c`);
      if (rows.length === 0) break;
      await onBatch(rows);
      total += rows.length;
    }

    await client.query("CLOSE c");
    return total;
  }

  async commit(): Promise<void> {
    await this.requireTransaction().query("COMMIT");
    this.inTransaction = false;
  }

  async close(): Promise<void> {
    const client = this.client;
    if (!client) return;
    this.client = null;

    try {
      if (this.inTransaction) await client.query("ROLLBACK");
    } finally {
      this.inTransaction = false;
      await client.end();
    }
  }

  private requireTransaction(): pg.Client {
    if (!this.client || !this.inTransaction) {
      throw new Error("Atendimentos source snapshot transaction is not open.");
    }
    return this.client;
  }
}
