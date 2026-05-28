# Throughline — Platform Status

*Living current-state snapshot. Updated at every session sign-off. Read first after `SESSION_START.md`.*

*Mutable file. Older entries are overwritten as they roll — history lives in handovers and `git log`, not here. To understand the past, read handovers. To understand the present, read this file.*

---

## Snapshot

**As of 2026-05-28.** Cohort-level heavy hardener pass over **Phases 19–22 build outputs** complete (second cohort hardener under the two-cadence model; PR #43 covered the doc prereqs). Phases 19–22 build cohort now **production-ready end-to-end** — the bootstrap-and-clone-and-go arc is shippable as a single coherent feature. T-D51 / T-D52 / T-D53 / T-D54 / T-D55 / T-D56 / T-D57 + C-D19 / C-D20 / C-D21 promoted to `production-ready`. The pass landed: (1) the strict-tsc fix for the six pre-existing errors in `bootstrapBlock.test.tsx` (5 known) and `gatesView.test.tsx` (1 surfaced this pass via a CI-hole sweep — Phase 22 Slice 1's `rescanDisciplineDrift` retyping missed an inline mock); (2) `.github/workflows/ci.yml` running `pnpm -r typecheck && pnpm -r test && pnpm -r lint && pnpm -r build` so the gate's CI layer stops being a documented aspiration with no enforcement (advisory until the spec author sets it as a required status check in branch protection); (3) AUTO_CONTINUE_WORKFLOW.md kill-switch demotion of `throughline:pause` to optional/future per the five-pass run-clean evidence (marker file + `/pause` comments confirmed as the two canonical signals); (4) inline parenthetical amendments on C-D19 surface 6 / C-D20 surface 5 / C-D21 surface 6 documenting the Phase 21 Slice 4 unified-BootstrapBlock consolidation (T-D57 amendment precedent); (5) one-line authoring-discipline note capturing the "small phases may use T-D Implications in lieu of a companion C-D anchor" precedent (Phase 22 / T-D57); (6) three mechanical backfills — CHECKLIST §19 Slice 4 ticked (was `[ ]` despite PR #50 merged), PLATFORM_STATUS Recent Slice History rolled, Snapshot rewritten. Pre-fix CI-hole sweep result for the record: 6 typecheck errors / 0 lint errors / 500 backend + 182 frontend tests passing — blast radius across four chains run without enforced CI was six type errors, zero in shipped non-test code.

---

## Current Phase

**Phase:** none in flight. Phase 22 closed 2026-05-28; cohort-level heavy hardener pass over the Phase 19–22 build outputs closed 2026-05-28.
**Status:** Phases 19–22 build cohort `production-ready` end-to-end. No open slices, no open PRs (other than this hardener PR itself).
**Next concrete action:** spec author queues the next build phase (or triggers the next out-of-band action — branch-protection required-check setting for the new CI workflow; see Queued Work).

---

## Locked Decisions This Cycle

T-D anchors minted in the current cycle (Phase 18 + the five-session doc-authoring stream + the Phases 19–22 build cohort). Doc-prereq anchors (T-D49…T-D57) promoted to `production-ready` 2026-05-26 by PR #43; the seven build-cohort T-D anchors plus C-D19 / C-D20 / C-D21 promoted to `production-ready` 2026-05-28 by this hardener pass over the build outputs. One line each; full bodies in `DECISIONS.md` / `CODE_SPEC.md`. This table rolls when the next cohort's first new T-D / C-D anchor lands, so the just-promoted state stays visible across the immediately-next session.

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

- **Branch-protection required-check setting for `.github/workflows/ci.yml`** (manual repo-admin action). The hardener pass added the workflow; the spec author still needs to set it as a required status check in Settings → Branches → protection rule for it to actually gate merges. Until then the workflow runs advisory and the chain runner's local `pnpm -r typecheck && pnpm -r test && pnpm -r lint && pnpm -r build` pass remains the load-bearing check. Same out-of-band action class as the now-demoted label slot.
- **`throughline:pause` label — formally accepted-and-stop-surfacing** (this hardener pass). The slot was open for five consecutive PLATFORM_STATUS rolls. Across Phases 19/20/21/22 the cohort ran end-to-end clean on the two canonical fallback signals (marker file at `.claude-code/auto-continue-pause`, `/pause` PR/issue comments). Per the PR #43 Session-1-handover-gap adjudication precedent, this hardener pass demoted `throughline:pause` in `AUTO_CONTINUE_WORKFLOW.md` to optional/future rather than carrying the gap forward to a sixth pass. The label remains a valid third signal if the spec author later creates it; no further Queued Work entry until then. Recorded for posterity, not as work to do.

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
| _this PR_ | Cohort-level heavy hardener — Phases 19–22 build outputs | `handovers/2026-05-28-cohort-hardener-phases-19-22-build.md` |
| #65 | Phase 22 / Slice 2 — SettingsView `DisciplineScanBlock` (chain close) | `handovers/2026-05-28-phase-22-slice-2-discipline-scan-block.md` |
| #64 | Phase 22 / Slice 1 — discipline-scan-state backend lifecycle (chain open) | `handovers/2026-05-28-phase-22-slice-1-discipline-scan-state-lifecycle.md` |
| #62 | Phase 21 / Slice 4 — unified Bootstrap & clone-and-go SettingsView block (chain close) | `handovers/2026-05-28-phase-21-slice-4-unified-bootstrap-block.md` |
| #61 | Phase 21 / Slice 3 — bootstrap archive/quarantine worker + `GET /bootstrap/state` + server.ts wiring | `handovers/2026-05-28-phase-21-slice-3-worker-and-state-endpoint.md` |

(PRs #59 and #60 roll off — covered by their handovers in `docs/_meta/throughline/handovers/`.)

---

## Update Protocol

- **Refreshed at every session sign-off.** Last act of a session = update this file before merge. First act of next session = read it.
- **Every entry points at an artefact** — PR number, handover path, anchor ID, or file path. No floating claims.
- **Mutable.** Unlike handovers (immutable per `HANDOVER_TEMPLATE.md` rule 8), this file is rewritten in place. The Phase-22 carve-out for handovers does not apply here.
- **Roll semantics.** When entries roll (Recent Slice History past 5, Locked Decisions at cycle reset), older entries are *overwritten*. History lives in handovers and `git log`, not here.
- **Cycle reset.** "Locked Decisions This Cycle" rolls at a natural cohort boundary (phase close, multi-session stream close). The reset is triggered by the *next* cohort's first decision, not by the cohort-hardener pass itself. The hardener pass marks the cohort `production-ready`; the table retains the just-promoted cohort entries until the next phase mints its first T-D / C-D anchor, at which point the production-ready cohort rolls off and the new cycle begins.
- **Cross-references.** `SESSION_START.md` (reading order); `AUTHORING_DISCIPLINE.md` (post-work gate includes refreshing this file); `AUTO_CONTINUE_WORKFLOW.md` (slice-chain that lands the work this file reports).
