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
        produtor_propriedade: true,
      },
    });

    return propriedade;
  }

  async findByProdutorId(produtorId: bigint) {
    const produtoresFull = await this.prisma.produtorPropriedades.findMany({
      include: {
        produtor: true,
        propriedade: true,
      },
    });

    const propriedadeIds = produtoresFull
      .filter((t) => t.produtor_id === produtorId)
      .map((p) => p.propriedade_id);

    return this.prisma.propriedade.findMany({ where: { id_pl_propriedade: { in: propriedadeIds } } });
  }

  async findAll() {
    const propriedades = await this.prisma.propriedade.findMany({
      include: {
        produtor_propriedade: {
          include: { produtor: true },
        },
      },
    });
    return propriedades;
  }
}
