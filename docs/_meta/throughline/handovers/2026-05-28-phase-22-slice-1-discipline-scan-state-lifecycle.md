# Throughline Handover — Phase 22 Slice 1: discipline-scan-state backend lifecycle (chain-open)

**Generated:** 2026-05-28
**Last commit SHA:** pending — 2026-05-28
**Previous handover:** `2026-05-28-phase-21-slice-4-unified-bootstrap-block.md` (PR #62 — Phase 21 Slice 4, chain-close)

First slice of the Phase 22 chain (tracking issue [#63](https://github.com/jaydomains/throughline/issues/63), `Auto-continue: phase-22-build-enchanted-plum`). Fourth implementation chain under the codified `AUTO_CONTINUE_WORKFLOW.md` rhythm.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| T-D57 Implications surface 1 — project record gains three-state discipline-scan tracking (`pre-scan` / `running` / `complete`) with `last_run_at` | built | `packages/shared/src/discipline-scan.ts` (`DisciplineScanState`, `DisciplineScanSettings`); migration **not required** — flat scalars land in the existing `projects.settings_json` TEXT JSON blob | Per spec-author Q1A at chain-open: flat enum + nullable timestamp inside `settings_json` rather than a new column or nested-union shape. Matches the `periodic_review_interval_days` precedent (`periodic-review.ts:78`); the `readDisciplineScan(settings)` accessor in shared gives language-level type safety over the flat storage. |
| T-D57 Implications surface 2 — bootstrap import pipeline sets `pre-scan` on first ingest (idempotent) | built | `packages/backend/src/bootstrap/service.ts:283` `importBootstrap`; tests in `packages/backend/test/discipline-scan-lifecycle.test.ts` ("writes pre-scan on first successful bootstrap import for the project", "is idempotent — re-import does NOT overwrite an existing pre-scan state", "preserves sibling settings_json fields", "does not write a state on validation failure") | Per spec-author Q2A at chain-open: bootstrap ingest is the activation point, not project creation. State flip runs post-transaction so a failed import leaves no residue. Idempotent: `readDisciplineScan` returns `state: undefined` for first-time imports and the existing-state check skips the write on re-import. |
| T-D57 Implications surface 3 — rescan endpoint drives `running → complete + last_run_at` (try/finally crash-safe) | built | `packages/backend/src/methodology/drift/routes.ts:36` rescan endpoint; tests ("transitions pre-scan → running → complete", "re-rescanning from complete refreshes last_run_at", "try/finally self-heals: a scan-engine throw still transitions out of running", "returns 404 without touching state when the project does not exist") | The `finally` block guarantees the state machine self-heals if `engine.runScan` throws — a stranded `running` would permanently suppress periodic-review for the project. Response shape extended from `DisciplineDriftResult` to new `DisciplineDriftRescanResult` (groups + state + timestamp) so slice 2 gets immediate post-rescan feedback without a separate `GET /api/projects/:id` fetch. |
| T-D57 Implications surface 4 — periodic-review scheduling gates on `complete` (or absent ≡ complete-implicit) | built | `packages/backend/src/intelligence/periodic-review.ts:96` `buckets()`; tests ("non-bootstrap projects must still surface discipline signals", "suppresses discipline-drift signals when project is in pre-scan", "suppresses … when project is in running", "surfaces … once the project reaches complete", "also suppresses the bundle-declared hygiene categories block under one shared gate") | Two execution notes from chain-open are wired in: (1) gate written as **"suppress when pre-scan or running"** — NOT "surface only when complete" — so absent state maps to complete-implicit and non-bootstrap projects retain on-bind behaviour exactly. The load-bearing test's failure message ("non-bootstrap projects must still surface discipline signals — gate must be 'suppress when pre-scan or running', NOT 'surface only when complete'") is explicit about what it guards. (2) Both suppression sites (`drift.listOpenDisciplineSignals` and bundle-declared hygiene categories block) read from a **single shared** `shouldSuppressDisciplineSignals(scanState)` computed once at the top of `buckets()`. The two sites cannot drift apart. |
| Spec-author-confirmed amendment — T-D57 Implications "as part of project creation" → "on the first successful bootstrap import for the project" | built | `DECISIONS.md` T-D57 Implications line (the third bullet) | Phase 19 Slice 3 precedent (T-D52 `/api/health` → `/health` amendment landed alongside the code path that exercised it; handover at `handovers/2026-05-27-phase-19-slice-3-cli-init-subcommand.md:17`). T-D57's original wording assumed bootstrap created projects; Phase 20's `importBootstrap` upserts into pre-existing projects. The amendment names the actual activation point. Includes a parenthetical noting the original wording and the amendment date so future readers can trace the change. |
| Helper — `projects.updateSettings(id, partial)` merge-update on `settings_json` | built | `packages/backend/src/projects/service.ts` `updateSettings` (interface + implementation) | The existing `update()` method's `effective.settings ?? before.settings_json` replaces `settings_json` wholesale, which would clobber siblings like `periodic_review_interval_days`. `updateSettings` reads, merges, writes — idempotent; no audit row written (settings_json mutations are implementation-managed, not user-edits). Used at both write sites in this slice. |
| Tracking issue opened with the spec-author-approved title + body | built | Issue [#63](https://github.com/jaydomains/throughline/issues/63) | Title `Auto-continue: phase-22-build-enchanted-plum`; labelled `auto-continue`. Body records the chain shape and the four locked decisions (Q1A/Q2A/Q3A/Q4A). |
| Chain-state file refreshed for Phase 22 chain-open per `AUTO_CONTINUE_WORKFLOW.md` §"Chain State Persistence" | built | `.claude-code/auto-continue-state.json` | Overwrites the chain-closed Phase 21 state. New shape: `chainId: "phase-22-build-enchanted-plum"`, two slices (1 open, 1 pending), tracking issue 63, `currentIndex: 0`. Notes capture the four locked decisions, the two execution notes, and the pre-existing frontend TS drift discovered during this slice. |
| `CHECKLIST.md` §22 two-slice decomposition (replaces placeholder line) | built | `CHECKLIST.md` §22 | Mirrors the post-chain-open shape used by §19 / §20 / §21. Slice 1 marked complete with evidence. |
| `PLATFORM_STATUS.md` Snapshot + Current Phase + Queued Work rolled for Phase 22 chain-open | built | `docs/_meta/throughline/PLATFORM_STATUS.md` | Snapshot rolls to "Phase 22 build chain opened"; Current Phase rolls to "Phase 22 chain opened". Queued Work re-surfaces `throughline:pause` label gap as **fifth-pass** entry and adds the pre-existing frontend `bootstrapBlock.test.tsx` strict-typecheck errors as a separate carry-forward for the cohort-level heavy hardener pass at Phase 22 close. |

---

## Last Decision Minted

No new T-D / C-D anchors minted. Implementation followed T-D57's Implications block (the implementation spec for Phase 22, per the explicit "No companion C-D anchor for Phase 22" clause in T-D57). Decisions locked at chain-open and recorded in the plan file (session-local, not in repo):

- **Spec-author-confirmed amendment to T-D57 Implications** — the "as part of project creation" wording amended to "on the first successful bootstrap import for the project". One-line edit landed in this slice's PR (Phase 19 Slice 3 T-D52 `/api/health` → `/health` precedent). The amendment is a clarification of which activation point is canonical for the bootstrap-origin trigger, not a new rule.

Implementation-shape choices recorded inline at the implementation site:

- **Flat-scalar storage + typed accessor.** The shape lives flat in `settings_json` to match `periodic_review_interval_days` precedent and to keep `settings_json` queryable for scan-staleness; the `readDisciplineScan(settings)` accessor gives type safety at the language level without nesting the storage.
- **Single shared gate condition wired into both periodic-review suppression sites.** `shouldSuppressDisciplineSignals(state)` is computed once at the top of `buckets()` and the same boolean governs both `listOpenDisciplineSignals` and the bundle-declared hygiene categories block. Splitting into two checks would create the partial-leak failure mode (some signals suppressed, others surface).
- **Try/finally state-machine self-heal.** The rescan endpoint writes `running` before the scan and `complete + last_run_at` in `finally`, so even a thrown scanner crash leaves the state in `complete` rather than stranded in `running`.
- **State flip runs post-transaction in `importBootstrap`.** Validation failures throw before the flip; a failed import leaves no state residue. Tested.
- **Idempotency by existence check, not by overwrite-with-same-value.** `importBootstrap` reads `discipline_scan_state` and only writes `pre-scan` if the field is absent. Re-imports of a project mid-rescan stay `running`; re-imports of a project that already completed its first scan stay `complete` with the original timestamp.

---

## Active Blockers

_none_

The `throughline:pause` label gap is not a blocker — spec author committed at Phase 22 chain-open to create it out-of-band during this chain. Phases 19/20/21 all ran end-to-end clean on the two fallback signals (marker file + `/pause` PR/issue comments); Phase 22 chain runs under the same fallback posture.

---

## Files Changed Since Last Handover

**New:**
- `packages/shared/src/discipline-scan.ts` — `DisciplineScanState`, `DisciplineScanSettings`, `readDisciplineScan(settings)` typed accessor, `shouldSuppressDisciplineSignals(state)` shared gate condition, `DisciplineDriftRescanResult` extended response shape. Phase 22 / T-D57.
- `packages/backend/test/discipline-scan-lifecycle.test.ts` — 13 tests across three describes: bootstrap-ingest first-write (4 cases), rescan endpoint transitions (4 cases), periodic-review two-site gate (5 cases). The load-bearing "non-bootstrap projects must still surface discipline signals" test carries an explicit failure message about what it guards.
- `docs/_meta/throughline/handovers/2026-05-28-phase-22-slice-1-discipline-scan-state-lifecycle.md` — this handover.

**Modified:**
- `DECISIONS.md` — T-D57 Implications one-line amendment ("as part of project creation" → "on the first successful bootstrap import for the project") per Phase 19 Slice 3 precedent. Parenthetical names the original wording, the amendment date, and the reason (Phase 20's `importBootstrap` upserts; doesn't create projects).
- `packages/shared/src/index.ts` — barrel export for `discipline-scan.ts`.
- `packages/backend/src/projects/service.ts` — `updateSettings(id, partial)` merge helper added to `ProjectsService` interface + implementation. Reuses existing `db.prepare(UPDATE …)` pattern.
- `packages/backend/src/bootstrap/service.ts` — `importBootstrap(projectId, input)` (line 283) flips `discipline_scan_state` to `pre-scan` post-transaction if absent. Idempotent. Imports `readDisciplineScan` from `@throughline/shared`.
- `packages/backend/src/methodology/drift/routes.ts` — rescan endpoint (line 36) wraps `engine.runScan` in try/finally driving the state lifecycle. Response shape extended from `DisciplineDriftResult` to `DisciplineDriftRescanResult` (carries `groups` + `discipline_scan_state` + `discipline_scan_last_run_at`). Imports `readDisciplineScan` and `DisciplineDriftRescanResult` from `@throughline/shared`.
- `packages/backend/src/intelligence/periodic-review.ts` — `buckets(projectId)` reads `discipline_scan_state` once at top and routes both suppression sites through `shouldSuppressDisciplineSignals(scanState)`. Imports `readDisciplineScan` and `shouldSuppressDisciplineSignals` from `@throughline/shared`.
- `packages/frontend/src/api.ts` — `rescanDisciplineDrift` now typed as `DisciplineDriftRescanResult` (was `DisciplineDriftResult`). Import added; type-only change preparing for slice 2's consumer.
- `CHECKLIST.md` §22 — placeholder replaced with two-slice decomposition; slice 1 ticked with concrete evidence (file paths + test counts + line refs).
- `docs/_meta/throughline/PLATFORM_STATUS.md` — Snapshot rolls to "Phase 22 build chain opened"; Current Phase rolls; Queued Work `throughline:pause` entry re-surfaces as fifth-pass; new entry added for pre-existing frontend `bootstrapBlock.test.tsx` strict-typecheck errors.
- `.claude-code/auto-continue-state.json` — overwritten with Phase 22 chain shape (2 slices, slice 1 open, `currentIndex: 0`). Notes capture the four locked decisions, the two execution notes, the pre-existing frontend TS drift, and sizing projection.

**Deleted:** _none_.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Pre-existing frontend `bootstrapBlock.test.tsx` strict-typecheck errors | `packages/frontend/test/bootstrapBlock.test.tsx` (lines 72, 188, 207, 232, 250) | `pnpm --filter @throughline/frontend build` (which runs `tsc -b`) fails on five errors under Phase 21 Slice 4's introduction of `exactOptionalPropertyTypes` strictness on `Project.throughline_status`. **Pre-existing on `main` post-Phase-21-Slice-4** — confirmed by `git stash` test (errors present on main without slice 1 changes). | Surfaced — not absorbed into this slice. Recorded in `PLATFORM_STATUS.md` Queued Work as a separate carry-forward for the cohort-level heavy hardener pass at Phase 22 close. Slice 1 work is unrelated; the frontend test suite itself passes 174/174 because vitest does not run strict typecheck. Backend + shared `pnpm build` is clean. |
| `throughline:pause` label still absent at Phase 22 chain-open (fifth consecutive chain to roll without it) | `jaydomains/throughline` repo settings | Persistent gap carried through Phases 19/20/21 (four passes). Phase 22 chain proceeds on fallback signals (marker file + `/pause` comments). | Tracked in `PLATFORM_STATUS.md` Queued Work as the fifth-pass entry. Spec author committed at Phase 22 chain-open to create it manually out-of-band during this chain. |

---

## Open Questions

- [ ] **Phase 22 Slice 2** — frontend `DisciplineScanBlock` sibling within `ProjectSection`. Consumes the slice 1 backend's `DisciplineScanState` type, the extended `Project.settings_json` via existing `GET /api/projects/:id`, and the extended `DisciplineDriftRescanResult` from `POST /api/projects/:id/discipline-drift/rescan`. Per Q3A: sibling block (not folded into `BootstrapBlock`) — discipline scanning is "one trigger, two surfaces" applying to all projects, not bootstrap-only.
- [ ] **Cohort-level heavy hardener pass over Phases 19–22 build outputs** triggers at Phase 22 close — promotes the cohort's anchors to `production-ready`. Phase 22 contributes: T-D57 → production-ready (Implications block amended this slice; no new T-D / C-D anchors minted across Phase 22). Carries forward two pre-existing drifts surfaced this slice: frontend `bootstrapBlock.test.tsx` TS errors; `throughline:pause` label gap (if still absent at hardener time).

---

## Recently Resolved

- **Phase 22 chain-open.** Slice 1 lands the backend half of T-D57's deliverable. Tracking issue [#63](https://github.com/jaydomains/throughline/issues/63) opened with the four spec-author decisions (Q1A/Q2A/Q3A/Q4A) explicit in the body.
- **T-D57 Implications wording mismatch** (raised during plan-mode exploration). Phase 20's `importBootstrap` upserts into projects rather than creating them, so T-D57's "as part of project creation" did not match the code path. Resolved in this slice via the one-line amendment (Phase 19 Slice 3 precedent).
- **Q1 from chain-open** — flat enum + nullable timestamp in `settings_json` rather than a new column or nested-union shape. Landed in `shared/src/discipline-scan.ts`.
- **Q2 from chain-open** — bootstrap `importBootstrap` sets `pre-scan` on first ingest idempotently. Landed in `bootstrap/service.ts:283`.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- `packages/backend/src/methodology/drift/discipline/engine.ts:117` (`runScan`) — wrapped by the rescan endpoint's try/finally. Engine internals untouched.
- `packages/backend/src/methodology/drift/discipline/scanners.ts` — unchanged.
- `packages/backend/src/bootstrap/service.ts:283` (`importBootstrap`) — pre-existing entry point. State flip folds in post-transaction.
- `packages/backend/src/intelligence/periodic-review.ts:96` (`buckets`) — pre-existing aggregation. Gate folds in at the top, applied to both discipline-drift suppression sites.
- `projects.settings_json` JSON blob (`db/migrations/0001_init.sql:12`) — existing column; no migration needed for the new flat scalars.
- `@throughline/shared` — the package picks up the new `discipline-scan.ts` module via the barrel export.

**Downstream (consumes this slice's work):**
- **Phase 22 Slice 2** — frontend SettingsView `DisciplineScanBlock`. Consumes:
  - `DisciplineScanState` type + `readDisciplineScan` accessor from `@throughline/shared`.
  - Extended `Project.settings_json` carrying `discipline_scan_state` + `discipline_scan_last_run_at` (already returned by existing `GET /api/projects/:id`).
  - `DisciplineDriftRescanResult` from `POST /api/projects/:id/discipline-drift/rescan` (the slice 1 endpoint extension; frontend `api.ts:rescanDisciplineDrift` already retyped this slice for slice 2 to pick up).

---

## Reference

- `DECISIONS.md` T-D57 (line 1255) — full Implications block; bootstrap-pipeline bullet amended in this slice.
- `SPEC.md` §7.14 "Scan-on-demand for bootstrapped projects" (line 331) — functional spec.
- `ROADMAP.md` §22 (line 449) — Scope / Dependencies / Done when / Sizing (small).
- `CHECKLIST.md` §22 — two-slice decomposition; slice 1 ticked.
- `docs/_meta/throughline/AUTO_CONTINUE_WORKFLOW.md` — chain mechanics, halt classes, kill switch, chain-state shape.
- `docs/_meta/throughline/AUTHORING_DISCIPLINE.md` — post-work doc hardening gate (per-slice light hardener applied to this slice).
- `docs/_meta/throughline/handovers/2026-05-27-phase-19-slice-3-cli-init-subcommand.md` — T-D52 `/api/health` → `/health` amendment precedent for this slice's T-D57 fold-in.
- Plan: `/root/.claude/plans/plan-mode-phase-22-build-enchanted-plum.md` (session-local, not in repo).
- Tracking issue: [#63](https://github.com/jaydomains/throughline/issues/63) — `Auto-continue: phase-22-build-enchanted-plum`.
- Chain state: `.claude-code/auto-continue-state.json` (slice 1 open, slice 2 pending).
- PR: [#TBD](https://github.com/jaydomains/throughline/pull/TBD) — Phase 22 / Slice 1 (chain-open).
