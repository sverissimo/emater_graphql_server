import { PrismaClient } from "@prisma/client";
import { AtendimentoRepository } from "../Repositories/AtendimentoRepository.js";

const prismaClient = new PrismaClient({ log: ["info", "warn", "error"] });
const atendimentoRepository = new AtendimentoRepository(prismaClient);

export const atendimentoResolver = {
  Query: {
    atendimentos: () => atendimentoRepository.findAll(),
  },
};
