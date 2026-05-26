import { GraphQLResolveInfo } from "graphql";
import { AtendimentoRepository } from "@modules/atendimento/repository/AtendimentoRepository.js";
import { CreateAtendimentoDTO } from "./dto/CreateAtendimentoDTO.js";
import { UpdateAtendimentoDTO } from "./dto/UpdateAtendimentoDTO.js";

export const atendimentoResolver = (
  atendimentoRepository: AtendimentoRepository,
) => ({
  Query: {
    atendimento: (_root: any, { id }: { id: bigint }) => {
      return atendimentoRepository.findOne(id);
    },

    atendimentos: (
      _root: any,
      { ids }: { ids: bigint[] },
      _context: any,
      info: GraphQLResolveInfo,
    ) => {
      return atendimentoRepository.findMany(ids, info);
    },
  },

  Mutation: {
    createAtendimento: (
      _root: any,
      { input }: { input: CreateAtendimentoDTO },
    ) => {
      return atendimentoRepository.create(input);
    },

    updateAtendimento: async (
      _root: any,
      { input }: { input: UpdateAtendimentoDTO },
    ) => {
      return atendimentoRepository.update(input);
    },

    setAtendimentosExportDate: async (
      _root: any,
      { atendimentosIds }: { atendimentosIds: string[] },
    ) => {
      const atendimentosWithoutDataSEI =
        await atendimentoRepository.setAtendimentosExportDate(atendimentosIds);

      if (!atendimentosWithoutDataSEI) {
        return [];
      }

      return atendimentosWithoutDataSEI;
    },
  },
});
