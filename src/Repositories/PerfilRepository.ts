import { Perfil } from "@prisma/client";
import { PrismaRepository } from "./PrismaRepository.js";
import { Repository } from "./Repository.js";

export type findPerfilInput = { tipo_perfil: string; propriedade_id: number; id_cliente: number };

export class PerfilRepository extends PrismaRepository implements Repository<Perfil> {
  async create(perfilInput: Omit<Perfil, "id">) {
    try {
      const { id_cliente, id_dados_producao_agro_industria, ...rest } = perfilInput;

      return await this.prisma.perfil.create({
        data: {
          ...rest,
          produtor: {
            connect: { id_pessoa_demeter: id_cliente },
          },
          dados_producao: id_dados_producao_agro_industria
            ? {
                connect: { id: id_dados_producao_agro_industria },
              }
            : undefined,
        },
      });
    } catch (error) {
      console.log("🚀 ~ file: PerfilRepository.ts:13 ~ PerfilRepository ~ create ~ error:", error);
    }
  }

  async findOne(id: number) {
    if (!id) {
      this.throwError("NO_ID_PROVIDED");
    }
    return await this.prisma.perfil.findUnique({ where: { id } });
  }

  async findByProdutor(produtorId: number) {
    const perfilData = await this.prisma.perfil.findMany({
      include: {
        atividade: true,
        dados_producao: true,
      },
      where: {
        id_cliente: produtorId,
      },
    });
    return perfilData;
  }

  async findPerfilPropriedade(params: Partial<findPerfilInput>) {
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

  async update(updatePerfilInput: Perfil) {
    try {
      const { id, id_cliente, id_dados_producao_agro_industria, ...rest } = updatePerfilInput;
      return await this.prisma.perfil.update({
        where: { id },
        data: {
          ...rest,
        },
      });
    } catch (error) {
      console.log("🚀 ~ file: PerfilRepository.ts:13 ~ PerfilRepository ~ create ~ error:", error);
    }
  }

  async delete(id: number) {
    try {
      const result = await this.prisma.perfil.delete({ where: { id } });
      return result;
    } catch (error) {
      console.log("🚀 ~ file: PerfilRepository.ts:114 ~ PerfilRepository ~ delete ~ error:", error);
    }
  }
}
