import { Repository } from "@repositories/Repository.js";
import { Usuario } from "@prisma/client";

export const usuarioResolver = (usuarioRepository: Repository<Usuario>) => ({
  Query: {
    usuarios: (_: any, { ids, matriculas }: { ids?: string; matriculas?: string }) =>
      usuarioRepository.findMany!({ id: ids, matricula_usuario: matriculas }),
  },
});
