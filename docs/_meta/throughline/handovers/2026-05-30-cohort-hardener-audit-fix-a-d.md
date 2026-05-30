<!-- Template version: 1.0 -->

# Throughline Handover — Cohort-level heavy hardener: audit-fix A–D → `production-ready`

**Generated:** 2026-05-30 (UTC)
**Last commit SHA:** _filled at merge_ — 2026-05-30
**Previous handover:** `2026-05-30-phase-d-slice-3-lifecycle-locks.md` (PR #81 — Phase D Slice 3, audit-fix chain close)

The cohort-level heavy hardener for the audit-fix cohort (Phases A–D), per
`AUTHORING_DISCIPLINE.md` § Cohort-level heavy hardener. The second such pass under the
codified discipline (the first was PR #43). A single-slice, single-PR, docs-only pass; it
sweeps cross-slice / cross-cohort / cross-doc drift and promotes the cohort from
`feature-complete` to `production-ready`.

---

## Build State vs Spec

| Spec requirement (hardener checklist) | State | Evidence | Notes |
|---|---|---|---|
| Stale anchor counts refreshed | built | `CODE_SPEC.md:9` 57 → 59 | Live T-D total is 59 (T-D1–T-D59, no gaps/dupes); T-D58/T-D59 landed in the arc. |
| ROADMAP phase backfill | clean | `ROADMAP.md` Phases 17 & 18 present (lines 370, 391) | Audit-fix is a cross-cutting workstream, not a ROADMAP phase — tracked in `PLATFORM_STATUS.md`, not backfilled. Stale "(17/18 outstanding)" example in `AUTHORING_DISCIPLINE.md` refreshed. |
| Vocabulary drift audit | clean | error hierarchy (`DomainError`→`NotFoundError`→`*NotFoundError`), `useResource`/`usePolledResource` consistent | Only nit: mixed "wire-contract"/"wire contract" (both valid — modifier vs noun); left as-is (Drift Flag below). |
| Forward-pointer resolution | clean | all `WN-*` resolved or explicitly carried (WN-1b-c); SPEC/CODE_SPEC deferrals anchor-tagged | F1-01 structurally closed by T-D51 amendment (`resolveProjectBundle`). |
| Handover-chain completeness | built | PR #76 backfilled | #67–#81 now all map to handovers; #76 was the one gap (adjudicated backfill). |
| SESSION_START gap list refreshed | clean | CODE_SPEC Questions items 8/9 + four `RATIONALE NEEDED` markers (T-D10/15/17/23) verified still live | No list change. |
| SPEC §14 index audited | clean | T-D1–T-D59 complete, ordered, no dupes; T-D58/T-D59 present | No edit. |
| PLATFORM_STATUS cohort transition | built | Snapshot/Current Phase mark cohort `production-ready`; Recent Slice History rolled; Locked Decisions retained (no cycle roll) | Compaction-inherited false "SESSION_START.md absent" claim corrected. |
| AUTO_CONTINUE_WORKFLOW absorption | built | §§ Canonical Chain Rhythm, Pre-Flight State Verification + Merge-on-Green directive | Doc-PR collision + merge-on-green base sections landed earlier via PR #76; this pass added the remaining three. |

---

## Last Decision Minted

> No new T-D / C-D anchors minted. A hardener pass refreshes prose, rolls status, and absorbs
> process findings into discipline docs; it does not mint functional or implementation
> decisions. The audit-fix cohort's anchors (C-D22, T-D58, C-D23, C-D24, T-D59) are unchanged
> and retained in `PLATFORM_STATUS.md` § Locked Decisions This Cycle until a successor cohort
> mints its first anchor.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**Modified:**
- `CODE_SPEC.md` — T-D index count 57 → 59 (§ Anchor convention).
- `SESSION_START.md` — kill-switch wording aligned to `AUTO_CONTINUE_WORKFLOW.md` (marker file + `/pause` comment canonical; `throughline:pause` label optional/future).
- `docs/_meta/throughline/AUTHORING_DISCIPLINE.md` — ROADMAP-backfill checklist example refreshed (17/18 now present; cross-cutting workstreams live in PLATFORM_STATUS).
- `docs/_meta/throughline/AUTO_CONTINUE_WORKFLOW.md` — new §§ *Canonical Chain Rhythm — one PR per slice* and *Pre-Flight State Verification*; *Merge-on-Green Polling* gains the poll-driven-not-subscription-driven directive.
- `docs/_meta/throughline/PLATFORM_STATUS.md` — cohort-roll: Snapshot / Current Phase / Locked Decisions intro / Queued Work attribution / Recent Slice History.

**New:**
- `docs/_meta/throughline/handovers/2026-05-30-phase-cd-chain-open-workflow-absorption.md` — backfilled PR #76 handover.
- `docs/_meta/throughline/handovers/2026-05-30-cohort-hardener-audit-fix-a-d.md` — this handover.

Docs only. No code touched; the green gate (typecheck/test/lint/build) is unaffected.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Mixed wire-contract hyphenation | `CODE_SPEC.md`, `DECISIONS.md`, `SPEC.md` | "wire-contract" (compound modifier) and "wire contract" (noun) both appear | **Observed, not fixed** — both forms are grammatically correct in their positions; normalising would be churn with no clarity gain. Canonical anchor heading (T-D59) uses the hyphenated compound form. Left for a future pass if a single form is ever mandated. |

---

## Open Questions

_none_

---

## Recently Resolved

- **PR #76 missing handover** — the one gap in the audit-fix A–D handover chain (item 5). Adjudicated **backfill**; landed as `2026-05-30-phase-cd-chain-open-workflow-absorption.md`.
- **Compaction-inherited "SESSION_START.md is absent" claim** — propagated through D-3-era `PLATFORM_STATUS.md` rolls; the file was present at the repo root the whole time. Corrected in the cohort-roll, and the root cause codified as `AUTO_CONTINUE_WORKFLOW.md` § Pre-Flight State Verification.
- **Stale T-D index count (57)** — refreshed to 59 in `CODE_SPEC.md §1`.

---

## Cross-Module Dependencies

_none_ — documentation-only pass; no module surface.

---

## Process note — spec-drift halt fired on the 9c per-slice-PR rhythm (the framework working in real time)

This pass's plan (and the spec author's stated rationale) initially asserted the canonical
chain rhythm was **multi-slice-per-PR**, justified as "Phases 19–22, B all ran this rhythm."
The executing session caught the contradiction against the live evidence and **halted on the
spec-drift class before encoding it**:

- Phase 19 ran as PRs #47/#48/#49/#50 — one PR per slice, each merged before the next opened
  (the `auto-continue-state.json` quotes in the Phase 19 slice handovers prove the
  "Slice N merged → Slice N+1 opened" cadence).
- Phase B ran as #69/#72/#73/#74 — likewise one PR per slice.
- The existing `AUTO_CONTINUE_WORKFLOW.md` Premise ("A slice = one PR"), Slice Lifecycle, and
  Line 115 all already encode one-PR-per-slice.
- Phase C+D's violation (per the D-3 handover) was "slices 1–2 pushed to a single branch
  **without** per-slice PRs" — a *failure to do* one-PR-per-slice, which reinforces the model.

Adjudication: **Option A** — keep the one-PR-per-slice model; 9c *sharpens* it (the violation
to prevent is pushing slices to a branch with no per-slice PR opened at all). This is recorded
explicitly because it demonstrates the **spec-drift halt class catching a real drift in real
time** — not in retrospect, and against an instruction the planning session and spec author had
aligned on. The discipline floor's purpose is exactly this: evidence over instruction when the
two conflict.

Corollary corrected: Phase C+D's **6-PR shape was the *correct* shape** (each slice its own
PR — #76 absorption + #77/#78 Phase C + #79/#80/#81 Phase D), arrived at through recovery from
the no-PR-opened violation. It is the canonical one-PR-per-slice rhythm correctly applied
during recovery, *not* an artefact to be retired.

---

## Process note — F1-01 reads as a "lock", not a "fix"

For future readers wondering why F1-01 (wrong-bundle resolution for clone-and-go repos)
appears as a "lock verified" in the D-3 handover rather than a fix: audit-3 **found** it;
Phase B's `resolveProjectBundle` (the T-D51 Implications amendment) **structurally closed** it
by making `repo_path` non-omittable at the resolution chokepoint; Phase D's slice-3 arm-2
regression test **locked** the closure. Found → structurally closed → regression-locked across
the arc — hence "lock", not "fix".

---

## Reference

- Hardener checklist: `docs/_meta/throughline/AUTHORING_DISCIPLINE.md` § Cohort-level heavy hardener
- Cohort substrate: `DECISIONS.md` (T-D51 amendment, T-D58, T-D59), `CODE_SPEC.md` (C-D22, C-D23, C-D24), `SPEC.md §14`
- Docs swept: `CODE_SPEC.md`, `SESSION_START.md`, `ROADMAP.md`, `SPEC.md`, `DECISIONS.md`, and the four process docs under `docs/_meta/throughline/`
- Cohort PRs: A #67 · B #69/#72/#73/#74 · doc-PRs #75/#76 · C #77/#78 · D #79/#80/#81
- Prior hardener precedent: PR #43 (Phases 19–22 doc-prereqs cohort)
