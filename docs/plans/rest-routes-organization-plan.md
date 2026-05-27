# REST Routes Organization Plan

`src/routes.ts` is small, but it mixes route registration, dependency wiring, request parsing, error handling, logging, and response formatting in one place. The goal is to organize it without introducing a heavy controller or service framework.

## Current Issues

- Several `catch` blocks log and then send no response, which can leave HTTP clients hanging.
- `console.log` is used in boundary error handling, while the repo standard is to use `logger`.
- Error behavior is inconsistent: `/login` returns `403`, some routes implicitly return nothing, and `PATCH /updateTemasAndVisitaAtendimento` logs but does not return an error response.
- Route names are legacy/RPC-style, such as `getPerfilOptions` and `getRegionaisEmater`. Keep them for contract stability, but organize the implementation behind them.
- `routes.ts` knows too much about every aggregate. It is acceptable now, but it will get worse with each new REST endpoint.

## Proposed Shape

```text
src/
  routes.ts                 # only composes REST route groups
  routes/
    enumRoutes.ts           # getPerfilOptions, getGruposProdutos, etc.
    atendimentoRoutes.ts    # readOnly, dataSEI, replaced, update temas/visita
    authRoutes.ts           # login
    routeHelpers.ts         # asyncHandler, routeParam, errorMiddleware
```

Keep external paths exactly the same:

```ts
router.use(enumRoutes);
router.use(atendimentoRoutes);
router.use(authRoutes);
```

Instead of wrapping every route, rely on the framework: this is Express 5 (`express ^5.2.1`), which forwards a rejected `async` handler to the error middleware automatically (confirmed in the Express 5 docs for `app.use` / `app.get` / `app.post`). So route handlers stay plain `async` functions with no per-route `try/catch` and no wrapper — they may throw/reject freely.

Then add **one Express error middleware** after `/api` routing as the single error sink (`restErrorHandler`, a 4-arg `(err, req, res, next)` function mounted last on the router). A short comment in `routeHelpers.ts` documents that handlers may throw because Express 5 forwards rejections here. `/login` is the one exception: it keeps an inline `try/catch` because its contract is `403` on failure, not the generic `500` sink.

## Avoid

- Controller classes.
- A dependency injection container.
- Per-route service classes.
- Renaming the public REST endpoints.
- Moving simple one-line repository calls into fake use cases.

## Incremental Refactor Plan

1. Add `routeHelpers.ts` with `routeParam` and the single Express error middleware (`restErrorHandler`). No async wrapper — Express 5 forwards rejections.
2. Split `routes.ts` into the three route-group files above.
3. Replace `console.log` with `logger.error`.
4. Normalize **error** responses to a consistent `500` JSON, but **preserve existing success status codes** — `updateTemasAndVisitaAtendimento` returns `204`, `/login` returns `403` on bad credentials. These are observed externally; do not flatten them.
5. **Before changing any route that currently swallows errors** (e.g. `getPerfilOptions`, `getGruposProdutos`, `getContractInfo`, `getRegionaisEmater` return nothing on failure today), grep consumers under `/home/pnae/*` and `/home/apps/*`. A consumer may treat an empty body as "no data"; switching to a `500` changes observed behavior. Same contract discipline applies as for any `/api/*` change.
6. Add light param validation only where it matters: `atendimentoId`, comma-separated `ids`, and login body fields.

This keeps the architecture simple: REST routes remain thin boundary adapters, repositories keep the data access, and the public `/api/*` contract stays untouched.

## Relationship to the validação endpoints

If this cleanup lands first, the two new routes from [atendimento-validacao-endpoints-plan.md](atendimento-validacao-endpoints-plan.md) (`PATCH /api/aprovarAtendimento/:atendimentoId`, `PATCH /api/criarPendenciaAtendimento/:atendimentoId`) should be born directly into `atendimentoRoutes.ts` as plain `async` handlers (no wrapper; Express 5 forwards rejections to `restErrorHandler`) — not added to the old monolithic `routes.ts` and migrated later. Sequence the cleanup before the new endpoints to avoid rework.
