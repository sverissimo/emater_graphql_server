import assert from "node:assert/strict";
import { describe, mock, test } from "node:test";
import type { PrismaClient } from "../../../generated/prisma/client.js";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.LOGS_FOLDER ??= "/tmp";

const [{ GraphQLError }, { UsuarioRepository }] = await Promise.all([
  import("graphql"),
  import("./UsuarioRepository.js"),
]);

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const createUsuario = ({
  id,
  nome,
  matricula = String(id).padStart(5, "0"),
  unidade = null,
}: {
  id: bigint;
  nome: string;
  matricula?: string;
  unidade?: any;
}) => ({
  id_usuario: id,
  nome_usuario: nome,
  matricula_usuario: matricula,
  ger_und_empresa: unidade,
  perfil_demeter: [],
});

const createRepository = (result: unknown[] = []) => {
  const findMany = mock.fn(async (_args: unknown) => result);
  const prisma = {
    usuario: { findMany },
  } as unknown as PrismaClient;

  return {
    repository: new UsuarioRepository(prisma),
    findMany,
  };
};

describe("UsuarioRepository cached list paths", () => {
  test("shares one snapshot, preserves OR filtering, and hydrates nomeRegional", async () => {
    const usuarios = [
      createUsuario({
        id: 1n,
        nome: "Maria",
        matricula: "11111",
        unidade: {
          id_und_empresa: "H0001",
          nm_und_empresa: "Local A",
          ger_und_empresa: {
            id_und_empresa: "G0001",
            nm_und_empresa: "Regional A",
          },
        },
      }),
      createUsuario({
        id: 2n,
        nome: "Ana",
        matricula: "22222",
        unidade: {
          id_und_empresa: "G0002",
          nm_und_empresa: "Regional B",
          ger_und_empresa: {
            id_und_empresa: "G9999",
            nm_und_empresa: "Wrong parent",
          },
        },
      }),
      createUsuario({
        id: 3n,
        nome: "José",
        matricula: "33333",
      }),
    ];
    const { repository, findMany } = createRepository(usuarios);

    const filtered = await repository.findMany({
      id: "1,3",
      matricula_usuario: "22222",
    });
    const byName = await repository.findByName("  ANA  ");

    assert.equal(findMany.mock.callCount(), 1);
    assert.deepEqual(findMany.mock.calls[0].arguments[0], {
      include: {
        perfil_demeter: {
          include: {
            perfil: true,
          },
        },
        ger_und_empresa: {
          include: {
            ger_und_empresa: true,
          },
        },
      },
    });
    assert.deepEqual(
      filtered?.map((usuario) => [
        usuario.id_usuario,
        usuario.nomeRegional,
      ]),
      [
        [1n, "Regional A"],
        [2n, "Regional B"],
        [3n, null],
      ],
    );
    assert.deepEqual(
      byName?.map((usuario) => usuario.id_usuario),
      [2n],
    );
  });

  test("preserves the two empty-filter no-row cases", async () => {
    const { repository, findMany } = createRepository([
      createUsuario({ id: 1n, nome: "Maria" }),
    ]);

    assert.deepEqual(await repository.findMany({}), []);
    assert.equal(findMany.mock.callCount(), 0);

    assert.deepEqual(
      await repository.findMany({
        id: "null,undefined,",
      }),
      [],
    );
    assert.equal(findMany.mock.callCount(), 1);
  });

  test("matches char matrículas without considering trailing whitespace", async () => {
    const { repository } = createRepository([
      createUsuario({
        id: 1n,
        nome: "Maria",
        matricula: "1234 ",
      }),
      createUsuario({
        id: 2n,
        nome: "Ana",
        matricula: "5678",
      }),
    ]);

    const result = await repository.findMany({
      matricula_usuario: "1234,5678 ",
    });

    assert.deepEqual(
      result?.map((usuario) => usuario.id_usuario),
      [1n, 2n],
    );
  });

  test("shares one snapshot between different name searches", async () => {
    const { repository, findMany } = createRepository([
      createUsuario({ id: 1n, nome: "Maria" }),
      createUsuario({ id: 2n, nome: "Ana" }),
    ]);

    await repository.findByName("maria");
    await repository.findByName("ana");

    assert.equal(findMany.mock.callCount(), 1);
  });

  test("matches case-insensitively, orders deterministically, and caps at 50", async () => {
    const usuarios = Array.from({ length: 55 }, (_, index) => {
      const id = BigInt(55 - index);
      return createUsuario({
        id,
        nome: `Maria ${String(id).padStart(2, "0")}`,
      });
    });
    const { repository } = createRepository(usuarios);

    const result = await repository.findByName("  mArIa  ");

    assert.equal(result?.length, 50);
    assert.deepEqual(
      result?.map((usuario) => usuario.id_usuario),
      Array.from({ length: 50 }, (_, index) => BigInt(index + 1)),
    );
  });

  test("orders equal names by id", async () => {
    const { repository } = createRepository([
      createUsuario({ id: 2n, nome: "Maria" }),
      createUsuario({ id: 1n, nome: "Maria" }),
    ]);

    const result = await repository.findByName("maria");

    assert.deepEqual(
      result?.map((usuario) => usuario.id_usuario),
      [1n, 2n],
    );
  });

  test("does not let name sorting reorder the cached snapshot", async () => {
    const { repository, findMany } = createRepository([
      createUsuario({ id: 1n, nome: "Maria Z" }),
      createUsuario({ id: 2n, nome: "Maria A" }),
    ]);

    assert.deepEqual(
      (await repository.findByName("maria"))?.map(
        (usuario) => usuario.id_usuario,
      ),
      [2n, 1n],
    );
    assert.deepEqual(
      (
        await repository.findMany({
          id: "1,2",
        })
      )?.map((usuario) => usuario.id_usuario),
      [1n, 2n],
    );
    assert.equal(findMany.mock.callCount(), 1);
  });

  test("rejects fewer than three trimmed characters before loading the snapshot", async () => {
    const { repository, findMany } = createRepository();

    await assert.rejects(
      repository.findByName("  ab  "),
      (error: unknown) =>
        error instanceof GraphQLError &&
        error.extensions.code === "BAD_REQUEST",
    );
    assert.equal(findMany.mock.callCount(), 0);
  });

  test("shares one in-flight snapshot between concurrent callers", async () => {
    let resolveQuery!: (usuarios: unknown[]) => void;
    const pendingQuery = new Promise<unknown[]>((resolve) => {
      resolveQuery = resolve;
    });
    const { repository, findMany } = createRepository();
    findMany.mock.mockImplementation(async () => pendingQuery);

    const byIdPromise = repository.findMany({ id: "1" });
    const byNamePromise = repository.findByName("ana");

    assert.equal(findMany.mock.callCount(), 1);

    resolveQuery([
      createUsuario({ id: 1n, nome: "Ana", matricula: "11111" }),
    ]);
    const [byId, byName] = await Promise.all([
      byIdPromise,
      byNamePromise,
    ]);

    assert.deepEqual(
      byId?.map((usuario) => usuario.id_usuario),
      [1n],
    );
    assert.deepEqual(
      byName?.map((usuario) => usuario.id_usuario),
      [1n],
    );
  });

  test("refreshes the snapshot after six hours", async (context) => {
    let now = 1_000;
    context.mock.method(Date, "now", () => now);

    let queryNumber = 0;
    const { repository, findMany } = createRepository();
    findMany.mock.mockImplementation(async () => {
      queryNumber += 1;
      return [
        createUsuario({
          id: BigInt(queryNumber),
          nome: "Maria",
        }),
      ];
    });

    assert.deepEqual(
      (await repository.findByName("maria"))?.map(
        (usuario) => usuario.id_usuario,
      ),
      [1n],
    );
    await repository.findByName("maria");
    assert.equal(findMany.mock.callCount(), 1);

    now += CACHE_TTL_MS + 1;

    assert.deepEqual(
      (await repository.findByName("maria"))?.map(
        (usuario) => usuario.id_usuario,
      ),
      [2n],
    );
    assert.equal(findMany.mock.callCount(), 2);
  });

  test("maps a snapshot failure once, leaves the cache empty, and retries later", async () => {
    const databaseError = new Error("database failure");
    const usuarios = [createUsuario({ id: 1n, nome: "Maria" })];
    const { repository, findMany } = createRepository();
    let attempt = 0;
    findMany.mock.mockImplementation(async () => {
      attempt += 1;
      if (attempt === 1) throw databaseError;
      return usuarios;
    });

    const throwError = mock.fn((error: unknown) => {
      throw error;
    });
    repository.errorHandler = { throwError };

    await assert.rejects(repository.findByName("maria"), databaseError);
    assert.deepEqual(
      (await repository.findByName("maria"))?.map(
        (usuario) => usuario.id_usuario,
      ),
      [1n],
    );
    assert.equal(throwError.mock.callCount(), 1);
    assert.equal(findMany.mock.callCount(), 2);
  });

  test("preserves malformed BigInt error mapping without database access", async () => {
    const expected = new Error("invalid id");
    const { repository, findMany } = createRepository();
    const throwError = mock.fn((_error: unknown) => {
      throw expected;
    });
    repository.errorHandler = { throwError };

    await assert.rejects(
      repository.findMany({ id: "not-a-bigint" }),
      expected,
    );
    assert.equal(throwError.mock.callCount(), 1);
    assert.equal(findMany.mock.callCount(), 0);
  });
});

describe("UsuarioRepository fresh paths", () => {
  test("login and findOne query every time and never consume the list snapshot", async () => {
    const usuarios = [
      createUsuario({
        id: 1n,
        nome: "Maria",
        matricula: "12345",
      }),
    ];
    const { repository, findMany } = createRepository(usuarios);

    await repository.findForLogin({
      matricula_usuario: "12345",
    });
    await repository.findForLogin({
      matricula_usuario: "12345",
    });
    await repository.findOne("1");
    await repository.findOne("1");

    assert.equal(findMany.mock.callCount(), 4);

    await repository.findMany({ id: "1" });
    await repository.findByName("maria");

    assert.equal(findMany.mock.callCount(), 5);
    assert.deepEqual(findMany.mock.calls[0].arguments[0], {
      where: {
        matricula_usuario: {
          in: ["12345"],
        },
      },
      include: {
        perfil_demeter: {
          include: {
            perfil: true,
          },
        },
        ger_und_empresa: {
          include: {
            ger_und_empresa: true,
          },
        },
      },
    });
    assert.deepEqual(findMany.mock.calls[2].arguments[0], {
      where: {
        OR: [{ id_usuario: { in: [1n] } }],
      },
      include: {
        perfil_demeter: {
          include: {
            perfil: true,
          },
        },
        ger_und_empresa: {
          include: {
            ger_und_empresa: true,
          },
        },
      },
    });
  });
});
