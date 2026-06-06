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
  re-engages the reviewers (§4.9 bounded stand-down). Per spec-author standing ruling,
  the override window is **waived when the spec author is present**. After executor.md converges +
  merges → execution-auditor.md → execution-overseer.md complete the six-file suite.

- **2026-06-05 · fold dangling-pointer fix (this commit)** — Gitar (automated review) flagged the
  bootstrap entry's `next:` note citing a **non-existent §4.10** ("re-engages the reviewers (in
  §4.10 / §4.9 …)"). Verified against ground truth: `executor.md` defines §4.1–§4.9 only (no §4.10,
  matching `planner.md`'s numbering) and carries **no** §4.10 reference itself — the dangling pointer
  was confined to this wake-log line, carried over from the `plan-overseer.md` wake-log where that
  file's merge-execution step shifted §4 numbering. Fixed: dropped `§4.10 /`, now reads "(§4.9
  bounded stand-down)". My own error → folded autonomously (§7). **Content-invariant w.r.t.
  `executor.md`** (the reviewed artifact is byte-unchanged, blob unchanged) — no reviewer marker
  exists yet, and this fix would not re-stale one if it did. last-seen HEAD: auditor `de93477`;
  overseer `b730b0c`; main `7b23096`. set-diff: `0 dropped / 0 added` (no `executor.md` change;
  Gitar is not a three-party reviewer — not in the set-diff ID space). round-trips: none open.

- **2026-06-06 · REBASE onto persistence-amended main + FOLD the four rules — convergence RE-OPENED
  (this commit)** — #128 (persistence amendment, class-(iv)) merged to `main` (`afe7449`, merged
  directly by the spec author = authenticated ratification). #127 was **paused** pending this; now
  unblocked. **Rebased `claude/executor-role-prompt` onto `afe7449`** (clean — executor.md/its
  wake-log aren't on main, no collision with #128's five files). **Folded the four persistence
  sub-rules into `executor.md`** (producer-side → same fold points as `planner.md`): §3 obligation 4
  (a: ~25-min proactive re-arm cadence; b: watcher-is-record-keeper-not-notifier / detection≠
  awareness), §4.9 intro (c: long-term dormancy is the normal case, hours-to-days), §4.9
  sequenced-cycle clause (d: honest "active-subscription" scoping). Per-rule presence verified in
  executor.md (no silent partial-fold); transportability grep clean (0 project tokens). 642 → 661
  lines (+19, matching planner.md's persistence delta 600→619).
  **Content change → re-opens convergence:** the prior #127 markers (auditor `be361b2`, overseer
  `a2f04e2` @ `c54c722` content) are **stale by design**; reviewers re-verify the persistence-folded
  executor.md + re-sign at the new content. last-seen HEAD: main `afe7449`; auditor `85e7c78`;
  overseer `44d7fe4`. set-diff: `0 dropped / 0 added` (persistence fold per ratified amendment, not
  a finding response). round-trips: none open. Force-push required (rebase rewrote the branch onto
  new main) — expected, not a finding.
  next: re-engage auditor + overseer → re-converge #127 → overseer executes (normal class) → then
  execution-auditor.md / execution-overseer.md against the persistence-canonical baseline.

- **2026-06-06 · PLANNER FINAL-MARKER @ `b3e4d4e` content — THREE-PARTY RE-CONVERGENCE (this
  commit)** — Both reviewers re-signed clean at `b3e4d4e` content after the rebase+persistence-fold:
  **plan-auditor `4f24412`** (rebase+fold re-verified — 4 rules folded producer-voiced, cross-refs
  resolve, no collateral, prior content intact) + **plan-overseer `1fa243c`** (RE-SIGN APPROVE @
  `b3e4d4e`). I verified ground truth via raw `git ls-remote` (not the comment claims): #127
  `b3e4d4e`; auditor `4f24412`; overseer `1fa243c`; main `afe7449` (not merged); CI green at
  `b3e4d4e` (`gate`✅×2 + `Gitar`✅). My marker is a **content-invariant wake-log-only commit**:
  `executor.md` is **byte-unchanged** (blob `b7b81f0`, 661 lines), so the reviewer markers stay bound
  to the same content and do **not** re-stale. **Three-party re-convergence reached at `b3e4d4e`
  content:** planner (this) + auditor `4f24412` + overseer `1fa243c`. last-seen HEAD: planner
  `b3e4d4e`; auditor `4f24412`; overseer `1fa243c`; main `afe7449`. set-diff: `0 dropped / 0 added`.
  round-trips: none open. **Normal convergence class** (a producer-side role file faithful to
  ratified canon) → **standard topology: the plan-overseer executes #127's merge.** Present spec
  author may waive the override window. Planner does not flip draft→ready and does not merge. next:
  overseer re-confirms the gate from ground truth → flip draft→ready → squash-merge → verify. After
  #127 merges: execution-auditor.md → execution-overseer.md against the persistence-canonical baseline.
