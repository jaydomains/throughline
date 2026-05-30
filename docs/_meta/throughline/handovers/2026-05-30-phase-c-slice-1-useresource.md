# Throughline — Phase C / Slice 1 Handover (chain-open)

**Generated:** 2026-05-30 (UTC)
**Last commit SHA:** _filled at merge_ — 2026-05-30
**Previous handover:** `handovers/2026-05-30-doc-pr-chain-collision-reconciliation.md` (doc-PR collision reconciliation, PR #75); chain-open absorption landed as PR #76.

Chain `audit-fix-phase-c-d` (frontend error-surfacing + green-gate hardening). Slice 1 of the Phase C half — extracts the canonical data-fetching hook pair and adopts it in the three proof hooks. Mints **C-D24**.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| `useResource` / `usePolledResource` hook pair returning one `ResourceState<T>` contract | built | `packages/frontend/src/hooks/useResource.ts` | `{ data, loading, error, refresh }`; unmount guard + stable `refresh` owned once. Fetcher is `(() => Promise<T>) \| null`; `null` ⇒ disabled/reset to initial. |
| Adopt in the three hooks that already exposed `error` | built | `useItems.ts`, `useSessions.ts`, `useItemPolicy.ts` rebuilt on `useResource` via a memoised fetcher | Public return shapes unchanged (`items`/`sessions`/`policy` + `loading`/`error`[/`refresh`]). |
| Mint C-D24 | built | `CODE_SPEC.md` C-D24 section | Frontend convention anchor; cites none; spans Phase C slices 1–2. |
| No behaviour change this slice | held | 182 frontend tests pass unchanged | Error slot made uniform; consumer rendering of it is slice 2. |

Green gate (local + CI on PR): typecheck, 182 frontend tests, lint, full `pnpm -r build` all green.

---

## Last Decision Minted

- **C-D24 — `useResource` / `usePolledResource` frontend data-fetching hook pair.** Every data hook is built on one of two primitives returning the single `ResourceState<T>` contract. The hook owns the `{ data, loading, error }` triple, the `alive` unmount guard, error capture, and a stable `refresh`; callers pass a `useMemo`-built fetcher (or `null` to disable). Rationale: the `error` slot was the SF6 surface — owning the triple once makes it uniform and unavoidable, and centralises the unmount-guard pattern copied across six-plus hooks. Lands in `CODE_SPEC.md` (C-D24 body). Implemented across Phase C — slice 1 mints the pair + three proof adopters; slice 2 fans out and renders the error.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/frontend/src/hooks/useResource.ts` — the hook pair + `ResourceState<T>`.

**Modified:**
- `packages/frontend/src/hooks/useItems.ts`, `useSessions.ts`, `useItemPolicy.ts` — rebuilt on `useResource` with a memoised fetcher.
- `CODE_SPEC.md` — C-D24 anchor.
- `PLATFORM_STATUS.md` — Snapshot / Current Phase / Locked Decisions (C-D24) / Recent Slice History roll (in the handover+status commit).

**Deleted:** _none_.

---

## Drift Flags

_none_

---

## Open Questions

- [ ] Slice 2 (C-2) — add `error` to `useDirectives`/`useDriftInbox`, rebuild `useCostMeter`/`useBackupStatus` on `usePolledResource`, render the error in consumer views, add mutation catches, lock SF6-01/02 with a regression test; resolved in the slice-2 PR.
- [ ] Slice 3 (D-1) — wire-contract response types → `@throughline/shared` + contract test (mints T-D59), flip Gap 2 to Closed.
- [ ] Slices 4–5 (D-2/D-3) — backend regression locks + small paired fixes (S2-01, SF2-01, S5-01, S4-01, S7-01, F1-01).

---

## Cross-Module Dependencies

**Upstream (this slice consumes):** `@throughline/shared` (`Item`, `Session`, `ItemPolicy` types).

**Downstream (consumes this slice):**
- Slice 2 — adopts the pair in the remaining hooks and renders `error`.
- `useBackendHealth` deliberately stays off the pair (a failed `/health` is its datum, not an error) — documented in C-D24 Implications and the hook.

---

## Reference

- Decisions: `CODE_SPEC.md` C-D24.
- Chain: `audit-fix-phase-c-d` — chain-open absorption (#76, merged) → C-1 (this) → C-2 → D-1 → D-2 → D-3.
- PR: _Phase C / Slice 1 (this PR)_.
