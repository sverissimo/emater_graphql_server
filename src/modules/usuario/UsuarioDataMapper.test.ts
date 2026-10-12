import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { UsuarioDataMapper } from "./UsuarioDataMapper.js";
import type { UsuarioRepositoryOutputDto } from "./dto/usuarioDTOs.js";

const usuario = (
  id_und_empresa: string | null,
  ger_und_empresa: unknown,
): UsuarioRepositoryOutputDto =>
  ({
    id_usuario: 1n,
    matricula_usuario: "998877",
    digito_matricula: "1",
    nome_usuario: "Maria Silva",
    login_usuario: "maria",
    id_und_empresa,
    ger_und_empresa,
    perfil_demeter: [{ perfil: { descricao_perfil: "Administrador2" } }],
  }) as unknown as UsuarioRepositoryOutputDto;

describe("UsuarioDataMapper.toViewModel", () => {
  test("uses a regional unit's own id when it has no parent regional", () => {
    const view = UsuarioDataMapper.toViewModel(
      usuario("G0028", {
        id_und_empresa: "G0028",
        nm_und_empresa: "Regional de Patos de Minas",
        ger_und_empresa: null,
      }),
    );

    assert.equal(view.id_reg_empresa, "G0028");
    assert.equal(view.id_und_empresa, "G0028");
  });

  test("keeps reading the parent regional for a local unit", () => {
    const view = UsuarioDataMapper.toViewModel(
      usuario("U0102", {
        id_und_empresa: "U0102",
        nm_und_empresa: "Unidade Guaxupé",
        ger_und_empresa: { id_und_empresa: "G0102" },
      }),
    );

    assert.equal(view.id_reg_empresa, "G0102");
  });

  test("is null when there is neither a regional unit nor a parent", () => {
    assert.equal(
      UsuarioDataMapper.toViewModel(
        usuario("U0102", {
          id_und_empresa: "U0102",
          nm_und_empresa: "Unidade Guaxupé",
          ger_und_empresa: null,
        }),
      ).id_reg_empresa,
      null,
    );
    assert.equal(
      UsuarioDataMapper.toViewModel(usuario(null, null)).id_reg_empresa,
      null,
    );
  });

  test("keeps the rest of the login response shape unchanged", () => {
    assert.deepEqual(
      UsuarioDataMapper.toViewModel(
        usuario("U0102", {
          id_und_empresa: "U0102",
          ger_und_empresa: { id_und_empresa: "G0102" },
        }),
      ),
      {
        id_usuario: "1",
        matricula_usuario: "998877",
        digito_matricula: "1",
        nome_usuario: "Maria Silva",
        login_usuario: "maria",
        id_und_empresa: "U0102",
        id_reg_empresa: "G0102",
        perfis: ["Administrador2"],
      },
    );
  });
});
