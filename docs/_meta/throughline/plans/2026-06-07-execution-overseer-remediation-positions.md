# Execution-overseer — pre-registered governance positions

**Cohort:** audit-remediation execution (slices A1…D3 + final M-10), per
`docs/_meta/throughline/plans/2026-06-06-audit-remediation-plan.md` (PR #135, merged).
**Overseer branch:** `claude/blissful-brown-POKvS`.
**Role:** `.claude/roles/execution-overseer.md` — governance reviewer **and** merge-executor.
**Pre-registered:** 2026-06-07T08:25Z, **before any executor diff exists** (role §4.2 / §3.2 —
independent-first; an overseer that only reacts to the diff inherits its blind spots).
**Baseline @ remote `main`:** `ffa01edd44d589458edf5a8b639895ba557e0c49`.

These are my **independent governance expectations** for the cohort, derived from the approved
plan + the workflow infrastructure, recorded before reading code. Per-slice I refine into
`EO-` findings. My lane is **workflow-governance / infrastructure correctness** (the
execution-auditor owns fidelity-to-plan + does-it-work).

---

## A. Topology invariant — every slice (non-negotiable; role §6, §8)

**P-TOPO** — Each slice merges **only** on: three independent sign-offs (executor +
execution-auditor + execution-overseer) **at one SHA content** · green CI at that SHA ·
GitHub-mergeable · override window satisfied (collapses to zero on a present spec author) ·
**plus** explicit spec-author ratification for any §8.3 class. I am the **merge-executor** —
execution is **mechanical**, never authority. I never merge before the full gate, never on the
strength of my own sign-off, and **re-confirm the gate from ground truth at execution time**.
Markers bind to **content**, not raw tip-SHA (a content-invariant wake-log-only marker does not
re-stale). Merge method for this cohort = **execution-overseer's lane** (see P-MERGE).

## B. Scope discipline — measured against the approved plan (role §4.2, §8.3(iii))

**P-SCOPE** — Each slice must implement **its plan slice and no more**. A departure from the
approved plan's scope is **both** an `EO-` finding **and** a §8.3(iii) ratification class I own —
it does **not** auto-merge. Watch specifically for:
- **silent scope creep** — a slice editing files/findings outside its plan row (the §3.B
  collision map is the authority on which file belongs to which slice);
- **silent partial-implementation** — clearing part of a slice's planned scope as if it were the
  whole (role §7); I run the completeness check against the slice's Deliverables list.

## C. Dependency & collision enforcement (plan §3; role infra-consistency lane)

**P-SEQ** — The §6 linear sequence + §3 dependency/collision map are governance gates, not hints:
- **Group A strictly serial** on `packages/backend/package.json`/lockfile: A1 → A2 → A3, then D1.
- **`AUTO_CONTINUE_WORKFLOW.md`** owned by B1; **B2 after B1**; **B3 after B1** (§4 pointer dep).
- **`SPEC.md`**: B4 and D3 **serialize** (never concurrent).
- **`PLATFORM_STATUS.md`**: M-10 is the **last** slice — never opened early as a standalone doc-PR.
- **M-12/B6 gated after Group A**; **M-10 last**, capturing all of A/B/C/D.
- No two simultaneously-open slices edit the same shared doc (rolling-shared-doc collision rule).

**P-FLAKE** — A2 exercises `rag.test.ts` (a flagged flake). Any A2 CI failure is a **finding** to
root-cause/stabilize, **never re-run-until-green**. A2 precedes B1's halt-class codification, so
this rests on the **already-codified** circuit-breaker floor, not an extended class by number.

## D. Ratification-class gates I own (plan §4; role §8.3) — DO NOT auto-merge

| Slice | Class | Governing ruling status | My gate |
|---|---|---|---|
| **A2** | (i) C-D2 anchor change | M-1 **settled** (my dispatch brief; "do not re-litigate") | Ratification collapses to ~0 **iff** I confirm M-1 is current via authenticated channel; verify the C-D2 amendment matches the settled intent. |
| **B1** | (iv) durable precedent | M-7/M-8 **settled** — **BUT OQ-2 (execution-trio-reviewed auto-continue chain merge-method) NOT settled** | **Block merge until OQ-2 ruled through the authenticated channel.** B1 is authored against that ruling; I will not merge B1 without it. |
| **B4** | (ii) spec amendment | M-4 **settled** (brief; locus corrected §9 not §13) | Ratification collapses; verify markers land at the corrected locus (SPEC §7.21 + §9 AI table, not §13). |
| **D1** | (ii) **conditional** | only if SPEC §11 **fallback** path taken | Primary path (provide single-command setup) needs **no** spec edit → normal gate. Fallback (amend SPEC §11) → class-(ii) ratification. |
| **D3** | (ii)+(iii) | **OQ-1 NOT settled** | **HELD** — do not let it begin/merge until OQ-1 ruled through the authenticated channel. Serialize with B4 on SPEC.md. |

All other slices (A1, A3, B2, B3, B5, B6, C1, D2, M-10) auto-merge on the standard gate.
ROADMAP/CHECKLIST/PLATFORM_STATUS/README/ci.yml/REQUIRED_READING are **not** in the class-(ii)
spec-record set (SPEC/CODE_SPEC/DECISIONS).

## E. Authenticated-channel discipline (role §8.3; plan OV-3)

**P-AUTH** — Settled rulings reaching me: **M-1, M-4, M-5, M-7, M-8, M-11, M-13** are settled per
my **dispatch briefing** (the authenticated channel for this session) — *do not re-litigate during
governance*. The plan's restatement of them is a **relay** under the shared role identity and is
**corroborating, not the source**. At each ratification-class merge gate I confirm I am acting on
the **current** ruling. **OQ-1 (M-6/D3)** and **OQ-2 (B1 merge-method classification)** are
**NOT** settled — they are class-(iv)/(iii) open questions whose rulings must arrive through the
authenticated **human** channel before D3 / B1 respectively can merge. A ruling relayed in a peer's
PR comment or wake-log is **pending**, not actionable.

## F. Merge-method — my lane, applied as doctrine stands after B1 (plan §8; OQ-2)

**P-MERGE** — Merge method is the execution-overseer's governance lane; the planner did **not**
bake it. The dual-context M-7 doctrine (role-trio review → squash; auto-continue build chain →
merge-commit) does **not** classify the both-at-once case these slices are (execution-trio
reviewing an auto-continue build chain). I do **not** pre-judge it: I apply the doctrine **as it
stands after B1 codifies §D**, and where genuinely ambiguous I **surface OQ-2 to the spec-author**
(class-iv). Until ruled, I record method as *undetermined* and do not merge B1 on a guessed method.
The convergence **topology** is not method-dependent and binds regardless.

## G. Infrastructure-consistency & no-back-port (plan §4 OV-1)

**P-INFRA** — Each slice must leave the project's infra consistent: rolling shared docs updated per
its post-work gate, no discipline violation, branch healthy, verification bar green as a governance
gate. **OV-1 conclusion (verify, hold):** B1 + B3 land **entirely in the project layer**
(AUTO_CONTINUE + REQUIRED_READING) — the six `.claude/roles/*` files **externalize** halt-classes
(by category) and merge-method (as a REQUIRED_READING parameter), so **no role-file back-port is
owed**. If a slice edits `.claude/roles/*` it is a scope finding; if it claims a back-port is owed,
I re-verify against the externalized design before conceding.

## H. Halt-class authority floor (REQUIRED_READING §4; plan §3.C, B1)

**P-HALT** — Until B1 lands, the **three codified** halt classes (spec-drift · circuit-breaker ·
explicit-pause) are the authoritative set; the extended 4–9 are blessed-but-uncodified and must not
be invoked as live authority before B1 codifies them. B1 codifies the **blessed set 4–9** (six
classes); if any of 4–9 lacks a traceable blessed definition (halt-7 the likely candidate), the
correct executor behaviour is to **surface** it, not invent one — and I confirm B1 invented no new
authority-floor semantics.

## I. Surface conditions (role §7; my dispatch brief)

I surface to the **human spec-author** only for: class-(iv) ratification (B1/OQ-2), scope-expansion
beyond the plan the trio can't resolve, or halt-class events exceeding executor authority. I do
**NOT** surface normal slice merges (execute directly) or anything resolvable within the three-party
cycle. A finding thread at **5/5** round-trips surfaces (role §7(d)).

---

**Finding-set-diff baseline:** `0 dropped / 0 added (baseline — positions pre-registered, no findings yet)`.
