# Caching plan: phase 1 (atendimentos)

Build a locally owned reporting cache of **active atendimentos from twelve complete months plus the current month through yesterday**, rebuilt nightly from Demeter. Consumer backends receive aggregates from the gateway and handle averages, labels, and charts.

**PostgreSQL was selected by the author on 2026-10-14.** Retaining facts supports exact distinct counts for arbitrary combinations of the supported month filters and dimensions. This supersedes the fixed 2025–2026 JSON recommendation in [the second review](archive/caching-plan-second-review.md). Exploration counts are in [atendimentosCount.clean.json](../data/atendimentosCount.clean.json).

This plan does not authorize agents to access databases, provision containers, deploy, or schedule jobs.

## Settled decisions

| Topic | Decision |
| --- | --- |
| Atendimento | Every `at_atendimento` row with `ativo = true` counts. |
| Date range | First day of the month twelve months ago through yesterday, in São Paulo time. A 2026-10-14 run retains 2025-10-01 through 2026-10-13, excluding typo years such as 0220 and 9999. Recent months are served as-is, with no provisional flag: the current month is partial and late entries may still raise recent months. Labeling that is up to consumers. |
| Programa | `at_grupo_indicador`, active groups only (`ativo = true`). Links come through `at_atendimento_indicador` → `at_indicador`. Deactivating a programa intentionally removes its history at the next rebuild. |
| Geography | `at_atendimento.id_und_empresa`, resolved with `EnumPropsRepository.getMunicipiosEmater()`. An `H%` unit gives the municipio and its regional. A `G%` unit gives the regional and leaves the municipio empty. An unmatched unit leaves both empty. |
| Técnico | `at_atendimento_usuario`, covering every técnico linked to the atendimento. For this project, usuario = técnico = extensionista. Confirm this with the [pre-check](#pre-implementation-check-user-run) first. |
| Produtor | `at_cli_atend_prop`, keeping only `id_at_atendimento`, `id_pessoa_demeter` and `id_pl_propriedade`. Every linked person counts. |
| Unique counts | `COUNT(DISTINCT …)` for the requested filters/grouping; never sum grouped distinct counts. |
| Refresh | A full rebuild every night at 01:00 **America/Sao_Paulo**, triggered by host crontab, with no incremental updates (see [Out of scope](#out-of-scope)). |
| Storage | Locally owned PostgreSQL with persistent storage. Reuse the existing `pg` driver; no Prisma upgrade or new runtime dependency is required. |
| Environments | There is no Demeter dev. **Dev and hmg share one cache database** (`postgres_gateway_dev`, defined in `docker-compose.postgres-dev.yaml`), filled from Demeter HMG; it publishes host port 5552 for inspection with pgAdmin. **Only hmg and prod run the scheduled refresh.** Dev may run it manually for testing, never against Demeter PROD (see the safety line under the nightly job). Prod gets its own cache database, filled from Demeter prod, with no published port. |

The job extracts bounded cursor batches, loads the `atendimentos_build` schema, adds indexes, and atomically replaces the `atendimentos` schema. Pre-publication failure preserves the last generation; a logging/cleanup failure after commit cannot undo publication. Budget disk for both generations, indexes, temporary files, and WAL; measure the first run.

**Lookup consistency exception:** keep existing in-memory caches unchanged. Capture `getMunicipiosEmater()` once in the fresh job process and persist its map. This Prisma lookup runs outside the source transaction; the small timing difference is accepted. No separate lookup timestamp or historical geography synchronization.

## Cache database

Read **`CACHE_DATABASE_URL`** from environment configuration; add only the empty key to `.env.example`. The refresh creates tables directly in the locally owned database, without migrations or changes to Demeter or its Prisma client.

**Naming:**

- **Database:** `demeter_cache`, a general cache of Demeter data, not only for dashboards.
- **Schemas:** each cached dataset gets its own schema pair, rebuilt and swapped independently. This plan's dataset uses `atendimentos` (served) and `atendimentos_build` (only during the nightly build). A future phase 2 would add its own pair, such as `produtores` and `produtores_build`.
- **Tables:** short names with no schema or cache prefix in SQL. The serving pool sets `search_path=atendimentos`. The job's dedicated cache connection sets `search_path=atendimentos_build` after creating that schema. Schema names appear only in the prepare and publish statements.

```sql
-- created in atendimentos_build (job connection: search_path = atendimentos_build)
CREATE TABLE atendimento (
  id_at_atendimento bigint NOT NULL,
  data_inicio       date    NOT NULL,
  month             char(7) NOT NULL,   -- 'YYYY-MM'
  id_und_empresa    char(5) NOT NULL,
  regional_id       char(5)             -- null when the unit is not in getMunicipiosEmater
);
CREATE TABLE atendimento_programa (id_at_atendimento bigint NOT NULL, codigo_programa bigint NOT NULL);
CREATE TABLE atendimento_tecnico  (id_at_atendimento bigint NOT NULL, id_usuario bigint NOT NULL);
CREATE TABLE atendimento_produtor (id_at_atendimento bigint NOT NULL, id_pessoa_demeter bigint NOT NULL, id_pl_propriedade bigint);

CREATE TABLE programa (codigo_programa bigint NOT NULL, nome text NOT NULL);
CREATE TABLE unidade  (id_und_empresa char(5) NOT NULL, nome_municipio text, regional_id char(5), nome_regional text);
CREATE TABLE tecnico  (id_usuario bigint NOT NULL, nome text, login text, id_und_empresa char(5));

CREATE TABLE refresh_info (
  snapshot_at timestamptz NOT NULL,
  range_start date        NOT NULL,
  range_end   date        NOT NULL
); -- exactly one row; range_end inclusive (yesterday)
```

After loading, add:

- Primary keys: `atendimento(id_at_atendimento)`, `atendimento_programa(id_at_atendimento, codigo_programa)`, `atendimento_tecnico(id_at_atendimento, id_usuario)`, and the ID columns of `programa`, `unidade`, and `tecnico`.
- Indexes: `atendimento(month)` and `atendimento_produtor(id_at_atendimento)`, then `ANALYZE`. Add further local indexes only after measuring; never change Demeter indexes.

Populate `unidade` with each captured `H%` unit and each distinct `G%` regional. Regional rows have their own ID as `regional_id` and null municipio. Fill `atendimento.regional_id` from this map; keep and log unmatched facts, grouping their geography under null. Direct `G%` assignments have a regional but no municipio; only captured regionals resolve.

For regional names, join `unidade.id_und_empresa = atendimento.regional_id` to the unique `G%` row. Joining on `unidade.regional_id` multiplies rows across its local units.

## Nightly refresh job

**Entry point:** `src/jobs/refreshAtendimentosCache.ts` → `dist/jobs/refreshAtendimentosCache.js`; never start HTTP.

**Safety line:** before connecting to anything, the entry point refuses to run outside production when the source points at Demeter PROD:

```ts
if (process.env.NODE_ENV !== "production" && (process.env.DATABASE_URL ?? "").toUpperCase().includes("PROD")) {
  logger.error("Refusing to refresh: non-production environment pointed at Demeter PROD.");
  process.exitCode = 1;
  return;
}
```

Checked on 2026-10-14: prod and hmg run with `NODE_ENV=production`, set by their compose files; dev runs with `development`. Only prod's `DATABASE_URL` normally contains `PROD`. Dev may run the job manually for testing; this line blocks it whenever dev is pointed at Demeter PROD. A false match only blocks a run, which is the safe direction.

**Connection limits:** configure one `statement_timeout` per connection: 15 minutes for source/cache job connections, 15 seconds for the serving pool. Keep finite connection-establishment timeouts; SQL timeouts cannot bound connection setup. No separate swap statement timeout or whole-job deadline/cancellation framework. Log duration and investigate stalled runs manually.

1. **Lock.** Take `pg_try_advisory_lock` with a fixed application key on one dedicated cache connection, held through publication. If held elsewhere, log and exit 0. This is the only overlap guard; no cron wrapper. Never acquire/release this session lock through separate `pool.query()` calls.
2. **Date range and lookup.** Calculate `YYYY-MM-DD` bounds once in `America/Sao_Paulo`: first day twelve months ago inclusive, today exclusive. Store yesterday as inclusive `range_end`. Capture the unit lookup once.
3. **Prepare.** `DROP SCHEMA IF EXISTS atendimentos_build CASCADE; CREATE SCHEMA atendimentos_build; SET search_path = atendimentos_build;`, then create the tables.
4. **Extract/load.** Use a dedicated `pg.Client` on `DATABASE_URL`, outside Prisma's pool. Begin `ISOLATION LEVEL REPEATABLE READ READ ONLY`. Record `snapshot_at` as SQL text when the first source snapshot is acquired. For each extraction query, `DECLARE c NO SCROLL CURSOR FOR …`, repeatedly `FETCH 10000 FROM c` and await each batch insertion, then `CLOSE c`. Bind the date-range parameters. Commit the source transaction before cache indexing/publication.
5. **Finish the build.** Load captured units/regional rows; add keys, indexes, the single `refresh_info` row, and `ANALYZE`. All links share the source snapshot and date range, so no extra link-validation pass. Propagate every fetch/insert/index error and never publish an incomplete load. Log zero facts as a valid result.
6. **Publish** in one transaction:

   ```sql
   BEGIN;
   SET LOCAL lock_timeout = '5s';
   DROP SCHEMA IF EXISTS atendimentos CASCADE;
   ALTER SCHEMA atendimentos_build RENAME TO atendimentos;
   COMMIT;
   ```

   Roll back on any swap error; a lock timeout preserves the old generation. No tight retry loop. Schemas contain only job-owned tables: no external views, stored functions, or named prepared statements may depend on their identities.
7. **Cleanup.** Winston logs table counts, unmatched units, publication status, and duration. In `finally`, roll back open transactions, release the advisory lock (or close a broken connection), and close all job-owned pg/Prisma clients/pools. Set `process.exitCode` to 1 on failure; avoid early `process.exit()`.

### Extraction queries

Run all queries in the source transaction. `<date_range>` is:

```sql
a.ativo = true
AND a.data_inicio_atendimento >= $1::date
AND a.data_inicio_atendimento <  $2::date
```

```sql
-- atendimento
SELECT a.id_at_atendimento::text,
       to_char(a.data_inicio_atendimento, 'YYYY-MM-DD') AS data_inicio,
       to_char(a.data_inicio_atendimento, 'YYYY-MM')    AS month,
       a.id_und_empresa
FROM at_atendimento a
WHERE <date_range>;

-- atendimento_programa
SELECT DISTINCT a.id_at_atendimento::text, i.id_at_grupo_indicador::text
FROM at_atendimento a
JOIN at_atendimento_indicador ai ON ai.id_at_atendimento = a.id_at_atendimento
JOIN at_indicador i              ON i.id_at_indicador = ai.id_at_indicador
JOIN at_grupo_indicador g        ON g.id_at_grupo_indicador = i.id_at_grupo_indicador AND g.ativo = true
WHERE <date_range>;

-- atendimento_tecnico
SELECT a.id_at_atendimento::text, au.id_usuario::text
FROM at_atendimento a
JOIN at_atendimento_usuario au ON au.id_at_atendimento = a.id_at_atendimento
WHERE <date_range>;

-- atendimento_produtor
SELECT a.id_at_atendimento::text, cap.id_pessoa_demeter::text, cap.id_pl_propriedade::text
FROM at_atendimento a
JOIN at_cli_atend_prop cap ON cap.id_at_atendimento = a.id_at_atendimento
WHERE <date_range>;

-- programa
SELECT id_at_grupo_indicador::text, descricao FROM at_grupo_indicador WHERE ativo = true;

-- tecnico
SELECT id_usuario::text, nome_usuario, login_usuario, id_und_empresa FROM usuario;
```

- Extract IDs/dates as strings and explicitly format cache IDs and `date`/`timestamptz` in read SQL too. Avoid JS `Date` parsing and timezone/precision changes; calendar calculations use São Paulo time.
- Repeat the date-range filter; the source transaction is read-only and creates no temporary tables.
- Do not filter indicador, produtor, property, or técnico status. Keep active facts missing links. Deactivating a programa removes its historical links next refresh.
- Queries are set-based, including `at_cli_atend_prop`; never rescan that association per batch. Cursors bound application memory, not source join/sort/DISTINCT work. Timings and temporary-file costs require user measurement.

### Loading

Use one `unnest` insert per fetched batch, without new dependencies:

```sql
INSERT INTO atendimento_produtor (id_at_atendimento, id_pessoa_demeter, id_pl_propriedade)
SELECT * FROM unnest($1::bigint[], $2::bigint[], $3::bigint[]);
```

Keep parameter arrays equal-length, preserve null property IDs, and await inserts before fetching again. No accumulated batches or concurrent insert fan-out. Duplicate producer/property associations are harmless to distinct counts; do not add a nullable composite primary key.

## Read API

`POST /api/gestao/atendimentosAgregados`, under existing service-token auth. Example request (all fields optional):

```json
{
  "groupBy": ["month", "programa"],
  "filters": {
    "monthFrom": "2026-01",
    "monthTo": "2026-09",
    "programas": ["50", "318"],
    "regionais": ["G0001"],
    "municipios": ["H0349"],
    "tecnicos": ["1234"]
  },
  "orderBy": "atendimentos",
  "limit": 10
}
```

- Month filters only; current month ends yesterday. Months outside the retained date range have no matches.
- No grouping (omitted or `[]`) returns one totals row, with zero metrics when empty; an empty grouped result returns `rows: []`.
- Missing links form null buckets unless explicitly filtered out.

| `groupBy` value | Returned keys | Source |
| --- | --- | --- |
| `month` | `month` | `a.month` |
| `programa` | `codigoPrograma`, `programa` | joins `atendimento_programa` and `programa` |
| `regional` | `regionalId`, `regional` | `a.regional_id`, with the name from `unidade` |
| `municipio` | `idUndEmpresa`, `municipio` | the matched `H%` unit in `unidade`; both null for `G%` or unmatched units |
| `tecnico` | `idUsuario`, `tecnico` | joins `atendimento_tecnico` and `tecnico` |

**Metrics.** Every row contains three exact distinct counts, computed over a `LEFT JOIN atendimento_produtor`:

```sql
COUNT(DISTINCT a.id_at_atendimento)::int AS atendimentos,
COUNT(DISTINCT pr.id_pessoa_demeter)::int AS produtores,
COUNT(DISTINCT pr.id_pl_propriedade)::int AS propriedades
```

**Query rules:**

- Grouping by programa/técnico uses left joins; filtering those dimensions without grouping uses correlated `EXISTS`. If both grouped and filtered, restrict the joined IDs.
- Build SQL identifiers from whitelist maps; pass every value as a `$n` parameter.
- AND between filter categories, OR within each; omitted/empty arrays impose no restriction.
- An atendimento in multiple programas/técnicos counts in each grouped row, once in ungrouped totals. A técnico filter includes all producers/properties of those atendimentos, without inferring person-to-técnico links.
- Group names with IDs. Municipio uses a matched `H%` unit; regional names use a separate unique `G%` row as above.
- `orderBy`: `atendimentos`, `produtores`, or `propriedades` descending; grouped IDs/month break ties, nulls last. Default: grouped dimensions ascending, nulls last.
- `limit`: default 1000, range 1–1000, applied globally after ordering. For top N técnicos **per month**, request each month separately (`monthFrom = monthTo`).
- Fetch cap + 1; return at most the cap and set `truncated` if another group exists. Consumers narrow requests for complete results; never sum partial grouped distinct counts. No pagination.

**Consistent reads:** use one checked-out client and a short read-only transaction. Read `refresh_info` first, then aggregates; assemble the response in TypeScript and commit. The first read's table lock prevents publication between queries. Roll back on error and always release. Use unnamed queries with unqualified table names, resolved through the serving pool's `search_path=atendimentos`, not separate `pool.query()` calls. Keep the publisher's 5-second lock timeout.

**Essential validation in the route** (`BAD_REQUEST` → HTTP 400):

- Require an object body. Treat null optional fields as omitted, then validate recognized fields' types, including object-shaped filters. Ignore unknown keys.
- `groupBy`: array of unique whitelist values; `orderBy`: metric whitelist.
- Months: real `YYYY-MM` (year 0001–9999, month 01–12), with start ≤ end.
- Filter lists: string arrays, at most 1000 entries each; normalize/deduplicate.
- Programa/técnico IDs: digits within non-negative signed-bigint range, retained as strings. Keep this small range check so oversized IDs return 400 rather than a database error.
- Regional IDs: `^G\d{4}$`; municipio IDs: `^H\d{4}$` (local-unit codes, not numeric municipality IDs).
- `limit`: integer 1–1000. Never interpolate unchecked grouping/sort/limit values.

**Response:**

```json
{
  "snapshotAt": "2026-10-14T01:00:12-03:00",
  "stale": false,
  "dateRange": { "start": "2025-10-01", "end": "2026-10-13" },
  "truncated": false,
  "rows": [
    { "month": "2026-09", "codigoPrograma": "50", "programa": "PROGRAMA - MINAS PECUÁRIA", "atendimentos": 212, "produtores": 180, "propriedades": 175 }
  ]
}
```

Example values are illustrative; `dateRange.end` is inclusive. `snapshotAt` identifies the source snapshot (UTC `Z` also valid); `stale` becomes true after 36 hours. Keep serving the last successful generation; completion/duration go in logs. Never fall back to Demeter on reads.

**Failures:** unset config, unreachable cache, missing first generation, or explicit read timeout → `GraphQLError` with `SERVICE_UNAVAILABLE` (new 503 mapping in `routeHelpers.ts`). Log timeouts; consumers may narrow/retry. Programming/query errors stay 500, never a fabricated zero report. Preserve existing error mappings.

## Files

| File | Responsibility |
| --- | --- |
| New `src/config/cacheDbPool.ts` | Lazy `pg.Pool` from `CACHE_DATABASE_URL`, or null when unset; fixed serving timeout, finite connection timeout, and `search_path=atendimentos`. Gateway must start without cache config. |
| New `src/modules/gestao/refresh/refreshAtendimentosCache.ts` | Date range, lookup capture, extraction/load/publication orchestration; database access stays in repositories. |
| New `src/jobs/refreshAtendimentosCache.ts` | Run, log, cleanup, exit code; never import Express or the REST dependencies composer. |
| New `src/modules/gestao/repository/AtendimentosCacheRepository.ts` | Cohesive cache build/load/publish/read methods and query builder; dedicated job client versus serving pool. |
| New `src/modules/gestao/repository/AtendimentosSourceRepository.ts` | Dedicated Demeter client, transaction, cursors, extraction SQL; reuse enum repository for lookup. |
| New `src/modules/gestao/types/atendimentosCache.types.ts` | Shared request/response/date-range/batch contracts; single-file types stay local. |
| `src/routes/gestaoRoutes.ts` | Thin aggregates handler plus validation; preserve temporary exploration routes. |
| `src/routes/dependencies.ts` | Lazy `atendimentosCacheRepository` wiring; no eager cache requirement or source client. |
| `src/routes/routeHelpers.ts` | Add `SERVICE_UNAVAILABLE: 503`. |
| `.env.example` | Empty `CACHE_DATABASE_URL=` key only. |
| `AGENTS.md` | Document cache, job, route, pg repository exceptions, and env variable. |

The pg repositories do not extend `PrismaRepository` or construct Prisma clients. No cache Prisma schema/upgrade; no new runtime dependencies. Check whether `@types/pg` needs an explicit dev dependency. Use relative `.js` imports.

Add `node:test` tests for pure functions only: date-range rollovers, H/G/unmatched mapping, essential validation, and query builder joins/EXISTS/distinct/nulls/parameters. No mocked-client refresh framework; the user checks real lifecycle behavior below. Temporary exploration endpoints remain independent.

## Operations (user)

1. Provision the cache databases. Dev/hmg: `docker compose --env-file .env.development -f docker-compose.postgres-dev.yaml up -d` (attached to `demeter_gateway_dev` and `demeter_gateway_hmg`, host port 5552). Prod: its own container on `demeter_gateway_prod`, no published port, `demeter_cache` database and owning role.
2. Set `CACHE_DATABASE_URL` privately: dev and hmg point at `postgres_gateway_dev`, prod at its own database. Manually rebuild hmg/prod images for `dist/jobs/`.
3. Schedule at 01:00 **America/Sao_Paulo**, for hmg and prod only (never dev), redirecting output to `logs/<env>/`. The database advisory lock is the sole overlap guard; no `flock`. Record the actual cron lines in repo docs. User-run command examples:

   - hmg: `docker exec graphql_server_hmg node dist/jobs/refreshAtendimentosCache.js`
   - prod (any running replica): `docker exec "$(docker ps -q -f name=graphql_server_prod -f status=running | head -n 1)" node dist/jobs/refreshAtendimentosCache.js`
4. Confirm container names with `docker ps`. Cron's timezone must be configured explicitly using host-supported facilities. The gateway containers currently have restart policy `no` (checked 2026-10-14), so a crashed container stays down. The prod line therefore targets whichever replica is running. A failed run leaves the previous generation serving, and `stale` surfaces repeated failures.
5. Run manually first: inspect table counts, unmatched units, duration, peak memory, source temporary files, and disk (`SELECT pg_size_pretty(pg_database_size('demeter_cache'));`). Measure during the build with both generations present. Adjust budgets/timeouts before scheduling. The job shares container resources with HTTP traffic; if contention occurs, stop scheduling and adjust its execution context manually.

## Pre-implementation check (user-run)

Check linked-técnico coverage before implementation. The author reported ~261k active 2026 atendimentos, ~15k without login (unverified). These literal dates match **2026-10-14**; update them for the actual run. Production queries remain parameterized.

```sql
SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE a.login_usuario IS NOT NULL) AS com_login,
       COUNT(*) FILTER (WHERE NOT EXISTS (
         SELECT 1 FROM at_atendimento_usuario au WHERE au.id_at_atendimento = a.id_at_atendimento)) AS sem_vinculo_tecnico,
       COUNT(*) FILTER (WHERE a.login_usuario IS NOT NULL AND EXISTS (
         SELECT 1 FROM at_atendimento_usuario au JOIN usuario u ON u.id_usuario = au.id_usuario
         WHERE au.id_at_atendimento = a.id_at_atendimento AND u.login_usuario = a.login_usuario)) AS login_entre_vinculados
FROM at_atendimento a
WHERE a.ativo = true
  AND a.data_inicio_atendimento >= DATE '2025-10-01'
  AND a.data_inicio_atendimento < DATE '2026-10-14';
```

- `sem_vinculo_tecnico` near zero supports coverage; the author must still confirm linked users represent técnicos.
- `login_entre_vinculados` near `com_login` supports agreement where login exists. Resolve large gaps before building this dimension.

## Verification

- **Agent:** `npx tsc --noEmit` and `node --import tsx --test` for new test files.
- **User, dev:** before hmg is deployed, run one manual refresh with `docker exec graphql_server_dev npx tsx src/jobs/refreshAtendimentosCache.ts` after pointing dev's `DATABASE_URL` back at Demeter HMG; the safety line refuses it while dev points at PROD. Then query month, month/programa, and top técnicos. Check empty results and cap overflow/`truncated`.
- Compare one programa/month and multi-month ungrouped distinct totals against Demeter; never validate by summing grouped distinct counts.
- Exercise concurrent read/publication, failed load/swap rollback, missing config/first generation, and overlapping jobs. Confirm matching metadata/results and advisory-lock skips.
- Verify timings/resources before scheduling. Agents must not run database/container/live-endpoint checks.

## Out of scope

- Alternative engines, generic storage adapters, GraphQL exposure, and consumer charts/averages.
- Incremental refresh: no verified change feed; gateway writes do not explicitly advance `dt_update_record`, child changes may not advance parent timestamps, and the timestamp is unindexed. Upstream triggers are unverified; full rebuilds handle removals of rows leaving the date range simply.
- Phase 2 cached produtor lists/fresh endpoints require a separate plan; they would use their own schema pair (such as `produtores`/`produtores_build`) in the same database.
