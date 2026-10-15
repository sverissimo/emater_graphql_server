import { GraphQLError } from "graphql";
import type {
  AtendimentosAggregateDimension,
  AtendimentosAggregateMetric,
  AtendimentosAggregatesRequest,
} from "./types/atendimentosCache.types.js";

export class AtendimentosAggregatesValidation {
  private static readonly DIMENSIONS: readonly AtendimentosAggregateDimension[] = [
    "month", "programa", "regional", "municipio", "tecnico",
  ];
  private static readonly METRICS: readonly AtendimentosAggregateMetric[] = [
    "atendimentos", "produtores", "propriedades",
  ];

  static parse(body: unknown): AtendimentosAggregatesRequest {
    const input = this.object(body, "body");
    const filters = input.filters == null ? {} : this.object(input.filters, "filters");
    const groupBy = this.groupBy(input.groupBy);
    const orderBy = input.orderBy == null ? undefined : input.orderBy;
    if (
      orderBy !== undefined &&
      !this.METRICS.includes(orderBy as AtendimentosAggregateMetric)
    ) {
      this.invalid("orderBy must be atendimentos, produtores, or propriedades.");
    }

    const monthFrom = this.month(filters.monthFrom, "monthFrom");
    const monthTo = this.month(filters.monthTo, "monthTo");
    if (monthFrom && monthTo && monthFrom > monthTo) {
      this.invalid("monthFrom must not be after monthTo.");
    }

    const limit = input.limit ?? 1000;
    if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 1000) {
      this.invalid("limit must be an integer from 1 to 1000.");
    }

    return {
      groupBy,
      filters: {
        monthFrom,
        monthTo,
        programas: this.list(filters.programas, "programas", (id) => this.bigintId(id)),
        regionais: this.list(filters.regionais, "regionais", (id) => this.unitId(id, "G")),
        municipios: this.list(filters.municipios, "municipios", (id) => this.unitId(id, "H")),
        tecnicos: this.list(filters.tecnicos, "tecnicos", (id) => this.bigintId(id)),
      },
      orderBy: orderBy as AtendimentosAggregateMetric | undefined,
      limit,
    };
  }

  private static object(value: unknown, field: string): Record<string, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      this.invalid(`${field} must be a JSON object.`);
    }
    return value as Record<string, unknown>;
  }

  private static groupBy(value: unknown): AtendimentosAggregateDimension[] {
    if (value == null) return [];
    if (
      !Array.isArray(value) ||
      value.some((item) => !this.DIMENSIONS.includes(item)) ||
      new Set(value).size !== value.length
    ) {
      this.invalid("groupBy must contain unique supported dimensions.");
    }
    return [...value] as AtendimentosAggregateDimension[];
  }

  private static month(value: unknown, field: string): string | undefined {
    if (value == null) return undefined;
    if (
      typeof value !== "string" ||
      !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value)
    ) {
      this.invalid(`${field} must be a real YYYY-MM month (years 0001–9999).`);
    }
    return value;
  }

  private static list(
    value: unknown,
    field: string,
    normalize: (id: string) => string,
  ): string[] {
    if (value == null) return [];
    if (!Array.isArray(value) || value.length > 1000) {
      this.invalid(`${field} must be a string array with at most 1000 entries.`);
    }
    return [...new Set(value.map((item: unknown) => {
      if (typeof item !== "string") this.invalid(`${field} must contain only strings.`);
      return normalize(item.trim());
    }))];
  }

  private static bigintId(value: string): string {
    if (!/^\d+$/.test(value)) {
      this.invalid("Programa and tecnico IDs must contain only digits.");
    }
    const normalized = value.replace(/^0+(?=\d)/, "");
    const maximum = "9223372036854775807";
    if (
      normalized.length > maximum.length ||
      (normalized.length === maximum.length && normalized > maximum)
    ) {
      this.invalid("Programa and tecnico IDs must fit a non-negative signed bigint.");
    }
    return normalized;
  }

  private static unitId(value: string, prefix: "G" | "H"): string {
    if (!/^[GH]\d{4}$/.test(value) || !value.startsWith(prefix)) {
      this.invalid(`Unit IDs must have the form ${prefix} followed by four digits.`);
    }
    return value;
  }

  private static invalid(message: string): never {
    throw new GraphQLError(message, { extensions: { code: "BAD_REQUEST" } });
  }
}
