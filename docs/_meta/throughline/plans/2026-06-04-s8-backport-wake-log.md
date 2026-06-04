# PR A — §8 back-port (planner.md + plan-auditor.md) — wake-log

> **STATUS: DRAFT — class-(iv) §8 back-port, under three-party review.** Mechanically aligns
> `planner.md` + `plan-auditor.md` to the spec-author-ratified canonical §8 already carried by
> `plan-overseer.md`. PR A in the spec-author-ruled sequence: **A (this) → B (workflow-findings) →
> then #122 merges**. Ratification-class (§8.3(iv) — changes canonical merge topology); three-party
> cycle + spec-author ratification; overseer executes.

**Why:** today's failure was plan-overseer.md shipping canonical under a §8 the other two files
didn't match. This closes that gap *before* #122 makes plan-overseer.md canonical.

**Scope (tight — canonical text already exists in plan-overseer.md §8):**
- **§8.2 window-waiver collapse-to-zero** → added to planner.md + plan-auditor.md (present spec
  author collapses the override window to zero; full duration is for spec-author absence).
- **§8-head content-SHA binding** → added to both (a content-invariant wake-log-only marker does
  not re-stale the others; binding is to role-file content at the SHA). This codifies the
  marker convention validated on #124.
- **§6 topology-invariant** → added to `plan-auditor.md` §6 (reviewer-side drift-check, per its
  cycle-2 B-1), enumerating the canonical invariant incl. collapse-to-zero + content-SHA.
  `planner.md` §6 is the set-diff gate (consumer side, no drift-checklist) → no §6 change there;
  `plan-overseer.md` §6 already updated (#122). Glossary override-window entries updated in both.

---

- **2026-06-04 · bootstrap (this commit)** — PR A draft opened (planner.md + plan-auditor.md §8
  back-port + plan-auditor §6 invariant + glossary).
  last-seen HEAD: main `ac09da8`.
  set-diff: `0 dropped / 0 added (baseline — no reviewer findings yet)`.
  round-trips: none open.
  next: open draft PR; re-engage auditor + overseer (expedited — canonical text already ratified);
  three-party convergence → spec-author ratifies (class-(iv)) → overseer executes.
