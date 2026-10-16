# Cache jobs: in-app scheduler task

Replace the proposed host cron (never installed) with a small Node scheduler inside the gateway. Phase 1 is already deployed; this task changes scheduling only, not cache extraction or API contracts.

Read [AGENTS.md](../../AGENTS.md), [phase 1](caching-plan-phase-1.md), [phase 2](caching-plan-phase-2.md), [main.ts](../../src/main.ts), the [manual job](../../src/jobs/refreshAtendimentosCache.ts), and [AtendimentosCacheRefresh](../../src/modules/atendimentosCache/refresh/AtendimentosCacheRefresh.ts).

## Runtime design

- Add `CacheJobsScheduler` under `src/jobs/`, with plainly named orchestration methods and relative `.js` imports. Follow the current Clean Code/KISS preferences; no generic task framework.
- Start it once from `main.ts` after HTTP starts, only when `CACHE_JOBS_ENABLED === "true"`. Missing, empty, or any other value disables it. Do not infer scheduling from `NODE_ENV`.
- The user sets this flag only in `.env.homolog` and `.env.production`; dev leaves it unset and never schedules. Add only `CACHE_JOBS_ENABLED=` to `.env.example`; agents do not edit real env files.
- Register `0 1 * * *` in `America/Sao_Paulo`. No immediate startup run or automatic catch-up. At implementation, check the installed Croner version's documented timer-unref support and prefer it so an idle scheduler does not keep the process alive. If unavailable, use a minimal existing server-drain hook to stop scheduling. Keep normal job cleanup; add no framework for draining active jobs.
- Phase 2's future daytime tail (every two hours, 06:00–18:00) will be another entry in this scheduler; do not implement or design it here.
- Run the scheduler in every enabled replica, including all three prod replicas. Reuse the existing dedicated-connection PostgreSQL advisory lock; overlapping attempts skip. No leader election, queue, extra lock, or per-replica configuration.
- The lock prevents overlap, not exactly-once execution: a late replica can run after another finishes. Accept that best-effort possibility; do not add coordination for it.
- Each callback creates a fresh, single-use `AtendimentosCacheRefresh` and awaits `run()`. It catches/logs failure and waits for the next scheduled time; no immediate retry and no gateway exit or exit-code change.
- Use the shared Winston logger for registration, job outcomes, and errors. Add console output when scheduling is enabled so info logs reach normal gateway/container logs; reuse an existing console transport to avoid duplicates. Production currently has only an error-file transport. No cron redirects or separate log pipeline.

## Shared source safety

- Move the existing PROD-source refusal into the shared refresh path, preferably the start of `AtendimentosCacheRefresh.run()`, before job-owned client initialization/connections.
- Preserve the exact condition and refusal message: `NODE_ENV !== "production"` and uppercased `DATABASE_URL` contains `PROD`. This is a source safety check, not the scheduling gate.
- Throw on refusal instead of setting `process.exitCode` in shared code. The manual entry point still logs/exits 1; the scheduled callback logs/continues. Defer the class's current client field initialization until after the guard.
- Keep `src/jobs/refreshAtendimentosCache.ts` usable for manual `docker exec` runs. It calls the shared implementation, with no duplicated guard. The scheduler calls the job class, not the self-executing CLI file.

## Library and prerequisite

Choose **Croner**: one runtime dependency, with timezone-aware cron scheduling and no runtime dependencies of its own, avoids hand-maintained timer/calendar calculations. The user runs `npm install croner` and commits the manifest/lockfile baseline before any agent-loop implementation run; the loop stops on package-manifest edits.

A dependency-free timer using São Paulo calendar calculations is possible under Brazil's current no-DST rules; it needs more scheduling code, so do not choose it here. Context7 verification hit its quota during drafting; verify current Croner documentation before implementing its API.

## Implementation deliverables

- Scheduler class and bootstrap wiring in `main.ts`; shutdown wiring only if the timer-unref alternative is unavailable. Optional module-local constants only when useful.
- Shared refresh guard/client initialization adjustment and the preserved manual entry point.
- Empty `.env.example` key and normal logger visibility; no source/cache schema changes.
- Update `AGENTS.md` when implementing: correct the inaccurate "Host cron runs it" line (cron was never installed), document the scheduler/flag, explain HTTP startup wiring and the manual job, and adjust the jobs-folder description. Leave AGENTS.md unchanged during this documentation task.
- Pure unit tests for strict flag parsing, schedule/timezone configuration, and the source guard. Tests import side-effect-free logic, start no real timers, create no database clients, and need no env files. No mocked scheduler/lifecycle framework.

## Verification and user rollout

- Agent: run `node node_modules/typescript/bin/tsc --noEmit --incremental false`, the focused tests via `node --import tsx --test <explicit paths>`, Markdown link checks, and Git whitespace checks.
- User: install Croner first; set `CACHE_JOBS_ENABLED=true` in hmg/prod env files only; manually rebuild and deploy those gateway images. No host cron installation or output redirects.
- User: check registration logs after startup and success/skip/error logs after 01:00 São Paulo time, plus the cache snapshot timestamp. Missing runs are not replayed; the existing response's `stale` flag covers prolonged failure.
- Preserve existing GraphQL/REST behavior, BigInt/date encoding, source safety, refresh cleanup, and advisory-lock behavior. No phase 2 tail, startup refresh, durable scheduling, or extra coordination in this task.
- No installs, builds, database/container operations, live requests, or Git mutations by the agent. Code and operational changes happen only in the later implementation/user rollout.
