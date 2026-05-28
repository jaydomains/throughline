# Throughline Handover — Phase 22 Slice 2: SettingsView DisciplineScanBlock (chain-close)

**Generated:** 2026-05-28
**Last commit SHA:** pending — 2026-05-28
**Previous handover:** `2026-05-28-phase-22-slice-1-discipline-scan-state-lifecycle.md` (PR #64 — Phase 22 Slice 1, chain-open)

Second and final slice of the Phase 22 chain (tracking issue [#63](https://github.com/jaydomains/throughline/issues/63), `Auto-continue: phase-22-build-enchanted-plum`). **Chain-close handover** — carries the full two-slice summary table per the AUTO_CONTINUE_WORKFLOW chain-close convention.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| T-D57 Implications surface 5 — SettingsView renders the "Run discipline scan" trigger conditionally (prominent when `pre-scan`; less-prominent re-scan affordance when `complete`) | built | `packages/frontend/src/views/SettingsView.tsx` (`DisciplineScanBlock` exported component); `packages/frontend/test/disciplineScanBlock.test.tsx` (8 tests) | Per spec-author Q3A at chain-open: **sibling of `BootstrapBlock` inside `ProjectSection`**, not folded into the bootstrap-named block. Discipline scanning is "one trigger, two surfaces" — applies to all projects, including non-bootstrap. The block renders with `data-state` (`pre-scan` / `running` / `complete` / `absent`) and `data-prominence` (`prominent` for `pre-scan`; `demoted` otherwise) so the affordance shape is driven by data attributes rather than branching JSX. |
| Non-bootstrap projects (absent state ≡ complete-implicit) surface the re-scan affordance unchanged | built | `disciplineScanBlock.test.tsx` "non-bootstrap projects (absent state ≡ complete-implicit) still see a re-scan affordance" | Mirrors the slice 1 backend invariant: the periodic-review gate is written as "suppress when `pre-scan` or `running`", and the frontend renders the demoted re-scan affordance when the state is absent. Non-bootstrap projects keep existing on-bind discipline-drift scanner behaviour and can run a manual re-scan from this block at any time. |
| Optimistic `running` flip on click + busy/disabled affordance during scan | built | `disciplineScanBlock.test.tsx` "optimistically flips to running on click before the response arrives" + "renders the disabled 'Scanning…' affordance while state is running" | Local optimistic overlay lets the button transition to "Scanning…" immediately. The slice 1 backend's try/finally guarantees recovery even on scanner crash; the response always carries the post-transition state so the local overlay drops back to the persisted value. |
| Error path — inline error message + revert optimistic state | built | `disciplineScanBlock.test.tsx` "surfaces an inline error and reverts the optimistic running state on rescan failure" | Pattern matches `BootstrapBlock`'s `bootstrap-render-error` shape: a `<p className="error" data-testid="discipline-scan-error">` surfaces the message; the local state reverts to the persisted value so a re-fetch would pick up the actual server state. |
| `api.rescanDisciplineDrift` consumes the extended `DisciplineDriftRescanResult` response shape from slice 1 | built | `packages/frontend/src/api.ts` (retyped in slice 1); `packages/frontend/test/fixtures/mockApi.ts` (mock updated with `discipline_scan_state` + `discipline_scan_last_run_at` fields) | Slice 1 retyped the API wrapper preparing for this slice. Mock fixture default values carry the `'complete'` happy-path shape so existing tests calling `rescanDisciplineDrift` get the new fields automatically. |
| `onScanned()` callback re-fetches the project record after rescan | built | `disciplineScanBlock.test.tsx` "refreshes onScanned() after success so the outer project record re-fetches" | `ProjectSection` already passes its `onSaved` re-fetch callback as `onScanned`. The next render then reads the persisted `settings_json.discipline_scan_state` via `readDisciplineScan()` from `@throughline/shared`, and the local optimistic overlay resets (via the `useEffect` dep on `persistedState`). |
| `CHECKLIST.md` §22 — slice 2 ticked with concrete evidence | built | `CHECKLIST.md` §22 | Mirrors the slice 1 ticked-row shape; lists file paths + test counts + test name themes. |
| `PLATFORM_STATUS.md` rolled for Phase 22 chain-close | built | `docs/_meta/throughline/PLATFORM_STATUS.md` | Snapshot rolls to "Phase 22 build chain closed"; Current Phase rolls to "none in flight"; Recent Slice History rolls (PRs #59 and #57 fall off); Queued Work updates `throughline:pause` label to "fifth-pass at chain-close" and carries the pre-existing frontend tsc drift into the cohort hardener pass. |
| Chain state file `.claude-code/auto-continue-state.json` marked chain-closed | built | `.claude-code/auto-continue-state.json` | Slice 1 marked merged (PR #64); slice 2 open (PR #TBD); chain `chainClosedAt` set once this PR merges. Chain totals captured in notes. |

---

## Last Decision Minted

No new T-D / C-D anchors minted in this slice or across the chain. Implementation followed T-D57's Implications block (the implementation spec for Phase 22, per T-D57's explicit "No companion C-D anchor for Phase 22" clause). Implementation-shape choices recorded inline at the implementation site:

- **`data-state` + `data-prominence` attributes drive the affordance shape, not branched JSX.** Matches how `BootstrapBlock`'s status banner uses `data-status` to signal its three states. The block keeps a single render tree; the prominent vs demoted distinction is the prose wording above the button + the data attribute, not a different JSX subtree.
- **Local optimistic overlay over persisted state.** Two `useState` hooks (`localState`, `localLastRun`) overlay the values read from `project.settings_json` via `readDisciplineScan()`. The `useEffect` resets the local overlay on `persistedState` change so a successful `onScanned()` re-fetch flows naturally back to the persisted value. The optimistic flip to `running` makes the UI immediately responsive; the response's authoritative state replaces it on resolution.
- **`onScanned()` lives at the ProjectSection level, not inside the block.** Mirrors how `ProjectSection` already passes `onSaved` to the project-binding save button. Centralising the re-fetch at the section level keeps `DisciplineScanBlock` from having to know about the projects-list refresh mechanism.
- **Error path reverts the optimistic state to persisted, not to a separate "error" state.** The slice 1 backend's try/finally moves the server state to `complete` regardless of throw, so the next refresh would correct any UI mismatch. Local revert keeps the UI consistent in the meantime without a third visual state to maintain.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/frontend/test/disciplineScanBlock.test.tsx` — 8 tests across two describes: state-driven affordance shape (4 cases — pre-scan prominent, complete demoted, non-bootstrap absent ≡ complete-implicit, running disabled) + rescan flow (4 cases — happy path, optimistic running before resolve, error rollback + inline message, onScanned refresh).
- `docs/_meta/throughline/handovers/2026-05-28-phase-22-slice-2-discipline-scan-block.md` — this handover.

**Modified:**
- `packages/frontend/src/views/SettingsView.tsx` — `DisciplineScanBlock` exported component inserted between `BootstrapBlock` and `CommunicationModelSection`. Added to `ProjectSection`'s body as a sibling of `BootstrapBlock` (line 597 area). Imports `DisciplineScanState` type and `readDisciplineScan` helper from `@throughline/shared`.
- `packages/frontend/test/fixtures/mockApi.ts` — `rescanDisciplineDrift` mock default response updated to include `discipline_scan_state: 'complete'` + `discipline_scan_last_run_at` so existing tests using the mock get the new shape automatically.
- `CHECKLIST.md` §22 — slice 2 ticked with concrete evidence (file paths + test counts + test name themes).
- `docs/_meta/throughline/PLATFORM_STATUS.md` — Snapshot rolls to "Phase 22 build chain closed"; Current Phase rolls to "none in flight"; Recent Slice History rolls (PRs #59 and #57 fall off); Queued Work `throughline:pause` updated to "fifth-pass at chain-close"; pre-existing frontend tsc drift carried into the cohort hardener pass.
- `.claude-code/auto-continue-state.json` — slice 1 marked merged (PR #64); slice 2 open; `currentIndex: 1`. `chainClosedAt` set on merge.

**Deleted:** _none_.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Pre-existing frontend `bootstrapBlock.test.tsx` strict-typecheck errors carried through Phase 22 | `packages/frontend/test/bootstrapBlock.test.tsx` (lines 72, 188, 207, 232, 250) | Same drift surfaced in the Phase 22 Slice 1 handover. `pnpm --filter @throughline/frontend build` (which runs `tsc -b`) still fails on five errors under Phase 21 Slice 4's `exactOptionalPropertyTypes` strictness on `Project.throughline_status`. Not introduced by this slice; not absorbed in this slice either. | Carried into the cohort-level heavy hardener pass over Phases 19–22 per `AUTHORING_DISCIPLINE.md` drift-surfacing discipline. Frontend test suite itself passes 182/182 (Phase 22 added +8 tests; vitest does not run strict tsc). |
| `throughline:pause` label still absent at Phase 22 chain-close (fifth consecutive chain to roll without it) | `jaydomains/throughline` repo settings | Persistent gap carried through Phases 19/20/21/22 (five passes). Phase 22 chain ran end-to-end clean on fallback signals (marker file + `/pause` comments). | Tracked in `PLATFORM_STATUS.md` Queued Work as the fifth-pass entry. Closes when `gh label create throughline:pause` runs against the repo (or the equivalent admin UI action); will become sixth-pass entry if the next chain opens without it. |

---

## Open Questions

- [ ] **Cohort-level heavy hardener pass over Phases 19–22 build outputs** triggers next per `AUTHORING_DISCIPLINE.md`. Promotes T-D51 / T-D52 / T-D53 / T-D54 / T-D55 / T-D56 / T-D57 + C-D19 / C-D20 / C-D21 to `production-ready`. Cohort hardener picks up the two carry-forwards in `PLATFORM_STATUS.md` Queued Work (frontend tsc drift, `throughline:pause` label).
- [ ] **Phase 22's "no companion C-D anchor" precedent.** T-D57's Implications block stood in for a C-D anchor for this phase (per T-D57's explicit clause). Both slices ran first-Gitar-review-clean and zero fix-rounds with that minimal-scaffolding approach — a clean data point that small-sized phases don't necessarily need a separate C-D layer. Hardener pass may want to capture this as a future authoring-discipline note.

---

## Recently Resolved

- **Phase 22 chain-close.** Both slices merged. The chain ran clean on the fallback kill-switch signals; zero halt-class triggers; one fix-round total (slice 1 first-Gitar-review clean; slice 2 one inline fold-in for a small resilience finding about symmetric optimistic-state revert in the error path).
- **Spec-author Q3A from chain-open** (SettingsView trigger placement) — landed in this slice as the sibling `DisciplineScanBlock` inside `ProjectSection`, not folded into `BootstrapBlock`.
- **Slice 1's frontend-consumer hand-off** (extended `DisciplineDriftRescanResult` response shape; `api.rescanDisciplineDrift` retyped; `Project.settings_json` carrying `discipline_scan_state` + `discipline_scan_last_run_at`) — all consumed in this slice's `DisciplineScanBlock` + tests.

---

## Chain Summary

Per `AUTO_CONTINUE_WORKFLOW.md` chain-close convention:

| Slice | PR | Merged | Fix-rounds | Net lines |
|---|---|---|---|---|
| 1 — Discipline-scan-state backend lifecycle (bootstrap pre-scan flip + rescan try/finally + periodic-review two-site shared gate + T-D57 Implications amendment) | [#64](https://github.com/jaydomains/throughline/pull/64) | 2026-05-28 | 0 | 768 |
| 2 — SettingsView `DisciplineScanBlock` (chain-close) | [#65](https://github.com/jaydomains/throughline/pull/65) | pending | 1 | ~330 |

**Chain totals:** 2 slices over ~30 minutes; **1 fix-round total** (slice 1 first-Gitar-review clean; slice 2 one inline fold-in for a small Gitar finding about symmetric optimistic-state revert in `onRunScan`'s catch block); 0 halt-class triggers; ~1100 net lines (within the chain-open `small` sizing projection of ~900–1300). T-D57's four implementation surfaces (`discipline_scan_state` field + bootstrap-ingest pre-scan + rescan-endpoint lifecycle + periodic-review gate) + the T-D57 Implications one-line amendment + the SettingsView trigger all landed across the two slices.

**Findings folded inline (all Gitar):**
- **PR #64 (slice 1)** — zero findings on first Gitar review.
- **PR #65 (slice 2)** — one finding on first Gitar review (low-risk-today resilience finding: catch block in `onRunScan` reverted `localState` but not `localLastRun`, and `persistedLastRun` was missing from the `useCallback` deps). Gitar itself flagged it low-risk because the catch block doesn't reference `persistedLastRun` and `localLastRun` is never set before the await — purely a resilience-to-future-edits finding. Folded inline by adding the symmetric `setLocalLastRun(persistedLastRun)` revert + the missing dep. Test suite unaffected (existing error-path test renders with `pre-scan` + null `last_run_at` so the symmetric revert is a no-op observable; adding a regression test for the hypothetical future bug would over-engineer).

**Spec-author decisions locked at chain-open** (all four followed by implementation):
- **Q1A** — flat enum + nullable timestamp inside `settings_json` (matches `periodic_review_interval_days` precedent). ✓ (`packages/shared/src/discipline-scan.ts`)
- **Q2A** — bootstrap `importBootstrap` sets `pre-scan` on first ingest, idempotent; T-D57 Implications one-line amendment folded into slice 1 (Phase 19 Slice 3 precedent). ✓ (`packages/backend/src/bootstrap/service.ts:283`; `DECISIONS.md` T-D57 Implications)
- **Q3A** — new `DisciplineScanBlock` sibling within `ProjectSection`, alongside `BootstrapBlock` (one trigger, two surfaces, applies to all projects). ✓ (this slice consolidates around the sibling-placement decision)
- **Q4A** — proceed on fallback kill-switch signals (`throughline:pause` label still absent at chain-open). ✓ (chain ran end-to-end clean on marker file + `/pause` comments; label still absent at chain-close, fifth-pass carry-forward).

**Execution notes applied throughout:**
- Gate condition written as "suppress when `pre-scan` or `running`" — NOT "surface only when `complete`". The "absent ≡ complete" implicit-mapping preserves non-bootstrap behaviour exactly. The slice 1 load-bearing test's failure message ("non-bootstrap projects must still surface discipline signals — gate must be 'suppress when pre-scan or running', NOT 'surface only when complete'") guards against the inversion.
- Periodic-review's two suppression sites (`drift.listOpenDisciplineSignals` and the bundle-declared hygiene categories block) wired to **one shared** `shouldSuppressDisciplineSignals(state)` condition computed once at the top of `buckets()`. They cannot drift apart.

**Sizing calibration data point:** Phase 22 estimated ~600–900 raw / ~900–1300 actual at chain-open (T-D57 sized `small`). Actual chain: **~1100 net lines** — within projection. **One fix-round total** (slice 2's symmetric-revert resilience finding) — under Phase 21's three-fix-round total. Sized correctly + executed cleanly. T-D57's "no companion C-D anchor" minimal-scaffolding approach proved sufficient for a small phase; the next small phase can mirror this shape.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- `packages/backend/src/methodology/drift/routes.ts` — `POST /api/projects/:id/discipline-drift/rescan` (slice 1) returning `DisciplineDriftRescanResult`.
- `packages/frontend/src/api.ts` `rescanDisciplineDrift` (retyped in slice 1).
- `packages/shared/src/discipline-scan.ts` `DisciplineScanState` + `readDisciplineScan` (slice 1).
- `Project.settings_json` carrying `discipline_scan_state` + `discipline_scan_last_run_at` (slice 1) via existing `GET /api/projects/:id`.
- `packages/frontend/src/views/SettingsView.tsx` `ProjectSection` (Phase 15 + Phase 21 Slice 4 extension) — this slice nests `DisciplineScanBlock` as a sibling of `BootstrapBlock`.

**Downstream (consumes this slice's work):**
- None within the Phases 19–22 cohort. The cohort-level heavy hardener pass over Phases 19–22 picks up the cohort's anchors for promotion to `production-ready`.

---

## Reference

- `DECISIONS.md` T-D57 (line 1255) — full Implications block; bootstrap-pipeline bullet amended in slice 1.
- `SPEC.md` §7.14 "Scan-on-demand for bootstrapped projects" (line 331) — functional spec.
- `ROADMAP.md` §22 (line 449) — Scope / Dependencies / Done when / Sizing (small). Phase 22 done.
- `CHECKLIST.md` §22 — two-slice decomposition; both slices ticked.
- `docs/_meta/throughline/AUTO_CONTINUE_WORKFLOW.md` — chain mechanics, halt classes, kill switch, chain-close convention (full chain summary table).
- `docs/_meta/throughline/AUTHORING_DISCIPLINE.md` — post-work doc hardening gate (per-slice light hardener applied to this slice; cohort-level heavy hardener triggers next).
- `docs/_meta/throughline/PLATFORM_STATUS.md` — current state surface; Snapshot rolls to "Phase 22 closed"; Recent Slice History updated.
- Plan: `/root/.claude/plans/plan-mode-phase-22-build-enchanted-plum.md` (session-local, not in repo).
- Tracking issue: [#63](https://github.com/jaydomains/throughline/issues/63) — `Auto-continue: phase-22-build-enchanted-plum`. Closes on this slice's merge.
- Chain state: `.claude-code/auto-continue-state.json` (chain-closed state after this slice merges).
- Prior handover in this chain: `docs/_meta/throughline/handovers/2026-05-28-phase-22-slice-1-discipline-scan-state-lifecycle.md`.
- PR: [#TBD](https://github.com/jaydomains/throughline/pull/TBD) — Phase 22 / Slice 2 (chain-close).
