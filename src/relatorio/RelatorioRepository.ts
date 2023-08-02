import { PrismaRepository } from "../Repositories/PrismaRepository.js";
import { Repository } from "../Repositories/Repository.js";
import { Relatorio } from "@prisma/client";

export class RelatorioRepository extends PrismaRepository implements Repository<any> {
  async create(relatorio: Omit<Relatorio, "id">) {
    return await this.prisma.relatorio.create({ data: relatorio });
  }

  async findOne({ id, produtorId }: { id: number; produtorId: number }) {
    if (!id && !produtorId) {
      this.throwError("NO_ID_PROVIDED");
    }
    const relatorio = await this.prisma.relatorio.findFirst({
      where: { OR: [{ id }, { produtorId }] },
    });
    if (!relatorio) {
      this.throwError("NOT_FOUND");
    }
    return relatorio;
  }

  findAll = async () => await this.prisma.relatorio.findMany();

  async update(id: number, update: Partial<Relatorio>) {
    try {
      const updated = await this.prisma.relatorio.update({ where: { id }, data: update });
      return updated;
    } catch (error) {
      this.handleRecordNotFound(error as Error);
    }
  }
  async delete(id: number) {
    try {
      return await this.prisma.relatorio.delete({ where: { id } });
    } catch (error) {
      this.handleRecordNotFound(error as Error);
    }
  }
}
