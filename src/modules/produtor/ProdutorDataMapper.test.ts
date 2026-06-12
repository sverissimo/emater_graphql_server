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

  test("maps propriedade fields to Prisma columns", () => {
    assert.deepEqual(
      ProdutorDataMapper.mapPropriedade({
        nome: "Sítio Boa Vista",
        areaTotal: 12.5,
        geoPontoTexto: "POINT(-43.9 -19.9)",
        municipioId: 456,
        unidadeEmpresa: "H002",
      }),
      {
        nome_propriedade: "Sítio Boa Vista",
        area_total: 12.5,
        geo_ponto_texto: "POINT(-43.9 -19.9)",
        id_municipio: 456,
        id_und_empresa: "H002",
        ativo: true,
      },
    );

    assert.deepEqual(
      ProdutorDataMapper.mapPropriedade({
        nome: "Sítio Boa Vista",
        municipioId: 456,
        unidadeEmpresa: "H002",
      }),
      {
        nome_propriedade: "Sítio Boa Vista",
        area_total: null,
        geo_ponto_texto: null,
        id_municipio: 456,
        id_und_empresa: "H002",
        ativo: true,
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

  test("derives contact type from the mobility digit", () => {
    assert.equal(
      ProdutorDataMapper.tipoContato("3133334444"),
      TIPO_CONTATO.COMERCIAL,
    );
    assert.equal(
      ProdutorDataMapper.tipoContato("31999998888"),
      TIPO_CONTATO.CELULAR,
    );
  });
});
