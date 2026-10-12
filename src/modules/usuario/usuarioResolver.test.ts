import assert from "node:assert/strict";
import { describe, mock, test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.LOGS_FOLDER ??= "/tmp";

const { usuarioResolver } = await import("./usuarioResolver.js");

describe("usuarioResolver", () => {
  test("keeps usuariosByName thin and returns hydrated rows unchanged", async () => {
    const expected = [
      {
        id_usuario: 1n,
        nome_usuario: "Maria",
        nomeRegional: "Regional A",
      },
    ];
    const findByName = mock.fn(async (_nome: string) => expected);
    const resolver = usuarioResolver({ findByName } as any);

    const result = await resolver.Query.usuariosByName(undefined, {
      nome: "  maria  ",
    });

    assert.equal(findByName.mock.callCount(), 1);
    assert.equal(findByName.mock.calls[0].arguments[0], "  maria  ");
    assert.equal(result, expected);
  });

  test("preserves usuarios argument mapping", async () => {
    const expected = [{ id_usuario: 1n }];
    const findMany = mock.fn(async (_filter: unknown) => expected);
    const resolver = usuarioResolver({ findMany } as any);

    const result = await resolver.Query.usuarios(undefined, {
      ids: "1,2",
      matriculas: "12345,67890",
    });

    assert.equal(findMany.mock.callCount(), 1);
    assert.deepEqual(findMany.mock.calls[0].arguments[0], {
      id: "1,2",
      matricula_usuario: "12345,67890",
    });
    assert.equal(result, expected);
  });
});
