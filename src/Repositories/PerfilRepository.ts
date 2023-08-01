import { Perfil, Prisma } from "@prisma/client";
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
    } catch (error: any) {
      console.log("🚀 ~ file: PerfilRepository.ts:13 ~ PerfilRepository ~ create ~ error:", error);
      this.throwError(error.message);
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

  async update(id: number, updatePerfilInput: Perfil) {
    console.log(
      "🚀 ~ file: PerfilRepository.ts:97 ~ PerfilRepository ~ update ~ updatePerfilInput:",
      updatePerfilInput
    );
    try {
      //const { id_dados_producao_agro_industria, ...rest } = updatePerfilInput;
      return await this.prisma.perfil.update({
        where: { id },
        data: updatePerfilInput,
      });
    } catch (error) {
      console.log("🚀 ~ file: PerfilRepository.ts:13 ~ PerfilRepository ~ create ~ error:", error);
    }
  }

  async delete(id: number) {
    try {
      const result = await this.prisma.perfil.delete({ where: { id } });
      console.log("🚀 ~ file: PerfilRepository.ts:117 ~ PerfilRepository ~ delete ~ result:", result);
      if (!result) {
        this.throwError("NOT_FOUND");
      }
      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError)
        console.log("🚀 ~ file: PerfilRepository.ts:114 ~ PerfilRepository ~ delete ~ error:", error);
      return error;
    }
  }
}
