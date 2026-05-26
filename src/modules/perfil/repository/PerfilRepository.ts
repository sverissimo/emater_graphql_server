import { Perfil, Prisma } from "../../../generated/prisma/client.js";
import { PrismaRepository } from "../../../repositories/PrismaRepository.js";
import { EnumPropsRepository } from "../../../repositories/EnumPropsRepository.js";
import { Repository } from "../../../repositories/Repository.js";
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
    const {
      id_cliente,
      id_contrato,
      id_propriedade,
      id_tecnico,
      atividade,
      dados_producao_in_natura,
      dados_producao_agro_industria,
      ...perfil
    } = perfilInput;

    const {
      dadosProducao: dadosProducaoNatura,
      gruposProdutosData: gruposNatura,
    } = this.extractProducaoData(dados_producao_in_natura);
    const {
      dadosProducao: dadosProducaoAgroIndustria,
      gruposProdutosData: gruposAgro,
    } = this.extractProducaoData(dados_producao_agro_industria);

    try {
      const perfilData = {
        data: {
          ...perfil,

          ger_pessoa: {
            connect: { id_pessoa_demeter: BigInt(id_cliente) },
          },
          at_prf_config: {
            connect: { id_contrato },
          },
          usuario: {
            connect: { id_usuario: BigInt(id_tecnico) },
          },

          at_prf_see_propriedade: {
            create: {
              id_propriedade: id_propriedade,
              atividade,
            },
          },

          dados_producao_in_natura: dadosProducaoNatura
            ? {
                create: {
                  ...dadosProducaoNatura,
                  at_prf_see_grupos_produtos:
                    gruposNatura?.length > 0
                      ? { create: gruposNatura }
                      : undefined,
                },
              }
            : undefined,

          dados_producao_agro_industria: dadosProducaoAgroIndustria
            ? {
                create: {
                  ...dadosProducaoAgroIndustria,
                  at_prf_see_grupos_produtos:
                    gruposAgro?.length > 0 ? { create: gruposAgro } : undefined,
                },
              }
            : undefined,
        },
      };

      await this.prisma.perfil.create(perfilData);

      return true;
    } catch (error: any) {
      this.throwError(error);
    }
  }

  private extractProducaoData(dadosProducaoInput?: CreateDadosProducaoDTO) {
    if (!dadosProducaoInput) {
      return { gruposProdutosData: [], producaoData: null, hasData: false };
    }

    const { at_prf_see_grupos_produtos, ...dadosProducao } = dadosProducaoInput;
    const gruposProdutosData = (at_prf_see_grupos_produtos ?? []).map(
      ({ at_prf_see_produto, id_grupo, ...grupoProdutos }) => ({
        ...grupoProdutos,
        id_grupo_produtos: id_grupo,
        at_prf_see_produto: {
          create: at_prf_see_produto,
        },
      })
    );

    return {
      gruposProdutosData,
      dadosProducao:
        Object.keys(dadosProducao).length > 0
          ? (dadosProducao as CreateDadosProducaoDTO)
          : null,
    };
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
      take: 10,
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
}
