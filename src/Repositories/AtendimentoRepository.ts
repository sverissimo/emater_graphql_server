import { PrismaRepository } from './PrismaRepository.js';

export class AtendimentoRepository extends PrismaRepository {
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
