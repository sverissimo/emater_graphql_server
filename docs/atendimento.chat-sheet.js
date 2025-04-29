const at_atendimento = {
  id_at_atendimento: "1746156",
  descricao: null,
  data_inicio_atendimento: "2025-01-13",
  data_fim_atendimento: "2025-01-13",
  data_validacao: null,
  id_at_acao: "1", // Default PNAE: 1 -> Atendimento Individual presencial
  id_und_empresa: "H0349",
  id_at_status: 1, // Default PNAE: 1 -> Iniciado
  data_sei: null,
  link_pdf: null,
  sn_pendencia: null, // default PNAE backend: 0
  sn_validado: null,
};

//----- LOOKUP TABLE
const at_indicador = {
  id_at_indicador: "4550", // Indicador do PNAE - grupo 323
  id_at_grupo_indicador: "323", // Contrato Nº 9451439/2025 -2026 - SEE - ATER no âmbito do PNAE
  id_at_produto: "2006", // id 1814: 2.3 Orientação Técnica Individual (ATER Individual)
  anexo_obrigatorio: true,
  foto_obrigatoria: true,
  // id_at_indicador: '4026',  Indicador do PNAE ANTIGO - grupo 279
  // id_at_grupo_indicador: '279', // Contrato ANTIGO Nº 9385527/2023 - SEE - ATER no âmbito do PNAE
  // id_at_produto: '1814', // id 1814: 2.3 Orientação Técnica Individual (ATER Individual)
};

const at_atendimento_indicador = [
  {
    id_at_atendimento_indicador: "5647421",
    id_at_atendimento: "1746156",
    id_at_indicador: "4550",
    id_und_empresa: "H0237",
  },
];

//----- LOOKUP TABLE
const at_campo_acessorio = [
  {
    id_at_campo_acessorio: "133",
    descricao: "Visita Nº",
    id_at_tipo_campo_acessorio: 4, // Inteiro
  },
  // ***** Excluído para o contrato de 2025 ******
  // {
  //   id_at_campo_acessorio: "134",
  //   descricao: "Esse relatório é substituto de outro?",
  //   id_at_tipo_campo_acessorio: 5, // Botão Rádio (único)
  // },
  {
    id_at_campo_acessorio: "187",
    descricao: "Tema",
    id_at_tipo_campo_acessorio: 6, // CheckBox (vários)
  },
];

//----- LOOKUP TABLE
const at_indicador_campo_acessorio = [
  {
    id_at_indicador_camp_acessorio: "14032",
    id_at_indicador: "4550", // Indicador do PNAE - grupo 323
    id_at_campo_acessorio: "133", // Visita Nº
    ativo: true,
  },
  {
    id_at_indicador_camp_acessorio: "14033",
    id_at_indicador: "4550", // Indicador do PNAE - grupo 323
    id_at_campo_acessorio: "187", // Tema
    ativo: true,
  },
  //   {
  //     id_at_indicador_camp_acessorio: '13895',
  //     id_at_indicador: '4026',
  //     id_at_campo_acessorio: '134',
  //     ativo: true,
  //   },  // ---- CONFIRMAR SE ESSE VALE PARA O NOVO CONTRATO
];

//*** SAVE HERE - JOIN TABLE ***
const at_atendimento_indi_camp_acess = [
  {
    id_at_aten_indi_camp_acess: "395802",
    id_at_atendimento_indicador: "5647421",
    id_at_indicador_camp_acessorio: "14032", // Visita Nº
    valor_campo_acessorio: "1", //
    id_und_empresa: "H0237",
  },
  {
    id_at_aten_indi_camp_acess: "395803",
    id_at_atendimento_indicador: "5647421",
    id_at_indicador_camp_acessorio: "14033", // Tema
    valor_campo_acessorio: "3", // Agroindústria. Ex: 1;2;3
    possui_lista_valures: true, // Required. default POSTGRES DB: false
    id_und_empresa: "H0237",
  },
];

//----- READ ONLY BUT NEED TO FETCH TO FRONTEND
const at_indicador_campo_acessorio_lista = [
  {
    id_lista: "160",
    fk_at_indicador_camp_acessorio: "14033",
    chave: "Pecuária",
    valor: "1",
  },
  {
    id_lista: "159",
    fk_at_indicador_camp_acessorio: "14033",
    chave: "Culturas",
    valor: "2",
  },
  {
    id_lista: "158",
    fk_at_indicador_camp_acessorio: "14033",
    chave: "Agroindústria",
    valor: "3",
  },
];

// ----- LOOKUP TABLE
const at_tipo_campo_acessorio = [
  {
    id_at_tipo_campo_acessorio: 1,
    descricao: "Data",
    lista_valores: false,
  },
  {
    id_at_tipo_campo_acessorio: 2,
    descricao: "Decimal",
    lista_valores: false,
  },
  {
    id_at_tipo_campo_acessorio: 3,
    descricao: "Textual",
    lista_valores: false,
  },
  {
    id_at_tipo_campo_acessorio: 4,
    descricao: "Inteiro",
    lista_valores: false,
  },
  {
    id_at_tipo_campo_acessorio: 5,
    descricao: "Botão Rádio (único)",
    lista_valores: true,
  },
  {
    id_at_tipo_campo_acessorio: 6,
    descricao: "CheckBox (vários)",
    lista_valores: true,
  },
  {
    id_at_tipo_campo_acessorio: 7,
    descricao: "Lista (único)",
    lista_valores: true,
  },
  {
    id_at_tipo_campo_acessorio: 8,
    descricao: "Mensagem",
    lista_valores: false,
  },
];
