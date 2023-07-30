import { Perfil, PrismaClient, Produtor } from "@prisma/client";
import { ProdutorRepository } from "./Repositories/ProdutorRepository.js";
import { PropriedadeRepository } from "./Repositories/PropriedadeRepository.js";
import { PerfilRepository, findPerfilInput } from "./Repositories/PerfilRepository.js";

const prismaClient = new PrismaClient();

const produtorRepository = new ProdutorRepository(prismaClient);
const propriedadeRepository = new PropriedadeRepository(prismaClient);
const perfilRepository = new PerfilRepository(prismaClient);

export const resolvers = {
  Query: {
    produtor: (_root: any, { id, cpf }: { id: number; cpf: string }) =>
      produtorRepository.findOne({ id, cpf }),
    produtores: () => produtorRepository.findAll(),
    propriedades: () => propriedadeRepository.findAll(),
    perfil: () => perfilRepository.findAll(),
    perfilPropriedade: (_root: any, { tipo_perfil, propriedade_id }: findPerfilInput) =>
      perfilRepository.findPerfilPropriedade({ tipo_perfil, propriedade_id }),
    dadosProducao: () => prismaClient.dadosProducao.findMany(),
    perfisPorProdutor: (_root: any, produtorId: number) => perfilRepository.findByProdutor(produtorId),
  },

  Mutation: {
    createPerfil: (_root: any, { input: perfilInput }: { input: Omit<Perfil, "id"> }) =>
      perfilRepository.create(perfilInput),
    updatePerfil: (_root: any, { input: perfilInput }: { input: Perfil }) =>
      perfilRepository.update(perfilInput),
  },

  Atividade: {
    id_propriedade: (p: any) => parseInt(p.id_propriedade),
  },
  DadosProducao: {
    id: (dp: any) => parseInt(dp.id),
  },

  Perfil: {
    data_preenchimento: (p: any) => p.data_preenchimento.toISOString().slice(0, "yyyy-mm-dd".length),
    data_atualizacao: (p: any) => p.data_atualizacao.toISOString().slice(0, "yyyy-mm-dd".length),
    id_cliente: (p: any) => parseInt(p.id_cliente),
  },
  Produtor: {
    id_pessoa_demeter: (p: any) => parseInt(p.id_pessoa_demeter),
    propriedades: (p: Produtor) => propriedadeRepository.findByProdutorId(p.id_pessoa_demeter),
    perfis: (p: Produtor) => perfilRepository.findByProdutor({ id_cliente: Number(p.id_pessoa_demeter) }),
  },
  Propriedade: {
    id_pl_propriedade: (p: any) => parseInt(p.id_pl_propriedade),
  },
  ProdutorPropriedades: {
    produtor_id: (p: any) => parseInt(p.id_proprietario),
    propriedade_id: (p: any) => parseInt(p.id_propriedade),
  },
};
