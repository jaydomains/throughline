# Throughline — Platform Status

*Living current-state snapshot. Updated at every session sign-off. Read first after `SESSION_START.md`.*

*Mutable file. Older entries are overwritten as they roll — history lives in handovers and `git log`, not here. To understand the past, read handovers. To understand the present, read this file.*

---

## Snapshot

**As of 2026-05-28.** Phase 22 build chain **closed** — fourth implementation chain under the codified `AUTO_CONTINUE_WORKFLOW.md` rhythm ran end-to-end clean. Tracking issue [#63](https://github.com/jaydomains/throughline/issues/63) (`Auto-continue: phase-22-build-enchanted-plum`) closes on Slice 2 merge. Two slices merged via PRs #64 (slice 1) and #TBD (slice 2); zero fix-rounds total (both first-Gitar-review clean); zero halt-class triggers. Net ~1100 net lines across the chain (matches the chain-open `small` sizing projection). The discipline-drift scan-on-demand gate is live end-to-end: bootstrap-imported projects start at `pre-scan` (silent drift inbox on day one); SettingsView's new `DisciplineScanBlock` surfaces a prominent CTA for the first scan, demoted re-scan affordance afterward; periodic-review's two suppression sites are wired to one shared `shouldSuppressDisciplineSignals` condition so partial day-one noise cannot leak; non-bootstrap projects retain on-bind behaviour entirely. T-D57's Implications one-line correction folded into slice 1 ("as part of project creation" → "on the first successful bootstrap import for the project") per Phase 19 Slice 3's T-D52 amendment precedent. Phases 19–22 build cohort now feature-complete end-to-end; cohort-level heavy hardener pass triggers next to promote the cohort's anchors to `production-ready`.

---

## Current Phase

**Phase:** none in flight. Phase 22 closed 2026-05-28.
**Status:** Phases 19–22 build cohort feature-complete end-to-end. Cohort-level heavy hardener pass over the Phase 19–22 build outputs is the next scheduled work (promotes T-D51 / T-D52 / T-D53 / T-D54 / T-D55 / T-D56 / T-D57 + C-D19 / C-D20 / C-D21 to `production-ready`). No open slices, no open PRs.
**Next concrete action:** spec author triggers the cohort-level heavy hardener pass (or queues the next phase). No build phase is currently open.

---

## Locked Decisions This Cycle

T-D anchors minted in the current cycle (Phase 18 + the five-session doc-authoring stream). All entries below were promoted to `production-ready` 2026-05-26 by the cohort-level heavy hardener pass (PR #43). C-D anchors for the same cohort: C-D19, C-D20, C-D21. One line each; full bodies in `DECISIONS.md` / `CODE_SPEC.md`. This table rolls when the next cohort's first new T-D / C-D anchor lands, so the just-promoted state stays visible across the immediately-next session.

| Anchor | Phase | One-line |
|---|---|---|
| T-D49 | 18 | §6 bundle grammar ratified (typed edge-types, tier-routing, producer-ownership); bundles declare shape, projects supply concrete contract paths. |
| T-D50 | 18 | Communication graph renders at rule-level (not instance-level); mediated-edge two-arrow rendering; freshness coupled to item state. |
| T-D51 | 19 | Loader gains a third bundle-resolution arm: `<repo_path>/.throughline/bundle.md` (per-repo carve-out), between explicit-external and install-default. |
| T-D52 | 19 | `throughline init` requires the running backend; CLI calls HTTP endpoints, never writes SQLite directly (single write path). |
| T-D53 | 20 | Bootstrap import file = structured per-source rows for items, sessions, and library entries; bundle-aware validation; secrets and runtime state excluded. |
| T-D54 | 20 | Bootstrap re-run is idempotent upsert on `(project_id, bootstrap_id)`; three row states; `bootstrap_id` derived per source type with universal `@bootstrap-id:` override. |
| T-D55 | 21 | Bootstrap prompt is a single repo-owned generic template; bundle-awareness at run time via LLM bundle-read, not Throughline-side templating. |
| T-D56 | 21 | Claude Code invocation is user-driven; Throughline watches `.throughline/bootstrap-output.json` via chokidar; subprocess-spawning deferred. |
| T-D57 | 22 | Discipline-drift scanners do not auto-run on bind for bootstrap projects; SettingsView gains "Run discipline scan" trigger; periodic-review gated on first user-invoked scan. |

---

## Queued Work

- **Cohort-level heavy hardener pass over Phases 19–22 build outputs (triggered at Phase 22 close).** The next scheduled hardener pass covers the full Phases 19–22 build cohort cumulatively, not Phase 22 alone — same shape as PR #43 covered the Phases 19–22 *doc-prereqs* cohort. Triggers at Phase 22 close; promotes the cohort's anchors to `production-ready` and rolls `PLATFORM_STATUS.md` accordingly.
- **`throughline:pause` label creation in `jaydomains/throughline` (fifth pass through this slot).** Still absent at Phase 22 chain-close 2026-05-28. Phase 22 chain ran end-to-end clean on the two fallback kill-switch signals (marker file at `.claude-code/auto-continue-pause`, `/pause` PR/issue comments) — Phases 19/20/21/22 all ran clean on these. Closes when `gh label create throughline:pause` runs against the repo (or the equivalent admin UI action). Will become the sixth-pass entry if the next chain opens without it.
- **Pre-existing frontend `bootstrapBlock.test.tsx` strict-typecheck errors carried through Phase 22.** `pnpm --filter @throughline/frontend build` (which runs `tsc -b`) fails on five errors in `packages/frontend/test/bootstrapBlock.test.tsx` (lines 72, 188, 207, 232, 250) under Phase 21 Slice 4's introduction of `exactOptionalPropertyTypes` strictness on `Project.throughline_status`. The test suite itself passes (vitest does not run strict typecheck — Phase 22 added +8 tests → 182/182 across both slices). Pre-existing on `main` post-Phase-21-Slice-4 — confirmed by `git stash` test at Phase 22 chain-open. Carried into the cohort-level heavy hardener pass over Phases 19–22 — landing site to either fix or accept as a known carry-forward.

---

## Open Spec-Author Gaps

Mirrors `SESSION_START.md` §"Known spec-author gaps". Current state of each:

- **CODE_SPEC.md "Questions for the spec author" (two items)** — item 8 (voice input language default for the speech-recognition `lang` parameter, §13) and item 9 (cost meter daily threshold default value, §13 / §7.25). Items 1–7 closed by SPEC.md amendments and corresponding C-D anchors (refreshed by PR #43; the live state is in `CODE_SPEC.md`).
- **`<!-- RATIONALE NEEDED -->` markers in `DECISIONS.md` (four)** — T-D10, T-D15, T-D17, T-D23. All still open.

When work touches one of these, surface back to the spec author rather than picking an answer.

---

## Recent Slice History

Most recent merged PRs, one line each + handover path. Last five only; older entries roll off — history lives in `docs/_meta/throughline/handovers/` and `git log`.

| PR | Title | Handover |
|---|---|---|
| _this PR_ | Phase 22 / Slice 2 — SettingsView `DisciplineScanBlock` (chain close) | `handovers/2026-05-28-phase-22-slice-2-discipline-scan-block.md` |
| #64 | Phase 22 / Slice 1 — discipline-scan-state backend lifecycle (chain open) | `handovers/2026-05-28-phase-22-slice-1-discipline-scan-state-lifecycle.md` |
| #62 | Phase 21 / Slice 4 — unified Bootstrap & clone-and-go SettingsView block (chain close) | `handovers/2026-05-28-phase-21-slice-4-unified-bootstrap-block.md` |
| #61 | Phase 21 / Slice 3 — bootstrap archive/quarantine worker + `GET /bootstrap/state` + server.ts wiring | `handovers/2026-05-28-phase-21-slice-3-worker-and-state-endpoint.md` |
| #60 | Phase 21 / Slice 2 — bootstrap-output chokidar watcher (refcounted registry + startup-scan) | `handovers/2026-05-28-phase-21-slice-2-bootstrap-output-watcher.md` |

(PR #59 and #57 roll off — covered by their handovers in `docs/_meta/throughline/handovers/`.)

---

## Update Protocol

- **Refreshed at every session sign-off.** Last act of a session = update this file before merge. First act of next session = read it.
- **Every entry points at an artefact** — PR number, handover path, anchor ID, or file path. No floating claims.
- **Mutable.** Unlike handovers (immutable per `HANDOVER_TEMPLATE.md` rule 8), this file is rewritten in place. The Phase-22 carve-out for handovers does not apply here.
- **Roll semantics.** When entries roll (Recent Slice History past 5, Locked Decisions at cycle reset), older entries are *overwritten*. History lives in handovers and `git log`, not here.
- **Cycle reset.** "Locked Decisions This Cycle" rolls at a natural cohort boundary (phase close, multi-session stream close). The reset is triggered by the *next* cohort's first decision, not by the cohort-hardener pass itself. The hardener pass marks the cohort `production-ready`; the table retains the just-promoted cohort entries until the next phase mints its first T-D / C-D anchor, at which point the production-ready cohort rolls off and the new cycle begins.
- **Cross-references.** `SESSION_START.md` (reading order); `AUTHORING_DISCIPLINE.md` (post-work gate includes refreshing this file); `AUTO_CONTINUE_WORKFLOW.md` (slice-chain that lands the work this file reports).
