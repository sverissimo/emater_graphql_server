type at_atendimento_usuario = {
  id_at_atendimento?: bigint;
  id_usuario: bigint;
  id_und_empresa: string;
};

type at_atendimento_indicador = {
  id_at_atendimento_indicador?: bigint;
  id_at_atendimento?: bigint;
  id_at_indicador: bigint;
  id_und_empresa: string;
};

type at_cli_atend_prop = {
  id_at_cli_atend_prop?: bigint;
  id_at_atendimento?: bigint;
  id_pessoa_demeter: bigint;
  id_pl_propriedade: bigint;
  id_und_empresa: string;
};

export type CreateAtendimentoDTO = {
  id_at_atendimento?: bigint;
  id_at_acao: bigint;
  id_at_status: number;
  ativo: boolean;
  usuario_validacao?: bigint;
  id_und_empresa: string;
  link_pdf: string;
  data_criacao: string;
  data_inicio_atendimento: string;
  data_fim_atendimento: string;
  data_atualizacao: string;
  atendimento_usuario: at_atendimento_usuario;
  atendimento_indicador: at_atendimento_indicador;
  at_cli_atend_prop: at_cli_atend_prop;
};

export type UpdateAtendimentoDTO = Partial<CreateAtendimentoDTO> & {
  id_at_atendimento: bigint;
};
