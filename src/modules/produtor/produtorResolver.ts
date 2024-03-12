import { Produtor } from "@prisma/client";
import { prismaClient } from "../../config/prismaClient.js";
import { EnumPropsRepository } from "../../repositories/prisma/EnumPropsRepository.js";
import { PropriedadeRepository } from "../../repositories/prisma/PropriedadeRepository.js";
import { Repository } from "@repositories/Repository.js";
import { GraphQLResolveInfo } from "graphql";

const propriedadeRepository = new PropriedadeRepository(prismaClient);
const enumPropsRepository = new EnumPropsRepository(prismaClient);

export const produtorResolver = (produtorRepository: Repository<Produtor>) => ({
  Query: {
    produtor: (_root: any, { id, cpf }: { id: bigint; cpf: string }) => produtorRepository.findOne({ id, cpf }),
    produtores: (_parent: any, { ids }: { ids: string[] }, _context: any, info: GraphQLResolveInfo) =>
      produtorRepository.findMany!(ids, info),
    getUnidadeEmpresa: (_root: any, { produtorId }: { produtorId: bigint }) => {
      const produtor = produtorRepository.getUnidadeEmpresa!(produtorId) as unknown as Partial<Produtor>;
      return produtor;
    },
  },

  Produtor: {
    propriedades: (p: Produtor) => propriedadeRepository.findByProdutorId(p.id_pessoa_demeter),
    perfis: (p: any) => p.at_prf_see.map(async (perfil: any) => await enumPropsRepository.getPerfilProps(perfil)),
  },
});
