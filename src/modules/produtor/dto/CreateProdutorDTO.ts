// Flat domain shape the client sends to `createProdutor`. The repo maps these to Prisma column
// names; the client never sees ger_*/contato_pessoa/sep_*/pl_* tables, fk_* columns, or nested
// layout. At most one endereco, one telefone and one propriedade per producer through this gateway.

export type EnderecoInput = {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
};

export type PropriedadeInput = {
  nome: string; // -> pl_propriedade.nome_propriedade
  areaTotal?: number | null; // -> pl_propriedade.area_total
  geoPontoTexto?: string | null; // -> pl_propriedade.geo_ponto_texto
  municipioId: number; // -> pl_propriedade.id_municipio (may differ from the produtor's)
  unidadeEmpresa: string; // -> id_und_empresa on both propriedade rows
};

export type CreateProdutorDTO = {
  nome: string;
  cpf: string;
  email?: string | null;
  dataNascimento?: Date | null; // DateTime scalar parses to Date
  tpSexo?: string | null;
  identidade?: string | null;
  unidadeEmpresa: string; // -> id_und_empresa on every inserted ger_*/contato row (from getMunicipiosEmater pick)
  municipioId: number; // -> ger_end_pessoa.fk_municipio (from getMunicipiosEmater pick)
  telefone?: string | null; // flat scalar; the repo derives the rest of the contato_pessoa row
  endereco?: EnderecoInput | null;
  propriedade?: PropriedadeInput | null;
};

export type CreateProdutorResult = {
  produtorId: bigint;
  propriedadeId: bigint | null; // null when no propriedade was sent
};
