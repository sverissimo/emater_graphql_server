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
        at_prf_see: {
          include: {
            at_prf_see_propriedade: true,
            dados_producao_agro_industria: true,
            dados_producao_in_natura: true,
            usuario: true,
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
