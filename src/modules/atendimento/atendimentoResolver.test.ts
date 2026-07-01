import assert from "node:assert/strict";
import { describe, test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.LOGS_FOLDER ??= "/tmp";

const [{ atendimentoResolver }, { ATENDIMENTO_KEYSET_START_CURSOR }] =
  await Promise.all([
    import("./atendimentoResolver.js"),
    import("./atendimentoConstants.js"),
  ]);

const emptyPage = {
  items: [],
  pageSize: 200,
  nextCursor: null,
  hasMore: false,
};

/** Builds the resolver with a stubbed repo that records the args it was called with. */
function buildResolver() {
  const calls: {
    pageSize: number;
    cursor: bigint;
    scope?: { id_usuario?: bigint | null; id_reg_empresa?: string | null };
  }[] = [];
  const findComRelatorioManual = async (
    pageSize: number,
    cursor: bigint,
    scope?: { id_usuario?: bigint | null; id_reg_empresa?: string | null },
  ) => {
    calls.push({ pageSize, cursor, scope });
    return emptyPage;
  };
  const resolver = atendimentoResolver({ findComRelatorioManual } as any);
  return { resolver, calls };
}

const call = (resolver: any, args: any) =>
  resolver.Query.atendimentosComRelatorioManual(undefined, args);

describe("atendimentoResolver.atendimentosComRelatorioManual", () => {
  test("defaults pageSize to 200 and cursor to the start sentinel", async () => {
    const { resolver, calls } = buildResolver();
    await call(resolver, {});
    assert.deepEqual(calls[0], {
      pageSize: 200,
      cursor: ATENDIMENTO_KEYSET_START_CURSOR,
      scope: { id_usuario: undefined, id_reg_empresa: undefined },
    });
  });

  test("clamps pageSize above 1000 down to 1000", async () => {
    const { resolver, calls } = buildResolver();
    await call(resolver, { pageSize: 5000 });
    assert.equal(calls[0].pageSize, 1000);
  });

  test("clamps pageSize below 1 up to 1 (0 and negatives)", async () => {
    const { resolver, calls } = buildResolver();
    await call(resolver, { pageSize: 0 });
    await call(resolver, { pageSize: -10 });
    assert.equal(calls[0].pageSize, 1);
    assert.equal(calls[1].pageSize, 1);
  });

  test("passes a provided cursor straight through", async () => {
    const { resolver, calls } = buildResolver();
    await call(resolver, { pageSize: 100, cursor: 12345n });
    assert.deepEqual(calls[0], {
      pageSize: 100,
      cursor: 12345n,
      scope: { id_usuario: undefined, id_reg_empresa: undefined },
    });
  });

  test("passes trusted backend scope args through to the repository", async () => {
    const { resolver, calls } = buildResolver();
    await call(resolver, {
      pageSize: 100,
      cursor: 12345n,
      id_usuario: 8842n,
      id_reg_empresa: "G0040",
    });
    assert.deepEqual(calls[0], {
      pageSize: 100,
      cursor: 12345n,
      scope: { id_usuario: 8842n, id_reg_empresa: "G0040" },
    });
  });

  test("returns the repository page envelope unchanged (incl. empty page)", async () => {
    const { resolver } = buildResolver();
    const result = await call(resolver, { pageSize: 100 });
    assert.deepEqual(result, emptyPage);
  });
});
