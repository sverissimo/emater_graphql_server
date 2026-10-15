import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { AtendimentosAggregatesValidation } from "../AtendimentosAggregatesValidation.js";
import { AtendimentosAggregatesQuery } from "./AtendimentosAggregatesQuery.js";

const build = (body: unknown = {}) => AtendimentosAggregatesQuery.build(
  AtendimentosAggregatesValidation.parse(body),
);

describe("AtendimentosAggregatesQuery", () => {
  test("totals retain unlinked atendimentos and use three exact distinct counts", () => {
    const { sql, parameters } = build();
    assert.match(sql, /FROM atendimento a\nLEFT JOIN atendimento_produtor pr ON pr\.id_at_atendimento = a\.id_at_atendimento/);
    assert.match(sql, /COUNT\(DISTINCT a\.id_at_atendimento\)::int AS atendimentos/);
    assert.match(sql, /COUNT\(DISTINCT pr\.id_pessoa_demeter\)::int AS produtores/);
    assert.match(sql, /COUNT\(DISTINCT pr\.id_pl_propriedade\)::int AS propriedades/);
    assert.doesNotMatch(sql, /GROUP BY|WHERE|ORDER BY|COUNT\(\*\)|COALESCE|HAVING/);
    assert.match(sql, /LIMIT \$1$/);
    assert.deepEqual(parameters, [1001]);
  });

  test("grouping programa and tecnico uses left joins and groups names with native IDs", () => {
    const { sql } = build({ groupBy: ["programa", "tecnico"] });
    assert.match(sql, /LEFT JOIN atendimento_programa ap ON ap\.id_at_atendimento = a\.id_at_atendimento/);
    assert.match(sql, /LEFT JOIN programa p ON p\.codigo_programa = ap\.codigo_programa/);
    assert.match(sql, /LEFT JOIN atendimento_tecnico at ON at\.id_at_atendimento = a\.id_at_atendimento/);
    assert.match(sql, /LEFT JOIN tecnico t ON t\.id_usuario = at\.id_usuario/);
    assert.match(sql, /ap\.codigo_programa::text AS "codigoPrograma"/);
    assert.match(sql, /at\.id_usuario::text AS "idUsuario"/);
    assert.match(sql, /GROUP BY ap\.codigo_programa, p\.nome, at\.id_usuario, t\.nome/);
    assert.doesNotMatch(sql, /EXISTS|WHERE|IS NOT NULL|COALESCE/);
  });

  test("filter-only programa/tecnico use correlated EXISTS without multiplying totals", () => {
    const { sql, parameters } = build({ filters: { programas: ["50", "318"], tecnicos: ["1234"] } });
    assert.match(sql, /EXISTS \(\s*SELECT 1 FROM atendimento_programa ap_filter\s*WHERE ap_filter\.id_at_atendimento = a\.id_at_atendimento\s*AND ap_filter\.codigo_programa = ANY\(\$1::bigint\[\]\)/);
    assert.match(sql, /AND EXISTS \(\s*SELECT 1 FROM atendimento_tecnico at_filter\s*WHERE at_filter\.id_at_atendimento = a\.id_at_atendimento\s*AND at_filter\.id_usuario = ANY\(\$2::bigint\[\]\)/);
    assert.doesNotMatch(sql, /JOIN atendimento_programa|JOIN programa|JOIN atendimento_tecnico|JOIN tecnico|GROUP BY/);
    assert.deepEqual(parameters, [["50", "318"], ["1234"], 1001]);
  });

  test("grouped and filtered dimensions restrict joined IDs to the requested buckets", () => {
    const { sql, parameters } = build({
      groupBy: ["programa", "tecnico"],
      filters: { programas: ["50"], tecnicos: ["1234", "5678"] },
    });
    assert.match(sql, /WHERE ap\.codigo_programa = ANY\(\$1::bigint\[\]\)\s+AND at\.id_usuario = ANY\(\$2::bigint\[\]\)/);
    assert.match(sql, /LEFT JOIN atendimento_produtor pr/);
    assert.doesNotMatch(sql, /EXISTS|pr\.id_usuario|pr\.codigo_programa/);
    assert.deepEqual(parameters, [["50"], ["1234", "5678"], 1001]);
  });

  test("handles mixed grouped and filter-only link dimensions independently", () => {
    const programa = build({ groupBy: ["programa"], filters: { tecnicos: ["1234"] } });
    assert.match(programa.sql, /LEFT JOIN atendimento_programa/);
    assert.match(programa.sql, /SELECT 1 FROM atendimento_tecnico at_filter/);
    assert.doesNotMatch(programa.sql, /JOIN atendimento_tecnico/);

    const tecnico = build({ groupBy: ["tecnico"], filters: { programas: ["50"] } });
    assert.match(tecnico.sql, /LEFT JOIN atendimento_tecnico/);
    assert.match(tecnico.sql, /SELECT 1 FROM atendimento_programa ap_filter/);
    assert.doesNotMatch(tecnico.sql, /JOIN atendimento_programa/);
  });

  test("uses unique G rows for regional names and matched H rows for municipio buckets", () => {
    const { sql, parameters } = build({ groupBy: ["regional", "municipio"] });
    assert.match(sql, /LEFT JOIN unidade r ON r\.id_und_empresa = a\.regional_id AND r\.id_und_empresa LIKE \$1::text/);
    assert.match(sql, /LEFT JOIN unidade m ON m\.id_und_empresa = a\.id_und_empresa AND m\.id_und_empresa LIKE \$2::text/);
    assert.match(sql, /a\.regional_id::text AS "regionalId",\s+r\.nome_regional AS regional/);
    assert.match(sql, /m\.id_und_empresa::text AS "idUndEmpresa",\s+m\.nome_municipio AS municipio/);
    assert.match(sql, /GROUP BY a\.regional_id, r\.nome_regional, m\.id_und_empresa, m\.nome_municipio/);
    assert.doesNotMatch(sql, /r\.regional_id =|a\.id_und_empresa::text AS "idUndEmpresa"|WHERE|COALESCE|IS NOT NULL/);
    assert.deepEqual(parameters, ["G%", "H%", 1001]);
  });

  test("geographic filters are ANDed and municipio filters require a matched H unit", () => {
    const { sql, parameters } = build({ filters: { regionais: ["G0001", "G0002"], municipios: ["H0349"] } });
    assert.match(sql, /LEFT JOIN unidade m .* LIKE \$1::text/);
    assert.match(sql, /WHERE a\.regional_id = ANY\(\$2::text\[\]\)\s+AND m\.id_und_empresa = ANY\(\$3::text\[\]\)/);
    assert.doesNotMatch(sql, /JOIN unidade r|GROUP BY/);
    assert.deepEqual(parameters, ["H%", ["G0001", "G0002"], ["H0349"], 1001]);
  });

  test("empty/omitted filters keep the same query and do not remove null buckets", () => {
    assert.deepEqual(build({ filters: { programas: [], tecnicos: [], regionais: [], municipios: [] } }), build());
    const { sql } = build({ groupBy: ["month"] });
    assert.match(sql, /GROUP BY a\.month/);
    assert.doesNotMatch(sql, /WHERE|HAVING|UNION|COALESCE|IS NOT NULL/);
  });

  test("default order follows requested dimension IDs/month with nulls last", () => {
    const { sql } = build({ groupBy: ["tecnico", "month", "programa", "municipio", "regional"] });
    assert.match(sql, /ORDER BY at\.id_usuario ASC NULLS LAST, a\.month ASC NULLS LAST, ap\.codigo_programa ASC NULLS LAST, m\.id_und_empresa ASC NULLS LAST, a\.regional_id ASC NULLS LAST/);
    assert.doesNotMatch(sql, /ORDER BY .*::text|ORDER BY .*nome/);
  });

  test("each descending metric uses dimension tie-breaks before the global cap+1", () => {
    for (const orderBy of ["atendimentos", "produtores", "propriedades"]) {
      const { sql, parameters } = build({ groupBy: ["month", "tecnico"], orderBy, limit: 10 });
      assert.ok(sql.endsWith(`ORDER BY ${orderBy} DESC NULLS LAST, a.month ASC NULLS LAST, at.id_usuario ASC NULLS LAST\nLIMIT $1`));
      assert.deepEqual(parameters, [11]);
    }
    assert.deepEqual(build({ limit: 1 }).parameters, [2]);
  });

  test("binds all filter values, prefixes, and the cap with consecutive placeholders", () => {
    const { sql, parameters } = build({
      groupBy: ["month", "programa", "regional", "municipio", "tecnico"],
      filters: {
        monthFrom: "2026-01", monthTo: "2026-09", programas: ["50", "318"],
        tecnicos: ["9007199254740993"], regionais: ["G0001"], municipios: ["H0349"],
      },
      orderBy: "produtores",
      limit: 100,
    });
    assert.deepEqual(parameters, [
      "G%", "H%", "2026-01", "2026-09", ["50", "318"],
      ["9007199254740993"], ["G0001"], ["H0349"], 101,
    ]);
    assert.deepEqual([...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1])), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const literal of ["G%", "H%", "2026-01", "2026-09", "9007199254740993", "G0001", "H0349"]) {
      assert.equal(sql.includes(literal), false);
    }
    assert.match(sql, /a\.month >= \$3::bpchar\s+AND a\.month <= \$4::bpchar/);
  });
});
