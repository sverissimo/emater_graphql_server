import assert from "node:assert/strict";
import { afterEach, describe, mock, test } from "node:test";
import type { PrismaClient } from "../../../generated/prisma/client.js";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.LOGS_FOLDER ??= "/tmp";

const [{ Prisma }, { logger }, { ProdutorRepository }] = await Promise.all([
  import("../../../generated/prisma/client.js"),
  import("../../../shared/utils/logger.js"),
  import("./ProdutorRepository.js"),
]);

const originalLoggerError = logger.error;

afterEach(() => {
  logger.error = originalLoggerError;
});

const input = {
  nome: "Maria",
  cpf: "52998224725",
  unidadeEmpresa: "H001",
  municipioId: 123,
};

const createMockPrisma = (
  unidade: { id_und_empresa: string; fk_municipio: number } | null = {
    id_und_empresa: "H001",
    fk_municipio: 123,
  },
) => {
  const findFirst = mock.fn(async (_args: unknown) => unidade);
  const create = mock.fn(async (args: any) => ({
    id_pessoa_demeter: 987n,
    pl_propriedade_ger_pessoa: args?.data?.pl_propriedade_ger_pessoa
      ? [{ id_pl_propriedade: 555n }]
      : [],
  }));

  return {
    prisma: {
      ger_und_empresa: { findFirst },
      produtor: { create },
    } as unknown as PrismaClient,
    findFirst,
    create,
  };
};

describe("ProdutorRepository.create", { concurrency: false }, () => {
  test("builds the minimal three-row nested write", async () => {
    const { prisma, findFirst, create } = createMockPrisma();
    const repository = new ProdutorRepository(prisma);

    assert.deepEqual(await repository.create(input), {
      produtorId: 987n,
      propriedadeId: null,
    });
    assert.equal(findFirst.mock.callCount(), 1);
    assert.equal(create.mock.callCount(), 1);

    const lookup = findFirst.mock.calls[0].arguments[0] as any;
    assert.deepEqual(lookup.where, {
      id_und_empresa: { equals: "H001", startsWith: "H" },
      sn_ativa: 1,
      fk_municipio: { not: null },
      ger_und_empresa: {
        is: {
          id_und_empresa: { startsWith: "G" },
          sn_ativa: 1,
        },
      },
    });

    const data = (create.mock.calls[0].arguments[0] as any).data;
    assert.equal(data.nr_cpf_cnpj, "52998224725");
    assert.equal(data.id_und_empresa, "H001");
    assert.equal(
      data.ger_pes_cat_ramo_relacao.create.fk_cat_pessoa,
      39,
    );
    assert.equal(
      data.sub_categoria_pessoa_relacao.create.fk_sub_cat_pessoa,
      1,
    );
    assert.equal(data.ger_end_pessoa, undefined);
    assert.equal(data.contato_pessoa, undefined);
    assert.equal(data.pl_propriedade_ger_pessoa, undefined);
  });

  test("adds the optional propriedade rows and returns its id", async () => {
    const { prisma, create } = createMockPrisma();
    const repository = new ProdutorRepository(prisma);

    const result = await repository.create({
      ...input,
      propriedade: {
        nome: "Sítio Boa Vista",
        areaTotal: 12.5,
        geoPontoTexto: "POINT(-43.9 -19.9)",
        municipioId: 456,
        unidadeEmpresa: "H002",
      },
    });

    assert.deepEqual(result, { produtorId: 987n, propriedadeId: 555n });

    const data = (create.mock.calls[0].arguments[0] as any).data;
    assert.deepEqual(data.pl_propriedade_ger_pessoa.create, {
      dt_update_record: data.dt_update_record,
      ger_und_empresa: { connect: { id_und_empresa: "H002" } },
      pl_propriedade: {
        create: {
          nome_propriedade: "Sítio Boa Vista",
          area_total: 12.5,
          geo_ponto_texto: "POINT(-43.9 -19.9)",
          id_municipio: 456,
          id_und_empresa: "H002",
          ativo: true,
          dt_update_record: data.dt_update_record,
        },
      },
    });

    const select = (create.mock.calls[0].arguments[0] as any).select;
    assert.deepEqual(select, {
      id_pessoa_demeter: true,
      pl_propriedade_ger_pessoa: { select: { id_pl_propriedade: true } },
    });
  });

  test("adds the optional address and phone rows", async () => {
    const { prisma, create } = createMockPrisma();
    const repository = new ProdutorRepository(prisma);

    await repository.create({
      ...input,
      telefone: "31999998888",
      endereco: {
        logradouro: "Rua das Hortas",
        numero: "10",
        complemento: "Casa",
        bairro: "Centro",
        cep: "30110000",
      },
    });

    const data = (create.mock.calls[0].arguments[0] as any).data;
    assert.deepEqual(data.ger_end_pessoa.create, {
      ds_logradouro: "Rua das Hortas",
      nr_logradouro: "10",
      ds_complemento: "Casa",
      nm_bairro: "Centro",
      nr_cep: "30110000",
      tp_endereco: 1,
      fk_municipio: 123,
      fk_tpo_logradouro: 1,
      fk_distrito: null,
      id_und_empresa: "H001",
      dt_update_record: data.dt_update_record,
    });
    assert.deepEqual(data.contato_pessoa.create, {
      telefone: "31999998888",
      principal: true,
      id_tipo_contato_pessoa: 3,
      fk_operadora: null,
      id_und_empresa: "H001",
    });
  });

  test("supports each optional child independently", async () => {
    for (const partial of [
      { endereco: { logradouro: "Av. Brasil" } },
      { telefone: "3133334444" },
      {
        propriedade: {
          nome: "Sítio Boa Vista",
          municipioId: 456,
          unidadeEmpresa: "H002",
        },
      },
    ]) {
      const { prisma, create } = createMockPrisma();
      const repository = new ProdutorRepository(prisma);

      await repository.create({ ...input, ...partial });

      const data = (create.mock.calls[0].arguments[0] as any).data;
      assert.equal(Boolean(data.ger_end_pessoa), "endereco" in partial);
      assert.equal(Boolean(data.contato_pessoa), "telefone" in partial);
      assert.equal(
        Boolean(data.pl_propriedade_ger_pessoa),
        "propriedade" in partial,
      );
    }
  });

  test("rejects an invalid unit before insert", async () => {
    const { prisma, create } = createMockPrisma(null);
    const repository = new ProdutorRepository(prisma);
    const errorLog = mock.fn();
    logger.error = errorLog as unknown as typeof logger.error;

    assert.equal(await repository.create(input, { service: "pnae" }), null);
    assert.equal(create.mock.callCount(), 0);
    assert.equal(errorLog.mock.callCount(), 1);
  });

  test("swallows malformed direct input before database access", async () => {
    const { prisma, findFirst, create } = createMockPrisma();
    const repository = new ProdutorRepository(prisma);
    const errorLog = mock.fn();
    logger.error = errorLog as unknown as typeof logger.error;

    assert.equal(await repository.create(null as any), null);
    assert.equal(findFirst.mock.callCount(), 0);
    assert.equal(create.mock.callCount(), 0);
    assert.equal(errorLog.mock.callCount(), 1);
  });

  test("rejects a municipio mismatch before insert", async () => {
    const { prisma, create } = createMockPrisma({
      id_und_empresa: "H001",
      fk_municipio: 999,
    });
    const repository = new ProdutorRepository(prisma);
    const errorLog = mock.fn();
    logger.error = errorLog as unknown as typeof logger.error;

    assert.equal(await repository.create(input, { service: "pnae" }), null);
    assert.equal(create.mock.callCount(), 0);
    assert.equal(errorLog.mock.callCount(), 1);
  });

  test("swallows and logs Prisma failures exactly once", async (context) => {
    for (const code of ["P2002", "P2003"]) {
      await context.test(code, async () => {
        const { prisma, create } = createMockPrisma();
        create.mock.mockImplementationOnce(async () => {
          throw new Prisma.PrismaClientKnownRequestError("write failed", {
            code,
            clientVersion: "7.8.0",
          });
        });
        const repository = new ProdutorRepository(prisma);
        const errorLog = mock.fn();
        logger.error = errorLog as unknown as typeof logger.error;

        assert.equal(
          await repository.create(input, { service: "pnae" }),
          null,
        );
        assert.equal(create.mock.callCount(), 1);
        assert.equal(errorLog.mock.callCount(), 1);
      });
    }
  });
});
