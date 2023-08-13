import { Perfil, PrismaClient, Produtor, Propriedade } from "@prisma/client";
import { ProdutorRepository } from "./Repositories/ProdutorRepository.js";
import { PropriedadeRepository } from "./Repositories/PropriedadeRepository.js";
import { CreatePerfilInput, PerfilRepository } from "./Repositories/PerfilRepository.js";

const prismaClient = new PrismaClient({ log: ["info", "warn", "error"] });
const produtorRepository = new ProdutorRepository(prismaClient);
const propriedadeRepository = new PropriedadeRepository(prismaClient);
const perfilRepository = new PerfilRepository(prismaClient);

export const resolvers = {
  Query: {
    produtor: (_root: any, { id, cpf }: { id: bigint; cpf: string }) => produtorRepository.findOne({ id, cpf }),
    produtores: () => produtorRepository.findAll(),
    propriedades: () => propriedadeRepository.findAll(),
    perfil: () => perfilRepository.findAll(),
    dadosProducao: () => prismaClient.at_prf_see_dados_producao.findMany(),
    perfisPorProdutor: (_root: any, { produtorId }: { produtorId: number }, { service }: any) => {
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

  Produtor: {
    propriedades: (p: Produtor) => propriedadeRepository.findByProdutorId(p.id_pessoa_demeter),
    perfis: (p: any) => p.at_prf_see,
  },
};
