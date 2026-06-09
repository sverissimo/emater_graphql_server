# Produtor Create Mutation Plan

Add a **create-only** `createProdutor` GraphQL mutation plus the additive `GET /api/getMunicipiosEmater` lookup route needed to populate its unit selector. There is no REST producer-create route, update, or delete. The mutation inserts a `ger_pessoa` (the `Produtor` model) row plus related rows in one nested write, mirroring the existing `AtendimentoRepository.create` pattern.

**Decisions (from the requester):**

- **Surface:** GraphQL for producer creation plus one new read-only REST lookup route. There is no `/api/*` producer-create route. Creation matches the `atendimento` / `perfil` mutation precedent; `GET /api/getMunicipiosEmater` matches the existing enum lookup routes.
- **Write scope:** **three to five rows** per create. `ger_pessoa` + the two fixed categoria rows (`ger_pes_cat_ramo_relacao`, `sub_categoria_pessoa_relacao`) are written on **every** call; only **`endereco` and `telefone` are optional** (a producer with no address/phone is valid).
- **At most ONE address and ONE phone per producer through this gateway.** The DB tables (`ger_end_pessoa`, `contato_pessoa`) are 1:N, but this gateway deliberately accepts only a single address and a single phone. Anyone needing multiple goes through a different interface or writes the DB directly. So the input carries **single values, not arrays**: one optional `endereco: EnderecoInput` object, and `telefone` as a **plain optional scalar** on the root (see next point). No arrays anywhere.
- **`telefone` is a flat scalar, not an object.** Every derivable sub-field collapses, so no `TelefoneInput` is justified: `principal` is always `true` (it's the only phone), `fk_operadora` is always `null` (not collected), and `id_tipo_contato_pessoa` is **derived by the repo from the number**, not entered by the client. So the SDL exposes just `telefone: String` on the root; the repo builds the `contato_pessoa` row from it.
- **Município/unit is chosen client-side from an authoritative dropdown, then validated and resolved server-side by unit id.** `GET /api/getMunicipiosEmater` serves active EMATER local units — `ger_und_empresa` **H rows** — with their municipality and regional metadata. The client sends only `unidadeEmpresa` (`id_und_empresa`). The repository performs one deterministic lookup by that unique id, verifies it is an active H unit with a non-null municipality, and derives `municipioId` from the row. The client cannot submit mismatched unit/municipality ids. There is no fuzzy name matching.
- **The `ger_und_empresa` H/G hierarchy** is confirmed in shipped code (`getRegionaisEmater` in `src/repositories/EnumPropsRepository.ts`; the `ger_und_empresa → ger_und_empresa` self-relation walk in `ProdutorRepository.findMany` and `PropriedadeRepository`): rows whose `id_und_empresa` starts with **`H`** are local units (one per município); rows starting **`G`** are regionais. An H row's `fk_und_empresa` points to its G regional; a G row's `fk_und_empresa` is null. The dropdown endpoint lists H rows and self-joins to G for the regional name (see "Município dropdown endpoint").
- **`EnderecoInput` stays a nested object but holds only street-level fields.** ~6 independent user-filled fields (`tpEndereco`, `logradouro`, `numero`, `complemento`, `bairro`, `cep`); a named sub-object beats prefixing them onto the root. **Município is NOT inside it** — the repository derives it from the top-level `unidadeEmpresa`. `fk_tpo_logradouro` is **derived** (next point), not sent. `fk_distrito` is dropped (the `sep_distrito` table is near-empty — ~10 rows in hmg — not worth a client field; left null).
- **`fk_tpo_logradouro` is derived from the `logradouro` string** by a pure normalize function (see "Tipo logradouro normalization"), not client input — same pattern as the derived contact type. Null when nothing matches (the column is nullable).
- **`fk_cat_pessoa` and `fk_sub_cat_pessoa` are fixed constants, not client input.** Use categoria **64** (`Organização`) and subcategoria **11** (`Agroindústria`). The lookup data associates subcategoria 11 with categoria 64, so this is the internally consistent pair; the earlier `35/11` pair crossed category hierarchies. Define the constants once in the produtor module and write both rows on every create.
- **The mutation returns just the new id (`BigInt!`).** The client already holds the municipality/regional metadata from the dropdown selection, so `createProdutor` need not echo it back — it returns the new `id_pessoa_demeter`. The downstream app persists the regional it already has; that storage is out of scope.
- **Schema source:** `prisma db pull` (introspection), not hand-copied models. See "Schema work" — this is the load-bearing prerequisite.
- **Client-facing contract is a clean, flat domain input — the DB-table mess stays hidden.** The client provides plain producer fields (`nome`, `cpf`, `email`, `dataNascimento`, `telefone`, one optional `endereco { … }`) plus the selected `unidadeEmpresa`. It never sees `ger_*` / `contato_pessoa` / `sep_*` table names, `fk_*` columns, `id_sincronismo`, or the nested layout. The repository validates the selected unit, derives its municipality, explicitly maps domain names to Prisma columns, injects the categoria/subcategoria constants, derives contact type and tipo-logradouro, sets `dt_update_record`, and lets Prisma wire `fk_pessoa`/`id_pessoa`.

## Insert targets vs. lookup tables

Up to five tables receive inserts on a create:

| Table | Prisma model | Relation to `ger_pessoa` | Notes |
| --- | --- | --- | --- |
| `ger_pessoa` | `Produtor` (`@@map("ger_pessoa")`) | — (root) | Already in `prisma/schema.prisma`. PK `id_pessoa_demeter` is `@default(autoincrement())`. |
| `ger_end_pessoa` | `ger_end_pessoa` | `fk_pessoa → id_pessoa_demeter`, `onDelete: Cascade` | **Missing** from schema. Address. |
| `ger_pes_cat_ramo_relacao` | `ger_pes_cat_ramo_relacao` | `fk_pessoa → id_pessoa_demeter`, `onDelete: Cascade` | Already in schema. Categoria/ramo. |
| `sub_categoria_pessoa_relacao` | `sub_categoria_pessoa_relacao` | `fk_pessoa → id_pessoa_demeter`, `onDelete: Cascade` | **Missing** from schema. Subcategoria. |
| `contato_pessoa` | `contato_pessoa` | `id_pessoa → id_pessoa_demeter`, `onDelete: NoAction` | **Missing** from schema. Phone/contact. |

The remaining tables the missing models reference are **lookup / read-only** — the create never inserts into them, it only references their existing rows by FK id:

- `ger_cat_pessoa`, `sub_categoria_pessoa` (categoria/subcategoria dictionaries)
- `sep_tpo_logradouro`, `sep_distrito` (address dictionaries; `sep_municipio` → the existing `Municipio` model)
- `operadora`, `tipo_contato_pessoa` (contact dictionaries)
- `spa_meta_categoria_municipio` (referenced transitively by `ger_cat_pessoa`)

This matches the requester's read of the tables. The plan treats them as lookups: present in the schema so relations validate, never written by `createProdutor`.

## Schema work — the real prerequisite

The three models the requester pasted (`ger_end_pessoa`, `sub_categoria_pessoa`, `contato_pessoa`) do **not** stand alone. Their relation fields reference tables that are themselves absent from `prisma/schema.prisma`, and adding them by hand cascades:

- `ger_end_pessoa` → `sep_tpo_logradouro`, `sep_distrito` (both missing)
- `sub_categoria_pessoa` → `ger_cat_pessoa` (missing) → `spa_meta_categoria_municipio` (missing, a 10th table)
- `contato_pessoa` → `operadora`, `tipo_contato_pessoa` (both missing)
- `sub_categoria_pessoa_relacao` (the 4th write target, **also missing**, body in `db/custom-schema.prisma`) → `sub_categoria_pessoa`

Worse, three of the missing lookups carry **back-relation arrays into models already in the live schema**, so adding them by hand also means editing existing models:

- `sep_tpo_logradouro` and `sep_distrito` both declare `pl_propriedade pl_propriedade[]` → the `Propriedade` model would need reciprocal relation fields. Today `Propriedade.id_distrito` / `id_tipo_logradouro` are **plain `Int?` scalars, not relations**.
- `sep_distrito` declares `sep_municipio sep_municipio?` → the `Municipio` model (`@@map("sep_municipio")`) would need a `sep_distrito[]` back-relation it does not currently have.
- `sep_tpo_logradouro` declares `ger_und_empresa ger_und_empresa[]` → `ger_und_empresa` would need a reciprocal field.

Hand-copying ~10 models and patching reciprocal relations on three existing models is error-prone and drifts from the real DB. **The correct path is introspection**, which the requester already has tooling for (`db/custom-schema.prisma` is a prior full `db pull`, the source of truth for all these bodies):

1. **Wait for the prod DB user's grants** (see prerequisites) so introspection sees the same tables in every environment, then run **`npx prisma db pull`**. This resolves the entire FK graph in one consistent pass — no dangling relations, reciprocal fields generated automatically. **Per AGENTS.md, `db pull` runs only with explicit user instruction and the diff needs human review** — the requester drives the actual command and reviews the diff; this plan does not run it.
2. **Review the introspection diff** against the five insert targets + their lookups. Expect: the missing models added, plus generated back-relation fields on `Produtor` (`ger_end_pessoa[]`, `sub_categoria_pessoa_relacao[]`, `contato_pessoa[]`), `Municipio`, `Propriedade`, and `ger_und_empresa`. None of these are GraphQL-visible, so the published GraphQL contract is untouched.
3. **Hard gate — re-verify FK scalar types against the freshly pulled `schema.prisma`, do not trust `db/custom-schema.prisma` for column types.** That file is a **stale snapshot** and is already known to disagree with the live schema on the parent FK type: it renders `ger_pes_cat_ramo_relacao.fk_pessoa`, `sub_categoria_pessoa_relacao.fk_pessoa`, and `contato_pessoa.id_pessoa` as **`Int` / `Int?`**, but `Produtor.id_pessoa_demeter` is **`BigInt`** and the *current* `prisma/schema.prisma` already carries `ger_pes_cat_ramo_relacao.fk_pessoa` as **`BigInt`**. A relation whose scalar FK type differs from the referenced PK type (`Int` → `BigInt`) **fails Prisma validation**, so the real introspection must render these FKs as `BigInt` to compile. After `db pull`, confirm every `fk_pessoa` / `id_pessoa` on the new child models matches `Produtor.id_pessoa_demeter` (`BigInt`). The nested `create` doesn't set these FKs directly (Prisma wires them), so this is a *schema-validity* check, not a write-payload concern — but a stale `Int` would break `prisma generate` outright.
4. **`npx prisma generate`** to refresh the client in `src/generated/prisma` (allowed by AGENTS.md). Confirm the new delegates exist: `prisma.ger_end_pessoa`, `prisma.sub_categoria_pessoa_relacao`, `prisma.contato_pessoa`, and that the project type-checks (`npx tsc --noEmit`).

> If introspection is not viable when this is built, the fallback is to hand-add every model from `db/custom-schema.prisma` (all ~10, including the reciprocal relation fields on existing models) — but introspection is strongly preferred and is the requester's stated approach. **If hand-adding, fix the `fk_pessoa`/`id_pessoa` types to `BigInt` to match `Produtor.id_pessoa_demeter`** (the snapshot's `Int` will not validate).

## Column handling on insert

`prisma db pull` faithfully renders Postgres `DEFAULT` clauses as `@default(...)`. The rule for what the write must supply (per the requester's #4: ignore nullables, care only about what breaks the INSERT): a column is **must-fill** when it is **required (Prisma type has no `?`) AND has no `@default`**. Everything nullable, defaulted, autoincrement, or set by Prisma's nested write is left alone.

**Must-fill columns per insert target** (required, no `@default`; derived from the introspected bodies — re-confirm post-`db pull`). Split into what the **write must supply internally** (repo-generated, never in the client SDL) vs. what is **derived from client input**:

| Table | Repo supplies (not in SDL) | Derived from client input | Handled automatically (omitted) |
| --- | --- | --- | --- |
| `ger_pessoa` | `dt_update_record` (`new Date()`) | the producer's domain scalars (`nm_pessoa`, `nr_cpf_cnpj`, …) | PK `id_pessoa_demeter` (autoincr); `id_sincronismo` (DB default); `sn_ativo`, `senha` (`@default`) |
| `ger_end_pessoa` *(≤1, optional)* | `dt_update_record`; `fk_pessoa` (nested write); `fk_municipio` (derived from selected unit); `fk_tpo_logradouro` (derived from `logradouro`); `id_und_empresa` | `tp_endereco`, `logradouro`, `numero`, `complemento`, `bairro`, `cep` | PK (autoincr); `id_sincronismo` (DB default); `fk_distrito` left null |
| `ger_pes_cat_ramo_relacao` | `dt_update_record`; `fk_pessoa` (nested write); **`fk_cat_pessoa = 64`** (fixed) | — (no client input) | PK (autoincr); `id_sincronismo` (DB default) |
| `sub_categoria_pessoa_relacao` | `dt_update_record`; `fk_pessoa` (nested write); **`fk_sub_cat_pessoa = 11`** (fixed) | — (no client input) | PK (autoincr); `id_sincronismo` (DB default) |
| `contato_pessoa` *(≤1, optional)* | `id_pessoa` (nested write); `principal = true` (const); `id_tipo_contato_pessoa` (**derived from the number**) | `telefone` (flat scalar) | PK (autoincr); `id_sincronismo` (DB default); `fk_operadora` left null; all other columns nullable |

The two categoria rows (`ger_pes_cat_ramo_relacao` = 64, `sub_categoria_pessoa_relacao` = 11) are written on **every** create with fixed constants — they are not optional and not client-supplied.

`dt_update_record` is **never exposed in the SDL or DTO** — the repo sets it with `new Date()` on the root row and every child row that has the column. (This resolves the earlier ambiguity: the *write* must provide it; the *client* does not.)

Notes on the recurring columns:

- **`dt_update_record`** — required `DateTime @db.Timestamp(6)` with **no `@default`** on all four targets that have the column (`ger_pessoa`, `ger_end_pessoa`, `ger_pes_cat_ramo_relacao`, `sub_categoria_pessoa_relacao`). Postgres rejects an insert that omits it (confirmed: column is `timestamp(6)`, NOT NULL, default `(NULL)`). **The write sets it explicitly** (`new Date()`) on the root row and each such child row. This is the one column where the requester's "Postgres handles it" assumption does **not** hold.
- **`id_sincronismo`** — `@default(dbgenerated("(uuid_generate_v4())::character varying(36)"))` everywhere it exists. **Postgres fills it; the write omits it.** (Confirmed against the live column.)
- **`tp_endereco`** (`ger_end_pessoa`, SmallInt, required, no default) — must come from the caller when an address block is sent. It's an address-type discriminator; the caller supplies it (no lookup needed).
- **`fk_pessoa` / `id_pessoa`** (parent FK on every child) — **set by Prisma's nested `create`**, never by the caller/DTO.
- **`contato_pessoa` has no `dt_update_record`**; its timestamp is `data_atualizacao DateTime?` (nullable, no default), so the mutation leaves it unset. The client provides only `telefone`; the repo supplies `principal`, `id_tipo_contato_pessoa`, `fk_operadora`, and `id_und_empresa`.
- **`id_und_empresa`** — from the required client `unidadeEmpresa` selection, written to every table's `id_und_empresa` column. The repository rejects an unknown, inactive, non-H, or municipality-less unit before the nested write.

> When building, re-confirm this must-fill set against the **post-`db pull` `schema.prisma`** (not just `db/custom-schema.prisma`) in case the introspection differs, and against the live DB the first time a write is tested.

## Município dropdown endpoint (`GET /api/getMunicipiosEmater`)

The client populates a **município select box** from this new endpoint, then sends the chosen `id_und_empresa` as `unidadeEmpresa` into `createProdutor`. The repository resolves `fk_municipio` from that exact unit row. This preserves the unit/municipality pairing even if a caller bypasses the intended UI.

It's a sibling of the existing `getRegionaisEmater` ([`src/repositories/EnumPropsRepository.ts`](../../src/repositories/EnumPropsRepository.ts)), mounted in [`src/routes/enumRoutes.ts`](../../src/routes/enumRoutes.ts) (REST `/api/*` lookup surface — symmetric with how regionais are already served). New method `getMunicipiosEmater()` on `EnumPropsRepository`:

```sql
SELECT h.id_und_empresa, m.nm_municipio AS nome_municipio,
       h.fk_municipio   AS municipio_id, h.fk_und_empresa AS regional_id,
       g.nm_und_empresa AS nome_regional
FROM ger_und_empresa h
JOIN sep_municipio m ON m.id_municipio = h.fk_municipio
JOIN ger_und_empresa g
  ON g.id_und_empresa = h.fk_und_empresa
 AND g.id_und_empresa LIKE 'G%'
WHERE h.id_und_empresa LIKE 'H%'        -- local units = municípios
  AND h.fk_municipio IS NOT NULL        -- exclude units that can't anchor an address
  AND h.sn_ativa = 1                    -- active only
  AND g.sn_ativa = 1                    -- complete, active regional metadata
ORDER BY h.nm_und_empresa;
```

Each row gives the client everything for one option: `id_und_empresa` (the only id sent into the mutation), authoritative `municipio_id` + `nome_municipio` from `sep_municipio`, and non-null `regional_id` + `nome_regional` from the active G parent. `JOIN`, rather than `LEFT JOIN`, keeps incomplete hierarchy rows out of the selector.

**Two data gotchas, both addressed above:**
- **`H%` (starts-with), not `%H%`/`%G%`.** The confirmed convention is H for local units and G for regionals. The existing `getRegionaisEmater` uses `LIKE '%G%'`; **do not change it** because it is a published REST contract. The new endpoint uses the tighter prefix checks.
- **`fk_municipio IS NOT NULL`** filters out H rows with no município (the column is nullable on `ger_und_empresa`), so every selectable option yields a valid `municipioId` — this is what removes the old NOT-NULL-município trap from the create path.

**Deterministic unit validation in the create.** Before writing, query the selected unit by `id_und_empresa` with the same invariants used by the endpoint (`H%`, active, non-null `fk_municipio`, active G parent). No match returns `BAD_REQUEST`. The resolved `fk_municipio` is then used for `ger_end_pessoa` whenever `endereco` is present.

## Tipo logradouro normalization (`fk_tpo_logradouro`)

`fk_tpo_logradouro` is **derived** from the `logradouro` string by a pure, DB-free function — not client input (the column is nullable, so a non-match is fine). Put it in a new module-scoped mapper `src/modules/produtor/ProdutorDataMapper.ts` (matching the existing `UsuarioDataMapper.ts` convention) **alongside the phone-type derivation** — both are "derive a stable lookup id from free text," so they cohere in one file. Returns the `sep_tpo_logradouro.id_tpo_logradouro` or `null`.

The ids are the stable `sep_tpo_logradouro` PKs (from the DB): **1** Rua, **2** Avenida, **3** Praça, **4** Rodovia, **5** Alameda, **6** Beco, **7** Travessa, **8** Sítio.

Rules — **all case-insensitive**:
1. **Full-word prefix**: string starts with a `ds_tpo_logradouro` word → that id (`Rua …`→1, `Avenida …`→2, `Praça …`→3, `Rodovia …`→4, `Alameda`→5, `Beco`→6, `Travessa`→7, `Sítio`/`Sitio`→8).
2. **Abbreviations**: `R.`→1; `Av ` / `Av.`→2; `Rod.`→4; `Pç`→3.
3. **Highway pattern**: `BR`, `MG`, `LMG`, or `AMG` followed by an optional `-`/space/nothing then a digit (`BR-040`, `MG 050`, `LMG808`, `AMG-123`) → 4.
4. **No match → null.**

**Precedence**: test the most specific tokens first so `Av.` and `Avenida` both land on 2; a lone `R`/`A` with no dot must **not** match. Keep the full original string in `ds_logradouro` (`"Rua das Hortas"`), preserving user data; normalization derives only the lookup id.

The repo calls this when building `ger_end_pessoa`: `fk_tpo_logradouro: tipoLogradouro(endereco.logradouro)`.

## Phone normalization and contact type

`telefone` is optional, but when supplied it has a strict wire contract:

1. Accept digits with optional common formatting (`()`, spaces, `-`, leading `+55`). Reject letters and unsupported punctuation rather than silently deleting them.
2. Strip formatting. Strip country code `55` only when the resulting digit string starts with `55` **and has 12 or 13 digits**; a local 10/11-digit number whose DDD is `55` must remain intact.
3. Require exactly **10 or 11 digits including the two-digit DDD**. Anything else returns `BAD_REQUEST`; an invalid supplied phone is not silently omitted.
4. Store only the normalized digits. This fits `contato_pessoa.telefone @db.Char(11)`.
5. The mobility digit is `digits[2]`, the first digit after the DDD. Map `7`, `8`, or `9` to contact type **3** (`Celular`); otherwise map to **1** (`Comercial`).

Keep normalization and type derivation as pure functions in `ProdutorDataMapper.ts`. Add `src/modules/produtor/ProdutorDataMapper.test.ts` using `node:test` + `node:assert/strict`; this repo has no configured test framework, so run it directly with `node --import tsx --test src/modules/produtor/ProdutorDataMapper.test.ts`. Cover 10-digit landline, 11-digit mobile, formatted mobile, `+55` mobile, DDD 55 without country-code stripping, unsupported characters, and invalid lengths.

## Steps (gateway code)

All file paths reflect the **current** per-module layout (repos live in `src/modules/<aggregate>/repository/`, not the central `repositories/prisma/` that AGENTS.md still describes — that doc is stale post-"Reorganização dos repositórios por módulo"; fix it in step 7).

**Contract-safety constraint (per AGENTS.md "Contract stability"):** this whole change must be **purely additive with zero side effects on existing routes or resolvers** — this gateway serves several apps, and a change that perturbs a shipped query/mutation/route is unacceptable, even when the new work itself is "just an addition." Two shared seams in these steps carry that risk and must be treated carefully:
- **`produtorResolver` is an existing resolver object** consumed by `src/schema/resolvers.ts`. Step 4 only **adds** a `Mutation` key — it must not alter the existing `Query` or `Produtor` resolvers, their shapes, or behavior.
- **`ProdutorRepository` is shared** by the existing produtor queries. Step 2 replaces only the unused `create` stub and uses the new `ProdutorDataMapper` helpers; it must not touch `findOne` / `findAll` / `findMany` / `findManyMinimal` / `getUnidadeEmpresa` or any shared base behavior.
The GraphQL schema additions (new `Mutation` + `*Input` types) and the Prisma schema growth (new models + generated back-relations) are likewise additive — no existing field, type, query, route, status code, or scalar serialization changes. New mutation/route names still get a consumer grep before they become published contract (none exists today — confirmed).

1. **DTO** — `src/modules/produtor/dto/CreateProdutorDTO.ts` (new). The **flat domain shape**, not a mirror of the DB tables. The exact root fields are `nome`, `cpf`, `email?`, `dataNascimento?`, `tpSexo?`, `identidade?`, `unidadeEmpresa`, `telefone?`, and `endereco?`, matching the SDL below. **Exclude** PK / internal / default columns (`id_pessoa_demeter`, `id_sincronismo`, `dt_update_record`, `senha`, `auth_token`).
   - `unidadeEmpresa: string` — required selected unit `id_und_empresa` (the H row). The repo validates it and derives its municipality, then writes the same unit id to **every** inserted table's `id_und_empresa`.
   - `telefone?: string` — flat scalar; the repo normalizes it to 10/11 digits and derives `principal = true`, `id_tipo_contato_pessoa`, and `fk_operadora = null`.
   - `endereco?: { tpEndereco; logradouro?; numero?; complemento?; bairro?; cep? }` — street-level only. No municipality field, no `tipoLogradouroId` (derived), and no `fk_*` keys.
   - **No `categorias` / `subcategorias`** — `fk_cat_pessoa = 64` / `fk_sub_cat_pessoa = 11` are fixed constants the repo writes unconditionally.
   Keep the `endereco` sub-type in the same file (single-file use). The repo explicitly maps domain fields to Prisma columns (`nome → nm_pessoa`, `cpf → nr_cpf_cnpj`, etc.); do not spread the domain DTO directly into Prisma data. It validates `unidadeEmpresa`, derives `fk_municipio`, injects the constants, derives contact-type and tipo-logradouro, sets `dt_update_record`, and lets Prisma wire `fk_pessoa`/`id_pessoa`. The repo returns the new `id_pessoa_demeter` (bigint) — no result type needed.

2. **Repository method** — add `create(input: CreateProdutorDTO)` to `src/modules/produtor/repository/ProdutorRepository.ts`, replacing the current stub (`create(input: any) { return "This method is not implemented yet." }`). Mirror `AtendimentoRepository.create`:
   - Destructure `unidadeEmpresa` / `endereco` / `telefone` off the root.
   - Resolve the selected unit before the write with a deterministic query returning `id_und_empresa` and `fk_municipio`, constrained to an active H unit with an active G parent and non-null municipality. No match → `BAD_REQUEST` ("unidade EMATER inválida ou inativa").
   - Explicitly map the remaining domain fields to the `ger_pessoa` column names. Do not use `...gerPessoa` while it still contains domain keys such as `nome`, `cpf`, or `dataNascimento`.
   - Normalize and classify `telefone` according to "Phone normalization and contact type". `principal = true`, `fk_operadora = null`.
   - **Derive `fk_tpo_logradouro`** from `endereco.logradouro` via `tipoLogradouro(...)` (same mapper). Null on no match.
   - **Address:** include `ger_end_pessoa` whenever `endereco` is present; set `fk_municipio` from the validated unit lookup.
   - **`create` vs. `connect`:** use **`create`** for the rows this mutation inserts (root + the two categoria rows + optional `ger_end_pessoa` / `contato_pessoa`); Prisma wires their `fk_pessoa`/`id_pessoa`. For lookup links inside a nested `create` (`tipo_contato_pessoa`, etc.), use **`connect`** with the generated relation field name — **but never both the relation `connect` and the raw scalar FK for the same relation** (Prisma rejects a relation specified twice). For the fixed categoria rows and `fk_municipio`/`fk_tpo_logradouro`, raw scalar FKs are simplest and are used below; switch a given one to `connect` only if `db pull` makes its FK settable solely via the relation field.
   - Shape (illustrative — relation field names per the post-`db pull` schema):
     ```ts
     const unidade = await this.findCreateUnit(unidadeEmpresa);
     const id_und_empresa = unidade.id_und_empresa;
     const normalizedTelefone = telefone
       ? normalizeTelefone(telefone)
       : undefined;

     const created = await this.prisma.produtor.create({
       data: {
         ...mapProdutorInput(produtorInput),
         id_und_empresa,
         dt_update_record: new Date(),
         ger_pes_cat_ramo_relacao: { create: { fk_cat_pessoa: 64, id_und_empresa, dt_update_record: new Date() } },
         sub_categoria_pessoa_relacao: { create: { fk_sub_cat_pessoa: 11, id_und_empresa, dt_update_record: new Date() } },
         ...(endereco && {
           ger_end_pessoa: { create: {
             ...mapEndereco(endereco),                       // tp_endereco, ds_logradouro, nr_logradouro, …
             fk_municipio: unidade.fk_municipio,
             fk_tpo_logradouro: tipoLogradouro(endereco.logradouro),
             id_und_empresa,
             dt_update_record: new Date(),
           } },
         }),
         ...(normalizedTelefone && {
           contato_pessoa: { create: {
             telefone: normalizedTelefone,
             principal: true,
             id_tipo_contato_pessoa: tipoContato(normalizedTelefone),
             id_und_empresa,
           } },
         }),
       },
       select: { id_pessoa_demeter: true },
     });

     return created.id_pessoa_demeter;
     ```
     The two categoria rows are **unconditional**; `endereco` / `telefone` are spread in only when present.
   - `dt_update_record` is set on the root and on every child that has the column (`ger_end_pessoa`, `ger_pes_cat_ramo_relacao`, `sub_categoria_pessoa_relacao`; **not** `contato_pessoa`, which has none).
   - **Return the new `id_pessoa_demeter`** (the `BigInt` scalar serializes it to a string on the wire). The client already has the unit/regional ids from the dropdown.
   - **Mutation-local Prisma translation:** the shared `ErrorHandlerImpl` currently turns known Prisma errors into plain `Error`, so do not claim it already provides coded GraphQL errors. In this `create` catch, detect `Prisma.PrismaClientKnownRequestError` before calling `this.throwError`: map `P2002` (duplicate CPF/unique constraint) and `P2003` (invalid FK) to a custom `{ message, code: "BAD_REQUEST" }`, then call `this.throwError(customError)`. Unknown errors continue through `this.throwError(error)`. This preserves existing resolver behavior while giving the new mutation a stable coded error contract. Do **not** add a `console.log` line.

3. **GraphQL schema** — add a `Mutation` block + input types to `src/modules/produtor/produtor.graphql`. `typedefs.ts` merges multiple `type Mutation` blocks across modules, so a new block here is safe. The SDL is the **flat domain contract** — no `fk_*`, no table names, no sync columns:
   ```graphql
   type Mutation {
     createProdutor(input: CreateProdutorInput!): BigInt!
   }

   input CreateProdutorInput {
     nome: String!
     cpf: String!
     email: String
     dataNascimento: DateTime
     tpSexo: String
     identidade: String
     unidadeEmpresa: String!     # selected unit id; repo validates and derives município
     telefone: String            # flat scalar; repo derives principal/tipo/operadora
     endereco: EnderecoInput     # at most one; street-level only
     # No categorias/subcategorias — fixed constants (64/11) written by the repo.
   }

   input EnderecoInput {
     tpEndereco: Int!
     logradouro: String          # repo derives fk_tpo_logradouro from this
     numero: String
     complemento: String
     bairro: String
     cep: String
   }
   ```
   No `TelefoneInput` (telefone is a root scalar) and no município/tipoLogradouro fields in `EnderecoInput` (derived). `unidadeEmpresa` is the only location token accepted by the mutation; the repo derives its municipality. This SDL is the complete input field set; do not add DB/internal fields.

   **Returns `BigInt!`** (the new `id_pessoa_demeter`). No result object — the client already holds the selected option's municipality/regional metadata, so there is nothing extra to surface.

   **Nullability — recommend `input: CreateProdutorInput!` and `BigInt!` (both non-null).** Stricter, clearer for a new contract; the id always exists on success (errors surface as GraphQL errors, not `null`). **Caveat:** existing mutations use **nullable** input/returns (`createAtendimento(input: CreateAtendimentoInput): BigInt`). If you prefer SDL consistency, make `input` nullable and have the resolver guard `!input`. **Additive only** — do not touch the existing `Produtor` type or queries.

4. **Resolver** — add a `Mutation` key to `produtorResolver` in `src/modules/produtor/produtorResolver.ts` (it currently has only `Query` and `Produtor`):
   ```ts
   Mutation: {
     createProdutor: (_root: any, { input }: { input: CreateProdutorDTO }) =>
       produtorRepository.create!(input),
   },
   ```
   Keep the resolver thin — no orchestration; it returns the repo's new `id_pessoa_demeter` straight through (the `BigInt` scalar serializes it). (`create` is already optional on the `Repository<T>` interface, so no interface change is needed; the `!` matches existing call sites like `findMany!`.)

5. **No `resolvers.ts` change** — `produtorResolver` is already composed in `src/schema/resolvers.ts`; adding a `Mutation` key to the returned object is picked up automatically.

6. **Município dropdown endpoint** (`GET /api/getMunicipiosEmater`) — separate from the mutation but part of this feature (the client needs it to populate the select box). Add `getMunicipiosEmater()` to `src/repositories/EnumPropsRepository.ts` (the `$queryRaw` from "Município dropdown endpoint") and register the route in `src/routes/enumRoutes.ts`, mirroring the existing `getRegionaisEmater` handler exactly (no auth changes — the `/api/*` service-token middleware already covers it). Returns the H-row list with `nome_regional` joined. **New route = contract-safe** (additive), but grep `/home/apps/*` + `/home/pnae/*` for the name first to confirm no collision; **do not touch `getRegionaisEmater`**.

7. **Update `AGENTS.md`** (a.k.a. `CLAUDE.md`, same file via symlink) in the same change:
   - Note the new `createProdutor` mutation under the `produtor` aggregate.
   - Note the new `GET /api/getMunicipiosEmater` route under the `enumRoutes` description.
   - Correct the stale repository-location description (repos are under `src/modules/<aggregate>/repository/`, not `repositories/prisma/`).
   - Note the schema grew by the introspected lookup/relation tables.

## Prerequisites (external, not code)

- **Write grants for the prod DB user.** Today `db/cafe-app-user-demeter-db.sql` and `db/pnae-app-user.demeter-db.sql` grant only `SELECT` on `ger_pessoa` / `ger_pes_cat_ramo_relacao` etc. A create needs `INSERT` (and `USAGE` on the sequences behind the `autoincrement()` PKs) on all five insert-target tables for whichever DB role this gateway uses per environment. The requester noted prod-user perms are imminent; **hmg/staging already has them**, so the mutation can be built and tested against hmg first. This is a hard runtime prerequisite independent of the schema/code work — without it the write fails with a Postgres permission error at runtime even though the code is correct.
- **Schema parity across environments.** Run `db pull` only once the prod grants land, so introspection sees the same table set everywhere and the committed `schema.prisma` is valid against all three DBs.

## Verification

- After `db pull` + `generate`: `npx tsc --noEmit` (type-check only — **never** `npm run build`) to confirm the new client delegates and DTO types line up.
- Exercise `createProdutor` against the **hmg** environment (port 4100) where write grants already exist:
  - **Minimal call** (`unidadeEmpresa`, no `endereco`, no `telefone`) — still writes **three** rows: `ger_pessoa` + the two fixed categoria rows. Assert all three land: `ger_pes_cat_ramo_relacao` with `fk_cat_pessoa = 64` and `sub_categoria_pessoa_relacao` with `fk_sub_cat_pessoa = 11`, both linked to the new `fk_pessoa`.
  - **Full call** (`unidadeEmpresa` from the dropdown, `endereco` + `telefone`) — writes all five rows; assert `contato_pessoa` has normalized digits, `principal = true`, and the derived `id_tipo_contato_pessoa`; `ger_end_pessoa` has the selected unit's `fk_municipio` and the derived `fk_tpo_logradouro`; every row's `id_und_empresa` equals the sent `unidadeEmpresa`.
  - In both, confirm a real `id_pessoa_demeter` comes back and every inserted row has a populated `dt_update_record` (where the column exists) and a DB-generated `id_sincronismo`.
- Confirm the **`getMunicipiosEmater` endpoint**: returns only active `H%` rows with a valid municipality and active G parent; each row carries authoritative `nome_municipio`, `municipio_id`, `regional_id`, and `nome_regional`. Confirm `getRegionaisEmater` is **unchanged**.
- Confirm the **address** writes whenever `endereco` is present: `ger_end_pessoa.fk_municipio` equals the municipality resolved from the selected unit.
- In `ProdutorDataMapper.test.ts`, confirm tipo-logradouro derivation: `"Rua das Hortas"`→1, `"Av. Brasil"`→2, `"BR-040"`/`"MG 050"`/`"LMG808"`/`"AMG-123"`→4, `"Pç da Sé"`→3, unknown→null; all case-insensitive.
- Run `node --import tsx --test src/modules/produtor/ProdutorDataMapper.test.ts`. Confirm 10-digit landline→type 1, 11-digit mobile→type 3, formatted and `+55` mobile normalize correctly, DDD 55 remains intact, and unsupported characters/invalid lengths→`BAD_REQUEST`.
- Confirm the unique-CPF path: creating two producers with the same CPF returns a `GraphQLError` with `extensions.code = BAD_REQUEST`, not a plain error.
- Confirm an unknown, inactive, non-H, or municipality-less `unidadeEmpresa` returns `BAD_REQUEST` before any insert.
- Confirm a forced nested FK failure returns a `GraphQLError` with `extensions.code = BAD_REQUEST`, exercising the mutation-local `P2003` translation.

## Out of scope

- Update / delete of produtor (create-only by request).
- Any `/api/*` REST route for produtor create.
- Inserting into the lookup tables (`ger_cat_pessoa`, `sub_categoria_pessoa`, `sep_*`, `operadora`, `tipo_contato_pessoa`, `spa_meta_categoria_municipio`, `ger_und_empresa`) — read-only here (`ger_und_empresa` is queried by `getMunicipiosEmater` for the dropdown, never written).
- **Downstream app concerns** — storing `regionalId` in the `concurso_cafe` inscrição table, the "inscritos"/dashboard regional filter, and any UI. The gateway only *serves* the município/regional list (via `getMunicipiosEmater`) so the client can persist what it selected; how it does so is out of scope.
- Wiring a consumer. (The `concurso_cafe` app now models producers that don't yet exist in Demeter, `idPessoaDemeter: null` — a plausible future caller — but no consumer is connected to this mutation today.)
