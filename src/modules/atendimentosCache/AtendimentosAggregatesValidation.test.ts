import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { GraphQLError } from "graphql";
import { AtendimentosAggregatesValidation } from "./AtendimentosAggregatesValidation.js";

const parse = (body: unknown) => AtendimentosAggregatesValidation.parse(body);
const badRequest = (body: unknown) => assert.throws(
  () => parse(body),
  (error: unknown) => error instanceof GraphQLError && error.extensions.code === "BAD_REQUEST",
);

describe("AtendimentosAggregatesValidation", () => {
  test("defaults to ungrouped totals with the maximum cap", () => {
    assert.deepEqual(parse({}), {
      groupBy: [],
      filters: {
        monthFrom: undefined,
        monthTo: undefined,
        programas: [],
        regionais: [],
        municipios: [],
        tecnicos: [],
      },
      orderBy: undefined,
      limit: 1000,
    });
  });

  test("treats null optional fields as omitted and ignores unknown keys", () => {
    assert.deepEqual(parse({
      groupBy: null, filters: null, orderBy: null, limit: null, unknown: { anything: true },
    }), parse({}));
    assert.deepEqual(parse({ filters: {
      monthFrom: null, monthTo: null, programas: null, regionais: null,
      municipios: null, tecnicos: null, unknown: false,
    } }), parse({}));
  });

  test("requires an object body and object-shaped filters", () => {
    for (const value of [undefined, null, [], "", 1, true]) badRequest(value);
    for (const filters of [[], "", 1, false]) badRequest({ filters });
  });

  test("accepts all dimensions in request order and the metric whitelist", () => {
    const groupBy = ["tecnico", "month", "regional", "programa", "municipio"];
    for (const orderBy of ["atendimentos", "produtores", "propriedades"]) {
      assert.deepEqual(parse({ groupBy, orderBy }).groupBy, groupBy);
      assert.equal(parse({ orderBy }).orderBy, orderBy);
    }
    assert.deepEqual(parse({ groupBy: [] }).groupBy, []);
  });

  test("rejects duplicate, unknown, and incorrectly typed dimensions/sorts", () => {
    for (const groupBy of [
      "month", {}, ["month", "month"], ["Month"], ["unknown"], [1], [null],
      ["__proto__"], ["constructor"], ["month; DROP TABLE atendimento"],
    ]) badRequest({ groupBy });
    for (const orderBy of [
      [], {}, 1, true, "month", "toString", "atendimentos DESC; SELECT 1",
    ]) badRequest({ orderBy });
  });

  test("checks actual month/year bounds and inclusive month ordering", () => {
    assert.equal(parse({ filters: { monthFrom: "0001-01", monthTo: "9999-12" } }).filters.monthFrom, "0001-01");
    assert.doesNotThrow(() => parse({ filters: { monthFrom: "2026-02", monthTo: "2026-02" } }));
    assert.doesNotThrow(() => parse({ filters: { monthTo: "2026-01" } }));
    for (const month of [
      "0000-01", "10000-01", "2026-00", "2026-13", "2026-1", "26-01",
      "2026-01-01", " 2026-01 ", 202601, [], {}, true,
    ]) {
      badRequest({ filters: { monthFrom: month } });
      badRequest({ filters: { monthTo: month } });
    }
    badRequest({ filters: { monthFrom: "2026-10", monthTo: "2026-09" } });
  });

  test("normalizes/deduplicates lists, preserves bigint precision, and does not mutate input", () => {
    const input = {
      groupBy: ["month"],
      filters: {
        programas: [" 00050 ", "50", "9223372036854775807", "000"],
        tecnicos: ["001234", " 1234 ", "9007199254740993"],
        regionais: [" G0001 ", "G0001", "G0002"],
        municipios: [" H0349 ", "H0349"],
      },
    };
    const before = structuredClone(input);
    const result = parse(input);
    assert.deepEqual(result.filters, {
      monthFrom: undefined,
      monthTo: undefined,
      programas: ["50", "9223372036854775807", "0"],
      tecnicos: ["1234", "9007199254740993"],
      regionais: ["G0001", "G0002"],
      municipios: ["H0349"],
    });
    result.groupBy.push("tecnico");
    result.filters.programas.push("123");
    assert.deepEqual(input, before);
  });

  test("accepts only digit strings within non-negative signed-bigint range", () => {
    for (const field of ["programas", "tecnicos"]) {
      for (const id of [
        "", " ", "-1", "+1", "1.0", "1e3", "123abc", "9223372036854775808",
        "99999999999999999999999999", 123, null, {}, [],
      ]) badRequest({ filters: { [field]: [id] } });
      assert.deepEqual(parse({ filters: { [field]: ["0", "0001"] } }).filters[field as "programas" | "tecnicos"], ["0", "1"]);
    }
  });

  test("distinguishes regional and local-unit IDs", () => {
    for (const regionais of [["H0001"], ["g0001"], ["G001"], ["G00001"], ["G000x"], [1]]) {
      badRequest({ filters: { regionais } });
    }
    for (const municipios of [["G0001"], ["h0001"], ["H001"], ["H00001"], ["845"], [845]]) {
      badRequest({ filters: { municipios } });
    }
  });

  test("caps each raw list at 1000 entries before deduplication", () => {
    const fixtures = { programas: "50", tecnicos: "1234", regionais: "G0001", municipios: "H0349" };
    for (const [field, id] of Object.entries(fixtures)) {
      assert.doesNotThrow(() => parse({ filters: { [field]: Array(1000).fill(id) } }));
      badRequest({ filters: { [field]: Array(1001).fill(id) } });
      for (const value of [id, 1, true, {}]) badRequest({ filters: { [field]: value } });
      assert.doesNotThrow(() => parse({ filters: { [field]: [] } }));
    }
  });

  test("requires an integer limit in 1–1000", () => {
    for (const limit of [1, 1000]) assert.equal(parse({ limit }).limit, limit);
    for (const limit of [0, -1, 1001, 1.5, NaN, Infinity, "10", false, [], {}]) {
      badRequest({ limit });
    }
  });
});
