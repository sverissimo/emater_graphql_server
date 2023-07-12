import { PrismaRepository } from "./PrismaRepository.js";
import { Repository } from "./Repository.js";

export class ProdutorRepository extends PrismaRepository implements Repository {
  async findOne(id: number) {
    if (!id) {
      this.throwError("NO_ID_PROVIDED");
    }

    const produtor = await this.prisma.produtor.findFirst({
      where: { id_pessoa_demeter: id },
      include: {
        produtor_propriedades: true,
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
        produtor_propriedades: true,
      },
    });
    return produtores;
  }
}
