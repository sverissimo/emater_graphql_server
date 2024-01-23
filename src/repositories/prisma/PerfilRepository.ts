import { Perfil, Prisma } from "@prisma/client";
import { PrismaRepository } from "./PrismaRepository.js";
import { EnumPropsRepository } from "./EnumPropsRepository.js";
import { Repository } from "../Repository.js";
import { CreatePerfilInput, CreateDadosProducaoDTO } from "@modules/perfil/dto/perfil.js";

export type findPerfilInput = { tipo_perfil: string; propriedade_id: number; id_cliente: number };

export class PerfilRepository extends PrismaRepository implements Repository<Perfil> {
  async create(perfilInput: CreatePerfilInput) {
    try {
      await this.createTransaction(perfilInput);

      return true;
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

  private async createTransaction(perfil: CreatePerfilInput) {
    const { dados_producao_agro_industria, dados_producao_in_natura, atividade, id_propriedade, ...perfilProps } =
      perfil;

    await this.prisma.$transaction(async (tx) => {
      const id_dados_producao_in_natura = await this.createDadosProducao(tx, dados_producao_in_natura);
      const id_dados_producao_agro_industria = await this.createDadosProducao(tx, dados_producao_agro_industria);

      const perfilDTO = {
        ...perfilProps,
        id_dados_producao_in_natura,
        id_dados_producao_agro_industria,
      } as unknown as Perfil;

      const createdPerfil = await tx.perfil.create({
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
      console.log("🚀 - PerfilRepository - awaitthis.prisma.$transaction - createdPerfil:", createdPerfil);
    });
  }

  private async createDadosProducao(tx: Prisma.TransactionClient, dadosProducao: CreateDadosProducaoDTO) {
    if (!dadosProducao) return null;

    const { at_prf_see_grupos_produtos, ...prodData } = dadosProducao;
    const createdData = await tx.at_prf_see_dados_producao.create({
      data: {
        ...prodData,
        at_prf_see_grupos_produtos: {
          create: at_prf_see_grupos_produtos.map(({ at_prf_see_produto, id_grupo, ...grupoProdutos }) => ({
            ...grupoProdutos,
            id_grupo_produtos: id_grupo,
            at_prf_see_produto: {
              create: at_prf_see_produto,
            },
          })),
        },
      },
    });

    return createdData?.id;
  }
}

/**
 *

Conversion of type '{ id_dados_producao_in_natura: bigint | null; id_dados_producao_agro_industria: bigint | null; tipo_perfil: string; atividades_usam_recursos_hidricos: string; atividades_com_regularizacao_ambiental: string; ... 16 more ...; id_cliente: string; }' to type 'GetResult<{ id: bigint; data_preenchimento: Date; data_atualizacao: Date; tipo_perfil: string; id_cliente: bigint; participa_organizacao: boolean | null; nivel_tecnologico_cultivo: bigint | null; ... 24 more ...; id_dados_producao_agro_industria: bigint | null; }, unknown> & {}' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Type '{ id_dados_producao_in_natura: bigint | null; id_dados_producao_agro_industria: bigint | null; tipo_perfil: string; atividades_usam_recursos_hidricos: string; atividades_com_regularizacao_ambiental: string; ... 16 more ...; id_cliente: string; }' is missing the following properties from type 'GetResult<{ id: bigint; data_preenchimento: Date; data_atualizacao: Date; tipo_perfil: string; id_cliente: bigint; participa_organizacao: boolean | null; nivel_tecnologico_cultivo: bigint | null; ... 24 more ...; id_dados_producao_agro_industria: bigint | null; }, unknown>': id, data_preenchimento, data_atualizacao, participa_organizacao, and 6 more.

 */
