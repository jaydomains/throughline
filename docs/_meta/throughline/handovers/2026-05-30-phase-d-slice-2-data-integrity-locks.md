# Throughline — Phase D / Slice 2 Handover

**Generated:** 2026-05-30 (UTC)
**Last commit SHA:** _filled at merge_ — 2026-05-30
**Previous handover:** `handovers/2026-05-30-phase-d-slice-1-wire-contract.md` (Phase D / Slice 1, PR #79)

Chain `audit-fix-phase-c-d`. Slice D-2 — backend data-integrity regression locks: three confirmed-live defects, each with a small paired fix + a regression test that fails against the old behaviour.

---

## Build State vs Spec

| Audit finding | Fix | Test | Evidence |
|---|---|---|---|
| **S2-01** ReDoS bypass | `bodyIsAmbiguous` now flags a `\|` alternation at **any** nesting depth (was top-level only), so a quantified group with a nested overlapping alternation is refused before compile | `test/safe-regex.test.ts` — `((a\|a))+$` etc. must return null | `safe-regex.ts`; empirically the bypass ran 16ms→9.7s over 16→28 chars (≈106s near 40), now refused |
| **SF2-01** scanner-throw clears real signals | `runDisciplineScan` returns a tagged `DisciplineScanResult` (`{ok:true,findings}` \| `{ok:false,error}`); the engine preserves a category's open signals on an error result instead of reconciling them away | `test/discipline-scan-error.test.ts` — error result preserves signals; empty success still dismisses | `scanners.ts`, `engine.ts` |
| **S5-01** dump-zone non-atomic apply | the apply loops + status flip + audit run inside one `db.transaction`; a mid-apply failure rolls back every insert and leaves the proposal `pending` (no duplicate-on-retry) | `test/dumpZone.test.ts` — a bad second item rolls back the first; retry yields exactly 2 items | `dump-zone/service.ts` |

Green gate: typecheck (incl. backend `test/**`), **511** backend tests (+4) + **187** frontend tests, lint, full `pnpm -r build` — all green. Test count strictly increased.

---

## Last Decision Minted

_none_ — D-2 is bug fixes + regression locks, not conventions. No T-D / C-D minted (consistent with the chain's anchor plan: only C-D24 and T-D59).

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**Modified (fixes):**
- `packages/backend/src/methodology/drift/discipline/safe-regex.ts` — depth-agnostic alternation check in `bodyIsAmbiguous`; removed the now-unused group-depth tracking.
- `packages/backend/src/methodology/drift/discipline/scanners.ts` — `runDisciplineScan` returns `DisciplineScanResult` (tagged success/error).
- `packages/backend/src/methodology/drift/discipline/engine.ts` — on a scan error, log and `continue` (preserve the category's open signals); reconcile only on success.
- `packages/backend/src/dump-zone/service.ts` — `apply` body wrapped in `db.transaction` (atomic).

**New (tests):**
- `packages/backend/test/discipline-scan-error.test.ts` — SF2-01 lock (2 cases).

**Modified (tests):**
- `packages/backend/test/safe-regex.test.ts` — S2-01 lock case.
- `packages/backend/test/dumpZone.test.ts` — S5-01 atomicity lock case.

**Docs:** `PLATFORM_STATUS.md` (Snapshot / Current Phase / Recent Slice History roll — handover+status commit).

**Deleted:** _none_.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Over-refusal posture | `safe-regex.ts` | The S2-01 fix refuses some *safe* nested-alternation-in-quantified-group patterns too (precise overlap detection is hard). | Accepted — over-refusal is the module's documented safe failure mode (returns null ⇒ caller skips, never blocks the repo); consistent with the detector already refusing every top-level alternation. |
| Partial-finding loss on scan error | `engine.ts` | On a scanner error mid-category, the partial findings collected before the throw are not inserted (only the existing signals are preserved). | Intentional: inserting an incomplete finding set could be misleading; the next successful scan reconciles authoritatively. The load-bearing fix is *not dismissing* real signals. |

---

## Open Questions

- [ ] Slice D-3 (chain close) — backend lifecycle locks: S4-01 (drift over-dismissal idempotency), S7-01 (shutdown DB-close ordering), F1-01 (loader wrong-bundle regression lock). Then the cohort hardener + `production-ready` promotion. Resolved in the D-3 PR.

---

## Cross-Module Dependencies

**Upstream:** none new.
**Downstream:** D-3 is independent (different subsystems). The `DisciplineScanResult` type is now the public contract of `runDisciplineScan` (only consumer is the engine).

---

## Reference

- Audit findings: S2-01, SF2-01, S5-01.
- Chain: `audit-fix-phase-c-d` — #76 → #77 → #78 → #79 (D-1) → D-2 (this) → D-3.
- PR: _Phase D / Slice 2 (this PR)_.
