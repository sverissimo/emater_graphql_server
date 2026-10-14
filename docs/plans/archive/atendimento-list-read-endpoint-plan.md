# Manually-created Relatórios List (atendimento-sourced metadata)

Expose a **paginated list** over `at_atendimento` (the ~2M-row core table) joined to producer
(`ger_pessoa`), property (`pl_propriedade`), and user (`usuario`) data, so the PNAE backend can
fill a table of **by-hand relatórios**. It's a list only — there is no detail query (see
"No detail query" below).

**No code yet — this is the design.** The whole plan is shaped by a single hard constraint:
**we cannot create indexes** (we don't own the Demeter schema), so the design must ride only
the indexes that already exist.

## Domain context (why this is awkwardly named)

The data pipe speaks **atendimento**; the consumer's boundary speaks **relatório manual**. They are
not the same word by accident — here's the gap:

- Every action a tecnico performs is recorded in the company-wide **atendimento** record, which
  lives in the external **Demeter** DB (reached via this gql_server + the legacy REST API), not in
  PNAE's own Postgres.
- A PNAE **relatório** is a specific document. When one is created *through PNAE* (backend+web or
  mobile), a matching atendimento is created alongside it.
- Many tecnicos don't use PNAE at all: they write the relatório **by hand**, photograph it, upload
  the picture to Demeter, and create the atendimento there manually.
- So what this feature surfaces are, in business terms, **relatórios made by hand** — but the only
  handle we have on them is their **atendimento metadata** in Demeter. We fetch through the
  atendimento domain because that's where the data lives; the uploaded artifact itself is a
  relatório (a picture). Upstream modeling is messy and we can't fix it here — we just name each
  layer honestly: **the gql_server query is atendimento-domain; the PNAE REST boundary is
  relatório-manual-domain.**
- The future PNAE frontend uses this list to fill a table of by-hand relatórios. Clicking a row
  **downloads the file**, and that download is already handled by the existing
  `GET /atendimento/getArquivos` — so there is no detail query here.

> **RESOLVED — yes, the list is filtered to manual relatórios.** The filter is confirmed (tested
> against the DB) and **baked into the query server-side** (see "The filter"):
> ```sql
> WHERE atend.link_pdf IS NULL              -- created outside the PNAE app (no app-generated PDF)
>   AND <atendimento has an at_atendimento_indicador row with id_at_indicador = 4550>
> ```
> This narrows ~2M atendimentos to **~100k** (≈5%). Because the list is genuinely filtered, the
> "manual" naming is honest — see "Surface". The filter reaches a new table (`at_atendimento_indicador`)
> but, as the index analysis below shows, the membership test is index-backed, so it does **not**
> break keyset pagination the way an unindexed column filter would.

## The one constraint that decides everything: existing indexes

From [prisma/schema.prisma](../../prisma/schema.prisma):

| Table | Indexed columns | Role in our joins / filter |
|---|---|---|
| `at_atendimento` | PK `id_at_atendimento`, `@@index(id_at_anterior)` | ✅ PK is the pagination key; `link_pdf` filter is an **unindexed heap filter** |
| `at_atendimento_indicador` | **composite UNIQUE `(id_at_atendimento, id_at_indicador)`** (`ix_at_atendimento_indicador`) | ✅ the indicator membership test probes **both** columns → index-backed (see "The filter") |
| `at_atendimento_usuario` | **composite PK `(id_at_atendimento, id_usuario)`** | ✅ leading col is `id_at_atendimento` → join is index-backed |
| `at_cli_atend_prop` | PK `id_at_cli_atend_prop` **only** | ❌ **`id_at_atendimento` is NOT indexed** |
| `ger_pessoa` (Produtor) | PK `id_pessoa_demeter`, +`nm_pessoa`, +`nr_cpf_cnpj` | ✅ joined on its PK |
| `pl_propriedade` | PK `id_pl_propriedade` | ✅ joined on its PK |
| `usuario` | PK `id_usuario` | ✅ joined on its PK |

**The entire performance story is one table: `at_cli_atend_prop`.** Every other hop lands on an
indexed PK (or the leading column of a composite index). `at_cli_atend_prop` is the *only* place we
filter by `id_at_atendimento`, and that column is unindexed — so fetching producer/property for a
set of atendimentos forces a **sequential scan of `at_cli_atend_prop`**. Everything downstream
(`ger_pessoa`, `pl_propriedade`) is then cheap because we join on their PKs.

> **Verify before building.** The plan hinges on the index list above being real. Run, read-only:
> ```sql
> SELECT tablename, indexname, indexdef FROM pg_indexes
> WHERE tablename IN ('at_atendimento','at_atendimento_indicador','at_cli_atend_prop',
>                     'at_atendimento_usuario','ger_pessoa','pl_propriedade','usuario');
> ```
> And `EXPLAIN (ANALYZE, BUFFERS)` the **filtered keyset query** ("The filter") and the child query
> in §3 against real data before committing — the filter's query plan is the main thing to confirm.

## Columns to return

- **`at_atendimento`:** `id_at_atendimento`; all `data_*` →
  `data_inicio_atendimento`, `data_fim_atendimento`, `data_validacao`, `data_atualizacao`,
  `data_criacao`, `data_sei`, `data_see`; all `sn_*` → `sn_pendencia`, `sn_validado`;
  plus `dt_update_record`, `id_at_anterior`, `id_und_empresa`, `ativo`.
  (If exposed via GraphQL, remember `sn_validacao` is the deprecated alias of `sn_validado` —
  keep both per the contract rule in AGENTS.md.)
- **Produtor (`ger_pessoa`)** via `at_cli_atend_prop.id_pessoa_demeter`:
  `nm_pessoa`, `nr_cpf_cnpj`, `dap`, `caf`.
- **Propriedade (`pl_propriedade`)** via `at_cli_atend_prop.id_pl_propriedade`:
  `nome_propriedade`, `geo_ponto_texto`.
- **Usuário (`usuario`)** via `at_atendimento_usuario.id_usuario`:
  `id_usuario`, `nome_usuario`, `id_und_empresa`.

Note the fan-out: an atendimento can have **multiple** `at_cli_atend_prop` rows *and* multiple
users. A flat 3-way join multiplies rows (clients × users) and needs dedup — so children are
loaded as **separate batched queries**, never one flat join (see §3).

## The filter — what makes an atendimento a "manual relatório"

The list is **not** all atendimentos. Two confirmed conditions (tested against the DB) define the
set, and the query bakes them in **server-side** — the consumer never sends them:

```sql
WHERE atend.link_pdf IS NULL          -- (1) created outside the PNAE app (no app-generated PDF)
  AND EXISTS (                         -- (2) tagged with the relatório-manual indicator
        SELECT 1 FROM at_atendimento_indicador ai
        WHERE ai.id_at_atendimento = atend.id_at_atendimento
          AND ai.id_at_indicador  = 4550
      )
```

Together these cut ~2M rows to **~100k (≈5%)**.

**Two things make this efficient — and one to watch:**

- **The indicator test is index-backed.** `id_at_indicador` lives directly on
  `at_atendimento_indicador` (no need to join `at_indicador` at all — the join in the tested SQL was
  only to inspect `id_at_produto`, which we don't return). The `EXISTS` probes
  `(id_at_atendimento = atend.id, id_at_indicador = 4550)` — **both** columns of the composite
  unique index `ix_at_atendimento_indicador` — so it's a point index lookup per candidate row, not a
  scan. Express it as an `EXISTS`/correlated test, **not** a flat join (a join to a 1:N table would
  fan out and need dedup).
- **`link_pdf IS NULL` is an unindexed heap filter** — but it's just a per-row column check applied
  during the at_atendimento PK scan, not a separate scan, so it's cheap.
- **Watch:** because only ~5% of rows match, a keyset page of `N` scans on average `~N / 0.05 ≈ 20·N`
  atendimento rows to fill itself (each surviving the `link_pdf` check, then probing the indicator
  index). At the default pageSize 200, that's ~4k PK-index rows + ~4k index probes per page — fine, but it grows
  if matches thin out in older id ranges. **`EXPLAIN (ANALYZE, BUFFERS)` the first page and a deep
  page** to confirm the planner picks the correlated/nested-loop semi-join (uses the composite
  index) rather than seq-scanning `at_atendimento_indicador`.

**`4550` is a magic constant — name it.** Put it in an atendimento constants file
(e.g. `RELATORIO_MANUAL_INDICADOR_ID = 4550n`, BigInt) with a one-line comment on what it means, the
same way `produtorConstants` holds the fixed categoria ids. Don't inline the literal in the repo.

### Query strategy: raw keyset, Prisma children (a deliberate two-step)

This is the single most performance-sensitive query in the service, its plan is plan-sensitive (the
`ORDER BY id DESC` + `LIMIT` early-termination is what turns 9s into ~80ms), and we already have the
exact tuned SQL working. So **the filtered keyset query is written as `$queryRaw` from the start** —
not as a Prisma `findMany` with a `some` relation filter whose generated SQL we can't fully control.
This isn't a "fallback"; it's the primary design, and it matches repo precedent (`EnumPropsRepository`
already uses `$queryRaw` for `getMunicipiosEmater`/`getRegionaisEmater`).

The two steps, each with one definite implementation (no branching):

1. **Step 1 — raw `$queryRaw` keyset page (the hard part):** the filter (`link_pdf IS NULL` + the
   correlated `EXISTS` on `at_atendimento_indicador`) + `ORDER BY id_at_atendimento DESC` +
   `LIMIT pageSize + 1`. Returns the page's `id_at_atendimento` list; compute `hasMore`/`nextCursor`
   here. We control the plan, so the composite-index `EXISTS` and the early-termination `LIMIT` are
   guaranteed.
2. **Step 2 — Prisma load-by-ids (the easy part):** `prisma.at_atendimento.findMany({ where:
   { id_at_atendimento: { in: pageIds } }, orderBy: { id_at_atendimento: "desc" }, select: { …cols…,
   at_cli_atend_prop: {…}, at_atendimento_usuario: {…} } })`. This is essentially the existing
   `AtendimentoRepository.findMany(ids, info)` pattern — Prisma's nested `select` does the
   fan-out/stitching for the children, so **clientes/usuarios stay Prisma-handled** and we write no
   manual join-stitching. The §3 child-loading cost (one `at_cli_atend_prop` seq scan per page) is
   unchanged.

The filter lives **only** in Step 1's raw SQL; Step 2 just hydrates the children for ids already
chosen. (The §1/§3 Prisma snippets below illustrate the *child* selection shape — not a single
combined `findMany` with the filter baked in.)

## Surface: GraphQL only, one new query

**Decision: GraphQL only — no REST fallback.** One new query added to the atendimento module's
`type Query` block, next to the existing `findAll`/`findOne`/`findMany` reads. Rationale: the
atendimento read surface is already GraphQL; the consumer (PNAE backend) is a GraphQL client; and
field selection via the existing `getRequestedFields`/`isFieldRequested` plumbing makes the
expensive `at_cli_atend_prop` join run only when a consumer actually requests producer/property
fields. The `/api/*` REST surface is intentionally not used for this.

> **⚠️ Naming collision — the new query MUST NOT be named `atendimentos` or `atendimento`.** Those
> field names are **already taken** in [atendimento.graphql](../../src/modules/atendimento/atendimento.graphql):
> `atendimentos(ids: [BigInt])` backs `findMany` (the `/relatorios/all` hot path) and
> `atendimento(id: BigInt)` backs `findOne` (used widely, incl. auth scope resolution). A GraphQL
> schema can't have two fields with the same name — reusing either breaks existing consumers (a hard
> contract violation per AGENTS.md). The new query needs a **distinct** name.
>
> **Name:** `atendimentosComRelatorioManual(pageSize: Int = 200, cursor: BigInt, id_usuario: BigInt, id_reg_empresa: String): AtendimentoPage!`
> — now that the manual filter is **confirmed and baked in server-side** ("The filter"), the query
> genuinely returns atendimentos that have a manual relatório. `ComRelatorioManual` is more precise
> than `Manuais`: the atendimento row itself is not manual; the attached/tagged relatório is. This is
> collision-free with the existing `atendimentos`/`atendimento`, and it aligns with PNAE's downstream
> route `GET /atendimento/com-relatorio-manual` without turning this gateway query into a REST-shaped
> endpoint.

## Architecture: one list query

The single query keeps the high-traffic path on indexed columns:

- **LIST** (`atendimentosComRelatorioManual(pageSize, cursor, id_usuario, id_reg_empresa)`) — keyset (cursor)
  pagination over `at_atendimento` with the manual filter ("The filter") applied, plus batched child
  loads. Never a flat join, never OFFSET.

### No detail query

A per-atendimento detail query is **intentionally out of scope.** In the consumer flow, clicking a
row downloads the relatório file, which is already served by the existing `GET /atendimento/getArquivos`.
The list carries all the metadata the table needs, so there is nothing left for a detail call to
fetch — adding an `atendimento(id)`-style query would only duplicate `getArquivos` under a
confusing name.

### Pagination contract (page size + ordering)

- **`pageSize` is client-provided, clamped to `[1, 1000]` at the GraphQL resolver boundary**,
  default 200 (matching the expected frontend table page size). Values below 1 become 1; values
  above 1000 become 1000.
  Do not add a separate error path for oversize pages — the clamp is the contract, and it prevents
  any unbounded page over a 2M-row table.
- **Order by `id_at_atendimento DESC` (most recent first).** This is deliberately *not*
  `data_inicio_atendimento`:
  - `id_at_atendimento` is the PK → keyset stays a bounded **index** range scan.
    `data_inicio_atendimento` is **unindexed** → ordering by it forces a full sort of ~2M rows per
    page (and we can't add the index).
  - The PK is **unique + monotonic** → the cursor is unambiguous. `data_inicio_atendimento` is
    `@db.Date` (day granularity) with many ties → would need a tiebreaker to avoid skipping/dupes
    across page boundaries.
  - Autoincrement PK ⇒ higher id ≈ more recently created — a clean "most recent" proxy.
  - *Caveat:* this is **creation order, not business-date order**. A backdated atendimento (old
    `data_inicio`, inserted today) sorts to the top by id. There's no performant alternative
    without an index on `data_inicio`, and "most recently entered" is the intended behavior here.
- **`hasMore`/`nextCursor`:** fetch `pageSize + 1` rows; if the extra row comes back, `hasMore = true`
  and you drop it; `nextCursor` = `id_at_atendimento` of the last *kept* row (the cursor for the
  next page), else `null`.
- **Empty pages:** return `{ items: [], pageSize: <effective clamped pageSize>, nextCursor: null,
  hasMore: false }`. No error for "past the end"; cursors are opaque page tokens, not existence
  assertions.

### 1. Keyset pagination, not OFFSET

OFFSET degrades linearly on 2M rows (`OFFSET 1000000` scans and discards a million rows every
request). Keyset on the PK is constant-time at any depth — a bounded index range scan.

**Step 1 — raw `$queryRaw`, returns just the page's ids** (Step 2 hydrates them; see "Query
strategy"). Selecting only `id_at_atendimento` keeps the division clean — no merge of raw scalars
with Prisma children:

```sql
-- page 1: pass ATENDIMENTO_KEYSET_START_CURSOR = 9223372036854775807
-- later pages: pass the last id seen as :cursor
SELECT atend.id_at_atendimento
FROM at_atendimento atend
WHERE atend.link_pdf IS NULL                 -- manual filter (1)
  AND EXISTS ( SELECT 1 FROM at_atendimento_indicador ai      -- manual filter (2), index-backed
               WHERE ai.id_at_atendimento = atend.id_at_atendimento
                 AND ai.id_at_indicador = $1 )                 -- RELATORIO_MANUAL_INDICADOR_ID (4550)
  AND atend.id_at_atendimento < $2           -- always present; sentinel cursor covers page 1
  AND <trusted backend scope filter>          -- optional id_usuario/id_reg_empresa; see below
ORDER BY atend.id_at_atendimento DESC
LIMIT $3;                                     -- pageSize+1 to compute hasMore; pageSize clamped [1,1000]
```

Bind `4550` via the named constant `RELATORIO_MANUAL_INDICADOR_ID` (not inlined), `cursor` and the
`pageSize+1` limit as parameters (Prisma's tagged `$queryRaw` parameterizes them). `$queryRaw` returns
`id_at_atendimento` as `bigint`; use it directly for Step 2's `in: [...]`. Constant-time keyset is
preserved per *matching* row; the filter adds the ~20× scan amplification discussed in "The filter"
(the `ORDER BY … DESC` + `LIMIT` early-termination is what keeps it ~80ms — verify with `EXPLAIN`).
Use a named `ATENDIMENTO_KEYSET_START_CURSOR = 9223372036854775807n` for the first page so the SQL
shape stays static and index-friendly; no conditional `$queryRaw` string assembly is needed just to
omit the cursor predicate.

### 1b. Trusted backend scope filter

The PNAE backend is a trusted service-token caller and already authenticates/authorizes the real web
user. It passes the user's scope as optional query args:

- `id_usuario` — the tecnico/user id. When present, include atendimentos where
  `at_atendimento_usuario` has that user.
- `id_reg_empresa` — the regional unit id (`G…`). When present, include atendimentos whose
  `at_atendimento.id_und_empresa` is that regional itself or a local unit (`H…`) whose
  `ger_und_empresa.fk_und_empresa` points at that regional.

The scope predicate is applied in Step 1 **before** `ORDER BY … LIMIT`, not as a TypeScript
post-filter, so cursor pages remain full and stable. If both args are omitted, the query is unscoped
(admin/developer path). If both are present, they are OR'ed (coordenador regional sees regional work
plus their own work). If only `id_usuario` is present, the list is owner-only (staff path).

**Demeter unit hierarchy (messy but load-bearing).** `ger_und_empresa` stores both levels in the same
table. The practical discriminator is the **`id_und_empresa` prefix**, not FK nullability:

- `G%` rows are regional units (around 40).
- `H%` rows are local units / municípios (around 850).
- A local `H%` row's `fk_und_empresa` points to its parent regional `G%` row's `id_und_empresa`.
- Regional `G%` rows normally have `fk_und_empresa = null`, but there is at least one bad Demeter row,
  so do **not** use `fk_und_empresa IS NULL` as the regional test.
- `at_atendimento.id_und_empresa` is expected to be the local `H%` unit. Including the `G` row itself
  in the expansion is defensive and harmless, but the PNAE `id_reg_empresa` scope must be the user's
  regional `G%` id.

This is not new modeling for this endpoint; it mirrors existing repo idioms:
[PropriedadeRepository](../../src/modules/propriedade/repository/PropriedadeRepository.ts) walks the
Prisma self-relation from local unit to parent regional, and `EnumPropsRepository.getMunicipiosEmater`
uses the raw H→G self-join that feeds downstream regional/municipio lookups.

**Regional is a correlated `EXISTS`, not an explicit id list — deliberate, until the index exists.**
The scope predicate is composed with `Prisma.sql` (`buildScopeClause`): no branch → `Prisma.empty`;
owner → `EXISTS(at_atendimento_usuario …)`; regional → `EXISTS(ger_und_empresa und_scope WHERE
und_scope.id_und_empresa = atend.id_und_empresa AND (und_scope.id_und_empresa = :G OR
und_scope.fk_und_empresa = :G))`; both → the two OR'd.

We **tried** the "tidier" form — pre-resolve the regional to its `H%` units (a `Step 0` query) and
filter `atend.id_und_empresa IN (:units)` — and `EXPLAIN` showed it is a **regression** while
`at_atendimento(id_und_empresa)` is unindexed: the planner reads the concrete `IN` list as selective,
**abandons the keyset backward scan for a full `Seq Scan` of all ~2.2M rows + `Sort`** (≈8s), instead
of the indicator-led merge the correlated `EXISTS` gets (≈0.5–3s). So the correlated `EXISTS` is the
right form *today*; the `IN`-list form becomes correct **only after** the DBA index lands (a
correlated `EXISTS` can't use such an index; the explicit list can).

> **Perf — measured (busy PG 9.6; wall time is volatile, so read the *work* — rows/buffers — not ms).**
> `EXPLAIN (ANALYZE, BUFFERS)`:
> - **Unscoped first page:** ~99ms, ~1.3k rows scanned, indicator `EXISTS` index-backed. ✅
> - **Owner-only (sparse user):** ~222ms cold. Planner leads from `at_atendimento_usuario` and
>   **full-scans the composite PK** because `id_usuario` is its non-leading column. Bounded by index
>   size; acceptable, faster warm.
> - **Regional (correlated `EXISTS`):** ~0.5–3.0s (load-sensitive), indicator-led merge scanning
>   ~24k `at_atendimento` rows because **`at_atendimento.id_und_empresa` is unindexed**. ⚠️ gate it.
> - **Regional (`IN`-list, rejected):** ~8s — full `Seq Scan` + `Sort`. Do **not** ship this form
>   without the index.
>
> **DBA ask (we can't create indexes):** an index on **`at_atendimento(id_und_empresa, id_at_atendimento)`**
> turns the regional path into a per-unit keyset range-scan (fast *and* load-stable, like unscoped) —
> **and** at that point switch the regional branch back to the `IN`-list form so it can use the index.
> A plain `at_atendimento_usuario(id_usuario)` index does the same for owner-only. Re-run all four
> `EXPLAIN`s after the index lands.

Performance caveat: sparse `id_usuario` scopes are the risky case. `at_atendimento_usuario` has a
composite PK on `(id_at_atendimento, id_usuario)`, so the owner check is a cheap point probe for each
candidate atendimento, but the database cannot lead from "all rows for this user" without a standalone
`id_usuario` index. A tecnico with few/old manual relatórios may force a much larger backwards scan of
`at_atendimento` to fill one page. Before rollout, run `EXPLAIN (ANALYZE, BUFFERS)` for a sparse staff
user on the first page and a deep page, not only for coordinator/admin scopes.

### 2. Load children in ONE batched query per page

After the page ids are selected, fetch each child set with a single `= ANY(:ids)` — **one** seq scan of
`at_cli_atend_prop` for the whole page, not one per row, then PK joins downstream:

```sql
-- producer + property: one seq scan of at_cli_atend_prop, then PK joins (cheap)
SELECT cap.id_at_atendimento,
       p.nm_pessoa, p.nr_cpf_cnpj, p.dap, p.caf,
       prop.nome_propriedade, prop.geo_ponto_texto
FROM at_cli_atend_prop cap
JOIN ger_pessoa      p    ON p.id_pessoa_demeter  = cap.id_pessoa_demeter
LEFT JOIN pl_propriedade prop ON prop.id_pl_propriedade = cap.id_pl_propriedade
WHERE cap.id_at_atendimento = ANY(:ids);

-- users: index-backed via the composite PK, very cheap
SELECT au.id_at_atendimento, u.id_usuario, u.nome_usuario, u.id_und_empresa
FROM at_atendimento_usuario au
JOIN usuario u ON u.id_usuario = au.id_usuario
WHERE au.id_at_atendimento = ANY(:ids);
```

This SQL shows the batched-load *concept* and its cost (one `at_cli_atend_prop` seq scan per page).
We don't hand-write it or stitch manually — **Step 2 (§3) lets Prisma's nested `select` do exactly
this and return the stitched shape.** `:ids` are the page ids from Step 1.

### 3. Step 2 — Prisma loads children by ids (no filter here)

Step 1 (raw) already chose the page's ids and applied the manual filter; Step 2 just **hydrates**
those ids. Prisma's nested `select` for to-many relations issues separate `WHERE ... IN (...)`
queries and stitches them in the app — exactly the batched pattern above, and it returns the full
nested shape so we write **no** manual stitching:

```ts
const pageIds = /* bigint[] from Step 1 (drop the +1 sentinel row first) */;
this.prisma.at_atendimento.findMany({
  where: { id_at_atendimento: { in: pageIds } },   // ids from Step 1 — NOT the manual filter
  orderBy: { id_at_atendimento: "desc" },          // re-assert Step 1's order (IN doesn't preserve it)
  select: {
    // full at_atendimento projection (see "Columns to return") — the test SQL's 3-col
    // SELECT was speed-only; the real object needs all of these:
    id_at_atendimento: true,
    data_inicio_atendimento: true, data_fim_atendimento: true, data_validacao: true,
    data_atualizacao: true, data_criacao: true, data_sei: true, data_see: true,
    sn_pendencia: true, sn_validado: true,
    dt_update_record: true, id_at_anterior: true, id_und_empresa: true, ativo: true,
    at_cli_atend_prop: {
      orderBy: { id_at_cli_atend_prop: "asc" },   // stable order so consumer's [0] is deterministic
      select: {
        ger_pessoa:     { select: { nm_pessoa: true, nr_cpf_cnpj: true, dap: true, caf: true } },
        pl_propriedade: { select: { nome_propriedade: true, geo_ponto_texto: true } },
      },
    },
    at_atendimento_usuario: {
      orderBy: { id_usuario: "asc" },              // stable order so consumer's [0] is deterministic
      select: { usuario: { select: { id_usuario: true, nome_usuario: true, id_und_empresa: true } } },
    },
  },
});
```

> **⚠️ Prisma 7 gotcha — do NOT enable relation joins casually for this query.**
> Verified against the Prisma 7 docs (context7): `relationLoadStrategy` is still gated by the
> `relationJoins` preview feature, and this repo's Prisma generator does **not** enable
> `previewFeatures = ["relationJoins"]`. That is good for this query: Prisma's current generated
> client keeps the safe separate-query/application-stitching behavior, which scans
> `at_cli_atend_prop` once for the whole page. If someone later enables `relationJoins` for the repo,
> `join` becomes the relation-read default; then this query must explicitly pin
> `relationLoadStrategy: "query"` because PostgreSQL's `join` strategy uses `LATERAL JOIN`/JSON
> aggregation and would risk one `at_cli_atend_prop` seq scan per parent row.

## The honest trade-off for the LIST

Because there is no detail query, the list must carry every column the table view needs (the
metadata is "the product" here) — so producer/property can't simply be deferred to a detail call.

- **`at_atendimento`-only list** = pure PK index range scan, sub-ms-ish, scales effortlessly.
- **list + producer/property** = adds **one seq scan of `at_cli_atend_prop` per page**. It's
  *one* scan (not N), and the table stays hot in cache on a busy endpoint (tens to low-hundreds
  of ms), but it's O(table size) per page, not O(page size), and won't get faster as you page deeper.

**Recommendation:** include the producer/property fields in the list (the table needs them, and
there's no detail call to offload to), accept the single batched seq scan, and **measure** it with
`EXPLAIN (ANALYZE, BUFFERS)`. With field selection, a consumer that only wants `at_atendimento`
columns still gets the pure cheap PK scan automatically. Users are index-backed — keep them freely.

## Caveats to raise before building

- **The manual filter adds scan amplification (verify the plan).** The keyset scan is constant-time
  per *matching* row, but only ~5% of rows match, so each page scans ~20× its size in `at_atendimento`
  rows. This is fine *if* the planner uses the correlated `EXISTS` against the composite index; the
  one thing to confirm with `EXPLAIN (ANALYZE, BUFFERS)` (first page **and** a deep page) is that it
  doesn't seq-scan `at_atendimento_indicador`. See "The filter".
- **Sparse staff scopes can amplify scans further.** `id_usuario` scoping is applied before
  pagination and preserves cursor correctness, but without an index led by
  `at_atendimento_usuario.id_usuario`, a staff user with rare matches may require scanning a large
  fraction of `at_atendimento` to fill a page. Include this case in the live `EXPLAIN` checklist.
- **Further consumer-driven filtering/sorting would hit unindexed columns.** Beyond the baked-in
  manual filter and trusted backend scope args, ordering by anything but the PK, or filtering by date
  range / producer name, hits unindexed columns → seq-scan of 2M rows per request. Do not add those
  without a DBA/index discussion.
- **The single highest-leverage fix we can't do ourselves:** one btree index on
  `at_cli_atend_prop(id_at_atendimento)` turns the only slow join into an index lookup and makes a
  producer-inclusive list genuinely fast and depth-independent. (A standalone index on
  `at_atendimento_indicador(id_at_indicador)` would also let the filter lead from the ~100k matching
  rows instead of scanning `at_atendimento`.) We can't create either — but they're the concrete asks
  to bring to the Demeter DBA, and worth recording here.

## Return type (DTO)

### What the client actually receives — start here

The single query returns **one top-level type** — the object that lands in the response body:

| Query | Response body (the one return type) |
|---|---|
| `atendimentosComRelatorioManual(pageSize, cursor, id_usuario, id_reg_empresa)` | **`AtendimentoPage`** |

Everything else (`ProdutorResumo`, `PropriedadeResumo`, `AtendimentoClienteResumo`,
`AtendimentoUsuarioResumo`) is **never returned on its own** — each is just a nested building block.
The produtor/propriedade data is **not** a sibling field of `AtendimentoListItem`; it lives *inside*
each item, under `clientes[]`. That's the indirection that was confusing — here is the whole nesting
in one view:

```text
AtendimentoPage                              ← response body
├─ pageSize, nextCursor, hasMore             ← pagination metadata
└─ items: AtendimentoListItem[]              ← one element per atendimento
   ├─ id_at_atendimento, data_* (×7), sn_* (×2), dt_update_record, id_at_anterior, id_und_empresa, ativo
   ├─ clientes: AtendimentoClienteResumo[]   ← produtor + propriedade live HERE
   │     ├─ produtor:    ProdutorResumo       (nm_pessoa, nr_cpf_cnpj, dap, caf)
   │     └─ propriedade: PropriedadeResumo?   (nome_propriedade, geo_ponto_texto)  ← may be null
   └─ usuarios: AtendimentoUsuarioResumo[]    (id_usuario, nome_usuario, id_und_empresa)
```

Concrete list response (one item shown):

```json
{
  "pageSize": 200,
  "hasMore": true,
  "nextCursor": "1980412",
  "items": [
    {
      "id_at_atendimento": "1980461",
      "data_inicio_atendimento": "2026-06-20",
      "data_fim_atendimento": "2026-06-20",
      "data_validacao": null,
      "data_atualizacao": "2026-06-21",
      "data_criacao": "2026-06-20",
      "data_sei": null,
      "data_see": null,
      "sn_pendencia": 0,
      "sn_validado": 1,
      "dt_update_record": "2026-06-21T13:42:05.000Z",
      "id_at_anterior": null,
      "id_und_empresa": "H1234",
      "ativo": true,
      "clientes": [
        {
          "produtor": { "nm_pessoa": "João da Silva", "nr_cpf_cnpj": "12345678900", "dap": "SDW123", "caf": null },
          "propriedade": { "nome_propriedade": "Sítio Boa Vista", "geo_ponto_texto": "POINT(-44.1 -19.9)" }
        }
      ],
      "usuarios": [
        { "id_usuario": "8842", "nome_usuario": "MARIA TECNICA", "id_und_empresa": "H1234" }
      ]
    }
  ]
}
```

### Type definitions

Internally, the repo/resolver returns plain JS values from Prisma: `bigint` for Demeter IDs and
`Date` for DateTime columns. The GraphQL layer serializes those through the existing custom scalars
(`BigInt` → string on the wire; `DateTime` → the scalar's date representation). Keep those two forms
separate in code and docs: the TypeScript shape below is the **internal** repo/resolver shape, while
the JSON example above is the **wire** shape after GraphQL serialization. `at_atendimento`
nullability matches the schema. Fan-out note:
`at_cli_atend_prop` is N-per-atendimento, each row pairing one producer with an *optional* property
(LEFT JOIN) — see the cardinality decision below for why these stay arrays.
Do not resolve the broader produtor↔propriedade many-to-many relation through
`pl_propriedade_ger_pessoa` for this list. This endpoint uses the atendimento-specific pair from
`at_cli_atend_prop`; if an edge case has multiple pairs, the gateway returns the stable array and the
PNAE consumer intentionally uses `clientes[0]` / `clientes[0].propriedade` for v1.

```ts
// modules/atendimento/dto/AtendimentoListDTO.ts (when built)

type ProdutorResumo = {
  nm_pessoa: string | null;
  nr_cpf_cnpj: string | null;
  dap: string | null;
  caf: string | null;
};

type PropriedadeResumo = {
  nome_propriedade: string;
  geo_ponto_texto: string | null;
};

type AtendimentoClienteResumo = {
  produtor: ProdutorResumo;
  propriedade: PropriedadeResumo | null;   // LEFT JOIN — a client may have no property
};

type AtendimentoUsuarioResumo = {
  id_usuario: bigint;
  nome_usuario: string | null;
  id_und_empresa: string | null;
};

type AtendimentoListItem = {
  id_at_atendimento: bigint;
  data_inicio_atendimento: Date;            // DateTime (required)
  data_fim_atendimento: Date | null;
  data_validacao: Date | null;
  data_atualizacao: Date;                   // required
  data_criacao: Date;                       // required
  data_sei: Date | null;
  data_see: Date | null;
  sn_pendencia: number | null;
  sn_validado: number | null;
  dt_update_record: Date | null;
  id_at_anterior: bigint | null;
  id_und_empresa: string;                   // required
  ativo: boolean;                           // required
  clientes: AtendimentoClienteResumo[];     // empty if producer/property not requested (GraphQL)
  usuarios: AtendimentoUsuarioResumo[];
};

type AtendimentoPage = {
  items: AtendimentoListItem[];
  pageSize: number;                         // effective (clamped) page size
  nextCursor: bigint | null;                // last kept item's id, or null when no more
  hasMore: boolean;
};
```

GraphQL SDL equivalent (if the GraphQL surface is chosen — BigInt/DateTime are the repo's custom
scalars). This is a **new** type, so the `sn_validacao` compatibility alias is **not** needed here
(that alias only matters for consumers of the existing `Atendimento` type):

```graphql
type ProdutorResumo { nm_pessoa: String  nr_cpf_cnpj: String  dap: String  caf: String }
type PropriedadeResumo { nome_propriedade: String!  geo_ponto_texto: String }
type AtendimentoClienteResumo { produtor: ProdutorResumo!  propriedade: PropriedadeResumo }
type AtendimentoUsuarioResumo { id_usuario: BigInt!  nome_usuario: String  id_und_empresa: String }

type AtendimentoListItem {
  id_at_atendimento: BigInt!
  data_inicio_atendimento: DateTime!
  data_fim_atendimento: DateTime
  data_validacao: DateTime
  data_atualizacao: DateTime!
  data_criacao: DateTime!
  data_sei: DateTime
  data_see: DateTime
  sn_pendencia: Int
  sn_validado: Int
  dt_update_record: DateTime
  id_at_anterior: BigInt
  id_und_empresa: String!
  ativo: Boolean!
  clientes: [AtendimentoClienteResumo!]!
  usuarios: [AtendimentoUsuarioResumo!]!
}

type AtendimentoPage {
  items: [AtendimentoListItem!]!
  pageSize: Int!
  nextCursor: BigInt
  hasMore: Boolean!
}

# added to the atendimento module's existing `type Query` block (merged at runtime).
# NOTE: must NOT be `atendimentos`/`atendimento` — those are taken (see "Naming collision").
# Filter (link_pdf IS NULL + indicador 4550) is applied server-side — not a query argument.
# Filtered to atendimentos that have a manual relatório.
type Query {
  atendimentosComRelatorioManual(
    pageSize: Int = 200
    cursor: BigInt
    id_usuario: BigInt
    id_reg_empresa: String
  ): AtendimentoPage!
}
```

### `cliente` / `usuario` cardinality — arrays at the gateway, consumer takes the first

**Decision: keep `clientes` and `usuarios` as arrays in the gateway contract; the consumer collapses
to the first.** Not singular `cliente` / `usuario` at the gateway, because:

- This is a **shared, published-contract gateway** with multiple consumers. Singular bakes PNAE's
  "exactly one cliente, ignore extra usuarios" assumption into the wire type — lossy for any other
  consumer, and singular→array later is a *breaking* change while array→`[0]` is free.
- It saves nothing: Prisma loads the relation as an array regardless, so singular would just be
  `arr[0]` in the resolver — the identical op the consumer does on its side.
- The arrays are returned in a **defined order (by the child's own id)** so a consumer's `[0]` is a
  stable row, not an arbitrary one.

→ **PNAE-backend maps `clientes[0]` / `usuarios[0]` to its single `cliente` / `usuario`** — a perfect
fit, since multiple clientes don't occur and ignoring any extra usuario is the agreed behavior. If
you later want the gateway itself to emit singular nullable `cliente` / `usuario`, it's a small
resolver change (`[0]` + rename) — just know that turns this into a PNAE-shaped contract rather than
a neutral one.

### Out of scope: `nomeMunicipio` / `nomeRegional` (resolved by the consumer)

The DTO deliberately does **not** include município/regional names. Every item already carries
`id_und_empresa` (the `H%` unit), which is the key of the existing redis-cached
`GET /api/getMunicipiosEmater` (returns `nome_municipio` + `nome_regional` per unit). The PNAE
backend joins on `id_und_empresa` against that cached lookup on its own side. This keeps near-static
dimension data out of every page row, avoids duplicating the `H%`/`G%` unit-naming logic in two
services, and keeps the gateway query lean. (Consumer caveat: `getMunicipiosEmater` only covers
active `H%` units, so a non-`H`/inactive unit yields no name — the consumer must null-tolerate it.)

## Implementation surface (when greenlit)

- One new read method on `AtendimentoRepository` (`modules/atendimento/repository/`):
  `findComRelatorioManualPage(cursor?, pageSize)`, implemented as the **two-step** of "Query strategy" —
  Step 1 `$queryRaw` filtered keyset (returns page ids), Step 2 Prisma `findMany({ where: { id in
  ids }, select })` to hydrate cols + children. Additive only — do not alter existing
  `findAll`/`findOne`/`findMany` shapes (contract stability).
- `RELATORIO_MANUAL_INDICADOR_ID = 4550n` as a named constant in an atendimento constants file (with
  a comment on what it means) — never inline the literal `4550`.
- `ATENDIMENTO_KEYSET_START_CURSOR = 9223372036854775807n` as a named constant for first-page
  keyset queries, so Step 1 can keep one static SQL shape with `id_at_atendimento < cursor` always
  present.
- A cursor/page result type under `modules/atendimento/types/` (or `dto/`).
- Surface: one new GraphQL query (`atendimentosComRelatorioManual` — **not**
  `atendimentos`/`atendimento`) added to the atendimento module's `type Query` + `atendimentoResolver`
  — additive, no `/api/*` route, no detail query (see "Surface: GraphQL only, one new query").
- Boundary validation in the resolver:
  `pageSize = Math.min(1000, Math.max(1, pageSize ?? 200))`; `cursor` is already parsed by the
  `BigInt` scalar for variables/literals, then defaults to `ATENDIMENTO_KEYSET_START_CURSOR` when
  absent. Empty result pages return an empty page envelope, not an error.
- Trusted backend scope args: accept optional `id_usuario` and `id_reg_empresa` from the PNAE backend
  and apply them in Step 1 before pagination. The gateway trusts the service-token caller; it does
  not decode end-user JWTs or call PNAE auth logic. `id_reg_empresa` is a trusted `G%` regional id;
  expand it through `ger_und_empresa` (`id = G OR fk_und_empresa = G`) before composing the raw keyset
  filter, then filter `at_atendimento.id_und_empresa IN (expanded units)`.
- BigInt at the boundary: outbound via the `BigInt` scalar; inbound `cursor` arrives at the resolver
  as `bigint` from the custom scalar before hitting the repo.
- Prisma relation-load guard: this repo intentionally does not enable `previewFeatures =
  ["relationJoins"]`, which keeps relation hydration in the safe separate-query mode. If
  `relationJoins` is ever enabled globally, this query must explicitly pin
  `relationLoadStrategy: "query"`; do not allow the `join`/`LATERAL` strategy on the
  producer/property relation.
