# Throughline / backend — Handover: Slice A1 (Fastify v4→v5 + fast-uri pin)

**Status:** final — approved by executor
**Generated:** 2026-06-07 08:40 UTC
**Last commit SHA:** _(merge SHA assigned by execution-overseer at merge)_ — 2026-06-07
**Previous handover:** `docs/_meta/throughline/handovers/phase-e-execution-log.md` (Phase E closure)
**Slice:** A1 of the audit-remediation cohort (plan `2026-06-06-audit-remediation-plan.md`, PR #135). **PR:** #140 (draft).

---

## Build State vs Spec

| Plan deliverable (A1, §5 Group A) | State | Evidence | Notes |
|---|---|---|---|
| Bump `fastify ^4.27.0` → fixed floor | built | `packages/backend/package.json` (`^5.8.3`, resolves 5.8.5) | Floor bumped 5.7.2→5.8.3 (see Drift Flags) |
| Resolve v5 breaking-change surface in code | built | `packages/backend/src/http/error-handler.ts` (`setErrorHandler<FastifyError>`) | Only v5 source change; no plugins/hooks/schema in this backend |
| Pin/override `fast-uri` to fixed floor | built (no override needed) | `pnpm-lock.yaml` — only `fast-uri@3.1.2` resolves | v5's find-my-way@9 / fast-json-stringify@6 drop `fast-uri@2.4.0` |
| Lockfile consistent, no stale fastify@4 | built | `pnpm-lock.yaml` (`fastify@5.8.5`, `find-my-way@9.6.0`) | `pnpm why fast-uri` all 3.1.2 |
| Tests adjusted if v5 changed a tested contract | n/a | 610 backend / 204 frontend unchanged & passing | No tested contract changed |

## Last Decision Minted

> No new decisions minted. A1 implements the M-1 ruling (settled). No T-D/C-D anchor touched (C-D2 is **A2**'s, not A1's). Implementation-shape choice (no `pnpm.overrides` needed) recorded above.

## Active Blockers

_none_

## Files Changed Since Last Handover

**New:**
- `docs/_meta/throughline/plans/2026-06-07-audit-remediation-A1-executor-wake-log.md` — executor wake-log for A1.
- `docs/_meta/throughline/handovers/2026-06-07-A1-fastify-v5-fast-uri.md` — this handover.

**Modified:**
- `packages/backend/package.json` — `fastify ^4.27.0 → ^5.8.3`.
- `packages/backend/src/http/error-handler.ts` — `setErrorHandler<FastifyError>` (v5 defaults the error type to `unknown`).
- `pnpm-lock.yaml` — regenerated for fastify v5.

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Version floor | `packages/backend/package.json` | Plan §0 cites `>=5.7.2` (content-type advisory at audit time); current advisory set adds sendWebStream (`>=5.7.3`) + request.protocol/host spoofable (`>=5.8.3`) | Pinned `^5.8.3` to honor M-1 intent (clear the fastify advisories). Same direction as plan; surfaced in PR #140, not a scope change. |
| Dep declaration | `packages/backend/package.json` | Plan §0 calls `@xenova/transformers` a *direct* dep; it is under `optionalDependencies` | Out of A1 scope — carried forward to **A2** (matches auditor CN-1). No A1 action. |

## Open Questions

- [ ] **OQ-2 (merge method, class-iv)** gates A1's **merge execution** (not its content) — per execution-overseer EO-7: A1 is the *first* merge of this execution-trio-reviewed auto-continue build-slice chain, so the squash-vs-merge-commit method must be ruled before the overseer executes. The overseer's lane; surfaced to the spec-author through the authenticated channel. A1's *content* remains not-a-ratification-class. Landing site: spec-author OQ-2 ruling → overseer merge.

_(OQ-1 governs D3 only, not A1.)_

## Recently Resolved

- M-1 (fastify + fast-uri portion) — was the deploy-blocking exposure flagged in the 2026-06-06 audit; A1 clears the 3 High + 1 Moderate + 1 Low fastify/fast-uri advisories. protobufjs (A2) and react-router (A3) remain.

## Cross-Module Dependencies

**Upstream (this module consumes):** Fastify v5 (server foundation).
**Downstream (consumes this slice):** **A2** and **D1** share `packages/backend/package.json` and must rebase on this; A1 must land before both (plan §3.B serialization).

## Verification — `pnpm audit --prod` before/after (A1-P6 / CP-8)

| Severity | Before | After | Cleared by A1 |
|---|---|---|---|
| Critical | 1 | 1 | — (protobufjs → A2) |
| High | 7 | 4 | Content-Type tab bypass; fast-uri path-traversal; fast-uri host-confusion |
| Moderate | 6 | 5 | request.protocol/host spoofable |
| Low | 1 | 0 | sendWebStream DoS |
| **Total** | **15** | **10** | **5 fastify/fast-uri advisories** |

All fastify/fast-uri advisories cleared (`grep fastify/fast-uri` on the after-audit returns nothing). Remaining 10 = protobufjs (A2) + react-router (A3).

**Gate:** typecheck ✓ · test ✓ (610 backend / 204 frontend) · lint ✓ · build ✓.
**Boot:** `node dist/index.js` on `127.0.0.1:47823` — `/health` `{"ok":true}`, `/api/methodologies` 200, SSE `/events` welcome frame, clean shutdown (hijacked sockets torn down).

## Reference

- Spec/decisions/build-state: `docs/_meta/throughline/plans/2026-06-06-audit-remediation-plan.md` (§5 A1); `docs/_meta/throughline/audits/2026-06-06-end-to-end-summary.md` (M-1); `CODE_SPEC.md` (C-D23 error handler).
- PR: #140.
