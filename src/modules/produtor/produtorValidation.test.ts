import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  isValidCpf,
  normalizeCpf,
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
});
