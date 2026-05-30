# Throughline — Phase D / Slice 3 Handover (chain close)

**Generated:** 2026-05-30 (UTC)
**Last commit SHA:** _filled at merge_ — 2026-05-30
**Previous handover:** `handovers/2026-05-30-phase-d-slice-2-data-integrity-locks.md` (Phase D / Slice 2, PR #80)

Chain `audit-fix-phase-c-d` — **chain close**. Slice D-3: the backend lifecycle locks. Two confirmed-live defects (S4-01, S7-01) each get a small paired fix + regression test; F1-01 was already structurally closed (Phase B `resolveProjectBundle`) and its lock test verified.

---

## Build State vs Spec

| Audit finding | Fix | Test | Evidence |
|---|---|---|---|
| **S4-01** drift over-dismissal | `dismissSignal` audits only the dismissal that changed a row (`res.changes > 0`); a re-dismiss of an already-dismissed signal is a true no-op (first reason preserved, no spurious audit) | `test/drift-dismiss.test.ts` (2 cases) | `drift/service.ts` |
| **S7-01** shutdown DB-close ordering | poller gains a bounded `drain()` that waits for in-flight polls; `server.ts` `close()` stops all producers, drains in-flight async work, then closes the DB **last** | `test/github.test.ts` — `drain()` waits for an in-flight poll; resolves immediately when idle | `github/poller.ts`, `server.ts` |
| **F1-01** wrong-bundle resolution | already closed by Phase B `resolveProjectBundle`; lock test verified, no new test added (avoids redundancy) | `test/loader.test.ts:130` "resolveProjectBundle threads project.repo_path so arm 2 is never skipped (F1-01/S5-02 regression)" — green | `methodology/loader.ts` (Phase B) |

Green gate: typecheck (incl. backend `test/**`), **515** backend tests (+4) + **187** frontend tests, lint, full `pnpm -r build` — all green. Test count strictly increased.

---

## Last Decision Minted

_none_ — bug fixes + regression locks. The chain minted exactly its planned anchors: **C-D24** (slice C-1) and **T-D59** (slice D-1); nothing else.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**Modified (fixes):**
- `packages/backend/src/drift/service.ts` — `dismissSignal` audits only on an actual state change.
- `packages/backend/src/github/poller.ts` — `drain(timeoutMs?)` added to the `GitHubPoller` interface + implementation (bounded wait on the `inFlight` set).
- `packages/backend/src/server.ts` — `close()` reordered: stop producers → `app.close()` → await watchers → `await githubPoller.drain()` → `registry.stop()` → `db.close()` last.

**New (tests):**
- `packages/backend/test/drift-dismiss.test.ts` — S4-01 lock (2 cases).

**Modified (tests):**
- `packages/backend/test/github.test.ts` — S7-01 `drain()` lock (2 cases).

**Docs:** `PLATFORM_STATUS.md` (chain-close transition — handover+status commit).

**Deleted:** _none_.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Scheduler drain scope | `server.ts` | The S7-01 fix drains the github poller (the concrete race: stopped immediately before `db.close()` with multi-`await` DB-writing polls). The reminder/backup schedulers are also non-awaited `stop()`s, but they are stopped first and have the entire `app.close()` + watcher-stop window to settle before `db.close()`. | Bounded to the poller (the real race). Schedulers are far lower-risk; surfaced here rather than expanding the slice into a scheduler-drain refactor. A cohort-hardener follow-up could add symmetric drains if wanted. |
| F1-01 no new test | `test/loader.test.ts` | The chain plan listed an "explicit F1-01 regression test"; one already exists (added Phase B slice 4, labelled F1-01/S5-02). | Verified the existing test rather than adding a redundant duplicate. Honest no-op. |

---

## Open Questions

- [ ] **Cohort-level heavy hardener** for the audit-fix cohort (Phases A–D) → `production-ready` promotion: stale-anchor-count refresh (`CODE_SPEC §1`), ROADMAP backfill, vocabulary audit, SESSION_START gap refresh (note: `SESSION_START.md` is currently absent — a pre-existing gap to create or formally accept), SPEC §14 audit, build-prerequisite stress test. This is a separate pass per `AUTHORING_DISCIPLINE.md`, not part of this slice.

---

## Chain Summary (audit-fix Phase C+D — `audit-fix-phase-c-d`)

| PR | Slice | One-line | Anchor |
|---|---|---|---|
| #76 | chain-open | absorb doc-PR collision + merge-on-green polling rules into `AUTO_CONTINUE_WORKFLOW.md` | — |
| #77 | C-1 | `useResource` / `usePolledResource` hook pair + 3 proof adopters | **C-D24** |
| #78 | C-2 | surface data-hook errors in consumers + mutation catches (SF6-01..12) + `<LoadError>` + regression test | — |
| #79 | D-1 | wire-contract types → `@throughline/shared` + contract test; **green-gate Gap 2 closed** | **T-D59** |
| #80 | D-2 | backend data-integrity locks: S2-01 ReDoS bypass, SF2-01 scanner-throw, S5-01 dump-zone atomicity | — |
| this | D-3 | backend lifecycle locks: S4-01 dismissal idempotency, S7-01 shutdown ordering, F1-01 lock verified | — |

**Findings closed by the chain:** SF6-01/02 (Criticals) + SF6-03..12; audit-1 I1 Gap 2; S2-01, SF2-01, S5-01, S4-01, S7-01; F1-01 (lock). Both green-gate gaps now closed.

**Process note:** this chain was recovered from a workflow violation (slices 1–2 were initially pushed to a single branch without per-slice PRs). The recovery re-ran every unit through the canonical rhythm — one PR per slice, each gated by Gitar + CI + GitHub-mergeable and merged before the next branched off `main` — and switched from subscription-wait to explicit ~30–45s polling for merge-on-green (the #75 subscription-reliability finding).

---

## Reference

- Audit findings: S4-01, S7-01, F1-01.
- Chain: `audit-fix-phase-c-d` — #76 → #77 → #78 → #79 → #80 → D-3 (this, chain close).
- PR: _Phase D / Slice 3 (this PR)_.
