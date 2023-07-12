import { PrismaClient, Produtor } from "@prisma/client";
import { ProdutorRepository } from "./Repositories/ProdutorRepository.js";
import { PropriedadeRepository } from "./Repositories/PropriedadeRepository.js";
import { PerfilRepository, findPerfilInput } from "./Repositories/PerfilRepository.js";

const prismaClient = new PrismaClient();

const produtorRepository = new ProdutorRepository(prismaClient);
const propriedadeRepository = new PropriedadeRepository(prismaClient);
const perfilRepository = new PerfilRepository(prismaClient);

export const resolvers = {
  Query: {
    produtor: (_root: any, { id }: { id: number }) => produtorRepository.findOne(id),
    produtores: () => produtorRepository.findAll(),
    propriedades: () => propriedadeRepository.findAll(),
    perfil: () => perfilRepository.findAll(),
    perfilPropriedade: (_root: any, { tipo_perfil, propriedade_id }: findPerfilInput) =>
      perfilRepository.findPerfilPropriedade({ tipo_perfil, propriedade_id }),
  },

  Atividade: {
    id_propriedade: (p: any) => parseInt(p.id_propriedade),
  },
  Perfil: {
    data_preenchimento: (p: any) => p.data_preenchimento.toISOString().slice(0, "yyyy-mm-dd".length),
    data_atualizacao: (p: any) => p.data_atualizacao.toISOString().slice(0, "yyyy-mm-dd".length),
  },
  Produtor: {
    id_pessoa_demeter: (p: any) => parseInt(p.id_pessoa_demeter),
    propriedades: (p: Produtor) => propriedadeRepository.findByProdutorId(p.id_pessoa_demeter),
  },
  Propriedade: {
    id_pl_propriedade: (p: any) => parseInt(p.id_pl_propriedade),
  },
  ProdutorPropriedades: {
    produtor_id: (p: any) => parseInt(p.id_proprietario),
    propriedade_id: (p: any) => parseInt(p.id_propriedade),
  },
};
