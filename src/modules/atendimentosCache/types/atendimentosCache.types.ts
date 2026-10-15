// YYYY-MM-DD calendar dates in America/Sao_Paulo; end is inclusive (yesterday), endExclusive is today.
export type AtendimentosDateRange = {
  start: string;
  end: string;
  endExclusive: string;
};

export type AtendimentoSourceRow = {
  id_at_atendimento: string;
  data_inicio: string;
  month: string;
  id_und_empresa: string;
};

// One row shape per cache table; keys are the cache column names and IDs stay strings end to end.
export type AtendimentosCacheRows = {
  atendimento: AtendimentoSourceRow & { regional_id: string | null };
  atendimento_programa: { id_at_atendimento: string; codigo_programa: string };
  atendimento_tecnico: { id_at_atendimento: string; id_usuario: string };
  atendimento_produtor: {
    id_at_atendimento: string;
    id_pessoa_demeter: string;
    id_pl_propriedade: string | null;
  };
  programa: { codigo_programa: string; nome: string };
  unidade: {
    id_und_empresa: string;
    nome_municipio: string | null;
    regional_id: string;
    nome_regional: string;
  };
  tecnico: {
    id_usuario: string;
    nome: string | null;
    login: string | null;
    id_und_empresa: string | null;
  };
};

export type AtendimentosCacheTable = keyof AtendimentosCacheRows;

// Demeter extraction batches: atendimento rows get regional_id afterwards; unidade comes from the lookup.
export type AtendimentosSourceRows = Omit<
  AtendimentosCacheRows,
  "atendimento" | "unidade"
> & { atendimento: AtendimentoSourceRow };

export type AtendimentosSourceTable = keyof AtendimentosSourceRows;
