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
  dt_export_ok: null,
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
    const exportDate = new Date("2026-06-25");
    const item = toAtendimentoListItem({
      ...baseRow,
      dt_export_ok: exportDate,
    });
    assert.equal(item.id_at_atendimento, 1980461n);
    assert.equal(item.id_und_empresa, "H1234");
    assert.equal(item.sn_validado, 1);
    assert.equal(item.id_at_anterior, null);
    assert.equal(item.dt_export_ok, exportDate);
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

  test("defaults arquivos to [] when the second arg is omitted", () => {
    assert.deepEqual(toAtendimentoListItem(baseRow).arquivos, []);
  });

  test("maps arquivos with app-generated nomeArquivo (image -> foto, else -> relatorio)", () => {
    const item = toAtendimentoListItem(baseRow, [
      { id_at_arquivo: 501n, tipo_arquivo: "application/pdf" },
      { id_at_arquivo: 777n, tipo_arquivo: "image/jpeg" },
      { id_at_arquivo: 900n, tipo_arquivo: "application/msword" },
    ]);

    assert.deepEqual(item.arquivos, [
      {
        idArquivo: 501n,
        tipoArquivo: "application/pdf",
        nomeArquivo: "relatorio_1980461",
      },
      {
        idArquivo: 777n,
        tipoArquivo: "image/jpeg",
        nomeArquivo: "foto_1980461",
      },
      {
        idArquivo: 900n,
        tipoArquivo: "application/msword",
        nomeArquivo: "relatorio_1980461",
      },
    ]);
  });

  test("preserves the incoming (id asc) arquivos order", () => {
    const item = toAtendimentoListItem(baseRow, [
      { id_at_arquivo: 10n, tipo_arquivo: "image/png" },
      { id_at_arquivo: 20n, tipo_arquivo: "application/pdf" },
    ]);
    assert.deepEqual(
      item.arquivos.map((a) => a.idArquivo),
      [10n, 20n],
    );
  });
});
