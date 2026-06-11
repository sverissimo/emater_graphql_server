# Produtor Create Mutation Plan

Add a **create-only** `createProdutor` GraphQL mutation plus the additive `GET /api/getMunicipiosEmater` lookup route needed to populate its unit selector. There is no REST producer-create route, update, or delete. The mutation inserts a `ger_pessoa` (the `Produtor` model) row plus related rows in one nested write, mirroring `AtendimentoRepository.create`.

## Decisions

- **Surface:** GraphQL for producer creation + one new read-only REST lookup. No `/api/*` producer-create route.
- **Write scope:** 3–5 rows per create. `ger_pessoa` + two fixed categoria rows (`ger_pes_cat_ramo_relacao` cat=39, `sub_categoria_pessoa_relacao` subcat=1) on every call; `ger_end_pessoa` and `contato_pessoa` optional (a producer with no address/phone is valid).
- **At most one address and one phone per producer through this gateway.** Tables are 1:N at the DB; the SDL accepts a single optional `endereco` object and a single optional `telefone` scalar — no arrays.
- **`telefone` is a flat scalar.** `principal = true` (only phone), `fk_operadora = null`, `id_tipo_contato_pessoa` derived from the number by the repo.
- **Município chosen via `GET /api/getMunicipiosEmater`; client sends BOTH `unidadeEmpresa` (the H row's `id_und_empresa`) AND `municipioId` (the H row's `fk_municipio`).** The repo validates the unit, then **cross-checks `municipioId === unidade.fk_municipio`** — mismatch → logged + `null` (silent failure). The dropdown returns both ids paired; the client just passes them through.
- **`EnderecoInput`** holds street-level fields only: `logradouro`, `numero`, `complemento`, `bairro`, `cep`. `tp_endereco` is a fixed constant (see below). `fk_tpo_logradouro` is derived from `logradouro`. `fk_distrito` is always null — see "Ignored lookup tables."
- **`tp_endereco = 1`** is a fixed constant on every `ger_end_pessoa` insert. Not in the SDL, not client input.
- **`fk_cat_pessoa = 39` (Agricultor Familiar)** and **`fk_sub_cat_pessoa = 1` (Típico(a))** are fixed constants written on every create. Per-env id verification: see "Lookup ID verification."
- **Ignored lookup tables:** `operadora`, `sep_distrito`, `spa_meta_categoria_municipio` are not modeled, not queried, never referenced. FK columns on our INSERT targets that point to them (`contato_pessoa.fk_operadora`, `ger_end_pessoa.fk_distrito`) are always written as `NULL`. `spa_meta_categoria_municipio` has no FK from any INSERT target — purely irrelevant. This drops three models from the introspection / hand-add scope.
- **Mutation returns nullable `BigInt`** — success → the new `id_pessoa_demeter`; any failure → `null`. See "Error handling and logging (silent failure)."
- **Error handling: silent failure (business rule).** Every failure logs exactly once via Winston and returns `null` — no `GraphQLError`, no `extensions.code`, no leaked detail. Validation, unit/município mismatch, duplicate CPF, and Prisma errors all converge to log-and-`null`. Malformed input is guarded upstream (frontend + calling backend); the repo's checks are defensive.
- **Schema source: `prisma db pull`** (introspection), not hand-copied models. See "Schema work."
- **Client-facing contract is a flat domain input.** The repo maps domain fields to Prisma column names; the client never sees `ger_*` / `contato_pessoa` / `sep_*` table names, `fk_*` columns, `id_sincronismo`, or nested layout.
- **Duplicate-CPF behavior:** non-idempotent; logs once and returns `null`. See "Idempotency / retry contract."
- **Auth `service` claim handling:** see "Auth `service` claim."

The `ger_und_empresa` H/G hierarchy (H = local unit per município, G = regional, `H.fk_und_empresa → G`) is already used by `getRegionaisEmater` and the self-relation walks in `ProdutorRepository.findMany` / `PropriedadeRepository`.

## Contract-safety constraint

Per AGENTS.md "Contract stability," this change must be **purely additive with zero side effects on existing routes/resolvers**:

- `produtorResolver` is consumed by `src/schema/resolvers.ts`. Adding a `Mutation` key must not alter the existing `Query` / `Produtor` resolvers, their shapes, or behavior.
- `ProdutorRepository` is shared by produtor queries. Replacing the unused `create` stub must not touch `findOne` / `findAll` / `findMany` / `findManyMinimal` / `getUnidadeEmpresa`.
- SDL additions (new `Mutation` + `*Input` types) and Prisma schema growth (new models + generated back-relations on existing models) are additive — no existing field, type, query, route, status code, or scalar serialization changes.
- Grep `/home/apps/*` + `/home/pnae/*` for the new names (`createProdutor`, `getMunicipiosEmater`) before committing — already confirmed empty.

## Insert targets vs. lookup tables

Up to five tables receive inserts:

| Table                          | Prisma model                   | Relation to `ger_pessoa` | Notes                                                    |
| ------------------------------ | ------------------------------ | ------------------------ | -------------------------------------------------------- |
| `ger_pessoa`                   | `Produtor`                     | — (root)                 | Already in schema. PK `id_pessoa_demeter` autoincrement. |
| `ger_end_pessoa`               | `ger_end_pessoa`               | `fk_pessoa`, Cascade     | **Missing**. Address.                                    |
| `ger_pes_cat_ramo_relacao`     | `ger_pes_cat_ramo_relacao`     | `fk_pessoa`, Cascade     | Already in schema.                                       |
| `sub_categoria_pessoa_relacao` | `sub_categoria_pessoa_relacao` | `fk_pessoa`, Cascade     | **Missing**.                                             |
| `contato_pessoa`               | `contato_pessoa`               | `id_pessoa`, NoAction    | **Missing**. Phone.                                      |

Tables we don't insert into, by how this mutation actually treats them:

- **Read at runtime** (the create path or the dropdown endpoint queries them): `sep_municipio`, `ger_und_empresa`.
- **Referenced as fixed/derived constants, never queried here:** `ger_cat_pessoa`, `sub_categoria_pessoa`, `sep_tpo_logradouro`, `tipo_contato_pessoa`.
- **Ignored entirely** (not read, not written; FK columns pointing to them are saved `NULL`): `operadora`, `sep_distrito`, `spa_meta_categoria_municipio`.

## Schema work

1. **Schema-parity check across environments** — before running `db pull`, confirm dev/hmg/prod Demeter share the same shape for the insert targets and their lookups (`\d ger_pessoa`, `\d ger_end_pessoa`, etc., on each DB). Drift between envs would cause introspection to capture one env's reality and break the others at runtime.
2. **`npx prisma db pull`** (only with explicit user instruction per AGENTS.md). Review the diff against the five insert targets + their lookups. Expect generated back-relation fields on `Produtor`, `Municipio`, `Propriedade`, and `ger_und_empresa` — additive, none GraphQL-visible.
3. **Verify `fk_pessoa` / `id_pessoa` are `BigInt`** on the new child models (not `Int`, as the stale `db/custom-schema.prisma` snapshot shows). A scalar-type mismatch against `Produtor.id_pessoa_demeter` (BigInt) fails Prisma validation outright.
4. **`npx prisma generate`**. Confirm the new delegates exist (`prisma.ger_end_pessoa`, `prisma.sub_categoria_pessoa_relacao`, `prisma.contato_pessoa`) and that `npx tsc --noEmit` passes.

If introspection isn't viable, hand-add only the models this mutation actually needs (**~7**, down from the original ~10 — the three ignored lookups `operadora` / `sep_distrito` / `spa_meta_categoria_municipio` are no longer added): the three missing insert targets (`ger_end_pessoa`, `sub_categoria_pessoa_relacao`, `contato_pessoa`) plus the kept lookups they relate to (`sep_tpo_logradouro`, `sub_categoria_pessoa`, `ger_cat_pessoa`, `tipo_contato_pessoa`). Patch reciprocal relation fields on `Propriedade` / `Municipio` / `ger_und_empresa`, and **fix `fk_pessoa` / `id_pessoa` to `BigInt`**. Introspection is strongly preferred. See Appendix A for the full dependency graph and FK-type gotcha.

## Column handling on insert

A column is **must-fill** when its Prisma type has no `?` AND no `@default`. Re-confirm against the post-`db pull` `schema.prisma` and a live hmg insert before enabling writes.

| Table                          | Repo supplies (not in SDL)                                                                                                              | Derived from client input                                  | Handled automatically                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------- |
| `ger_pessoa`                   | `id_und_empresa`; `dt_update_record` (`new Date()`)                                                                                     | domain scalars (`nm_pessoa`, normalized `nr_cpf_cnpj`, …)  | PK; `id_sincronismo`; `sn_ativo`, `senha` |
| `ger_end_pessoa` _(opt)_       | `id_und_empresa`; `dt_update_record`; `fk_pessoa`; **`tp_endereco = 1`**; `fk_tpo_logradouro` (derived); `fk_distrito = null`           | `logradouro`, `numero`, `complemento`, `bairro`, `cep`; `fk_municipio` (= `input.municipioId`) | PK; `id_sincronismo`                      |
| `ger_pes_cat_ramo_relacao`     | `id_und_empresa`; `dt_update_record`; `fk_pessoa`; **`fk_cat_pessoa = 39`**                                                             | —                                                          | PK; `id_sincronismo`                      |
| `sub_categoria_pessoa_relacao` | `id_und_empresa`; `dt_update_record`; `fk_pessoa`; **`fk_sub_cat_pessoa = 1`**                                                          | —                                                          | PK; `id_sincronismo`                      |
| `contato_pessoa` _(opt)_       | `id_und_empresa`; `id_pessoa`; `principal = true`; `id_tipo_contato_pessoa` (derived); `fk_operadora = null`                            | normalized `telefone`                                      | PK; `id_sincronismo`                      |

- `dt_update_record` is **never in the SDL or DTO** — the repo sets it on the root and every child that has the column (not `contato_pessoa`, which has none).
- `id_sincronismo` is `@default(dbgenerated(...))` everywhere — Postgres fills it.
- **`id_und_empresa` is written to every inserted row** from `input.unidadeEmpresa` (after unit validation). Listed explicitly per row above to avoid the easy miss.
- `fk_municipio` comes from `input.municipioId`, cross-checked against the validated unit's `fk_municipio` (see "Município dropdown endpoint"). The unit lookup is still required for the active-H / active-G / non-null-`fk_municipio` invariants; only the source of `fk_municipio` itself changed from "derived" to "client input + cross-check."

## Município dropdown endpoint (`GET /api/getMunicipiosEmater`)

The client populates a município select box from this endpoint, then sends **both** the chosen `id_und_empresa` (as `unidadeEmpresa`) and the row's `fk_municipio` (as `municipioId`) into `createProdutor`. The repository validates the unit and cross-checks the município against it, preserving the unit/município pairing even if a caller bypasses the intended UI.

Sibling of `getRegionaisEmater` in `src/repositories/EnumPropsRepository.ts`, mounted in `src/routes/enumRoutes.ts`. New method `getMunicipiosEmater()`:

```sql
SELECT h.id_und_empresa, m.nm_municipio AS nome_municipio,
       h.fk_municipio   AS municipio_id, h.fk_und_empresa AS regional_id,
       g.nm_und_empresa AS nome_regional
FROM ger_und_empresa h
JOIN sep_municipio m ON m.id_municipio = h.fk_municipio
JOIN ger_und_empresa g
  ON g.id_und_empresa = h.fk_und_empresa
 AND g.id_und_empresa LIKE 'G%'
WHERE h.id_und_empresa LIKE 'H%'
  AND h.fk_municipio IS NOT NULL
  AND h.sn_ativa = 1
  AND g.sn_ativa = 1
  AND m.nm_municipio IS NOT NULL
  AND g.nm_und_empresa IS NOT NULL
ORDER BY m.nm_municipio;
```

`H%` (starts-with) is intentional — `getRegionaisEmater` uses `%G%` and stays untouched (published contract). `fk_municipio IS NOT NULL` removes the NOT-NULL-município trap from the create path.

**Deterministic unit validation + município cross-check in the create.** Before writing:
1. Query the selected unit with the same invariants (`H%`, active, non-null `fk_municipio`, active G parent). No match → logged + `null` (silent).
2. Assert `input.municipioId === unidade.fk_municipio`. Mismatch → logged + `null` (silent).

The validated `municipioId` is then used as `ger_end_pessoa.fk_municipio` when `endereco` is present.

## Input validation at the API boundary

Malformed input is already guarded upstream (frontend + calling-backend validators), so the resolver's checks here are **defensive**: they normalize, and on the rare bad payload that slips through they fail **silently** (log once, return `null` — see "Error handling and logging (silent failure)"). No `GraphQLError`, no `BAD_REQUEST`. The DTO is a shape contract, not a validator.

- **CPF normalization (transform, always runs)** — strip formatting (`.` `-` spaces) and **store the normalized digits**; never the formatted form. Without this, `"111.222.333-44"` and `"11122233344"` are distinct values and the unique constraint on `nr_cpf_cnpj` doesn't help. This is a transform, not a throwing validator — it runs on every call.
- **Defensive checks** — CPF length/check-digits; max-length bounds on bounded `String` columns (`nm_pessoa`, `email`, `identidade`, `tp_sexo`, `ds_logradouro`, `nr_logradouro`, `ds_complemento`, `bairro`, `cep`; lengths from the post-`db pull` `@db.VarChar(N)`); blank `""` on required fields; non-empty `unidadeEmpresa`; positive-Int `municipioId`. If any fails, the create aborts with **no insert** and returns `null` (logged). These guard against Postgres P2000 truncation and bad data, but the caller sees only `null`.
- **`municipioId`** is cross-checked against the validated unit's `fk_municipio` in the repo (see "Município dropdown endpoint"); on mismatch it also returns `null` silently.

## Lookup ID verification

Categoria **39** (Agricultor Familiar), subcategoria **1** (Típico(a)), contact types 1 (Comercial) / 3 (Celular), `tp_endereco = 1`, and the eight `sep_tpo_logradouro` ids are encoded as constants. These ids are stable but not guaranteed identical across dev/hmg/prod.

- **Deployment-time check, not boot-time.** A one-shot SQL assertion run before enabling writes in a new environment confirms each id resolves to the expected label (e.g. `SELECT id_cat_pessoa, ds_cat_pessoa FROM ger_cat_pessoa WHERE id_cat_pessoa = 39;`, the analogous queries for the other constants). Failing the shared gateway at boot because a lookup id drifted would take down every consumer for an issue unrelated to most of their traffic.
- Document the expected `(id, label)` pairs in the produtor module alongside the constants so the assertion is reproducible.
- **Open ambiguity on `fk_cat_pessoa`:** the cheat sheet pins **39 ("Agricultor Familiar")** but notes **35 ("Clientes")** as a possible alternative. Confirm the intended value against the lookup table during the deployment-time check before first write; if it should be 35, the change is a one-line constant flip.

## Tipo logradouro normalization (`fk_tpo_logradouro`)

Derived from the `logradouro` string by a pure function in `src/modules/produtor/ProdutorDataMapper.ts` (matches the existing `UsuarioDataMapper.ts` convention). Returns the `sep_tpo_logradouro.id_tpo_logradouro` or `null` (column is nullable).

IDs: **1** Rua, **2** Avenida, **3** Praça, **4** Rodovia, **5** Alameda, **6** Beco, **7** Travessa, **8** Sítio.

Rules — all case-insensitive:

1. Full-word prefix: `Rua …`→1, `Avenida …`→2, `Praça …`→3, `Rodovia …`→4, `Alameda`→5, `Beco`→6, `Travessa`→7, `Sítio` / `Sitio`→8.
2. Abbreviations: `R.`→1; `Av ` / `Av.`→2; `Rod.`→4; `Pç`→3.
3. Highway pattern: `BR`, `MG`, `LMG`, or `AMG` followed by optional `-`/space/nothing then a digit → 4.
4. No match → null.

Test specific tokens first so `Av.` and `Avenida` both land on 2; a lone `R`/`A` with no dot must not match. Keep the full original string in `ds_logradouro`.

## Phone normalization and contact type

`telefone` is optional, but when supplied it has a strict wire contract validated at the API boundary:

1. Accept digits with optional common formatting (`()`, spaces, `-`, leading `+55`). Reject letters / unsupported punctuation.
2. Strip formatting. Strip country code `55` only when the resulting digit string starts with `55` **and has 12 or 13 digits**; a local 10/11-digit number whose DDD is `55` stays intact.
3. Require exactly 10 or 11 digits including the two-digit DDD. A malformed/blank `telefone` that slips past the upstream guards fails **silently** (log once, return `null`) — never a surfaced error. (Phone is optional; an *omitted* `telefone` is fine and just skips `contato_pessoa`.)
4. Store only normalized digits (`contato_pessoa.telefone @db.Char(11)`).
5. Mobility digit is `digits[2]`. `7`, `8`, or `9` → contact type **3** (Celular); otherwise **1** (Comercial).

Keep normalization and type derivation as pure functions in `ProdutorDataMapper.ts`.

## Idempotency / retry contract

**The mutation is non-idempotent on duplicate CPF.** A retry with an already-stored CPF triggers a `P2002` unique violation on `nr_cpf_cnpj`, which — like every failure — is **logged once and returns `null`** (no surfaced code; see "Error handling and logging (silent failure)"). The client distinguishes "created" from "rejected" by `id` vs `null`, and is responsible for deduping retries (check the response before retrying, or query the CPF first).

Rationale: returning the existing `id_pessoa_demeter` on duplicate would make the mutation behave inconsistently (some calls insert, some don't) and risk masking that the record already existed. A `null` is honest without leaking why. Document the non-idempotency in the SDL description so consumers don't assume otherwise.

## Error handling and logging (silent failure)

**Business rule: every failure on the resolver/repository execution path logs exactly once via Winston and returns `null` to the caller.** No `GraphQLError`, no `extensions.code`, no message reaches the client — only `id` (success) or `null` (failure).

**Scope — what the rule can and cannot cover.** The rule lives in the resolver and repo, so it governs everything from input validation through the nested write. It does **not** cover failures *before the resolver runs*: GraphQL parse/validation and input **coercion** (a non-`Int` `municipioId`, an omitted non-null `cpf`, a malformed `DateTime`/`BigInt` scalar) are rejected by Apollo and surface as standard GraphQL input errors. We deliberately **do not** mask those with a global `formatError` hook — that would change error formatting for every existing query/mutation on this shared gateway (a contract change). Those surfaced errors are generic input-shape messages (`"Int cannot represent…"`, `"Field cpf of required type String! was not provided"`) that leak no Demeter/DB internals, so the rule's intent — never expose business or DB failure detail — still holds. Upstream clients are validated/guarded, so coercion errors are rare in practice.

- **Atomicity.** `prisma.produtor.create` with nested children runs as one implicit transaction: if any child insert fails, the whole write rolls back, so a failure never leaves a half-written producer.
- **No `throwError` on the create path.** Do **not** route the create's catch through `ErrorHandlerImpl.throwError` — it logs again and re-throws, which would both double-log and surface a coded error.

**One logging owner per failure** (no double-logging, no gaps). Use the Winston logger from `src/shared/utils/logger.ts` — never `console.log`. The `service` claim is read from **`context.service`** in the resolver (GraphQL has no `res`) and **threaded into the repo** so its log line can carry it; `res.locals.service` is the Express-only path used by REST handlers (the new `getMunicipiosEmater` route).

- **Entry** — **resolver**, one line: `service`, `unidadeEmpresa`, whether `endereco` / `telefone` were supplied. (Lifecycle, not a failure log.)
- **Validation failure (pre-repo)** — **resolver** owns it: log once (`service`, `unidadeEmpresa`, `validation`, short message) and return `null`. The repo is never reached.
- **Execution failure (unit-lookup / município mismatch / `P2002` / `P2003` / unknown)** — **repo** owns it: the single `try/catch` logs once (`service`, `unidadeEmpresa`, internal class — for the log only, never surfaced — and a short message) and returns `null`. The resolver receives `null` and returns it **without** an additional failure line.
- **Success** — **resolver**, one line: `service`, `unidadeEmpresa`, new `id_pessoa_demeter`.

**Do not log CPF, phone, address, or any full request payload.** PII and personally identifying contact data stay out of logs — operations needs the `id_pessoa_demeter` to investigate, not the CPF.

**Apollo context type fix (prerequisite for the resolver to see `context.service` typed).** `src/main.ts` declares `interface MyContext { token?: string }` but the runtime factory passes `{ service: res.locals.service }`. Widen `MyContext` to `{ service?: string }` (keep `token?: string` only if other resolvers already read it — current grep shows nothing does). This is a single-file edit, part of step 5 below.

## Auth `service` claim

The middleware attaches the decoded JWT `service` claim to `res.locals.service`; the Apollo context factory forwards it as `context.service` (requires the `MyContext` widening — see "Error handling and logging (silent failure)").

**Decision: log only. Do not persist on `ger_pessoa`.** No `created_by`-style column is part of the introspected `ger_pessoa` shape, and adding one is out of scope (we don't own the Demeter schema). The `service` claim is captured in Winston logs (see logging section) for audit / triage and nothing more.

Document this in the AGENTS.md change in step 8.

## Concurrency: unit-validate-then-write race

Unit validation runs as a separate query before the nested `create`. If the selected unit is deactivated between the validate query and the write, the write proceeds against a now-inactive unit. **Accepted behavior** — the window is small, deactivations are rare, and the row remains FK-valid because the unit still exists. No transaction wrapping for this case.

## Steps (gateway code)

All paths reflect the current per-module layout (`src/modules/<aggregate>/repository/`).

1. **DTO** — `src/modules/produtor/dto/CreateProdutorDTO.ts`. Flat domain shape: `nome`, `cpf`, `email?`, `dataNascimento?`, `tpSexo?`, `identidade?`, `unidadeEmpresa`, `municipioId`, `telefone?`, `endereco?`. The `endereco` sub-type holds `logradouro?`, `numero?`, `complemento?`, `bairro?`, `cep?` only — no `tpEndereco` (fixed constant 1, repo-supplied). Keep the sub-type in the same file. Excludes PK / `id_sincronismo` / `dt_update_record` / `senha` / `auth_token`. The repo explicitly maps domain → Prisma column names; do not spread the DTO into Prisma `data`.

2. **Validation helpers** — `src/modules/produtor/produtorValidation.ts` (new). Pure functions covering "Input validation at the API boundary": `normalizeCpf` (transform, always runs), `validateLengths`, etc. **No `validateTpEndereco`** — `tp_endereco` is a fixed constant (`1`), not client input. The resolver calls these before the repo; a failed defensive check aborts the create with **no insert** and returns `null` (logged) per "Error handling and logging (silent failure)" — it does not throw a coded error. The repo receives an already-normalized payload.

3. **Repository method** — add `create(input: CreateProdutorDTO, meta?: { service?: string })` to `src/modules/produtor/repository/ProdutorRepository.ts`, replacing the stub. The optional `meta` carries the resolver's `service` claim for the repo's failure log (see "Error handling and logging (silent failure)"); keeping it **optional** leaves `create` assignable to `Repository<T>`'s `create?: (input: any) => Promise<any>` — no interface change. Mirror `AtendimentoRepository.create`:
   - Destructure `unidadeEmpresa` / `municipioId` / `endereco` / `telefone` from `input`; read `meta?.service` for the failure log.
   - Resolve the unit via a deterministic query (active H, non-null `fk_municipio`, active G parent). No match → logged + `null` (silent).
   - **Cross-check `municipioId === unidade.fk_municipio`. Mismatch → logged + `null` (silent).**
   - Explicitly map domain fields → `ger_pessoa` columns. Do not `...spread` while domain keys remain.
   - **`telefone` arrives already normalized + validated** (10/11 digits) or absent; the repo derives `id_tipo_contato_pessoa` via `tipoContato(...)`. No blank-string branch needed.
   - Derive `fk_tpo_logradouro` via `tipoLogradouro(endereco.logradouro)`. Null on no match.
   - Include `ger_end_pessoa` only when `endereco` is present; set `fk_municipio = municipioId`, `tp_endereco = 1` (fixed), `fk_distrito = null` (ignored lookup).
   - For `contato_pessoa`: `fk_operadora = null` (ignored lookup).
   - Use `create` for inserted rows (Prisma wires `fk_pessoa` / `id_pessoa`); raw scalar FKs are fine for `fk_cat_pessoa`, `fk_sub_cat_pessoa`, `fk_municipio`, `fk_tpo_logradouro`.
   - **Silent failure in the `catch` (repo owns the execution-failure log):** classify `Prisma.PrismaClientKnownRequestError` (`P2002` duplicate CPF, `P2003` invalid FK), unit/município errors, and any other throw for the **log line only**, log once (with the `service` threaded in from the resolver), then return `null`. Do **not** call `this.throwError` (it re-throws and double-logs). No coded `GraphQLError`, no detail to the caller. See "Error handling and logging (silent failure)."
   - Shape (illustrative — relation field names per post-`db pull` schema):

     ```ts
     // entire body wrapped in try/catch: catch -> classify + logger.error once -> return null
     const unidade = await this.findCreateUnit(unidadeEmpresa);
     if (!unidade || municipioId !== unidade.fk_municipio) {
       logger.error("createProdutor: unidade inválida ou município divergente", { service: meta?.service, unidadeEmpresa });
       return null; // silent failure — caller sees null, no error surfaced
     }
     const id_und_empresa = unidade.id_und_empresa;

     const created = await this.prisma.produtor.create({
       data: {
         ...mapProdutorInput(produtorInput),
         id_und_empresa,
         dt_update_record: new Date(),
         ger_pes_cat_ramo_relacao: {
           create: {
             fk_cat_pessoa: 39,
             id_und_empresa,
             dt_update_record: new Date(),
           },
         },
         sub_categoria_pessoa_relacao: {
           create: {
             fk_sub_cat_pessoa: 1,
             id_und_empresa,
             dt_update_record: new Date(),
           },
         },
         ...(endereco && {
           ger_end_pessoa: {
             create: {
               ...mapEndereco(endereco),
               tp_endereco: 1,
               fk_municipio: municipioId,
               fk_tpo_logradouro: tipoLogradouro(endereco.logradouro),
               fk_distrito: null,
               id_und_empresa,
               dt_update_record: new Date(),
             },
           },
         }),
         ...(telefone && {
           contato_pessoa: {
             create: {
               telefone,
               principal: true,
               id_tipo_contato_pessoa: tipoContato(telefone),
               fk_operadora: null,
               id_und_empresa,
             },
           },
         }),
       },
       select: { id_pessoa_demeter: true },
     });

     return created.id_pessoa_demeter;
     ```

   - Return the new `id_pessoa_demeter` on success; `null` on any failure (silent — logged once in the catch).

4. **GraphQL schema** — add to `src/modules/produtor/produtor.graphql`. `typedefs.ts` merges multiple `type Mutation` blocks across modules:

   ```graphql
   type Mutation {
     createProdutor(input: CreateProdutorInput!): BigInt
   }

   input CreateProdutorInput {
     nome: String!
     cpf: String!
     email: String
     dataNascimento: DateTime
     tpSexo: String
     identidade: String
     unidadeEmpresa: String!
     municipioId: Int!
     telefone: String
     endereco: EnderecoInput
   }

   input EnderecoInput {
     logradouro: String
     numero: String
     complemento: String
     bairro: String
     cep: String
   }
   ```

   Document in the SDL description: the input is non-null, but the **return is nullable** — `null` means the create did not succeed (no detail surfaced; see "Error handling and logging (silent failure)") — and the mutation is **non-idempotent** on duplicate CPF (see "Idempotency / retry contract").

5. **Resolver + Apollo context type** — add a `Mutation` key to `produtorResolver`:
   - **Widen `MyContext` in `src/main.ts`** from `{ token?: string }` to `{ service?: string }` so the resolver sees `context.service` typed. The runtime factory already passes it; only the type lies. (Drop `token` unless a grep finds a current consumer — none today.)
   - Read `service` from the resolver's `context: MyContext` (third argument), **not** `res.locals` (resolvers have no `res`).
   - Log entry per "Error handling and logging (silent failure)" using `context.service`.
   - Normalize/validate via `produtorValidation.ts` helpers (CPF normalize always; lengths/blank are defensive). A failed defensive check is **resolver-owned**: log once and return `null` (the repo is never reached) — no thrown error.
   - Call `produtorRepository.create!(normalized, { service: context.service })` — it returns the new id or `null` and **owns the failure log** for everything from unit-resolution onward.
   - On an `id`, log one success line (`service`, `unidadeEmpresa`, id). On `null`, **do not log again** (the repo already logged the cause) and never surface a code — just return `null`.
   - Return the value straight through: the new id (the `BigInt` scalar serializes) or `null`. Keep thin — no orchestration. `create` is already optional on `Repository<T>` and the extra `meta` param is optional, so the method still satisfies `create?: (input: any) => Promise<any>` — no interface change.

6. **`resolvers.ts` change**: none. `produtorResolver` is already composed.

7. **Município dropdown endpoint** — add `getMunicipiosEmater()` to `src/repositories/EnumPropsRepository.ts` and register the route in `src/routes/enumRoutes.ts`, mirroring `getRegionaisEmater`. **Do not touch `getRegionaisEmater`.**

8. **Update `AGENTS.md`** (a.k.a. `CLAUDE.md`, same file via symlink) in the same change:
   - Note `createProdutor` under the `produtor` aggregate.
   - Note `GET /api/getMunicipiosEmater` under `enumRoutes`.
   - Note the schema grew by the introspected lookup/relation tables.
   - Note the auth `service` claim is **logged, not persisted**, and `createProdutor` is **open to any valid service-token holder** (no per-`service` allowlist).
   - Note the `MyContext` widening (`service?: string`) so future resolvers know the typed shape.

## Prerequisites (external, not code)

- **Write grants for the prod DB user.** Today `db/cafe-app-user-demeter-db.sql` and `db/pnae-app-user.demeter-db.sql` grant only `SELECT`. A create needs `INSERT` (and `USAGE` on sequences) on all five insert-target tables. HMG already has them; build and test against hmg first.
- **Authorization: open to any valid service-token holder.** Today every service-token holder gets full GraphQL access; `createProdutor` follows the same rule — no per-`service` allowlist in the resolver. Auditing happens via the `service` claim in Winston logs (see "Error handling and logging (silent failure)"). Document the open-access decision in the AGENTS.md change in step 8. **Excluding a caller that has access today is a breaking contract change for that caller — not an additive guard.** Only *adding* access for a brand-new caller is additive; restricting an existing one needs the same consumer audit + sign-off as any contract change.
- **Schema parity across environments** (see Schema work step 1).

## Verification

**Live checks (any HMG run, the dropdown endpoint, DB-state assertions) are executed manually by the user** — the agent supplies the procedure and reviews the user-pasted output, and never hits live dev/hmg/prod endpoints (AGENTS.md hard rule). The unit / mapper / validation tests below run locally via `tsx --test`.

User-executed procedure and result checklist: [`docs/create-produtor.hmg-verification.md`](../create-produtor.hmg-verification.md).

- After `db pull` + `generate`: `npx tsc --noEmit`.
- **Repository tests** (`node --import tsx --test src/modules/produtor/repository/ProdutorRepository.test.ts`):
  - Nested-write payload shape: minimal (3 rows), with `endereco` only (4 rows), with `telefone` only (4 rows), full (5 rows). Assert constants **39 / 1** land on the categoria rows, `tp_endereco = 1` on the address row, `fk_distrito = null` and `fk_operadora = null` where applicable.
  - Unit rejection: unknown id, inactive H, non-H, null `fk_municipio`, inactive G parent — each returns `null` (logged) before any insert.
  - **Município mismatch**: `municipioId` not equal to the validated unit's `fk_municipio` returns `null` (logged) before any insert.
  - Silent failure: forced `P2002` (duplicate CPF) and `P2003` (invalid FK) return `null`, log exactly once, and surface no `GraphQLError`/code. These mocked failures verify handling, not a real PostgreSQL rollback; see the HMG runbook for the explicit rollback limitation.
  - Optional children: address-only, phone-only, neither.
- **Mapper tests** (`ProdutorDataMapper.test.ts`, `node --import tsx --test`):
  - Tipo logradouro: `"Rua das Hortas"`→1, `"Av. Brasil"`→2, `"BR-040"`/`"MG 050"`/`"LMG808"`/`"AMG-123"`→4, `"Pç da Sé"`→3, unknown→null. Case-insensitive.
  - Phone: 10-digit landline→type 1, 11-digit mobile→type 3, formatted and `+55` mobile normalize correctly, DDD `55` stays intact; unsupported characters / invalid lengths / `""` are rejected by the normalizer (the create path turns a rejection into a silent `null`, not a surfaced error).
- **Validation tests** (`produtorValidation.test.ts`): CPF (formatted, unformatted, invalid check digits, blank, wrong length), length bounds, blank optionals, `municipioId` positive Int.
- **HMG end-to-end** (port 4100, write grants already exist; **user-executed** — agent provides the procedure and reviews output):
  - **Fixture strategy:** each run generates a CPF from a deterministic test seed + run id to avoid collisions across reruns. Track the inserted `id_pessoa_demeter` for cleanup.
  - **Cleanup:** delete the test `contato_pessoa` row first (NoAction FK), then `DELETE FROM ger_pessoa WHERE id_pessoa_demeter = ?` (Cascade handles the other children).
  - Minimal call (`unidadeEmpresa` + `municipioId` only): 3 rows; assert constants **39 / 1**.
  - Full call (with `endereco` + `telefone`): 5 rows; assert `fk_municipio` equals `input.municipioId` (and matches the validated unit), `tp_endereco = 1`, `fk_distrito = null`, `fk_operadora = null`, derived `fk_tpo_logradouro` and `id_tipo_contato_pessoa` are correct, every row's `id_und_empresa` matches the sent value.
  - Confirm `dt_update_record` set where applicable, `id_sincronismo` DB-generated, a real `id_pessoa_demeter` returned.
- **Endpoint check**: `getMunicipiosEmater` returns only active `H%` rows with valid município and active G parent. Confirm `getRegionaisEmater` is unchanged.
- **Duplicate-CPF**: second create with the same CPF returns `null` (logged once), no surfaced error.
- **Invalid unit**: unknown / inactive / non-H / null-município `unidadeEmpresa` returns `null` (logged) before any insert.
- **Município mismatch**: `unidadeEmpresa` valid but `municipioId` not equal to `unidade.fk_municipio` returns `null` (logged) before any insert.
- **Lookup verification**: run the deployment-time SQL assertion (see "Lookup ID verification") against hmg before enabling writes; record expected `(id, label)` pairs.
- **Logging**: confirm Winston output contains `service`, `unidadeEmpresa`, and `id_pessoa_demeter` on success and **never** contains CPF / phone / address / full payload.

## Out of scope

- Update / delete of produtor (create-only by request).
- Any `/api/*` REST route for produtor create.
- Inserting into lookup tables.
- Downstream app concerns (storing `regionalId` in `concurso_cafe`, the "inscritos" / dashboard filter, UI).
- Wiring a consumer.

## Appendix A: DB introspection notes

The three models initially pasted (`ger_end_pessoa`, `sub_categoria_pessoa`, `contato_pessoa`) do not stand alone. Their relation fields reference tables also missing from `prisma/schema.prisma`. With three lookups **ignored** per the Decisions block (`operadora`, `sep_distrito`, `spa_meta_categoria_municipio`), the cascade simplifies to:

- `ger_end_pessoa` → `sep_tpo_logradouro` (kept; needed for the `fk_tpo_logradouro` derivation). `sep_distrito` is **dropped** — `fk_distrito` stays an `Int?` scalar with no relation.
- `sub_categoria_pessoa` → `ger_cat_pessoa` (kept). `spa_meta_categoria_municipio` is **dropped** — no FK from our INSERT targets even references it transitively.
- `contato_pessoa` → `tipo_contato_pessoa` (kept). `operadora` is **dropped** — `fk_operadora` stays an `Int?` scalar with no relation.
- `sub_categoria_pessoa_relacao` (4th write target, also missing) → `sub_categoria_pessoa`.

One missing lookup still carries a back-relation array into a model already in the live schema, so hand-adding still touches existing models — but the surface is smaller than before:

- `sep_tpo_logradouro` declares `pl_propriedade pl_propriedade[]` → `Propriedade` would need a reciprocal relation field. Today `Propriedade.id_tipo_logradouro` is a plain `Int?` scalar, not a relation.
- `sep_tpo_logradouro` declares `ger_und_empresa ger_und_empresa[]` → `ger_und_empresa` would need a reciprocal field.

(The `sep_distrito ↔ Propriedade` / `sep_distrito ↔ Municipio` reciprocal patches are no longer needed — `sep_distrito` is ignored.)

`db/custom-schema.prisma` (a prior full `db pull`) holds the bodies for all these models but is a **stale snapshot** — it renders `ger_pes_cat_ramo_relacao.fk_pessoa`, `sub_categoria_pessoa_relacao.fk_pessoa`, and `contato_pessoa.id_pessoa` as `Int` / `Int?`, but `Produtor.id_pessoa_demeter` is `BigInt` and the current `prisma/schema.prisma` already carries `ger_pes_cat_ramo_relacao.fk_pessoa` as `BigInt`. A relation whose scalar FK type differs from the referenced PK type fails Prisma validation. The post-`db pull` schema must render these FKs as `BigInt`.
