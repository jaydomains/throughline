# Throughline — Session Start

*Read first at every session; not edited mid-session.*

---

## Purpose

This file sets the discipline floor for any Throughline build session — what to read, in what order, and which rules govern the work.

---

## File authority hierarchy

| Doc | Owns |
|---|---|
| `SPEC.md` | Functional truth — *what* Throughline does and *why*. |
| `CODE_SPEC.md` | Implementation truth — *how* it is built. |
| `DECISIONS.md` | Rationale — the body of every T-D anchor, with context, rationale, implications. |
| `CHECKLIST.md` | Build state — what is built, what is in flight, what is outstanding. |
| `ROADMAP.md` | Sequencing — phase order, dependencies, parallelism, §13 adoptions. |
| **Process docs** | |
| `docs/_meta/throughline/PLATFORM_STATUS.md` | Current state — where the project is right now. Mutable. Refreshed every session sign-off. |
| `docs/_meta/throughline/AUTO_CONTINUE_WORKFLOW.md` | Slice-chain rhythm — three-layer green gate, three halt classes, chain state shape. |
| `docs/_meta/throughline/AUTHORING_DISCIPLINE.md` | Status taxonomy and the pre-work / post-work doc gates. |

---

## Reading order for a new build session

SESSION_START → PLATFORM_STATUS → most recent handover → SPEC → CODE_SPEC → ROADMAP → CHECKLIST → DECISIONS (consult as needed, not read end-to-end).

---

## Branch discipline

Branch-per-phase; never commit to main; branch naming convention; one branch per ROADMAP phase or coherent slice within a phase.

---

## Plan-mode discipline

Plan mode first; the plan is shown for approval before code is written; user explicitly approves before implementation begins.

---

## CHECKLIST discipline

`CHECKLIST.md` is updated as work progresses, not batched at session end; completed phase sections stay in place so build-state history is preserved.

---

## PR discipline

PR opened at phase close (not before); PR description references the phase, the cited T-D / C-D anchors, and the CHECKLIST items closed.

---

## Auto-continue discipline

Build work runs as slice chains — each slice a PR, each chain advanced automatically slice-to-slice once the user approves the chain shape at plan-mode. A slice merges only when the three-layer green gate (Gitar review + CI + GitHub mergeable) is simultaneously green. The chain halts only on three named conditions: spec drift, circuit breaker (three fix-rounds on the same finding), or explicit user pause via the `throughline:pause` kill switch. See `docs/_meta/throughline/AUTO_CONTINUE_WORKFLOW.md` for the full ruleset.

---

## Authoring discipline

Deliverables progress through four explicit tiers: `spec-anchored` → `pre-work-doc-complete` → `feature-complete` → `production-ready`. Every build session opens through a pre-work doc prep gate and closes through a post-work doc hardening gate; the hardening gate runs at two cadences (per-slice light, cohort-level heavy). The two-cadence model is what catches cross-cohort drift like the `CODE_SPEC.md §1` "canonical at N" anchor-count staleness. See `docs/_meta/throughline/AUTHORING_DISCIPLINE.md` for the taxonomy and gate checklists.

---

## Handover discipline

Every PR close writes a handover file using `HANDOVER_TEMPLATE.md` to `docs/_meta/throughline/handovers/<merge-date>-<slice-id>-<short-summary>.md`. The next session reads the most recent handover before anything else.

Handovers are immutable once written, with a single carve-out: a change that business confidentiality, privacy, or legal requirements compel (e.g. scrubbing a business-internal name before the repo goes public). Such an edit is itself a slice — make it deliberately, prefer meaning-preserving substitution over deletion, and record it in the slice's own handover. Routine wording or quality fixes do not qualify. See `HANDOVER_TEMPLATE.md` authoring rule 8.

---

## Anchor conventions

T-D anchors live in `DECISIONS.md` and are canonical via SPEC §14; C-D anchors live in `CODE_SPEC.md`. Do not invent anchors mid-session — propose new via a working note appended to `DECISIONS.md`.

---

## Spec-drift policy

Functional disagreement with code triggers a SPEC update or a code update (per SPEC §1); implementation-shape choices update `CODE_SPEC.md` only; silent drift is the failure mode this whole discipline exists to prevent.

---

## Known spec-author gaps — surface, do not silently resolve

- Two gaps in `CODE_SPEC.md` *Questions for the spec author*: item 8 (voice input language default for the speech-recognition `lang` parameter, §13) and item 9 (cost meter daily threshold default value, §13 / §7.25). Items 1–7 closed by SPEC.md amendments and corresponding C-D anchors; the live state is in `CODE_SPEC.md`.
- Four `<!-- RATIONALE NEEDED -->` markers in `DECISIONS.md` (T-D10, T-D15, T-D17, T-D23).

When work touches one of these, raise it back to the spec author rather than picking an answer.

---

## When this file itself changes

Edits to `SESSION_START.md` or `HANDOVER_TEMPLATE.md` are themselves a slice; note the change in the next handover so future sessions notice the shift.
