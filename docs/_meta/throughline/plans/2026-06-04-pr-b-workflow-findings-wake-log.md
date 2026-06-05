# PR B — Workflow-findings codification — wake-log

Durable loop-state for **PR B**: folding the eight workflow-findings from the #122/#123/#124/#125
cycles into the role-file bodies + `AUTO_CONTINUE_WORKFLOW.md` as normative rules. Authored by the
**plan-overseer** session as a one-time exception (spec-author ruling): the overseer authors, the
planner + plan-auditor review independently (three-party cycle), and the **spec author executes the
merge directly** (one-time author/executor separation; "overseer executes" resumes at #122).

## Scope (spec-author ruled: fold into role-file bodies, NOT a standalone doc)
Files: `planner.md`, `plan-auditor.md`, `AUTO_CONTINUE_WORKFLOW.md` (off `main` `6fd18af`).
`plan-overseer.md` is **not** in this PR — it is not on `main` (lives on the #122 branch); the same
eight findings get folded into it on the #122 branch **after** PR B converges + merges, so #122
ships the review-refined canonical text rather than draft wording.

## The eight findings
1. **Authenticated-channel** (NEW) — §8.3 both files + AUTO_CONTINUE §3: ratification is actionable
   only through a direct/authenticated channel; a ruling relayed under the shared role-session
   identity is pending, not actionable. *(Caused the #123 sequencing-race merge.)*
2. **Dormancy / no-in-session-self-wake** — already codified cycle 1 (§3 obl 4/7, §4.9); reinforced
   here via finding 8 + the AUTO_CONTINUE operational list.
3. **Comment-blindness** — already codified cycle 1 (§3 obl 5/6); restated in AUTO_CONTINUE.
4. **Self-exclude exact-match** (NEW) — §3 watcher obligation both files + AUTO_CONTINUE.
5. **Cross-PR redirect re-scope** (NEW) — §3 watcher obligation both files + AUTO_CONTINUE.
6. **Marker placement — two mechanics** (EXPANDED) — §8 head both files + AUTO_CONTINUE §1:
   reviewer markers on reviewer branches (content-bound, survive head moves); producer's
   final-marker is a content-invariant commit on the canonical branch (doesn't stale reviewers).
   Both mechanics codified explicitly per spec-author refinement, not just the principle.
7. **Cite-SHA-after-reading** (NEW) — §3 obl 1 (verify-before-write) both files + AUTO_CONTINUE.
8. **Sequenced-cycle active-subscription** (NEW) — §4.9 both files + AUTO_CONTINUE §3: no bounded
   stand-down between links of a ratification sequence; stay subscribed across the whole chain.

## Wake-log (chronological)
- **2026-06-04** — Authored PR B off `main` `6fd18af` (post-PR-A). Branch
  `claude/pr-b-workflow-findings`. Eight findings codified, perspective-adapted (producer voice in
  planner, reviewer voice in auditor, workflow-level canonical statements in AUTO_CONTINUE).
  set-diff bootstrap: `0 dropped / 0 added`. Class-(iv) (changes durable convergence/merge
  topology). Draft; not flipping draft→ready, not merging — spec author executes on three-party
  convergence.
- **2026-06-05 (refinement round)** — Spec-author refinement folded into finding #1
  (authenticated-channel): an **inferred** authority/authorship change (derived from a chain of
  rulings, not stated) is **pending** until confirmed through the authenticated channel — plus the
  issuing-side complement (rulings spell out their structural implications). Added to planner.md +
  plan-auditor.md §8.3 + AUTO_CONTINUE. Also corrected this wake-log's recorded counts (Gitar
  finding on #126, dogfooding finding #7 — cite figures after reading the diff, not the stat bar).
  **Accurate diff vs `6fd18af`:** `planner.md +60/-1`, `plan-auditor.md +64/-2`,
  `AUTO_CONTINUE_WORKFLOW.md +18`. This is a **content change** → re-stales the auditor's `48e7aed`
  marker (content-bound to the prior `b6fdbda`); auditor re-verifies + re-signs at the new content.
  Planner had halted to verify my authorship via the authenticated channel (finding #1 working);
  spec author confirmed directly.
