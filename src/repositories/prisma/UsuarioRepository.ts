import { Usuario } from "@prisma/client";
import { PrismaRepository } from "./PrismaRepository.js";
import { Repository } from "../Repository.js";

export class UsuarioRepository
  extends PrismaRepository
  implements Repository<Usuario>
{
  async findOne(id: string) {
    return this.findMany({ id });
  }

  async findMany({
    id,
    matricula_usuario,
  }: {
    id?: string;
    matricula_usuario?: string;
  }) {
    try {
      const ids = id
        ? id
            .split(",")
            .filter((id) => !!id && id !== "null" && id !== "undefined")
            .map((id) => BigInt(id))
        : undefined;
      const matriculas = matricula_usuario
        ? matricula_usuario.split(",")
        : undefined;
      const query = [];
      if (ids) query.push({ id_usuario: { in: ids } });
      if (matriculas)
        query.push({
          matricula_usuario: { in: matriculas },
        });

      const usuarios = await this.prisma.usuario.findMany({
        where: { OR: query },
        include: {
          perfil_demeter: {
            include: {
              perfil: true,
            },
          },
          ger_und_empresa: {
            include: {
              ger_und_empresa: true,
            },
          },
        },
      });

      return usuarios;
    } catch (error: any) {
      this.throwError(error);
    }
  }

  async findAll() {}
}
