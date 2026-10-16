# Phase 2 caching idea: review

Updated on 2026-10-15 after the author's [revised phase 2 idea](caching-plan-phase-2.md) and responses. References: [phase 1](caching-plan-phase-1.md), [AGENTS.md](../../AGENTS.md), and the current gateway source.

## Verdict and scores

**The revised idea is sound and ready to become an endpoint-specific implementation plan.** The important improvement is explicit best-effort freshness: uncommon gaps and overwritten cache writes are accepted until reconciliation. The design does not need stronger synchronization to eliminate outcomes its consumers already accept.

| Score | Current | Previous | Reason |
| --- | --- | --- | --- |
| Quality | **9/10** | 8/10 | The plan now preserves existing contracts, defines broad parent-table coverage, handles progress transactionally, and states the freshness and publication tradeoffs honestly. |
| KISS | **9/10** | 7.5/10 | The author resolved concerns with simple policies: finite overlap, nightly repair, indexed fetches, and no durable replay or queue. Four writing paths remain, but their responsibilities and failure behavior are clearer. |

These scores assess a high-level direction, not implementation readiness or measured performance. The remaining polish below belongs in the detailed plan; it does not justify another redesign round.

Earlier scores were 7.5/7.5, then 8/7.5 after the volume clarification. The updated assessment replaces earlier prescriptions for a per-field policy table, fixed upper IDs, additional replay state, and extensive race simulations. They are not outstanding requirements.

## Workload and agreed scope

The author confirmed **500–2,000 atendimentos per working day, none on weekends or holidays, and approximately 352,000 over twelve months**. These are accepted facts. The approximately eight-million-row association and slow request timings are reported context; no live database or endpoint was inspected for this review.

At this volume, a generous finite overlap is a practical approach. Size the atendimento and `at_cli_atend_prop` overlaps separately: the number of atendimentos does not establish the number of links or numeric ID positions consumed. No exact overlap size or runtime cost has been verified yet.

Keep the selected-column approach, local indexes, opt-in cached reads, nightly reconciliation, and an initial delivery for one useful endpoint. Do not add a generic synchronization layer, CDC, a durable queue, or a pending-ID journal solely for exceptional cases already covered by the freshness policy.

## Assessment of the author's changes

### 1. Finite overlap and best-effort freshness: resolved

**Agree.** The plan no longer needs to prove strict two-hour completeness. A finite replay range plus nightly reconciliation is enough for the stated consumers. The original ID-100/ID-1000 example described a possible failure, not its likelihood at this workload; it gave that rare case too much prominence.

Sequence allocation and row visibility have different transactional semantics, so overlap still reduces rather than eliminates late-commit misses. That limitation is now an accepted policy, not an implementation blocker. See [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html) and [sequence functions](https://www.postgresql.org/docs/current/functions-sequence.html).

An atendimento's business date is separate from insertion/commit order. A newly inserted row with an older business date can still be found by its ID and then checked for range eligibility. Existing-row edits are handled by the separate gateway-write/nightly policies.

### 2. Mutable fields and predecessor cleanup: resolved for this document

**Agree with the simpler rule.** Keep frequently changing workflow fields on Demeter; refresh affected cached rows after this gateway's own writes. A per-field policy table is unnecessary in this idea document. The chosen endpoint's implementation plan only needs to list the columns it actually caches.

The code evidence behind the original concern remains valid: [AtendimentoRepository.ts](../../src/modules/atendimento/repository/AtendimentoRepository.ts) updates existing fields through `update()`, `setValidacaoStatus()`, `setDataSeiStatus()`, `setAtendimentosExportDate()`, and `updateTemasAndNumeroVisita()`. The revised plan now acknowledges this, including GraphQL mutations.

Removing a predecessor before excluding the replacement by date is the right ordering. I accept omitting an extra predecessor lookup if the author confirms the replacement convention and accepts nightly repair for exceptions. No additional state machine is needed.

“Stable columns” means changes are infrequent or reconciled by the chosen paths; dates and units are not literally immutable. The new gateway-write rule already accounts for that distinction.

### 3. Existing write responses and cache failure: resolved

**Agree.** Demeter remains authoritative. After its write succeeds, a cache failure is logged and does not change the caller's existing response. Nightly reconciliation repairs the cache. This is the appropriate tradeoff for optional cached reads.

Do not add a durable queue or distributed transaction. Preserve the existing status/body/error contracts in [atendimentoRoutes.ts](../../src/routes/atendimentoRoutes.ts) and the existing GraphQL mutation behavior. During implementation, keep the cache attempt bounded using the existing connection/statement limits; “best effort” should not make an existing write wait indefinitely.

### 4. Writes during the nightly build: resolved

**Agree with accepting the race.** The plan correctly states that the advisory lock coordinates jobs, not request-time writers. It now includes both gateway updates and read-through fills in the accepted overwrite window.

Repair is specific to the missing/stale data: a missing ID can be filled again, insertion overlap can recover relevant new rows, and the next successful rebuild repairs the rest. A stale row that still exists is not automatically refreshed by a cache-hit read. The plan's explicit nightly repair policy makes that acceptable.

A durable replay journal would protect a stronger freshness promise than this plan makes. Do not add one, and do not make normal requests wait on the refresh lock. PostgreSQL's [advisory-lock documentation](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS) supports the distinction between application coordination and automatic protection of unrelated writes.

### 5. Progress and batch failures: sufficient for the idea

**Agree with keeping the essentials:** one source-snapshot mark per tailed table, and each batch plus its progress advance committed in one cache transaction. Failed batches retry, while source-key uniqueness and upserts make replay safe.

A captured upper ID is optional at this bounded workload. Paging until no new rows remain is reasonable. A failed batch does not need a separate pending state when rollback leaves its mark unchanged.

Upserts handle storage idempotency; they do not choose what to fetch or which rows remain eligible. The implementation should apply the existing active/range rules to replayed rows too. That can be ordinary batch logic, without a separate overlap policy framework.

### 6. Coverage and new read surface: substantially resolved

**Agree.** A nightly full copy of selected produtor/propriedade columns avoids omitting parent records merely because they have no retained atendimento. New cached routes or fields preserve the behavior of existing resolvers. CPF lookup is also a reasonable indexed exception to the earlier primary-key-only wording.

The distinction that remains is between complete parent tables and complete relationships. An association through `at_cli_atend_prop` records attendance participation; it does not automatically describe every propriedade owned by a produtor. Existing [produtor repository reads](../../src/modules/produtor/repository/ProdutorRepository.ts) also expose profile-related data beyond the proposed small cache.

This is covered by the plan's decision to define coverage per endpoint. The detailed plan should name the relationship it promises and include its actual source, or limit the response to the cached relationship. No silent fallback through an expensive ORM include.

### 7. Freshness and phase 1 boundary: sufficient, with one range clarification

**Agree.** The short freshness section is enough for a direction document. It distinguishes normal daytime arrivals, overnight arrivals, accepted exceptional misses/edits, and failed runs. Keeping the tail time separate from `snapshotAt` avoids implying that every old row was revalidated.

Keeping phase 1 aggregates nightly-only initially is a useful scope cut. Fetching programa/técnico links by the leading atendimento key also resolves the concern about discovering those relationships for newly fetched parents; the composite keys are visible in [schema.prisma](../../prisma/schema.prisma).

Before implementation, specify phase 2's date range independently. If it inherits phase 1's through-yesterday cutoff, today's new atendimentos will be skipped even when the tail discovers them. **Phase 2 must include today if its endpoint promises daytime visibility of today's work, while phase 1 may continue serving its nightly through-yesterday generation.** This needs a clear range rule, not a new synchronization mechanism.

Programa/técnico links added later to older atendimentos are another freshness detail: fetching links only for new parents does not discover every such change. Re-fetch them for replayed parents where convenient, or explicitly leave remaining changes to nightly reconciliation. Do not introduce another tail unless the selected endpoint requires it.

## Remaining polish for the detailed plan

These are small decisions, not reasons to reopen the architecture:

- **Range and ownership:** choose phase 2's schema/table ownership and its inclusion of today. Keep the initial phase 1 aggregate behavior intact.
- **Endpoint coverage:** specify the first endpoint's fields, relationship meaning, municipio meaning, filters, ordering, and bounds. Whole parent tables alone do not imply complete child relationships.
- **Fallback:** use indexed direct reads only where the endpoint can preserve its response without the expensive join. Choose 503 for relationship/list requests that cannot do so. “503 or direct” is enough here, but the implementation plan must choose per endpoint.
- **Metadata:** describe full-snapshot age and tail progress honestly. New parent rows that have no atendimento link enter filtered lists only after a full copy or an explicit fill; the two insertion tails do not enumerate every new produtor/propriedade.
- **Indexed access:** the declared leading-key predicates are index-compatible, but batching does not guarantee PostgreSQL chooses an index for every query. Keep ordinary user-run timings/resource checks; no tuning framework is needed.

## Verification: accept the smaller scope

I agree that simulating delayed lower-ID commits and read-through fills during publication is optional here. Their possible outcomes are explicitly accepted. These simulations are no longer review requirements.

Keep the plan's four user-run checks:

1. Compare counts and a representative filtered response against Demeter using the same range and coverage.
2. Process a replacement and confirm predecessor removal.
3. Add a link to an old atendimento and confirm the documented tail behavior.
4. Perform a gateway write and check its existing response plus the affected cache row.

For the fourth check, include one cache-failure case if feasible: Demeter success must still produce the existing successful response, with the cache error logged. This checks a required consumer contract rather than a rare freshness guarantee. Batch/progress rollback can be checked with a focused offline test or a simple failed-batch dev check when implementing that logic; no broad lifecycle test framework is needed.

No implementation, database access, live request, or deployment was performed for this review update.

## Next step

Pick the first endpoint and write its detailed implementation plan. Retain the accepted best-effort policies. Resolve the range, relationship, and fallback details above within that scope, then implement and verify it. Another general review round is not a prerequisite.
