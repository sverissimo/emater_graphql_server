// createProdutor — what one mutation writes, table by table. Prose/why -> create-produtor.notes.md
//   *** SAVE HERE ***  -> row(s) this mutation INSERTs
//   ----- LOOKUP       -> read-only; we only `connect` an existing id

// 1) GraphQL input the client sends (flat domain shape, no DB names)
const createProdutorInput = {
  nome: "Maria das Couves", // -> ger_pessoa.nm_pessoa
  cpf: "12345678901", // -> ger_pessoa.nr_cpf_cnpj (unique: uk_ger_pessoa_nr_cpf_cnpj)
  email: "maria@example.com", // -> ger_pessoa.ds_email
  dataNascimento: "1980-05-12", // -> ger_pessoa.dt_nascimento
  tpSexo: "F", // -> ger_pessoa.tp_sexo
  identidade: "MG-12.345.678", // -> ger_pessoa.nr_identidade
  unidadeEmpresa: "H0349", // -> id_und_empresa (EVERY table); from getMunicipiosEmater pick
  municipioId: 845, // -> ger_end_pessoa.fk_municipio; from getMunicipiosEmater pick
  endereco: {
    // ≤1, optional, street-level only
    // tpEndereco: 1, // -> CHANGED: ger_end_pessoa.tp_endereco is now FIXED (NEW requirement) -> always 1
    logradouro: "Rua das Hortas", // repo derives fk_tpo_logradouro from this
    numero: "100",
    complemento: null,
    bairro: "Centro",
    cep: "36000000",
  },
  telefone: "33999998888", // ≤1, optional, FLAT scalar -> contato_pessoa.telefone (rest derived)
  // no categorias/subcategorias (fixed, rows 4-5); no tipoContato/operadora/tipoLogradouro (derived)
};

//----- LOOKUP: GET /api/getMunicipiosEmater — fills the município SELECT box
const getMunicipiosEmater_row = {
  id_und_empresa: "H0349", // -> input.unidadeEmpresa
  nome_municipio: "Viçosa", // display in the select box
  municipio_id: 845, // -> input.municipioId
  regional_id: "G0300", // client persists for the regional filter
  nome_regional: "SER Viçosa", // joined from the G row
};

const createProdutorResult = "987654321"; // id_pessoa_demeter (BigInt as string)

// 2) *** SAVE HERE *** ger_pessoa (the Produtor root; always inserted)
const ger_pessoa = {
  // id_pessoa_demeter -> autoincrement (returned as BigInt string)
  nm_pessoa: "Maria das Couves",
  nr_cpf_cnpj: "12345678901",
  ds_email: "maria@example.com",
  dt_nascimento: "1980-05-12",
  tp_sexo: "F",
  nr_identidade: "MG-12.345.678",
  id_und_empresa: "H0349",
  dt_update_record: "<new Date()>", // REQUIRED, repo-set
  // sn_ativo (default 1), senha (default), id_sincronismo (DB uuid) -> omitted
};

// 3) *** SAVE HERE *** ger_end_pessoa (≤1, only if `endereco` provided)
const ger_end_pessoa = {
  tp_endereco: 1, // FIXED (NEW user requirement)
  ds_logradouro: "Rua das Hortas",
  nr_logradouro: "100",
  ds_complemento: null,
  nm_bairro: "Centro",
  nr_cep: "36000000",
  fk_municipio: 845, // REQUIRED <- input.municipioId
  fk_tpo_logradouro: 1, // DERIVED from ds_logradouro ("Rua..." -> 1); null if no match
  fk_distrito: null, // dropped (sep_distrito near-empty) -> always null
  id_und_empresa: "H0349",
  // fk_pessoa -> Prisma nested create; dt_update_record -> repo-set
};

// 4) *** SAVE HERE *** ger_pes_cat_ramo_relacao (ALWAYS, fixed constant)
const ger_pes_cat_ramo_relacao = {
  fk_cat_pessoa: 39, // FIXED -> 39 = "Agricultor Familiar"
  id_und_empresa: "H0349",
  // fk_pessoa -> Prisma nested create; dt_update_record -> repo-set
};

// 5) *** SAVE HERE *** sub_categoria_pessoa_relacao (ALWAYS, fixed constant)
const sub_categoria_pessoa_relacao = {
  fk_sub_cat_pessoa: 1, // FIXED -> 1 = "Típico(a)". Always this value.
  // fk_sub_cat_pessoa: 11, // OLD -> 11 = "Agroindústria". Always this value.
  id_und_empresa: "H0349",
  // fk_pessoa -> Prisma nested create; dt_update_record -> repo-set
};

// 6) *** SAVE HERE *** contato_pessoa (≤1, only if `telefone` provided)
const contato_pessoa = {
  telefone: "33999998888",
  principal: true, // FIXED -> always true (only phone)
  id_tipo_contato_pessoa: 3, // DERIVED -> 3 (celular) if mobility digit 7/8/9, else 1
  fk_operadora: null, // FIXED -> always null (not collected)
  id_und_empresa: "H0349",
  // id_pessoa -> Prisma nested create; no dt_update_record (uses data_atualizacao, nullable -> omit)
};

//----- DO NOT LOOKUP: FIXED ger_cat_pessoa (categoria dictionary)
const ger_cat_pessoa = [
  { id_cat_pessoa: 39, ds_cat_pessoa: "Agricultor Familiar" }, // <-- the fixed fk_cat_pessoa above
  // { id_cat_pessoa: 35, ds_cat_pessoa: "Clientes" }, // <-- OLD. Keep codes here as reference, but this is not the one we use (see notes)
  // { id_cat_pessoa: 38, ds_cat_pessoa: "Produtor Rural" }, // <-- OLD. Keep codes here as reference, but this is not the one we use (see notes)
  // { id_cat_pessoa: 64, ds_cat_pessoa: "Organização" }, // <-- OLD. Keep codes here as reference, but this is not the one we use (see notes)
];

//----- DO NOT LOOKUP: FIXED VALUE for sub_categoria_pessoa (subcategoria dictionary; FK -> ger_cat_pessoa)
const sub_categoria_pessoa = [
  { id: 1, descricao: "Típico(a)", cat_pessoa: 39 }, // <-- the fixed fk_sub_cat_pessoa above
  // { id: 8, descricao: "Associação de Produtores", cat_pessoa: 64 }, // <-- OLD. Keep codes here as reference, but this is not the one we use (see notes)
  // { id: 10, descricao: "Cooperativa", cat_pessoa: 64 }, // <-- OLD. Keep codes here as reference, but this is not the one we use (see notes)
  // { id: 11, descricao: "Agroindústria", cat_pessoa: 64 }, // <-- OLD. Keep codes here as reference, but this is not the one we use (see notes)
];

//----- return type for '/getMunicipiosEmater' endpoint. H% = municípios, G% = regionais (parents)
// Fetched by client before mutation, create-dto will have this. Gets data from ger_und_empresa
const municipiosEmater = [
  // type is MunicipioEmater[]
  {
    unidadeEmpresaId: "H0713",
    nomeMunicipio: "Viçosa",
    municipioId: 845,
    regionalId: "G0040",
    nomeRegional: "Regional de Viçosa",
  },
  {
    unidadeEmpresaId: "H0714",
    nomeMunicipio: "Vieiras",
    municipioId: 846,
    regionalId: "G0026",
    nomeRegional: "Regional de Muriaé",
  },
];

// This + sep_municipio table are the source of truth for the município and regional data
const ger_und_empresa = [
  {
    id_und_empresa: "H0713",
    fk_municipio: 845,
    nm_und_empresa: "Viçosa", // Get regional name. Only for "like 'G%'" id_und_empresa rows. nome_municipio is obtained from sep_municipio join.
    fk_und_empresa: "G0300",
  },
  // ...other rows not shown
];

//----- FK target of ger_end_pessoa.fk_municipio (comes from input.municipioId). Fetched by client before mutation, create-dto will have this.
const sep_municipio = [
  { id_municipio: 845, nm_municipio: "Viçosa", fk_estado: 1 /* MG */ }, // nome_municipio is obtained from this table
];

//----- DO NOT LOOKUP: sep_tpo_logradouro — fk_tpo_logradouro will be DERIVED from logradouro normalize function (rules in notes)
const sep_tpo_logradouro = [
  { id_tpo_logradouro: 1, ds_tpo_logradouro: "Rua" },
  { id_tpo_logradouro: 2, ds_tpo_logradouro: "Avenida" },
  { id_tpo_logradouro: 3, ds_tpo_logradouro: "Praça" },
  { id_tpo_logradouro: 4, ds_tpo_logradouro: "Rodovia" }, // BR-/MG- + digit map here
  { id_tpo_logradouro: 5, ds_tpo_logradouro: "Alameda" },
  { id_tpo_logradouro: 6, ds_tpo_logradouro: "Beco" },
  { id_tpo_logradouro: 7, ds_tpo_logradouro: "Travessa" },
  { id_tpo_logradouro: 8, ds_tpo_logradouro: "Sítio" },
];

//----- IGNORE: sep_distrito — near-empty in HMG (Jaíba, BH, Esmeraldas; ~10 rows) -> always null
const sep_distrito = [
  { id_distrito: 9, nm_distrito: "Venda Nova", fk_municipio: 66 },
];

//----- DONT LOOKUP: tipo_contato_pessoa — FK target of contato_pessoa.id_tipo_contato_pessoa, but we DERIVE this value from the input.telefone (rules in notes)
const tipo_contato_pessoa = [
  { id_tipo_contato_pessoa: 1, descricao: "Comercial" },
  { id_tipo_contato_pessoa: 2, descricao: "Residencial" },
  { id_tipo_contato_pessoa: 3, descricao: "Celular" },
  { id_tipo_contato_pessoa: 4, descricao: "Whatsapp" },
];

//----- IGNORE: operadora
const operadora = [{ id_operadora: 1, nome: "Vivo" }];
