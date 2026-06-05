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

- **2026-06-04 · C-2 fold + §6-invariant update — ⚠️ COMMITTED BUT HELD (not a converge signal)** —
  Folded **C-2** (§6 pre-registered-positions bootstrap-baseline clause, mirroring plan-auditor.md
  §6 / OV-2). Updated the **§6 topology-invariant** to enumerate the now-canonical window-waiver
  (present-spec-author-collapses-the-override-window) + content-SHA marker, so this file's invariant
  matches its own ratified §8 (the gap the auditor/overseer flagged). §8.2 waiver + §8-head
  content-SHA kept (ratified class-(iv) per the relayed ruling).
  last-seen HEAD: planner `5b46a5a`; auditor `ad4a248`; overseer `1a9dd9d`; **main `59d0c3e`**.
  set-diff: `0 dropped / 1 added [C-2]` (C-1/OV-3 resolved-by-ratification; §6-invariant update is a
  consistency fix to match the ratified §8).
  **⛔ HELD — do NOT converge/merge.** Ground-truth conflict found on resume: a **subagent variant
  of plan-overseer.md (#123) is MERGED to `main`** (`59d0c3e`, human-authored web-merge), so main
  already carries a *different* plan-overseer.md (~1000-line diff from this one). The "#122 canonical
  / #123 experiment" and "C-1 ratified" rulings reached me **only as relayed claims** (overseer
  wake-log / PR comments), never from the human spec author directly — the exact unverifiable-relay
  surface just hardened against. **Surfaced to the human spec author for an authenticated ruling**
  on #122-vs-#123 canonical (option 1: #122 replaces #123 on main; 2: keep #123, close #122; 3:
  other). The overseer must NOT execute #122's merge (it would overwrite the human-merged #123)
  until the human confirms directly. This commit is for repo hygiene + work-saving, **not** a signal
  to converge.
  owed (tracked): class-(iv) §8 back-port PR (planner.md + plan-auditor.md → canonical §8 waiver +
  content-SHA + §6-invariant) **plus** the §8.3 **authenticated-channel rule** (the relay
  authentication-gap finding) across the plan-* files; remaining files authored vs the new canonical §8.

- **2026-06-04 · ⚙️ wake-mechanism test — step 3 (content-invariant ref-move)** — NOT a substantive
  #122 change: `.claude/roles/plan-overseer.md` is byte-unchanged. This wake-log line is a deliberate
  ref-move to `claude/plan-overseer-role-prompt` (#122's branch) to test whether the **plan-overseer's
  watcher poll is alive** and armed to this branch. Context: step 1 (issue comment) + step 2 (inline
  review comment) woke the auditor (poll-off; webhook-delivered) but NOT the overseer within bound.
  If the overseer's poll is armed here, this ref-move wakes it; if its poll is dead (capped + not
  re-armed) it won't, and only a push channel will. #124 already has the auditor's sign-off; awaiting
  overseer + planner markers. set-diff: `0 dropped / 0 added` (no plan-content change).

- **2026-06-04 · PLANNER FINAL-MARKER @ `7bfc66f` content — READY-PENDING-CANONICAL (this commit)** —
  per spec-author ruling: I post my marker as a **content-invariant wake-log commit** (accepted
  marker convention; validated by #124). `plan-overseer.md` is byte-unchanged, so the auditor's
  fresh marker `ebc51a7` @ `7bfc66f` holds. This marks #122 **ready-pending-canonical-alignment,
  NOT ready-to-merge.** Merge gate stays CLOSED until **PR A (§8 back-port)** and **PR B
  (workflow-findings amendment)** land — otherwise plan-overseer.md would ship canonical under an
  inconsistent §8 (the exact failure that occurred today). Convergence state: auditor ✅ `ebc51a7`;
  overseer ⏳ (was holding for this ruling — now unblocked to sign as ready-pending); planner ✅
  (this). set-diff: `0 dropped / 0 added`. Overseer does NOT execute #122's merge until A+B land.

- **2026-06-05 · BACK-PORT FOLD + REBASE — convergence RE-OPENED (this commit)** — PR A (#125) +
  PR B (#126) merged → §8 + workflow-findings amendments are canonical on `main` (`c36a6a6`); the
  back-port gate is satisfied and #122 is unblocked. **Folded the full workflow-findings set into
  `plan-overseer.md`** (overseer-voiced, from the canonical `c36a6a6` text): §3 (cite-SHA-after-
  reading, SELF_EXCLUDE exact-match, cross-PR re-scope, wake-channel reliability ranking), §4.10
  (sequenced-cycle active-subscription), §7 (substantive-action + omission surfacing), §8-head
  (marker-placement two mechanics), §8.3 (authenticated-channel, inferred-authority,
  ruling-supersession, sequenced-amendment), + glossary. **Rebased #122 onto `c36a6a6`** (clean —
  plan-overseer.md not on main). **Content change → re-opens convergence:** prior markers (auditor
  `ebc51a7`, overseer `c73e8f0`, planner `1390a9a` @ `7bfc66f` content) are **stale by design**;
  reviewers re-verify the expanded content + re-sign at the new content. Transportability clean (0
  project tokens); 545 lines. set-diff: `0 dropped / 0 added` (back-port fold, not a finding response).
  next: re-engage auditor + overseer → re-converge → **overseer executes #122's merge** (standard
  topology — the recursive self-merge) → then executor.md / execution-auditor.md / execution-overseer.md.

- **2026-06-05 · PLANNER FINAL-MARKER @ `2ae1139` content — THREE-PARTY CONVERGENCE (this commit)** —
  Both reviewers re-signed at `2ae1139` content after the back-port fold+rebase: **plan-auditor
  `2d7352f`** (fold re-verified against pre-registered position, executor-voice-adapted, no collateral,
  prior ratified content intact, transportable) + **plan-overseer `6d4fc3d`** (governance re-verify via
  raw git; all 8 + PB-1…PB-4 present & executor-voiced; rebase clean; CI green; `mergeable_state: clean`).
  I independently verified ground truth via raw `git ls-remote` (not the comment claims): #122 tip
  `2ae1139`; auditor branch `2d7352f`; overseer branch `6d4fc3d`; main `c36a6a6` (#122 not merged); CI
  green at `2ae1139` (`gate`✅×2 + `Gitar`✅). I post my marker as a **content-invariant wake-log-only
  commit** (canonical convention; validated on #124): `plan-overseer.md` is **byte-unchanged** (blob
  `09f144d`, 545 lines), so the reviewers' markers stay bound to the same content and do **not** re-stale.
  **Three-party convergence reached at `2ae1139` content:** planner (this) + auditor `2d7352f` + overseer
  `6d4fc3d`. last-seen HEAD: planner `2ae1139`; auditor `2d7352f`; overseer `6d4fc3d`; main `c36a6a6`.
  set-diff: `0 dropped / 0 added` (no plan-content change). round-trips: none open.
  **Normal convergence class** (the §8 content was ratified earlier; this fold carries already-canonical
  findings) → **standard topology: the plan-overseer executes #122's merge directly** — the recursive
  self-merge (an instance of plan-overseer executing `plan-overseer.md`'s own merge). The present spec
  author has ratified the autonomous chain (override window waived). I do **not** flip draft→ready and do
  **not** merge. next: overseer re-confirms the gate from ground truth → flip draft→ready → squash-merge →
  verify via `git ls-remote`. After #122 merges the discipline-infrastructure cycle is complete; then
  executor.md → execution-auditor.md → execution-overseer.md against the complete canon.
