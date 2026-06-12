# Plan — add optional propriedade to `createProdutor`

> Extension of [produtor-create-mutation-plan.md](produtor-create-mutation-plan.md). Read that plan
> first; everything there (silent-failure contract, constants, validation/logging ownership,
> nested-create strategy) stays as-is. This plan only adds the propriedade leg.
>
> **Status: IMPLEMENTED (2026-06-11).** User decisions applied during review: propriedade
> `municipioId`/`unidadeEmpresa` are **client-sent fields on `PropriedadeInput`** (not derived
> server-side as first drafted), bigint stays confined to the mapper/repository layer, and the
> propriedade input is optional. tsc clean, 25/25 unit tests green; HMG run pending
> ([create-produtor.hmg-verification.md](../create-produtor.hmg-verification.md) steps 5–8).

## Requirements (from the user, verbatim intent)

1. Save a propriedade together with the produtor, writing to **two tables only**:
   `pl_propriedade` and `pl_propriedade_ger_pessoa`.
2. `pl_propriedade` — only these columns: `nome_propriedade`, `area_total`, `geo_ponto_texto`,
   `id_municipio`, `id_und_empresa`.
3. `pl_propriedade_ger_pessoa` — only these columns: `id_pl_propriedade`, `id_pessoa_demeter`,
   `id_und_empresa`.
4. Exactly **one** propriedade per produtor on this endpoint (single object, not a list).
5. If no produtor is created, no propriedade is created.
6. Return **both** `produtorId` and `propriedadeId` on success; `null` on failure.

## Approach — extend `createProdutor`, one nested write (KISS)

No new endpoint, no new module, no new service. The propriedade becomes a third optional child
(alongside `endereco` and `telefone`) inside the **same** `prisma.produtor.create` nested write
already in [ProdutorRepository.create](../../src/modules/produtor/repository/ProdutorRepository.ts).
Why this is the simplest correct option:

- **Requirement 5 is free.** A nested create is one implicit transaction: if any row fails,
  everything rolls back — a propriedade can never exist without its produtor, and vice versa.
- **Zero schema work.** Both models already exist in [prisma/schema.prisma](../../prisma/schema.prisma)
  from the original introspection, with the relations we need: `Produtor.pl_propriedade_ger_pessoa[]`,
  `pl_propriedade_ger_pessoa.pl_propriedade → Propriedade`, composite PK
  `(id_pl_propriedade, id_pessoa_demeter)`. No `db pull`, no hand-added models, no forced-type caveats.
- **Both ids in one round trip.** Prisma returns the generated `id_pl_propriedade` through the
  `select` on the same create call — no second query.

DB defaults we rely on (verified in the schema): `pl_propriedade.id_pl_propriedade` is
`autoincrement()`, `id_sincronismo` is DB-generated, `dt_update_record` defaults to `now()` on both
tables. We still set `dt_update_record: now` explicitly on both rows for consistency with the
sibling child creates (same `now` across all rows of one produtor).

## Contract impact — return type changes (gate first)

The mutation return changes from `BigInt` (the produtor id) to an object carrying both ids. This is
the **one non-additive change** in this plan. `createProdutor` shipped only days ago and has no
callers yet, but per repo rules the implementation must start by grepping consumers
(`/home/apps/*`, `/home/pnae/*`, starting at `pnae_app/backend/src/@graphQL-server/`) for
`createProdutor` and stop if any call site exists. Everything else here is additive.

## Design

### GraphQL ([produtor.graphql](../../src/modules/produtor/produtor.graphql))

```graphql
type Mutation {
  createProdutor(input: CreateProdutorInput!): CreateProdutorResult
}

type CreateProdutorResult {
  produtorId: BigInt!
  propriedadeId: BigInt   # null when no propriedade was sent
}

input CreateProdutorInput {
  # ...existing fields unchanged...
  propriedade: PropriedadeInput
}

input PropriedadeInput {
  nome: String!           # -> nome_propriedade (NOT NULL in DB)
  areaTotal: Float        # -> area_total Decimal(13,4)
  geoPontoTexto: String   # -> geo_ponto_texto VarChar(255)
  municipioId: Int!       # -> id_municipio
  unidadeEmpresa: String! # -> id_und_empresa on both propriedade rows
}
```

Notes:

- `propriedade` is **optional**: absent ⇒ behavior identical to today, `propriedadeId: null`.
  Single object (not a list) enforces requirement 4 at the type level.
- `municipioId` and `unidadeEmpresa` are **client-sent on `PropriedadeInput`** (user decision —
  a farm may sit in a different município than the produtor's unit). They are *not* validated
  against `ger_und_empresa`/`sep_municipio` with extra lookups: the FK constraints catch bad
  values inside the transaction, which rolls back and surfaces as the usual silent `null`.
- The whole result is `null` on any execution failure (the existing silent contract). The SDL
  description gets the same wording as today plus the propriedade atomicity note.
- `input PropriedadeInput` doesn't collide with the existing `type Propriedade`
  (inputs and output types live in separate GraphQL namespaces, and no input by that name exists).

### DTO ([CreateProdutorDTO.ts](../../src/modules/produtor/dto/CreateProdutorDTO.ts))

```ts
export type PropriedadeInput = {
  nome: string;
  areaTotal?: number | null;
  geoPontoTexto?: string | null;
  municipioId: number;
  unidadeEmpresa: string;
};
// CreateProdutorDTO gains: propriedade?: PropriedadeInput | null;
```

New result type next to the DTO (imported by repo + resolver):

```ts
export type CreateProdutorResult = {
  produtorId: bigint;
  propriedadeId: bigint | null;
};
```

### Validation ([produtorValidation.ts](../../src/modules/produtor/produtorValidation.ts))

Inside `validateAndNormalize`, when `input.propriedade` is present:

- `requireNonBlank` on `nome` (DB column is NOT NULL) and `unidadeEmpresa`.
- `checkMaxLength(nome, 100)`, `checkMaxLength(geoPontoTexto, 255)`, `checkMaxLength(unidadeEmpresa, 5)` (`Char(5)`).
- `municipioId`: positive integer (same rule as the produtor's).
- `areaTotal`, when present: finite number, `> 0`, `< 1e9` (fits `Decimal(13,4)`).

Same `ProdutorValidationError` / resolver-logs-once / return-null path as every other validation.

### Mapper ([ProdutorDataMapper.ts](../../src/modules/produtor/ProdutorDataMapper.ts))

```ts
/** pl_propriedade columns from the domain input (dt_update_record set by the repo). */
static mapPropriedade(propriedade: PropriedadeInput) {
  return {
    nome_propriedade: propriedade.nome,
    area_total: propriedade.areaTotal ?? null,
    geo_ponto_texto: propriedade.geoPontoTexto ?? null,
    id_municipio: propriedade.municipioId,
    id_und_empresa: propriedade.unidadeEmpresa,
    ativo: true,
  };
}
```

### Repository ([ProdutorRepository.ts](../../src/modules/produtor/repository/ProdutorRepository.ts))

`create` keeps its signature shape but returns `CreateProdutorResult | null`. Inside the existing
nested `data`, add (mirroring the `endereco` spread):

```ts
...(propriedade && {
  pl_propriedade_ger_pessoa: {
    create: {
      dt_update_record: now,
      ger_und_empresa: {
        connect: { id_und_empresa: propriedade.unidadeEmpresa },
      },
      pl_propriedade: {
        create: {
          ...ProdutorDataMapper.mapPropriedade(propriedade),
          dt_update_record: now,
        },
      },
    },
  },
}),
```

Prisma input-variant gotcha discovered while implementing: `pl_propriedade_ger_pessoa` is a fully
introspected model whose `id_und_empresa` is backed by a modeled relation (`ger_und_empresa`), so
its nested create cannot mix that raw scalar FK with the `pl_propriedade` relation field — checked
inputs take relation fields only, unchecked take scalars only (and would then require an existing
`id_pl_propriedade`). The join row therefore uses the **checked** variant with a `connect` for the
unit, while the propriedade row itself stays all-scalar (**unchecked** variant — its `municipio` /
`ger_und_empresa` relations are bypassed via `id_municipio` / `id_und_empresa`). A `connect` on a
nonexistent unit fails as P2025 inside the transaction → rollback → silent `null`.

and widen the `select`:

```ts
select: {
  id_pessoa_demeter: true,
  pl_propriedade_ger_pessoa: { select: { id_pl_propriedade: true } },
},
```

Return `{ produtorId: created.id_pessoa_demeter, propriedadeId: created.pl_propriedade_ger_pessoa[0]?.id_pl_propriedade ?? null }`.
On a fresh create the array has exactly 0 or 1 rows. Error handling unchanged: any failure
(including a propriedade constraint failure) hits the existing catch, logs one
`execution_failure class=...` line, returns `null` — and the transaction rollback guarantees the
produtor row is gone too (all-or-nothing; a propriedade failure does not leave a half-created produtor).

### Resolver ([produtorResolver.ts](../../src/modules/produtor/produtorResolver.ts))

- `ProdutorCreateRepository.create` local type: `Promise<CreateProdutorResult | null>`.
- `attempt` log gains `propriedade=${Boolean(input.propriedade)}`.
- `success` log: `id_pessoa_demeter=${result.produtorId} id_pl_propriedade=${result.propriedadeId ?? "none"}`.
- Return the result object as-is (or `null`). No other change — validation/normalization flow,
  silent-failure ownership, and the outer catch all stay put.

## Tests (extend the 4 existing files, same runner)

- **Mapper:** `mapPropriedade` full/minimal input; nullable passthrough.
- **Validation:** propriedade absent (no-op), blank `nome` throws, `nome` > 100 throws,
  `geoPontoTexto` > 255 throws, `areaTotal` 0 / negative / non-finite / ≥ 1e9 throw, valid passes.
- **Repository:** payload includes the two-level nested create with derived
  `id_municipio`/`id_und_empresa`; select shape; result carries both ids; `propriedadeId: null`
  when input has no propriedade; failure path still returns `null` with one log line.
- **Resolver:** returns the result object; `null` propagation; new log fields.

## Docs to update in the same change

- **[create-produtor.hmg-verification.md](../create-produtor.hmg-verification.md):**
  - Preflight: add `pl_propriedade` + `pl_propriedade_ger_pessoa` to the INSERT-privilege and
    sequence checks (`pl_propriedade.id_pl_propriedade` sequence).
  - New step "Create with propriedade": mutation sends `propriedade`, expects both ids;
    SQL asserts one `pl_propriedade` row (only the 5 columns populated, rest null/default) and one
    join row with matching ids + `id_und_empresa`.
  - New silent-failure cases: blank `propriedade.nome` (validation), invalid
    `propriedade.unidadeEmpresa` (P2025 connect failure) and invalid `propriedade.municipioId`
    (P2003). The last two fail **after** the root insert, so they finally prove PostgreSQL
    rollback through the normal API — the old "rollback not executable" caveat is gone.
  - **Cleanup order changes** — both `pl_propriedade_ger_pessoa` FKs are `NoAction` (no cascade
    from `ger_pessoa`): delete `contato_pessoa` → `pl_propriedade_ger_pessoa` → `pl_propriedade`
    → `ger_pessoa`.
- **AGENTS.md:** update the `createProdutor` mentions (modules bullet + error-handling bullet) to
  say it optionally creates one propriedade and returns `{ produtorId, propriedadeId }` or `null`.
- **[produtor-create-mutation-plan.md](produtor-create-mutation-plan.md):** one-line pointer to
  this plan so the return-type change is traceable.

## Implementation order

1. Consumer grep gate for `createProdutor` (stop if any caller exists).
2. GraphQL + DTO + result type.
3. Validation + mapper (+ their tests).
4. Repository nested create + select + return shape (+ tests).
5. Resolver type/logs/return (+ tests).
6. `npx tsc --noEmit` + full test run (inside the dev container for any prisma command).
7. Docs (verification doc, AGENTS.md, plan pointer).

## Explicitly out of scope

- Standalone propriedade endpoint, propriedade update/delete, multiple propriedades per produtor.
- Client changes (per the user: "do NOT worry about the client").
- Any write to `pl_propriedade` columns beyond the five listed, or to other propriedade tables
  (`at_prf_see_propriedade` etc.).
