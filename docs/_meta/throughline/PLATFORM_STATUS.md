# Throughline — Platform Status

*Living current-state snapshot. Updated at every session sign-off. Read first after `SESSION_START.md`.*

*Mutable file. Older entries are overwritten as they roll — history lives in handovers and `git log`, not here. To understand the past, read handovers. To understand the present, read this file.*

---

## Snapshot

**As of 2026-05-28.** Phase 21 build chain **in flight** — third implementation chain under the codified `AUTO_CONTINUE_WORKFLOW.md` rhythm. Tracking issue [#58](https://github.com/jaydomains/throughline/issues/58) (`Auto-continue: phase-21-build-immutable-riddle`). Three slices merged: PR #59 (slice 1 — prompt template + render endpoint + path-guard + `.gitignore`), PR #60 (slice 2 — chokidar watcher with refcounted registry + startup-scan), PR #61 (slice 3 — archive/quarantine worker + `GET /bootstrap/state` + server.ts wiring that resolves the construction cycle). Three fix-rounds total, one per slice (redundant `resolveBundle` / `register()`-after-`stop()` race / `quarantine()` deleting source on copy failure). Slice 4 (unified Bootstrap & clone-and-go SettingsView block) pending — chain-close slice. Most recent decision: T-D57 (2026-05-26, unchanged — Phase 21 minted zero new T-D anchors).

---

## Current Phase

**Phase:** Phase 21 (`bootstrap prompt template + Claude Code invocation contract`) in flight. Chain opened 2026-05-28.
**Status:** Slices 1, 2, and 3 merged. Slice 3 (`bootstrap/worker.ts` + `GET /bootstrap/state` + server.ts wiring) PR #61 closed with 1 fix-round on the `quarantine()`-deletes-source-on-copy-failure case (Gitar finding folded inline by restructuring quarantine to write `.error.json` first, then copy+rm in a guarded try). The worker is now live in production: the watcher arms on first render call, startupScan picks up restart-recovery files before `app.listen`, and the unregister callback fires on project delete. Slice 4 (unified Bootstrap & clone-and-go SettingsView block, chain-close) pending.
**Next concrete action:** Chain runner auto-advances to slice 4 (the chain's final slice). Slice 4 will replace `ThroughlineStatusBlock` + `BootstrapReviewBlock` in `packages/frontend/src/views/SettingsView.tsx` with a single `BootstrapBlock` that polls `GET /bootstrap/state` and surfaces the render button + copy-paste invocation panel + last-ingest summary + quarantine alerts. Per carry-forward: slice 4's `BootstrapBlock.test.tsx` must cover retained behaviour from the old blocks (status banner accuracy, review-queue link, stale-row count) — not just the new init affordance. Slice 4 handover closes the chain with the standard four-slice summary table.

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
- **`throughline:pause` label creation in `jaydomains/throughline` (fourth pass through this slot).** Still absent at Phase 21 chain-open 2026-05-28. Spec author committed at chain-open to create the label manually out-of-band; Phase 21 chain operates on the two fallback kill-switch signals as planned (marker file at `.claude-code/auto-continue-pause`, `/pause` PR/issue comments) — Phase 19 and Phase 20 both ran clean on these. Closes when `gh label create throughline:pause` runs against the repo (or the equivalent admin UI action). Re-surfaced because this is now the fourth consecutive chain boundary to roll without it.

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
| _this PR_ | Phase 21 / Slice 3 — bootstrap archive/quarantine worker + `GET /bootstrap/state` + server.ts wiring | `handovers/2026-05-28-phase-21-slice-3-worker-and-state-endpoint.md` |
| #60 | Phase 21 / Slice 2 — bootstrap-output chokidar watcher (refcounted registry + startup-scan) | `handovers/2026-05-28-phase-21-slice-2-bootstrap-output-watcher.md` |
| #59 | Phase 21 / Slice 1 — bootstrap prompt template + render endpoint + path-guard + `.gitignore` (chain open) | `handovers/2026-05-28-phase-21-slice-1-prompt-template-render-endpoint-path-guard.md` |
| #57 | Doc carry-forwards cleanup at Phase 20 → Phase 21 boundary | `handovers/2026-05-27-carry-forwards-cleanup-pre-phase-21.md` |
| #56 | Phase 20 / Slice 4 — review queue UI + GET /conflicts + POST /resolve + SettingsView entry block (chain close) | `handovers/2026-05-27-phase-20-slice-4-review-ui-and-resolve-endpoint.md` |

(PR #55 rolls off — covered by its handover in `docs/_meta/throughline/handovers/`.)

---

## Update Protocol

- **Refreshed at every session sign-off.** Last act of a session = update this file before merge. First act of next session = read it.
- **Every entry points at an artefact** — PR number, handover path, anchor ID, or file path. No floating claims.
- **Mutable.** Unlike handovers (immutable per `HANDOVER_TEMPLATE.md` rule 8), this file is rewritten in place. The Phase-22 carve-out for handovers does not apply here.
- **Roll semantics.** When entries roll (Recent Slice History past 5, Locked Decisions at cycle reset), older entries are *overwritten*. History lives in handovers and `git log`, not here.
- **Cycle reset.** "Locked Decisions This Cycle" rolls at a natural cohort boundary (phase close, multi-session stream close). The reset is triggered by the *next* cohort's first decision, not by the cohort-hardener pass itself. The hardener pass marks the cohort `production-ready`; the table retains the just-promoted cohort entries until the next phase mints its first T-D / C-D anchor, at which point the production-ready cohort rolls off and the new cycle begins.
- **Cross-references.** `SESSION_START.md` (reading order); `AUTHORING_DISCIPLINE.md` (post-work gate includes refreshing this file); `AUTO_CONTINUE_WORKFLOW.md` (slice-chain that lands the work this file reports).
