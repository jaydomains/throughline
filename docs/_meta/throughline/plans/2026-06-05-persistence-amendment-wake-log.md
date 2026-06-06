# persistence-amendment — wake-log

> **STATUS: DRAFT — class-(iv) ratification, under three-party review.** A back-port amendment
> folding the **persistence & dormancy** finding (four sub-rules) into the canonical baseline:
> `planner.md`, `plan-auditor.md`, `plan-overseer.md`, `AUTO_CONTINUE_WORKFLOW.md`, and the
> `counterpart-change-detector` skill (`SKILL.md`). Class-(iv) (durable project-level precedent
> → explicit spec-author ratification + back-port-blocking). Authored by the planner under the
> workflow it amends. Convergence = planner + plan-auditor + plan-overseer final-markers at one
> content + green CI; spec author ratifies + authorizes; overseer executes. Standard topology.

> **🔢 SEQUENCING.** This amendment lands **before** the execution-family role files. #127
> (executor.md) is **paused in draft** pending this merge; on merge it rebases onto the
> persistence-amended canon and folds the four rules into executor.md, then re-converges.
> execution-auditor.md / execution-overseer.md are then authored against the persistence-canonical
> baseline. (§8.3 back-port-blocking: don't author the execution family ahead of this owed
> amendment.)

Planner session's durable loop-state memory for the persistence-amendment PR. One line per
commit; per `planner.md` §5 each entry records last-seen HEAD (`git ls-remote`), the audit-ID
set-diff (§6), and per-thread round-trips (`X/5`, §7).

**Reviewers (authoritative ID sets — assigned when they review):**
- `plan-auditor` (content correctness) — re-engages on the first revision commit
- `plan-overseer` (governance + merge-executor) — re-engages on the first revision commit

**The four sub-rules folded (spec-author-supplied scope, authenticated this channel):**
- **(a) Proactive ~25-min re-arm cadence** — re-arm *before* the ~30-min Monitor cap (~25 min),
  not only on stop/timeout → continuous (not gapped) coverage. Empirically validated this suite.
  Fold: §3 re-arm obligation (planner obl 4 / auditor obl 5 / overseer obl 5) + SKILL.md cap
  limitation + AUTO_CONTINUE finding 5(a).
- **(b) Watcher = record-keeper, not notifier; detection ≠ awareness** — the watcher detects-and-
  logs but does not guarantee a wake; on every external trigger / re-engagement / wake, read the
  watcher log **and** a fresh `git ls-remote` before trusting any internal state model. Fold: §3
  re-arm obligation (all three) + SKILL.md (new limitation + Mechanism-intro softening — this rule
  is fundamentally about skill behavior) + AUTO_CONTINUE 5(b).
- **(c) Long-term dormancy is the normal case (hours-to-days)** — extends the §4.9 bounded
  stand-down framing (minutes-to-hours within a live loop) to the hours-to-days horizon *between*
  external triggers; durable wake-log state + fresh-dispatch resume. Fold: §4.9/§4.10 intro (all
  three) + AUTO_CONTINUE 5(c).
- **(d) "Active subscription" honestly scoped** — refines sequenced-cycle finding #8: "actively
  subscribed" = polling via the 25-min re-arm cadence + watcher-log/ls-remote read on every wake,
  **not** "alive without explicit re-arm"; sequenced sessions can't self-wake, each link needs an
  explicit external trigger. Fold: §4.9/§4.10 sequenced-cycle clause (all three) + AUTO_CONTINUE 5(d).

**Origin (recorded honestly):** codified after the planner session went dormant mid-suite and a
piece of the sequencing/amendment state was itself lost across a compaction boundary — the
persistence rules exist precisely so loop state lives in durable records, not session memory. The
amendment is its own best motivating example.

---

- **2026-06-05 · bootstrap (this commit)** — initial draft PR. Folded the four sub-rules into all
  five targets (3 role files + AUTO_CONTINUE_WORKFLOW.md + SKILL.md). Per-rule presence verified in
  every role file (no silent partial-fold — the §7 discipline this suite enforces); transportability
  grep clean on the three role files (0 project tokens; only the intentional skill path). Cross-refs
  checked (§3 obligation numbering differs per file: planner re-arm=obl 4 / reviewers re-arm=obl 5,
  no-self-wake=obl 7 planner / obl 8 reviewers; §4.9 planner+auditor / §4.10 overseer).
  Line counts post-fold: planner 619, plan-auditor 627, plan-overseer 564, AUTO_CONTINUE 217,
  SKILL 154.
  last-seen HEAD: planner `n/a (first commit)`; main `7b23096`.
  set-diff: `0 dropped / 0 added (baseline — no reviewer findings yet)` (§6 bootstrap).
  round-trips: none open.
  next: open draft PR; re-arm watcher over auditor + overseer ref space (per the ~25-min cadence
  this PR codifies — dogfooding); first revision commit re-engages the reviewers (§4.9 bounded
  stand-down). Spec author ratifies + authorizes; overseer executes. Then resume #127 (rebase +
  fold the four rules into executor.md) → execution-auditor.md → execution-overseer.md.

- **2026-06-06 · PLANNER FINAL-MARKER @ `aec73a9` content — THREE-PARTY CONVERGENCE; HALT for
  class-(iv) ratification (this commit)** — Both reviewers signed clean at `aec73a9` content, no
  findings: **plan-auditor `01166a3`** (PA-1…PA-7 pass; per-rule presence grep-counted in all three
  role files — no silent partial-fold; cross-refs resolve; transportable; no collateral) +
  **plan-overseer `44d7fe4`** (governance clean; rules refine-not-contradict the topology; §8/§6/
  prior-findings byte-intact; class-(iv) correctly held — will NOT auto-merge on convergence alone).
  I verified ground truth via raw `git ls-remote` (not the comment claims): #128 `aec73a9`; auditor
  `01166a3`; overseer `44d7fe4`; main `7b23096` (not merged); CI green at `aec73a9` (`gate`✅×2 +
  `Gitar`✅). My marker is a **content-invariant wake-log-only commit**: the five reviewed artifacts
  are **byte-unchanged** (blobs planner `8d1595a`, plan-auditor `d40372c`, plan-overseer `d10cb20`,
  AUTO_CONTINUE `8dff90b`, SKILL `512ecd3`), so the reviewer markers stay bound to the same content
  and do **not** re-stale. **Three-party convergence reached at `aec73a9` content:** planner (this) +
  auditor `01166a3` + overseer `44d7fe4`. last-seen HEAD: planner `aec73a9`; auditor `01166a3`;
  overseer `44d7fe4`; main `7b23096`. set-diff: `0 dropped / 0 added`. round-trips: none open.
  **⛔ HALT — class-(iv): does NOT auto-merge.** Surfaced to the spec author for **explicit
  ratification + merge authorization** through the authenticated channel. The overseer executes the
  squash-merge **only after** the spec author ratifies directly (not on convergence alone). Planner
  does not flip draft→ready and does not merge. next: spec-author ratification → overseer executes →
  resume #127 (rebase onto amended main + fold the four rules into executor.md) → re-converge →
  execution-auditor.md → execution-overseer.md against the persistence-canonical baseline.