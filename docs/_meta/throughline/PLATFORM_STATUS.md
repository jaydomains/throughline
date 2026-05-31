# Throughline — Platform Status

*Living current-state snapshot. Updated at every session sign-off. Read first after `SESSION_START.md`.*

*Mutable file. Older entries are overwritten as they roll — history lives in handovers and `git log`, not here. To understand the past, read handovers. To understand the present, read this file.*

---

## Snapshot

**As of 2026-05-31.** **Phase E — Full Audit-Fix Close** chain is **in flight** (22-slice floor; one PR per slice). Plans on `main`: base `plans/2026-05-30-phase-e-full-audit-close.md` (E1–E18, E17a) + augmentation `plans/2026-05-31-phase-e-augmentation-feature-builds.md` (appends E19/E20/E21; revises the E1 anchor-amendment mechanism). Durable per-slice record: `handovers/phase-e-execution-log.md`. **Landed:** **E1** (#88) — RAG embedder & query honesty; minted **T-D60** (refuse-rather-than-fallback) with C-D2 narrowed via a T-D60 supersession note (count 59→60). **E2** (#89) — AI/capability degradation honesty (cites T-D60). Both merged by a prior multi-session run that left no per-slice handovers and did **not** roll this file; that gap is corrected here (execution log established; this Snapshot + Locked Decisions table rolled to the Phase E cycle, T-D60 being its first anchor). **This slice — E3** — Semble degradation honesty (SF4-01): tri-state `SembleStatus` (`available`/`unavailable`/`degraded`) disclosed on the shared wire contract so a crashed/timed-out Semble no longer reads as "no code matches". Cites T-D60; no new anchor. **Prior cohort:** audit-fix A–D remains `production-ready`; Phases 19–22 remain `production-ready`. **Next:** continue the chain — E4 (notifier capability honesty) branches off updated `main` after E3 merges.

---

## Current Phase

**Phase:** Phase E — Full Audit-Fix Close. Chain in flight, one PR per slice (22-slice floor). Audit-fix A–D and Phases 19–22 remain `production-ready`.
**Status:** E1 (#88) + E2 (#89) merged (prior run); E3 (Semble degradation honesty) is the current slice. Anchors so far: **T-D60** (E1). C-D25 (E6) and C-D26 (E5) still to mint; a T-D10 amendment is planned in E20 (augmentation). Any anchor beyond T-D60/C-D25/C-D26/T-D10-amendment trips halt-class 5.
**Next concrete action:** Merge E3 on green gate; branch E4 (notifier capability honesty) off updated `main`. Chain halts at **E17** for the spec-author product-decision gate (halt-class 9).

---

## Locked Decisions This Cycle

The **Phase E** cycle holds its anchors here. T-D60 (E1) is Phase E's first anchor → it reset the cycle off the now-`production-ready` audit-fix A–D entries (C-D22, T-D58, C-D23, C-D24, T-D59; full bodies remain in `DECISIONS.md` / `CODE_SPEC.md` and `git log`). One line each; full bodies in `DECISIONS.md` / `CODE_SPEC.md`. The table rolls again only when a successor cohort mints its first anchor.

| Anchor | Phase | One-line |
|---|---|---|
| T-D60 | Phase E / E1 | Refuse-rather-than-fallback: a degraded or failed capability is **disclosed on the shared wire contract** (extends T-D59), never silently substituted or rendered as healthy-empty. Broad reach (LBD-1a). Supersedes audit-3's blessing of the silent C-D2 SHA1 embedding fallback; narrows C-D2 to capability-absent honest-distinct mode (recorded as a T-D60 supersession note, not a C-D2 body edit). Cited by E2/E3/E4. |
| _C-D25_ | Phase E / E6 (pending) | System-state visibility frontend pattern (one shared component, tri-state healthy/degraded/absent, rendered in-context). Mints in E6; reused by E5/E7. |
| _C-D26_ | Phase E / E5 (pending) | Background-job health-state backend model (`lastRunAt`/`lastError`/`healthy` per loop) — distinct from C-D25. Mints in E5. |

---

## Queued Work

- **Branch-protection required-check — DONE.** The `gate` workflow (`.github/workflows/ci.yml`) is now a required status check on `main`; it gated PR #76 (`mergeable_state: blocked` until `gate` + Gitar passed, then `clean`). The local `pnpm -r typecheck && pnpm -r test && pnpm -r lint && pnpm -r build` pass remains the chain runner's pre-PR check, but CI is now the enforcing gate at merge.
- **`throughline:pause` label — formally accepted-and-stop-surfacing** (settled in the 2026-05-28 Phases 19–22 hardener; see `AUTO_CONTINUE_WORKFLOW.md` § Kill Switch). Across Phases 19/20/21/22 the cohort ran end-to-end clean on the two canonical fallback signals (marker file at `.claude-code/auto-continue-pause`, `/pause` PR/issue comments). Per the PR #43 Session-1-handover-gap adjudication precedent, that pass demoted `throughline:pause` to optional/future. The label remains a valid third signal if the spec author later creates it; no further Queued Work entry until then. Recorded for posterity, not as work to do.

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
| _this PR_ | Phase E / E3 — Semble degradation honesty (SF4-01): tri-state `SembleStatus` on the wire (cites T-D60) | `handovers/phase-e-execution-log.md` (§E3) |
| #89 | Phase E / E2 — AI/capability degradation honesty (SF3-03, SF2-04, SF4-02, SF4-03) | `handovers/phase-e-execution-log.md` (§E2, backfilled) |
| #88 | Phase E / E1 — RAG embedder & query honesty + T-D60 mint (C-D2 narrowing) | `handovers/phase-e-execution-log.md` (§E1, backfilled) |
| _hardener_ | Cohort-level heavy hardener — audit-fix A–D → `production-ready` | `handovers/2026-05-30-cohort-hardener-audit-fix-a-d.md` |
| #81 | Phase D / Slice 3 — backend lifecycle locks: S4-01, S7-01, F1-01 lock | `handovers/2026-05-30-phase-d-slice-3-lifecycle-locks.md` |

(PR #80 and earlier roll off — covered by their handovers in `docs/_meta/throughline/handovers/`. The Phase E chain uses a single append-only execution log rather than per-slice handover files; see its header for rationale.)

---

## Update Protocol

- **Refreshed at every session sign-off.** Last act of a session = update this file before merge. First act of next session = read it.
- **Every entry points at an artefact** — PR number, handover path, anchor ID, or file path. No floating claims.
- **Mutable.** Unlike handovers (immutable per `HANDOVER_TEMPLATE.md` rule 8), this file is rewritten in place. The Phase-22 carve-out for handovers does not apply here.
- **Roll semantics.** When entries roll (Recent Slice History past 5, Locked Decisions at cycle reset), older entries are *overwritten*. History lives in handovers and `git log`, not here.
- **Cycle reset.** "Locked Decisions This Cycle" rolls at a natural cohort boundary (phase close, multi-session stream close). The reset is triggered by the *next* cohort's first decision, not by the cohort-hardener pass itself. The hardener pass marks the cohort `production-ready`; the table retains the just-promoted cohort entries until the next phase mints its first T-D / C-D anchor, at which point the production-ready cohort rolls off and the new cycle begins.
- **Cross-references.** `SESSION_START.md` (reading order); `AUTHORING_DISCIPLINE.md` (post-work gate includes refreshing this file); `AUTO_CONTINUE_WORKFLOW.md` (slice-chain that lands the work this file reports).
