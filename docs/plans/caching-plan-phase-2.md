# Caching plan: phase 2 (ideas)

High-level direction for serving slow consumer reads of produtores, propriedades, and atendimentos from the local cache, building on [phase 1](caching-plan-phase-1.md). This is not an implementation plan: it needs the first steps below and a detailed plan before any code. Review notes: [caching-plan-phase-2-review.md](caching-plan-phase-2-review.md).

This document does not authorize agents to access databases, provision containers, deploy, or schedule jobs.

## Problem

Some consumer requests take about a minute, mostly spent in Demeter joins through `at_cli_atend_prop`: roughly 8 million rows, and no index on its foreign-key columns. Demeter's indexes cannot be changed. The local cache can be indexed freely, so the win comes from never running that join in Demeter during the day.

Confirmed facts:

- 500–2,000 atendimentos per working day, none on weekends or holidays, and about 352,000 over twelve months (phase 1's prod run).
- `at_cli_atend_prop` is append-only: rows are never updated or deleted. Correcting an atendimento's produtor or propriedade creates a new atendimento, deactivates the old one, and adds new link rows; the old links stay. It receives about 3,000–10,000 rows per working day (typically 4,000–5,000), because events such as courses link dozens of produtores.
- `at_atendimento` does change in place: `ativo`, and fields edited through this gateway.

## Principles

- **Best-effort freshness.** Demeter's own data has flaws, and cached endpoints serve macro and operational reads, not exact accounting. Rare gaps are accepted and reconcile at the next nightly rebuild. Don't add machinery for unlikely edge cases.
- **Cache first, Demeter as fallback.** A cached endpoint reads the cache first. Any cache error (unavailable, timeout, or unexpected) is logged and the request continues on its existing Demeter path, so the cache never reduces availability. Cache reads use short timeouts, around 1–2 seconds, to keep the fallback cheap. Cache writes (read-through fills, write hooks) are best effort and never fail the request. Phase 1's aggregates route is the exception: it keeps returning 503, because its Demeter equivalent is the expensive query.
- **Opt-in per endpoint.** Existing endpoints may switch to cache-first: response shapes stay the same and only freshness changes, which still needs the consumer audit and sign-off in AGENTS.md. Routes that need exact current data, such as PNAE's passivo atendimento queries or certificates, stay direct.
- **A few stable columns.** Cache IDs, dates, units, links, and identity data such as produtor name, CPF, sex, and date of birth. Fields edited in place, such as validation status, SEI and export dates, or temas, stay on Demeter.
- **Daytime fetches use indexes only:** primary-key ranges, `= ANY` on a primary or unique key or its leading column, or unique keys such as `ger_pessoa.nr_cpf_cnpj`. Never filter Demeter on an unindexed column such as `at_cli_atend_prop.id_pessoa_demeter` or its `dt_update_record`.
- **Index the cache for the selected queries**, for example `id_at_atendimento` and `id_pessoa_demeter`.
- **Start small.** One endpoint and the data it needs first; extract shared helpers when reuse appears.

## Data and refresh

| Data | Refresh |
| --- | --- |
| Atendimentos and their produtor, programa, and técnico links (phase 1's rolling range, which the daytime tail extends through today) | Nightly full rebuild, plus a daytime tail every 2 hours from 06:00 to 18:00, registered later in the same [in-app scheduler](cache-jobs-scheduler-task.md) |
| Produtores and propriedades (5–8 small columns) | Accumulated in their own schema, never swapped or evicted. Missing IDs are fetched by primary key by both jobs and on read misses; existing rows are not refreshed daily |
| Usuarios, municipios | Nightly |

- **Produtores and propriedades** start at about 100,000 produtores for a year of atendimentos and grow by roughly 50,000 a year: tens of megabytes. Keeping them outside the swapped schema means a produtor assisted again after thirteen months is still cached. Each job compares the produtor and propriedade IDs it sees with the cache and fetches only the missing ones. Identity data rarely changes, so existing rows are not re-fetched daily; an optional weekly or monthly re-sync by primary key can bound drift if it ever matters. Coverage is every produtor and propriedade linked to an atendimento since the cache started, plus lookup fills; a list of all Demeter produtores stays direct.
- **Nightly** stays as in phase 1: a full, reliable rebuild and swap of the atendimento data. It then fetches missing produtores and propriedades, and records one high-water mark each for `at_atendimento` and `at_cli_atend_prop`: the highest source ID visible in its snapshot, including rows it excluded from the cache.
- **Daytime tail** continues from those marks:
  1. Fetch `at_cli_atend_prop` rows above its mark in primary-key batches of about 10,000 until caught up; a working day usually fits one batch. Because the table is append-only, the mark finds every new link; a small overlap only covers IDs that commit out of order. For each batch, also fetch every atendimento its links reference by primary key, whatever its ID, and upsert or skip it by the eligibility rule in step 5. This covers links added to older atendimentos.
  2. Fetch `at_atendimento` rows above its mark too, replaying a generous overlap of a few working days. This catches atendimentos without links and `id_at_anterior` replacements, and the replay upserts recent rows, picking up their `ativo` flips and edits.
  3. For the new atendimentos, fetch programa and técnico links with `id_at_atendimento = ANY(...)`, the leading column of those tables' primary or unique keys.
  4. Fetch only the produtores and propriedades missing from the cache, by primary key. Usually none are missing, and the run ends after the link inserts.
  5. Apply predecessor removal (below) first, then skip rows that are inactive or outside the cached range: the nightly build's start date, through today.
  6. Write each batch and its mark advance in one cache transaction. A failed batch keeps the previous mark and is retried at the next run.
- **Idempotency:** store source primary keys, such as `id_at_cli_atend_prop`, with unique keys, and upsert, so replaying an overlap never duplicates rows.
- **Soft deletes:** a new atendimento whose `id_at_anterior` points at a cached one removes that predecessor and its links. A deactivation without a replacement row, older than the overlap, reaches the cache at the next nightly run.
- **Gateway writes:** this repo's own atendimento writes, the PATCH routes and GraphQL mutations such as `updateAtendimento` (which can change `ativo`, the date, and the unit), refresh the affected cached rows by primary key after Demeter commits. A cache failure is logged and never changes the write's existing response; the nightly rebuild repairs it.
- **Coordination:** the advisory lock only coordinates jobs; requests never wait on it. A gateway write or read-through fill made during the few-minute 01:00 build can be overwritten by the swap. That is accepted: read-through refills on the next miss, the morning tail's overlap catches inserts, and the next nightly rebuild fixes the rest.

## Reads

- **Field and dataset coverage:** an existing endpoint serves from the cache only when every requested field (`getRequestedFields`) is cached **and** the cache holds the whole result set it would return; otherwise it takes its existing Demeter path unchanged.
  - Qualifies: ID or CPF lookups, which read through, and atendimento lists within the cached range.
  - Doesn't qualify: filtered produtor or propriedade lists, such as produtores of a municipio, because the cache holds only produtores linked to cached atendimentos. They keep their Demeter path, or become new endpoints explicitly scoped to that population.
- **ID lookups**, such as a produtor by ID or CPF, read through: serve from the cache, fetch misses from Demeter by that key, and store them.
- **Relationships** such as a produtor's propriedades or atendimentos are answered from cached tables only; fetching them from Demeter would mean a foreign-key lookup on the expensive table.

## Freshness

- Inserts between 06:00 and 18:00: visible after the next successful tail run.
- Inserts after 18:00: next nightly rebuild; read-through may fill specific IDs earlier.
- Rare commits behind the overlap, deactivations without a replacement older than the overlap, and atendimento edits made directly in Demeter: next nightly rebuild.
- Produtor and propriedade edits in Demeter: only at an optional re-sync; accepted for identity data.
- Failed runs: the last data keeps serving, and its timestamps show its age; cached endpoints fall back to Demeter on errors.

## Daytime freshness for phase 1 aggregates

The daytime tail writes today's rows into phase 1's `atendimentos` tables, but the aggregates stay nightly-scoped at first: `POST /api/atendimentosCache/aggregates` caps dates at `refresh_info.range_end` (yesterday), so today's rows don't change its results. Small intraday drift from updates to older rows, such as deactivations or gateway writes, is accepted.

Dropping that cap later gives the aggregates daytime freshness with no other read-side change. That needs:

- **Programa and técnico links** for new atendimentos (tail step 3), already fetched, or new atendimentos fall into null programa/técnico buckets.
- **The tail time recorded separately** from `snapshotAt`, so the nightly snapshot time and the tail time both stay truthful.
- **Accepting nightly-only lookups.** A programa, técnico, or unit created during the day appears with its ID but a null name until the nightly rebuild.

## First steps

1. Pick the slowest useful endpoint. List its fields, filters, ordering, coverage, and the delay it tolerates.
2. Confirm the remaining assumptions: replacements set `id_at_anterior`, and edits made outside this gateway to cached atendimento fields are rare.
3. Choose the cached columns, the schema layout (phase 1's `atendimentos` schema extended, plus a separate accumulating produtor/propriedade schema), and whether produtores get a periodic re-sync.
4. Write the detailed plan: high-water marks, batch transactions, fallback timeouts, indexes, API contract, and a short list of user-run checks (counts against Demeter, a replacement, a new link on an old atendimento, a gateway write, a cache outage falling back to Demeter).
