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

---

## Reading order for a new build session

SESSION_START → most recent handover → SPEC → CODE_SPEC → ROADMAP → CHECKLIST → DECISIONS (consult as needed, not read end-to-end).

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

- Seven gaps in `CODE_SPEC.md` *Questions for the spec author* (items 1–7: four gate-trigger mechanisms, bundle markdown convention, companion-modes relationship, verifier-tool plurality).
- Four `<!-- RATIONALE NEEDED -->` markers in `DECISIONS.md` (T-D10, T-D15, T-D17, T-D23).

When work touches one of these, raise it back to the spec author rather than picking an answer.

---

## When this file itself changes

Edits to `SESSION_START.md` or `HANDOVER_TEMPLATE.md` are themselves a slice; note the change in the next handover so future sessions notice the shift.
