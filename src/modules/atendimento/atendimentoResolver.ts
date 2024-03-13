import { at_atendimento } from "@prisma/client";
import { CreateAtendimentoDTO, UpdateAtendimentoDTO } from "./CreateAtendimentoDTO.js";
import { Repository } from "../../repositories/Repository.js";

export const atendimentoResolver = (
  atendimentoRepository: Repository<at_atendimento> & {
    checkDataSEI: (ids: string[]) => Promise<any>;
  }
) => ({
  Query: {
    atendimento: (_root: any, { id }: { id: bigint }) =>
      atendimentoRepository.findOne(id),
    atendimentos: () => atendimentoRepository.findAll(),
  },

  Mutation: {
    createAtendimento: (_root: any, { input }: { input: CreateAtendimentoDTO }) => {
      return atendimentoRepository.create!(input);
    },

    updateAtendimento: async (_root: any, { input }: { input: UpdateAtendimentoDTO }) =>
      atendimentoRepository.update!(input),

    checkDataSEI: async (
      _root: any,
      { atendimentosIds }: { atendimentosIds: string[] }
    ) => {
      const atendimentosWithoutDataSEI = await atendimentoRepository.checkDataSEI(
        atendimentosIds
      );

      if (!atendimentosWithoutDataSEI) {
        return [];
      }

      return atendimentosWithoutDataSEI;
    },
  },
  // Atendimento: {
  //   at_cli_atend_prop: (p: any) => {
  //     console.log("🚀 - atendimentoResolver - p:", p.at_cli_atend_prop);
  //     return p.at_cli_atend_prop;
  //   },
  //   at_atendimento_usuario: (p: any) => p.at_atendimento_usuario,
  // },
});
