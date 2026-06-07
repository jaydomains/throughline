# Throughline — Auto-Continue Workflow

*The slice-chain auto-continuation ruleset. How chains advance, where they halt, what holds chain state.*

*Read alongside `SESSION_START.md` (discipline floor), `AUTHORING_DISCIPLINE.md` (the doc gates this rhythm sits inside), and `PLATFORM_STATUS.md` (current chain state surfaces here).*

---

## Premise

Throughline development runs as **slice chains**. A slice = one PR. A chain = an ordered sequence of slices delivering one phase or one coherent multi-phase workstream.

**Auto-continuation** means the chain advances slice-to-slice without per-slice user approval. The user approves the chain shape at plan-mode; the chain then runs to completion, halting only on the named halt conditions (see **Halt Classes**).

The rhythm has been running live since the Phase 18 / doc-authoring cycle but was not codified. This file codifies it.

---

## The Three-Layer Green Gate

A slice is mergeable only when **all three layers are simultaneously green**:

1. **Gitar review** — no open findings. Findings folded inline as additional commits on the same branch; no separate fix-round branches.
2. **CI** — `pnpm -r typecheck`, `pnpm -r test`, `pnpm -r lint`, and `pnpm -r build` all passing. The chain runner runs these four commands locally before opening the PR non-draft, and `.github/workflows/ci.yml` re-runs them on every push so the gate stays meaningful even when the chain runner skips the local pass. The CI workflow becomes an enforcing gate (vs an advisory one) only when set as a required status check in branch protection; until that repo-settings action lands, the local pre-PR pass is the load-bearing check.
3. **GitHub mergeable** — no merge conflicts; branch is up to date with base; no kill-switch pause signal present (see Kill Switch); no protected-branch blocker.

Two-of-three is not enough. Green-then-red is not green. The gate evaluates state at the moment of merge.

---

## The Slice Lifecycle

**A. Open the PR non-draft.** As soon as the slice's primary work is committed, the PR is opened non-draft. Non-draft is the explicit signal that polling begins. Draft PRs are not polled and do not consume chain state.

**B. Poll the green gate.** Once non-draft, the chain runner polls Gitar + CI + mergeable status every ~60 seconds. No polling ceiling — reviewer-takes-long-but-eventually-responds is normal flow, not a failure mode.

**C. Fix-round loop on findings.** Any non-green layer triggers a fix-round commit on the same branch:
   - Gitar finding → inline fold-in commit addressing the finding.
   - CI failure → commit addressing the root cause (not a re-run alone; if the root cause is flake, the flake itself is the finding).
   - Mergeability conflict → rebase / merge-base commit.

   Each fix-round increments the slice's fix-round counter in chain state. The same finding/failure surfacing for a third fix-round trips the **circuit breaker** (see Halt Classes).

**D. Merge on simultaneous green — dual-context method.** When all three layers are green at the same poll, the merge-executor merges the PR to the base branch. The **merge method is dual-context** (M-7; the parameter itself lives in `REQUIRED_READING.md §7`, which this section is the canonical prose for):

   - **Bare auto-continue chain-runner** — a single executor whose work is gated by Gitar + CI with *no* role-trio review → **merge commit**.
   - **Role-trio review cycle** — a producer (planner / executor) plus an independent auditor and overseer, the overseer executing the merge on three sign-offs at one content → **squash merge**. This holds **including when the trio is reviewing an auto-continue build-slice chain** (OQ-2, spec-author-ruled **squash** in the 2026-06 audit-remediation cohort): the distinguishing axis is **review-topology, not chain-automation** — a three-independent-sign-off trio squash-merges; the bare runner merge-commits.

   Rebase is not used in either context. The handover commit is the final commit of the slice and lands before merge.

   *(This replaces the former invariant "every PR on `main` lands as a two-parent merge commit; squash and rebase are not used," which M-7 found empirically false — the Phase-E build chain and the role-file trio chains were squash-merged. The two contexts are deliberately different and must not be conflated.)*

**E. Auto-advance to the next slice.** On merge:
   - The chain state file's `currentIndex` increments.
   - Kill-switch signals are checked (see Kill Switch).
   - If clear: the runner opens the next slice's branch and PR. Plan-mode approval is not re-requested for slices inside an approved chain.
   - If a halt signal is present: chain halts in the appropriate state and surfaces.

---

## Canonical Chain Rhythm — one PR per slice

The canonical chain rhythm is **one PR per slice**. A non-draft PR opens as soon as the slice's code is locally complete, so the three-layer gate (Gitar review + CI green + GitHub-mergeable) can run continuously as commits accumulate on that slice's branch. Each slice merges only when its gate is simultaneously green; the next slice's branch opens off the now-updated `main` and the cycle repeats.

**The violation to prevent:** pushing multiple slices to a single branch without ever opening a PR per slice — bypassing the gate, the review, and spec-author visibility entirely. Phase C+D's recovered violation is the motivating example: slices 1 and 2 were committed to `claude/awesome-carson-j3wel` without per-slice PRs opening, bypassing the canonical rhythm; recovery required opening retroactive PRs to restore gate verification.

---

## Halt Classes

These are the **only** legitimate reasons a chain stops. Anything else is a bug in the runner. Classes **1–3** are the long-standing codified set. Classes **4–9** are the **Phase-E blessed extensions** — spec-author-blessed **2026-05-30** as sanctioned operating practice (`plans/2026-05-30-phase-e-full-audit-close.md:202`), and absorbed into this canonical doc here per that plan's own deferral ("halt-class extensions 4–9 absorbed into `AUTO_CONTINUE_WORKFLOW.md` by the cohort hardener"; M-8). Each extension below traces to that blessed definition; no class is codified that lacks one.

**The codified three:**

1. **Spec drift.** Work-in-progress on the slice touches behaviour the spec does not sanction. Halt immediately, surface to the spec author. The fix is either a SPEC update or a code rollback — never patching the code silently to absorb the drift.

2. **Circuit breaker.** Three fix-rounds for the same finding/failure on the same slice. Halt, surface, do not push a fourth fix-round. Three rounds without convergence indicates the slice is mis-sized, mis-specified, or mis-understood — none of which a fourth blind commit will fix.

3. **Explicit user pause.** The kill switch (any-of signal) is detected at a slice boundary. Halt, record the pause reason if available, await user resumption.

**The Phase-E blessed extensions (4–9)** — all from `plans/2026-05-30-phase-e-full-audit-close.md:202` (blessed 2026-05-30):

4. **Estimate breach.** A slice's actual diff exceeds its LOC band by more than 50% → halt, re-slice. (Fired live in Phase E at E3 and E17a — `audits/2026-05-31-phase-e-execution-audit-1.md:91`.)

5. **Unplanned anchor.** A slice needs a T-D / C-D anchor beyond those its plan sanctioned → halt, surface — never silently mint. (Fired at E20a.)

6. **Test regression.** A slice reds a previously-green test it did not intend to touch → halt. This is the halt-class form of the *CI-flake-is-a-finding* rule (Supporting Rules): a reddened/flaky test is root-caused or quarantined with an explicit anchor, never re-run-until-green.

7. **Doc-PR collision.** `main` carries an open PR touching a rolling shared doc at a slice boundary → halt. The full mechanics live in *Concurrent Doc-PR Collision* below; this is its halt-class label.

8. **Out-of-audit silent-failure.** A silent-failure pattern outside the slice's own audit scope surfaces mid-slice → flag it for the *next* audit cycle; do **not** expand the current slice to absorb it.

9. **Blessed decision-gate.** A *planned* mid-chain halt where the chain stops for an explicit spec-author ruling (Phase E's E17 product-decision gate was the canonical instance); any "build" rulings append new slices. It is priced into the plan, distinct from an ad-hoc stop.

> **Codification provenance (M-7/M-8 — B1).** Extensions 4–9 were proposed by the Phase-E planning track and **blessed by the spec author before chain-open** (2026-05-30), but their codification into this doc was deferred to the chain-close hardener to avoid editing the workflow doc while a chain ran against it (the recursive doc-PR-collision problem — class 7 itself). This slice (audit-remediation B1) lands that deferred codification. The labels here follow the **canonical blessed source** (`full-audit-close.md:202`); they supersede any imprecise interim restatement of the set.

Reviewer-stall is **not** a halt class. A long-running Gitar review is normal; the runner waits indefinitely. If "indefinitely" is the wrong answer for a specific chain, the user pauses explicitly via the kill switch.

---

## Kill Switch (any-of)

Two canonical signals are checked at slice boundaries (post-merge, pre-next-slice-open). Any one present = halt:

1. **Marker file** at `.claude-code/auto-continue-pause`. Contents optional; presence alone is the signal. Lives in `.claude-code/` alongside the chain state file — Throughline-build tooling namespace, distinct from user-facing `.throughline/` config (per T-D51 namespace discipline).

2. **PR/issue comment** beginning with `/pause`. Any commenter; first comment matching the prefix in the active PR's thread (or the tracking issue's thread, between slices) is sufficient. The comment body after `/pause` is captured as a pause reason if present.

Both signals are equivalent — `any-of` semantics. Resuming requires removing the active signal(s) and the user re-running the chain command.

**Optional / future:** a `throughline:pause` label on the chain's tracking issue or the active slice PR. Each chain has a long-lived GitHub issue titled `Auto-continue: <chainId>` opened at chain start and closed at chain end; that issue is the durable label-bearing surface. The label was the original primary mechanism — but across the Phases 19/20/21/22 build cohort the label was never actually created in the `jaydomains/throughline` repo (five passes through the gap in successive PLATFORM_STATUS rolls), and all four chains ran end-to-end clean on the marker file + `/pause` comment signals alone. The 2026-05-28 cohort-level heavy hardener pass formally accepted-and-demoted the label per the PR #43 Session-1-handover-gap adjudication precedent: the label remains a valid third signal if the repo carries it, but the two canonical signals above are sufficient by themselves. Chains that need the label can re-promote it without doc surgery — apply the label, the runner picks it up; the demotion is a documentation reality check, not a behaviour change.

---

## Chain State Persistence

Single JSON file at `.claude-code/auto-continue-state.json`. Matches the SiteMesh parallel-build pattern: Throughline-build tooling lives in `.claude-code/`, distinct from the user-facing `.throughline/` config namespace (T-D51).

Schema (informal):

```
{
  "chainId": "phase-19-clone-and-go",
  "chainOpenedAt": "<ISO 8601>",
  "trackingIssue": 42,
  "slices": [
    { "id": "slice-1-cli-skeleton", "status": "merged",  "prNumber": 43, "fixRounds": 0, "mergedAt": "<ISO>" },
    { "id": "slice-2-init-endpoint",  "status": "open",    "prNumber": 44, "fixRounds": 1, "lastFinding": "..." },
    { "id": "slice-3-config-loader",  "status": "pending", "prNumber": null, "fixRounds": 0 }
  ],
  "currentIndex": 1,
  "lastPollAt": "<ISO 8601>",
  "haltReason": null
}
```

State writes are atomic (write-temp + rename). The file is committed to the repo so chain state survives session restart and is visible in `git status` / PR diffs. Per-slice fix-round counters and `haltReason` are how the circuit breaker and halt classes mechanically arm themselves. The `trackingIssue` field links to the chain's GitHub tracking issue (where the durable `throughline:pause` label lives).

---

## Slice-Sizing Rules

The chain rhythm assumes well-sized slices. Mis-sized slices trip the circuit breaker.

- **One coherent concern per slice.** "Coherent" = a reviewer could write a one-sentence description of what the slice does without using the word "and".
- **Sized so three fix-rounds is rare.** If your typical slice trips the circuit breaker, the slices are too big or too vague — not "raise the breaker to five rounds".
- **3–6 slices per phase** is the working norm. Phases that come in at one giant slice or fifteen tiny slices are both signals to re-plan.
- **Slice boundaries are PR boundaries.** No batching two slices into one PR; no splitting one slice across two PRs.
- **The handover is the slice's final commit.** No exceptions. A merged slice without a handover is a chain-rhythm break and surfaces in the next cohort hardener pass.

---

## Supporting Rules

- **Gitar findings fold inline on the original branch.** Not new branches, not a "fix-round-1" rebranching pattern. Inline fold-ins keep PR history readable and keep the slice atomic.
- **Mid-slice spec drift triggers a halt, not a fix commit.** Even if a one-line code change "would solve it" — that one-line change is silent spec drift, which is exactly what the discipline floor exists to prevent.
- **CI flake is treated as a finding.** If a test is flaky, the flake is the issue, not the failed run. Either stabilise the test (root cause) or quarantine it with an explicit anchor — never re-run-until-green.
- **Plan-mode approval is per-chain, not per-slice.** The user approves the chain at chain-open. Slices inside an approved chain run without re-approval. New chains or chain-shape changes require plan-mode re-entry.
- **PLATFORM_STATUS.md is updated as the final write of every slice's session.** Before the handover commit, before merge. See `AUTHORING_DISCIPLINE.md` post-work gate.
- **Tracking-issue progress log is updated post-merge.** After each slice merges, the chain's tracking issue body is updated with the slice ID, PR number, merge timestamp, and final fix-round count. The issue is closed when the chain completes.

---

## Concurrent Doc-PR Collision

Auto-continue chains rewrite **rolling shared docs** every slice — chiefly `PLATFORM_STATUS.md` (Snapshot / Current Phase / Recent Slice History / Locked Decisions), and `AUTHORING_DISCIPLINE.md` / `SESSION_START.md` when a slice touches them. A doc-only PR left open against one of those files while a chain runs collides: the chain's per-slice rewrites either make the doc-PR redundant or force it base-stale into regressive territory (observed live in the Phase B overnight run — PR #71's PLATFORM_STATUS reconciliation was made fully redundant by four successive per-slice rewrites and closed without merge; the README PR #70, an own-file change no slice touched, merged cleanly).

**The file-class distinction:** own-file PRs (a PR that is the sole writer of its file, e.g. `README.md`) only go base-stale and a merge fixes them — they do not collide. Rolling-shared-doc PRs collide.

**Mitigation (either is sufficient):**
1. **Land first.** Merge any rolling-shared-doc PR *before* spawning the chain.
2. **Pause for it.** If such a PR is open when the chain would start or advance, hold the chain (pause marker / `/pause` comment) until it merges.

This is a **chain-runner halt condition**: at chain-open and at every slice boundary, if `main` carries an open PR touching a rolling shared doc, the runner halts and surfaces rather than racing it.

## Merge-on-Green Polling

The poll loop (Slice Lifecycle B) runs at a **~60-second cadence with no ceiling**, and merges only when **all three gate layers are green at the same poll** — never on a two-of-three or a green-then-red reading. A reviewer or CI run taking long is normal flow, not a failure; the runner waits rather than forcing a merge. This reinforces, not replaces, the Three-Layer Green Gate above. Subscriptions push failures and review comments; clean CI-green does not reliably generate a wake event. Merge-on-green is poll-driven, not subscription-driven.

---

## Pre-Flight State Verification

Pre-flight and chain-open findings about canonical-file state — "X file is missing", "Y section is absent", "Z anchor is unminted" — must be verified against the **live repo tree** (and live `DECISIONS.md` / `CODE_SPEC.md`), never inherited from a prior session's compacted context summary. Compaction can carry a stale or wrong claim forward across sessions: the audit-fix Phase C+D arc inherited a wrong "`SESSION_START.md` is missing" claim through compacted context and propagated it into successive `PLATFORM_STATUS.md` rolls, even though the file was present at the repo root the whole time. Before acting on any "missing/absent" precondition — and before recording one in a rolling shared doc — `ls` / grep the live tree to confirm.

---

## Two-Party Review Loops and Spec-Author Merge Authority

The slice-chain gate above assumes a single executor whose work is checked by automated review (Gitar) + CI. A second, distinct mode runs alongside it: **two-party review loops** — planner↔auditor, author↔auditor, executor↔reviewer — where one role-prompted session produces a draft and an *independent* session adversarially audits it. These are the loops the `counterpart-change-detector` skill exists to drive. They have their own merge governance, and it must be **explicit**, because the implicit version was relied on once and only worked by luck of a good audit.

**The intended convergence shape** (as briefed) was: both sessions sign off via a final-marker commit + approval comment; the PR stays draft throughout; the spec author rules on merge. That presumes the author session *engages the audit* — folds findings or pushes back — and the two converge.

**What actually happened (PR #117, the detector skill's own authoring).** The author session went silent: it never responded to either round of the independent audit and never pushed a revision. The convergence round did not happen. The spec author merged the draft directly, on the strength of the independent audit, which had substantively cleared the skill (transportability, the four load-bearing rules, and script correctness all verified). The merge was **defensible** — the audit, not the absent author handshake, was the thing that cleared the work — but it executed a merge authority the "done" definition never stated, and it shipped with audit findings uncovered (folded later as a post-merge follow-up; see the follow-up PR referencing #117 and the Phase E audit PR #116).

**The rule, made explicit:**

1. **The spec author may merge a draft under independent audit once the audit substantively clears it — even if the counterpart/author session has not signed off.** A silent or stalled counterpart is *not* a halt condition for the spec author's merge decision (mirroring "reviewer-stall is not a halt class" for the chain runner). The independent audit is the clearing instrument; the author handshake is desirable, not load-bearing.
2. **Uncovered findings at merge are tracked as explicit follow-up**, not dropped. A follow-up PR (or tracked issue) referencing the merged PR captures every finding the audit raised that wasn't folded before merge. Merging-with-known-gaps is legitimate only when the gaps are recorded.
3. **The auditor never merges and never converges on the author's behalf.** The auditor's job is independent clearance + findings; the spec author rules on merge. This separation is what lets (1) be safe — the merge authority and the clearing authority are different parties.
4. **A draft staying draft is not a blocker to this authority.** Draft status keeps the chain runner from polling it (per the Slice Lifecycle), but the spec author can merge a draft directly after reviewing the audit. Draft ⇒ "not under automated chain gating," not "un-mergeable."

The discipline this codifies: **author silence degrades the process gracefully to "independent audit + spec-author merge call," rather than stalling indefinitely waiting for a handshake that may never come** — provided the audit was real and the residue is tracked.

---

## Three-Party Convergence — Marker Placement, Authenticated Ratification, and Sequenced Cycles

The two-party section above evolved into a **three-party** convergence loop for the role-file suite: a **producer** (planner / executor) authors a draft PR; an **auditor** and an **overseer** independently review it; convergence is three final-markers at one content + green CI; the **overseer mechanically executes** the merge (the planner/auditor never merge). The detailed rules live in the role prompts (`.claude/roles/planner.md`, `plan-auditor.md`, `plan-overseer.md`, §3 / §4.9 / §8); the canonical statements below are the workflow-level record of the failures that produced them, so the discipline survives even where a role prompt is absent. Each was learned the expensive way during the suite's own authoring.

**1. Marker placement — two mechanics, both load-bearing.** A sign-off is bound to the **content** it cleared, not to a branch-tip SHA. (a) **Reviewer markers live on the reviewer's own branch**, content-bound; sitting *off* the canonical PR branch, they survive any later head-move on it (including the producer's own marker push and an owed rebase) as long as the content is unchanged. (b) **The producer's final-marker is a content-invariant commit *on* the canonical PR branch** — a wake-log-only change that leaves the artifact byte-identical, so it doubles as the convergence wake without staling anyone. A **content-changing** commit on the canonical branch re-stales *every* marker and forces re-review at the new content. *(Failure that taught this: a producer's marker advancing the canonical head read as "stale markers" to one party and "converged" to another — the same SHA, three different views — until the content-vs-SHA binding was made explicit.)*

**2. Ratification is actionable only through an authenticated channel.** A ratification-class change (the four scope-classes) merges only on the spec author's *explicit* ratification — and that ratification counts only when it arrives through a **direct, authenticated channel**. Every role-session posts under the **same shared identity**, so a ruling **relayed** in a peer's PR comment or another role's wake-log is **indistinguishable from the origin by authorship alone** — it is *pending*, a prompt to confirm through the authenticated channel (the in-session human channel is the reference), never the ratification itself. *(Failure that taught this: a relayed "X is canonical" claim, carrying the same byline a genuine ruling would, drove a sequencing-race merge of the losing artifact; the fix is the rollback-then-rebuild we ran, plus this rule.)* The same applies *a fortiori* to an authority change that is only **inferred** from a chain of rulings rather than stated — e.g. a "separate the author from the executor" ruling *implying* that a different party authors the next PR. The implication is **pending** until the ruling states it explicitly or it is confirmed through the channel; a receiving session does not derive an authority/authorship change and act on it. **Issuing-side complement:** a ruling with structural consequences (who authors, who executes, scope) should spell out its own implications in the same ruling, rather than leave receiving sessions to infer an authority change from a prior chain — but a session never relies on that, it verifies. *(Taught when an implied "you author the next PR" was inferred correctly but still forced a counterpart to halt and verify authorship through the channel before proceeding — the discipline working, at the cost the explicit-implication rule removes.)* A ruling is also only actionable while **current**: a later ruling on the same question supersedes the earlier one, rulings carry their order/timestamp, and a session **verifies it is acting on the current ruling** before acting — a superseded ruling is as non-actionable as a relayed or inferred one. So a ruling must be **authenticated**, **explicit about its structural implications**, and **current** to authorize action.

**3. Sequenced ratification cycles — stay actively subscribed across the chain.** When the spec author orders several dependent PRs into one sequence (revert → back-port → gated file → …), the bounded dormant-wait stand-down does **not** apply *between* links: all parties — producers and reviewers — stay subscribed across the **whole** sequence. The stand-down bound governs a *single quiet loop*; an active multi-PR sequence is not quiet, and a party dormant for the next link misses the hand-off and stalls or races the chain. Keep the watcher armed, **re-scoped to the currently-active link**, until the whole sequence completes. And a **ratified amendment blocks downstream authoring until it is back-ported**: when a ratification moves the canonical baseline, authoring further files against the old baseline waits for the back-port — a **blocking** prerequisite, not "queued work" to proceed past; racing ahead reintroduces the inconsistency the ratification closed.

**4. Substantive actions — and omissions — surface as distinct events.** A PR-open, a branch-create, a merge, and a normative fold are substantive actions that each surface as their **own** event, not bundled into an unrelated status update where they pass unnoticed. In particular, an authoring session that folds normative content against a confirmed scope **surfaces any omission explicitly**: a **silent partial-fold** — shipping part of a ratified scope as if it were the whole — recreates the exact inconsistency the amendment exists to prevent (some files carry a rule, others silently do not), and is otherwise caught only by a reviewer's completeness check against scope. *(Taught when a fold of an eight-item ratified scope silently carried only part of it; the reviewer caught the gap, and the scope had to be re-confirmed before convergence.)*

**5. Persistence & dormancy — the watcher *records*, sessions *resume from durable state*.** Long-running sequenced cycles span dormancy that no in-session poll survives; four disciplines make that survivable, and they are codified in the role prompts' §3 / §4 and the `counterpart-change-detector` skill.
- **(a) Proactive ~25-min re-arm.** A session running a watcher re-arms *before* the ~30-min background cap (~25 min), not only on the stop/timeout — continuous coverage rather than a gap at every lapse. *(Validated live: a session sustained unbroken watcher coverage this way across this suite.)*
- **(b) The watcher is a record-keeper, not a notifier — detection is not awareness.** It detects ref-moves and logs them but does **not** guarantee it wakes you (a notification can be dropped, batched, or lost to a reaped/dormant session). On every external trigger / re-engagement / wake, read the **watcher log** *and* a fresh **`git ls-remote`** before trusting any internal model of state; the durable record, not the wake event, is ground truth. *(Fundamentally a property of the watcher/skill: detection is logging, not a guaranteed wake.)*
- **(c) Long-term dormancy is the normal case.** Multi-hour-to-multi-day dormancy between external triggers is expected, not exceptional — sessions design for it: durable state in the wake-log, and a fresh dispatch that reads that state and resumes. The §4.9 "bounded stand-down" governs minutes-to-hours within a single live loop; this extends the horizon to hours-to-days *between* triggers.
- **(d) "Active subscription" is honestly scoped.** In a sequenced cycle (finding 3), "stay actively subscribed" means *polling via the ~25-min re-arm cadence with a watcher-log + `git ls-remote` read on every wake* — **not** "a session staying alive without explicit re-arm." Sequenced sessions cannot self-wake; each link requires an explicit external trigger, and "subscription" is a discipline each freshly-triggered session re-establishes, never a continuously-conscious session.

*(Codified after a producer session went dormant mid-suite and a piece of the sequencing/amendment state was itself lost across a compaction boundary — the persistence rules exist precisely so loop state lives in durable records, not session memory.)*

**Operational disciplines (same origin, codified in the role prompts' §3 / §4):**
- **Self-exclude exact-match.** Anchor the watcher's `SELF_EXCLUDE` to your **exact** branch name, never a substring — an over-broad token silently swallows a counterpart branch whose name *contains* it, hiding the very ref you must watch.
- **Cross-PR redirect re-scope.** When the work moves to a different PR/branch, re-scope the watcher to the now-active branch; one still aimed at the parked branch is blind to where the work went. (A ref-watcher is also blind to comment-only replies — read the PR comments on every wake.)
- **Cite a SHA only after reading it back.** Read a marker's SHA from the actual push (`git rev-parse` / push output) before quoting it anywhere; a SHA written from memory or anticipation produces wrong-SHA citations that must be corrected on the record.
- **No in-session self-wake survives extended dormancy.** The re-armed poll dies at the runtime cap and does not survive container reclamation; durable resumption rides an **external trigger** plus the wake-log, never the poll. (Codified from cycle 1; reinforced here because the sequenced-cycle posture above is the case where you do *not* stand down.)
- **Wake-channel reliability has an empirical ranking — don't assume parity.** Measured this suite: a ref-moving commit wakes the watcher (but is blind to comment-only replies); an **inline review-comment** wakes a live-but-quiet session more reliably than an **issue-comment** (which has repeatedly failed to wake one); a **fully-dormant / reaped** session is reachable only by **re-dispatch** (an external trigger), by no in-PR channel. Drive wakes with the wake-log first, prefer an inline review-comment over an issue-comment when a comment must land, and never rely on an issue-comment alone.

---

## Cross-references

- `SESSION_START.md` — reading order, discipline floor, spec-drift policy.
- `AUTHORING_DISCIPLINE.md` — the pre-work and post-work doc gates that bookend every slice; the four-tier status taxonomy this rhythm advances projects through.
- `PLATFORM_STATUS.md` — current chain state surfaces here at every session sign-off.
- `HANDOVER_TEMPLATE.md` — the handover-is-final-commit rule's authoring template.
- T-D51 — `.throughline/` user-facing namespace, the namespace discipline that places chain state in `.claude-code/` instead.
