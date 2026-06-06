# Planner Role-File — Peer Audit (Auditor) Wake-Log + Pre-Registered Positions

**STATUS-LINE / FINAL-MARKER: AUDITOR — APPROVED (final, amended) @ `4f7b24906`.** All auditor findings
A-1…A-6 + A-2r AND amendment-round AF-1/AF-2 independently verified RESOLVED at author HEAD `4f7b24906`
(merge-authority amendment: overseer=merge-executor; AF-1 fixed — §8.2 names the planner as the
re-initiator that wakes the overseer at window-expiry, ultimately riding an external trigger; no
self-executing-merge claim). Supersedes my stale `db3a3f8e` marker (`de9b113`). Convergence completes
when planner + overseer markers also point at `4f7b24906`. I do NOT merge / flip draft→ready.

**CONVERGENCE TRACKER (resume-critical) — AMENDED FILE @ `4f7b24906`: THREE-PARTY CONVERGENCE COMPLETE.**
planner ✅ `b63bac0e` ("APPROVED @ 4f7b249 content") · auditor ✅ `3a05128` + comment 4611739706 ·
overseer ✅ `e978d496` — all three cleared the same plan-content `4f7b24906`. **Now in reviewer-side
§4.9 BOUNDED STAND-DOWN** (work complete; not re-arming the poll; #119 push subscription is the
merge-trigger). **Remaining (NOT mine):** (1) spec-author **ratification** (this PR is §8.3(iv)
durable-precedent/merge-topology change → ratification-required; the ratification is AF-1's external
trigger so #119's own merge avoids the auto-merge self-wake gap); (2) overseer **executes** the merge
(ratification → draft→ready → gate re-confirm → merge). main `2330be3` (NOT merged); author branch
`b63bac0e` still present. **RESUME on merge** (push/re-dispatch): `git ls-remote` confirm
main-advanced / author-branch-deleted → TERMINAL stand-down (§4.8): unsubscribe #119, stop watcher,
end role. **RESUME if planner.md changes past `4f7b24906`:** marker STALE → re-verify A-1..A-6/A-2r/
AF-1/AF-2 vs new HEAD → refresh marker before re-approving. I do NOT merge / flip draft→ready.
- **2026-06-03 (2 empty timeouts post-sign-off) — DORMANT-WAIT BOUNDED STAND-DOWN (dogfooding §4.9).**
  Ground truth: author still `ae770cb` (no planner final-marker), main `2330be3` (not merged), PR
  open/draft. My substantive work is COMPLETE (auditor final-marker `dcf7015` + approval 4610455135;
  all A-1..A-6 + A-2r resolved at `ae770cb`). Remaining events (planner final-marker, spec-author merge)
  are NOT mine; per §4.9 the **planner is the standing re-initiator** and I (reviewer-side) **stand down
  bounded** rather than re-arm forever. Executing the bounded stand-down: posting a durable resume marker
  + stopping the active poll (TaskStop bmfra2tx0); **keeping the #119 push subscription** as the external
  trigger. **RESUME INSTRUCTIONS for a re-triggered/fresh session:** (1) reconstruct loop-state from THIS
  wake-log; (2) `git ls-remote` — if main advanced / author branch merged-deleted, the spec author merged
  → do the TERMINAL stand-down (§4.8): confirm merge, unsubscribe #119, end role; (3) if the file changed
  past `ae770cb`, my sign-off is STALE → re-verify A-1..A-6+A-2r against new HEAD and refresh my
  final-marker before re-approving; (4) else still awaiting planner final-marker + merge — no action, the
  planner re-initiates. I do NOT merge / flip draft→ready.


*Adversarial peer review of the **planner** role file (one of six: planner, plan-auditor,
plan-overseer, executor, execution-auditor, execution-overseer). Same shape as the Phase E
execution audit (PR #116) and the counterpart-change-detector skill audit (PR #117/#118).*

*This file is committed to my audit branch as a wake-log. Its first section is **pre-registered
before reading the author's draft** — the anti-anchoring discipline made durable and timestamped,
so a "Confirm/Push-back/Refine/Missing" later can be checked against positions I held *before* I
saw the author's framing.*

---

## Run context (verified ground truth at arm time)

- Audit branch: `claude/planner-role-audit-FuAh9` (mine; SELF_EXCLUDE target).
- `git ls-remote origin refs/heads/main` = `2330be3` (= merge of PR #118). My branch HEAD == remote main.
- Author's planner-role branch: **does not yet exist on the remote** at arm time (verified via
  `git ls-remote origin 'refs/heads/*'`: only `admiring-dijkstra-0hBh5`, `busy-shannon-QjjRe`,
  `e3-semble-honesty`, `gifted-meitner-chJQE`, `phase-e-auditor-2-review-grOlD`, `main`). None of
  those holds a planner role file (checked their diff-from-main file lists). ⇒ a *new* author branch
  will be caught by the broad arm; no pre-existing-ref blindness risk for the author branch.
- Required reading consumed: counterpart-change-detector `SKILL.md` + `reference/operating-guide.md`
  + `scripts/watch-counterpart.sh`; `AUTO_CONTINUE_WORKFLOW.md` incl. the §"Two-Party Review Loops
  and Spec-Author Merge Authority" amendment; PR #116 (Phase E exec audit, both auditors' converge
  comments), #117 (skill authoring), #118 (skill follow-up + Gitar regex-validation finding).

---

## Standing obligations for THIS audit session (anchored here, not in compactable context)

Per the counterpart-change-detector skill §7 (compaction survival) — these live in the role prompt
and are re-stated here on my durable branch surface so a compaction/new-session can recover them:

1. **I run a counterpart loop** via the `.claude/skills/counterpart-change-detector/` skill, watching
   the author's planner-role branch + PR.
2. **On every wake**: do the on-wake pairing — `git ls-remote` ground-truth the ref, fetch+diff the
   branch, AND read PR comments/reviews via GitHub MCP (the watcher is comment-blind). Verify before
   writing any claim.
3. **On every Monitor stop/timeout**: re-arm immediately with a fresh baseline (assume ~30min cap even
   in persistent mode). Manual `git ls-remote` scan at re-arm to catch refs that appeared in the gap.
4. **Filter my own echoes** by ref name (`SELF_EXCLUDE=planner-role-audit-FuAh9`).
5. **Audit independently first**, compare second. Peer, not subordinate. Do not merge, do not converge
   on the author's behalf. Convergence = independent sign-off, not merge.

---

## Pre-registered independent positions — what a transportable planner role file MUST contain

*(Formed from the requirements only, BEFORE reading the author's draft. If the author's draft differs,
the burden is on whichever side has the stronger evidence — I defend or fold per the rules.)*

### P1 — Transportability (zero baked-in project specifics)
Grep-clean of: `throughline`, `SiteMesh`, `agent_dashboard`, anchor-system names (`T-D`, `C-D`,
`AZ-D`, `HB-D`, `MI-D`), specific halt-class names, and any project's discipline-doc *paths*
(`docs/_meta/throughline/...`, `.claude-code/...`, `.throughline/...`). All project knowledge must be
reached through the consuming project's required-reading, not named inline. Merge-governance is
project-specific too (it lives in the consuming project's workflow doc) — the role file must *point at
it via required reading*, not restate throughline's spec-author-merge-authority amendment inline.

### P2 — Skill invocation (invoke, don't restate)
- Must **invoke** the counterpart-change-detector skill by name + path, NOT re-paste the two-arm poll
  discipline inline. Re-stating polling inline would (a) duplicate, (b) drift from the skill, (c) miss
  the point of having a skill.
- Must reference the **on-wake comment-read pairing** (watcher is comment-blind) as load-bearing.
- Must anchor the **re-arm obligation in the role prompt itself** (skill §7) — the planner role file
  *is* the durable surface; if the re-arm rule lives only in working context it dies at compaction.
  This is the single most load-bearing skill-invocation requirement and the easiest to get subtly
  wrong (e.g. by saying "the skill handles re-arm" — it does not; the skill is explicit that the
  *obligation* must live in the caller's durable prompt).
- Params named correctly: `SELF_EXCLUDE`=planner's own branch, `WATCH_BRANCH`=auditor's branch,
  `WATCH_INCLUDE` scoping for a busy repo, manual `git ls-remote` at arm time for pre-existing refs.

### P3 — Required-reading discipline (the transportability hinge)
- Role file points at a **project-supplied REQUIRED_READING.md** but does NOT hardcode its path or
  contents.
- It must describe **the KIND of docs** the consuming project must list — generically — without
  leaking throughline's file structure. My position on the right altitude (categories, not filenames):
  (a) the work-scope / spec source of truth; (b) the project's discipline / workflow ruleset;
  (c) the decision/anchor ledger (whatever the project's equivalent is); (d) the current state-of-
  the-world doc; (e) the merge-governance / convergence ruleset. Naming *categories* is transportable;
  naming *files* is a leak. Too vague ("read the project's docs") fails the consuming project; too
  specific fails transportability. This section is where I expect the most calibration disagreement.

### P4 — Unambiguous rules (close the rationalization gaps Phase E exploited)
- **Convergence** defined as: all three independent roles (planner, auditor, overseer) post a
  final-marker commit + approval comment; PR stays draft; spec author rules on merge. Must be stated
  as **sign-off, not merge**, and must NOT let the planner treat auditor-silence as convergence.
- **Surface-vs-handle-autonomously**: needs a *bright-line test*, not "use judgment" (Phase E
  rationalized estimate-breach as a judgment call). My proposed line: surface iff the choice changes
  plan *scope*, introduces/alters an anchor or decision, or resolves a *spec ambiguity*; handle
  autonomously iff it's mechanical/structural within already-sanctioned scope. The file must pick a
  test this crisp or tighter.
- **"Substantive decision"** defined, not left to the session: substantive iff a reasonable spec
  author could rule either way AND the ruling changes the artifact's content/scope/commitments.
- **Audit-ID set-diff gate**: required before **every** revision commit — no exceptions. The file must
  say *every* and define the set-diff (IDs-addressed vs IDs-outstanding, so no finding is silently
  dropped between revisions). Phase E's W-2 ("bulk-deferred, no per-ID set-diff") is exactly the
  failure this gate prevents; a "when warranted" hedge re-opens that gap.

### P5 — Planner workflow shape (ordered, explicit, each step un-skippable)
1. Read work scope. 2. Read required reading. 3. **Verify live state against the repo tree / ground
truth** (not inherited/compacted claims — mirrors AUTO_CONTINUE "Pre-Flight State Verification").
4. Author plan as a **draft PR**. 5. Arm the detector on the auditor's branch + subscribe.
6. Iterate via PR comments: **revise = commit + wake-log; justify = reply**. 7. **Audit-ID set-diff
gate before every revision commit.** 8. **Surface** substantive decisions to the spec author (don't
bake, don't decide). 9. On convergence: **final-marker commit + approval comment.** 10. **Stay
subscribed until the overseer/spec-author merges** (planner cannot merge own PR). 11. **Stand down
cleanly** — stop the watcher task when the loop is genuinely over.

### P6 — Degraded-path behaviour the author is likely to skip (each must be explicit)
- **Work-scope ambiguity** → halt + surface to spec author; do not guess scope.
- **Auditor goes silent** → NOT convergence, NOT a planner halt; stay armed. (Mirror "reviewer-stall
  is not a halt class." The spec-author-merge-on-independent-audit path is the *spec author's*
  authority, not the planner's — the planner keeps the loop alive and does not self-converge.)
- **CI fails on the draft** → planner owns its branch; fix root-cause (not re-run-until-green), even
  for a doc-only plan. Note draft PRs are not chain-gate-polled, but CI hygiene still applies.
- **Spec-author silent on a surfaced decision** → do NOT bake a default; hold it open as an explicit
  plan open-question (LBD-style), proceed only on what is already sanctioned.
- **Context-compaction boundary** → re-arm, reconcile baseline vs `git ls-remote`, reload skill from
  disk. (Obligation must be in the role prompt.)
- **Planner's own branch diverges from origin mid-iteration** → ground-truth via `git ls-remote`,
  reconcile/rebase before the next revision commit; never commit on a stale base.

### P7 — Shape precedent for the other five role files
- **Location**: role files are NOT skills — they must NOT go under `.claude/skills/` (that path is for
  auto-discovered skills; PR #117's reasoning for the skill location does NOT transfer). They need a
  *shared, transportable* home that generalizes to all six (e.g. a dedicated `roles/` or `.claude/
  roles/` dir), with the planner's choice defensible as shared shape, not planner-specific.
- **Frontmatter / file structure / invocation pattern** must be designed to generalize to all six
  roles — if the planner's frontmatter encodes planner-only fields as if universal, that's a finding.
- The six roles pair (planner↔plan-auditor↔plan-overseer; executor↔execution-auditor↔execution-
  overseer): the planner file's "counterpart" and "convergence-with-three" wiring must be expressed so
  the auditor/overseer files are mirror images, not bespoke.

---

## Wake-log (chronological)

- **2026-06-02 (arm)** — Required reading consumed; positions pre-registered (above). Author branch
  absent from remote. Arming detector: broad arm (unknown author branch) + SELF_EXCLUDE on my branch.
  Re-arm obligation anchored above. Awaiting the author's draft PR.
- **2026-06-03 (wake → round 1)** — Last-seen remote HEAD (ground truth `git ls-remote`): author branch
  `claude/planner-role-prompt-sspQA` @ `64998ed` (parent = remote main `2330be3`; single commit adding
  `.claude/roles/planner.md`, 288 lines). PR **#119** (draft). On-wake pairing done: fetched+diffed the
  commit AND read PR comments (only a Gitar auto-approve; no auditor/overseer comments yet — I review
  first). Verified independently before writing: ran my own transportability grep (0 matches), confirmed
  no CI handling, confirmed surface-list (a) keys on scope-flagged questions, confirmed no spec-author-
  silence handling. Posted round-1 review: **6 confirms, 6 findings** (A-1 overseer/merge-authority
  contradiction [MED], A-2 inline merge-governance transportability leak [LOW–MED], A-3 surface-list
  misses planner-discovered latent decisions [LOW–MED], A-4 spec-author-silence unhandled [MED], A-5
  draft-PR CI hygiene missing [LOW–MED], A-6 set-diff gate undefined for initial commit [LOW]). Set-diff
  (my finding set): `0 dropped / 6 added`. Not converged — awaiting author's fold/push-back. Watcher
  re-armed targeted on the author branch (task bzy2i1ge3).
- **2026-06-03 (wake → round 1 follow-up)** — Monitor timed out; re-arm scan: author branch unchanged
  at `64998ed` (NO revision yet). On-wake comment-read surfaced 3 comment-only threads the poll was blind
  to: overseer round-1 (F1–F8; their **F1 ≡ my A-1** — independent convergence on the merge-authority/
  topology defect), a surfaced **dormant-wait re-arm gap**, and the overseer's ruling on it. Verified
  before writing: re-read AUTO_CONTINUE amendment to confirm overseer **F3** (auditor-silence clause
  mis-maps the author-silence amendment — correct; sharpens my A-2); confirmed **F8** empirically (the
  whole overseer review reached me comment-only — poll-blind). Concurred Major on the dormant-wait gap —
  **I am Exhibit A** (went dormant overnight, resumed on manual re-prompt); qualified my own C-2 (re-arm
  anchoring is necessary-but-insufficient for dormancy). Fix disposition: #2 bounded-stand-down primary +
  #1 push backstop + F6-as-precondition (reconstruct loop-state from wake-log on resume). **Dogfooded:**
  added PR-activity push subscription on #119 as dormancy backstop; re-armed poll targeted on author +
  overseer ref space (`WATCH_INCLUDE=role|overseer|planner`, task bytbvlpd4). Posted concurrence comment
  (4609721321). Set-diff: `0 dropped / 0 added`. Still not signed off; A-1..A-6 stand.
- **2026-06-03 (wake → dormant-wait grounded input)** — Author branch still `64998ed` (NO file revision).
  Two new planner comments caught via on-wake read (NOT via push): (1) spec-author ruling — dormant-wait
  fix is an OPEN question for the cycle, do NOT pre-decide; (2) planner concedes §4.4 overseer-blindness
  (F8/A-1). **Empirical data point recorded:** push subscription did NOT independently wake me for those
  two comments (07:26Z/07:32Z) — found via poll-timeout + on-wake read; so "push survives dormancy" is
  unproven. Withdrew my prior "#2" recommendation → hypothesis. Posted grounded input (4610100739):
  empirical instrument evidence, a SAFE out-of-band test protocol (don't strand the live audit), and a
  **new failure mode — mutual-stand-down deadlock** (symmetric bounded stand-down + counterpart-activity
  resume-trigger → permanent stall; needs asymmetric re-initiator / external trigger / human). Core audit
  unchanged: A-1..A-6 stand, A-1/F1 contradiction still live at HEAD. Not signed off. Set-diff `0/0`.
  Poll re-armed (task b4sozke4b) + push subscription active.
- **2026-06-03 (wake → overseer round-2 convergence; REF on overseer branch)** — Broad arm fired `REF`
  on new branch `claude/planner-role-overseer-P1NAz` @ `4700205` (overseer pushed a wake-log — fixing the
  overseer-side of F8: previously comment-only = no ref signal). Author branch STILL `64998ed` (file
  unrevised). On-wake comment-read: overseer round-2 (4610128557) — (a) corroborates push unproven
  (THIRD independent data point: 07:26/07:32 comments didn't push-wake them either), (b) **accepts my
  mutual-stand-down deadlock**, converges on my refined shape (bounded ASYMMETRIC stand-down w/ planner
  as re-initiator + F6-reconstruct + push-as-latency), (c) endorses my safe out-of-band test protocol.
  No counter-argument to defend (overseer agreed) → per frugal-posting discipline I did NOT post another
  agreement comment; recorded convergence here instead. **Cycle state:** auditor+overseer independently
  converged on the dormancy hypothesis + the A-1/F1 topology must-fix; routing now at spec author. Pending
  moves are NOT mine: author file-revision; spec-author ruling on A-1 two-vs-three-signatory + whether to
  authorize the controlled empirical test. Core audit unchanged: A-1..A-6 stand, A-1/F1 live at HEAD. Not
  signed off. Monitor b4sozke4b still live (REF was an event, not a timeout) — no duplicate re-arm.
- **2026-06-03 (wake → author REVISION; MOVED 64998ed→592bfd9)** — Author folded round-1 (one commit
  `592bfd9`, planner.md + their wake-log). On-wake pairing: read full revised file + diff before writing.
  Re-verified each finding INDEPENDENTLY against the text (not the author's summary): **A-1 RESOLVED**
  (grepped all merge mentions → uniformly spec-author; zero residual "overseer merges"; §8 now three
  independent sign-offs, overseer = co-equal third signatory not merge button; frontmatter wired
  overseer+merge-authority), **A-3 RESOLVED** (latent-ambiguity added to §7a + new (e) unworkable-scope),
  **A-4 RESOLVED** (surface mechanism + never-bake-while-pending), **A-5 RESOLVED** (§4.3 draft CI
  hygiene), **A-6 RESOLVED** (§6 bootstrap baseline + demonstrated in author wake-log), **A-2 substance
  RESOLVED** (F3 mis-map fixed + silence posture externalized). **One residual: A-2r (LOW)** — §7 L296
  externalization sentence over-claims scope ("convergence-and-merge governance is project policy") vs
  §8 baking that very model → §7↔§8 transportability inconsistency; offered narrow-L296 fix. Set-diff
  accounting verified sound (0 dropped/14 added; dormant-wait carried as deferred-open, not dropped).
  Posted round-2 (4610238059). **Sign-off posture: A-1/A-3/A-4/A-5/A-6 cleared from my side; NOT signing
  off yet** pending (1) A-2r tighten, (2) dormant-wait ruling folded. Set-diff `0/0` (A-2r is residual on
  existing ID). Monitor b4sozke4b still live.
- **2026-06-03 (wake → overseer round-3; REF 47d70945 on overseer branch)** — On-wake pairing: overseer
  pushed round-3 (commit `47d7094` + comment 4610229344) — independently verified F1–F8 all RESOLVED at
  `592bfd9` against actual text; holds final-marker ONLY on the pending dormancy fold (same reasoning as
  me: don't endorse an incomplete §3 durability claim + avoid marker-churn); would sign off on `592bfd9`
  immediately if spec author rules dormancy = separate follow-up. Author fold comment 4610218554 relays
  spec-author topology ruling (three-party + spec-author-merge) and routes 2 decisions to spec author
  (ratify dormancy direction; authorize out-of-band test). **Cycle state / blocked-on-whom:** auditor
  (A-1,3,4,5,6 cleared; holds on A-2r + dormancy) and overseer (F1–F8 cleared; holds on dormancy) are
  ALIGNED; remaining blockers are the **spec author's dormancy ruling** + a one-sentence **A-2r** author
  tighten. No counter-argument to me → per frugal discipline, NO new comment posted (round-2 4610238059
  already states my position). Monitor b4sozke4b live; push subscription active. Awaiting author A-2r fix
  and/or spec-author dormancy ruling. Not signed off.
- **2026-06-03 (wake → overseer round-3b; REF 6e28ab7) — CONSOLIDATED HOLDING STATE**. Overseer
  independently verified my **A-2r** against the text and CONCURS (4610268437), elevating it from my
  "LOW transportability nit" to a "governance-clarity defect," endorsing my option-(a) fix (narrow §7
  L296 to the silence/merge-eligibility *posture*; §8 convergence *topology* stays baked — the
  baked-topology-vs-externalized-posture boundary is six-role precedent). Overseer CORRECTED its round-3
  condition: now gates on BOTH A-2r + dormancy (identical to me). **Full three-party alignment on the
  remaining gate:**
    • A-2r — two-reviewer corroborated; author to narrow §7 L296 (option a).
    • dormancy — spec-author ruling pending (ratify converged direction + authorize out-of-band test +
      rule fold-here-vs-separate-follow-up).
  No counter-argument to me (overseer agreed) → NO new comment posted (frugal). **Going quiet until real
  movement** (author A-2r fold OR spec-author dormancy ruling). Resume note for a compacted/fresh session:
  my findings A-1/A-3/A-4/A-5/A-6 are RESOLVED at `592bfd9`; A-2r is my only open content item; I sign
  off (final-marker commit flipping this file's status + approval comment) once A-2r is folded AND the
  file reaches converged form (dormancy folded or ruled out-of-scope). I do NOT merge, do NOT flip
  draft→ready. Monitor b4sozke4b live; #119 push subscription active.
- **2026-06-03 (wake → author round-2 fold; MOVED 592bfd9→ae770cb) — AUDITOR FINAL-MARKER / SIGN-OFF.**
  On-wake pairing: diffed `ae770cb` + read author fold announcement (4610430966). Verified independently
  before signing: **A-2r RESOLVED** (§7 externalizes only the silence/merge-eligibility *posture*; bakes
  the convergence *topology* §8 — exact option (a); §7↔§8 contradiction gone). **Dormancy fold verified
  sound in my lane**: faithful to the cycle's converged direction incl. my mutual-stand-down deadlock +
  asymmetric re-initiator (§3 obl 7, §4.9, glossary); transportability grep CLEAN on full file (0 tokens);
  bound defined + project-param; honest substrate-limit (reaped loop needs external trigger — no false
  guarantee); §8/A-1 intact (re-verified). Out-of-band push test = authorized separate follow-up PR
  (ruling 2a), NOT gating convergence — tracked, I remain available to run it. **All A-1…A-6 + A-2r
  RESOLVED at `ae770cb`. I post my final-marker (this commit, status-line flipped to AUDITOR — APPROVED)
  + approval comment.** Set-diff: `0 dropped / 0 added`. Convergence completes on the overseer's
  independent final-marker; spec author rules on merge. I do NOT merge / flip draft→ready. Staying
  subscribed through the overseer sign-off + spec-author merge, then stand down (verify merge via
  git ls-remote, stop watcher).

---

## AMENDMENT ROUND (re-opened) — merge-authority → overseer (autonomous post-convergence merge)

**Re-engaged.** Spec author is reversing the A-1/F1 keystone: merge authority moves from **spec-author**
to the **overseer** so the workflow runs autonomously after convergence. My prior sign-off (`dcf7015` @
`ae770cb`) is now **STALE**. Scope: the amendment ONLY; unchanged sections already at three-party
consensus (verify no-regression, don't re-litigate). Pre-registered positions BEFORE the planner's
revision (anti-anchoring):

- **AP-1 (safety — merge gated on FULL convergence).** The overseer may merge ONLY after all three
  independent final-markers exist (planner + auditor + overseer). Anything less re-introduces the #118
  conflict-of-interest (clearing-authority merging on incomplete clearance). Verify strict gating.
- **AP-2 (transportability — executor is POSTURE, ties to A-2r).** Per the ratified A-2r boundary
  (convergence *topology* baked; merge *authority/eligibility posture* externalized to REQUIRED_READING),
  WHICH party executes the post-convergence merge (autonomous overseer vs human spec-author gate) is a
  project posture. Hard-coding "overseer merges" universally removes a consuming project's human-merge-gate
  option — a transportability regression. Baked = (3 sign-offs gate any merge)+(merge only post-full-
  convergence)+(no single party clears-and-merges unilaterally); externalized = WHO executes. Surface for
  spec-author ruling if hardcoded.
- **AP-3 (#118 separation addressed, not silently reversed).** A-1 rested on clearing≠merge authority. The
  overseer now signs off AND merges; the file must justify why safe now (merge = mechanical execution of a
  state already independently cleared by all three, gated on planner+auditor markers too) rather than drop
  the principle.
- **AP-4 (no regression).** A-1..A-6 + A-2r + dormancy intact; merge refs updated CONSISTENTLY everywhere
  (frontmatter L7, §intro, "two things" L31-32, §2, §4.8, §8, glossary, §7 silence clause) — no NEW
  internal contradiction.
- **AP-5 (recursive consistency).** Amended file must describe the workflow about to run on it (overseer
  merges THIS PR post-convergence). File-says == what-happens.
- **AP-6 (unambiguity — stale-marker / current-HEAD gate).** "Autonomously after convergence" must pin: all
  three final-markers present AND all bound to the SAME current HEAD (an old-SHA sign-off must NOT authorize
  merging a newer SHA) AND CI green; overseer re-confirms marker currency before merging.
- **AP-7 (transportability grep).** Re-grep full file post-amendment — no throughline/anchor/path tokens.

Detector re-armed for the planner's revision; standing down via §4.9 between rounds (planner is the
standing re-initiator).

**Amendment round 1 — verified against `6444f6f8` then `80105b64`.** Planner sequence: `c8450a3`
(planner final-marker on original `ae770cb` — original 3-party convergence reached) → `6444f6f8`
(merge-authority amendment: overseer=merge-executor, spec-author=merge-authority, §8.2 override window
24h, §8.3 ratification scope-classes) → `80105b64` (Gitar-flagged §4.8 fix). Verified independently
(grep + text):
- **CONFIRMED:** AP-1 full-convergence gating (§8/§8.1/§8.2), AP-3 #118 separation (§8.1 sound argument:
  3 independent sign-offs + mechanical execution ≠ 2-sign-off self-merge; executor's own sign-off not
  sufficient), AP-6 stale-marker/current-HEAD gate (§4.7/§8/§8.2, thorough), AP-4 no-regression
  (A-1..A-6/A-2r/dormancy intact; merge refs consistent), AP-7 transportability grep CLEAN.
- **AP-2 FOLDED:** withdrew my "executor-as-posture" blocker — the authority/executor split + tunable
  override window + project-supplied ratification scope-classes (+ §4.8) make autonomy↔human-gate
  dialable per project; richer than my pre-registered position; baked per spec-author direction.
- **AF-2 (LOW) RESOLVED at `80105b64`** (planner fixed §4.8 vs §8.3 via Gitar flag — matches my AF-2):
  overseer always executes; spec author ratifies/authorizes, does not perform.
- **AF-1 (MEDIUM, headline) OPEN:** §8.2's 24h override-window auto-merge requires the overseer to
  self-wake after extended quiet to execute — directly contradicting §3 obl 7 + §4.9 L214 ("you cannot
  self-wake through [extended quiet]"). Auto-merge path has no specified external trigger at window-expiry.
  (Ratification path fine — spec-author ratification IS the trigger.) Recursive: the dormancy resolution
  this cycle folded undercuts the autonomy amendment. Posted review 4611648346 + update 4611659664.
- **Recursive-consistency (positive):** the file self-classifies this amendment as §8.3 class (iv)
  durable-precedent → THIS PR needs spec-author ratification (not auto-merge), so this PR's own merge
  doesn't hit AF-1; AF-1 bites the first auto-merge-class PR.
**Sign-off: prior `dcf7015`@`ae770cb` STALE; NOT re-signed.** Sole blocker = AF-1. On AF-1 fix → re-verify
changed sections + re-sign at new SHA. Monitor b40dttycm live (events, not timeouts). Reviewer-side →
§4.9 bounded stand-down between rounds; planner re-initiates.

**Overseer amendment review (2194f227 / comment 4611646132 @ 6444f6f8) — cross-check.** Overseer findings:
OV-1 (§4.8↔§8.3 ratification-executor contradiction) = **my AF-2** — independent convergence, RESOLVED
@80105b6; OV-4 (this PR is §8.3(iv) ratification-class → needs spec-author ratification, not auto-merge)
= **my recursive-consistency observation** — convergent; OV-2 (draft→ready→merge sequence implicit; GitHub
won't merge a draft) + OV-3 (merge METHOD should be project param) = overseer execution lane, no planner.md
content impact. **KEY: overseer did NOT catch my AF-1** (override-window vs §3-obl-7/§4.9 self-wake
contradiction) — AF-1 is unique to me; on record in 4611648346 + 4611659664, framed as also overseer-lane
(expect concurrence on read). Open cycle items now: **auditor AF-1** + **overseer OV-2/OV-3**, all pending
planner fold. My sign-off still STALE; sole auditor blocker = AF-1. Monitor b40dttycm live; no new comment
(frugal — AF-1 already posted, no counter-argument). Reviewer-side: await planner's next fold (AF-1 + OV-2/3).

- **2026-06-03 (amendment fold — author db3a3f8e) — AUDITOR RE-SIGN / FINAL-MARKER (amended).**
  Planner folded `80105b64`→`db3a3f8e` ("Fold amendment round-1: AF-1 + OV-2 + OV-3"). On-wake pairing:
  diffed + verified vs actual text. **AF-1 RESOLVED** — new §8.2 para "Execution is not a self-firing
  timer": window = *earliest* the overseer may execute, not auto-fire; "no session self-wakes through
  extended quiet (§3 obl 7, §4.9)"; window-expiry execution needs an EXTERNAL trigger (project scheduler /
  re-dispatch / later activity) which re-confirms the gate; fully-hands-off requires the project to supply
  it; absent → waits for next external wake, recorded+resumable via wake-log, never silent stall; override
  window bounds when spec author may halt, not a self-executing promise. The §8.2↔§3-obl-7 contradiction
  is GONE (grep: all self-wake mentions now negations). **OV-2 RESOLVED** (draft→ready = first step of
  execution, one sequence). **OV-3 RESOLVED** (merge method = project param; act baked / method
  externalized — consistent with A-2r boundary). No regression (diff localized to §8.2/§8.4/glossary;
  §3/§7/§8.1/§8.3/frontmatter untouched). AP-7 transportability grep CLEAN. **All my items resolved at
  `db3a3f8e`: A-1..A-6 + A-2r + AF-1 + AF-2; AP-1/3/4/6/7 cleared; AP-2 folded.** I RE-SIGN: this commit
  flips status-line to AUDITOR — APPROVED (amended) @ `db3a3f8e` + approval comment. Set-diff: `0 dropped
  / 0 added`. Convergence completes when planner + overseer markers also point at `db3a3f8e`; then the
  overseer executes the merge (this PR is §8.3(iv) ratification-class → only after explicit spec-author
  ratification; external trigger = the ratification). I do NOT merge / flip draft→ready. Prior marker
  `dcf7015`@`ae770cb` superseded.

- **2026-06-03 (AF-1 refinement — author 4f7b24906) — AUDITOR MARKER REFRESH @ `4f7b24906`.**
  Planner pushed `db3a3f8e`→`4f7b24906` ("Refine AF-1: name the window-expiry wake mechanism (overseer
  concurrence)") right after my db3a3f8e re-sign — so de9b113@db3a3f8e went stale before I posted its
  approval comment (interruption avoided a stale approval). Re-verified the refinement vs text: §8.2 now
  NAMES the wake mechanism — the **planner** (standing re-initiator, stays subscribed through merge
  §4.8/§4.9) re-triggers the overseer to execute at window-expiry; planner itself subject to no-self-wake
  so the re-trigger ultimately rides an external trigger; fully-hands-off needs project-supplied scheduler;
  else recorded+resumable. SOUND + an improvement (leverages the established §4.9 asymmetry; internally
  consistent; overseer concurred). Transportability grep CLEAN; diff localized to the §8.2 AF-1 para (no
  regression). **All auditor items remain RESOLVED at `4f7b24906`.** Marker REFRESHED db3a3f8e→4f7b24906;
  posting approval comment at 4f7b24906. Set-diff `0/0`. Convergence: planner + overseer markers also at
  `4f7b24906`. This PR is §8.3(iv) ratification-class → overseer executes only after spec-author
  ratification (= the external trigger). I do NOT merge / flip draft→ready. If planner.md changes again,
  re-verify + refresh.
