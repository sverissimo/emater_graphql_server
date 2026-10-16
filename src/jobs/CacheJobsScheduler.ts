import { Cron } from "croner";
import { transports } from "winston";
import { AtendimentosCacheRefresh } from "../modules/atendimentosCache/refresh/AtendimentosCacheRefresh.js";
import { logger } from "../shared/utils/logger.js";
import { CacheJobsConfig } from "./CacheJobsConfig.js";

export class CacheJobsScheduler {
  static startIfEnabled(): void {
    if (!CacheJobsConfig.isEnabled(process.env.CACHE_JOBS_ENABLED)) return;

    CacheJobsScheduler.ensureConsoleLogging();
    try {
      CacheJobsScheduler.scheduleAtendimentosRefresh();
    } catch (error) {
      // An invalid schedule override must not stop the gateway from serving.
      logger.error(
        `Atendimentos cache refresh not scheduled: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private static scheduleAtendimentosRefresh(): void {
    const pattern = CacheJobsConfig.atendimentosRefreshPattern(
      process.env.CACHE_JOBS_ATENDIMENTOS_REFRESH_CRON,
    );
    const timezone = CacheJobsConfig.TIMEZONE;
    // unref: an idle schedule must not keep the gateway process alive.
    const job = new Cron(pattern, { timezone, unref: true }, () =>
      CacheJobsScheduler.refreshAtendimentos(),
    );
    const nextRun = job.nextRun()?.toISOString();
    logger.info(
      `Atendimentos cache refresh scheduled: "${pattern}" ${timezone}, next run ${nextRun}.`,
    );
  }

  private static async refreshAtendimentos(): Promise<void> {
    try {
      await new AtendimentosCacheRefresh().run();
    } catch (error) {
      logger.error(
        `Scheduled atendimentos cache refresh failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
      );
    }
  }

  // Production has only the error-file transport; reuse the dev console transport when present.
  private static ensureConsoleLogging(): void {
    const hasConsole = logger.transports.some(
      (transport) => transport instanceof transports.Console,
    );
    if (!hasConsole) logger.add(new transports.Console());
  }
}
