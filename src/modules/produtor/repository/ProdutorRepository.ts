import { Prisma, type Produtor } from "../../../generated/prisma/client.js";
import { PrismaRepository } from "../../../repositories/PrismaRepository.js";
import { Repository } from "../../../repositories/Repository.js";
import { EnumPropsRepository } from "../../../repositories/EnumPropsRepository.js";
import { logger } from "../../../shared/utils/logger.js";
import type { CreateProdutorDTO } from "../dto/CreateProdutorDTO.js";
import { ProdutorDataMapper } from "../ProdutorDataMapper.js";
import {
  FK_CAT_PESSOA,
  FK_SUB_CAT_PESSOA,
  TP_ENDERECO,
} from "../produtorConstants.js";

type CreateProdutorMeta = {
  service?: string;
};

const prismaFailureClass = (error: unknown): string => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return "duplicate_cpf";
    if (error.code === "P2003") return "invalid_foreign_key";
    return `prisma_${error.code}`;
  }

  return error instanceof Error ? error.name : "unknown";
};

export class ProdutorRepository
  extends PrismaRepository
  implements Repository<Produtor>
{
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
          enumPropsRepository.getPerfilProps(perfil),
        ),
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
                      geo_ponto_texto: true,
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
          !!p.at_prf_see[0]?.at_prf_see_propriedade[0]?.pl_propriedade
            ?.municipio?.id_municipio,
      )
      .map(
        (p) =>
          p.at_prf_see[0].at_prf_see_propriedade[0].pl_propriedade.municipio
            ?.id_municipio,
      );

    const SREs: any[] = await this.prisma.$queryRaw`
            SELECT re.nm_regional_ensino, me.fk_municipio from ger_regional_ensino as re
            JOIN ger_municipio_ensino as me
            ON re.id_regional_ensino = me.fk_regional_ensino
            WHERE me.fk_municipio = ANY(${municipioIds}::int[]);
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
          p.at_prf_see[0].at_prf_see_propriedade[0].pl_propriedade.municipio
            .id_municipio,
      ).nm_regional_ensino;
      // p.at_prf_see[0].at_prf_see_propriedade[0].pl_propriedade.municipio.nm_municipio =
      //   sreName;
      p.at_prf_see[0].at_prf_see_propriedade[0].pl_propriedade.regional_sre =
        sreName;
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

  async create(
    input: CreateProdutorDTO,
    meta?: CreateProdutorMeta,
  ): Promise<bigint | null> {
    let unidadeEmpresa = "unknown";
    const logContext = () =>
      `service=${meta?.service ?? "unknown"} unidadeEmpresa=${unidadeEmpresa}`;

    try {
      unidadeEmpresa = input.unidadeEmpresa;
      const { municipioId, endereco, telefone } = input;

      const unidade = await this.prisma.ger_und_empresa.findFirst({
        where: {
          id_und_empresa: {
            equals: unidadeEmpresa,
            startsWith: "H",
          },
          sn_ativa: 1,
          fk_municipio: { not: null },
          ger_und_empresa: {
            is: {
              id_und_empresa: { startsWith: "G" },
              sn_ativa: 1,
            },
          },
        },
        select: {
          id_und_empresa: true,
          fk_municipio: true,
        },
      });

      if (!unidade) {
        logger.error(`createProdutor: invalid_unit ${logContext()}`);
        return null;
      }

      if (unidade.fk_municipio !== municipioId) {
        logger.error(`createProdutor: municipio_mismatch ${logContext()}`);
        return null;
      }

      const now = new Date();
      const created = await this.prisma.produtor.create({
        data: {
          ...ProdutorDataMapper.mapProdutorInput(input),
          id_und_empresa: unidade.id_und_empresa,
          dt_update_record: now,
          ger_pes_cat_ramo_relacao: {
            create: {
              fk_cat_pessoa: FK_CAT_PESSOA,
              id_und_empresa: unidade.id_und_empresa,
              dt_update_record: now,
            },
          },
          sub_categoria_pessoa_relacao: {
            create: {
              fk_sub_cat_pessoa: FK_SUB_CAT_PESSOA,
              id_und_empresa: unidade.id_und_empresa,
              dt_update_record: now,
            },
          },
          ...(endereco && {
            ger_end_pessoa: {
              create: {
                ...ProdutorDataMapper.mapEndereco(endereco),
                tp_endereco: TP_ENDERECO,
                fk_municipio: municipioId,
                fk_tpo_logradouro:
                  ProdutorDataMapper.tipoLogradouro(endereco.logradouro),
                fk_distrito: null,
                id_und_empresa: unidade.id_und_empresa,
                dt_update_record: now,
              },
            },
          }),
          ...(telefone && {
            contato_pessoa: {
              create: {
                telefone,
                principal: true,
                id_tipo_contato_pessoa:
                  ProdutorDataMapper.tipoContato(telefone),
                fk_operadora: null,
                id_und_empresa: unidade.id_und_empresa,
              },
            },
          }),
        },
        select: { id_pessoa_demeter: true },
      });

      return created.id_pessoa_demeter;
    } catch (error: unknown) {
      logger.error(
        `createProdutor: execution_failure class=${prismaFailureClass(error)} ${logContext()}`,
      );
      return null;
    }
  }
}
