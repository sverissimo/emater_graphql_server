import { PrismaClient, Relatorio } from "@prisma/client";
import { RelatorioRepository } from "./RelatorioRepository.js";

const prismaClient = new PrismaClient();
const relatorioRepository = new RelatorioRepository(prismaClient);

export const relatorioResolver = {
  Query: {
    relatorio: (_root: any, { id, produtorId }: { id: number; produtorId: number }) =>
      relatorioRepository.findOne({ id, produtorId }),
    relatorios: () => relatorioRepository.findAll(),
  },
  Mutation: {
    createRelatorio: async (
      _root: any,
      { createRelatorioInput }: { createRelatorioInput: Omit<Relatorio, "id"> }
    ) => {
      return await relatorioRepository.create(createRelatorioInput);
    },
    updateRelatorio: async (_root: any, { input }: { input: Partial<Omit<Relatorio, "id">> & { id: number } }) => {
      const { id, ...update } = input;
      return await relatorioRepository.update(id, update);
    },

    deleteRelatorio: async (_root: any, { id }: { id: number }) => {
      return await relatorioRepository.delete(id);
    },
  },

  Relatorio: {
    createdAt: (p: any) => p.createdAt.toISOString().slice(0, "yyyy-mm-dd".length),
    produtorId: (p: any) => parseInt(p.produtorId),
  },
};
