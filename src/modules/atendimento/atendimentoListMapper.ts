import {
  ArquivoRelatorioManualResumo,
  AtendimentoListItem,
} from "./types/atendimentoList.types.js";

/** Raw `at_arquivo` projection fed to the mapper (batched child query, ordered by id asc). */
export type AtendimentoArquivoRow = {
  id_at_arquivo: bigint;
  tipo_arquivo: string;
};

/** Shape of one hydrated row from the Step-2 `at_atendimento.findMany` select. */
export type AtendimentoListRow = {
  id_at_atendimento: bigint;
  data_inicio_atendimento: Date;
  data_fim_atendimento: Date | null;
  data_validacao: Date | null;
  data_atualizacao: Date;
  data_criacao: Date;
  data_sei: Date | null;
  data_see: Date | null;
  dt_export_ok: Date | null;
  sn_pendencia: number | null;
  sn_validado: number | null;
  dt_update_record: Date | null;
  id_at_anterior: bigint | null;
  id_und_empresa: string;
  ativo: boolean;
  at_cli_atend_prop: {
    ger_pessoa: {
      nm_pessoa: string | null;
      nr_cpf_cnpj: string | null;
      dap: string | null;
      caf: string | null;
    };
    pl_propriedade: {
      nome_propriedade: string;
      geo_ponto_texto: string | null;
    } | null;
  }[];
  at_atendimento_usuario: {
    usuario: {
      id_usuario: bigint;
      nome_usuario: string | null;
      id_und_empresa: string | null;
    };
  }[];
};

/**
 * App-owned presentation filename from the raw MIME + atendimento id — never Demeter's messy
 * `nome_arquivo`. Images (proof-of-visit) → `foto_<id>`; everything else (the relatório artifact,
 * incl. the rare bad `application/msword`) → `relatorio_<id>`.
 */
function buildNomeArquivo(tipoArquivo: string, atendimentoId: bigint): string {
  const prefix = tipoArquivo.startsWith("image/") ? "foto" : "relatorio";
  return `${prefix}_${atendimentoId}`;
}

/**
 * Renames the Prisma relation shape to the published contract: `at_cli_atend_prop` → `clientes`
 * (produtor + optional propriedade), `at_atendimento_usuario` → `usuarios`. Pure; the arrays are
 * preserved in their incoming (child-id) order — collapsing to a single cliente/usuario is the
 * consumer's job. `arquivos` is the batched `at_arquivo` projection for this atendimento (may be
 * empty), preserved in its incoming (id asc) order.
 */
export function toAtendimentoListItem(
  row: AtendimentoListRow,
  arquivos: AtendimentoArquivoRow[] = [],
): AtendimentoListItem {
  return {
    id_at_atendimento: row.id_at_atendimento,
    data_inicio_atendimento: row.data_inicio_atendimento,
    data_fim_atendimento: row.data_fim_atendimento,
    data_validacao: row.data_validacao,
    data_atualizacao: row.data_atualizacao,
    data_criacao: row.data_criacao,
    data_sei: row.data_sei,
    data_see: row.data_see,
    dt_export_ok: row.dt_export_ok,
    sn_pendencia: row.sn_pendencia,
    sn_validado: row.sn_validado,
    dt_update_record: row.dt_update_record,
    id_at_anterior: row.id_at_anterior,
    id_und_empresa: row.id_und_empresa,
    ativo: row.ativo,
    clientes: row.at_cli_atend_prop.map((c) => ({
      produtor: {
        nm_pessoa: c.ger_pessoa.nm_pessoa,
        nr_cpf_cnpj: c.ger_pessoa.nr_cpf_cnpj,
        dap: c.ger_pessoa.dap,
        caf: c.ger_pessoa.caf,
      },
      propriedade: c.pl_propriedade
        ? {
            nome_propriedade: c.pl_propriedade.nome_propriedade,
            geo_ponto_texto: c.pl_propriedade.geo_ponto_texto,
          }
        : null,
    })),
    usuarios: row.at_atendimento_usuario.map((u) => ({
      id_usuario: u.usuario.id_usuario,
      nome_usuario: u.usuario.nome_usuario,
      id_und_empresa: u.usuario.id_und_empresa,
    })),
    arquivos: arquivos.map(
      (a): ArquivoRelatorioManualResumo => ({
        idArquivo: a.id_at_arquivo,
        tipoArquivo: a.tipo_arquivo,
        nomeArquivo: buildNomeArquivo(a.tipo_arquivo, row.id_at_atendimento),
      }),
    ),
  };
}
