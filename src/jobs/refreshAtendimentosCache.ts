import { transports } from "winston";
import { logger } from "../shared/utils/logger.js";

// The shared logger only writes errors to file in production; cron captures the job's stdout.
if (process.env.NODE_ENV === "production") {
  logger.add(new transports.Console());
}

async function main(): Promise<void> {
  if (
    process.env.NODE_ENV !== "production" &&
    (process.env.DATABASE_URL ?? "").toUpperCase().includes("PROD")
  ) {
    logger.error(
      "Refusing to refresh: non-production environment pointed at Demeter PROD.",
    );
    process.exitCode = 1;
    return;
  }

  try {
    // Imported only after the safety line, so no database client exists before it.
    const { AtendimentosCacheRefresh } = await import(
      "../modules/atendimentosCache/refresh/AtendimentosCacheRefresh.js"
    );
    await new AtendimentosCacheRefresh().run();
  } catch (error) {
    logger.error(
      `Atendimentos cache refresh failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
    );
    process.exitCode = 1;
  }
}

await main();
