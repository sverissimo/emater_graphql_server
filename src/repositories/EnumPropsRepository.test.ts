import assert from "node:assert/strict";
import { describe, mock, test } from "node:test";
import type { PrismaClient } from "../generated/prisma/client.js";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.LOGS_FOLDER ??= "/tmp";

const { EnumPropsRepository } = await import("./EnumPropsRepository.js");

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const municipios = [
  {
    id_und_empresa: "H0001",
    nome_municipio: "Município A",
    municipio_id: 1,
    regional_id: "G0001",
    nome_regional: "Regional A",
    regional_sre: null,
  },
];

const createRepository = () => {
  const queryRaw = mock.fn(async (_query: unknown) => municipios);
  const prisma = {
    $queryRaw: queryRaw,
  } as unknown as PrismaClient;

  return {
    repository: new EnumPropsRepository(prisma),
    queryRaw,
  };
};

describe("EnumPropsRepository.getMunicipiosEmater", () => {
  test("returns the cached rows within six hours", async () => {
    const { repository, queryRaw } = createRepository();

    const first = await repository.getMunicipiosEmater();
    const second = await repository.getMunicipiosEmater();

    assert.equal(first, municipios);
    assert.equal(second, municipios);
    assert.equal(queryRaw.mock.callCount(), 1);
  });

  test("refreshes after six hours", async (context) => {
    let now = 1_000;
    context.mock.method(Date, "now", () => now);
    const { repository, queryRaw } = createRepository();

    await repository.getMunicipiosEmater();
    await repository.getMunicipiosEmater();
    assert.equal(queryRaw.mock.callCount(), 1);

    now += CACHE_TTL_MS + 1;

    await repository.getMunicipiosEmater();
    assert.equal(queryRaw.mock.callCount(), 2);
  });

  test("shares one in-flight query between concurrent callers", async () => {
    let resolveQuery!: (rows: typeof municipios) => void;
    const pendingQuery = new Promise<typeof municipios>((resolve) => {
      resolveQuery = resolve;
    });
    const { repository, queryRaw } = createRepository();
    queryRaw.mock.mockImplementation(async () => pendingQuery);

    const first = repository.getMunicipiosEmater();
    const second = repository.getMunicipiosEmater();

    assert.equal(queryRaw.mock.callCount(), 1);

    resolveQuery(municipios);
    assert.equal(await first, municipios);
    assert.equal(await second, municipios);
  });

  test("does not cache a failed query", async () => {
    const expected = new Error("database failure");
    const { repository, queryRaw } = createRepository();
    let attempt = 0;
    queryRaw.mock.mockImplementation(async () => {
      attempt += 1;
      if (attempt === 1) throw expected;
      return municipios;
    });

    await assert.rejects(repository.getMunicipiosEmater(), expected);
    assert.equal(await repository.getMunicipiosEmater(), municipios);
    assert.equal(queryRaw.mock.callCount(), 2);
  });
});
