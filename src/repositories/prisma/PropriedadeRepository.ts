import { PrismaRepository } from "./PrismaRepository.js";
import { Repository } from "../Repository.js";
import { Propriedade } from "@prisma/client";
import { PropriedadeFindManyParams } from "@modules/propriedade/propriedadeResolver.js";

export class PropriedadeRepository
  extends PrismaRepository
  implements Repository<Propriedade>
{
  async findOne(id: number) {
    if (!id) {
      this.throwError("NOT_FOUND");
    }

    const propriedade = await this.prisma.propriedade.findFirst({
      where: { id_pl_propriedade: id },
      include: {
        pl_propriedade_ger_pessoa: true,
      },
    });

    return propriedade;
  }

  async findByProdutorId(produtorId: bigint) {
    const propriedades = await this.prisma.pl_propriedade_ger_pessoa.findMany({
      where: { id_pessoa_demeter: produtorId },
      include: {
        pl_propriedade: {
          include: {
            at_prf_see_propriedade: true,
            ger_und_empresa: {
              include: {
                ger_und_empresa: true,
              },
            },
            municipio: true,
          },
        },
      },
    });

    const result = propriedades.map((p) => p.pl_propriedade);
    return result;
  }

  async findMany({
    cpfs,
    produtoresIds,
    propriedadesIds,
  }: PropriedadeFindManyParams) {
    const propriedades = await this.prisma.pl_propriedade_ger_pessoa.findMany({
      where: {
        ...(produtoresIds && {
          id_pessoa_demeter: {
            in: produtoresIds.map((id) => BigInt(id)),
          },
        }),
        ...(propriedadesIds && {
          id_pl_propriedade: {
            in: propriedadesIds.map((id) => BigInt(id)),
          },
        }),
        ...(cpfs && {
          ger_pessoa: {
            nr_cpf_cnpj: {
              in: cpfs,
            },
          },
        }),
      },
      include: {
        pl_propriedade: {
          include: {
            municipio: true,
            ger_und_empresa: {
              include: {
                ger_und_empresa: true,
              },
            },
          },
        },
        ger_pessoa: true,
      },
    });

    return propriedades.map((p) => ({
      ...p.pl_propriedade,
      produtor: p.ger_pessoa,
    }));
  }

  async findAll() {
    const propriedades = await this.prisma.propriedade.findMany({
      include: {
        pl_propriedade_ger_pessoa: {
          include: { ger_pessoa: true },
        },
        municipio: true,
      },
      take: 100,
    });

    return propriedades;
  }

  async create(input: any) {
    return "This method is not implemented yet.";
  }
}
