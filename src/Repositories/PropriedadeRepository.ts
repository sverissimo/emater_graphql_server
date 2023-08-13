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
    const propriedades = await this.prisma.pl_propriedade_ger_pessoa.findMany({
      where: { id_pessoa_demeter: produtorId },
      include: {
        pl_propriedade: {
          include: {
            at_prf_see_propriedade: true,
          },
        },
      },
    });

    const result = propriedades.map((p) => p.pl_propriedade);
    return result;
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
