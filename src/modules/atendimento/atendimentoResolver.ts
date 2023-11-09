import { at_atendimento } from "@prisma/client";
import { CreateAtendimentoDTO } from "./CreateAtendimentoDTO.js";
import { Repository } from "../../repositories/Repository.js";

export const atendimentoResolver = (atendimentoRepository: Repository<at_atendimento>) => ({
  Query: {
    atendimentos: () => atendimentoRepository.findAll(),
  },

  Mutation: {
    createAtendimento: (_root: any, { input }: { input: CreateAtendimentoDTO }) => {
      return atendimentoRepository.create!(input);
    },
  },
});
