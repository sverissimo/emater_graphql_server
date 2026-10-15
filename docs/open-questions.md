# Open questions

Record non-blocking unknowns under `## <run-name>` using the coordinator's run
name (or a descriptive task name for manual work). Keep the affected work
explicitly pending and continue with the parts supported by evidence. Never
include credentials, env values, or private report contents.

Use this format:

```md
## gateway-cache-plan

- Q: Which behavior should apply? (pending: the affected behavior)
  Answer:
```

The user fills in `Answer:`. A later task applies answered entries in its own
section and any earlier section explicitly named by the task. Remove an entry
only after fully applying its answer, then remove empty sections. Blocking
questions belong in `needs_user` or a direct clarification to the user.

## atendimentos-cache-refresh

- Q: Should `@types/pg` become an explicit devDependency? The new pg repositories currently type-check against `@types/pg` 8.20.0, installed only transitively through `@prisma/adapter-pg` (see `package-lock.json`); a future adapter release could drop or change it. (pending: adding `@types/pg` to `package.json` devDependencies and refreshing the lockfile, both outside this run's scope)
  Answer:
- Q: Does `@prisma/adapter-pg` 7.8.0 apply the extra `pg` pool options passed through `createPrismaClient(REFRESH_CONNECTION_OPTIONS)` (statement and connection timeouts) to the job's lookup connection? The options type-check as `pg.PoolConfig`, but documentation lookup was unavailable during this run. (pending: user confirmation during the manual dev refresh, e.g. a Demeter `pg_stat_activity` row with `application_name = 'refreshAtendimentosCache'` besides the source cursor connection while the refresh runs)
  Answer:
