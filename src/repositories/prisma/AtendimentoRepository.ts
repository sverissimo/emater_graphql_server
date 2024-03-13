import { PrismaRepository } from "./PrismaRepository.js";
import { CreateAtendimentoDTO } from "../../modules/atendimento/CreateAtendimentoDTO.js";
import { at_atendimento } from "@prisma/client";
import { Repository } from "../Repository.js";
import { getTodayDateWithTimeZone } from "../../shared/utils/formatDate.js";

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

      const { id_at_atendimento_indicador } = newAtendimento.at_atendimento_indicador[0];

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

    // console.log("🚀 - AtendimentoRepository - findOne - atendimento:", atendimento);
    return atendimento;
  }

  async update(input: at_atendimento) {
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

  async checkDataSEI(input: string[]) {
    try {
      const ids = input.map((id) => BigInt(id));

      await this.prisma.at_atendimento.updateMany({
        where: { id_at_atendimento: { in: ids } },
        data: { data_sei: getTodayDateWithTimeZone() },
      });

      return `Checked data SEI atendimentos ${input.join(", ")}.`;
    } catch (error: any) {
      this.throwError(error);
    }
  }

  async getReadOnlyRelatorioIds(relatorioIds: string[]) {
    try {
      const readOnlyURLs = (await this.prisma.$queryRaw`
            SELECT link_pdf FROM at_atendimento
            WHERE link_pdf IS NOT NULL
            AND data_validacao IS NOT NULL
            AND SPLIT_PART(link_pdf, '/', ARRAY_LENGTH(STRING_TO_ARRAY(link_pdf, '/'), 1)) = ANY(ARRAY[${relatorioIds}]);
          `) as any[];
      const readOnlyIds = readOnlyURLs.map((url) => url.link_pdf.match(/[^/]+$/)[0]);
      return readOnlyIds;
    } catch (error) {
      this.throwError(error);
    }
  }

  async getAtendimentosWithoutDataSEI() {
    try {
      const atendimentosWithoutDataSEI: Partial<at_atendimento>[] = await this.prisma
        .$queryRaw`
      SELECT id_at_atendimento, data_inicio_atendimento, ativo, id_und_empresa,  data_sei, link_pdf, sn_pendencia  from at_atendimento
      WHERE link_pdf IS NOT NULL
      AND data_validacao IS NOT NULL
      AND data_sei IS NULL
      AND ativo = true
      `;

      const atendimentos = atendimentosWithoutDataSEI.map((atendimento) => ({
        ...atendimento,
        id_at_atendimento: String(atendimento.id_at_atendimento),
      }));

      return atendimentos;
    } catch (error) {
      this.throwError(error);
    }
  }
}
