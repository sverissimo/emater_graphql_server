import { Usuario } from '@prisma/client';

import { PrismaRepository } from './PrismaRepository.js';
import { Repository } from './Repository.js';

export class UsuarioRepository extends PrismaRepository implements Repository<Usuario> {
  async findOne(id: string) {
    return this.find({ id });
  }

  async find({ id, matricula_usuario }: { id?: string; matricula_usuario?: string }) {
    try {
      const ids = id ? id.split(",").map((id) => BigInt(id)) : undefined;
      const matriculas = matricula_usuario ? matricula_usuario.split(",") : undefined;
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
        },
      });

      console.log("🚀 ~ file: UsuarioRepository.ts:34 ~ UsuarioRepository ~ find ~ usuarios:", usuarios);
      return usuarios;
    } catch (error) {
      console.log("🚀 ~ file: UsuarioRepository.ts:27 ~ UsuarioRepository ~ find ~ error:", error);
    }
  }

  async findAll() {}
}
