# Throughline Handover — Phase 21 Slice 4: unified Bootstrap & clone-and-go SettingsView block (chain-close)

**Generated:** 2026-05-28
**Last commit SHA:** pending — 2026-05-28
**Previous handover:** `2026-05-28-phase-21-slice-3-worker-and-state-endpoint.md` (PR #61 — Phase 21 Slice 3)

Fourth and final slice of the Phase 21 chain (tracking issue [#58](https://github.com/jaydomains/throughline/issues/58), `Auto-continue: phase-21-build-immutable-riddle`). **Chain-close handover** — carries the full four-slice summary table per the AUTO_CONTINUE_WORKFLOW chain-close convention.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| C-D21 surface 6 — SettingsView gains per-project bootstrap block alongside C-D19's `.throughline/` missing-config component; surfaces bootstrap state, copy-paste invocation command, and quarantine state | built | `packages/frontend/src/views/SettingsView.tsx` (`BootstrapBlock` exported component, ~165 lines); `packages/frontend/test/bootstrapBlock.test.tsx` (17 tests) | Spec-author decision at chain-open Q3: **consolidated into one unified block**, not three siblings. The previous `ThroughlineStatusBlock` (C-D19) and `BootstrapReviewBlock` (C-D20) were absorbed into `BootstrapBlock` together with the new Phase 21 render/state/quarantine affordances. C-D20 explicitly left the placement of these blocks open; Phase 21 is when surfacing density grew to the point that consolidation made sense. |
| Retained behaviour from `ThroughlineStatusBlock`: status banner accuracy across `.throughline/` states (absent / partial / complete); legacy-undefined hides banner | built | `bootstrapBlock.test.tsx` "renders the absent/partial/complete status banner" + "hides the status banner entirely when throughline_status is undefined" | Status copy carried verbatim into module-level `STATUS_LABELS` map. Block-level `data-testid="bootstrap-block"` exists alongside `data-testid="throughline-status"` so legacy tests targeting the inner banner still pass while the new container is also addressable. |
| Retained behaviour from `BootstrapReviewBlock`: stale-row count display + review button (disabled on zero) + modal mount on open | built | `bootstrapBlock.test.tsx` "displays the stale-row count alongside a disabled review button when no stale rows" + "displays the stale-row count and enables the review button when stale rows exist" + "opening the review button mounts the BootstrapReviewModal" | `data-testid="bootstrap-review-block"` and `data-testid="bootstrap-review-open"` carried over from the old block so existing E2E selectors keep working. |
| Loading-failure tolerance — subsections hide cleanly on GET failure | built | `bootstrapBlock.test.tsx` "hides the review subsection when the conflicts GET fails (no dangling loading state)" | The previous `BootstrapReviewBlock` returned `null` when `count === null`; the unified block applies the same pattern to the stale-row subsection. Status banner / render / state are independent — they don't disappear together. |
| Phase 21 render affordance — `POST /bootstrap/render`, copy-paste invocation panel, inline error display, label toggles "Render" ↔ "Re-render" based on `promptRendered` | built | `bootstrapBlock.test.tsx` "shows the render button when status complete and prompt not yet rendered" + "clicking render calls api.renderBootstrapPrompt and displays the invocation command" + "renders an inline error and leaves the button enabled when the render call fails" + "displays Re-render prompt label when GET state reports promptRendered=true" | Render hidden when `throughline_status === 'absent'` (no repo bound; render endpoint would 400). New `api.renderBootstrapPrompt` and `api.getBootstrapState` wrappers added to `packages/frontend/src/api.ts`. |
| Phase 21 last-ingest summary surfaces — timestamp + per-status counts from `GET /bootstrap/state` | built | `bootstrapBlock.test.tsx` "renders the last-ingest summary when GET state returns lastIngest" + "hides the last-ingest summary when GET state has lastIngest=null" | Backend cache is in-memory (slice 3) — null after backend restart until the next ingest. The block hides the summary cleanly in that case. |
| Phase 21 quarantine alert — surfaces non-zero `quarantineCount` from `GET /bootstrap/state` | built | `bootstrapBlock.test.tsx` "renders the quarantine alert when GET state reports quarantineCount > 0" + "omits the quarantine alert when quarantineCount is zero" | Directs the user to `.throughline/bootstrap-quarantine/` for manual inspection. The sibling `.error.json` slice 3 writes contains the validator error envelope. |
| New types in `@throughline/shared` for the new endpoints | built | `packages/shared/src/bootstrap.ts` adds `BootstrapRenderResult`, `BootstrapState`, `BootstrapStateLastIngest` | Mirrors the slice 1 + slice 3 backend response shapes. Auto-exported via the existing barrel in `packages/shared/src/index.ts`. |

---

## Last Decision Minted

No new decisions minted. Implementation followed T-D55 + T-D56 (slice 1 + slice 3 endpoints consumed verbatim), C-D21 surface 6 (unified bootstrap block per the spec-author Q3 decision at chain-open). Implementation-shape choices recorded inline at the block site:

- **Module-level `STATUS_LABELS` map.** The old `ThroughlineStatusBlock` defined the absent/partial/complete copy inside its function body — re-allocated on every render. Hoisting to a module constant simplifies the function body and matches React's "stable references for static maps" idiom.
- **Render affordance hidden on `throughline_status === 'absent'`.** Render would 400 with `no_bundle_bound` if there's no repo bound; we could surface the error inline but the cleaner UX is to hide the affordance entirely. The status banner still tells the user what to do (`Run throughline init`).
- **State refresh after render.** The render endpoint arms the watcher and mkdirs `.throughline/` if absent. Re-fetching `GET /bootstrap/state` immediately after a successful render gives the user accurate visual feedback (status flips to `present`, `promptRendered` flips to true → button relabels to "Re-render prompt").
- **Block-level wrapper `data-testid="bootstrap-block"`.** Gives slice 4 tests + future selectors a stable handle on the consolidated container, while the inner `bootstrap-block`-data-testids the old blocks used (`throughline-status`, `bootstrap-review-block`, etc.) remain valid for existing assertions.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/frontend/test/bootstrapBlock.test.tsx` — 17 tests; retained behaviour (7) + Phase 21 affordances (10).
- `docs/_meta/throughline/handovers/2026-05-28-phase-21-slice-4-unified-bootstrap-block.md` — this handover.

**Modified:**
- `packages/shared/src/bootstrap.ts` — `BootstrapRenderResult`, `BootstrapState`, `BootstrapStateLastIngest` types added.
- `packages/frontend/src/api.ts` — `api.renderBootstrapPrompt`, `api.getBootstrapState`.
- `packages/frontend/src/views/SettingsView.tsx` — `ThroughlineStatusBlock` and `BootstrapReviewBlock` removed; replaced with exported `BootstrapBlock` (~165 lines). `BootstrapState` import added.
- `packages/frontend/test/fixtures/mockApi.ts` — `renderBootstrapPrompt`, `getBootstrapState` mocks added.
- `.claude-code/auto-continue-state.json` — slice 3 marked merged (PR #61 merge timestamp); slice 4 open (PR #62, 0 fix-rounds); `currentIndex: 3`. Chain marked closed via `chainClosedAt` once this PR merges.
- `CHECKLIST.md` §21 — slice 4 ticked with evidence; chain-close marker added.
- `docs/_meta/throughline/PLATFORM_STATUS.md` — Snapshot rolls to "Phase 21 closed"; Current Phase rolls to "Phase 22 ready to chain-open"; Recent Slice History rolls (PR #56 falls off).

**Deleted:** _none_ (consolidation in-place removed the old block function bodies but the file path is unchanged).

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| `throughline:pause` label still absent at Phase 21 chain-close (fourth consecutive chain to roll without it) | `jaydomains/throughline` repo settings | Persistent gap carried through all four slices. Phase 21 chain operated end-to-end clean on the two fallback signals (marker file + `/pause` comments). | Tracked in `PLATFORM_STATUS.md` Queued Work as the fourth-pass entry. Phase 21 closed without the label; spec-author has committed to create it manually out-of-band. Will become the fifth-pass entry if Phase 22 opens without it. |

---

## Open Questions

- [ ] **Phase 22 chain-open** — Discipline-drift scan-on-demand (T-D57). Doc prerequisites complete per `PLATFORM_STATUS.md`; next action is plan-mode entry for the Phase 22 chain.
- [ ] **Cohort-level heavy hardener pass over Phases 19–22 build outputs** triggers at Phase 22 close — promotes the cohort's anchors to `production-ready`. Phase 21 contributed: C-D21 → production-ready; T-D55 and T-D56 → production-ready (no T-D anchors minted in Phase 21).

---

## Recently Resolved

- **Phase 21 chain-close.** All four slices merged. The chain ran clean on the fallback kill-switch signals; zero halt-class triggers; three fix-rounds total (one per slice 1, 2, 3 — all Gitar-surfaced, all folded inline). Slice 4 came in with zero findings on first Gitar review.
- **Spec-author Q3 from chain-open** (init UX block placement) — landed in this slice as the consolidated `BootstrapBlock`.
- **Carry-forward from slice 2 + chain-open** (slice 4 retained-behaviour test coverage) — every code path from the old blocks asserted explicitly in `bootstrapBlock.test.tsx`.

---

## Chain Summary

Per `AUTO_CONTINUE_WORKFLOW.md` chain-close convention:

| Slice | PR | Merged | Fix-rounds | Net lines |
|---|---|---|---|---|
| 1 — Prompt template + render endpoint + path-guard + `.gitignore` | [#59](https://github.com/jaydomains/throughline/pull/59) | 2026-05-28 | 1 | 679 |
| 2 — Bootstrap-output chokidar watcher | [#60](https://github.com/jaydomains/throughline/pull/60) | 2026-05-28 | 1 | 578 |
| 3 — Archive/quarantine worker + `GET /bootstrap/state` + server.ts wiring | [#61](https://github.com/jaydomains/throughline/pull/61) | 2026-05-28 | 1 | 877 |
| 4 — Unified Bootstrap & clone-and-go SettingsView block (chain-close) | [#62](https://github.com/jaydomains/throughline/pull/62) | pending | 0 | 451 |

**Chain totals:** 4 slices over ~3 hours; 3 fix-rounds total (one per slices 1, 2, 3 — all Gitar-surfaced, all folded inline); 0 halt-class triggers; ~2585 net lines (under the chain-open projection of 3500–4400; no slice exceeded 900 net lines). C-D21's six surfaces + the `.gitignore` write from the implications block all landed across the four slices.

**Findings folded inline (all Gitar):**
- **PR #59 (slice 1)** — redundant `resolveBundle` call in `resolveBundleFile` opened a race window where the two calls could disagree (e.g. bundle file deleted between calls would silently fall through to arm 3). Folded inline by removing the inner call entirely; outer `loaded`-gate plus arm-2 `existsSync` correctly captures registry arm precedence.
- **PR #60 (slice 2)** — `register()` after `stop()` could leak a chokidar instance (the trailing `entries.clear()` drops the map reference but the FSWatcher keeps running un-closed). Folded inline via a `stopping`-flag guard at `register()` entry; +1 regression test.
- **PR #61 (slice 3)** — `quarantine()` deleted the source `bootstrap-output.json` even when `copyFileSync` failed; both payload and recovery surface were lost. Folded inline by restructuring quarantine to write `.error.json` first, then group copy+rm in a guarded try (mirrors `inbox/worker.ts:92-101` exactly).
- **PR #62 (slice 4)** — zero findings on first Gitar review.

**Spec-author decisions locked at chain-open** (all followed by implementation):
- **Q1** — 4 slices, not 3. Watcher and worker isolated; slice 2 ships against an injected `BootstrapWorker` interface stubbed in tests; slice 3 lands the real worker and wires it. ✓
- **Q2** — Startup-scan + render-call refcount belt-and-braces. ✓ (slice 2 implemented startup-scan; slice 3 calls it before `app.listen`.)
- **Q3** — Unified Bootstrap & clone-and-go block (not three siblings or deferred). ✓ (this slice consolidates.)
- **Q4** — Proceed on fallback kill-switch signals (the `throughline:pause` label was still absent at chain-open). ✓ (chain ran end-to-end clean on marker file + `/pause` comments; label still absent at chain-close, fourth-pass carry-forward.)

**Slice-2 carry-forward decision** (confirmed at slice 2 open per chain-open carry-forward): the "user renders prompt then never runs Claude Code" abandonment leak is **accepted**. Documented in `watcher.ts` module header + `register()` comment. Spec author re-confirmed: chokidar `depth: 0` on a single directory is near-free; backend restart self-clears the registry; render is a rare action — over-engineering self-clearing cleanup is the wrong cost trade.

**Sizing calibration data point:** Phase 21 estimated ~2200 raw / ~3500–4400 actual at chain-open (1.3–1.5× multiplier carried forward from Phases 19+20). Actual chain: **~2585 net lines** (under projection). The multiplier overshot Phase 21 because every slice in this chain consumed substantial existing precedent (inbox watcher + worker; the existing canonicalisation helper; the existing fastify route registration shape). Phases 22+ should not assume the same headroom; this chain's discount was precedent-driven.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- `packages/backend/src/bootstrap/routes.ts` — `POST /api/projects/:id/bootstrap/render` (slice 1) and `GET /api/projects/:id/bootstrap/state` (slice 3).
- `packages/frontend/src/components/BootstrapReviewModal.tsx` — mounted on review-button click (Phase 20 Slice 4 surface, carried forward).
- `packages/shared/src/bootstrap.ts` — existing types from Phase 20 + new types from this slice.

**Downstream (consumes this slice's work):**
- None within the Phases 19–22 cohort. Phase 22 (discipline-drift scan-on-demand) consumes the Phase 21 bootstrap pipeline output indirectly (a bootstrapped project will have its scan-on-demand trigger gated on the first user-invoked scan per T-D57), but does not depend on the SettingsView block shape.

---

## Reference

- `DECISIONS.md` T-D55, T-D56 — single repo-owned generic template; file-mediated invocation contract.
- `CODE_SPEC.md` C-D21 — six implementation surfaces; this slice lands surface 6, the chain's final surface. All six surfaces + the `.gitignore` write from the implications block now landed across slices 1–4.
- `SPEC.md` §7.28 — bootstrap prompt and Claude Code invocation.
- `ROADMAP.md` §21 — Scope / Dependencies / Done when / Sizing (medium). Phase 21 done.
- `docs/.throughline-schema.md` — transient-files section. `BootstrapBlock` is the user-facing surface for inspecting the schema's transient state.
- `docs/_meta/throughline/AUTO_CONTINUE_WORKFLOW.md` — chain mechanics, halt classes, kill switch, chain-close convention (four-slice summary table).
- Plan: `/root/.claude/plans/plan-mode-phase-21-build-immutable-riddle.md` (session-local, not in repo).
- Tracking issue: [#58](https://github.com/jaydomains/throughline/issues/58) — `Auto-continue: phase-21-build-immutable-riddle`. Closes on this slice's merge.
- Chain state: `.claude-code/auto-continue-state.json` (chain-closed state after this slice merges).
- Prior handovers in this chain:
  - `docs/_meta/throughline/handovers/2026-05-28-phase-21-slice-1-prompt-template-render-endpoint-path-guard.md`
  - `docs/_meta/throughline/handovers/2026-05-28-phase-21-slice-2-bootstrap-output-watcher.md`
  - `docs/_meta/throughline/handovers/2026-05-28-phase-21-slice-3-worker-and-state-endpoint.md`
- PR: [#62](https://github.com/jaydomains/throughline/pull/62) — Phase 21 / Slice 4 (chain-close).
