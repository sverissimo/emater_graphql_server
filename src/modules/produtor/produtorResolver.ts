import type { Produtor } from "../../generated/prisma/client.js";
import { prismaClient } from "../../config/prismaClient.js";
import { PropriedadeRepository } from "../propriedade/repository/PropriedadeRepository.js";
import { Repository } from "@repositories/Repository.js";
import type { GraphQLResolveInfo } from "graphql";
import { getRequestedFields } from "../../shared/utils/getRequestedFields.js";
import { logger } from "../../shared/utils/logger.js";
import type {
  CreateProdutorDTO,
  CreateProdutorResult,
} from "./dto/CreateProdutorDTO.js";
import { validateAndNormalize } from "./produtorValidation.js";

const propriedadeRepository = new PropriedadeRepository(prismaClient);

type ProdutorContext = {
  service?: string;
};

type ProdutorCreateRepository = Repository<Produtor> & {
  create?: (
    input: CreateProdutorDTO,
    meta?: { service?: string },
  ) => Promise<CreateProdutorResult | null>;
};

export const produtorResolver = (
  produtorRepository: ProdutorCreateRepository,
) => ({
  Query: {
    produtor: (_root: any, { id, cpf }: { id: bigint; cpf: string }) =>
      produtorRepository.findOne({ id, cpf }),
    produtores: (
      _parent: any,
      { ids }: { ids: string[] },
      _context: any,
      info: GraphQLResolveInfo,
    ) => {
      const requestedFields = getRequestedFields(info);

      if (requestedFields?.includes("perfis")) {
        return produtorRepository.findMany!(ids, info);
      }

      return produtorRepository.findManyMinimal!(ids);
    },

    getUnidadeEmpresa: (_root: any, { produtorId }: { produtorId: bigint }) => {
      const produtor = produtorRepository.getUnidadeEmpresa!(
        produtorId,
      ) as unknown as Partial<Produtor>;
      return produtor;
    },
  },

  Mutation: {
    createProdutor: async (
      _root: unknown,
      { input }: { input: CreateProdutorDTO },
      context: ProdutorContext,
    ): Promise<CreateProdutorResult | null> => {
      const service = context.service ?? "unknown";
      logger.info(
        `createProdutor: attempt service=${service} unidadeEmpresa=${input.unidadeEmpresa} endereco=${Boolean(input.endereco)} telefone=${input.telefone != null} propriedade=${Boolean(input.propriedade)}`,
      );

      let normalized: CreateProdutorDTO;
      try {
        normalized = validateAndNormalize(input);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "invalid input";
        logger.error(
          `createProdutor: validation_failure service=${service} unidadeEmpresa=${input.unidadeEmpresa} message=${message}`,
        );
        return null;
      }

      try {
        const result = await produtorRepository.create!(normalized, {
          service: context.service,
        });

        if (result != null) {
          logger.info(
            `createProdutor: success service=${service} unidadeEmpresa=${input.unidadeEmpresa} id_pessoa_demeter=${result.produtorId} id_pl_propriedade=${result.propriedadeId ?? "none"}`,
          );
        }

        return result;
      } catch (e) {
        console.log({ e });
        logger.error(
          `createProdutor:service=${service} unidadeEmpresa=${input.unidadeEmpresa}`,
        );
        return null;
      }
    },
  },

  Produtor: {
    propriedades: (p: Produtor) =>
      propriedadeRepository.findByProdutorId(p.id_pessoa_demeter),
    perfis: (p: any) => p.at_prf_see,
  },
});
