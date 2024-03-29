import { Perfil } from "@prisma/client";
import { prismaClient } from "../../config/prismaClient.js";
// import { CreatePerfilInput } from "../../repositories/prisma/PerfilRepository.js";
import { Repository } from "@repositories/Repository.js";
import { CreatePerfilInput } from "./dto/perfil.js";

export const perfilResolver = (perfilRepository: Repository<Perfil>) => ({
  Query: {
    perfil: () => perfilRepository.findAll(),
    dadosProducao: () => prismaClient.at_prf_see_dados_producao.findMany(),
    perfisPorProdutor: (_root: any, { produtorId }: { produtorId: bigint }, { service }: any) => {
      return perfilRepository.findByProdutorId!(produtorId);
    },
  },

  Mutation: {
    createPerfil: async (_root: any, { input }: { input: CreatePerfilInput }) => {
      await perfilRepository.create!(input);
      return true;
    },
    // updatePerfil: (_root: any, { id, updatePerfilInput }: { id: number; updatePerfilInput: Perfil }) => {
    //   return perfilRepository.update!(id, updatePerfilInput);
    // },
    deletePerfil: (_root: any, { id }: { id: number }) => perfilRepository.delete!(id),
  },
});
