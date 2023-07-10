import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const proprietarios = prisma.proprietario.findMany();
const propriedades = prisma.propriedade.findMany();

export const resolvers = {
  Query: {
    propriedades: () => propriedades,
    proprietarios: () => proprietarios,
  },
};

/* import propriedades from "../data/public_pl_propriedade_export_2023-07-06_231354.json" assert { type: "json" };
import proprietarios from "../data/ger_pessoa.json" assert { type: "json" };
 */
