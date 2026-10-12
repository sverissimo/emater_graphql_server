# Client Refactor Recommendations

## Shared direction

- Treat `usuarios` / `usuariosByName` as the shared, cache-backed source for user hydration.
- Batch user IDs and request only the fields each use case needs.
- Prefer the cached `getMunicipiosEmater` result as the canonical unit-to-regional lookup.
- Keep login and single-user authentication lookups fresh and unchanged.
- Do not add another client-side cache unless a client already needs one for other reasons.

## PNAE — highest priority

PNAE is the only reviewed client that expands `at_atendimento_usuario` into the related `usuario` to obtain names. Keep the association and owner ID because authorization, ownership, and transfer history depend on them, but hydrate names separately through one batched `usuarios(ids)` call. Preserve the existing PNAE HTTP response shapes, UI labels, PDFs, and reports.

Apply the same pattern to the manual-report list when that gateway path is next changed: return owner IDs from the atendimento relationship and use the cached user lookup for display data.

For regionals, derive the dashboard's ID/name list from PNAE's existing cached municipality reader. Remove the unused regional request from the reports page. Keep the existing `/perfil/getRegionaisEmater` contract intact because PNAE Mobile is frozen and unreachable.

Split or slim PNAE's broad user query for name-only report/PDF hydration; profiles and the complete unit hierarchy are unnecessary there.

## CMC

CMC does not query `at_atendimento_usuario`, `getRegionaisEmater`, or `getMunicipiosEmater`.

Its active `usuarios(ids)` calls already batch IDs, but the shared query over-fetches profiles and the complete unit hierarchy while report, property, certificate, and duplicate enrichment mainly need user ID and name. Use a minimal user projection for those paths and keep the REST login flow unchanged.

## Concurso Café

Concurso Café is already aligned: name search uses cached `usuariosByName`, municipality data uses cached `getMunicipiosEmater`, and it does not query `getRegionaisEmater` or atendimento relationships.

The nested user-unit graph is currently requested only to obtain the regional ID. At the next touch, derive that ID from the municipality map using the user's unit ID, then keep only the top-level `nomeRegional`. This is optional and low priority.

## Expected impact

The primary database win is removing repeated PNAE atendimento-to-user relationship expansion. Smaller user selections in CMC and Concurso Café also reduce payload and coupling, although the gateway's current user snapshot loads its configured relations once per six-hour cache fill.
