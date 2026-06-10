// Flat domain shape the client sends to `createProdutor`. The repo maps these to Prisma column
// names; the client never sees ger_*/contato_pessoa/sep_* tables, fk_* columns, or nested layout.
// At most one endereco and one telefone per producer through this gateway.

export type EnderecoInput = {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
};

export type CreateProdutorDTO = {
  nome: string;
  cpf: string;
  email?: string | null;
  dataNascimento?: Date | null; // DateTime scalar parses to Date
  tpSexo?: string | null;
  identidade?: string | null;
  unidadeEmpresa: string; // -> id_und_empresa on every inserted row (from getMunicipiosEmater pick)
  municipioId: number; // -> ger_end_pessoa.fk_municipio (from getMunicipiosEmater pick)
  telefone?: string | null; // flat scalar; the repo derives the rest of the contato_pessoa row
  endereco?: EnderecoInput | null;
};
