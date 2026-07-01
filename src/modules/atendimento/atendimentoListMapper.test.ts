import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AtendimentoListRow,
  toAtendimentoListItem,
} from "./atendimentoListMapper.js";

const baseRow: AtendimentoListRow = {
  id_at_atendimento: 1980461n,
  data_inicio_atendimento: new Date("2026-06-20"),
  data_fim_atendimento: new Date("2026-06-20"),
  data_validacao: null,
  data_atualizacao: new Date("2026-06-21"),
  data_criacao: new Date("2026-06-20"),
  data_sei: null,
  data_see: null,
  sn_pendencia: 0,
  sn_validado: 1,
  dt_update_record: new Date("2026-06-21T13:42:05.000Z"),
  id_at_anterior: null,
  id_und_empresa: "H1234",
  ativo: true,
  at_cli_atend_prop: [],
  at_atendimento_usuario: [],
};

describe("toAtendimentoListItem", () => {
  test("passes scalar columns through unchanged (native bigint/Date)", () => {
    const item = toAtendimentoListItem(baseRow);
    assert.equal(item.id_at_atendimento, 1980461n);
    assert.equal(item.id_und_empresa, "H1234");
    assert.equal(item.sn_validado, 1);
    assert.equal(item.id_at_anterior, null);
    assert.ok(item.data_inicio_atendimento instanceof Date);
  });

  test("renames at_cli_atend_prop -> clientes with nested produtor/propriedade", () => {
    const item = toAtendimentoListItem({
      ...baseRow,
      at_cli_atend_prop: [
        {
          ger_pessoa: {
            nm_pessoa: "João da Silva",
            nr_cpf_cnpj: "12345678900",
            dap: "SDW123",
            caf: null,
          },
          pl_propriedade: {
            nome_propriedade: "Sítio Boa Vista",
            geo_ponto_texto: "POINT(-44.1 -19.9)",
          },
        },
      ],
    });

    assert.deepEqual(item.clientes, [
      {
        produtor: {
          nm_pessoa: "João da Silva",
          nr_cpf_cnpj: "12345678900",
          dap: "SDW123",
          caf: null,
        },
        propriedade: {
          nome_propriedade: "Sítio Boa Vista",
          geo_ponto_texto: "POINT(-44.1 -19.9)",
        },
      },
    ]);
  });

  test("maps a missing propriedade (LEFT JOIN) to null, not an error", () => {
    const item = toAtendimentoListItem({
      ...baseRow,
      at_cli_atend_prop: [
        {
          ger_pessoa: {
            nm_pessoa: "Maria",
            nr_cpf_cnpj: null,
            dap: null,
            caf: null,
          },
          pl_propriedade: null,
        },
      ],
    });

    assert.equal(item.clientes[0].propriedade, null);
    assert.equal(item.clientes[0].produtor.nm_pessoa, "Maria");
  });

  test("preserves multiple clientes in incoming order (no collapse to first)", () => {
    const mk = (nm: string) => ({
      ger_pessoa: { nm_pessoa: nm, nr_cpf_cnpj: null, dap: null, caf: null },
      pl_propriedade: null,
    });
    const item = toAtendimentoListItem({
      ...baseRow,
      at_cli_atend_prop: [mk("A"), mk("B")],
    });

    assert.equal(item.clientes.length, 2);
    assert.deepEqual(
      item.clientes.map((c) => c.produtor.nm_pessoa),
      ["A", "B"],
    );
  });

  test("flattens at_atendimento_usuario -> usuarios; empty stays empty", () => {
    assert.deepEqual(toAtendimentoListItem(baseRow).usuarios, []);

    const item = toAtendimentoListItem({
      ...baseRow,
      at_atendimento_usuario: [
        {
          usuario: {
            id_usuario: 8842n,
            nome_usuario: "MARIA TECNICA",
            id_und_empresa: "H1234",
          },
        },
      ],
    });
    assert.deepEqual(item.usuarios, [
      { id_usuario: 8842n, nome_usuario: "MARIA TECNICA", id_und_empresa: "H1234" },
    ]);
  });
});
