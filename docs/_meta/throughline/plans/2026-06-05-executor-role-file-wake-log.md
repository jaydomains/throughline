# executor role-file — wake-log

> **STATUS: DRAFT — under three-party review.** `.claude/roles/executor.md` (the **fourth** of
> six; planner.md + plan-auditor.md + plan-overseer.md merged as precedent). Authored by the
> planner role under the workflow it describes. Convergence = planner (me) + plan-auditor +
> plan-overseer final-markers at one SHA + green CI + override window → overseer auto-merges
> (planner.md §8 topology). Planner does not flip draft→ready and does not merge.

> **▶️ FIRST EXECUTION-FAMILY FILE.** `executor.md` opens the **execution** family (the three
> plan-* files are the canonical precedent). It is the execution-seat analog of `planner.md` —
> both are producer-side / standing-re-initiator roles — so it is a faithful perspective-port of
> `planner.md`, **not** the heavier merge-executor rewrite `plan-overseer.md` required. The §8
> topology + standing obligations + workflow-findings are carried byte-faithful (perspective-
> adapted, verified against the topology invariant, not by byte-diff). Role-justified deviations
> are enumerated below.

Planner session's durable loop-state memory for the `executor.md` PR. One line per plan-PR
commit; per `planner.md` §5 each entry records last-seen HEAD (`git ls-remote`), the audit-ID
set-diff (§6), and per-thread round-trips (`X/5`, §7).

**Reviewers (authoritative ID sets — assigned when they review):**
- `plan-auditor` (content correctness) — re-engages on the first revision commit
- `plan-overseer` (governance + merge-executor) — re-engages on the first revision commit

  *(The role files are authored by the planner and reviewed by the plan-auditor + plan-overseer
  through the three-party plan-review cycle — the same sessions that reviewed the three merged
  plan-* files. `execution-auditor` / `execution-overseer` are roles this file **describes**, not
  the sessions reviewing it.)*

**Precedent + role-justified deviations from `planner.md` (see PR body):**
- Same frontmatter shape, §1–§9 outline, §3 standing obligations, §4.1–4.9 loop, §5 wake-log,
  §6 set-diff gate, §7 surfacing closed-list, §8 topology (§8.1–8.4), §9 glossary; the full
  workflow-findings set (the 8 + PB-1…PB-4) carried producer-voiced as in `planner.md`.
- Frontmatter swap: `name: executor`, `role-family: execution`, `counterpart: execution-auditor`,
  `overseer: execution-overseer`, `merge-executor: execution-overseer`.
- Role-justified deviations: (1) **source of truth = the approved plan** (not a work scope) —
  §1 adds "read the approved plan itself," §4.1 intakes the plan, §4.2 verifies the plan's
  preconditions against the live tree; (2) **plan-fidelity spine** — §7 adds the discipline of
  implementing exactly what the plan settled (no silent re-decide / scope-creep); (3) **§7(e) is
  the plan-vs-reality divergence surface** (the executor's signature surface — the analog of
  planner's "scope unworkable"); (4) **real-code branch health** — §4.3 strengthens "your change
  is real, its CI is real; fix red at root cause, never weaken a test"; (5) §8.3(iii) notes a
  scope departure *from the approved plan* is itself a scope-class.

---

- **2026-06-05 · bootstrap (this commit)** — initial draft PR (`executor.md` + this wake-log).
  Authored against the complete canon (planner.md + plan-auditor.md + plan-overseer.md merged on
  `main` @ `7b23096`, incl. the §8 back-port [PR A] + workflow-findings [PR B]). Transportability
  grep clean (0 project tokens; only the intentional skill path). 642 lines.
  last-seen HEAD: planner `n/a (first commit)`; main `7b23096`.
  set-diff: `0 dropped / 0 added (baseline — no reviewer findings yet)` (§6 bootstrap).
  round-trips: none open.
  next: open draft PR; re-arm watcher over auditor + overseer ref space; first revision commit
  re-engages the reviewers (in §4.10 / §4.9 bounded stand-down). Per spec-author standing ruling,
  the override window is **waived when the spec author is present**. After executor.md converges +
  merges → execution-auditor.md → execution-overseer.md complete the six-file suite.
