import { PrismaClient } from "@prisma/client";
import { AtendimentoRepository } from "./AtendimentoRepository.js";
import { CreateAtendimentoDTO } from "./CreateAtendimentoDTO.js";

const prismaClient = new PrismaClient({ log: ["info", "warn", "error"] });
const atendimentoRepository = new AtendimentoRepository(prismaClient);

export const atendimentoResolver = {
  Query: {
    atendimentos: () => atendimentoRepository.findAll(),
  },
  Mutation: {
    createAtendimento: (_root: any, { input }: { input: CreateAtendimentoDTO }) => {
      return atendimentoRepository.create(input);
    },
  },
};
