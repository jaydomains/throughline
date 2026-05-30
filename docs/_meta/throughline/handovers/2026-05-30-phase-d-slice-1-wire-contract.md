# Throughline — Phase D / Slice 1 Handover

**Generated:** 2026-05-30 (UTC)
**Last commit SHA:** _filled at merge_ — 2026-05-30
**Previous handover:** `handovers/2026-05-30-phase-c-slice-2-error-surfacing.md` (Phase C / Slice 2, PR #78)

Chain `audit-fix-phase-c-d`. Slice D-1 — opens the Phase D (green-gate hardening) half: moves the wire-contract response types into `@throughline/shared`, type-validates the client/server contract at compile time (both sides) and at runtime (a new contract test), and closes the audit's green-gate **Gap 2**. Mints **T-D59**.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Wire-contract response types in `@throughline/shared` | built | `packages/shared/src/wire.ts` (+ `index.ts` re-export) | `MethodologySummary` (moved from `api.ts`) + `MethodologiesResponse` / `ItemsResponse` / `ItemResponse` / `PolicyResponse` / `SessionsResponse` / `SessionResponse`. |
| Backend handlers typed against the shared contract | built | `routes/methodologies.ts` (`Promise<MethodologiesResponse>`); `items/routes.ts` + `sessions/routes.ts` (typed `const body: …Response` on the success payload) | Typed-const pattern used where the handler also returns a `reply.code(404).send(...)` error branch. `tsc` now fails if a handler drifts from its shared shape. |
| Frontend sources types from shared | built | `api.ts` imports the envelopes; local `MethodologySummary` deleted and re-exported from shared; `jsonFetch` targets the shared types for methodologies/items/policy/sessions | Removed now-unused `Item` / `ItemPolicy` imports. |
| Wire-contract test | built | `packages/backend/test/wire-contract.test.ts` (6 tests) | Builds a Fastify app, injects each core read endpoint, asserts the runtime JSON matches the shared envelope. |
| Close green-gate Gap 2 | built | `AUTHORING_DISCIPLINE.md` Known-Gaps flipped to CLOSED (both gaps) | Gap 1 (Phase A) + Gap 2 (this slice). |
| Mint T-D59 + §14 index row | built | `DECISIONS.md` T-D59; `SPEC.md §14` row (section 3) | — |

Green gate: typecheck (incl. backend `test/**`), **507** backend tests (+6 wire-contract) + **187** frontend tests, lint, full `pnpm -r build` — all green. Test count strictly increased.

---

## Last Decision Minted

- **T-D59 — Wire-contract response types live in `@throughline/shared`; the contract is verified, not cast.** Response envelopes are named types in `packages/shared/src/wire.ts`; backend handlers annotate their success payload against them, the frontend `jsonFetch<T>` targets them, and `wire-contract.test.ts` injects each endpoint and asserts the runtime shape. The `as T` cast at the fetch boundary now targets a shared, test-verified contract rather than an unchecked assumption. Closes green-gate Gap 2 (with Gap 1 already closed in Phase A). Lands in `DECISIONS.md` (T-D59 body), `SPEC.md §14` (index row).

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/shared/src/wire.ts` — the response envelopes + the moved `MethodologySummary`.
- `packages/backend/test/wire-contract.test.ts` — the runtime contract test (6 cases).

**Modified:**
- `packages/shared/src/index.ts` — re-export `./wire.js`.
- `packages/backend/src/routes/methodologies.ts`, `items/routes.ts`, `sessions/routes.ts` — handlers typed against the shared envelopes.
- `packages/frontend/src/api.ts` — import envelopes from shared; delete + re-export local `MethodologySummary`; point `jsonFetch` at the shared types; drop unused `Item`/`ItemPolicy` imports.
- `DECISIONS.md` (T-D59), `SPEC.md` (§14 row), `AUTHORING_DISCIPLINE.md` (Gap 2 → CLOSED).
- `PLATFORM_STATUS.md` — Snapshot / Current Phase / Locked Decisions (T-D59) / Recent Slice History roll (handover+status commit).

**Deleted:** _none_ (the frontend `MethodologySummary` interface body was removed in-file, replaced by a re-export).

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Envelope scope | `packages/shared/src/wire.ts` | The audit framed Gap 2 broadly ("response shapes declared in frontend"); in practice the only *named* frontend-local wire type was `MethodologySummary` — the rest were inline `{ items: Item[] }`-style envelopes whose inner types already came from shared. | Moved the one named type + promoted the core entity-read envelopes to named shared types (the endpoints the contract test covers and the Phase C hooks consume); documented in T-D59 that new endpoints follow the same pattern. Bounded, not exhaustive over all ~100 endpoints. |

---

## Open Questions

- [ ] Slice D-2 — backend data-integrity regression locks + small paired fixes: S2-01 (ReDoS bypass), SF2-01 (scanner-throw clears signals), S5-01 (dump-zone non-atomic apply). Resolved in the D-2 PR.
- [ ] Slice D-3 (chain close) — backend lifecycle locks: S4-01 (drift over-dismissal), S7-01 (shutdown DB-close ordering), F1-01 (loader wrong-bundle lock test). Resolved in the D-3 PR; cohort hardener + `production-ready` promotion follows.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):** `@throughline/shared` entity types (`Item`, `Session`, `ItemPolicy`, `BundleIdentity`, `BundleStructuralError`).

**Downstream (consumes this slice):** future endpoints add their envelope to `wire.ts` + a case to `wire-contract.test.ts`. Phase D slices 2–3 are independent (backend behaviour fixes), not blocked by this.

---

## Reference

- Decisions: `DECISIONS.md` T-D59; `SPEC.md §14`.
- Chain: `audit-fix-phase-c-d` — #76 → #77 (C-1) → #78 (C-2) → D-1 (this) → D-2 → D-3.
- PR: _Phase D / Slice 1 (this PR)_.
