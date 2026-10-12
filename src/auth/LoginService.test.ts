import assert from "node:assert/strict";
import { mock, test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.LOGS_FOLDER ??= "/tmp";

const [{ AuthLdapService }, { LoginService }] = await Promise.all([
  import("./AuthLdapService.js"),
  import("./LoginService.js"),
]);

test("LoginService uses the dedicated fresh repository path", async (context) => {
  context.mock.method(
    AuthLdapService,
    "authenticate",
    async () => true,
  );

  const findMany = mock.fn(async () => {
    throw new Error("cached list path must not be used");
  });
  const findForLogin = mock.fn(
    async (_input: { matricula_usuario: string }) => [
      {
        id_usuario: 1n,
        nome_usuario: "Maria",
        login_usuario: "maria",
        matricula_usuario: "12345",
        digito_matricula: "6",
        id_und_empresa: "H0001",
        ger_und_empresa: {
          id_und_empresa: "H0001",
          nm_und_empresa: "Local A",
          ger_und_empresa: {
            id_und_empresa: "G0001",
            nm_und_empresa: "Regional A",
          },
        },
        perfil_demeter: [
          {
            perfil: {
              descricao_perfil: "Técnico",
            },
          },
        ],
      },
    ],
  );
  const service = new LoginService({
    findMany,
    findForLogin,
  } as any);

  const result = await service.login({
    matricula_usuario: "12345",
    password: "secret",
  });

  assert.equal(findForLogin.mock.callCount(), 1);
  assert.deepEqual(findForLogin.mock.calls[0].arguments[0], {
    matricula_usuario: "12345",
  });
  assert.equal(findMany.mock.callCount(), 0);
  assert.equal(result.id_usuario, "1");
  assert.equal(result.id_reg_empresa, "G0001");
  assert.deepEqual(result.perfis, ["Técnico"]);
});
