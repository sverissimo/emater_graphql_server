import { Prisma, Usuario } from "../../../generated/prisma/client.js";
import { PrismaRepository } from "../../../repositories/PrismaRepository.js";
import { Repository } from "../../../repositories/Repository.js";

const USUARIOS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const usuarioInclude = {
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
} satisfies Prisma.UsuarioInclude;

type UsuarioWithRelations = Prisma.UsuarioGetPayload<{
  include: typeof usuarioInclude;
}>;

type UsuarioSnapshot = UsuarioWithRelations & {
  nomeRegional: string | null;
};

export class UsuarioRepository
  extends PrismaRepository
  implements Repository<Usuario>
{
  // Snapshot objects are shared across hits; callers must treat returned rows as read-only.
  private cachedUsuarios: UsuarioSnapshot[] | null = null;
  private usuariosExpiresAt = 0;
  private usuariosInFlight: Promise<UsuarioSnapshot[]> | null = null;

  async findOne(id: string) {
    try {
      const ids = this.parseIds(id);

      return await this.prisma.usuario.findMany({
        where: {
          OR: ids ? [{ id_usuario: { in: ids } }] : [],
        },
        include: usuarioInclude,
      });
    } catch (error: any) {
      this.throwError(error);
    }
  }

  async findMany({
    id,
    matricula_usuario,
  }: {
    id?: string;
    matricula_usuario?: string;
  }) {
    try {
      const ids = this.parseIds(id);
      const matriculas = matricula_usuario
        ? matricula_usuario.split(",")
        : undefined;

      if (!ids && !matriculas) return [];

      const usuarios = await this.getUsuariosSnapshot();

      return usuarios.filter(
        (usuario) =>
          (ids?.includes(usuario.id_usuario) ?? false) ||
          (matriculas?.some(
            (matricula) =>
              matricula.trimEnd() ===
              usuario.matricula_usuario?.trimEnd(),
          ) ??
            false),
      );
    } catch (error: any) {
      this.throwError(error);
    }
  }

  async findByName(nome: string) {
    const normalizedName = nome.trim();

    if (normalizedName.length < 3) {
      this.throwError({
        message: "Nome deve conter pelo menos 3 caracteres.",
        code: "BAD_REQUEST",
      });
    }

    try {
      const normalizedSearch = normalizedName.toLocaleLowerCase("pt-BR");
      const usuarios = await this.getUsuariosSnapshot();

      return usuarios
        .filter((usuario) =>
          usuario.nome_usuario
            ?.toLocaleLowerCase("pt-BR")
            .includes(normalizedSearch),
        )
        .sort((a, b) => {
          const byName = a.nome_usuario!.localeCompare(
            b.nome_usuario!,
            "pt-BR",
          );
          if (byName !== 0) return byName;

          return a.id_usuario < b.id_usuario
            ? -1
            : a.id_usuario > b.id_usuario
              ? 1
              : 0;
        })
        .slice(0, 50);
    } catch (error: any) {
      this.throwError(error);
    }
  }

  async findForLogin({
    matricula_usuario,
  }: {
    matricula_usuario: string;
  }) {
    try {
      return await this.prisma.usuario.findMany({
        where: {
          matricula_usuario: {
            in: matricula_usuario.split(","),
          },
        },
        include: usuarioInclude,
      });
    } catch (error: any) {
      this.throwError(error);
    }
  }

  private parseIds(id?: string) {
    return id
      ? id
          .split(",")
          .filter(
            (id) =>
              !!id && id !== "null" && id !== "undefined",
          )
          .map((id) => BigInt(id))
      : undefined;
  }

  private async getUsuariosSnapshot(): Promise<UsuarioSnapshot[]> {
    if (this.cachedUsuarios && this.usuariosExpiresAt > Date.now()) {
      return this.cachedUsuarios;
    }

    if (this.usuariosInFlight) {
      return this.usuariosInFlight;
    }

    this.usuariosInFlight = this.fetchUsuariosSnapshot()
      .then((usuarios) => {
        this.cachedUsuarios = usuarios;
        this.usuariosExpiresAt = Date.now() + USUARIOS_CACHE_TTL_MS;
        return usuarios;
      })
      .finally(() => {
        this.usuariosInFlight = null;
      });

    return this.usuariosInFlight;
  }

  private async fetchUsuariosSnapshot(): Promise<UsuarioSnapshot[]> {
    const usuarios = await this.prisma.usuario.findMany({
      include: usuarioInclude,
    });

    return usuarios.map((usuario) => {
      const unidade = usuario.ger_und_empresa;
      const nomeRegional = unidade?.id_und_empresa.startsWith("G")
        ? unidade.nm_und_empresa
        : unidade?.id_und_empresa.startsWith("H")
          ? unidade.ger_und_empresa?.nm_und_empresa
          : null;

      return {
        ...usuario,
        nomeRegional: nomeRegional ?? null,
      };
    });
  }

  async findAll() {}
}
