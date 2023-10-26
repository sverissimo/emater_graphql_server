import { Produtor } from "@prisma/client";

import { PrismaRepository } from "../../shared/repositories/PrismaRepository.js";
import { Repository } from "../../shared/repositories/Repository.js";

export class ProdutorRepository extends PrismaRepository implements Repository<Produtor> {
  async findOne({ id, cpf }: { id: bigint; cpf: string }) {
    if (!id && !cpf) {
      this.throwError("NO_ID_PROVIDED");
    }

    const produtor = await this.prisma.produtor.findFirst({
      where: { OR: [{ id_pessoa_demeter: id }, { nr_cpf_cnpj: cpf }] },
      include: {
        at_prf_see: {
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
      this.throwError("NOT_FOUND");
    }

    return produtor;
  }

  async findAll() {
    const produtores = await this.prisma.produtor.findMany({
      include: {
        pl_propriedade_ger_pessoa: true,
      },
    });
    return produtores;
  }
}
