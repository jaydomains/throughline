# Plan-overseer — pre-registered governance positions

**Loop:** audit-remediation plan (findings M-1 … M-13) for the 2026-06-06 end-to-end audit.
**Overseer branch:** `claude/elegant-einstein-fsSgg`
**Pre-registered:** 2026-06-06T20:35Z — **before** reading any planner draft (anti-anchoring, role §4.2 / §3.2).
**Status:** final — approved by plan-overseer — content-bound to plan @ `db5befd` (PR #135).

> These are the governance-correctness expectations I derive from the requirements and the
> workflow's own infrastructure (REQUIRED_READING, the six role files, SESSION_START,
> AUTO_CONTINUE, AUTHORING_DISCIPLINE, the audit summary). My lane is **workflow-governance /
> infrastructure correctness** — distinct from the plan-auditor's content-correctness lane. A
> position the draft satisfies becomes a Confirm; one it fails becomes an `OV-` finding.

---

## Context I am measuring against

- 13 actionable findings **M-1 … M-13** (M-14 is the Info positive baseline).
- **Seven carry settled spec-author rulings:** M-1, M-4, M-5, M-7, M-8, M-11, M-13.
- **Six are planner-scoped (design authority delegated):** M-2, M-3, M-6, M-9, M-10, M-12.
- Plan expected to be substantial — ~15–25 slices.
- Expected ratification class: **class-(iii) scope decision at most**, within plan-trio
  authority *unless something genuinely new surfaces* — in which case I surface, not assume.

---

## Pre-registered positions

### P1 — Ratification-class detection is the load-bearing merge-executor duty
Several findings, *if remediated*, touch §8.3 ratification surfaces:
- **Spec amendments (class-ii):** M-4 / M-5 / M-6 alter `SPEC.md` (deferral markers or §7.27 /
  §7.20 / §7.21 text); M-9 alters `REQUIRED_READING.md`; M-7 alters `AUTO_CONTINUE §D` +
  `REQUIRED_READING §7`; M-8 codifies into `AUTO_CONTINUE`.
- **Durable precedent (class-iv):** M-7 (the *canonical* merge method) and M-8 (the halt-class
  authority floor all six role files delegate to) bind future work.
- **Scope decision (class-iii):** the plan as a whole decides what remediation work is in/out of
  scope (build vs defer M-4/M-5; accept vs remediate M-1).
- **Anchor mint (class-i):** if remediation needs new T-D/C-D anchors (e.g. to anchor a deferral
  or the halt-class codification), that is a mint.

**Position:** I must classify the plan and *each ratification-class slice within it*. The seven
settled rulings are the ratification **of those scope decisions** — but a "settled ruling" is
**actionable only if authenticated, explicit, and current** (§8.3). A ruling I know only via the
audit summary or a relayed PR comment under the shared role-session identity is **pending**, not
actionable, until confirmed through the **authenticated (in-session human) channel**. At
convergence I confirm the spec-author ratification before I execute the merge; I do **not**
auto-merge a class-(i)–(iv) change on the three-sign-off gate alone (§7f, §8.3).

### P2 — Settled rulings honoured exactly, not re-litigated nor exceeded
For M-1, M-4, M-5, M-7, M-8, M-11, M-13 the plan must implement **what the spec author ruled** —
no more, no less. A slice that re-opens a settled ruling, or that quietly extends past it
(e.g. building a feature the ruling deferred, or deferring one the ruling said to build) is a
finding. I verify the plan's disposition of each settled finding against the ruling text, not the
audit's restatement.

### P3 — Planner-scoped findings stay within *design* authority
M-2, M-3, M-6, M-9, M-10, M-12 are the planner's to design **how** to fix. A planner-scoped slice
is a finding if it smuggles in a **scope decision or spec amendment that needs ratification**
without flagging it — e.g. M-6 (SPEC §7.27) and M-9 (REQUIRED_READING) edit governance/spec docs;
those edits are class-(ii) even though the *finding* is planner-scoped. Design authority over
*how* does not confer ratification authority over the *doc change*.

### P4 — Recursive consistency (the plan that fixes governance drift must not create it)
This plan remediates the project's own discipline-floor (M-7/M-8/M-9/M-10/M-12/M-13). It must
therefore itself be governance-clean:
- **M-10 is recursive:** PLATFORM_STATUS is stale "despite refresh-every-sign-off." This plan's
  own merge must refresh PLATFORM_STATUS (and the post-work cohort doc-hardening gate must fire),
  or it reproduces the very finding it closes.
- The plan must not introduce *new* drift between the docs it touches (e.g. fix M-7 in
  `AUTO_CONTINUE §D` but leave `REQUIRED_READING §7` self-contradicting).
- The plan's own authoring must follow AUTHORING_DISCIPLINE (status taxonomy; pre-work/post-work
  gates) and SESSION_START (path/anchor/handover conventions).

### P5 — The §8 convergence topology is invariant and must survive the M-7 fix
M-7 rewrites merge-method doctrine. **The topology itself is not project-tunable** (REQUIRED_READING
§7 tail; role §7). The fix must preserve the **two-context distinction** REQUIRED_READING §7 already
records — **squash** for the role-trio merge-executor, **merge-commit** for the auto-continue build
chain — and *reconcile* the two docs, not flatten them into one method or break the squash
convention this very plan-trio merge runs under. Topology-invariant checklist (role §6): three
independent sign-offs · one SHA · green CI · overseer-executes-mechanically · execution≠authority ·
override window (full for absence; present author collapses to zero) · named external trigger ·
ratification classes (i)–(iv) · spec-author authority · planner/auditor never-merge · convergence
binds to the **content-SHA**.

### P6 — Back-port / no-partial-fold discipline on the doctrine fixes
A ratified amendment to shared doctrine **blocks downstream authoring until back-ported** and a
**silent partial-fold is a finding** (role §7, §8.3). If the plan amends §8 merge-method (M-7) or
the halt-class floor (M-8), it must carry the **back-port to all six role files** (and any
delegating docs) as a **blocking** prerequisite slice, not a deferred nicety — shipping the rule
in `AUTO_CONTINUE` while some role files still carry the old doctrine recreates the very
inconsistency M-7/M-8 exist to remove.

### P7 — Halt-class set: codify or surface, never silently rely on the uncodified extensions
REQUIRED_READING §4 records that halt classes 4/5/8/9 are **blessed but uncodified**; the three
codified classes are authoritative until M-8 lands. The plan must treat M-8 as the codification
work (per the settled ruling) and must not have any slice *operate on* an uncodified halt class as
if it were canon. Closing this is owed work, not settled doctrine.

### P8 — Anchors are not minted mid-plan
The plan must not mint T-D/C-D anchors as a side effect of a slice. New anchors are **proposed via
a working note appended to `DECISIONS.md`** and are a **class-(i)** ratification surface (P1). A
slice that mints an anchor inline is a finding.

### P9 — Slice topology is gateable and correctly sequenced
Each slice must be independently passable through the **three-layer green gate** (Gitar + CI +
mergeable) and the pre/post-work doc gates. Governance concerns:
- **Dependency order** is honoured (e.g. M-1 supply-chain remediation vs any fastify-v5 dependency;
  doctrine fix before its back-port; deferral-marker before the dependent §-deferral it justifies).
- **Ratification-class slices are explicitly flagged** so the *execution*-trio's overseer can
  classify them correctly and not auto-merge a spec/governance-doc amendment. A plan that buries a
  `SPEC.md` / `AUTO_CONTINUE` / `REQUIRED_READING` amendment in an unflagged ordinary slice is a
  governance defect — it sets the execution-overseer up to misclassify.
- The plan is **execution-trio-ready**: it is the executor/execution-auditor's source of truth, so
  it must be unambiguous about per-slice scope, anchors cited, and the verification bar.

### P10 — Scope discipline: all 13, no silent expansion or contraction
The plan must dispose of **every** actionable finding M-1…M-13 (M-14 needs none). A finding that
silently vanishes, or a slice that adds out-of-scope work beyond the 13 findings + their settled
rulings, is a finding. Severity-divergence rulings already recorded in the audit (M-7/M-8→Medium,
M-4→Medium) are settled inputs, not re-openable here.

### P11 — Transportability is **not** a requirement for this artifact (category guard)
The role-file/skill infrastructure must be transportable between repos; **this plan is
project-specific content**, not portable infrastructure. I will **not** raise transportability
findings against project remediation content — doing so would be a category error. (Recorded so I
do not mis-apply a role-infra lane test to plan content.) Transportability re-enters *only* if a
slice proposes editing a role file or the skill itself.

### P12 — Plan artifact conventions
Plan lives at `docs/_meta/throughline/plans/YYYY-MM-DD-<scope>.md` (§5); the planner's wake-log is
co-located on the canonical branch; my (overseer) wake-log + positions + final-marker stay on
**this** overseer branch (REQUIRED_READING §7). Final-marker token is the canonical status line:
`final — approved by plan-overseer` (role §4.7, §8). Convergence binds to the **content-SHA**; a
content-invariant (wake-log-only) marker does not re-stale.

---

## Convergence & execution stance (pre-registered)

- I sign off only after verifying these positions against the **actual plan text** at the SHA.
- I **never** merge on my own sign-off; the gate is **three independent sign-offs at one
  content-SHA + green CI + override window satisfied (+ explicit spec-author ratification for any
  §8.3 class)**.
- **Override window:** 24 h wall-clock after the third converging sign-off; a **present** spec
  author who ratifies/voices-no-objection collapses it to zero (REQUIRED_READING §7). The spec
  author is reachable on the in-session human channel — the authenticated ratification reference.
- **Execution is mechanical, not authority** (role §8.1): flip draft→ready, **squash-merge**
  (role-trio method, REQUIRED_READING §7), verify via `git ls-remote`.
- I do **not** self-wake to merge at window-expiry — the **planner** re-triggers me (reviewer-side
  asymmetry, role §8.2). Between rounds I stand down bounded (≤3 watcher lifetimes ≈ 90 min of
  zero counterpart activity, REQUIRED_READING §7).
