import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  isValidCpf,
  normalizeCpf,
  normalizePhone,
  validateAndNormalize,
} from "./produtorValidation.js";

const validInput = {
  nome: "Maria",
  cpf: "529.982.247-25",
  unidadeEmpresa: "H001",
  municipioId: 123,
};

describe("produtorValidation", () => {
  test("normalizes and validates CPF", () => {
    assert.equal(normalizeCpf("529.982.247-25"), "52998224725");
    assert.equal(isValidCpf("52998224725"), true);
    assert.equal(validateAndNormalize(validInput).cpf, "52998224725");
  });

  test("rejects invalid CPF values", () => {
    for (const cpf of [
      "",
      "11111111111",
      "52998224724",
      "5299822472",
      "abc529.982.247-25",
    ]) {
      assert.throws(() => validateAndNormalize({ ...validInput, cpf }));
    }
  });

  test("rejects invalid required fields and municipioId", () => {
    assert.throws(() => validateAndNormalize({ ...validInput, nome: " " }));
    assert.throws(() =>
      validateAndNormalize({ ...validInput, unidadeEmpresa: "" }),
    );
    assert.throws(() =>
      validateAndNormalize({ ...validInput, municipioId: 0 }),
    );
    assert.throws(() =>
      validateAndNormalize({ ...validInput, municipioId: 1.5 }),
    );
  });

  test("enforces bounded string lengths", () => {
    assert.throws(() =>
      validateAndNormalize({ ...validInput, nome: "x".repeat(101) }),
    );
    assert.throws(() =>
      validateAndNormalize({
        ...validInput,
        endereco: { cep: "1".repeat(9) },
      }),
    );
  });

  test("normalizes valid phone formats", () => {
    assert.equal(normalizePhone("(31) 3333-4444"), "3133334444");
    assert.equal(normalizePhone("(31) 99999-8888"), "31999998888");
    assert.equal(normalizePhone("+55 (31) 99999-8888"), "31999998888");
    assert.equal(normalizePhone("55999998888"), "55999998888");
  });

  test("rejects malformed phone values", () => {
    for (const phone of [
      "",
      "31ABC9999",
      "31.99999.8888",
      "31+99999-8888",
      "+1 202 555 0198",
      "319999",
      "319999988889",
      "31\t99999-8888",
    ]) {
      assert.throws(() => normalizePhone(phone));
    }
  });

  test("normalizes telefone through validateAndNormalize", () => {
    assert.equal(
      validateAndNormalize({ ...validInput, telefone: "(31) 99999-8888" })
        .telefone,
      "31999998888",
    );
    assert.throws(() =>
      validateAndNormalize({ ...validInput, telefone: "31+99999-8888" }),
    );
  });

  test("validates the optional propriedade", () => {
    const propriedade = {
      nome: "Sítio Boa Vista",
      areaTotal: 12.5,
      geoPontoTexto: "POINT(-43.9 -19.9)",
      municipioId: 456,
      unidadeEmpresa: "H002",
    };

    assert.deepEqual(
      validateAndNormalize({ ...validInput, propriedade }).propriedade,
      propriedade,
    );

    for (const bad of [
      { nome: " " },
      { nome: "x".repeat(101) },
      { geoPontoTexto: "x".repeat(256) },
      { unidadeEmpresa: "" },
      { unidadeEmpresa: "H00001" },
      { municipioId: 0 },
      { municipioId: 1.5 },
      { areaTotal: 0 },
      { areaTotal: -1 },
      { areaTotal: Number.NaN },
      { areaTotal: 1e9 },
    ]) {
      assert.throws(() =>
        validateAndNormalize({
          ...validInput,
          propriedade: { ...propriedade, ...bad },
        }),
      );
    }
  });
});
