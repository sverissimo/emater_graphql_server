import { createPrismaClient } from "../../../config/prismaClient.js";
import { EnumPropsRepository } from "../../../repositories/EnumPropsRepository.js";
import { logger } from "../../../shared/utils/logger.js";
import { REFRESH_CONNECTION_OPTIONS } from "../atendimentosCacheConstants.js";
import { AtendimentosCacheRepository } from "../repository/AtendimentosCacheRepository.js";
import { AtendimentosSourceRepository } from "../repository/AtendimentosSourceRepository.js";
import { AtendimentosCacheRules } from "./AtendimentosCacheRules.js";

// Single use: run() closes every connection this instance owns.
export class AtendimentosCacheRefresh {
  private static readonly LINKED_TABLES = [
    "atendimento_programa",
    "atendimento_tecnico",
    "atendimento_produtor",
    "programa",
    "tecnico",
  ] as const;

  private readonly lookupPrisma = createPrismaClient(REFRESH_CONNECTION_OPTIONS);
  private readonly enumProps = new EnumPropsRepository(this.lookupPrisma);
  private readonly source = new AtendimentosSourceRepository();
  private readonly cache = new AtendimentosCacheRepository();

  async run(): Promise<void> {
    const startedAt = Date.now();
    let outcome = "failed";
    let cleanedUp = false;

    try {
      outcome = await this.buildAndPublish();
    } finally {
      cleanedUp = await this.closeAll();
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      logger.info(`Atendimentos cache refresh finished: ${outcome} after ${seconds}s.`);
    }

    if (!cleanedUp) {
      throw new Error("Atendimentos cache refresh cleanup failed.");
    }
  }

  private async buildAndPublish(): Promise<"published" | "skipped"> {
    if (!(await this.cache.acquireRefreshLock())) {
      logger.info("Atendimentos cache refresh skipped: another refresh holds the lock.");
      return "skipped";
    }

    const range = AtendimentosCacheRules.dateRange(new Date());
    const lookup = AtendimentosCacheRules.unidadeLookup(
      await this.enumProps.getMunicipiosEmater(),
    );
    await this.cache.prepareBuild();

    const counts: Record<string, number> = {};
    const unmatched = new Map<string, number>();
    const snapshotAt = await this.source.beginSnapshot();

    counts.atendimento = await this.source.extract("atendimento", range, (rows) =>
      this.cache.insertBatch(
        "atendimento",
        rows.map((row) => {
          const regional_id = lookup.regionalIdOf(row.id_und_empresa);
          if (regional_id === null) {
            unmatched.set(row.id_und_empresa, (unmatched.get(row.id_und_empresa) ?? 0) + 1);
          }
          return { ...row, regional_id };
        }),
      ),
    );
    for (const table of AtendimentosCacheRefresh.LINKED_TABLES) {
      counts[table] = await this.source.extract(table, range, (rows) =>
        this.cache.insertBatch(table, rows),
      );
    }
    await this.source.commit();

    await this.cache.insertBatch("unidade", lookup.unidades);
    counts.unidade = lookup.unidades.length;
    await this.cache.finishBuild(snapshotAt, range);
    await this.cache.publish();

    const tableCounts = Object.entries(counts).map(([table, count]) => `${table}=${count}`);
    const unmatchedUnits = [...unmatched].map(([unit, count]) => `${unit}=${count}`);
    logger.info(
      `Atendimentos cache published: snapshot ${snapshotAt}, range ${range.start}..${range.end}, ${tableCounts.join(", ")}.`,
    );
    logger.info(
      `Atendimentos cache unmatched units (facts kept without geography): ${unmatchedUnits.join(", ") || "none"}.`,
    );
    return "published";
  }

  private async closeAll(): Promise<boolean> {
    let cleanedUp = true;
    for (const close of [
      () => this.source.close(),
      () => this.cache.closeJobClient(),
      () => this.lookupPrisma.$disconnect(),
    ]) {
      try {
        await close();
      } catch (error) {
        cleanedUp = false;
        logger.error(
          `Atendimentos cache refresh cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return cleanedUp;
  }
}
