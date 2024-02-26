import { PrismaRepository } from "./PrismaRepository.js";
import { CreateAtendimentoDTO } from "../../modules/atendimento/CreateAtendimentoDTO.js";
import { at_atendimento } from "@prisma/client";
import { Repository } from "../Repository.js";

export class AtendimentoRepository extends PrismaRepository implements Repository<at_atendimento> {
  async create(createAtendimentoDTO: CreateAtendimentoDTO) {
    try {
      const { at_cli_atend_prop, atendimento_indicador, atendimento_usuario, ...atendimento } =
        createAtendimentoDTO;

      const newAtendimento = await this.prisma.at_atendimento.create({
        data: {
          ...atendimento,
          at_cli_atend_prop: { create: { ...at_cli_atend_prop } },
          at_atendimento_indicador: { create: { ...atendimento_indicador } },
          at_atendimento_usuario: { create: { ...atendimento_usuario } },
        },
      });

      const id_at_atendimento = newAtendimento.id_at_atendimento;
      return id_at_atendimento;
    } catch (error: any) {
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
    return await this.prisma.at_atendimento.findUnique({
      where: { id_at_atendimento: id },
    });
  }

  async update(input: at_atendimento) {
    console.log("🚀 - update - input:", input);

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
}
