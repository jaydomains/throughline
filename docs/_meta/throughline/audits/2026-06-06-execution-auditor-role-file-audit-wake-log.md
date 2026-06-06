**STATUS-LINE: cycle 5 of 6 — execution-auditor.md — PRE-REGISTERED (anti-anchoring), draft NOT yet read.**
This is the EXECUTION-PHASE ADVERSARIAL REVIEWER — the mirror of MY OWN role (plan-auditor.md), one phase
down. Anti-anchoring is at maximum risk here (it will "look like me"); I verify against ground truth, not
familiarity. Positions EA-1…EA-11 recorded BEFORE reading `9f5eed99`. I do NOT merge / flip draft→ready.

# execution-auditor.md — Peer Audit (Auditor) Wake-Log + Pre-Registered Positions

**Branch:** `claude/execution-auditor-role-prompt` @ `9f5eed99` (planner draft). Canon complete on main
(`cbec2ad`, 4/6): planner + plan-auditor + plan-overseer + executor, all findings + §8 topology +
persistence amendment folded. execution-auditor.md is authored against that full canon → I expect ALL
findings + the 4 persistence rules present from the start, reviewer-voiced.

*Pre-registered BEFORE the draft (anti-anchoring). execution-auditor = the executor's adversarial
counterpart: reviews the executor's IMPLEMENTATION for (i) FIDELITY-TO-PLAN and (ii) CORRECTNESS — the
execution-seat analog of plan-auditor (which reviews the planner's PLAN for content correctness).
Co-reviewer = execution-overseer (governance). Reviewer-side: bounded stand-down, executor re-initiates.*

## Pre-registered positions (verify each against the draft text + ground truth)

- **EA-1 · Transportability.** grep-CLEAN of project tokens; project-specifics (the plan location, test/CI
  commands, anchor system, halt-class set) externalized to REQUIRED_READING, not baked.
- **EA-2 · Frontmatter + structure.** `name: execution-auditor`, `role-family: execution`,
  `counterpart: executor`, `overseer: execution-overseer`, `merge-executor: execution-overseer`,
  `merge-authority: spec-author`. Mirrors plan-auditor.md §1–§9 skeleton.
- **EA-3 · Skill invocation.** by-path; re-arm on stop **+ proactive ~25-min** (now canonical per #128);
  on-wake pairing = diff + read PR comments from BOTH executor AND execution-overseer;
  **record-keeper-not-notifier** (canonical: log + `git ls-remote` reconcile every wake); exact
  `SELF_EXCLUDE`; cross-PR redirect-rescope.
- **EA-4 · Independent-first / verify-before-write.** Pre-register positions BEFORE reading the executor's
  change (the anti-anchoring discipline — the execution-auditor must carry it too); ground truth never
  PR-desc/comment/recall; cite-SHA-after-reading; never author-and-assert-verification in one action.
- **EA-5 · Never-merge / never-flip (reviewer lane).** The execution-auditor NEVER merges, NEVER flips
  draft→ready — the execution-overseer executes. Restated as the easy-to-rationalize rule.
- **EA-6 · §8 convergence/topology.** Three-party (executor + execution-auditor + execution-overseer);
  three markers at ONE content-SHA + green CI + override window (collapse-to-zero on present spec author)
  + class-(iv) ratification; marker-placement two mechanics (REVIEWER markers live on the reviewer's OWN
  branch, content-bound, off the canonical PR branch).
- **EA-7 · Workflow-findings + persistence, REVIEWER-voiced.** authenticated-channel / inferred-authority
  / ruling-supersession / back-port-blocking (§8.3); substantive-action + omission surfacing incl.
  fold-completeness-check-against-scope (§7-ish — the reviewer's completeness duty); sequenced-cycle;
  wake-channel ranking; + the 4 persistence rules (a proactive-25min, b record-keeper-not-notifier,
  c long-term-dormancy-normal, d active-subscription-honest).
- **EA-8 · §6 set-diff gate + bootstrap-baseline + TOPOLOGY-INVARIANT CHECKLIST.** KEY DIFFERENTIATOR
  from executor.md: plan-auditor.md (the reviewer mirror) DOES carry the §6 topology-invariant checklist
  (reviewer-side mechanism — established in my cycle-4 EX-8 self-correction). So execution-auditor.md
  SHOULD carry it (verify §8 against the enumerated invariant, not byte-diff). Its ABSENCE would be a
  finding (the inverse of executor.md correctly omitting it). Plus the §6 bootstrap-baseline clause (the
  §4.2 pre-reg commit = `0/0 (baseline)`) — owed in all files.
- **EA-9 · Execution-phase distinction (the substantive one).** The execution-auditor reviews the
  executor's IMPLEMENTATION (code), checking BOTH **(i) fidelity to the approved plan** (did it implement
  what was settled, no silent deviation/expansion/shrink) **and (ii) correctness of the change** (builds,
  tests pass, no bug/regression, clears the verification bar). It mints stable finding-IDs the executor's
  §6 set-diff gate consumes. It may INDEPENDENTLY surface a plan-vs-reality divergence (the reviewer-side
  catch of executor §7e). Distinct from plan-auditor's "content correctness of a plan doc."
- **EA-10 · Unambiguity.** reviewer-never-merges vs overseer-executes clean; the fidelity-vs-correctness
  dual lens crisp + non-overlapping with the overseer's governance lane; cross-refs resolve.
- **EA-11 · Adversarial-independence + reviewer-side stand-down.** independent-first / pre-register /
  defend-or-fold / anti-anchoring carried; §4.9 reviewer-side BOUNDED stand-down with the EXECUTOR as
  re-initiator (not the auditor); round-trip escalation X/5.

**Audit axes:** content correctness · transportability · skill-invocation correctness · unambiguity.
On reading: verify each EA-position against the text + ground truth (verify-before-write); diff structure
against canonical plan-auditor.md (my own merged role) to check the perspective-port is faithful AND
genuinely execution-voiced (not copy-paste). Post Confirm / Push-back / Refine / Missing with file:line.
Sign off only when satisfied; defend-or-fold under counter-argument. I do NOT merge / flip draft→ready.

---

- **2026-06-06 (DRAFT READ @ `9f5eed99` / blob `94423ad` → AUDITOR SIGN-OFF)** — branch
  `claude/execution-auditor-role-prompt`. Pre-reg anchored `104df8d` BEFORE read. Read full 675 lines;
  verified each EA-position vs ground truth (incl. structural diff against canonical plan-auditor.md, my
  own merged role). **All four axes PASS — clean, no blocking findings:**
  - **EA-1 transportability** grep CLEAN (0 project tokens) ✓.
  - **EA-2 structure** — §1–§9 exact mirror of `origin/main:plan-auditor.md`; sole intentional diff = §6
    title gains "the two axes" (the execution adaptation) ✓.
  - **EA-3 skill** — §3.5 by-path + proactive-25min + record-keeper-not-notifier + exact-SELF_EXCLUDE +
    cross-PR-rescope; §4.5 watch BOTH executor+overseer (warns executor-alone misses overseer); §3.6 wake
    ranking ✓.
  - **EA-4 independent-first/VBW** — §3.1 verify-before-write + cite-SHA-after-read + run-the-verification;
    §3.2/§4.2 pre-register positions BEFORE diff ✓.
  - **EA-5 never-merge/flip/rubber-stamp** — intro "three things you may never do" + §3.7 + §8.1 ✓.
  - **EA-6 §8 topology** — 3-party, one content-SHA, collapse-to-zero, class-(iv), marker two-mechanics ✓.
  - **EA-7 findings+persistence reviewer-voiced** — §8.3 auth-channel/inferred/supersession/back-port (all
    "as auditor you surface…; you never merge"); §7 substantive-action + fold-completeness; persistence
    a3/b1/c2/d2 ✓.
  - **EA-8 KEY DIFFERENTIATOR CONFIRMED** — §6 carries the **topology-invariant checklist** (reviewer-side;
    canonical plan-auditor.md has it too — verified) + finding-set-diff + bootstrap-baseline. The inverse
    of executor.md correctly OMITTING it. Pre-reg right ✓✓.
  - **EA-9 two-axes (the substantive adaptation)** — fidelity-to-plan + correctness, both load-bearing,
    tagged per finding (§6.3), with §7e plan-vs-reality escape; prominent (5×), genuinely execution-voiced
    not copy-paste ✓✓.
  - **EA-10 unambiguity** — cross-refs resolve (no-self-wake = obl 8 L173, matches §4.9 cite); auditor
    (fidelity+correctness) vs overseer (governance) lanes distinct, non-overlapping ✓.
  - **EA-11 adversarial-independence + reviewer stand-down** — §3.2 independent-first, §4.6 defend-or-fold
    (concede/hold), §4.9 reviewer-side BOUNDED stand-down with EXECUTOR re-initiating (not auditor) ✓.
  **AUDITOR SIGN-OFF @ `9f5eed99` content (blob `94423ad`)** — marker + approval. Set-diff `0/0`.
  Normal class → convergence needs executor(producer) marker + execution-overseer sign-off → overseer
  executes. Re-scoping watcher to cycle 5. I do NOT merge / flip draft→ready.

- **2026-06-06 (#129 THREE-PARTY CONVERGENCE @ `9f5eed99`)** — All three markers at `9f5eed99` content:
  auditor `b4bcbaf` + overseer `c9574ef` + planner `6d677bf` (content-invariant final-marker — verified
  execution-auditor.md byte-identical, only planner wake-log +17). **CONVERGED.** Normal class → overseer
  executes on green CI (+ waivable override window). Next: overseer merges #129 → execution-auditor.md
  canonical (5 of 6) → cycle 6 = execution-overseer.md (the LAST file). Armed bp12ugdxb. I do NOT merge /
  flip draft→ready.

- **2026-06-06 (#129 MERGED → execution-auditor.md canonical; CYCLE 5 COMPLETE)** — Overseer executed.
  main `cbec2ad`→**`34da805`** ("Add execution-auditor role prompt (fifth of six)… (#129)"); content
  byte-IDENTICAL to my signed `94423ad`; branch deleted. **5 of 6 role files canonical.** LAST file:
  cycle 6 = execution-overseer.md (the execution-phase merge-executor — mirror of plan-overseer.md, the
  most consequential; operationalizes the autonomous-merge topology for the execution phase). I audit it
  with the same care as plan-overseer.md (cycle 3): pre-reg before reading, the §8/merge-execution
  load-bearing checks, the §6 topology-invariant checklist (reviewer-side), all findings + persistence
  reviewer/executor-voiced. Re-armed broad-minus-noise for the cycle-6 branch. I do NOT merge / flip
  draft→ready.
