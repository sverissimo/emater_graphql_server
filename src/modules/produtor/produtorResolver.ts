import { Produtor } from "@prisma/client";
// import { EnumPropsRepository, PropriedadeRepository } from "../Repositories";
import { prismaClient } from "../../config/prismaClient.js";
import { ProdutorRepository } from "./ProdutorRepository.js";
import { EnumPropsRepository } from "../../shared/repositories/EnumPropsRepository.js";
import { PropriedadeRepository } from "../propriedade/PropriedadeRepository.js";

const produtorRepository = new ProdutorRepository(prismaClient);
const propriedadeRepository = new PropriedadeRepository(prismaClient);
const enumPropsRepository = new EnumPropsRepository(prismaClient);

export const produtorResolver = {
  Query: {
    produtor: (_root: any, { id, cpf }: { id: bigint; cpf: string }) => produtorRepository.findOne({ id, cpf }),
    produtores: () => produtorRepository.findAll(),
  },

  Produtor: {
    propriedades: (p: Produtor) => propriedadeRepository.findByProdutorId(p.id_pessoa_demeter),
    perfis: (p: any) => p.at_prf_see.map(async (perfil: any) => await enumPropsRepository.getPerfilProps(perfil)),
  },
};
