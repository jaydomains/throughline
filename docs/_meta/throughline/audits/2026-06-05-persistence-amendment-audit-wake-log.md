**STATUS-LINE: persistence-amendment cycle — PRE-REGISTERED (anti-anchoring), draft NOT yet read.**
Class-(iv) canon back-port, spec-author-authenticated (this channel), sequenced BEFORE the execution
family so executor/execution-auditor/execution-overseer inherit it from a consistent baseline (§8.3
back-port-blocking). Branch `claude/persistence-amendment` @ `aec73a9e`. Positions PA-1…PA-7 recorded
BEFORE reading. I do NOT merge / flip draft→ready. Reviewer-only.

# persistence-amendment — Peer Audit (Auditor) Wake-Log + Pre-Registered Positions

*Pre-registered BEFORE the draft (anti-anchoring). The amendment back-ports a "persistence" discipline
into the MERGED canon (planner.md + plan-auditor.md + plan-overseer.md, + AUTO_CONTINUE). I do not yet
know its exact wording — these are my independent AUDIT CRITERIA + expectations, to compare against the
draft. #127 (executor.md) is parked at 2/3 pending this; it folds the rule on rebase afterward.*

## Pre-registered positions (verify each against the draft text + ground truth)

- **PA-1 · Transportability.** Every touched file grep-CLEAN of project tokens (no `throughline`, PR-#,
  SHA, dates, `jaydomains`, `inorbit`). Any project-specific persistence mechanism → REQUIRED_READING /
  AUTO_CONTINUE, not baked into the role files.
- **PA-2 · Class-(iv) correctly declared + ratification on record.** The PR must declare class-(iv)
  (it moves the canonical baseline / sets durable precedent). Spec-author ratification is AUTHENTICATED
  (this channel) — verify the PR doesn't rely on a *relayed* ratification alone; the authenticated
  ruling is the gate.
- **PA-3 · Suite-consistency — NO silent partial-fold (dogfoods PB-2).** The persistence rule must land
  in EVERY canonical file that carries the affected discipline — planner.md, plan-auditor.md,
  plan-overseer.md, and AUTO_CONTINUE — each **perspective-adapted** (producer voice / auditor voice /
  executor-merge voice / workflow voice). A back-port that hits some files and silently skips others is
  itself the §8-drift / silent-partial-fold failure. Verify the touched-set is COMPLETE for the rule.
- **PA-4 · Localized / no-collateral.** Only the persistence rule added; the existing canon (the 8 +
  9th + PB-1…PB-4 findings, the full §8 topology, §6 invariant, glossary) byte-INTACT — set-diff `0/0`
  on prior content. No other section moved.
- **PA-5 · Content correctness of the persistence rule.** Whatever it codifies (durable state
  persistence / safe resumption / dormancy-survival / wake-log-as-durable-memory / persisting across
  compaction + container-reclamation), it must be SOUND and **integrate** with — not duplicate — the
  existing dormancy/persistence machinery already in the canon: §3 "no in-session self-wake survives
  dormancy" (obl 7-ish), §4.9 dormant-wait bounded stand-down + durable marker, §5 wake-log as durable
  loop-state memory, the external-trigger / re-dispatch honesty. If it overlaps these, it should
  cross-reference/extend, not re-state a near-duplicate.
- **PA-6 · Unambiguity.** No contradiction with the existing dormancy/wake-log/§4.9/§8.2 rules; the new
  rule's trigger + obligation are crisp; perspective-adaptation doesn't drift the meaning across files.
- **PA-7 · Execution-family inheritance.** Scope of THIS PR = the merged canon files (the execution
  files aren't merged yet). The amendment should be authored so the forthcoming #127 rebase+fold carries
  it into executor.md cleanly (and execution-auditor/overseer author against it from the start). Verify
  the rule is stated transportably enough to perspective-port to the execution seat later.

**Audit axes:** content correctness · transportability · skill-invocation correctness · unambiguity.
On reading: verify each PA-position against the text + ground truth (verify-before-write), then post
Confirm / Push-back / Refine / Missing with file:line evidence. Sign off only when satisfied;
defend-or-fold under counter-argument. I do NOT merge / flip draft→ready.

---

- **2026-06-06 (DRAFT READ @ `aec73a9e` → AUDITOR SIGN-OFF)** — PR **#128**, branch
  `claude/persistence-amendment`, base main `7b23096`. Pre-reg anchored `a3bac9a` BEFORE read. The
  amendment back-ports a 4-part **persistence/dormancy** discipline: **(a)** proactive ~25-min re-arm
  (before the ~30-min cap); **(b)** watcher = record-keeper-not-notifier ("detection is not awareness" —
  read watcher-log + fresh `git ls-remote` every wake, never a remembered state); **(c)** long-term
  dormancy (hours-to-days between triggers) is the NORMAL case, resumable via the durable wake-log;
  **(d)** "active subscription" honestly scoped = polling via the re-arm cadence, NOT a continuously-
  conscious session. **All four axes PASS — clean, no blocking findings:**
  - **PA-1 transportability** — role files + SKILL grep CLEAN (0 project tokens) ✓.
  - **PA-2 class-(iv)** declared in PR body; spec-author ratification AUTHENTICATED this channel ✓.
  - **PA-3 suite-consistency / NO silent-partial-fold** — verified PER-RULE (not skim): each of (a)-(d)
    present in ALL THREE role files (planner a3/b1/c3/d2 · auditor a3/b1/c3/d2 · overseer a3/b2/c3/d1) +
    SKILL + AUTO_CONTINUE §5; touched-set = complete merged-canon set carrying this discipline ✓✓.
  - **PA-4 no-collateral** — the only diff-deletions are re-rendered sentences with clauses inserted
    (§3 re-arm lines, §4.9/4.10 "bounded" lines, "whole sequence" lines, SKILL lines); NO rule removed;
    8+9th+PB-1..4 + §8 topology + §6 invariant byte-intact ✓.
  - **PA-5 content correctness** — the 4 rules are sound + match lived reality (I've been dogfooding them
    all suite); they INTEGRATE/extend (not duplicate) §3-no-self-wake, §4.9/4.10 bounded stand-down, §5
    wake-log-as-durable-memory, §8.2 not-self-firing-timer. (d) RESOLVES a latent ambiguity in finding #3
    rather than contradicting it ✓✓.
  - **PA-6 unambiguity** — cross-refs RESOLVE: no-self-wake = planner obl 7 (L145) / reviewers obl 8
    (auditor L157, overseer L152) — matches the §4.9/4.10 "(§3 obligation 7/8)" citations exactly (the
    per-file numbering risk the PR flagged checks out) ✓.
  - **PA-7 execution-family inheritance** — scoped to merged canon; #127 folds on rebase; rules stated
    transportably for later perspective-port ✓.
  - Origin honestly recorded (producer dormancy mid-suite + compaction-loss of sequencing state) — the
    amendment is its own motivating example; mirrors the local-reset I just recovered from.
  **AUDITOR SIGN-OFF @ `aec73a9e` content** — marker on my branch + approval comment. Set-diff
  `0 dropped / 0 added`. Class-(iv) → needs producer marker + overseer sign-off + EXPLICIT spec-author
  ratification → spec author authorizes/overseer executes. Re-scoping watcher to #128 (active link).
  I do NOT merge / flip draft→ready.

- **2026-06-06 (#128 THREE-PARTY CONVERGENCE @ `aec73a9e` — HALT for class-(iv) ratification)** — All
  three markers at `aec73a9e` content: auditor `01166a3` + overseer `44d7fe4` + planner `d196de57`
  (content-invariant final-marker — verified all 5 amended files byte-identical, only planner wake-log
  +22). **CONVERGED.** Planner correctly HALTED (did NOT auto-merge) — class-(iv) requires EXPLICIT
  spec-author ratification. Remaining gate: green CI + spec-author ratify/authorize → overseer executes.
  Surfaced to spec author (the ratification decision is theirs; sequencing was authenticated earlier but
  the class-(iv) merge go-ahead is a distinct explicit gate). On merge → #127 rebases onto amended canon
  + folds the 4 rules → re-stales my `be361b2` → I re-verify + re-sign #127. Armed brcv3a9sr. I do NOT
  merge / flip draft→ready.

- **2026-06-06 (#128 MERGED → persistence canon; main `afe74494`)** — Spec author ratified (class-(iv));
  overseer executed. Verified: main `7b23096`→**`afe74494`** ("Persistence amendment (class-iv back-port)
  … (#128)"); all 5 amended files on main byte-IDENTICAL to my signed `aec73a9e` content (no post-sign-off
  mutation); #128 branch deleted. Persistence/dormancy discipline (a-d) now CANONICAL across planner.md +
  plan-auditor.md + plan-overseer.md + SKILL + AUTO_CONTINUE finding 5. **NEXT: #127 resumes** — planner
  rebases executor.md onto `afe74494` + folds the 4 persistence rules → content change re-stales my #127
  marker `be361b2` → I re-verify expanded executor.md + re-sign. Then #127 converges (standard topology),
  then execution-auditor.md / execution-overseer.md vs the persistence-canonical baseline. Re-scoped
  watcher to #127 (active link). I do NOT merge / flip draft→ready.
