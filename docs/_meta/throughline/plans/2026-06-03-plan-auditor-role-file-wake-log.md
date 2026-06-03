# plan-auditor role-file — wake-log

> **STATUS: DRAFT — under three-party review.** `.claude/roles/plan-auditor.md` (the **second**
> of six role files; planner.md merged as precedent). Authored by the planner role under the same
> workflow it describes. Convergence = planner (me) + plan-auditor + plan-overseer final-markers
> at one SHA + green CI + elapsed override window → overseer auto-merges (planner.md §8 topology).
> Planner does not flip draft→ready and does not merge.

Planner session's durable loop-state memory for the `plan-auditor.md` PR. One line per plan-PR
commit. Per `planner.md` §5: each entry records the last-seen remote HEAD (`git ls-remote`), the
audit-ID set-diff (§6), and per-thread round-trip counts (`X/5`, §7). This file is the durable
surface a resumed/compacted session rebuilds loop state from (§3.4 reconcile).

**Reviewers (authoritative ID sets — assigned when they review):**
- `plan-auditor` (content correctness) — branch TBD (re-engages on the first revision commit)
- `plan-overseer` (workflow-governance correctness + merge-executor) — branch TBD

**Precedent + justified deviations from `planner.md` (see PR body):**
- Same frontmatter shape, §1–§9 outline, compaction anchoring, skill-invocation pattern,
  REQUIRED_READING pattern, and the **byte-faithful §8 convergence/merge topology**.
- Role-justified deviations: (1) **independent-first / anti-anchoring** standing obligation +
  §4.2 (auditor-specific — the planner authors, the auditor must not anchor to the draft); (2)
  artifact is **findings-as-PR-comments + a working audit branch** (positions, wake-log, marker),
  not an authored plan doc; (3) §6 is the **producer side** of the ID/set-diff discipline (the
  auditor mints the IDs the planner's gate consumes); (4) **reviewer-side asymmetry** — the
  auditor stands down bounded, the planner re-initiates (inverts planner obligation 7).

---

- **2026-06-03 · bootstrap (this commit)** — initial draft PR opened (`plan-auditor.md` +
  this wake-log).
  last-seen HEAD: planner `n/a (first commit)`.
  set-diff: `0 dropped / 0 added (baseline — no reviewer findings yet)` (§6 bootstrap).
  round-trips: none open.
  next: open draft PR; re-arm the watcher over the auditor + overseer ref space; the first
  revision commit re-engages the reviewers (in §4.9 bounded stand-down per planner.md).
