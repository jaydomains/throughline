# Throughline — Platform Status

*Living current-state snapshot. Updated at every session sign-off. Read first after `SESSION_START.md`.*

*Mutable file. Older entries are overwritten as they roll — history lives in handovers and `git log`, not here. To understand the past, read handovers. To understand the present, read this file.*

---

## Snapshot

**As of 2026-05-26.** Five-session doc-authoring stream closed (PRs #32–#40); Phases 19–22 doc prerequisites complete (`pre-work-doc-complete`). Phase 18 communication-model is the most recent shipped feature (PR #31, 2026-05-24). No phase currently in flight. Next code work: Phase 19 (clone-and-go). Most recent decision: T-D57 (2026-05-26).

---

## Current Phase

**Phase:** _None in flight._
**Status:** awaiting Phase 19 kickoff.
**Open slices on branch:** _none_.
**Next concrete action:** open Phase 19 build session — slice 1.

---

## Locked Decisions This Cycle

T-D anchors minted since the previous PLATFORM_STATUS sign-off. One line each; full bodies in `DECISIONS.md`. *(Initial-population note: this section spans two cohorts — Phase 18 and the five-session doc-authoring stream — because this file is being created now with no prior PLATFORM_STATUS state. Subsequent cycles roll to one cohort per cycle.)*

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

- **CODE_SPEC §1 anchor-count refresh** — narrative paragraph says "canonical at 48"; live total is 57. Drifted across Sessions 2–5 because per-slice hardener does not catch it. Cohort-level hardener-pass item.
- **Phases 19–22 cohort-level hardener pass** — first cohort-level pass under the two-cadence model. Scope: anchor-count refresh, ROADMAP backfill, vocabulary drift across the five sessions, forward-pointer audit, build-prerequisite stress test against current state, handover-chain completeness audit (Session 1 / PR #32 landed without a handover — verify whether that gap should be backfilled or accepted as a stream-opening exception). Per user, the next workstream.
- **Phase 19 build session** — gated only on user kickoff; doc prerequisites all on `main`.

---

## Open Spec-Author Gaps

Mirrors `SESSION_START.md` §"Known spec-author gaps". Current state of each:

- **CODE_SPEC.md "Questions for the spec author" (seven items)** — gate-trigger mechanisms ×4, bundle markdown convention, companion-modes relationship, verifier-tool plurality. All still open.
- **`<!-- RATIONALE NEEDED -->` markers in `DECISIONS.md` (four)** — T-D10, T-D15, T-D17, T-D23. All still open.

When work touches one of these, surface back to the spec author rather than picking an answer.

---

## Recent Slice History

Last five merged PRs. One line each + handover path.

| PR | Title | Handover |
|---|---|---|
| #40 | Doc session 5 — Phase 22 prereqs + Phases 19–22 ROADMAP/CHECKLIST scaffolds | `handovers/2026-05-26-phase-22-and-scaffolding.md` |
| #38 | Doc session 4 — Phase 21 prereqs (bootstrap prompt + invocation contract) | `handovers/2026-05-26-phase-21-bootstrap-prompt-and-invocation-prereqs.md` |
| #36 | Doc session 3 — Phase 20 prereqs (bootstrap server-side ingest) | `handovers/2026-05-25-phase-20-bootstrap-server-prereqs.md` |
| #34 | Doc session 2 — Phase 19 prereqs (clone-and-go) | `handovers/2026-05-25-phase-19-clone-and-go-doc-prereqs.md` |
| #32 | Doc session 1 — promote seven open questions to working notes | _no handover_ (stream-opening slice; gap surfaced for cohort hardener-pass review) |

(Prompt-artefact PRs #33, #35, #37, #39 omitted — they are single-use companions to the substantive sessions above.)

---

## Update Protocol

- **Refreshed at every session sign-off.** Last act of a session = update this file before merge. First act of next session = read it.
- **Every entry points at an artefact** — PR number, handover path, anchor ID, or file path. No floating claims.
- **Mutable.** Unlike handovers (immutable per `HANDOVER_TEMPLATE.md` rule 8), this file is rewritten in place. The Phase-22 carve-out for handovers does not apply here.
- **Roll semantics.** When entries roll (Recent Slice History past 5, Locked Decisions at cycle reset), older entries are *overwritten*. History lives in handovers and `git log`, not here.
- **First-cycle exception.** This file's initial population spans two cohorts (Phase 18 + the five-session doc-authoring stream) because it is being created with no prior state. Subsequent cycles roll to one cohort per cycle under the normal cycle-reset rule below.
- **Cycle reset.** "Locked Decisions This Cycle" rolls at a natural cohort boundary (phase close, multi-session stream close). The cohort-level hardener pass is the typical trigger.
- **Cross-references.** `SESSION_START.md` (reading order); `AUTHORING_DISCIPLINE.md` (post-work gate includes refreshing this file); `AUTO_CONTINUE_WORKFLOW.md` (slice-chain that lands the work this file reports).
