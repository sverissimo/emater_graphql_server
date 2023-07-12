import { Perfil } from "@prisma/client";
import { PrismaRepository } from "./PrismaRepository.js";
import { Repository } from "./Repository.js";

export type findPerfilInput = { tipo_perfil: string; propriedade_id: number };

export class PerfilRepository extends PrismaRepository implements Repository {
  async findOne(id: string) {
    if (!id) {
      this.throwError("NO_ID_PROVIDED");
    }

    return await this.prisma.perfil.findUnique({ where: { id } });
  }

  async findPerfilPropriedade(params: findPerfilInput) {
    const { tipo_perfil, propriedade_id: propriedadeId } = params;

    const perfilData = await this.prisma.perfil.findFirst({
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
      where: {
        atividade: {
          is: { propriedade: { is: { id_pl_propriedade: propriedadeId } } },
        },
        tipo_perfil,
      },
    });
    return perfilData;
  }

  async findAll(): Promise<Perfil[]> {
    const perfilData = await this.prisma.perfil.findMany({
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
    });
    return perfilData;
  }
}
