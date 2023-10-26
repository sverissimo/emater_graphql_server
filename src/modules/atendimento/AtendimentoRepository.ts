import { PrismaRepository } from "../../shared/repositories/PrismaRepository.js";
import { CreateAtendimentoDTO } from "./CreateAtendimentoDTO.js";

export class AtendimentoRepository extends PrismaRepository {
  async create(createAtendimentoDTO: CreateAtendimentoDTO) {
    try {
      console.log("🚀 ~ file: AtendimentoRepository.ts:7 ~ createAtendimentoDTO:", createAtendimentoDTO);
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
    } catch (error) {
      console.log("🚀 ~ file: AtendimentoRepository.ts:38 ~ error:", error);
      throw error;
    }
  }

  async findAll() {
    console.log("Fetching 10 atendimentos...");
    return await this.prisma.at_atendimento.findMany({
      take: 10,
      orderBy: { id_at_atendimento: "desc" },
    });
  }

  async getReadOnlyRelatorioIds(relatorioIds: string[]) {
    const readOnlyURLs = (await this.prisma.$queryRaw`
          SELECT link_pdf FROM at_atendimento
          WHERE link_pdf IS NOT NULL
          AND data_validacao IS NOT NULL
          AND SPLIT_PART(link_pdf, '/', ARRAY_LENGTH(STRING_TO_ARRAY(link_pdf, '/'), 1)) = ANY(ARRAY[${relatorioIds}]);
        `) as any[];
    const readOnlyIds = readOnlyURLs.map((url) => url.link_pdf.match(/[^/]+$/)[0]);
    return readOnlyIds;
  }
}
