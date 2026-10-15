import type {
  AtendimentosCacheRows,
  AtendimentosCacheTable,
} from "../types/atendimentosCache.types.js";

// The session search_path lets later build statements use unqualified table names.
export const PREPARE_BUILD_SCHEMA = `
  DROP SCHEMA IF EXISTS atendimentos_build CASCADE;
  CREATE SCHEMA atendimentos_build;
  SET search_path = atendimentos_build;

  CREATE TABLE atendimento (
    id_at_atendimento bigint NOT NULL,
    data_inicio       date    NOT NULL,
    month             char(7) NOT NULL,
    id_und_empresa    char(5) NOT NULL,
    regional_id       char(5)
  );
  CREATE TABLE atendimento_programa (id_at_atendimento bigint NOT NULL, codigo_programa bigint NOT NULL);
  CREATE TABLE atendimento_tecnico  (id_at_atendimento bigint NOT NULL, id_usuario bigint NOT NULL);
  CREATE TABLE atendimento_produtor (id_at_atendimento bigint NOT NULL, id_pessoa_demeter bigint NOT NULL, id_pl_propriedade bigint);

  CREATE TABLE programa (codigo_programa bigint NOT NULL, nome text NOT NULL);
  CREATE TABLE unidade  (id_und_empresa char(5) NOT NULL, nome_municipio text, regional_id char(5), nome_regional text);
  CREATE TABLE tecnico  (id_usuario bigint NOT NULL, nome text, login text, id_und_empresa char(5));

  CREATE TABLE refresh_info (
    snapshot_at timestamptz NOT NULL,
    range_start date        NOT NULL,
    range_end   date        NOT NULL
  );`;

export const ADD_KEYS_AND_INDEXES = `
  ALTER TABLE atendimento ADD PRIMARY KEY (id_at_atendimento);
  ALTER TABLE atendimento_programa ADD PRIMARY KEY (id_at_atendimento, codigo_programa);
  ALTER TABLE atendimento_tecnico ADD PRIMARY KEY (id_at_atendimento, id_usuario);
  ALTER TABLE programa ADD PRIMARY KEY (codigo_programa);
  ALTER TABLE unidade ADD PRIMARY KEY (id_und_empresa);
  ALTER TABLE tecnico ADD PRIMARY KEY (id_usuario);
  CREATE INDEX ON atendimento (month);
  CREATE INDEX ON atendimento_produtor (id_at_atendimento);`;

export const INSERT_REFRESH_INFO =
  "INSERT INTO refresh_info (snapshot_at, range_start, range_end) VALUES ($1::timestamptz, $2::date, $3::date)";

export const ANALYZE_TABLES =
  "ANALYZE atendimento, atendimento_programa, atendimento_tecnico, atendimento_produtor, programa, unidade, tecnico, refresh_info";

export const SELECT_REFRESH_INFO = `
  SELECT to_char(snapshot_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "snapshotAt",
         to_char(range_start, 'YYYY-MM-DD') AS "rangeStart",
         to_char(range_end, 'YYYY-MM-DD') AS "rangeEnd",
         snapshot_at < CURRENT_TIMESTAMP - INTERVAL '36 hours' AS stale
  FROM refresh_info`;

// unnest array type per column; key order is the insert column order.
export const ARRAY_TYPES: {
  [T in AtendimentosCacheTable]: Record<keyof AtendimentosCacheRows[T], string>;
} = {
  atendimento: {
    id_at_atendimento: "bigint",
    data_inicio: "date",
    month: "text",
    id_und_empresa: "text",
    regional_id: "text",
  },
  atendimento_programa: { id_at_atendimento: "bigint", codigo_programa: "bigint" },
  atendimento_tecnico: { id_at_atendimento: "bigint", id_usuario: "bigint" },
  atendimento_produtor: {
    id_at_atendimento: "bigint",
    id_pessoa_demeter: "bigint",
    id_pl_propriedade: "bigint",
  },
  programa: { codigo_programa: "bigint", nome: "text" },
  unidade: {
    id_und_empresa: "text",
    nome_municipio: "text",
    regional_id: "text",
    nome_regional: "text",
  },
  tecnico: { id_usuario: "bigint", nome: "text", login: "text", id_und_empresa: "text" },
};
