import { Perfil } from "@prisma/client";

import { EnumPropsRepository } from "./EnumPropsRepository.js";
import { PrismaRepository } from "./PrismaRepository.js";
import { Repository } from "../Repository.js";

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
}
