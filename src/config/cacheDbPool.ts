import pg from "pg";
import { logger } from "../shared/utils/logger.js";

export class CacheDbPool {
  private static pool: pg.Pool | null = null;

  static get(): pg.Pool | null {
    const connectionString = process.env.CACHE_DATABASE_URL;
    if (!connectionString) return null;

    if (!this.pool) {
      this.pool = new pg.Pool({
        connectionString,
        statement_timeout: 15_000,
        connectionTimeoutMillis: 5_000,
        options: "-c search_path=atendimentos",
        application_name: "atendimentosCacheReads",
      });
      this.pool.on("error", (error) =>
        logger.error(`Atendimentos cache serving pool error: ${error.message}`),
      );
    }
    return this.pool;
  }
}
