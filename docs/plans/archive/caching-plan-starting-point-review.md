# Review of the Demeter caching starting point

Reviewed on 2026-10-13 against [the proposal](../caching-plan-starting-point.md), [AGENTS.md](../../../AGENTS.md), the checked-in Prisma schema, repository implementations, and production compose configuration. Database options were checked against official documentation. No database, live endpoint, or container was accessed; row counts, actual upstream version, mutation patterns, and performance remain unverified.

**Score: 8/10 as a starting idea. Yes, this is a good direction.** Moving repeated reporting work away from an external database whose indexes you cannot control addresses a real architectural constraint. Limiting history, accepting delayed reporting, and making phase 2 optional are sensible decisions. The missing two points are mainly about counting semantics, extraction cost, and refresh correctness. Those need decisions before implementation, rather than a more elaborate cache framework.

I would proceed with a small phase 1. I would not yet commit to copying 10–20 tables or implementing incremental synchronization.

**What is strong**

- Reporting tolerates delayed data much better than login, authorization, or write workflows. That makes it a suitable first use case.
- The proposal identifies `at_cli_atend_prop` as an important bottleneck. The checked-in schema declares no index on its `id_at_atendimento` column.
- A limited history and narrow column selections can reduce transfer and local storage substantially.
- Serving small JSON responses keeps the consumer apps simple and avoids sending millions of rows over HTTP.
- Phase 2 is explicitly optional. Preserve that boundary instead of making phase 1 carry every possible future client requirement.
- A full daily refresh is a useful correctness baseline. It is easier to explain and verify than a custom change-tracking system.

**Finding 1 — this is a reporting dataset with a refresh pipeline**

The existing six-hour repository caches hold relatively small lookup datasets inside each process. This proposal introduces persistent facts, cross-table consistency, aggregation, refresh scheduling, and failure recovery. That deserves its own reporting dataset rather than extending those small caches into a general-purpose abstraction.

Keep the implementation inside this repository: source reads through repositories, refresh orchestration in a cohesive service, and thin new read resolvers/routes. Keep the existing Demeter Prisma schema separate from any locally owned storage schema. The prohibition on migrating Demeter remains absolute.

**Finding 2 — define the counts before choosing storage**

A join can produce mathematically valid rows and still produce incorrect business totals. For example, one atendimento with two indicators, three producer/property associations, and two users can produce 12 rows in a flat join. `COUNT(*)` would not mean 12 atendimentos.

Suggested initial definitions, subject to business confirmation:

| Metric | Suggested meaning |
| --- | --- |
| Atendimentos | Distinct active `id_at_atendimento` within the requested period and scope |
| Atendimentos per programa | Distinct atendimento/programa pairs; multiple indicators mapping to the same programa count once |
| Produtores atendidos | Distinct `id_pessoa_demeter` across the entire requested period and scope |
| Propriedades atendidas | Distinct non-null `id_pl_propriedade` across the entire requested period and scope |
| Producers/properties per programa | The same distinct IDs, restricted through deduplicated atendimento/programa associations |

An atendimento belonging to two programs can legitimately count once in each. Therefore the sum of program counts can exceed the overall distinct atendimento count. Explain that in the eventual API documentation.

Do not assume `at_grupo_indicador`, `at_produto`, and “sector” are interchangeable. The [cheat sheet](../../atendimento.chat-sheet.js) shows how one PNAE indicator links to a group and a product; it does not establish a company-wide program taxonomy. Choose the reporting dimension explicitly.

For averages, define the numerator and denominator and retain both if aggregating intermediate results. Averaging monthly averages generally produces the wrong answer.

**Finding 3 — monthly totals cannot answer every date filter**

Monthly attendance totals cannot answer a range such as January 10–20 exactly. Daily attendance totals can support arbitrary whole-day ranges when their dimensions and deduplication rules match the query.

Distinct producers and properties are harder: a producer seen in January and February should count once for the combined period. Adding the monthly distinct counts would count that producer twice. The same issue arises across municipalities and programs.

For flexible date ranges and exact distinct metrics, retain the minimal local facts and relationship IDs needed to compute them. Precompute useful summaries for speed, but do not discard the information needed for deduplication. If phase 1 only needs a fixed set of monthly outputs, publishing those outputs alone is an even smaller valid scope.

**Finding 4 — incremental fetching must handle removals and relationship changes**

The proposal correctly notices the soft-delete problem. Fetching only IDs above the last imported ID would leave old cached atendimentos active after they become inactive upstream. Reading only currently active source rows also cannot tell an incremental destination which previously imported rows to remove.

The actual previous-row column is `id_at_anterior`. Following replacement chains can help investigate data, but it is not a complete change feed: a record might become inactive without an imported replacement, and relationship changes can happen independently.

The schema contains nullable `dt_update_record` fields, but their existence does not prove every relevant update advances them. Several gateway write methods do not explicitly set that field, including validation changes and theme/visit updates. Database triggers might maintain it; that has not been verified. `data_atualizacao` is a date, not a precise timestamp. Neither should be assumed to be a reliable synchronization cursor.

Even the statement that a distant child-table change “won't matter” needs qualification: it matters if it changes the parent atendimento's active status or any dimension used in a report.

My recommendation is a full daily rebuild first. If measurements later justify incremental work, it must discover changed parents and children, reconcile inactive records, handle late commits/backdated entries, and periodically compare against a full rebuild. A recent-date overlap alone cannot guarantee discovery of corrections to older rows.

**Finding 5 — filtering the output does not guarantee a cheap extraction**

The checked-in `at_atendimento` schema declares no index on `data_inicio_atendimento` or `ativo`. Filtering to two years can reduce transferred rows while still requiring a large source scan. The estimated reductions are hypotheses, not capacity measurements.

Avoid extracting a small batch of atendimento IDs and repeatedly querying the unindexed `at_cli_atend_prop.id_at_atendimento` for every batch. That can cause repeated full scans of the same large association table.

The extraction design should aim for a bounded number of source scans per refresh, narrow projections, and streamed/batched transfer. Candidate approaches include a source-side set-based join or scanning the association once and retaining only relevant IDs locally. Pick between them using user-run measurements; neither is automatically cheaper on the source.

Do not reuse the existing manual-report list as the bulk extraction API. It filters specifically to manual reports, hydrates display data, and its repeated child loads are designed for UI pages. General company reporting has different membership and loading requirements.

A daily rebuild remains provisional until its duration and upstream load are acceptable. If it is too expensive, reduce the first dataset or frequency before adding complicated synchronization.

**Finding 6 — geography is a business rule, not just a lookup**

`at_atendimento.id_und_empresa`, a producer's unit, and a property's unit can differ. Decide whether a report attributes work to the atendimento's responsible unit or to the producer/property location. For initial activity reporting, the atendimento unit is a reasonable proposed default, not an established rule.

The existing `getMunicipiosEmater()` returns active `H%` units with valid municipalities and active `G%` parents. It is useful, but does not cover every historical/inactive unit or a directly assigned regional unit. Keep unmatched records in an explicit unknown category instead of silently dropping them.

Also decide whether historical results use today's unit-to-regional hierarchy or the hierarchy at the time of the atendimento. The current lookup provides today's mapping; historical attribution would require additional evidence/data.

Build a small unit lookup once per refresh. Let the local query engine filter and aggregate large fact datasets; use TypeScript for orchestration and small result transformations.

**Finding 7 — publish complete refreshes and expose their age**

Rebuild into a separate generation, validate it, then atomically make that generation available. Readers should see one complete generation across facts, dimensions, and summaries. Do not clear the currently served dataset before its replacement succeeds.

Atomic publication does not itself make upstream reads consistent. Tables read at different times can reflect different source states. PostgreSQL supports a stable snapshot across reads in a repeatable-read transaction, including in the documented 9.6 version. A long extraction transaction has operational costs; the implementation plan must choose between that approach and explicitly documented extraction-time drift. [PostgreSQL 9.6 isolation documentation](https://www.postgresql.org/docs/9.6/transaction-iso.html).

Expose metadata such as `generatedAt`, `extractionStartedAt`, the reporting period, and a generation ID on the new reporting surface. “Data until yesterday” alone is ambiguous: a midnight job can still run for hours or fail, and today's state may revise older business dates. Decide an acceptable age and what consumers should display once it is exceeded.

On refresh failure, retain the last successful generation and report its actual age. With no successful generation, return an explicit unavailable result rather than an empty report implying zero activity. Avoid automatically falling back to an expensive source query for every dashboard request.

**Finding 8 — one refresh owner, durable storage, bounded resources**

The [production compose file](../../../docker-compose.prod.yaml) declares three gateway replicas, each with a 2 GB memory limit. These are configuration facts, not verified running-container measurements. Loading millions of JavaScript objects per replica would duplicate memory and extraction work. A refresh timer in every replica could also launch three competing rebuilds.

Choose one refresh owner and durable shared output/storage. Scheduling and deployment remain manual user operations; this review does not authorize cron edits or container changes. Keep batch processing from consuming the HTTP server's resources without limits.

For perspective, the proposal's example seven-column row contains roughly 45 bytes of values before row/string overhead, indexes, serialization, and working memory. Two million such rows represent about 90 MB of values for one table. Multiple tables, join state, old/new generations, and JavaScript object overhead make that a poor estimate of peak RAM. Measure storage, peak memory, temporary disk, and refresh time together.

**Database choice — a short shortlist, not a universal speed winner**

For the described shared gateway with flexible filters and exact distinct metrics, my provisional first choice is a **locally owned PostgreSQL reporting database**. It fits the existing SQL/`pg` skills, preserves relationship IDs naturally, and supports a shared transactional publication model. Its local schema and indexes would be under your control; Demeter's missing-index constraint does not transfer to that database. PostgreSQL has a permissive open-source license. [Index documentation](https://www.postgresql.org/docs/current/indexes.html), [license](https://www.postgresql.org/about/licence/).

This is a deployment-fit judgment, not a claim that PostgreSQL is the fastest or lightest analytical engine. If phase 1 is narrowed to one batch process producing fixed reports, **DuckDB is the strongest alternative to benchmark**, and could be the better choice for your speed/lightweight priority.

| Candidate | Fit for this project | My assessment |
| --- | --- | --- |
| Local PostgreSQL | Shared queries from three replicas, relational facts, distinct counts, controlled publication | Default candidate for the full described serving model |
| DuckDB | A batch builder doing large joins/aggregations and publishing immutable report outputs | First alternative for a smaller batch-oriented phase 1 |
| ClickHouse | A substantially larger or more demanding analytical workload | Revisit if representative benchmarks justify additional operational and data-model complexity |

DuckDB is embedded, MIT-licensed, and specifically designed for analytical joins and aggregations. Its ordinary native-file mode allows one read/write process, or multiple read-only processes with no writer. Do not plan on three gateways and a refresher concurrently opening the same mutable native file. Immutable generations or a single owner are possible designs, but introduce publication/connection management. New client/server options exist; adopting them is a separate decision, not required for this project. [DuckDB design](https://duckdb.org/why_duckdb), [concurrency documentation](https://duckdb.org/docs/current/connect/concurrency).

ClickHouse is Apache-2.0 licensed. Its incremental materialized views do not automatically reconcile changes to joined right-side tables, so picking it would not solve the source-change problem. [License](https://github.com/ClickHouse/ClickHouse/blob/master/LICENSE), [materialized-view documentation](https://clickhouse.com/docs/concepts/features/materialized-views/incremental-materialized-view).

I would not spend this phase benchmarking every named database. Redis/Dragonfly can be useful for finished response caching, but making a key-value store the relational fact layer would move join/distinct logic into application code. MongoDB/CouchDB/Cassandra have no demonstrated advantage for the specified workload that warrants adding them to the first shortlist. These are workload-fit judgments, not measured performance rankings.

Benchmark the few required reports on representative local data: cold/warm latency, concurrent reads during refresh, peak memory, disk including temporary files, import time, and correctness. Include extraction cost in the overall decision. Millions of rows alone cannot identify a winner.

**The smallest first implementation I would plan**

1. Define one report: active atendimentos per agreed programa and day, filterable by atendimento municipality/regional. Specify dates, unknown geography, and deduplication.
2. Extract only the required atendimento, indicator, program, and unit columns. Add `at_cli_atend_prop` and producer/property IDs when their metrics enter scope. Names, CPF, addresses, file binaries, and complete user graphs are unnecessary for those counts.
3. Use one scheduled full rebuild and one independently published complete generation. Keep the previous generation if refresh fails.
4. Add one reporting read surface with freshness metadata. Preserve the existing APIs and their live-data behavior.
5. Validate against tiny fixtures covering multiple indicators for one program, several programs, repeated producers across dates, null properties, inactive/replacement rows, unknown units, failed refreshes, and publication during reads. Have the user run source-load and live comparisons manually.
6. Extend to exact producer/property metrics after the first report proves useful and affordable. Leave incremental refreshes and existing-endpoint substitution for later decisions.

This keeps phase 1 valuable even if phase 2 never happens. Substituting stale data behind an existing endpoint changes observed behavior even when its JSON shape stays identical; any later phase 2 change still needs a consumer audit and sign-off under AGENTS.md.

**Smaller tweaks to the starting document**

- Choose between a rolling two-year window and a fixed `2025-01-01` start. They diverge as time passes. Also specify the business-date column, timezone, inclusive/exclusive boundaries, and whether today is included.
- Distinguish event date, source modification time, and extraction time. They answer different questions.
- If using rolling retention, expire facts and their associations as they leave the window. Full rebuilds make this straightforward.
- Say “daily” or “weekdays only” deliberately. A weekday-only rebuild can leave several days of lag over weekends.
- Mark upstream row counts, PostgreSQL version, reduction percentages, and mutation assumptions as reported/unverified until the user supplies measurements.
- Correct `at_atendimento_anterior` to `id_at_anterior`, and use the existing name `getMunicipiosEmater`.
- Fix the duplicated section numbering and use relative Markdown links for the schema and cheat sheet.
- Replace “fastest database” with a measurable target for the actual reports, refresh duration, and resource budget. Favor newer technology only when it improves those measurements.

**My recommendation:** proceed with phase 1 as a small daily reporting snapshot. The potential win is substantial, but accurate metrics and affordable extraction matter more than building a sophisticated cache. The first implementation should prove those two things.
