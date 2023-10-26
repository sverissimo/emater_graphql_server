import { Perfil } from "@prisma/client";
import { prismaClient } from "../../config/prismaClient.js";
import { CreatePerfilInput, PerfilRepository } from "./PerfilRepository.js";

const perfilRepository = new PerfilRepository(prismaClient);
export const perfilResolver = {
  Query: {
    perfil: () => perfilRepository.findAll(),
    dadosProducao: () => prismaClient.at_prf_see_dados_producao.findMany(),
    perfisPorProdutor: (_root: any, { produtorId }: { produtorId: string }, { service }: any) => {
      return perfilRepository.findByProdutor(produtorId);
    },
  },

  Mutation: {
    createPerfil: async (_root: any, { input: perfilInput }: { input: CreatePerfilInput }) => {
      return await perfilRepository.create(perfilInput);
    },
    updatePerfil: (_root: any, { id, updatePerfilInput }: { id: number; updatePerfilInput: Partial<Perfil> }) => {
      return perfilRepository.update(id, updatePerfilInput);
    },
    deletePerfil: (_root: any, { id }: { id: number }) => perfilRepository.delete(id),
  },
};
