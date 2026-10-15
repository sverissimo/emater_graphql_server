import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { MunicipioEmater } from "../../../repositories/types/MunicipioEmater.js";
import { AtendimentosCacheRules } from "./AtendimentosCacheRules.js";

const assertRange = (
  instant: string,
  start: string,
  end: string,
  endExclusive: string,
) =>
  assert.deepEqual(AtendimentosCacheRules.dateRange(new Date(instant)), {
    start,
    end,
    endExclusive,
  });

const municipio = (
  id_und_empresa: string,
  regional_id: string,
): MunicipioEmater => ({
  id_und_empresa,
  nome_municipio: `Município ${id_und_empresa}`,
  municipio_id: Number(id_und_empresa.slice(1)),
  regional_id,
  nome_regional: `Regional ${regional_id}`,
  regional_sre: null,
});

const unidade = (
  id_und_empresa: string,
  regional_id: string,
  nome_municipio: string | null,
) => ({
  id_und_empresa,
  nome_municipio,
  regional_id,
  nome_regional: `Regional ${regional_id}`,
});

describe("AtendimentosCacheRules.dateRange", () => {
  test("covers the month twelve months ago through yesterday", () => {
    assertRange("2026-10-14T12:00:00Z", "2025-10-01", "2026-10-13", "2026-10-14");
  });

  test("uses the São Paulo calendar day, not UTC", () => {
    assertRange("2026-10-15T02:59:59Z", "2025-10-01", "2026-10-13", "2026-10-14");
    assertRange("2026-10-15T03:00:00Z", "2025-10-01", "2026-10-14", "2026-10-15");
  });

  test("rolls over at a month boundary", () => {
    assertRange("2026-11-01T04:00:00Z", "2025-11-01", "2026-10-31", "2026-11-01");
  });

  test("rolls over at a year boundary", () => {
    assertRange("2027-01-01T04:00:00Z", "2026-01-01", "2026-12-31", "2027-01-01");
    assertRange("2027-01-01T01:30:00Z", "2025-12-01", "2026-12-30", "2026-12-31");
    assertRange("2027-01-15T12:00:00Z", "2026-01-01", "2027-01-14", "2027-01-15");
  });

  test("handles February in leap and common years", () => {
    assertRange("2028-03-01T04:00:00Z", "2027-03-01", "2028-02-29", "2028-03-01");
    assertRange("2027-03-01T04:00:00Z", "2026-03-01", "2027-02-28", "2027-03-01");
  });
});

describe("AtendimentosCacheRules.unidadeLookup", () => {
  const lookup = AtendimentosCacheRules.unidadeLookup([
    municipio("H0001", "G0001"),
    municipio("H0002", "G0001"),
    municipio("H0003", "G0002"),
  ]);

  test("adds each H unit and each distinct G regional once", () => {
    assert.deepEqual(lookup.unidades, [
      unidade("G0001", "G0001", null),
      unidade("H0001", "G0001", "Município H0001"),
      unidade("H0002", "G0001", "Município H0002"),
      unidade("G0002", "G0002", null),
      unidade("H0003", "G0002", "Município H0003"),
    ]);
  });

  test("maps H units to their regional", () => {
    assert.equal(lookup.regionalIdOf("H0001"), "G0001");
    assert.equal(lookup.regionalIdOf("H0003"), "G0002");
  });

  test("maps captured G regionals to themselves", () => {
    assert.equal(lookup.regionalIdOf("G0001"), "G0001");
    assert.equal(lookup.regionalIdOf("G0002"), "G0002");
  });

  test("leaves unmatched units without a regional", () => {
    for (const unit of ["H9999", "G9999", "X0001", ""]) {
      assert.equal(lookup.regionalIdOf(unit), null);
    }
  });

  test("handles an empty lookup", () => {
    const empty = AtendimentosCacheRules.unidadeLookup([]);
    assert.deepEqual(empty.unidades, []);
    assert.equal(empty.regionalIdOf("H0001"), null);
  });
});
