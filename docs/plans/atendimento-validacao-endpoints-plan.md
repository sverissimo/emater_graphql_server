# Atendimento Validação Endpoints Plan

Add two REST endpoints to this gateway to set an atendimento's validation status: **approve** or **flag as pendência**. Each takes a single `atendimentoId` and writes a fixed, internally-consistent triple over `sn_validado`, `sn_pendencia`, and `data_validacao`. The PNAE backend consumer will be wired up separately, later.

**Decisions:** REST PATCH · two separate endpoints · `usuario_validacao` left untouched.

## Consumer semantics (read side)

The canonical "aprovado" rule lives in the PNAE backend at `src/@domain/relatorio/relatorio-dashboard-stats.ts`:

```ts
isAprovado = sn_validado === 1 || (data_validacao != null && !sn_pendencia)
```

This is **lenient by design** to cover legacy DB edge cases:

- `sn_validado === 1` alone counts as approved — it overrides a stale `sn_pendencia === 1`.
- `sn_validado === 0` + `data_validacao` present + no pendência also counts as approved (legacy rows where the timestamp was set without raising `sn_validado`).

The frontend filter (`web_interface/features/relatorio/hooks/useRelatorioFilter.ts`) keys off `sn_pendencia` and `data_validacao` as its filter dimensions.

**Implication for the write side:** we do **not** reproduce the legacy mess. We always write the clean canonical triple, which satisfies every consumer's `isAprovado` on both sides and avoids creating new ambiguous rows.

| Status    | sn_validado | sn_pendencia | data_validacao        |
| --------- | ----------- | ------------ | --------------------- |
| Aprovado  | 1           | 0            | `getTodayBrTimezone()`|
| Pendência | 0           | 1            | `null`                |

`sn_*` columns are numeric flags (0 = false, 1 = true).

## Why two intent-named routes instead of three free-form columns

Exposing three nullable params would let a client write an inconsistent combination such as `sn_validado=1, sn_pendencia=1` (the legacy bug). Two intent-based endpoints each write a fixed, consistent triple — no client can invent a bad state. The boundary is what's explicit; the data write itself is a single shared place.

Both endpoints are intentionally idempotent: approving an already-approved atendimento keeps it approved, and creating pendência on an already-pending atendimento keeps it pending.

## Steps (gateway only)

1. **Repo method** — `src/modules/atendimento/repository/AtendimentoRepository.ts`: one method `setValidacaoStatus(idAtendimento: bigint, aprovado: boolean)` doing a single `prisma.at_atendimento.update` with the fixed triple. Two states that are exact inverses don't justify two near-duplicate methods. Reuse `getTodayBrTimezone()` (already used by `setAtendimentosExportDate`) for the timestamp; `usuario_validacao` is not touched. In the catch, call **`this.handleRecordNotFound(error)`** (not `this.throwError`) — `prisma.update` on a missing row throws Prisma `P2025`, and `handleRecordNotFound` is the existing helper that maps `P2025` → a `GraphQLError` with `extensions.code = "NOT_FOUND"`; any other error falls through to the generic handler.

2. **Two REST routes** in `src/routes.ts`, or in `src/routes/atendimentoRoutes.ts` if the REST route organization refactor lands first. The router is mounted at `/api`, so register these paths inside the router:
   - `PATCH /aprovarAtendimento/:atendimentoId`
   - `PATCH /criarPendenciaAtendimento/:atendimentoId`

   The external contract becomes:
   - `PATCH /api/aprovarAtendimento/:atendimentoId`
   - `PATCH /api/criarPendenciaAtendimento/:atendimentoId`

   Mirror the existing successful write shape: BigInt coercion at the boundary and `return res.status(204).send()`.

3. **Grep consumers first** under `/home/pnae/*` and `/home/apps/*` for the new route names — only to confirm no collision before they become published contract. New routes are contract-safe per `AGENTS.md`.

4. **No schema / no Prisma changes** — all three columns already exist in the Prisma model and the GraphQL `Atendimento` type. Nothing to `db pull`.

5. **Boundary error handling** — invalid `atendimentoId` (non-numeric, so `BigInt()` throws) → `400` before touching the repo. For repo failures, read `extensions.code` off the thrown `GraphQLError`: `NOT_FOUND` → `404`, `BAD_REQUEST` → `400`, `FORBIDDEN` → `403`; anything else (plain `Error` / raw Prisma error) → `logger.error` + `500`. This reuses the codes `ErrorHandlerImpl.createError` already emits — no parallel `P2025` check at the boundary. Note: returning `404` on a missing row is **intentionally stricter than the existing precedent** — `updateTemasAndVisitaAtendimento` uses `$queryRaw`, silently affects 0 rows, and still returns `204`. The `prisma.update` path here surfaces the missing row instead, which is the better behavior.

6. **Update `AGENTS.md`** — add the two new `/api/*` routes to the `routes.ts` description so the documented REST surface doesn't drift. If `CLAUDE.md` is restored as a symlink later, this remains the same file.

## SEI approval endpoints (`data_sei`) — added later

The admin DETEC/SEI approval feature added two sibling routes on the same `atendimentoRoutes` router. They mirror the shape above (PATCH, id-only path param, `204` on success) but write a **different column** (`data_sei`) and carry their own precondition. The full server-side + frontend design lives in the PNAE backend plan `docs/plans/admin-aprovar-relatorio-sei-plan.md`; this is the gateway slice only.

- `PATCH /api/aprovarSei/:atendimentoId` → `setDataSeiStatus(id, true)` → sets `data_sei = getTodayBrTimezone()`.
- `PATCH /api/removerAprovacaoSei/:atendimentoId` → `setDataSeiStatus(id, false)` → sets `data_sei = null`.

`setDataSeiStatus` writes **only** `data_sei` and never touches the validation triple (`sn_validado` / `sn_pendencia` / `data_validacao`) — they are distinct lifecycle operations.

**Precondition on approve (atomic).** Admin approval is only allowed when the coordenador already validated. Rather than a read-then-write check, the approve path uses a conditional `updateMany` filtered on `data_validacao: { not: null }`; a `count === 0` (missing id **or** not-yet-validated) throws a `BAD_REQUEST` `GraphQLError` → `400` with the message *"Atendimento inexistente ou ainda não validado pelo coordenador regional."*. The remove path has no precondition (an admin can always undo) and uses a plain `update`, mapping `P2025` → `404` via `handleRecordNotFound`.

**Downstream-stage locking is UX-only in v1** — the gateway does not block `removerAprovacaoSei` on a later-stage row (`data_see` / `dt_export_ok` set). The ready-to-enable hardened variant (conditional `updateMany` on the remove path too) is documented in the PNAE backend plan §1A; promote it only if downstream locking is confirmed a hard data invariant.

## Out of scope

- The PNAE backend consumer (will call these routes later).
- Stamping `usuario_validacao` on approve — deferred; the approve payload stays an id-only path param.
- Reproducing the legacy lenient `isAprovado` edge cases on the write side.
