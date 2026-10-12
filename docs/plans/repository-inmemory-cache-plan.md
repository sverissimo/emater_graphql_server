# In-repository in-memory cache — municípios + usuarios

**Implemented.** Two repositories use a 6h in-process cache built from plain instance fields inside
the repository that owns the query. There is no shared cache class or new dependency, login and
single-record lookups stay fresh, and the GraphQL `Usuario` type has one additive nullable field,
`nomeRegional`.

## Intended behavior

- `EnumPropsRepository.getMunicipiosEmater()` returns the same rows as today; its Demeter query runs
  at most once per 6h per repository instance.
- `UsuarioRepository` loads **one whole-table Usuario snapshot** and serves both GraphQL list
  operations from it — `usuarios(ids, matriculas)` and `usuariosByName(nome)` — by filtering the
  cached array in TypeScript. Either method warms the snapshot for the other. Each snapshot row is
  hydrated once with its regional name.
- On a miss or after expiry the repository queries Prisma. Cache bookkeeping is best-effort: if it
  is unusable, bypass it and query Prisma; only a Prisma failure reaches the existing repository
  error handler. Stale data and rejections are never cached, and concurrent cold callers share one
  in-flight promise.
- Existing fields and responses stay unchanged; GraphQL consumers may opt into the additive
  `Usuario.nomeRegional` field. There is no REST change and no cache header.
- **Flush = manually restart every gateway replica.** There is no invalidation endpoint.

## Cache shape (identical in both repositories)

```ts
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
private cached: T[] | null = null;
private expiresAt = 0;
private inFlight: Promise<T[]> | null = null;
```

Load path: fresh `cached` (`expiresAt > Date.now()`) → return it; else `inFlight` → return it; else
fetch, store the promise in `inFlight`, clear it in `finally`, and on success set `cached` and
`expiresAt = Date.now() + CACHE_TTL_MS` (computed after the query resolves). On failure
`cached`/`expiresAt` stay untouched and the rejection propagates.

There is no external cache service to fail: cache access is plain field access/assignment. Do not
wrap the loader in a broad fallback catch that could mistake a Prisma rejection for a cache failure
and query twice. Ignore unusable cache state, fetch Prisma once, and pass only that failure through
the repository's current `throwError` behavior.

**Repository lifetime:** the GraphQL ([schema/resolvers.ts](../../src/schema/resolvers.ts)) and REST
([routes/dependencies.ts](../../src/routes/dependencies.ts)) repositories are long-lived singletons.
Ad-hoc `EnumPropsRepository` instances only call uncached methods today.

## Cache 1 — `EnumPropsRepository.getMunicipiosEmater`

Move the existing `$queryRaw` body **unchanged** into a private `fetchMunicipiosEmater()`; the public
method becomes the cached wrapper — same name, same `Promise<MunicipioEmater[]>`, same rows, leaving
[routes/enumRoutes.ts](../../src/routes/enumRoutes.ts) and the REST response untouched.

## Cache 2 — `UsuarioRepository`, one snapshot for both list paths

`getUsuariosSnapshot()` — private, cached, whole-table `prisma.usuario.findMany` with
`ger_und_empresa { ger_und_empresa }` **and** `perfil_demeter { perfil }` (superset of what the two
list methods return today). Do not add `orderBy` to this snapshot query: `findMany` currently has no
ordering clause, so preserving snapshot order avoids deliberately reordering existing `usuarios`
responses. This deliberately assumes the Demeter staff directory remains small enough for one
relation-inclusive in-memory snapshot per gateway replica.

Hydrate each fetched snapshot row with a top-level `nomeRegional: string | null`, using the relation
already returned by that same Prisma query:

- if the user is assigned directly to a `G%` unit, use that unit's own `nm_und_empresa`;
- for a local `H%` unit, use `usuario.ger_und_empresa.ger_und_empresa.nm_und_empresa` (the local unit
  points to its parent `G%` regional);
- if neither path resolves a name, use `null`.

This is the same `ger_und_empresa` H→G source used by `getMunicipiosEmater`, without coupling the two
repositories or issuing a second query. Do not call `EnumPropsRepository` from `UsuarioRepository`
and do not add selection-inspection plumbing: hydrating a string once per snapshot row is negligible,
and Apollo only serializes `nomeRegional` when the client selects it.

`findMany({ id, matricula_usuario })` — filters the snapshot; must be behaviorally equivalent to the
current query:

- comma-separated `id` and `matricula_usuario` inputs, unchanged;
- `id` entries that are empty / `"null"` / `"undefined"` are dropped, the rest become `BigInt`, and
  matching compares BigInt to BigInt;
- matrícula matching trims trailing whitespace on both values to preserve PostgreSQL `char(5)`
  comparison semantics;
- IDs and matrículas are **OR'd** when both are given;
- today's no-rows edge cases are reproduced: Prisma returns nothing for an empty `OR` (no filters at
  all) and nothing for `in: []` (an `id` string that filtered down to empty). Pin both with tests;
- same returned Usuario graph and relations as today.

`findByName(nome)` — filters the same snapshot into a new array: `trim()`, reject `< 3` characters
via `throwError` (`BAD_REQUEST`) **before** touching the cache, case-insensitive `includes` on
`nome_usuario`, sort that filtered copy by `nome_usuario` then `id_usuario`, `slice(0, 50)`. It must
not sort/mutate the cached snapshot. `findByName` rows always carry `perfil_demeter`; GraphQL returns
only the selected fields. Name ordering uses Node's `pt-BR` `localeCompare`, so the set surviving
the 50-row cap may differ from a PostgreSQL collation at accent/case boundaries; this is accepted
application-side behavior.

## Fresh paths — never cached

- `findForLogin({ matricula_usuario })` — new, dedicated, uncached Prisma query with the same include
  graph and array return shape. [LoginService.ts:24](../../src/auth/LoginService.ts#L24) switches to
  it, so every login hits the DB after the LDAP bind; `LoginService` behavior and the `/api/login`
  contract are unchanged.
- `findOne(id)` — stops delegating to `findMany`; becomes its own uncached Prisma query, same
  signature and return shape.
- Any future `findFirst` / `findUnique` / single-user path stays uncached.

Rationale: the list/enrichment paths tolerate hours of staleness; login and single-record reads feed
identity, `ativo`/`situacao_emater` and perfil gating, and must not come from a 6h snapshot. Usuario
create/update invalidation is out of scope — TTL plus restart is the accepted consistency model.

## Obsolete selection plumbing to remove

Because the snapshot always includes perfil/unidade, remove `includePerfilDemeter`, the resolver's
`GraphQLResolveInfo` logic, and the shared `isFieldRequested` function/tests, which become unused.
Do not replace them with selection inspection for `nomeRegional`. Keep `getRequestedFields` for
`produtorResolver` and the unrelated `PrismaRepository.isFieldRequested` used by
`AtendimentoRepository`.

The two query signatures stay exactly `usuariosByName(nome: String!): [Usuario!]!` and
`usuarios(ids, matriculas)`. Add only `nomeRegional: String` to the existing GraphQL `Usuario` type;
its nullability covers missing or malformed unit relationships.

## Implementation steps / files

1. `src/repositories/EnumPropsRepository.ts` — TTL constant, cache fields, private fetch, cached wrapper.
2. `src/modules/usuario/repository/UsuarioRepository.ts` — TTL constant, cache fields,
   `getUsuariosSnapshot()` plus regional-name hydration, snapshot-filtering `findMany`/`findByName`,
   uncached `findForLogin`, and standalone `findOne`.
3. `src/modules/usuario/usuario.graphql` — add nullable `Usuario.nomeRegional`;
   `src/modules/usuario/dto/usuarioDTOs.ts` — type the optional hydrated field on the repository
   output without changing `UsuarioLoginOutputDto`.
4. `src/auth/LoginService.ts` — call `findForLogin`; `src/modules/usuario/usuarioResolver.ts` —
   `usuariosByName` calls `findByName(nome)` only.
5. `src/shared/utils/getRequestedFields.ts` — drop `isFieldRequested`; delete its test cases.
6. Tests: `src/repositories/EnumPropsRepository.test.ts` (new), `UsuarioRepository.test.ts` and
   `usuarioResolver.test.ts` (rewrite the cases asserting the removed argument/selection plumbing
   and cover `nomeRegional` hydration).
7. `AGENTS.md` — the two 6h repository caches, the cached-vs-fresh `UsuarioRepository` boundary,
   `Usuario.nomeRegional`, and the corrected `usuariosByName` description.

## Tests (`node:test` + `mock`, mocked `Date.now` for expiry — no real waiting)

Municípios: repeated calls issue one query; expiry refreshes; concurrent cold calls share one query.

Usuarios: `findMany` then `findByName` issue **one** snapshot query; two different name searches
issue one; ids/matrículas filtering preserves the current OR semantics plus the two no-rows edge
cases and fixed-width matrícula padding behavior; case-insensitive matching,
`nome_usuario`-then-`id_usuario` ordering and the 50-row cap hold;
`< 3` trimmed characters throws `BAD_REQUEST` and loads no snapshot; concurrent cold calls share one
query; expiry refreshes; sorting `findByName` does not reorder the snapshot used by `findMany`; a
malformed non-BigInt ID preserves today's error behavior; a failed snapshot query passes through
the existing repository error handler, leaves the cache empty, and is not retried as a "cache
failure." Regional-name hydration covers an `H%` unit with a parent regional, a user assigned
directly to a `G%` unit, and a missing relation (`null`), and does not issue another Prisma/raw query.

Fresh paths: `findForLogin` queries Prisma on every call, repeated calls included, and never consumes
the snapshot; `findOne` queries Prisma directly. Resolver and `LoginService` behavior stays
externally unchanged; all other existing tests stay green.

## Verification

`node --import tsx --test 'src/**/*.test.ts'`, `npx tsc --noEmit`, `git diff --check`.
No production build, no live endpoints, no direct DB access, no container lifecycle commands.

## Out of scope

Redis, a generic cache abstraction / `src/shared/cache/`, `Cache-Control` headers, nginx changes, an
invalidation endpoint, stale-on-error, retry TTL, eviction policy, new dependencies, write-triggered
invalidation, caching single-record paths, and caching the sibling `EnumPropsRepository` methods.
