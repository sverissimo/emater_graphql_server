import type { AtendimentosAggregatesRequest } from "../types/atendimentosCache.types.js";

export class AtendimentosAggregatesQuery {
  private static readonly DIMENSIONS = {
    month: {
      select: ["a.month::text AS month"],
      group: ["a.month"],
      order: "a.month",
    },
    programa: {
      select: ['ap.codigo_programa::text AS "codigoPrograma"', "p.nome AS programa"],
      group: ["ap.codigo_programa", "p.nome"],
      order: "ap.codigo_programa",
    },
    regional: {
      select: ['a.regional_id::text AS "regionalId"', "r.nome_regional AS regional"],
      group: ["a.regional_id", "r.nome_regional"],
      order: "a.regional_id",
    },
    municipio: {
      select: ['m.id_und_empresa::text AS "idUndEmpresa"', "m.nome_municipio AS municipio"],
      group: ["m.id_und_empresa", "m.nome_municipio"],
      order: "m.id_und_empresa",
    },
    tecnico: {
      select: ['at.id_usuario::text AS "idUsuario"', "t.nome AS tecnico"],
      group: ["at.id_usuario", "t.nome"],
      order: "at.id_usuario",
    },
  };

  private static readonly METRICS = {
    atendimentos: "COUNT(DISTINCT a.id_at_atendimento)::int AS atendimentos",
    produtores: "COUNT(DISTINCT pr.id_pessoa_demeter)::int AS produtores",
    propriedades: "COUNT(DISTINCT pr.id_pl_propriedade)::int AS propriedades",
  };

  private static readonly METRIC_ORDER = {
    atendimentos: "atendimentos DESC NULLS LAST",
    produtores: "produtores DESC NULLS LAST",
    propriedades: "propriedades DESC NULLS LAST",
  };

  static build(request: AtendimentosAggregatesRequest) {
    const parameters: (string | string[] | number)[] = [];
    const bind = (value: string | string[] | number) => {
      parameters.push(value);
      return `$${parameters.length}`;
    };
    const { groupBy, filters } = request;
    const dimensions = groupBy.map((key) => this.DIMENSIONS[key]);
    const select = [
      ...dimensions.flatMap((dimension) => dimension.select),
      ...Object.values(this.METRICS),
    ];
    const joins = [
      "LEFT JOIN atendimento_produtor pr ON pr.id_at_atendimento = a.id_at_atendimento",
    ];
    const where: string[] = [];

    if (groupBy.includes("programa")) {
      joins.push(
        "LEFT JOIN atendimento_programa ap ON ap.id_at_atendimento = a.id_at_atendimento",
        "LEFT JOIN programa p ON p.codigo_programa = ap.codigo_programa",
      );
    }
    if (groupBy.includes("tecnico")) {
      joins.push(
        "LEFT JOIN atendimento_tecnico at ON at.id_at_atendimento = a.id_at_atendimento",
        "LEFT JOIN tecnico t ON t.id_usuario = at.id_usuario",
      );
    }
    if (groupBy.includes("regional")) {
      joins.push(
        `LEFT JOIN unidade r ON r.id_und_empresa = a.regional_id AND r.id_und_empresa LIKE ${bind("G%")}::text`,
      );
    }
    if (groupBy.includes("municipio") || filters.municipios.length > 0) {
      joins.push(
        `LEFT JOIN unidade m ON m.id_und_empresa = a.id_und_empresa AND m.id_und_empresa LIKE ${bind("H%")}::text`,
      );
    }

    if (filters.monthFrom !== undefined) {
      where.push(`a.month >= ${bind(filters.monthFrom)}::bpchar`);
    }
    if (filters.monthTo !== undefined) {
      where.push(`a.month <= ${bind(filters.monthTo)}::bpchar`);
    }
    if (filters.programas.length > 0) {
      const ids = bind(filters.programas);
      where.push(groupBy.includes("programa")
        ? `ap.codigo_programa = ANY(${ids}::bigint[])`
        : `EXISTS (
            SELECT 1 FROM atendimento_programa ap_filter
            WHERE ap_filter.id_at_atendimento = a.id_at_atendimento
              AND ap_filter.codigo_programa = ANY(${ids}::bigint[])
          )`);
    }
    if (filters.tecnicos.length > 0) {
      const ids = bind(filters.tecnicos);
      where.push(groupBy.includes("tecnico")
        ? `at.id_usuario = ANY(${ids}::bigint[])`
        : `EXISTS (
            SELECT 1 FROM atendimento_tecnico at_filter
            WHERE at_filter.id_at_atendimento = a.id_at_atendimento
              AND at_filter.id_usuario = ANY(${ids}::bigint[])
          )`);
    }
    if (filters.regionais.length > 0) {
      where.push(`a.regional_id = ANY(${bind(filters.regionais)}::text[])`);
    }
    if (filters.municipios.length > 0) {
      where.push(`m.id_und_empresa = ANY(${bind(filters.municipios)}::text[])`);
    }

    const groups = dimensions.flatMap((dimension) => dimension.group);
    const order = dimensions.map((dimension) => `${dimension.order} ASC NULLS LAST`);
    if (request.orderBy !== undefined) order.unshift(this.METRIC_ORDER[request.orderBy]);

    return {
      sql: [
        `SELECT ${select.join(",\n       ")}`,
        "FROM atendimento a",
        ...joins,
        ...(where.length ? [`WHERE ${where.join("\n  AND ")}`] : []),
        ...(groups.length ? [`GROUP BY ${groups.join(", ")}`] : []),
        ...(order.length ? [`ORDER BY ${order.join(", ")}`] : []),
        `LIMIT ${bind(request.limit + 1)}`,
      ].join("\n"),
      parameters,
    };
  }
}
