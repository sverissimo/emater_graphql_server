import { transports } from "winston";
import { logger } from "../shared/utils/logger.js";

// The shared logger only writes errors to file in production; docker exec shows the job's stdout.
if (process.env.NODE_ENV === "production") {
  logger.add(new transports.Console());
}

async function main(): Promise<void> {
  try {
    // Imported inside the try so import-time configuration errors are logged as failures too.
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
