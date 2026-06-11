import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ProdutorDataMapper } from "./ProdutorDataMapper.js";
import { TIPO_CONTATO, TIPO_LOGRADOURO_IDS } from "./produtorConstants.js";

describe("ProdutorDataMapper", () => {
  test("maps domain fields to Prisma columns", () => {
    const dataNascimento = new Date("1990-01-02T00:00:00.000Z");

    assert.deepEqual(
      ProdutorDataMapper.mapProdutorInput({
        nome: "Maria",
        cpf: "52998224725",
        email: "maria@example.com",
        dataNascimento,
        tpSexo: "F",
        identidade: "MG123",
        unidadeEmpresa: "H001",
        municipioId: 123,
      }),
      {
        nm_pessoa: "Maria",
        nr_cpf_cnpj: "52998224725",
        ds_email: "maria@example.com",
        dt_nascimento: dataNascimento,
        tp_sexo: "F",
        nr_identidade: "MG123",
      },
    );
  });

  test("derives tipo logradouro", () => {
    const cases: Array<[string, number | null]> = [
      ["Rua das Hortas", TIPO_LOGRADOURO_IDS.Rua],
      ["AV. BRASIL", TIPO_LOGRADOURO_IDS.Avenida],
      ["BR-040", TIPO_LOGRADOURO_IDS.Rodovia],
      ["MG 050", TIPO_LOGRADOURO_IDS.Rodovia],
      ["LMG808", TIPO_LOGRADOURO_IDS.Rodovia],
      ["AMG-123", TIPO_LOGRADOURO_IDS.Rodovia],
      ["Pç da Sé", TIPO_LOGRADOURO_IDS.Praça],
      ["Sem tipo conhecido", null],
    ];

    for (const [logradouro, expected] of cases) {
      assert.equal(ProdutorDataMapper.tipoLogradouro(logradouro), expected);
    }
  });

  test("normalizes valid phone formats and derives contact type", () => {
    assert.equal(
      ProdutorDataMapper.normalizePhone("(31) 3333-4444"),
      "3133334444",
    );
    assert.equal(
      ProdutorDataMapper.normalizePhone("(31) 99999-8888"),
      "31999998888",
    );
    assert.equal(
      ProdutorDataMapper.normalizePhone("+55 (31) 99999-8888"),
      "31999998888",
    );
    assert.equal(
      ProdutorDataMapper.normalizePhone("55999998888"),
      "55999998888",
    );
    assert.equal(
      ProdutorDataMapper.tipoContato("3133334444"),
      TIPO_CONTATO.COMERCIAL,
    );
    assert.equal(
      ProdutorDataMapper.tipoContato("31999998888"),
      TIPO_CONTATO.CELULAR,
    );
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
      assert.throws(() => ProdutorDataMapper.normalizePhone(phone));
    }
  });
});
