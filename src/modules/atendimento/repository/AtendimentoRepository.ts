import { GraphQLError, GraphQLResolveInfo } from "graphql";
import { PrismaRepository } from "../../../repositories/PrismaRepository.js";
import { CreateAtendimentoDTO } from "../dto/CreateAtendimentoDTO.js";
import { at_atendimento, Prisma } from "../../../generated/prisma/client.js";
import { Repository } from "../../../repositories/Repository.js";
import { ReplacedAtendimentoDTO } from "@modules/atendimento/dto/ReplacedAtendimentoDTO.js";
import { getTodayBrTimezone } from "../../../shared/utils/formatDate.js";
import {
  ATENDIMENTO_PAGE_SIZE_MAX,
  RELATORIO_MANUAL_INDICADOR_ID,
} from "../atendimentoConstants.js";
import {
  AtendimentoListScope,
  AtendimentoPage,
} from "../types/atendimentoList.types.js";
import { toAtendimentoListItem } from "../atendimentoListMapper.js";

export class AtendimentoRepository
  extends PrismaRepository
  implements Repository<at_atendimento>
{
  async create(createAtendimentoDTO: CreateAtendimentoDTO) {
    try {
      const {
        at_cli_atend_prop,
        at_atendimento_indicador,
        at_atendimento_usuario,
        at_atendimento_indi_camp_acess,
        ...atendimento
      } = createAtendimentoDTO;

      const newAtendimento = await this.prisma.at_atendimento.create({
        data: {
          ...atendimento,
          at_cli_atend_prop: { create: { ...at_cli_atend_prop } },
          at_atendimento_indicador: {
            create: {
              ...at_atendimento_indicador,
            },
          },
          at_atendimento_usuario: { create: { ...at_atendimento_usuario } },
        },
        select: {
          id_at_atendimento: true,
          at_atendimento_indicador: {
            select: {
              id_at_atendimento_indicador: true,
            },
          },
        },
      });

      const { id_at_atendimento_indicador } =
        newAtendimento.at_atendimento_indicador[0];

      await this.prisma.at_atendimento_indi_camp_acess.createMany({
        data: at_atendimento_indi_camp_acess.map((obj, i) => ({
          ...obj,
          id_at_atendimento_indicador,
        })),
      });

      return newAtendimento.id_at_atendimento;
    } catch (error: any) {
      console.log("🚀 - create - error:", error);
      this.throwError(error);
    }
  }

  async findAll() {
    console.log("Fetching 10 atendimentos...");
    return await this.prisma.at_atendimento.findMany({
      take: 10,
      orderBy: { id_at_atendimento: "desc" },
    });
  }

  async findOne(id: bigint) {
    if (!id) {
      this.throwError("NO_ID_PROVIDED");
    }
    const atendimento = await this.prisma.at_atendimento.findUnique({
      where: { id_at_atendimento: id },
      include: {
        at_atendimento_usuario: true,
        at_cli_atend_prop: true,
      },
    });
    return atendimento;
  }

  async findMany(ids: bigint[], info: GraphQLResolveInfo) {
    if (!ids || ids.length === 0) {
      return [];
    }

    const usuarioRequested = this.isFieldRequested(
      "at_atendimento_usuario",
      info,
    );
    const includeUsuario = usuarioRequested
      ? {
          at_atendimento_usuario: {
            include: {
              usuario: {
                select: { nome_usuario: true },
              },
            },
          },
        }
      : { at_atendimento_usuario: false };

    const atendimentos = await this.prisma.at_atendimento.findMany({
      where: { id_at_atendimento: { in: ids } },
      include: includeUsuario,
    });

    return atendimentos;
  }

  /**
   * Keyset page of "relatório manual" atendimentos (link_pdf IS NULL + indicador 4550), newest
   * first. Two steps: a raw `$queryRaw` keyset over ids (filter is index-backed), then a Prisma
   * hydrate-by-ids that stitches the children. See the plan's "The filter" / §1–§3.
   */
  async findComRelatorioManual(
    pageSize: number,
    cursor: bigint,
    scope: AtendimentoListScope = {},
  ): Promise<AtendimentoPage> {
    const limit = Math.min(
      ATENDIMENTO_PAGE_SIZE_MAX,
      Math.max(1, Math.trunc(pageSize)),
    );
    const scopeUsuarioId = scope.id_usuario ?? null;
    const scopeReg = scope.id_reg_empresa?.trim() || null;

    // Step 1 — raw keyset page of ids. Cursor is always present (sentinel covers page 1). The scope
    // predicate is composed from the trusted PNAE args (unscoped / owner-only / regional / both).
    const scopeClause = this.buildScopeClause(scopeUsuarioId, scopeReg);
    const idRows = await this.prisma.$queryRaw<{ id_at_atendimento: bigint }[]>(
      Prisma.sql`
        SELECT atend.id_at_atendimento
        FROM at_atendimento atend
        WHERE atend.link_pdf IS NULL
          AND EXISTS (
                SELECT 1 FROM at_atendimento_indicador ai
                WHERE ai.id_at_atendimento = atend.id_at_atendimento
                  AND ai.id_at_indicador = ${RELATORIO_MANUAL_INDICADOR_ID}
              )
          AND atend.id_at_atendimento < ${cursor}
          ${scopeClause}
        ORDER BY atend.id_at_atendimento DESC
        LIMIT ${limit + 1}
      `,
    );

    const hasMore = idRows.length > limit;
    const pageIds = (hasMore ? idRows.slice(0, limit) : idRows).map(
      (r) => r.id_at_atendimento,
    );

    if (pageIds.length === 0) {
      return { items: [], pageSize: limit, nextCursor: null, hasMore: false };
    }

    // Step 2 — hydrate the page ids; Prisma stitches the children.
    const rows = await this.prisma.at_atendimento.findMany({
      where: { id_at_atendimento: { in: pageIds } },
      select: {
        id_at_atendimento: true,
        data_inicio_atendimento: true,
        data_fim_atendimento: true,
        data_validacao: true,
        data_atualizacao: true,
        data_criacao: true,
        data_sei: true,
        data_see: true,
        sn_pendencia: true,
        sn_validado: true,
        dt_update_record: true,
        id_at_anterior: true,
        id_und_empresa: true,
        ativo: true,
        at_cli_atend_prop: {
          orderBy: { id_at_cli_atend_prop: "asc" },
          select: {
            ger_pessoa: {
              select: {
                nm_pessoa: true,
                nr_cpf_cnpj: true,
                dap: true,
                caf: true,
              },
            },
            pl_propriedade: {
              select: { nome_propriedade: true, geo_ponto_texto: true },
            },
          },
        },
        at_atendimento_usuario: {
          orderBy: { id_usuario: "asc" },
          select: {
            usuario: {
              select: {
                id_usuario: true,
                nome_usuario: true,
                id_und_empresa: true,
              },
            },
          },
        },
      },
    });

    // Re-apply Step-1 order (keyset DESC); `in` does not preserve it.
    const byId = new Map(rows.map((r) => [r.id_at_atendimento, r]));
    const items = pageIds.map((id) => toAtendimentoListItem(byId.get(id)!));

    return {
      items,
      pageSize: limit,
      nextCursor: hasMore ? pageIds[pageIds.length - 1] : null,
      hasMore,
    };
  }

  /**
   * Trusted-scope predicate for the manual-relatório keyset. No args → unscoped (admin/dev).
   * `id_usuario` → owner-only `EXISTS`. Regional → a correlated `EXISTS` on the `ger_und_empresa`
   * self-relation (the atendimento's local unit whose parent `fk_und_empresa` is the requested `G…`,
   * or the regional row itself). Both → the two OR'd (coordenador sees regional work plus their own).
   *
   * The regional branch is a correlated `EXISTS` **on purpose**: it keeps the keyset backward index
   * scan. Pre-resolving the units into an `id_und_empresa IN (…)` list makes the planner abandon the
   * keyset for a full seq-scan + sort (8s vs ~0.5–3s) while `at_atendimento(id_und_empresa)` stays
   * unindexed. See the plan's §1b — switch to the `IN`-list form only once that index exists.
   */
  private buildScopeClause(
    scopeUsuarioId: bigint | null,
    scopeReg: string | null,
  ): Prisma.Sql {
    const branches: Prisma.Sql[] = [];

    if (scopeUsuarioId !== null) {
      branches.push(Prisma.sql`
        EXISTS (
          SELECT 1 FROM at_atendimento_usuario au_scope
          WHERE au_scope.id_at_atendimento = atend.id_at_atendimento
            AND au_scope.id_usuario = ${scopeUsuarioId}
        )`);
    }

    if (scopeReg !== null) {
      branches.push(Prisma.sql`
        EXISTS (
          SELECT 1 FROM ger_und_empresa und_scope
          WHERE und_scope.id_und_empresa = atend.id_und_empresa
            AND (
              und_scope.id_und_empresa = ${scopeReg}
              OR und_scope.fk_und_empresa = ${scopeReg}
            )
        )`);
    }

    if (branches.length === 0) {
      return Prisma.empty;
    }

    return Prisma.sql`AND (${Prisma.join(branches, " OR ")})`;
  }

  async update(
    input: Partial<at_atendimento> & {
      data_inicio_atendimento: Date | undefined;
    },
  ) {
    try {
      await this.prisma.at_atendimento.update({
        where: { id_at_atendimento: input.id_at_atendimento },
        data: input,
      });
      return `Logically deleted atendimento ${input.id_at_atendimento}.`;
    } catch (error: any) {
      this.throwError(error);
    }
  }

  async updateTemasAndNumeroVisita(atendimentoUpdate: {
    idAtendimento: bigint;
    temasAtendimento?: string;
    numeroVisita?: string;
  }) {
    const { idAtendimento, temasAtendimento, numeroVisita } = atendimentoUpdate;

    if (!!temasAtendimento) {
      await this.prisma.$queryRaw`
          UPDATE at_atendimento_indi_camp_acess a
          SET valor_campo_acessorio = ${temasAtendimento}
          WHERE a.id_at_indicador_camp_acessorio = 14033
            AND EXISTS (
              SELECT 1 FROM at_atendimento_indicador atind
              WHERE atind.id_at_atendimento_indicador = a.id_at_atendimento_indicador
                AND atind.id_at_atendimento = ${idAtendimento}
            )
        `;
    }

    if (!!numeroVisita) {
      await this.prisma.$queryRaw`
          UPDATE at_atendimento_indi_camp_acess a
          SET valor_campo_acessorio = ${numeroVisita}
          WHERE a.id_at_indicador_camp_acessorio = 14032
            AND EXISTS (
              SELECT 1 FROM at_atendimento_indicador atind
              WHERE atind.id_at_atendimento_indicador = a.id_at_atendimento_indicador
                AND atind.id_at_atendimento = ${idAtendimento}
            )
        `;
    }
  }

  async setAtendimentosExportDate(input: string[]) {
    try {
      const ids = input.map((id) => BigInt(id));
      const todayDate = getTodayBrTimezone();

      await this.prisma.at_atendimento.updateMany({
        where: { id_at_atendimento: { in: ids } },
        data: { dt_export_ok: todayDate },
        // data: { dt_export_ok: null },
      });

      return `Registered data dt_export atendimentos ${input.join(", ")}.`;
    } catch (error: any) {
      this.throwError(error);
    }
  }

  async setValidacaoStatus(idAtendimento: bigint, aprovado: boolean) {
    try {
      const data = aprovado
        ? {
            sn_validado: 1,
            sn_pendencia: 0,
            data_validacao: getTodayBrTimezone(),
          }
        : { sn_validado: 0, sn_pendencia: 1, data_validacao: null };

      await this.prisma.at_atendimento.update({
        where: { id_at_atendimento: idAtendimento },
        data,
      });
    } catch (error: any) {
      this.handleRecordNotFound(error);
    }
  }

  async setDataSeiStatus(idAtendimento: bigint, aprovado: boolean) {
    if (!aprovado) {
      try {
        await this.prisma.at_atendimento.update({
          where: { id_at_atendimento: idAtendimento },
          data: { data_sei: null },
        });
      } catch (error: any) {
        this.handleRecordNotFound(error);
      }
      return;
    }

    // Approve only if the coordenador already validated. Conditional updateMany is
    // atomic (no read-then-write race) and returns count 0 — instead of throwing —
    // when the id is missing OR data_validacao is null, so we map both to 400.
    const { count } = await this.prisma.at_atendimento.updateMany({
      where: { id_at_atendimento: idAtendimento, data_validacao: { not: null } },
      data: { data_sei: getTodayBrTimezone() },
    });

    if (count === 0) {
      throw new GraphQLError(
        "Atendimento inexistente ou ainda não validado pelo coordenador regional.",
        { extensions: { code: "BAD_REQUEST" } },
      );
    }
  }

  async getReadOnlyRelatorioIds(relatorioIds: string[]) {
    try {
      const readOnlyURLs = (await this.prisma.$queryRaw`
            SELECT link_pdf FROM at_atendimento
            WHERE link_pdf IS NOT NULL
            AND data_validacao IS NOT NULL
            AND ativo = TRUE
            AND (sn_pendencia = 0 OR data_sei IS NOT NULL OR data_see IS NOT NULL)
            AND SPLIT_PART(link_pdf, '/', ARRAY_LENGTH(STRING_TO_ARRAY(link_pdf, '/'), 1)) = ANY(ARRAY[${relatorioIds}]);
          `) as { link_pdf: string }[];

      const readOnlyIds = readOnlyURLs
        .map((url) => url.link_pdf.match(/[^/]+$/)?.[0] ?? null)
        .filter((id): id is string => id !== null);
      return readOnlyIds;
    } catch (error) {
      this.throwError(error);
    }
  }

  async getReplacedAtendimentos() {
    const query = (await this.prisma.$queryRaw`
      SELECT at.id_at_atendimento, at.id_at_anterior
        FROM at_atendimento at
        WHERE at.link_pdf is not null
        AND at.id_at_anterior is not null
        ORDER BY at.id_at_atendimento ASC
    `) as ReplacedAtendimentoDTO[];

    return query.map((item) => ({
      atendimentoId: String(item.id_at_atendimento),
      atendimentoAnteriorId: String(item.id_at_anterior),
    }));
  }
}
