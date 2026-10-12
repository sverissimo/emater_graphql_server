# AGENTS.md — emater_graphql_server

> This file is the canonical agent-instructions document for this repo. `CLAUDE.md` at the repo root is a symlink to it, so Claude Code, Codex, Cursor, and any other AGENTS.md-aware tool all read the same content. Edit either path — they point to the same file.

Apollo Server v5 + Express 5 GraphQL gateway (TypeScript, ESM, Prisma 7 + PostgreSQL). Runs alongside the other apps under [/home/apps/](../) and acts as the **shared gateway to the external Emater "Demeter" database**: every fullstack app on this host that needs Demeter data reaches it through this service. Also exposes a small REST surface at `/api/*` for callers that don't speak GraphQL (legacy login, enum lookups, atendimento writes).

## Project Snapshot

- **Role:** central gateway from the apps on this host to the external Demeter DB. Read-heavy plus a few writes (atendimento create/update, produtor create, login, temas/numeroVisita sync).
- **Stack:** Node 22/24 (dev/hmg/prod images), TypeScript ESM (`"type": "module"`, all relative imports use `.js`), Apollo Server v5 over Express 5, Prisma 7 client, Winston logging, `jsonwebtoken` for service auth, `ldapts` for user login.
- **Two surfaces in one process:**
  - GraphQL at `/` (Apollo middleware) — typedefs merged at runtime from every `src/modules/**/*.graphql`, resolvers composed in [src/schema/resolvers.ts](src/schema/resolvers.ts).
  - REST at `/api/*` — [src/routes.ts](src/routes.ts) is a thin composer that mounts route groups from [src/routes/](src/routes/): `enumRoutes` (enum lookups, including `GET /getMunicipiosEmater`), `atendimentoRoutes` (read-only flags, `updateTemasAndVisitaAtendimento`, `aprovarAtendimento` / `criarPendenciaAtendimento`, `aprovarSei` / `removerAprovacaoSei`, `GET /getArquivos?atendimentoId=&fileType=<tipo_arquivo MIME>` — returns the lowest-`id_at_arquivo` active `at_arquivo` binary as `{ arquivo }`, or `{ arquivo: null }` on a miss; consumed by the PNAE backend's raw file-download path — and `GET /getArquivosAtendimento?atendimentoId=` — returns **every** active `at_arquivo` of the atendimento, id asc, as `{ arquivos: [{ idArquivo, tipoArquivo, arquivo }] }`; consumed by the PNAE backend's combined manual-PDF assembly), `authRoutes` (login), plus `routeHelpers` (`routeParam`, `restErrorHandler`) and `dependencies` (shared repos/services).
- **Package manager: npm.** This repo was on pnpm and was just migrated back to npm; `package-lock.json` is the lockfile and `packageManager` is intentionally absent from [package.json](package.json). If you see a `pnpm-lock.yaml` reappear, it's a mistake.
- **Three Docker environments** sharing the same source tree: `dev` (published port 4000, `demeter_gateway_dev` network, `Dockerfile.dev`), `hmg` (1 replica, fixed container name `graphql_server_hmg`, `demeter_gateway_hmg` network), `prod` (3 replicas behind nginx, external `demeter_gateway_prod` network). Dev uses a `tail -f /dev/null` image and runs the dev process from the host-mounted source via `npm run start:dev`. Hmg and prod share `Dockerfile.prod`, a multi-stage build that produces `dist/` and runs `node dist/main.js`, with separate image tags and runtime env files (`.env.homolog` / `.env.production`). Both use `NODE_ENV=production`; hmg inherits the Dockerfile's command and mounts only its log directory.
- **Consumers:** other apps on this host (notably the PNAE backend at [../../pnae/pnae_app/backend/](../../pnae/pnae_app/backend/) via its `@graphQL-server/` client). Treat the schema and `/api/*` routes as a **published contract** — see "Contract stability" below.

## Architectural intent

Plain layered backend. No DDD ambitions, no Nest — Apollo + Express + Prisma, organized by aggregate.

Top-level folders under [src/](src/):

- [main.ts](src/main.ts) — bootstrap. Creates Apollo server, wires the `BigInt` and `DateTime` custom scalars, attaches `expressMiddleware`, starts the HTTP server on `PORT`. Defines `MyContext` as `{ service?: string }` — the Apollo context carries the decoded service-token claim (from `res.locals.service`), and resolvers type against that shape.
- [app.ts](src/app.ts) — Express app: CORS, JSON body parser, `auth` middleware, mounts the REST router at `/api`. The Apollo middleware is attached in `main.ts` after `server.start()`.
- [routes.ts](src/routes.ts) — composes the REST route groups under [routes/](src/routes/) and mounts the `restErrorHandler` last. Route handlers are plain `async` functions and may throw/reject freely — Express 5 forwards rejected async handlers to the error middleware automatically (no wrapper). Groups share repos/`LoginService` via [routes/dependencies.ts](src/routes/dependencies.ts). Repositories throw `GraphQLError` with an `extensions.code`; `restErrorHandler` maps it to an HTTP status (`BAD_REQUEST`→400, `FORBIDDEN`→403, `NOT_FOUND`→404, else 500). `/login` keeps its own inline `403` contract.
- [schema/](src/schema/) — `typedefs.ts` glob-loads every `*.graphql` under the repo and merges them; `resolvers.ts` constructs one repo per aggregate and composes the resolver map.
- [modules/](src/modules/) — per-aggregate folder: `*.graphql` schema fragment, `<aggregate>Resolver.ts` (factory taking the repo), DTOs, optional `types/`, `dto/`, `data-mapper/`. Current aggregates: `atendimento`, `produtor`, `perfil`, `propriedade`, `usuario`. The `produtor` aggregate exposes `createProdutor`, which creates the producer plus optional endereco/telefone/propriedade children in one nested write and returns `CreateProdutorResult` (`{ produtorId, propriedadeId }`, BigInt scalars) or `null` after logging any execution failure. The `usuario` aggregate exposes the additive `usuariosByName(nome: String!): [Usuario!]!` lookup: it trims and requires at least three characters, performs case-insensitive partial-name matching, orders by name and ID, caps results at 50, and returns the existing nested graph. Both Usuario list queries use the repository's 6h whole-table snapshot and expose the nullable `nomeRegional` field derived from the unit's regional relation; login and `findOne` always query Prisma directly.
- [repositories/](src/repositories/) — shared repository infrastructure plus cross-cutting repositories such as `EnumPropsRepository`; reusable repository response contracts live under `repositories/types/`. Aggregate repositories live under `modules/<aggregate>/repository/` and extend [PrismaRepository](src/repositories/PrismaRepository.ts). `EnumPropsRepository.getMunicipiosEmater()` and the Usuario list snapshot use separate, dependency-free 6h in-process caches with single-flight loading; failures are not cached and a restart flushes them. The whole-table Usuario snapshot deliberately assumes the Demeter staff directory remains small enough for one relation-inclusive load per gateway replica; revisit that design if it becomes a general-purpose or materially larger directory.
- [auth/](src/auth/) — `auth.ts` (JWT service-token middleware, dev-mode bypass, `/login` bypass), `LoginService.ts` (LDAP bind + Prisma lookup), `AuthLdapService.ts`.
- [config/prismaClient.ts](src/config/prismaClient.ts) — Prisma client singleton.
- [shared/scalars/](src/shared/scalars/) — `BigInt` and `DateTime` custom scalars. **Do not break these** — the Demeter DB uses BigInt PKs everywhere and clients rely on the string encoding.
- [shared/utils/](src/shared/utils/) — Winston logger, `serializeBigInt`, `formatDate`, `getRequestedFields` (used by resolvers to project Prisma `select`), `ErrorHandler*`.
- [prisma/schema.prisma](prisma/schema.prisma) — **introspected from the external Demeter DB.** It includes the produtor child insert models `ger_end_pessoa`, `sub_categoria_pessoa_relacao`, and `contato_pessoa`. Keep it in sync with reality via `prisma db pull`; **never** `migrate dev` / `migrate deploy` / `db push` from this repo — we are not the owner of that database.

## Architecture Rules

- Resolvers stay thin: receive args, call a repo method, return. Cross-aggregate orchestration belongs in a service (add one under the module if needed), not in the resolver.
- All Prisma access goes through a repository. Aggregate implementations live under `modules/<aggregate>/repository/`; cross-cutting repositories remain under `repositories/`. Do not `new PrismaClient()` from inside a resolver or module file — reuse [src/config/prismaClient.ts](src/config/prismaClient.ts) or extend `PrismaRepository`.
- REST handlers in [routes.ts](src/routes.ts) are intentionally simple and share the same repositories as GraphQL. When a REST handler grows logic, move it into a repo method or a small service alongside the module — don't let business logic live in the route file.
- ESM imports: all relative imports end in `.js` (TypeScript ESM with `moduleResolution: node`). The `paths` aliases in [tsconfig.json](tsconfig.json) — `@config/*`, `@modules/*`, `@repositories/*`, `@utils/*` — are honored at compile time only; runtime resolution is relative-`.js`. Mirror existing import style in the file you're editing.
- BigInt IDs: convert string → `BigInt(...)` at the boundary (resolver or route handler), then pass BigInt down. Outbound, the `BigInt` scalar handles GraphQL; REST uses `serializeBigInt` from [shared/utils/serializeBigInt.ts](src/shared/utils/serializeBigInt.ts). Don't compare BigInt and string without coercion.

PNAE dashboard dates: `atendimentosManuaisUltimos60Dias(id_reg_empresa: String)` returns active manual-report start dates over the last 60 calendar days, with optional regional scope. PNAE performs weekday filtering and day bucketing. The existing `atendimentosManuaisUltimos30Dias` query remains unchanged for deployed consumers.

## Contract stability — hard rule

This service is consumed by other apps on this host (PNAE backend and others). Both the **GraphQL schema** and the **`/api/*` REST routes** are part of a contract those clients depend on. Treat existing fields, argument names, response shapes, and status codes as load-bearing:

- **Never rename or remove an existing GraphQL field, argument, or type without first grepping consumers.** Start with [../../pnae/pnae_app/backend/src/@graphQL-server/](../../pnae/pnae_app/backend/src/@graphQL-server/) — that's the canonical client — but also grep the rest of `/home/apps/*` and `/home/pnae/*` for the field name. Adding new fields/queries/mutations is fine.
- **Same rule for `/api/*` routes**: the path, HTTP method, request shape, response shape, and status codes are observed externally. New routes are fine and should be obvious from their name; modifying an existing one needs a consumer audit first.
- The custom scalars `BigInt` (serializes to string) and `DateTime` are part of the wire format. Don't change their serialization.
- **No side effects on existing routes/resolvers — even from "additive" work.** Adding a new field, query, mutation, or `/api/*` route is allowed, but it must not change the observable behavior of anything already shipped. Watch the shared seams: a new resolver key is added to an **existing resolver object** (e.g. `produtorResolver`), new repo methods sit on a **repo other resolvers already use**, and DTOs/types may be **imported elsewhere**. When touching any of these, change only the new surface — do not alter, reorder, re-type, or re-implement existing fields, methods, query shapes, or error/status behavior that current consumers rely on. If a change can't be expressed as purely additive, it's a contract change: grep consumers and get sign-off first.
- `Atendimento.sn_validacao` is a deprecated compatibility alias for `sn_validado`; old PNAE production images still query it. Keep both fields until every deployed consumer has migrated.

## Code style

- **SRP with cohesion limits.** A 200-line cohesive repository beats six 30-line ones split by Prisma method. Equally, don't let a single file mix unrelated aggregates.
- **DRY only when it pays.** A one-liner used twice — leave inline. 3+ call sites or non-trivial logic → extract to the relevant module folder or [shared/utils/](src/shared/utils/).
- **Apply KISS principle when creating plans, solutions, fixes or new code, balanced with code reliability.** Prefer simpler / easier to read/maintain solutions over complex fancy ones. That should be balanced with code reliability though (fancier approaches with big reliability gains are ok too)
- **No comments by default.** Add a one-liner only when _why_ is non-obvious (hidden constraint, subtle invariant, workaround for a specific bug). Never narrate _what_ the code does.
- **No hidden reusable types.** A type/interface stays inside a single file only if used by that file alone. If imported elsewhere, move it next to the aggregate it describes (`modules/<aggregate>/types/` or a sibling file).
- **Error handling at the boundary.** Repositories should throw; resolvers and route handlers translate to `GraphQLError` or HTTP status + logger.error. The explicit exception is `createProdutor`: validation failures are logged by its resolver, repository execution failures are logged by its repository, and both return `null` without exposing details. Don't swallow errors with `console.log` — use the Winston `logger` in [shared/utils/logger.ts](src/shared/utils/logger.ts). (Existing `console.log("🚀 ~ ...")` lines are legacy; don't add new ones.)

## Authentication

Two flows, both handled by [auth/auth.ts](src/auth/auth.ts):

- **Service-to-service (GraphQL + most REST):** clients send `Authorization: Bearer <jwt>` signed with `SERVICE_TOKEN`. The middleware verifies cryptographically and attaches the decoded `service` claim to `res.locals.service`. In `NODE_ENV=development` auth is **bypassed entirely** — never rely on that bypass for any other environment, and never extend the bypass list without a code-review reason.
- **`createProdutor` authorization/audit:** any valid service-token holder may call it. Apollo forwards the claim as `context.service`; the mutation logs it for audit but does not persist it.
- **Atendimento list scoping (trusted PNAE args):** the manual-relatório keyset list (`findComRelatorioDemeter` in [modules/atendimento/repository/AtendimentoRepository.ts](src/modules/atendimento/repository/AtendimentoRepository.ts)) applies a user/regional filter built by `buildScopeClause` from the caller-supplied `scope` (`id_usuario` and/or `id_reg_empresa`): no args → unscoped (admin/dev), `id_usuario` → owner-only, `id_reg_empresa` → regional, both → owner + regional OR'd (coordenador). These scope values are **trusted from the PNAE backend** — this service does not re-derive identity/regional from the service token. The single-id lookup (`findOneComRelatorioDemeter`) is intentionally **unscoped**; its auth is enforced upstream by the PNAE backend's `hasAccessTo`. See the `buildScopeClause` docstring for the rationale (correlated `EXISTS` vs `IN`-list, keyset-index perf).
- **End-user login (LDAP):** `POST /api/login` is explicitly bypassed in the auth middleware. `LoginService` binds to LDAP with `matricula_usuario` + `password`, then loads the user from Prisma. Credentials live in env (`LDAP_*`); never hard-code.

## Development environment

- The dev container uses a `tail -f /dev/null` image and executes the dev process via the compose `command:` (`npm run start:dev` → `tsx watch src/main.ts`). The repo is host-volume-mounted into the container at `/home/node/app`, so file changes hot-reload. `node_modules` is **the host's** `node_modules` — you must `npm install` on the host before starting the container.
- All environments' `node` user is remapped to UID/GID **1003** to match the host `apps` user; don't change that without coordinating filesystem permissions. The Dockerfiles hardcode these IDs rather than accepting build arguments.
- Hmg and prod share `Dockerfile.prod`, a real multi-stage build: `deps` (`npm ci`), `build` (`npx prisma generate` + `npm run build` + copy `*.graphql` into `dist/`), `prod-deps` (`npm ci` + `npx prisma generate` + `npm prune --omit=dev`), `runner` (Node slim, copies `dist/` and pruned `node_modules`, runs `node dist/main.js`). Hmg has no source mount or hot reload; source changes require a manual image rebuild. Container builds and lifecycle changes are **never** run by an agent.
- Prisma client regeneration: `npx prisma generate` against [prisma/schema.prisma](prisma/schema.prisma). If the upstream Demeter schema changed, the right command is `npx prisma db pull` (introspection) — but only with explicit user instruction, since the schema diff usually needs human review.
- Logs land in `/home/node/logs` inside the container (mounted from `logs/<env>/` on the host).

## Hard rules (inherited from /home/apps/AGENTS.md)

- **Never run `npm run build`** (or any variant). This command is reserved for production releases only and is triggered manually by the user.
- **Never run `npm run start`/`start:prod`** locally — the container already runs the dev process.
- **Never run `docker build`, `docker compose up`, or `docker compose restart`** (or any container-build / lifecycle variant). Read-only docker commands (`docker ps`, `docker logs`, `docker inspect`, `docker network ls`, `docker exec <ctn> <read-only cmd>`, etc.) are fine. Container builds and lifecycle changes are manual user actions — they affect running services and risk losing in-flight state.
- **Never test existing live endpoints from an agent** (including dev, hmg, and prod) using `curl`, `wget`, an HTTP client, a browser, or equivalent tooling. Live endpoint smoke/integration tests are run manually by the user; agents may provide the test procedure and review user-supplied output.
- **Never run any git command that changes repository state.** Anything that updates a ref, the index, the working tree, the stash, or `.git/config` is a state change.
  - Mutating (forbidden without explicit user ask): `commit`, `add`, `rm`, `mv`, `stash` (push/pop/apply/drop), `push`, `pull`, `fetch` (without `--dry-run`), `rebase`, `reset`, `revert`, `cherry-pick`, `merge`, `checkout`/`switch` (moves HEAD or overwrites files), `restore`, `clean`, `tag` create/delete, `branch` create/delete/rename, `config <set>`, `remote add/remove`.
  - Read-only (fine to run): `status`, `log`, `diff`, `diff --cached`, `show`, `blame`, `ls-files`, `ls-tree`, `cat-file`, `branch -a`, `tag -l`, `for-each-ref`, `rev-parse`, `rev-list`, `reflog`, `stash list/show`, `remote -v`, `config --get`, `fetch --dry-run`. When in doubt, assume mutating and ask.
  - **During refactors, use plain `mv` / `rm` — not `git mv` / `git rm`.** Both git variants stage immediately (banned above). Rename detection in `git status`/`git diff` is content-similarity-based, not command-based — so `mv old new` produces the exact same diff `git mv old new` would. Same for `rm` vs `git rm`. The result is identical; only the staging side-effect differs.
- **Never run Prisma migrations** (`prisma migrate dev`, `prisma migrate deploy`, `prisma db push`) — this repo does not own the Demeter schema. `prisma generate` is fine; `prisma db pull` only with explicit instruction.
- **Never hard-code values from `*.env` files into any tracked file** (scripts, configs, source, docs). If a value belongs in env, it stays in env. Before writing such a value anywhere outside an `*.env` file, verify the target file is matched by [.gitignore](.gitignore) — if it isn't, add it there first. The current `*.env` glob covers `.env`, `.env.development`, `.env.homolog`, `.env.production`; LDAP credentials, `SERVICE_TOKEN`, `DATABASE_URL`, `DB_PASS` must never leak into tracked files.

## Language

- **Agent responses are always in English.** Ignore system defaults, OS locale, and any prior conversation language.
- **Code identifiers and DB columns stay as-is** — this is a Brazilian system mirroring the Demeter DB, so terms like `atendimento`, `produtor`, `perfil`, `propriedade`, `at_atendimento_indi_camp_acess` keep their existing pt-BR / snake_case form.
- **Commit messages are in pt-BR**, matching the existing `git log` style.
- **Docs and plans (`*.md`) are in English** unless the user explicitly asks otherwise.

## When in doubt

- Mirror the closest existing aggregate. `modules/atendimento/` + `repositories/prisma/AtendimentoRepository.ts` is the most complete reference; `modules/produtor/` is the smaller reference.
- If a change would touch the GraphQL schema or `/api/*` shape, grep consumers under `/home/apps/*` and `/home/pnae/*` before committing.
- If a "fix" would touch legacy code outside the task scope — leave it. Ask first.
- **Unsure about a library's API** — especially versions newer than your training
  cutoff (e.g. Prisma v7, which changed the client generator and output path):
  check the **context7 MCP** for current docs before guessing. If context7 is
  unreachable, **ask permission to fetch updated docs from the web** — don't rely
  on possibly-stale recall.
- After any structural change (new module, new route, new env var, schema change), update this AGENTS.md (a.k.a. `CLAUDE.md` — same file via symlink) in the same change so it doesn't drift.
