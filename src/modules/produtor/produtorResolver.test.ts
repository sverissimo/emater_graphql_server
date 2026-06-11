import assert from "node:assert/strict";
import { afterEach, describe, mock, test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.LOGS_FOLDER ??= "/tmp";

const [{ logger }, { produtorResolver }] = await Promise.all([
  import("../../shared/utils/logger.js"),
  import("./produtorResolver.js"),
]);

const originalLoggerError = logger.error;
const originalLoggerInfo = logger.info;

afterEach(() => {
  logger.error = originalLoggerError;
  logger.info = originalLoggerInfo;
});

const input = {
  nome: "Maria",
  cpf: "529.982.247-25",
  unidadeEmpresa: "H001",
  municipioId: 123,
  telefone: "(31) 99999-8888",
};

describe("produtorResolver.createProdutor", { concurrency: false }, () => {
  test("normalizes input and returns the created id", async () => {
    const create = mock.fn(async (_input: unknown, _meta?: unknown) => 987n);
    const infoLog = mock.fn();
    logger.info = infoLog as unknown as typeof logger.info;
    const resolver = produtorResolver({ create } as any);

    const result = await resolver.Mutation.createProdutor(
      undefined,
      { input },
      { service: "pnae" },
    );

    assert.equal(result, 987n);
    assert.equal(create.mock.callCount(), 1);
    const normalized = create.mock.calls[0].arguments[0] as typeof input;
    assert.equal(normalized.cpf, "52998224725");
    assert.equal(normalized.telefone, "31999998888");
    assert.deepEqual(create.mock.calls[0].arguments[1], { service: "pnae" });
    assert.equal(infoLog.mock.callCount(), 2);
  });

  test("swallows validation failures before calling the repository", async () => {
    const create = mock.fn(async (_input: unknown, _meta?: unknown) => 987n);
    const errorLog = mock.fn();
    const infoLog = mock.fn();
    logger.error = errorLog as unknown as typeof logger.error;
    logger.info = infoLog as unknown as typeof logger.info;
    const resolver = produtorResolver({ create } as any);

    const result = await resolver.Mutation.createProdutor(
      undefined,
      { input: { ...input, cpf: "invalid" } },
      { service: "pnae" },
    );

    assert.equal(result, null);
    assert.equal(create.mock.callCount(), 0);
    assert.equal(errorLog.mock.callCount(), 1);
  });

  test("returns repository null without logging the failure again", async () => {
    const create = mock.fn(async (_input: unknown, _meta?: unknown) => null);
    const errorLog = mock.fn();
    const infoLog = mock.fn();
    logger.error = errorLog as unknown as typeof logger.error;
    logger.info = infoLog as unknown as typeof logger.info;
    const resolver = produtorResolver({ create } as any);

    const result = await resolver.Mutation.createProdutor(
      undefined,
      { input },
      { service: "pnae" },
    );

    assert.equal(result, null);
    assert.equal(errorLog.mock.callCount(), 0);
    assert.equal(infoLog.mock.callCount(), 1);
  });

  test("swallows an unexpected repository throw", async () => {
    const create = mock.fn(async (_input: unknown, _meta?: unknown) => {
      throw new Error("unexpected");
    });
    const errorLog = mock.fn();
    const infoLog = mock.fn();
    logger.error = errorLog as unknown as typeof logger.error;
    logger.info = infoLog as unknown as typeof logger.info;
    const resolver = produtorResolver({ create } as any);

    const result = await resolver.Mutation.createProdutor(
      undefined,
      { input },
      { service: "pnae" },
    );

    assert.equal(result, null);
    assert.equal(errorLog.mock.callCount(), 1);
  });
});
