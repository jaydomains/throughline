# Throughline — Platform Status

*Living current-state snapshot. Updated at every session sign-off. Read first after `SESSION_START.md`.*

*Mutable file. Older entries are overwritten as they roll — history lives in handovers and `git log`, not here. To understand the past, read handovers. To understand the present, read this file.*

---

## Snapshot

**As of 2026-05-27.** Phase 20 build chain **open** — second implementation chain under the codified `AUTO_CONTINUE_WORKFLOW.md` rhythm. Tracking issue [#52](https://github.com/jaydomains/throughline/issues/52) (`Auto-continue: phase-20-bootstrap-ingest`); spec-author-approved decomposition is 4 slices. Slice 1 (schema migration `0012_phase20_bootstrap.sql`) merged via PR #53 (0 fix-rounds; Gitar approved with no findings). Slice 2 (derivation module `packages/backend/src/bootstrap/derive-id.ts`) in flight; PR pending. Phase 19 chain remains the most recently closed; carry-forwards cleanup in PR #51. Most recent decision: T-D57 (2026-05-26).

---

## Current Phase

**Phase:** 20 chain open.
**Status:** Slice 2 of 4 in flight — derivation module exporting `bootstrapId(sourceType, key)` with per-source-type resolvers (`decision`, `roadmap`, `handover`, `checklist`, `override`) and the universal `@bootstrap-id:` override. Pure-function module; downstream consumed by Slice 3's validator and by Phase 21's prompt template.
**Open slices on branch:** Slice 2 (`claude/phase-20-slice-2-derive-id`, PR pending).
**Next concrete action:** open Slice 2 PR non-draft once primary work is committed; auto-continue per `AUTO_CONTINUE_WORKFLOW.md`.

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
- **`throughline:pause` label creation in `jaydomains/throughline` (second pass through this slot).** Still absent at Phase 20 chain-open 2026-05-27; spec author confirmed they will create it manually during the chain run. Until then, the chain operates on the two fallback kill-switch signals (marker file at `.claude-code/auto-continue-pause`, `/pause` PR/issue comments) — Phase 19 ran clean on these. Re-surfaced here because this is the second consecutive chain to open without it; closes when `gh label create throughline:pause` runs against the repo (or the equivalent admin UI action).

---

## Open Spec-Author Gaps

Mirrors `SESSION_START.md` §"Known spec-author gaps". Current state of each:

- **CODE_SPEC.md "Questions for the spec author" (two items)** — item 8 (voice input language default for the speech-recognition `lang` parameter, §13) and item 9 (cost meter daily threshold default value, §13 / §7.25). Items 1–7 closed by SPEC.md amendments and corresponding C-D anchors (refreshed by PR #43; the live state is in `CODE_SPEC.md`).
- **`<!-- RATIONALE NEEDED -->` markers in `DECISIONS.md` (four)** — T-D10, T-D15, T-D17, T-D23. All still open.

When work touches one of these, surface back to the spec author rather than picking an answer.

---

## Recent Slice History

Most recent merged PRs, one line each + handover path. Expanded to the full cohort chain for the immediate post-hardener sign-off; rolls back to the standard most-recent-five at the next refresh.

| PR | Title | Handover |
|---|---|---|
| #51 | Doc carry-forwards cleanup before Phase 20 chain-open | `handovers/2026-05-27-carry-forwards-cleanup-pre-phase-20.md` |
| #50 | Phase 19 / Slice 4 — frontend `bundle_path` + SettingsView missing-config block (chain close) | `handovers/2026-05-27-phase-19-slice-4-frontend-modal-and-settings-view.md` |
| #49 | Phase 19 / Slice 3 — CLI `throughline init` subcommand + T-D52 doc amendment | `handovers/2026-05-27-phase-19-slice-3-cli-init-subcommand.md` |
| #48 | Phase 19 / Slice 2 — init readers and reinit flow | `handovers/2026-05-27-phase-19-slice-2-init-readers-and-reinit-flow.md` |
| #47 | Phase 19 / Slice 1 — loader third arm + repo-path normalisation (chain open) | `handovers/2026-05-27-phase-19-slice-1-loader-third-arm-and-repo-path-normalisation.md` |
| #45 | `AUTHORING_DISCIPLINE.md` cohort-hardener-checklist cycle-reset encoding (closes PR #43 carry-forward) | `handovers/2026-05-27-authoring-discipline-cycle-reset-encoding.md` |
| #44 | `PLATFORM_STATUS.md` Update Protocol cycle-reset clarification (PR #43 carry-forward, first half) | `handovers/2026-05-26-cycle-reset-clarification.md` |
| #43 | Cohort-level heavy hardener — Phases 19–22 doc prerequisites | `handovers/2026-05-26-cohort-hardener-phases-19-22.md` |
| #42 | ROADMAP §17 / §18 backfill | _no separate handover_ (small mechanical follow-up to PR #41; substantive coverage in PR #43's handover) |
| #41 | Platform discipline polish (PLATFORM_STATUS, AUTO_CONTINUE_WORKFLOW, AUTHORING_DISCIPLINE, SESSION_START) | `handovers/2026-05-26-platform-discipline-polish.md` |
| #40 | Doc session 5 — Phase 22 prereqs + Phases 19–22 ROADMAP/CHECKLIST scaffolds | `handovers/2026-05-26-phase-22-and-scaffolding.md` |
| #38 | Doc session 4 — Phase 21 prereqs (bootstrap prompt + invocation contract) | `handovers/2026-05-26-phase-21-bootstrap-prompt-and-invocation-prereqs.md` |
| #36 | Doc session 3 — Phase 20 prereqs (bootstrap server-side ingest) | `handovers/2026-05-25-phase-20-bootstrap-server-prereqs.md` |
| #34 | Doc session 2 — Phase 19 prereqs (clone-and-go) | `handovers/2026-05-25-phase-19-clone-and-go-doc-prereqs.md` |
| #32 | Doc session 1 — promote seven open questions to working notes | _no handover — accepted as stream-opening exception by PR #43 cohort hardener; substantive coverage retrospectively in Session 2's Phase 19 handover (PR #34)._ |

(Prompt-artefact PRs #33, #35, #37, #39 omitted — they are single-use companions to the substantive sessions above. The "Last five" rule is loosened here for the immediate post-cohort sign-off so the just-promoted cohort's whole chain stays visible; rolls to the standard five at next refresh.)

---

## Update Protocol

- **Refreshed at every session sign-off.** Last act of a session = update this file before merge. First act of next session = read it.
- **Every entry points at an artefact** — PR number, handover path, anchor ID, or file path. No floating claims.
- **Mutable.** Unlike handovers (immutable per `HANDOVER_TEMPLATE.md` rule 8), this file is rewritten in place. The Phase-22 carve-out for handovers does not apply here.
- **Roll semantics.** When entries roll (Recent Slice History past 5, Locked Decisions at cycle reset), older entries are *overwritten*. History lives in handovers and `git log`, not here.
- **Cycle reset.** "Locked Decisions This Cycle" rolls at a natural cohort boundary (phase close, multi-session stream close). The reset is triggered by the *next* cohort's first decision, not by the cohort-hardener pass itself. The hardener pass marks the cohort `production-ready`; the table retains the just-promoted cohort entries until the next phase mints its first T-D / C-D anchor, at which point the production-ready cohort rolls off and the new cycle begins.
- **Cross-references.** `SESSION_START.md` (reading order); `AUTHORING_DISCIPLINE.md` (post-work gate includes refreshing this file); `AUTO_CONTINUE_WORKFLOW.md` (slice-chain that lands the work this file reports).
