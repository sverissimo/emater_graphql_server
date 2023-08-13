import { Perfil } from "@prisma/client";
import { PrismaRepository } from "./PrismaRepository.js";
import { Repository } from "./Repository.js";

export type findPerfilInput = { tipo_perfil: string; propriedade_id: number; id_cliente: number };
export type CreatePerfilInput = Omit<Perfil, "id"> & {
  id_propriedade: bigint;
  atividade?: string;
  producao_dedicada_pnae?: boolean;
};
export class PerfilRepository extends PrismaRepository implements Repository<Perfil> {
  async create(perfilInput: CreatePerfilInput) {
    try {
      const { id_propriedade, producao_dedicada_pnae, atividade, ...perfilTableData } = perfilInput;

      return await this.prisma.perfil.create({
        data: {
          ...perfilTableData,
          at_prf_see_propriedade: {
            create: {
              id_propriedade,
              atividade,
              producao_dedicada_pnae,
            },
          },
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
        at_prf_see_propriedade: true,
        dados_producao_agro_industria: true,
        dados_producao_in_natura: true,
        usuario: true,
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
        dados_producao_agro_industria: true,
        dados_producao_in_natura: true,
        ger_pessoa: true,
      },
    });

    return perfilData;
  }

  async update(id: number, updatePerfilInput: Partial<Perfil>) {
    try {
      //const { id_dados_producao_agro_industria, ...rest } = updatePerfilInput;
      const updated = await this.prisma.perfil.update({
        where: { id },
        data: updatePerfilInput,
      });
      return updated;
    } catch (error) {
      this.handleRecordNotFound(error as Error);
    }
  }

  async delete(id: number) {
    try {
      const result = await this.prisma.perfil.delete({ where: { id } });
      return result;
    } catch (error) {
      this.handleRecordNotFound(error as Error);
    }
  }
}
