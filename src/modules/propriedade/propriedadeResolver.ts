import { Repository } from "@repositories/Repository.js";
import { Propriedade } from "@prisma/client";

export const propriedadeResolver = (propriedadeRepository: Repository<Propriedade>) => ({
  Query: {
    propriedades: () => propriedadeRepository.findAll(),
  },
});
