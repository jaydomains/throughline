# plan-overseer role-file — wake-log

> **STATUS: DRAFT — under three-party review.** `.claude/roles/plan-overseer.md` (the **third**
> of six; planner.md + plan-auditor.md merged as precedent). Authored by the planner role under
> the workflow it describes. Convergence = planner (me) + plan-auditor + plan-overseer final-markers
> at one SHA + green CI + override window → overseer auto-merges (planner.md §8 topology). Planner
> does not flip draft→ready and does not merge.

> **🔁 RECURSIVE-VALIDATION MOMENT.** `plan-overseer.md` defines the **merge-executor** role. Once
> it converges, an *instance of the plan-overseer* executes the merge of `plan-overseer.md` itself —
> the role definition is exercised by the very mechanism it specifies, on its own text. After this
> file merges, the autonomous-merge loop is **fully live** for the suite (the role that auto-merges
> subsequent files is itself in place). Flagged per spec-author note.

Planner session's durable loop-state memory for the `plan-overseer.md` PR. One line per plan-PR
commit; per `planner.md` §5 each entry records last-seen HEAD (`git ls-remote`), the audit-ID
set-diff (§6), and per-thread round-trips (`X/5`, §7).

**Reviewers (authoritative ID sets — assigned when they review):**
- `plan-auditor` (content correctness) — re-engages on the first revision commit
- `plan-overseer` (governance + merge-executor) — re-engages on the first revision commit
  *(note: a separate plan-overseer **instance** reviews this file; the role reviewing its own
  definition is itself part of the recursive-validation.)*

**Spec-author precedent recorded this cycle (override-window semantics):** the override window's
full duration is for spec-author **absence**; a **present** spec author who ratifies / voices no
objection **collapses the window to zero** (immediate execution). Absent → full duration as
designed. **Baked into this file's §8.2** ("The window's purpose is spec-author absence…").
*Suite-consistency note (ties to OV-1):* planner.md and plan-auditor.md (already merged) carry the
§8.2 text **without** this explicit clarification — a small back-port is owed for six-file §8
consistency; flagged to the spec author to bundle with the OV-1 §8-conformance decision rather than
re-open the two merged PRs ad hoc.

**Precedent + justified deviations from `planner.md`/`plan-auditor.md` (see PR body):**
- Same frontmatter shape, §1–§9 outline, compaction anchoring, skill-invocation, REQUIRED_READING
  pattern; §8 topology-faithful (perspective-adapted to the **executor's** seat, not byte-identical).
- Role-justified deviations: (1) **governance lane** (infrastructure/recursive-consistency, not
  content); (2) **merge-executor** — the major addition: §3 obligation 7, §4.8 execute-the-merge,
  and an **operational executor-seat §8** (gate re-confirm → flip draft→ready → squash → verify);
  (3) **§7(f)** ratification-class surfacing the executor uniquely owns; (4) **§8.2 window-waiver
  clarification** (present spec author collapses the window).

---

- **2026-06-03 · bootstrap (this commit)** — initial draft PR (`plan-overseer.md` + this wake-log).
  last-seen HEAD: planner `n/a (first commit)`.
  set-diff: `0 dropped / 0 added (baseline — no reviewer findings yet)` (§6 bootstrap).
  round-trips: none open.
  next: open draft PR; re-arm watcher over auditor + overseer ref space; first revision commit
  re-engages the reviewers (in §4.10 / §4.9 bounded stand-down). Per spec-author standing ruling,
  the override window is **waived when the spec author is present** — so on convergence I relay the
  go and the overseer instance executes (recursive self-merge).
