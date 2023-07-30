import { PrismaRepository } from "./PrismaRepository.js";
import { Repository } from "./Repository.js";

export class ProdutorRepository extends PrismaRepository implements Repository<any> {
  async findOne({ id, cpf }: { id: number; cpf: string }) {
    if (!id && !cpf) {
      this.throwError("NO_ID_PROVIDED");
    }

    const produtor = await this.prisma.produtor.findFirst({
      where: { OR: [{ id_pessoa_demeter: id }, { nr_cpf_cnpj: cpf }] },
      include: {
        produtor_propriedades: true,
        perfis: true,
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
