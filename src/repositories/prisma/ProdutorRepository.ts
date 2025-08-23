import { Produtor } from "@prisma/client";
import { PrismaRepository } from "./PrismaRepository.js";
import { Repository } from "../Repository.js";
import { EnumPropsRepository } from "./EnumPropsRepository.js";

export class ProdutorRepository extends PrismaRepository implements Repository<Produtor> {
  async findOne({ id, cpf }: { id: bigint; cpf: string }) {
    try {
      if (!id && !cpf) {
        throw "NO_ID_PROVIDED";
      }

      const produtor = await this.prisma.produtor.findFirst({
        where: { OR: [{ id_pessoa_demeter: id }, { nr_cpf_cnpj: cpf }] },
        include: {
          at_prf_see: {
            where: { ativo: true },
            include: {
              at_prf_see_propriedade: {
                include: {
                  pl_propriedade: {
                    include: {
                      municipio: true,
                    },
                  },
                },
              },
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
            },
          },
        },
      });

      if (!produtor) {
        throw "NOT_FOUND";
      }
      const enumPropsRepository = new EnumPropsRepository(this.prisma);
      const perfis = (await Promise.all(
        produtor.at_prf_see.map((perfil: any) =>
          enumPropsRepository.getPerfilProps(perfil)
        )
      )) as any[];

      produtor.at_prf_see = perfis;

      return produtor;
    } catch (error: unknown) {
      this.throwError(error);
    }
  }

  async findAll() {
    const produtores = await this.prisma.produtor.findMany({
      include: {
        pl_propriedade_ger_pessoa: true,
      },
    });
    return produtores;
  }

  async findManyMinimal(ids: string[]): Promise<Produtor[]> {
    const produtoresIds = ids.map((id) => BigInt(id));

    const produtores = await this.prisma.produtor.findMany({
      where: {
        id_pessoa_demeter: { in: produtoresIds },
      },
    });

    return produtores;
  }

  async findMany(ids: string[]) {
    const produtoresIds = ids.map((id) => BigInt(id));

    const produtores = await this.prisma.produtor.findMany({
      where: { id_pessoa_demeter: { in: produtoresIds } },
      include:
        // includePerfil        ?
        {
          at_prf_see: {
            where: { ativo: true },
            include: {
              at_prf_see_propriedade: {
                include: {
                  pl_propriedade: {
                    select: {
                      nome_propriedade: true,
                      id_und_empresa: true,
                      municipio: {
                        select: {
                          id_municipio: true,
                          nm_municipio: true,
                        },
                      },
                      ger_und_empresa: {
                        include: {
                          ger_und_empresa: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      // : undefined,
    });

    const municipioIds = produtores
      .filter(
        (p) =>
          !!p.at_prf_see[0]?.at_prf_see_propriedade[0]?.pl_propriedade?.municipio
            ?.id_municipio
      )
      .map(
        (p) =>
          p.at_prf_see[0].at_prf_see_propriedade[0].pl_propriedade.municipio?.id_municipio
      );

    const SREs: any[] = await this.prisma.$queryRaw`
            SELECT re.nm_regional_ensino, me.fk_municipio from ger_regional_ensino as re
            JOIN ger_municipio_ensino as me
            ON re.id_regional_ensino = me.fk_regional_ensino
            WHERE me.fk_municipio = ANY(ARRAY[${municipioIds}]);
            `;

    produtores.forEach((p: any) => {
      if (
        !p.at_prf_see[0]?.at_prf_see_propriedade[0]?.pl_propriedade?.municipio
          ?.id_municipio
      ) {
        return;
      }
      const sreName = SREs.find(
        (sre) =>
          sre.fk_municipio ===
          p.at_prf_see[0].at_prf_see_propriedade[0].pl_propriedade.municipio.id_municipio
      ).nm_regional_ensino;
      // p.at_prf_see[0].at_prf_see_propriedade[0].pl_propriedade.municipio.nm_municipio =
      //   sreName;
      p.at_prf_see[0].at_prf_see_propriedade[0].pl_propriedade.regional_sre = sreName;
    });

    return produtores;
  }

  async getUnidadeEmpresa(produtorId: bigint) {
    const produtor = await this.prisma.produtor.findUnique({
      where: { id_pessoa_demeter: produtorId },
      select: {
        nr_cpf_cnpj: true,
        id_und_empresa: true,
      },
    });

    return produtor;
  }

  async create(input: any) {
    return "This method is not implemented yet.";
  }
}
