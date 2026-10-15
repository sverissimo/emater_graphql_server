import type { AtendimentosSourceTable } from "../types/atendimentosCache.types.js";

export const SELECT_SNAPSHOT_AT = `SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS snapshot_at`;

const DATE_RANGE = `a.ativo = true
  AND a.data_inicio_atendimento >= $1::date
  AND a.data_inicio_atendimento <  $2::date`;

export const EXTRACTIONS: {
  [T in AtendimentosSourceTable]: { sql: string; byDateRange: boolean };
} = {
  atendimento: {
    byDateRange: true,
    sql: `
      SELECT a.id_at_atendimento::text,
             to_char(a.data_inicio_atendimento, 'YYYY-MM-DD') AS data_inicio,
             to_char(a.data_inicio_atendimento, 'YYYY-MM')    AS month,
             a.id_und_empresa
      FROM at_atendimento a
      WHERE ${DATE_RANGE}`,
  },
  atendimento_programa: {
    byDateRange: true,
    sql: `
      SELECT DISTINCT a.id_at_atendimento::text,
                      i.id_at_grupo_indicador::text AS codigo_programa
      FROM at_atendimento a
      JOIN at_atendimento_indicador ai ON ai.id_at_atendimento = a.id_at_atendimento
      JOIN at_indicador i              ON i.id_at_indicador = ai.id_at_indicador
      JOIN at_grupo_indicador g        ON g.id_at_grupo_indicador = i.id_at_grupo_indicador AND g.ativo = true
      WHERE ${DATE_RANGE}`,
  },
  atendimento_tecnico: {
    byDateRange: true,
    sql: `
      SELECT a.id_at_atendimento::text, au.id_usuario::text
      FROM at_atendimento a
      JOIN at_atendimento_usuario au ON au.id_at_atendimento = a.id_at_atendimento
      WHERE ${DATE_RANGE}`,
  },
  atendimento_produtor: {
    byDateRange: true,
    sql: `
      SELECT a.id_at_atendimento::text, cap.id_pessoa_demeter::text, cap.id_pl_propriedade::text
      FROM at_atendimento a
      JOIN at_cli_atend_prop cap ON cap.id_at_atendimento = a.id_at_atendimento
      WHERE ${DATE_RANGE}`,
  },
  programa: {
    byDateRange: false,
    sql: `
      SELECT id_at_grupo_indicador::text AS codigo_programa, descricao AS nome
      FROM at_grupo_indicador
      WHERE ativo = true`,
  },
  tecnico: {
    byDateRange: false,
    sql: `
      SELECT id_usuario::text, nome_usuario AS nome, login_usuario AS login, id_und_empresa
      FROM usuario`,
  },
};
