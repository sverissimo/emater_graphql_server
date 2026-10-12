import { Repository } from "@repositories/Repository.js";
import { Usuario } from "../../generated/prisma/client.js";
import type { UsuarioRepository } from "./repository/UsuarioRepository.js";

type UsuarioSearchRepository = Repository<Usuario> &
  Pick<UsuarioRepository, "findByName">;

export const usuarioResolver = (
  usuarioRepository: UsuarioSearchRepository,
) => ({
  Query: {
    usuarios: (_: any, { ids, matriculas }: { ids?: string; matriculas?: string }) =>
      usuarioRepository.findMany!({ id: ids, matricula_usuario: matriculas }),
    usuariosByName: (_: any, { nome }: { nome: string }) =>
      usuarioRepository.findByName(nome),
  },
});
