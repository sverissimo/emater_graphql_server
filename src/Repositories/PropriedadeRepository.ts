import { PrismaRepository } from "./PrismaRepository.js";
import { Repository } from "./Repository.js";

export class PropriedadeRepository extends PrismaRepository implements Repository<any> {
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
    const produtoresFull = await this.prisma.pl_propriedade_ger_pessoa.findMany({
      include: {
        ger_pessoa: true,
        pl_propriedade: true,
      },
    });

    const propriedadeIds = produtoresFull
      .filter((t) => t.id_pessoa_demeter === produtorId)
      .map((p) => p.id_pl_propriedade);

    return this.prisma.propriedade.findMany({ where: { id_pl_propriedade: { in: propriedadeIds } } });
  }

  async findAll() {
    const propriedades = await this.prisma.propriedade.findMany({
      include: {
        pl_propriedade_ger_pessoa: {
          include: { ger_pessoa: true },
        },
      },
    });
    return propriedades;
  }
}
