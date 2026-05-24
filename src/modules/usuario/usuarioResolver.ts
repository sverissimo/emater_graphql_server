import { Repository } from "@repositories/Repository.js";
import { Usuario } from "../../generated/prisma/client.js";

export const usuarioResolver = (usuarioRepository: Repository<Usuario>) => ({
  Query: {
    usuarios: (_: any, { ids, matriculas }: { ids?: string; matriculas?: string }) =>
      usuarioRepository.findMany!({ id: ids, matricula_usuario: matriculas }),
  },
});
