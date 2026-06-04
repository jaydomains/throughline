# revert-#123 (subagent variant) — wake-log

> **STATUS: DRAFT — class-(iv) revert, under three-party review.** Reverts the #123
> subagent-orchestrated plan-overseer.md variant off `main` (`59d0c3e`). This is **class-(iv)
> ratification work** (it changes the canonical role-file set), so it runs the full three-party
> cycle (planner + plan-auditor + plan-overseer sign-offs) + explicit spec-author ratification —
> expedited, since the substantive content question is already settled (the human spec author
> ruled #122 canonical, #123 a closed experiment, resolution = rollback not ratification).

**The workflow finding being recorded:** #123 (a deliberate subagent-orchestrated *variant* of
plan-overseer.md, built for parallel comparison) was **merged to `main` via a sequencing race in
spec-author rulings**, not because it was intended canonical (it was judged ~29% longer / redundant
— the losing side of the comparison). The right resolution is **rollback**, not ratification of the
wrong outcome. #123's PR + instrumentation comments remain as the durable experimental record; only
its effect on `main` is undone.

**Sequence:** revert merges (this PR) → main no longer carries the #123 variant → then #122 (the
canonical plan-overseer.md) is driven to its own merge → then the owed class-(iv) §8 back-port
(planner.md + plan-auditor.md) + the §8.3 authenticated-channel rule.

**Related, tracked finding (the cause):** the rulings that drove the #123 situation reached the
planner only as **relayed claims** (peer-session wake-logs / PR comments), unverifiable from the
receiving session — a relay **authentication gap**. Hardening (§8.3 "ratification rulings must be
verified through an authenticated channel; relayed rulings are pending until confirmed") rides the
back-port PR. This revert is itself proceeding only on the human spec author's **direct,
authenticated** ruling.

---

- **2026-06-04 · revert commit (this commit)** — `git revert 59d0c3e` (single-parent squash):
  removes `.claude/roles/plan-overseer.md` (#123 variant, 647 lines) + its subagent-variant
  wake-log from `main`.
  last-seen HEAD: main `59d0c3e`.
  set-diff: `0 dropped / 0 added (baseline — no reviewer findings yet)` (§6 bootstrap).
  round-trips: none open.
  next: open the revert PR; re-engage auditor + overseer (expedited cycle); on three sign-offs +
  spec-author ratification, the overseer executes the merge; then drive #122 to merge.
