import { Perfil, Prisma } from "@prisma/client";
import { PrismaRepository } from "./PrismaRepository.js";
import { EnumPropsRepository } from "./EnumPropsRepository.js";
import { Repository } from "../Repository.js";
import {
  CreatePerfilInput,
  CreateDadosProducaoDTO,
} from "@modules/perfil/dto/perfil.js";

export type findPerfilInput = {
  tipo_perfil: string;
  propriedade_id: number;
  id_cliente: number;
};

export class PerfilRepository
  extends PrismaRepository
  implements Repository<Perfil>
{
  async create(perfilInput: CreatePerfilInput) {
    try {
      await this.createTransaction(perfilInput);
      return true;
    } catch (error: any) {
      this.throwError(error);
    }
  }

  async findOne(id: number) {
    if (!id) {
      this.throwError("NO_ID_PROVIDED");
    }
    return await this.prisma.perfil.findUnique({ where: { id } });
  }

  async findByProdutorId(produtorId: bigint) {
    try {
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
    } catch (error) {
      this.throwError(error);
    }
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

    return parsedPerfis;
  }

  async update(updatePerfilInput: Partial<Perfil>) {
    try {
      const { id } = updatePerfilInput;

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

  private async createTransaction(perfil: CreatePerfilInput) {
    const {
      dados_producao_agro_industria,
      dados_producao_in_natura,
      atividade,
      id_propriedade,
      ...perfilProps
    } = perfil;

    await this.prisma.$transaction(
      async (tx) => {
        const id_dados_producao_in_natura = await this.createDadosProducao(
          tx,
          dados_producao_in_natura
        );
        const id_dados_producao_agro_industria = await this.createDadosProducao(
          tx,
          dados_producao_agro_industria
        );

        const perfilDTO = {
          ...perfilProps,
          id_dados_producao_in_natura,
          id_dados_producao_agro_industria,
        } as unknown as Perfil;

        await tx.perfil.create({
          data: {
            ...perfilDTO,
            at_prf_see_propriedade: {
              create: {
                id_propriedade: BigInt(id_propriedade),
                atividade,
              },
            },
          },
        });
      },
      {
        timeout: 7000,
        maxWait: 12000,
      }
    );
  }

  private async createDadosProducao(
    tx: Prisma.TransactionClient,
    dadosProducao: CreateDadosProducaoDTO
  ) {
    if (!dadosProducao) return null;

    const { at_prf_see_grupos_produtos, ...prodData } = dadosProducao;
    const createdData = await tx.at_prf_see_dados_producao.create({
      data: {
        ...prodData,
        at_prf_see_grupos_produtos: {
          create: at_prf_see_grupos_produtos.map(
            ({ at_prf_see_produto, id_grupo, ...grupoProdutos }) => ({
              ...grupoProdutos,
              id_grupo_produtos: id_grupo,
              at_prf_see_produto: {
                create: at_prf_see_produto,
              },
            })
          ),
        },
      },
    });

    return createdData?.id;
  }
}
