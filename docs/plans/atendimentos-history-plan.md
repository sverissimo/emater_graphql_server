# Atendimentos history (closed years)

Store a fixed set of yearly aggregates for closed years in the existing cache database (`demeter_cache`), built once per year and never refreshed. This complements [phase 1](caching-plan-phase-1.md)'s rolling twelve-month window with long-term trends, without caching detail rows for past years.

**Accuracy target: macro figures, not exact accounting.** These numbers feed an executive dashboard used by the company's CEO for macro trends and diagnosis. Discrepancies affecting a small share of atendimentos, on the order of 0.5%, are accepted and need no handling. Examples: late entries or soft deletes after a year is built, programas deactivated later, units outside the municipio lookup grouped under null geography, and typo dates. Such differences would not change a decision. Prefer the simplest approach that meets this target; never add sync, reconciliation, or provisional flags to chase exactness.

This plan does not authorize agents to access databases, provision containers, deploy, or schedule jobs.

## Scope

- **Storage:** a separate schema, `atendimentos_history`, in `demeter_cache`. It holds aggregates only, and the nightly phase 1 job never touches it.
- **Years:** every closed calendar year, from the first year with meaningful data through last year (2025 as of 2026-10). Exclude typo years such as 0220 and 9999; the lower bound is chosen from the data during implementation.
- **Definitions:** the same as phase 1, evaluated when each year is built: active atendimentos, active programas through `at_atendimento_indicador` → `at_indicador`, geography from `getMunicipiosEmater()`, produtores and propriedades through `at_cli_atend_prop`, and técnicos through `at_atendimento_usuario`.

## Breakdowns

A fixed initial set. Each row carries exact `COUNT(DISTINCT …)` values for atendimentos, produtores, and propriedades within that row:

- year (plus distinct técnicos per year)
- year × month
- year × programa
- year × regional

Confirm the final list against the dashboard's needs before implementing. Distinct counts cannot be combined afterwards: figures across several years or other dimensions need their own one-off query. Never sum stored rows to produce them.

## Build

- **Entry point:** `src/jobs/buildAtendimentosHistory.ts`, taking one year (or a range, processed one year at a time). The user runs it by hand from a prod replica, off-hours, against Demeter PROD. It has the same PROD safety line as the refresh job.
- **Per year:** compute every breakdown with set-based queries in one read-only snapshot, then replace that year's rows in a single cache transaction. Re-running a year is therefore safe. Record each year's `built_at`.
- **Schedule:** build all closed years once. Then append each newly closed year once a year, for example in March, after most late entries have arrived. Re-running older years is optional and rarely worth it, given the accuracy target.
- **Cost:** the heavy part is joining `at_cli_atend_prop` (about 8 million rows, no foreign-key indexes) across full history. Per-year runs keep each query bounded. Measure the first runs, and raise the 15-minute statement timeout only if a year needs it.
- **Code:** follow the AGENTS.md code style, as in `modules/atendimentosCache/`, with SQL in `queries/` and logic in classes.

## Read

- `POST /api/atendimentosCache/history` returns the stored rows for one breakdown and an optional year range, with each year's `built_at`. It returns 503 when the schema has not been built, like the aggregates route. Consumers handle labels, charts, and averages.
- **Boundary with phase 1:** history holds complete closed years, and `aggregates` holds the rolling window. Their months can overlap, for example October–December 2025. Consumers must never add figures across the two sources; a dashboard picks one source per period.

## Out of scope

- Detail rows, scheduled refreshes, or incremental updates for closed years.
- Exact reconciliation with Demeter (see the accuracy target).
