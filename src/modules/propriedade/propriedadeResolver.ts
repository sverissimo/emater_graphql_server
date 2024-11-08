import { Repository } from "@repositories/Repository.js";
import { pl_propriedade_ger_pessoa, Produtor, Propriedade } from "@prisma/client";

export interface PropriedadeFindManyParams {
  cpfs?: string[];
  produtoresIds?: string[];
  propriedadesIds?: string[];
}

export const propriedadeResolver = (propriedadeRepository: Repository<Propriedade>) => ({
  Query: {
    propriedades: async (_parent: any, filter: { filter: PropriedadeFindManyParams }) => {
      const { cpfs, produtoresIds, propriedadesIds } = filter.filter;

      return propriedadeRepository.findMany!({
        cpfs,
        produtoresIds,
        propriedadesIds,
      });
    },
  },
});
