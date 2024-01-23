import { Perfil } from "@prisma/client";

import { EnumPropsRepository } from "./EnumPropsRepository.js";
import { PrismaRepository } from "./PrismaRepository.js";
import { Repository } from "../Repository.js";
import { CreatePerfilInput, CreateGrupoProdutosInput } from "@modules/perfil/dto/perfil.js";

export type findPerfilInput = { tipo_perfil: string; propriedade_id: number; id_cliente: number };

export class PerfilRepository extends PrismaRepository implements Repository<Perfil> {
  async create(perfilInput: CreatePerfilInput) {
    try {
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

  async findByProdutorId(produtorId: bigint) {
    const perfilData = await this.prisma.perfil.findMany({
      include: {
        at_prf_see_propriedade: true,
        dados_producao_agro_industria: true,
        dados_producao_in_natura: true,
        usuario: true,
      },
      where: {
        id_cliente: BigInt(produtorId),
      },
    });

    return perfilData;
  }

  async findAll(): Promise<any[]> {
    const perfilData = await this.prisma.perfil.findMany({
      include: {
        at_prf_see_propriedade: true,
        usuario: true,
        dados_producao_in_natura: {
          include: {
            at_prf_see_grupos_produtos: {
              include: {
                at_prf_grupo_produto: true,
                at_prf_see_produto: {
                  include: {
                    at_prf_produto: true,
                  },
                },
              },
            },
          },
        },
        dados_producao_agro_industria: {
          include: {
            at_prf_see_grupos_produtos: {
              include: {
                at_prf_grupo_produto: true,
                at_prf_see_produto: {
                  include: {
                    at_prf_produto: true,
                  },
                },
              },
            },
          },
        },

        ger_pessoa: true,
      },
    });

    const parsedPerfis = perfilData.map(async (perfil) =>
      new EnumPropsRepository(this.prisma).getPerfilProps(perfil)
    );
    /* console.log(
      "🚀 ~ file: PerfilRepository.ts:81 ~ PerfilRepository ~ findAll ~ parsedPerfis:",
      perfilData[0].dados_producao_in_natura?.at_prf_see_grupos_produtos
    ); */
    return parsedPerfis;
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

  async getProdutos(perfil: Perfil) {
    const { id_dados_producao_in_natura, id_dados_producao_agro_industria } = perfil;
    const ids = [];
    if (id_dados_producao_agro_industria) {
      ids.push({ id_dados_producao: id_dados_producao_agro_industria });
    }
    if (id_dados_producao_in_natura) {
      ids.push({ id_dados_producao: id_dados_producao_in_natura });
    }
    let gruposProdutos;
    if (ids.length) {
      gruposProdutos = await this.prisma.at_prf_see_grupos_produtos.findMany({
        where: {
          OR: ids,
        },
      });
    }
    /* const produtos = await this.prisma.at_prf_see_produto.findMany({
  where: {

  }
}) */
    gruposProdutos;
  }

  private async createTransaction(perfil: CreatePerfilInput) {
    const { dados_producao_agro_industria, dados_producao_in_natura, atividade } = perfil;
    const gruposProdutosNatura = [] as CreateGrupoProdutosInput[];
    const gruposProdutosIndustrial = [] as CreateGrupoProdutosInput[];
    if (dados_producao_in_natura) {
      const SQLQuery = this.createInsertStatement("at_prf_see_dados_producao", dados_producao_in_natura);
      console.log("🚀 - PerfilRepository - createTransaction - SQLQuery:", SQLQuery);
      return SQLQuery;
      // gruposProdutosNatura.push(...dados_producao_agro_industria.at_prf_see_grupos_produtos);
    }
    if (dados_producao_agro_industria) {
      // await this.prisma.at_prf_see_dados_producao.create({});
      // const updated = dados_producao_agro_industria.at_prf_see_grupos_produtos.map((grupo) => ({}));
      // gruposProdutosIndustrial.push(...dados_producao_in_natura.at_prf_see_grupos_produtos);
    }
  }

  private async createInsertStatement(tableName: string, object: Record<string, any>) {
    const columns = Object.keys(object)
      .map((col) => `"${col}"`)
      .join(", ");
    const placeholders = Object.keys(object)
      .map((_, index) => `$${index + 1}`)
      .join(", ");
    const params = Object.values(object);

    return {
      query: `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders}) RETURNING id;`,
      params,
    };
  }

  private createInsertManyStatement(tableName: string, objects: Record<string, any>[]) {
    if (objects.length === 0) return { query: "", params: [] };

    const columns = Object.keys(objects[0])
      .map((col) => `"${col}"`)
      .join(", ");
    const placeholders = objects
      .map(
        (_, index) =>
          "(" +
          Object.keys(objects[0])
            .map((_, colIndex) => `$${index * Object.keys(objects[0]).length + colIndex + 1}`)
            .join(", ") +
          ")"
      )
      .join(", ");
    const params = objects.flatMap((obj) => Object.values(obj));

    return {
      query: `INSERT INTO "${tableName}" (${columns}) VALUES ${placeholders} RETURNING id;`,
      params,
    };
  }
}
