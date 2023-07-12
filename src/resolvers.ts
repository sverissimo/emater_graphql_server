import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const produtores = await prisma.produtor.findMany({
  include: {
    produtor_propriedades: true,
  },
});

const propriedades = await prisma.propriedade.findMany({
  include: {
    produtor_propriedade: {
      include: { produtor: true },
    },
  },
});

const produtoresFull = await prisma.produtorPropriedades.findMany({
  include: {
    produtor: true,
    propriedade: true,
  },
});

const perfilData = await prisma.perfil.findMany({
  include: {
    atividade: {
      include: {
        propriedade: {
          include: {
            produtor_propriedade: { include: { produtor: true } },
          },
        },
      },
    },

    dados_producao: true,
  },
  /* where: {
    atividade: { is: { propriedade: { is: { id_pl_propriedade: 53512 } } } },
  }, */
});

export const resolvers = {
  Query: {
    produtores: () => produtores,
    propriedades: () => propriedades,
    produtoresFull: () => produtoresFull,
    perfil: () => perfilData,
  },
  Atividade: {
    id_propriedade: (p: any) => parseInt(p.id_propriedade),
  },
  Perfil: {
    data_preenchimento: (p: any) =>
      p.data_preenchimento.toISOString().slice(0, "yyyy-mm-dd".length),
    data_atualizacao: (p: any) =>
      p.data_atualizacao.toISOString().slice(0, "yyyy-mm-dd".length),
  },
  Produtor: {
    id_pessoa_demeter: (p: any) => parseInt(p.id_pessoa_demeter),
    propriedades: (p: any) => {
      const propriedadeIds = produtoresFull
        .filter((t) => t.produtor_id === p.id_pessoa_demeter)
        .map((p) => p.propriedade_id);

      return prisma.propriedade.findMany({
        where: { id_pl_propriedade: { in: propriedadeIds } },
      });
    },
  },

  Propriedade: {
    id_pl_propriedade: (p: any) => parseInt(p.id_pl_propriedade),
  },
  ProdutorPropriedades: {
    produtor_id: (p: any) => parseInt(p.id_proprietario),
    propriedade_id: (p: any) => parseInt(p.id_propriedade),
  },
};
