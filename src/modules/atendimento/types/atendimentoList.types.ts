/**
 * Internal repo/resolver shapes for the manual-relatório list. These hold native `bigint`/`Date`
 * values; the GraphQL `BigInt`/`DateTime` scalars serialize them to the wire form at the boundary.
 * Each `clientes` entry is one `at_cli_atend_prop` row (produtor + optional propriedade); the arrays
 * are kept (not collapsed to a single cliente/usuario) — the consumer takes the first.
 */

export type ProdutorResumo = {
  nm_pessoa: string | null;
  nr_cpf_cnpj: string | null;
  dap: string | null;
  caf: string | null;
};

export type PropriedadeResumo = {
  nome_propriedade: string;
  geo_ponto_texto: string | null;
};

export type AtendimentoClienteResumo = {
  produtor: ProdutorResumo;
  propriedade: PropriedadeResumo | null;
};

export type AtendimentoUsuarioResumo = {
  id_usuario: bigint;
  nome_usuario: string | null;
  id_und_empresa: string | null;
};

export type AtendimentoListItem = {
  id_at_atendimento: bigint;
  data_inicio_atendimento: Date;
  data_fim_atendimento: Date | null;
  data_validacao: Date | null;
  data_atualizacao: Date;
  data_criacao: Date;
  data_sei: Date | null;
  data_see: Date | null;
  sn_pendencia: number | null;
  sn_validado: number | null;
  dt_update_record: Date | null;
  id_at_anterior: bigint | null;
  id_und_empresa: string;
  ativo: boolean;
  clientes: AtendimentoClienteResumo[];
  usuarios: AtendimentoUsuarioResumo[];
};

export type AtendimentoPage = {
  items: AtendimentoListItem[];
  pageSize: number;
  nextCursor: bigint | null;
  hasMore: boolean;
};

export type AtendimentoListScope = {
  id_usuario?: bigint | null;
  id_reg_empresa?: string | null;
};
