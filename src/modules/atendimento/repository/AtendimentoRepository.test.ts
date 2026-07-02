import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { AtendimentoListRow } from "../atendimentoListMapper.js";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.LOGS_FOLDER ??= "/tmp";

const { AtendimentoRepository } = await import("./AtendimentoRepository.js");

type QueryCall = {
  sql: string;
  values: unknown[];
};

const date = new Date("2026-06-20T12:00:00.000Z");

function row(id: bigint): AtendimentoListRow {
  return {
    id_at_atendimento: id,
    data_inicio_atendimento: date,
    data_fim_atendimento: date,
    data_validacao: null,
    data_atualizacao: date,
    data_criacao: date,
    data_sei: null,
    data_see: null,
    sn_pendencia: 0,
    sn_validado: 1,
    dt_update_record: date,
    id_at_anterior: null,
    id_und_empresa: "H1234",
    ativo: true,
    at_cli_atend_prop: [],
    at_atendimento_usuario: [],
  };
}

type ArquivoRow = {
  id_at_arquivo: bigint;
  id_at_atendimento: bigint;
  tipo_arquivo: string;
};

function buildRepository(
  idRows: { id_at_atendimento: bigint }[],
  rows: AtendimentoListRow[] = [],
  arquivoRows: ArquivoRow[] = [],
) {
  const queryCalls: QueryCall[] = [];
  const findManyCalls: unknown[] = [];
  const arquivoFindManyCalls: unknown[] = [];
  const prisma = {
    // The keyset query uses the call form -> a single Prisma.Sql object with .sql/.values.
    $queryRaw: async (query: any) => {
      queryCalls.push({ sql: String(query?.sql ?? ""), values: query?.values ?? [] });
      return idRows;
    },
    at_atendimento: {
      findMany: async (args: unknown) => {
        findManyCalls.push(args);
        return rows;
      },
    },
    at_arquivo: {
      findMany: async (args: unknown) => {
        arquivoFindManyCalls.push(args);
        return arquivoRows;
      },
    },
  };

  return {
    repo: new AtendimentoRepository(prisma as any),
    queryCalls,
    findManyCalls,
    arquivoFindManyCalls,
  };
}

describe("AtendimentoRepository.findComRelatorioManual", () => {
  test("returns an empty page envelope without hydrating when Step 1 finds no ids", async () => {
    const { repo, findManyCalls } = buildRepository([]);

    const page = await repo.findComRelatorioManual(200, 999n);

    assert.deepEqual(page, {
      items: [],
      pageSize: 200,
      nextCursor: null,
      hasMore: false,
    });
    assert.equal(findManyCalls.length, 0);
  });

  test("drops the extra row, computes nextCursor, and rebuilds Step 1 order", async () => {
    const { repo, findManyCalls } = buildRepository(
      [
        { id_at_atendimento: 30n },
        { id_at_atendimento: 20n },
        { id_at_atendimento: 10n },
      ],
      [row(20n), row(30n)],
    );

    const page = await repo.findComRelatorioManual(2, 999n);

    assert.equal(page.hasMore, true);
    assert.equal(page.nextCursor, 20n);
    assert.deepEqual(
      page.items.map((item) => item.id_at_atendimento),
      [30n, 20n],
    );
    assert.deepEqual(findManyCalls[0], {
      where: { id_at_atendimento: { in: [30n, 20n] } },
      select: {
        id_at_atendimento: true,
        data_inicio_atendimento: true,
        data_fim_atendimento: true,
        data_validacao: true,
        data_atualizacao: true,
        data_criacao: true,
        data_sei: true,
        data_see: true,
        sn_pendencia: true,
        sn_validado: true,
        dt_update_record: true,
        id_at_anterior: true,
        id_und_empresa: true,
        ativo: true,
        at_cli_atend_prop: {
          orderBy: { id_at_cli_atend_prop: "asc" },
          select: {
            ger_pessoa: {
              select: {
                nm_pessoa: true,
                nr_cpf_cnpj: true,
                dap: true,
                caf: true,
              },
            },
            pl_propriedade: {
              select: { nome_propriedade: true, geo_ponto_texto: true },
            },
          },
        },
        at_atendimento_usuario: {
          orderBy: { id_usuario: "asc" },
          select: {
            usuario: {
              select: {
                id_usuario: true,
                nome_usuario: true,
                id_und_empresa: true,
              },
            },
          },
        },
      },
    });
  });

  test("returns nextCursor null when there is no extra row", async () => {
    const { repo } = buildRepository(
      [{ id_at_atendimento: 30n }, { id_at_atendimento: 20n }],
      [row(30n), row(20n)],
    );

    const page = await repo.findComRelatorioManual(2, 999n);

    assert.equal(page.hasMore, false);
    assert.equal(page.nextCursor, null);
    assert.deepEqual(
      page.items.map((item) => item.id_at_atendimento),
      [30n, 20n],
    );
  });

  test("clamps pageSize and binds the keyset limit as pageSize plus one", async () => {
    const { repo, queryCalls } = buildRepository([]);

    const page = await repo.findComRelatorioManual(5000, 999n);

    assert.equal(page.pageSize, 1000);
    // unscoped -> single keyset query; LIMIT is the last bound value.
    assert.equal(queryCalls.length, 1);
    assert.equal(queryCalls[0].values.at(-1), 1001);
  });

  test("normalizes trusted scope params before binding them into the keyset SQL", async () => {
    const scoped = buildRepository([]);
    await scoped.repo.findComRelatorioManual(200, 999n, {
      id_usuario: 7n,
      id_reg_empresa: " G0040 ",
    });

    // Single keyset query; scope is composed into it (regional stays a correlated EXISTS).
    assert.equal(scoped.queryCalls.length, 1);
    const values = scoped.queryCalls[0].values;
    assert.equal(values.includes(7n), true); // id_usuario bound in the owner branch
    assert.equal(values.includes("G0040"), true); // regional trimmed before binding
    assert.equal(values.includes(" G0040 "), false); // raw value never reaches SQL

    // A blank regional collapses to null: no regional branch is composed in.
    const blank = buildRepository([]);
    await blank.repo.findComRelatorioManual(200, 999n, { id_reg_empresa: "   " });
    assert.equal(blank.queryCalls[0].values.includes("   "), false);
  });

  test("skips the arquivo child query entirely when Step 1 finds no ids", async () => {
    const { repo, arquivoFindManyCalls } = buildRepository([]);
    await repo.findComRelatorioManual(200, 999n);
    assert.equal(arquivoFindManyCalls.length, 0);
  });

  test("batch-loads active at_arquivo (id asc) and groups them per atendimento", async () => {
    const { repo, arquivoFindManyCalls } = buildRepository(
      [{ id_at_atendimento: 30n }, { id_at_atendimento: 20n }],
      [row(30n), row(20n)],
      [
        { id_at_arquivo: 5n, id_at_atendimento: 30n, tipo_arquivo: "application/pdf" },
        { id_at_arquivo: 9n, id_at_atendimento: 30n, tipo_arquivo: "image/jpeg" },
        { id_at_arquivo: 7n, id_at_atendimento: 20n, tipo_arquivo: "image/png" },
      ],
    );

    const page = await repo.findComRelatorioManual(2, 999n);

    // Metadata-only, active-only, ordered by id asc; scoped to the page ids.
    assert.deepEqual(arquivoFindManyCalls[0], {
      where: { id_at_atendimento: { in: [30n, 20n] }, ativo: true },
      orderBy: { id_at_arquivo: "asc" },
      select: {
        id_at_arquivo: true,
        id_at_atendimento: true,
        tipo_arquivo: true,
      },
    });

    const byId = new Map(page.items.map((i) => [i.id_at_atendimento, i]));
    assert.deepEqual(byId.get(30n)!.arquivos, [
      { idArquivo: 5n, tipoArquivo: "application/pdf", nomeArquivo: "relatorio_30" },
      { idArquivo: 9n, tipoArquivo: "image/jpeg", nomeArquivo: "foto_30" },
    ]);
    assert.deepEqual(byId.get(20n)!.arquivos, [
      { idArquivo: 7n, tipoArquivo: "image/png", nomeArquivo: "foto_20" },
    ]);
  });
});

describe("AtendimentoRepository.getArquivoByTipo", () => {
  function build(findFirstResult: { arquivo: string } | null) {
    const calls: unknown[] = [];
    const prisma = {
      at_arquivo: {
        findFirst: async (args: unknown) => {
          calls.push(args);
          return findFirstResult;
        },
      },
    };
    return { repo: new AtendimentoRepository(prisma as any), calls };
  }

  test("selects the lowest-id active file for the exact tipo and returns its binary", async () => {
    const { repo, calls } = build({ arquivo: "JVBERi0=" });

    const result = await repo.getArquivoByTipo(2291872n, "application/pdf");

    assert.equal(result, "JVBERi0=");
    assert.deepEqual(calls[0], {
      where: {
        id_at_atendimento: 2291872n,
        tipo_arquivo: "application/pdf",
        ativo: true,
      },
      orderBy: { id_at_arquivo: "asc" },
      select: { arquivo: true },
    });
  });

  test("returns null when no active file matches the tipo", async () => {
    const { repo } = build(null);
    assert.equal(await repo.getArquivoByTipo(2291872n, "image/png"), null);
  });
});
