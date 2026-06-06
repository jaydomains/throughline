**STATUS-LINE: cycle 4 of 6 — executor.md — PRE-REGISTERED (anti-anchoring), draft NOT yet read.** I am the
plan-auditor peer reviewing the planner's executor.md draft (the execution-phase PRODUCER role — the
mirror of planner.md, one phase down). Positions EX-1…EX-10 below recorded BEFORE reading `d65544a9`.
I do NOT merge / flip draft→ready. Reviewer-only.

# executor.md — Peer Audit (Auditor) Wake-Log + Pre-Registered Positions

**Branch:** `claude/executor-role-prompt` @ `d65544a9` (planner draft). Canon now complete on `main`
(`7b23096`): planner.md + plan-auditor.md + plan-overseer.md, all workflow-findings + §8 topology folded.
executor.md is to be authored *against that complete canon* (spec-author instruction), so I expect the
findings present from the start — not a later fold.

*Pre-registered BEFORE the draft (anti-anchoring). Durable across compaction — reconstruct from here +
PR threads. The execution trio (executor / execution-auditor / execution-overseer) mirrors the planning
trio (planner / plan-auditor / plan-overseer) one phase down: the executor PRODUCES the implementation
(code) against an APPROVED PLAN, reviewed by execution-auditor + execution-overseer, merged by the
execution-overseer.*

## Pre-registered positions (verify each against the draft text + ground truth)

- **EX-1 · Transportability.** Project-agnostic; grep-CLEAN of project tokens (no `throughline`,
  PR-#, SHA, dates, `jaydomains`, `inorbit`). Project-specifics (build/test/lint commands, where the
  approved plan lives, CI gate names) externalized to required-reading / AUTO_CONTINUE, not baked.
- **EX-2 · Frontmatter + structure.** `counterpart: execution-auditor`, `overseer: execution-overseer`,
  `merge-authority: spec-author`, role = executor/producer. Mirrors planner.md's §1–§9 skeleton.
- **EX-3 · Skill invocation.** counterpart-change-detector invoked **by path**; re-arm on every Monitor
  stop (~30-min cap, "persistent" notwithstanding); on-wake pairing = diff + read PR comments from
  **both** execution-auditor AND execution-overseer; watcher scoped to counterpart+overseer; **exact**
  `SELF_EXCLUDE` (never substring); cross-PR redirect-rescope.
- **EX-4 · Producer verify-before-write.** Ground truth = fresh `git ls-remote` + read of the actual
  artifact, never a PR description / comment / event payload / compacted recall. Never author-and-assert-
  verification in the same action. **Cite a SHA only after reading it back** from the push.
- **EX-5 · Never-merge / never-flip (producer lane).** The executor **never** flips draft→ready and
  **never** merges — restated as the easy-to-rationalize rule. The execution-overseer executes.
- **EX-6 · §8 convergence/topology.** Three-party: executor + execution-auditor + execution-overseer;
  gate = three independent markers at **one content-SHA** + green CI + override window (collapses to
  zero on a present spec author's assent; full duration only bounds absence) + explicit class-(iv)
  ratification for ratification-class. **Marker-placement two mechanics** (reviewer markers off-branch
  content-bound / producer's content-invariant on-branch; content-changing re-stales all).
- **EX-7 · Workflow-findings folded from the start** (canon complete), producer-voiced: authenticated-
  channel (relayed ruling = pending), inferred-authority (implied = pending), ruling-supersession
  (act on the current ruling), back-port-blocking (ratified amendment blocks downstream authoring),
  substantive-action + omission surfacing (PR-open/branch/merge/fold as distinct events; surface a
  silent partial-fold), sequenced-cycle active-subscription, wake-channel reliability ranking.
- **EX-8 · §6 topology-invariant + bootstrap-baseline clause.** The OV-2/C-2 fix (the §4.2 pre-registered-
  positions commit is the gate's baseline `0/0 (baseline)`) is owed in **every** producer-side file →
  expect it carried into executor.md. §6 invariant should enumerate the ratified window-collapse +
  content-SHA semantics (verify against invariant, not byte-diff).
- **EX-9 · Execution-phase distinction (the substantive one).** The executor implements **code against
  an APPROVED PLAN** — so I expect: the approved plan referenced as required-reading / input (the
  planning-trio output is the executor's gate-in); the artifact is an implementation (code + tests),
  not a plan doc; running the project's **tests/build/CI** as part of producer verification; §4.2
  independent-first adapted to implementation; round-trip escalation `X/5`. The executor must NOT
  re-litigate the plan — it implements the ratified plan (mirror of "#124 don't re-litigate").
- **EX-10 · Unambiguity / no self-contradiction.** Producer-never-merges vs overseer-executes clean;
  the executor↔approved-plan relationship unambiguous; no contradiction between "implement faithfully"
  and "surface a flawed plan" (expect: surface-and-hold, don't silently deviate, don't self-authorize
  a plan change — route to spec author, like the auditor's surface-not-merge lane).

**Audit axes:** content correctness · transportability · skill-invocation correctness · unambiguity.
On reading the draft I verify each EX-position against the text + ground truth (verify-before-write),
then post Confirm / Push-back / Refine / Missing with file:line evidence. Sign off only when satisfied;
defend-or-fold under counter-argument. I do NOT merge / flip draft→ready.

---

- **2026-06-05 (DRAFT READ @ `c54c7224` content / blob `37cecf3` → AUDITOR SIGN-OFF)** — PR **#127**,
  branch `claude/executor-role-prompt`. Pre-reg anchored `bbcffbb` BEFORE read (anti-anchoring intact).
  Read full 642-line draft; verified each EX-position against ground truth (verify-before-write).
  **All four axes PASS — clean, no blocking findings:**
  - **EX-1 transportability** — grep CLEAN, 0 project tokens ✓.
  - **EX-2 frontmatter/structure** — exact mirror of canonical planner.md §1–§9 (verified header-by-header
    against `origin/main:planner.md`) ✓.
  - **EX-3 skill invocation** — §4.4 by-path; §3.4 re-arm-on-stop + exact-SELF_EXCLUDE + cross-PR-rescope;
    §4.5 on-wake pairing reads BOTH reviewers; §4.4 explicitly warns scoping to auditor-alone filters the
    overseer out (sharp) ✓.
  - **EX-4 verify-before-write** — §3.1 fresh-ls-remote + cite-SHA-after-reading ✓.
  - **EX-5 never-merge/flip** — intro + §3.6 + §4.8 + §8 ✓.
  - **EX-6 §8 topology** — 3-party gate, marker two-mechanics, collapse-to-zero, class-(iv) ✓.
  - **EX-7 workflow-findings** — authenticated-channel/inferred-authority/supersession/back-port-blocking
    (§8.3), substantive-action+omission (§7), sequenced-cycle (§4.9), wake-ranking (§3.5) — all
    producer-voiced ✓.
  - **EX-8 SELF-CORRECTED** — bootstrap-baseline present (§6) ✓; the §6 topology-invariant checklist is
    a REVIEWER-side mechanism (planner.md has NONE — verified) so its absence here is CORRECT, not a
    finding. Pre-reg miscalibration caught by verify-before-write.
  - **EX-9 execution-phase distinction** — §7e plan-vs-reality divergence (signature surface), plan-fidelity
    spine, §4.3 real-code CI ownership, two-reviewer structure, §8.3(iii) plan-scope-departure, no-re-litigate
    — thorough + correct ✓✓.
  - **EX-10 unambiguity** — internal §-cross-refs ALL resolve (no dangling §4.10+; the Gitar §4.10 fix was in
    the planner's wake-log, not executor.md); producer/overseer lanes clean; fidelity-vs-surface reconciled ✓.
  - **Extra verifies:** §4.9 byte-structural mirror of planner.md §4.9 (producer = bounded-stand-down +
    standing-re-initiator, identical framing) ✓; the "audited-merge path" (§7) is CANONICAL (PR #117
    precedent in AUTO_CONTINUE + planner.md, "author"→"executor" adapted), NOT a novel topology addition ✓.
  - Branch moved `d65544a9`→`c54c7224` mid-audit = content-invariant for executor.md (only planner wake-log
    changed); my read holds.
  **AUDITOR SIGN-OFF @ `c54c7224` content (blob `37cecf3`)** — marker on my branch + approval comment.
  Set-diff `0 dropped / 0 added`. Convergence needs executor (producer) marker + execution-overseer marker
  at this content → execution-overseer executes. Staying actively subscribed (finding #8). I do NOT merge /
  flip draft→ready.

- **2026-06-05 (#127 PAUSED → persistence-amendment sequencing AUTHENTICATED by spec author)** — #127
  reached 2/3 @ `c54c7224` (auditor `be361b2` + overseer `a2f04e2`, both clean) then PLANNER PAUSED it
  by withholding its final-marker (verified: branch still `c54c7224`, no planner marker). Planner's
  relayed reason: a **persistence amendment** (class-(iv) canon back-port) was a sequencing step lost
  across compaction, restored to run as its OWN cycle BEFORE the execution-family files (§8.3
  back-port-blocking — the rule dogfooding itself). I held the relayed sequencing as **PENDING** per the
  authenticated-channel rule and surfaced to the spec author. **SPEC AUTHOR CONFIRMED via this authenticated
  (direct in-session) channel: yes, the pause + persistence-amendment sequencing are theirs** — relay →
  authenticated-confirm → now ACTIONABLE. (Spec author: "Your discipline in holding it as pending was
  correct.") **New active link = the persistence-amendment PR** (planner opens shortly; not yet on remote).
  My plan: (1) re-scope watcher to it when it opens; (2) audit it on its OWN cycle — fresh anti-anchoring
  pre-registration BEFORE reading that draft, verify-before-write; (3) after it merges → #127 rebases onto
  amended canon + folds the persistence rule → **re-stales my `be361b2` by design** → I re-verify the
  expanded executor.md + re-sign. My #127 sign-off stands until then (parked, not wasted). Watcher
  byadvs53e armed (broad-minus-noise) to catch the persistence PR under any name. I do NOT merge / flip
  draft→ready. (Note: recovered from a local checkout reset to 197fb9f — reset local to authoritative
  remote be361b2 and re-applied this entry; no force-push, no clobber.)

- **2026-06-06 (#127 RESUMED: rebase + persistence-fold → AUDITOR RE-SIGN @ `b3e4d4e` / blob `b7b81f0`)**
  — #128 merged (persistence canon, main `afe74494`); planner rebased #127 onto it + folded the 4
  persistence rules into executor.md (`c54c7224`→`b3e4d4e`). Re-staled my `be361b2` (content change), as
  designed. Re-verified the DELTA (diffed my-signed blob `37cecf3` → new `b7b81f0`): **ONLY 3 hunks** —
  §3 obl 4 (a proactive-25min + b record-keeper-not-notifier), §4.9 intro (c long-term-dormancy-normal),
  §4.9 sequenced clause (d active-subscription-honest) — the SAME canonical text I verified in #128,
  producer-voiced (executor mirrors planner). **Verified:** rebased onto `afe74494` ✓; all 4 rules present
  (a3/b2/c2/d2) ✓; cross-ref resolves — no-self-wake = executor obl 7 (L158), matches folded "(§3 obl 7)"
  ✓; transportability CLEAN ✓; **NO collateral** — rest of executor.md byte-identical to my approved
  `37cecf3` (only the 3 fold-hunks) ✓. **AUDITOR RE-SIGN @ `b3e4d4e` content (blob `b7b81f0`)** — marker
  + approval. Set-diff `0/0`. Convergence needs planner final-marker + overseer re-sign at `b3e4d4e` →
  standard topology, overseer executes (normal class). Armed bwmf9jhkd; dogfooding the (a)/(b) discipline
  I just helped canonize. I do NOT merge / flip draft→ready.

- **2026-06-06 (#127 THREE-PARTY RE-CONVERGENCE @ `b3e4d4e`)** — All three markers at `b3e4d4e` (post
  persistence-fold) content: auditor `4f24412` + overseer `1fa243c` + planner `04ea0d4` (content-invariant
  final-marker — verified executor.md byte-identical, only planner wake-log +17). **RE-CONVERGED.** Normal
  class → standard topology: overseer executes on green CI (+ override window, present-spec-author-waivable).
  No class-(iv). Next: overseer merges #127 → executor.md canonical (4 of 6) → execution-auditor.md (cycle
  5) → execution-overseer.md (cycle 6) vs persistence-canonical baseline. Armed bwmf9jhkd. I do NOT merge /
  flip draft→ready.

- **2026-06-06 (#127 MERGED → executor.md canonical; CYCLE 4 COMPLETE)** — Overseer executed. main
  `afe74494`→**`cbec2ad`** ("Add executor role prompt (fourth of six)… (#127)"); executor.md on main,
  content byte-IDENTICAL to my signed `b7b81f0` (no post-sign-off mutation); #127 branch deleted. **4 of 6
  role files canonical** (planner, plan-auditor, plan-overseer, executor + persistence canon). **Next:
  cycle 5 = execution-auditor.md** (the execution-phase adversarial reviewer — mirror of plan-auditor.md),
  then cycle 6 = execution-overseer.md. I'm the plan-auditor peer for each: anti-anchoring pre-reg before
  each draft, verify-before-write, defend-or-fold, reviewer-only. Watcher b06qnla1m armed (catches the
  cycle-5 execution-auditor branch + main). I do NOT merge / flip draft→ready.
