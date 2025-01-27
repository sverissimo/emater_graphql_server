import { Repository } from "@repositories/Repository.js";
import { Propriedade } from "@prisma/client";

export interface PropriedadeFindManyParams {
  cpfs?: string[];
  produtoresIds?: string[];
  propriedadesIds?: string[];
  regionalId?: string;
}

export const propriedadeResolver = (
  propriedadeRepository: Repository<Propriedade>
) => ({
  Query: {
    propriedades: async (
      _parent: any,
      filter: { filter: PropriedadeFindManyParams }
    ) => {
      const { cpfs, produtoresIds, propriedadesIds, regionalId } =
        filter.filter;

      return propriedadeRepository.findMany!({
        cpfs,
        produtoresIds,
        propriedadesIds,
        regionalId,
      });
    },
  },
});
