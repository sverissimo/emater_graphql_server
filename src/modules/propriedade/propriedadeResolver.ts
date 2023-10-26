import { prismaClient } from "../../config/prismaClient.js";
import { PropriedadeRepository } from "./PropriedadeRepository.js";

const propriedadeRepository = new PropriedadeRepository(prismaClient);

export const propriedadeResolver = {
  Query: {
    propriedades: () => propriedadeRepository.findAll(),
  },
};
