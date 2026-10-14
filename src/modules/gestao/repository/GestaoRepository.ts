import { Prisma } from "../../../generated/prisma/client.js";
import { PrismaRepository } from "../../../repositories/PrismaRepository.js";

type ProgramaResumo = {
  codigoPrograma: string;
  programa: string;
  atendimentosTotalCount: number;
  minDate: string | null;
  maxDate: string | null;
};

type AtendimentoPrograma = {
  id: string;
  descricao: string | null;
  data_inicio_atendimento: string;
  id_und_empresa: string;
  orientacao_tecnica: string | null;
  login_usuario: string | null;
  fk_und_empresa: string | null;
};

type ProgramaComAtendimentos = ProgramaResumo & {
  atendimentos: AtendimentoPrograma[];
};

export class GestaoRepository extends PrismaRepository {
  getContagemPorPrograma(excluirCodigos: bigint[]): Promise<ProgramaResumo[]> {
    return this.getResumo(this.buildCodigoFilter(excluirCodigos, true));
  }

  async getAtendimentosPorPrograma(
    codigos: bigint[],
  ): Promise<ProgramaComAtendimentos[]> {
    const filter = this.buildCodigoFilter(codigos, false);
    const grupos = await this.prisma.$queryRaw<
      Pick<ProgramaResumo, "codigoPrograma" | "programa">[]
    >(Prisma.sql`
      SELECT g.id_at_grupo_indicador::text AS "codigoPrograma",
             g.descricao AS "programa"
      FROM at_grupo_indicador g
      WHERE g.ativo = true ${filter}
    `);
    const rows = await this.prisma.$queryRaw<
      (AtendimentoPrograma & { codigoPrograma: string })[]
    >(Prisma.sql`
      SELECT gi.id_at_grupo_indicador::text AS "codigoPrograma",
             a.id_at_atendimento::text AS id,
             a.descricao,
             to_char(a.data_inicio_atendimento, 'DD-MM-YYYY') AS data_inicio_atendimento,
             a.id_und_empresa,
             a.orientacao_tecnica,
             a.login_usuario,
             a.fk_und_empresa
      FROM (${this.buildGiSubquery(filter)}) gi
      JOIN at_atendimento a ON a.id_at_atendimento = gi.id_at_atendimento
      WHERE a.ativo = true
      ORDER BY gi.id_at_grupo_indicador, a.data_inicio_atendimento DESC, a.id_at_atendimento DESC;
    `);

    const byCodigo = new Map<string, AtendimentoPrograma[]>();
    for (const { codigoPrograma, ...atendimento } of rows) {
      const atendimentos = byCodigo.get(codigoPrograma) ?? [];
      atendimentos.push(atendimento);
      byCodigo.set(codigoPrograma, atendimentos);
    }

    // Derived from the rows to avoid a second scan of at_atendimento_indicador; rows are newest
    // first, so the first and last rows give the date span.
    return grupos
      .map(({ codigoPrograma, programa }) => {
        const atendimentos = byCodigo.get(codigoPrograma) ?? [];
        return {
          codigoPrograma,
          programa,
          atendimentosTotalCount: atendimentos.length,
          minDate: atendimentos.at(-1)?.data_inicio_atendimento ?? null,
          maxDate: atendimentos[0]?.data_inicio_atendimento ?? null,
          atendimentos,
        };
      })
      .sort((a, b) => b.atendimentosTotalCount - a.atendimentosTotalCount);
  }

  private buildCodigoFilter(codigos: bigint[], excluir: boolean): Prisma.Sql {
    if (codigos.length === 0) {
      return Prisma.empty;
    }

    return excluir
      ? Prisma.sql`AND g.id_at_grupo_indicador NOT IN (${Prisma.join(codigos)})`
      : Prisma.sql`AND g.id_at_grupo_indicador IN (${Prisma.join(codigos)})`;
  }

  private buildGiSubquery(filter: Prisma.Sql): Prisma.Sql {
    return Prisma.sql`
      SELECT DISTINCT i.id_at_grupo_indicador, ai.id_at_atendimento
      FROM at_atendimento_indicador ai
      JOIN at_indicador i ON i.id_at_indicador = ai.id_at_indicador
      JOIN at_grupo_indicador g ON g.id_at_grupo_indicador = i.id_at_grupo_indicador
      WHERE g.ativo = true ${filter}
    `;
  }

  private getResumo(filter: Prisma.Sql): Promise<ProgramaResumo[]> {
    return this.prisma.$queryRaw<ProgramaResumo[]>(Prisma.sql`
      SELECT g.id_at_grupo_indicador::text AS "codigoPrograma",
             g.descricao AS "programa",
             COUNT(a.id_at_atendimento)::int AS "atendimentosTotalCount",
             to_char(MIN(a.data_inicio_atendimento), 'DD-MM-YYYY') AS "minDate",
             to_char(MAX(a.data_inicio_atendimento), 'DD-MM-YYYY') AS "maxDate"
      FROM at_grupo_indicador g
      LEFT JOIN (${this.buildGiSubquery(filter)}) gi ON gi.id_at_grupo_indicador = g.id_at_grupo_indicador
      LEFT JOIN at_atendimento a
        ON a.id_at_atendimento = gi.id_at_atendimento AND a.ativo = true
      WHERE g.ativo = true ${filter}
      GROUP BY g.id_at_grupo_indicador, g.descricao
      ORDER BY "atendimentosTotalCount" DESC;
    `);
  }
}
