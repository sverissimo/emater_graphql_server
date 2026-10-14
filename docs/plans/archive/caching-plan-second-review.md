# Second review of the Demeter caching starting point

Reviewed on 2026-10-13 against [the proposal](../caching-plan-starting-point.md), [the first review](caching-plan-starting-point-review.md), [AGENTS.md](../../../AGENTS.md), [prisma/schema.prisma](../../../prisma/schema.prisma), the atendimento, enum, usuario, and produtor repositories, the [cheat sheet](../../atendimento.chat-sheet.js), the compose files, and the archived plans. No database, live endpoint, or container was accessed; nothing outside this file was changed.

**Updated the same day with the author's answers to the six open decisions.** See [Author's answers](#authors-answers-2026-10-13). Sections affected by an answer carry a **Status** line; the original reasoning is kept for traceability.

Evidence tags used below:

- **[code]**: verified in this repository's code, schema, or config.
- **[author]**: reported by the author, including measurements recorded in [the archived list-endpoint plan](atendimento-list-read-endpoint-plan.md). These measurements do not record whether they came from hmg or prod.
- **[answer]**: decided by the author in the answers of 2026-10-13.
- **[docs]**: official external documentation, linked inline.
- **[assumption]**: my estimate; it needs a user-run measurement.

Untagged statements are recommendations.

## Verdict

**Score: 6.5/10. The idea is worth pursuing, but in a narrower form than the document describes.**

The direction is right. Reporting tolerates staleness, Demeter's index constraint is real, and the proposal makes phases optional and keeps the existing small caches. Those points earn the score.

It loses points because the plan centres on the wrong decisions. It frames the work as "cache 10–20 tables and pick the fastest database" instead of "define a few reports, then build the smallest snapshot that answers them". The two sections most likely to consume implementation time are incremental refresh (§6.1/§6.3) and the database contest (§7). Both reviews advise against following either. The document also contains no metric definitions, and it understates geography ("not hard").

The first review's 8/10 scores the direction. I score what a planner would build if they followed the document literally.

**Update after the author's answers: as now scoped, I rate the plan 8/10.** All six open decisions are answered, and each answer takes the simpler branch. Phase 1 is now a monthly snapshot with no new database, a fixed window, one counting rule, canonical geography, and a crontab owner. What remains is the produtor-total rule in [Counting rules](#counting-rules-that-follow-from-the-answers) and three small items under [Decisions](#decisions). The 6.5 above still describes the document as written.

## Author's answers (2026-10-13)

These are the author's answers to the six "before implementation" questions in the first version of this review. They are decisions, not my recommendations.

| # | Question | Answer **[answer]** | What it changes in this review |
| --- | --- | --- | --- |
| 1 | Report periods | Fixed periods, **monthly only**. A daily average per month may be derived later in a few lines of TypeScript. | Confirms D1 and D2: no new database. Phase 1 publishes a monthly JSON snapshot. |
| 2 | What counts | Every `at_atendimento` row with `ativo = true` is an atendimento. Who was assisted comes from `at_cli_atend_prop`, which gives "total de produtores atendidos". One atendimento may assist several produtores. | Resolves N4: no status, validation, person-category, or individual/collective filter. Produtor counts are not additive across months; see [Counting rules](#counting-rules-that-follow-from-the-answers). |
| 3 | Programa | Only current codes count. The 2024 PNAE code is out of scope; the 2025–2026 contract code is used. Most other programas are not contract-versioned; if one is, only its latest code is used. Two years of history is best effort: a programa with one year of data delivers one year. | Resolves N1; no cross-contract mapping is needed. One detail remains ([Remaining 1](#decisions)). |
| 4 | Geography | Always `at_atendimento.id_und_empresa`, resolved through `getMunicipiosEmater`. `G%` units are not expected; if one appears, leave the municipio blank and fill the regional from the same lookup. | Resolves N3 with the default I had recommended. Supersedes N2's unfiltered-map suggestion; one residual risk is kept in N2. For a `G%` unit, match the lookup's `regional_id` to get `nome_regional`. |
| 5 | Window | Fixed: **2025-01-01 to 2026-12-31**. Programas without 2025 data deliver what exists, for example Mar 2025 – Oct 2026. The consumer backend sums or averages in TypeScript, and its frontend supplies titles such as "Total Atendimentos Minas Pecuária (mar2025–oct2026)". | Resolves the §5 versus §8.1 conflict. Monthly rows exist only where data exists. |
| 6 | Refresh owner | A **host crontab** runs a Node refresh at 00:00 each night, for the dashboard data (goal 3.1). | Resolves D5 in favour of the crontab. Execution notes are under D5. |

## Counting rules that follow from the answers

The consumer will sum and average monthly rows in TypeScript (answer 5). That is safe for atendimentos but not for produtores, so the snapshot has to carry one extra total.

| Metric | Monthly value | May the consumer sum it? |
| --- | --- | --- |
| Atendimentos | Active `at_atendimento` rows whose `data_inicio_atendimento` falls in the month | **Across months and municipios: yes.** Across programas: no (see below). |
| Produtores atendidos | Distinct `id_pessoa_demeter` in `at_cli_atend_prop` for those atendimentos | **Across months: no.** Across municipios: only approximately. |
| Daily average per month | Monthly atendimentos ÷ days in the month | Derived in TypeScript. For the current month, divide by the days elapsed so far. |

- **Atendimentos across programas.** **[code]** `at_atendimento_indicador`'s unique key is (atendimento, indicador), so one atendimento can carry indicators from several programas. `at_grupo_indicador.permitir_unica_meta_atendimento` shows that this is a per-group setting. Summing programa rows therefore overstates a grand total.
  - Publish one "all programas" monthly count straight from `at_atendimento`. That also matches answer 2, because it includes atendimentos without an indicator.
  - Within a programa, count distinct atendimentos, so that two indicators of the same programa count once.
- **Produtores across months: the one rule that must be handled.** A produtor assisted every month from Mar 2025 to Oct 2026 appears in 20 monthly counts. Summing them reports 20 produtores where there is 1. So "Total produtores atendidos (mar2025–oct2026)" cannot be computed from the monthly rows.
  - Publish a **whole-window distinct total** next to the monthly rows, per programa and per unit.
  - The exact statewide total needs no geographic mapping: it is the same query grouped without the unit, so one extra entry in `GROUPING SETS`.
- **Produtores across municipios.** Summing unit totals into a regional or statewide total counts a produtor assisted by two units twice. This is probably rare **[assumption]**. Either:
  - accept the small overcount; or
  - compute exact regional totals with one extra grouping on the unit's parent, `ger_und_empresa.fk_und_empresa`, the same link `getMunicipiosEmater` uses.
- **Propriedades.** §8.1 lists them, but the answers do not mention them. If they are included, they follow the produtor rules, counting distinct non-null `id_pl_propriedade`.

## The fact that resizes the problem: the dataset is small

Neither the proposal nor the first review uses the author's own earlier measurements:

- **[author]** `at_atendimento` has about **2.2M rows in total**, across all history and including inactive rows. On a "busy PG 9.6", a full sequential scan plus sort of the whole table took **about 8 s** (archived plan, "Perf — measured").
- **[code]** Of the three link tables the proposal names, only one lacks an index on `id_at_atendimento`:
  - `at_atendimento_indicador`, the 7.8M-row table, has a unique index led by `id_at_atendimento` (`ix_at_atendimento_indicador`).
  - `at_atendimento_usuario` has a primary key led by `id_at_atendimento`.
  - `at_cli_atend_prop` has no such index. **It is the only problematic hop.** This comes from the checked-in schema; the archived plan's `pg_indexes` query is still the right confirmation.
- **[code]** The existing `atendimentosComRelatorioManual` list already scans `at_cli_atend_prop` sequentially once per page request, during business hours. The cause is the nested `at_cli_atend_prop` select in `atendimentoListSelect` combined with the missing index. One set-based scan per night is small next to that.
- **[assumption]** After the window and the `ativo` filter, the in-scope set is likely in the range of **a few hundred thousand to about 1M atendimentos**.

Consequences:

1. **Storage-engine speed is almost irrelevant at this size.** Every serious candidate answers these aggregates in milliseconds to well under a second. "Fastest + lightweight" stops being the deciding criterion, and the KISS option is also fast enough.
2. **Incremental refresh will very likely never pay off.** A full rebuild is probably minutes rather than hours. Measure it once, then drop §6.1/§6.3 unless the measurement disagrees.
3. **The real costs are elsewhere:** metric definitions, the extraction query on Demeter, and refresh ownership across replicas.

## Where I agree with the first review

These findings hold up. I verified each one and add only what is new.

- **Counting semantics (F2) and non-additive distinct counts (F3).** Correct, and they matter most.
- **Incremental pitfalls (F4).** Verified **[code]**: `update` (the PNAE soft delete), `setValidacaoStatus`, `updateTemasAndNumeroVisita`, and `setAtendimentosExportDate` never set `dt_update_record`. Full daily rebuild first.
- **Extraction (F5).** Use set-based queries, never per-batch probes of `at_cli_atend_prop`, and do not reuse the list hydrate for bulk work. Hydrating in bulk would repeat the per-page sequential scan once per batch.
- **Geography as a business rule (F6).** Agreed; it is broader than the first review states (see N3).
- **Publication and failure behaviour (F7).** Publish complete generations, keep the last good one, and return an explicit "unavailable" result rather than zeros.
- **One refresh owner with bounded resources (F8).** Verified **[code]**: prod runs 3 replicas, each capped at 2 GB and 2 CPUs.
- **Rejected candidates.** Redis, Dragonfly, Mongo, Couch, Cassandra, and ClickHouse do not belong on the shortlist.

## Where I disagree or would change the emphasis

**D1: No new database in phase 1 unless a stated requirement needs retained facts.** **Status: confirmed by answer 1.** The first review names local PostgreSQL as the default and mentions "publishing those outputs alone" as a smaller option. I would reverse that order:

- If phase-1 reports use **fixed periods** (month, year, year to date), the refresh can compute every metric at every offered level and publish a small JSON snapshot. No database server, schema, or migrations are needed.
- A database becomes necessary only when consumers need **arbitrary date ranges with exact distinct counts**, drill-down, or phase 2.

That one decision determines whether any new infrastructure exists.

**D2: Daily grain gains almost nothing; choose monthly or keep facts.** **Status: resolved by answer 1 (monthly).** The first review suggests counting per day. However, a daily × local-unit × programa grid has about as many cells as there are facts. With roughly 850 local units **[author]**, about 500 working days, and 0.5–1M atendimentos **[assumption]**, each unit records about 1–2.5 atendimentos per working day.

So either:

- use the author's own monthly grain, which keeps the outputs small; or
- keep the facts outright, which is the D1 database case.

There is no worthwhile middle option.

**D3: For phase 1, let Demeter aggregate in a single nightly transaction.** **Status: still my recommendation.** The source has to scan the same tables either way; extracting rows locally only moves the join and aggregation CPU elsewhere. In exchange, extraction adds network transfer, memory, and hand-written join or deduplication code. The cost on the source side is sort and hash spill in Demeter's temporary storage, once per night. Have the user measure it with `EXPLAIN (ANALYZE, BUFFERS)` on hmg before deciding. Move to fact extraction only if that measurement is unacceptable.

Distinct counts cannot be summed across levels, so compute them for each offered geographic level and period. `GROUPING SETS` has existed since PostgreSQL 9.5 ([9.6 docs](https://www.postgresql.org/docs/9.6/queries-table-expressions.html#QUERIES-GROUPING-SETS)).

**D4: Snapshot consistency is a default, not a trade-off.** **Status: still applies.** Run the whole refresh as `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`:

- For a job of a few minutes at night, holding back the vacuum horizon has negligible cost.
- `READ ONLY` makes PostgreSQL reject accidental writes through the gateway's write-capable role.
- The snapshot time becomes the single "data as of" value. Together with the reporting period, that replaces the first review's four metadata fields.

**D5: Ownership. Status: decided by answer 6. A host crontab runs a Node refresh at 00:00.** I had suggested a one-replica compose service instead. The crontab is an equally valid starting point: it provides one owner outside the HTTP replicas, which is what N8 requires. Notes for the implementation plan:

- **Run the job in the environment's released image, not from the host checkout.** A one-off container of that environment's compose service inherits its env file, network, and mounts. Running `node` from the host working tree would execute the dev checkout's unreleased code against that environment's Demeter.
- **Mount the output directory into the gateway replicas.** Follow the existing `logs/<env>` bind-mount pattern; `data` is already git-ignored. This is a compose change the user makes.
- **Set a `statement_timeout` on the refresh session.** That stops a stuck run from holding a long transaction on Demeter into the working day.
- **Record the crontab line in the repo docs.** It lives outside the repo, and root AGENTS.md says apps may later move to their own VM.

Scheduling and compose changes remain manual user operations.

## New findings neither document covers

**N1: "Programa" IDs change with each contract.** **Status: resolved by answer 3.** Only current-contract codes count, so no mapping is needed. The remaining detail is under [Decisions](#decisions).

**[code]** The cheat sheet shows the PNAE indicator, group, and product changing for the 2025 contract:

| Contract | Indicator | Group | Product |
| --- | --- | --- | --- |
| Before 2025 | 4026 | 279 | 1814 |
| 2025 contract | 4550 | 323 | 2006 |

Counting by raw `id_at_grupo_indicador` across such a change would split one business programme across several IDs. `at_grupo_indicador.sn_super_grupo` suggests an upstream grouping concept that is not modelled in the checked-in schema; its meaning is unknown.

**N2: Lookup "active" flags silently delete history.** **Status: partly superseded by answer 4.** The author chose `getMunicipiosEmater` as the canonical unit lookup, so I no longer recommend a separate unfiltered map. Two points remain:

- **Closed units.** **[code]** `getMunicipiosEmater()` keeps only active `H%` units under active `G%` parents. An atendimento from a unit closed since 2025 therefore finds no match. Keep such rows in an explicit "não identificado" bucket instead of dropping them, and log how many rows land there on each refresh. Revisit only if that number is material.
- **Indicator and group flags.** Do not filter `at_indicador.ativo` or `at_grupo_indicador.ativo`. An indicator deactivated in the middle of a contract would otherwise lose its history.

Only `at_atendimento.ativo` is the soft-delete flag for the counted fact. The other flags with the same trap are `ger_und_empresa.sn_ativa`, `ger_pessoa.sn_ativo`, and `pl_propriedade.ativo`.

**N3: Geography has more candidate columns than either document lists.** **Status: resolved by answer 4.** The author uses `at_atendimento.id_und_empresa`, matching my recommended default.

**[code]** For the record, the other candidates were:

- `at_atendimento.fk_und_empresa`
- `at_atendimento_indicador.id_und_empresa`
- `at_cli_atend_prop.id_und_empresa`
- `at_atendimento_usuario.id_und_empresa`
- `ger_pessoa.id_und_empresa`
- `pl_propriedade`: `id_und_empresa` and `id_municipio`; the latter is the property's real municipality, not a unit seat.

The chosen rule agrees with `buildScopeClause` and `atendimentosManuaisUltimos60Dias`, so the new reports line up with the existing PNAE dashboards.

**N4: The counted population is undefined.** **Status: resolved by answer 2.** Every active atendimento counts, and every person in `at_cli_atend_prop` counts as a produtor. That means:

- no filter on person category (`fk_cat_pessoa`);
- no split between individual and collective atendimentos (`id_at_acao`, `qtd_alunos`);
- no filter on status or validation (`id_at_status`, `sn_validado`).

Under a full rebuild, any of these can be added later as a dimension at low cost.

**N5: Full rebuilds make replacement chains irrelevant.** **Status: still applies.** With `ativo = true` and a full rebuild, each logical atendimento counts once, as long as its predecessor was deactivated. No chain traversal is needed. The remaining risk is double counting when both versions remain active.

Ask the user to run a cheap read-only check: active rows whose ID is another active row's `id_at_anterior`. The column is indexed **[code]**.

**N6: Date handling can shift a month.** **Status: still applies.** **[code]** The atendimento dates are SQL `DATE`. The existing 30/60-day queries return JS `Date` objects and leave day bucketing to PNAE "so it stays aligned (same timezone)". `formatDate` depends on the container's locale and timezone.

- Bucket in SQL (`to_char(date_trunc('month', …))`) and publish `YYYY-MM` strings, so no `DATE` value passes through JS `Date` in the refresh.
- `data_criacao` versus `data_inicio_atendimento` shows how late entries arrive. Have the user measure that lag to decide how long a recent month stays labelled "provisional".

**N7: Prisma traps in this repo.** **Status: still applies.** **[code]**

- The installed Prisma 7.8.0 defaults interactive transactions to `timeout: 5000` ms and `maxWait: 2000` ms. A multi-minute refresh inside `prisma.$transaction` would be aborted unless the timeout is raised.
- `$queryRaw` resolves to a complete array. That is fine for aggregates but not for extracting millions of rows. No `pg-cursor` or `pg-query-stream` package is installed.

Run the refresh on a dedicated `pg` client (already a dependency), separate from the shared Prisma pool. If rows ever need streaming, plain `DECLARE … CURSOR` / `FETCH` works without a new package.

**N8: Do not extend the existing TTL-cache pattern to this.** **Status: satisfied by the crontab design (answer 6).** **[code]** The two 6 h caches are per replica, load lazily, and are flushed only by a restart. If this report followed the same pattern:

- the first request after expiry would trigger the expensive query during business hours, once for each of the 3 replicas;
- every deploy would trigger it again.

The snapshot must persist outside the process and be built by the single owner.

**N9: Two environment checks.** **Status: still applies.**

- **[docs]** Demeter's PostgreSQL 9.6 reached end of life on 2021-11-11 ([versioning policy](https://www.postgresql.org/support/versioning/)). Any extraction tool must be confirmed to work against 9.6.
- Before scheduling refreshes in dev and hmg, have the user confirm which Demeter database each environment's `DATABASE_URL` points to. A dev refresh must not add nightly load to the prod database.

## Revised storage shortlist

| Option | Use when | Assessment |
| --- | --- | --- |
| **No new DB.** The refresh publishes a versioned JSON snapshot of the agreed aggregates, and replicas load it from the shared mount. | Phase-1 reports use fixed periods. Answer 1 confirms monthly. | **Chosen for phase 1.** At most 24 months × ~850 units × P programas, stored as non-zero cells only; a few MB per replica. **[assumption]** |
| **Local PostgreSQL.** | Retained facts are needed: arbitrary-range distinct counts, drill-down, or phase 2. | **Agree with the first review** for this case. See the `postgres_fdw` note below. |
| **DuckDB.** | Batch aggregation inside the refresh job, if source-side aggregation proves too heavy. | Keep as the benchmark alternative. Agree: do not share a mutable file across replicas. |
| **`node:sqlite`** (built into Node 24). | Zero-dependency embedded storage. | **Not for serving from the gateway.** **[docs]** It is a release candidate since v24.15, but `DatabaseSync` is entirely synchronous ([Node docs](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)). Heavy distinct counts would block the event loop for all traffic. |

**`postgres_fdw` note.** If a local PostgreSQL is adopted later, `postgres_fdw` makes extraction plain SQL. `CREATE TABLE … AS SELECT … FROM <foreign tables>`, run inside one local transaction, replaces the hand-written ETL code.

**[docs]** ([postgres_fdw, PG 18](https://www.postgresql.org/docs/current/postgres-fdw.html)):

- The remote transaction uses `REPEATABLE READ`, so multiple scans get "snapshot-consistent results".
- Remote servers back to PostgreSQL 8.3 are supported.
- The default `fetch_size` is 100. Raise it for bulk reads.

Caveats:

- Credentials live in a user mapping in the local database, provisioned from env at setup and never placed in tracked files.
- The reporting container needs a network path to Demeter.

## Smallest useful phase 1 (updated with the answers)

1. **Build fixtures for the counting rules.**
   - several indicators in one programa;
   - one atendimento in two programas;
   - one atendimento with two produtores;
   - a produtor assisted in two different months;
   - a replaced row;
   - a unit missing from `getMunicipiosEmater`;
   - a `G%` unit.
2. **Measure with the user.** The user runs `EXPLAIN (ANALYZE, BUFFERS)` of the aggregate queries on hmg, recording duration and temporary-file usage.
3. **Build one refresh entrypoint, started by the crontab.** It:
   - opens a dedicated `pg` connection with `REPEATABLE READ READ ONLY` and a `statement_timeout`;
   - runs one statement per metric over 2025-01-01 – 2026-12-31, grouped by month, programa, and `at_atendimento.id_und_empresa`;
   - uses `GROUPING SETS` to add the all-programas count and the whole-window produtor totals;
   - resolves units to municipio and regional with `getMunicipiosEmater()`, keeping unmatched units in an explicit bucket. Each cron run is a new process, so this is a fresh query, not a 6 h-old cache;
   - writes `report.<generation>.json`, then renames it atomically over `report.json`.

   On failure it exits non-zero and leaves the previous file in place.
4. **Add one additive read surface in the gateway.**
   - A small repository reads the file, reloads it when its mtime changes, and keeps the last good parse.
   - One new GraphQL query returns the monthly rows and the whole-window totals, plus `dataAsOf`, the reporting period, and the generation ID.
   - If no snapshot exists, it returns an explicit "unavailable" error.
   - Replicas may briefly serve different generations after a publish; the generation ID makes that visible.
5. **Leave existing resolvers, routes, and the two caches unchanged.** Update AGENTS.md in the same change.

**Produtores are in phase 1** (answer 2). Their extraction cost is one nightly set-based scan of `at_cli_atend_prop`, which is less than what the existing list endpoint already does on a single page.

**Exit criterion for anything larger:** a named consumer need that monthly snapshots cannot answer. Only then add retained facts in local PostgreSQL.

## Decisions

**Answered on 2026-10-13:** report periods, what counts, programa, geography, window, and refresh owner. See [Author's answers](#authors-answers-2026-10-13).

**Remaining before implementation (all small):**

1. **The programa key and how "latest only" is applied.**
   - Confirm that a programa is an `at_grupo_indicador` row, with its ID as the code and `descricao` as the name.
   - Choose how superseded codes are excluded. Either keep a short in-scope list in a constants file (like `RELATORIO_MANUAL_INDICADOR_ID`), or take every group with data in the window minus a short exclusion list.

   This only matters if a superseded code, such as PNAE group 279, still has rows dated 2025.
2. **Whole-window produtor totals.** Confirm that the snapshot publishes them, and decide whether regional totals must be exact or may be summed from municipios. See [Counting rules](#counting-rules-that-follow-from-the-answers).
3. **Propriedades.** Include them in phase 1, or add them later?
4. **Cron setup per environment.** This is a user operation: the execution context and output mount from D5, and the database-target check from N9.

**Can wait:**

- choosing a fact-storage engine, needed only if monthly snapshots stop being enough;
- incremental or intra-day refresh (likely never);
- per-extensionista metrics (`at_atendimento_usuario` is index-backed, so they are cheap to add);
- unit hierarchy as of the atendimento date;
- DBA requests such as a read-only role or indexes;
- phase 2, which still needs a consumer audit because serving stale data changes observable behaviour.
