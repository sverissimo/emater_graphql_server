import type { MunicipioEmater } from "../../../repositories/types/MunicipioEmater.js";
import type {
  AtendimentosCacheRows,
  AtendimentosDateRange,
} from "../types/atendimentosCache.types.js";

export class AtendimentosCacheRules {
  private static readonly SAO_PAULO_DATE = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

  static dateRange(now: Date): AtendimentosDateRange {
    const parts = AtendimentosCacheRules.SAO_PAULO_DATE.formatToParts(now);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value);
    const [year, month, day] = [part("year"), part("month"), part("day")];
    const yesterday = new Date(Date.UTC(year, month - 1, day - 1));
    const pad = AtendimentosCacheRules.pad;

    return {
      start: `${year - 1}-${pad(month)}-01`,
      end: yesterday.toISOString().slice(0, 10),
      endExclusive: `${year}-${pad(month)}-${pad(day)}`,
    };
  }

  static unidadeLookup(municipios: MunicipioEmater[]) {
    const unidades: AtendimentosCacheRows["unidade"][] = [];
    const regionalByUnidade = new Map<string, string>();

    for (const {
      id_und_empresa,
      nome_municipio,
      regional_id,
      nome_regional,
    } of municipios) {
      if (!regionalByUnidade.has(regional_id)) {
        regionalByUnidade.set(regional_id, regional_id);
        unidades.push({
          id_und_empresa: regional_id,
          nome_municipio: null,
          regional_id,
          nome_regional,
        });
      }
      regionalByUnidade.set(id_und_empresa, regional_id);
      unidades.push({ id_und_empresa, nome_municipio, regional_id, nome_regional });
    }

    return {
      unidades,
      regionalIdOf: (idUndEmpresa: string) =>
        regionalByUnidade.get(idUndEmpresa) ?? null,
    };
  }

  static refusesProdSource(env: NodeJS.ProcessEnv): boolean {
    return (
      env.NODE_ENV !== "production" &&
      (env.DATABASE_URL ?? "").toUpperCase().includes("PROD")
    );
  }

  private static pad(value: number): string {
    return String(value).padStart(2, "0");
  }
}
