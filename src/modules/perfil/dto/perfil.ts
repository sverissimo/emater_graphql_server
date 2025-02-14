export type CreatePerfilInput = {
  id_tecnico: string;
  id_cliente: string;
  id_propriedade: bigint;
  atividade: string;
  tipo_perfil: string;
  data_preenchimento: string;
  data_atualizacao: string;
  atividades_usam_recursos_hidricos: bigint;
  atividades_com_regularizacao_ambiental: bigint;
  possui_cadastro_car: boolean;
  aderiu_pra: boolean;
  ciente_iniciativas_regularizacao_pra: boolean;
  condicao_posse: bigint;
  realiza_escalonamento_producao: boolean;
  procedimento_pos_colheita: bigint;
  agroindustria_precisa_adaptacao_reforma: boolean;
  possui_registro_orgao_fiscalizacao_sanitaria: boolean;
  orgao_fiscalizacao_sanitaria: string;
  possui_agroindustria_propria: boolean;
  tipo_gestao_unidade: string;
  pessoas_processamento_alimentos: number;
  dap_caf_vigente: boolean;
  credito_rural: boolean;
  fonte_captacao_agua: bigint;
  dados_producao_in_natura: CreateDadosProducaoDTO;
  dados_producao_agro_industria: CreateDadosProducaoDTO;
  ativo?: boolean;
  id_contrato?: number;
};

export type CreatePerfilDTO = Omit<
  CreatePerfilInput,
  "atividade" | "dados_producao_agro_industria" | "dados_producao_in_natura"
>;

export type CreateDadosProducaoDTO = {
  tipo_regularizacao_uso_recursos_hidricos: string;
  tipo_regularizacao_ambiental: string;
  controla_custos_producao: boolean;
  local_comercializacao: bigint;
  dificuldade_fornecimento: bigint;
  forma_entrega_produtos: bigint;
  valor_total_obtido_pnae: bigint;
  valor_total_obtido_outros: bigint;
  informacoes_adicionais: string;
  at_prf_see_grupos_produtos: CreateGrupoProdutosInput[];
};

export type CreateGrupoProdutosInput = {
  id_grupo: bigint;
  area_utilizada?: number;
  producao_aproximada_ultimo_ano_pnae: bigint;
  producao_aproximada_ultimo_ano_total: bigint;
  at_prf_see_produto: CreateProdutoDTO[];
};

export type CreateGrupoProdutosDTO = CreateGrupoProdutosInput & {
  id_dados_producao: string;
};

export type CreateProdutoInput = {
  id_produto: bigint;
  area_utilizada?: number;
  producao_aproximada_ultimo_ano_pnae?: bigint;
  producao_aproximada_ultimo_ano_total?: bigint;
};

export type CreateProdutoDTO = CreateProdutoInput & {
  id_perfil_grupo: string;
};
