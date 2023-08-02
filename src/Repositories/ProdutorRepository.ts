import { Produtor } from "@prisma/client";
import { PrismaRepository } from "./PrismaRepository.js";
import { Repository } from "./Repository.js";

export class ProdutorRepository extends PrismaRepository implements Repository<Produtor> {
  async findOne({ id, cpf }: { id: bigint; cpf: string }) {
    if (!id && !cpf) {
      this.throwError("NO_ID_PROVIDED");
    }

    const produtor = await this.prisma.produtor.findFirst({
      where: { OR: [{ id_pessoa_demeter: id }, { nr_cpf_cnpj: cpf }] },
      include: {
        produtor_propriedades: true,
        perfis: {
          include: { atividade: true, dados_producao: true },
        },
        relatorios: true,
      },
    });

    if (!produtor) {
      this.throwError("NOT_FOUND");
    }
    console.log("🚀 ~ file: ProdutorRepository.ts:26 ~ ProdutorRepository ~ findOne ~ produtor:", produtor);
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
