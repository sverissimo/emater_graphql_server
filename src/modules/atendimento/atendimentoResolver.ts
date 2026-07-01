import { GraphQLResolveInfo } from "graphql";
import { AtendimentoRepository } from "@modules/atendimento/repository/AtendimentoRepository.js";
import { CreateAtendimentoDTO } from "./dto/CreateAtendimentoDTO.js";
import { UpdateAtendimentoDTO } from "./dto/UpdateAtendimentoDTO.js";
import {
  ATENDIMENTO_KEYSET_START_CURSOR,
  ATENDIMENTO_PAGE_SIZE_DEFAULT,
  ATENDIMENTO_PAGE_SIZE_MAX,
} from "./atendimentoConstants.js";

export const atendimentoResolver = (
  atendimentoRepository: AtendimentoRepository,
) => ({
  Atendimento: {
    sn_validacao: (atendimento: { sn_validado?: number | null }) =>
      atendimento.sn_validado,
  },

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

    atendimentosComRelatorioManual: (
      _root: any,
      {
        pageSize,
        cursor,
        id_usuario,
        id_reg_empresa,
      }: {
        pageSize?: number | null;
        cursor?: bigint | null;
        id_usuario?: bigint | null;
        id_reg_empresa?: string | null;
      },
    ) => {
      const size = Math.min(
        ATENDIMENTO_PAGE_SIZE_MAX,
        Math.max(1, pageSize ?? ATENDIMENTO_PAGE_SIZE_DEFAULT),
      );
      const startCursor = cursor ?? ATENDIMENTO_KEYSET_START_CURSOR;
      return atendimentoRepository.findComRelatorioManual(size, startCursor, {
        id_usuario,
        id_reg_empresa,
      });
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
