export type CreatePerfilInput = {
  atividade: string;
  atividades_usam_recursos_hidricos: string;
  atividades_com_regularizacao_ambiental: string;
  possui_cadastro_car: boolean;
  aderiu_pra: boolean;
  ciente_iniciativas_regularizacao_pra: boolean;
  condicao_posse: string;
  realiza_escalonamento_producao: boolean;
  procedimento_pos_colheita: string;
  agroindustria_precisa_adaptacao_reforma: boolean;
  possui_registro_orgao_fiscalizacao_sanitaria: boolean;
  orgao_fiscalizacao_sanitaria: string;
  possui_agroindustria_propria: boolean;
  tipo_gestao_unidade: string;
  pessoas_processamento_alimentos: number;
  dap_caf_vigente: boolean;
  credito_rural: boolean;
  fonte_captacao_agua: string;
  id_tecnico: string;
  id_cliente: string;
  dados_producao_in_natura: CreateDadosProducaoDTO;
  dados_producao_agro_industria: CreateDadosProducaoDTO;
};

export type CreatePerfilDTO = Omit<
  CreatePerfilInput,
  "atividade" | "dados_producao_agro_industria" | "dados_producao_in_natura"
>;

export type CreateDadosProducaoDTO = {
  tipo_regularizacao_uso_recursos_hidricos: string;
  tipo_regularizacao_ambiental: string;
  controla_custos_producao: boolean;
  local_comercializacao: string;
  dificuldade_fornecimento: string;
  forma_entrega_produtos: string;
  valor_total_obtido_pnae: string;
  valor_total_obtido_outros: string;
  informacoes_adicionais: string;
  at_prf_see_grupos_produtos: CreateGrupoProdutosInput[];
};

export type CreateGrupoProdutosInput = {
  id_grupo: string;
  area_utilizada?: number;
  producao_aproximada_ultimo_ano_pnae: string;
  producao_aproximada_ultimo_ano_total: string;
  at_prf_see_produto: CreateProdutoDTO[];
};

export type CreateGrupoProdutosDTO = CreateGrupoProdutosInput & {
  id_dados_producao: string;
};

export type CreateProdutoInput = {
  id_produto: string;
  area_utilizada?: number;
  producao_aproximada_ultimo_ano_pnae?: string;
  producao_aproximada_ultimo_ano_total?: string;
};

export type CreateProdutoDTO = CreateProdutoInput & {
  id_perfil_grupo: string;
};
