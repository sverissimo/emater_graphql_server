import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CreateProdutorDTO } from "./dto/CreateProdutorDTO.js";
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

const propriedade = {
  nome: "Sítio Boa Vista",
  areaTotal: 12.5,
  geoPontoTexto: "POINT(-43.9 -19.9)",
  municipioId: 456,
  unidadeEmpresa: "H002",
};

const missing = null as unknown as string;

const assertValidationError = (fn: () => unknown, message: string) =>
  assert.throws(fn, { name: "ProdutorValidationError", message });

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

  test("treats missing or blank CPF and phone input as empty", () => {
    assert.equal(normalizeCpf(missing), "");
    for (const phone of [missing, "   "]) {
      assertValidationError(
        () => normalizePhone(phone),
        "telefone contém caracteres inválidos",
      );
    }
  });

  test("trims phones and strips the 55 code only from 12-13 digits", () => {
    assert.equal(normalizePhone(" (31) 3333-4444 "), "3133334444");
    assert.equal(normalizePhone("+55 (31) 3333-4444"), "3133334444");
    assert.equal(normalizePhone("5531999998888"), "31999998888");
    assertValidationError(
      () => normalizePhone("+55 31 99999-88889"),
      "telefone inválido",
    );
  });

  test("accepts spaced CPFs and separates character from digit failures", () => {
    assert.equal(
      validateAndNormalize({ ...validInput, cpf: "529 982 247 25" }).cpf,
      "52998224725",
    );
    assertValidationError(
      () => validateAndNormalize({ ...validInput, cpf: "529.982.247-25x" }),
      "CPF contém caracteres inválidos",
    );
    assertValidationError(
      () => validateAndNormalize({ ...validInput, cpf: "52998224735" }),
      "CPF inválido",
    );
  });

  test("maps a check-digit remainder of 10 to 0", () => {
    assert.equal(isValidCpf("12345678909"), true);
  });

  test("rejects missing required fields by name", () => {
    const cases: [string, CreateProdutorDTO][] = [
      ["nome", { ...validInput, nome: missing }],
      ["cpf", { ...validInput, cpf: missing }],
      ["unidadeEmpresa", { ...validInput, unidadeEmpresa: missing }],
      [
        "propriedade.nome",
        { ...validInput, propriedade: { ...propriedade, nome: missing } },
      ],
      [
        "propriedade.unidadeEmpresa",
        {
          ...validInput,
          propriedade: { ...propriedade, unidadeEmpresa: missing },
        },
      ],
    ];

    for (const [field, input] of cases) {
      assertValidationError(
        () => validateAndNormalize(input),
        `Campo obrigatório ausente ou vazio: ${field}`,
      );
    }
  });

  test("enforces the remaining field max lengths at their boundary", () => {
    const cases: [
      string,
      number,
      (value: string) => Partial<CreateProdutorDTO>,
    ][] = [
      ["email", 80, (email) => ({ email })],
      ["identidade", 15, (identidade) => ({ identidade })],
      ["tpSexo", 1, (tpSexo) => ({ tpSexo })],
      ["logradouro", 100, (logradouro) => ({ endereco: { logradouro } })],
      ["numero", 15, (numero) => ({ endereco: { numero } })],
      ["complemento", 80, (complemento) => ({ endereco: { complemento } })],
      ["bairro", 80, (bairro) => ({ endereco: { bairro } })],
    ];

    for (const [field, max, build] of cases) {
      assert.doesNotThrow(() =>
        validateAndNormalize({ ...validInput, ...build("x".repeat(max)) }),
      );
      assertValidationError(
        () =>
          validateAndNormalize({
            ...validInput,
            ...build("x".repeat(max + 1)),
          }),
        `Campo ${field} excede ${max} caracteres`,
      );
    }
  });

  test("accepts absent optional values and areaTotal just below the cap", () => {
    assert.equal(
      validateAndNormalize({ ...validInput, telefone: null }).telefone,
      null,
    );
    for (const areaTotal of [null, undefined, 999_999_999.9999]) {
      assert.doesNotThrow(() =>
        validateAndNormalize({
          ...validInput,
          propriedade: { ...propriedade, areaTotal },
        }),
      );
    }
  });
});
