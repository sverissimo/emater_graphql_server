import { UsuarioRepository } from "./UsuarioRepository.js";
import { prismaClient } from "../../config/prismaClient.js";

const usuarioRepository = new UsuarioRepository(prismaClient);
export const usuarioResolver = {
  Query: {
    usuarios: (_: any, { ids, matriculas }: { ids?: string; matriculas?: string }) =>
      usuarioRepository.find({ id: ids, matricula_usuario: matriculas }),
  },
};
