# Throughline — Auto-Continue Workflow

*The slice-chain auto-continuation ruleset. How chains advance, where they halt, what holds chain state.*

*Read alongside `SESSION_START.md` (discipline floor), `AUTHORING_DISCIPLINE.md` (the doc gates this rhythm sits inside), and `PLATFORM_STATUS.md` (current chain state surfaces here).*

---

## Premise

Throughline development runs as **slice chains**. A slice = one PR. A chain = an ordered sequence of slices delivering one phase or one coherent multi-phase workstream.

**Auto-continuation** means the chain advances slice-to-slice without per-slice user approval. The user approves the chain shape at plan-mode; the chain then runs to completion, halting only on three named conditions.

The rhythm has been running live since the Phase 18 / doc-authoring cycle but was not codified. This file codifies it.

---

## The Three-Layer Green Gate

A slice is mergeable only when **all three layers are simultaneously green**:

1. **Gitar review** — no open findings. Findings folded inline as additional commits on the same branch; no separate fix-round branches.
2. **CI** — typecheck, test suite, lint, and build all passing.
3. **GitHub mergeable** — no merge conflicts; branch is up to date with base; no `throughline:pause` label; no protected-branch blocker.

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

**D. Auto-merge on simultaneous green.** When all three layers are green at the same poll, the runner merges the PR to the base branch using a **merge commit** (Throughline's repo norm — every prior PR on `main` lands as a two-parent merge commit; see `git log main --merges --first-parent`). Squash and rebase strategies are not used. The handover commit is the final commit of the slice and lands before merge.

**E. Auto-advance to the next slice.** On merge:
   - The chain state file's `currentIndex` increments.
   - Kill-switch signals are checked (see Kill Switch).
   - If clear: the runner opens the next slice's branch and PR. Plan-mode approval is not re-requested for slices inside an approved chain.
   - If a halt signal is present: chain halts in the appropriate state and surfaces.

---

## The Three Halt Classes

These are the **only** legitimate reasons a chain stops. Anything else is a bug in the runner.

1. **Spec drift.** Work-in-progress on the slice touches behaviour the spec does not sanction. Halt immediately, surface to the spec author. The fix is either a SPEC update or a code rollback — never patching the code silently to absorb the drift.

2. **Circuit breaker.** Three fix-rounds for the same finding/failure on the same slice. Halt, surface, do not push a fourth fix-round. Three rounds without convergence indicates the slice is mis-sized, mis-specified, or mis-understood — none of which a fourth blind commit will fix.

3. **Explicit user pause.** The kill switch (any-of signal) is detected at a slice boundary. Halt, record the pause reason if available, await user resumption.

Reviewer-stall is **not** a halt class. A long-running Gitar review is normal; the runner waits indefinitely. If "indefinitely" is the wrong answer for a specific chain, the user pauses explicitly via the kill switch.

---

## Kill Switch (any-of)

Three signals are checked at slice boundaries (post-merge, pre-next-slice-open). Any one present = halt:

1. **Marker file** at `.claude-code/auto-continue-pause`. Contents optional; presence alone is the signal. Lives in `.claude-code/` alongside the chain state file — Throughline-build tooling namespace, distinct from user-facing `.throughline/` config (per T-D51 namespace discipline).

2. **`throughline:pause` label on the chain's tracking issue.** Each chain has a long-lived GitHub issue titled `Auto-continue: <chainId>` (e.g. `Auto-continue: phase-19-clone-and-go`) opened at chain start and closed at chain end. The tracking issue is the durable label-bearing surface — it persists across the chain's entire lifetime, ready to carry the `throughline:pause` label whenever the user applies it. Applying the label is the halt signal; removing it (alongside the user re-running the chain command) is the resume. This solves the between-slice edge case where no PR is currently open. The issue body doubles as a live progress log, updated after each slice merge (slice ID, PR number, merge timestamp, fix-round count). Chains become discoverable via the GitHub issue list filtered by the `auto-continue` label. The same `throughline:pause` label may also be applied to the currently-open slice PR as a transient signal during a single slice — both forms are valid; the tracking-issue label is the durable signal, the PR label is convenience.

3. **PR comment** beginning with `/pause`. Any commenter; first comment matching the prefix in the active PR's thread (or the tracking issue's thread, between slices) is sufficient. The comment body after `/pause` is captured as a pause reason if present.

All three signals are equivalent — `any-of` semantics. The `throughline:` namespace prefix on the label avoids conflicts with other tooling. Resuming requires removing the active signal(s) and the user re-running the chain command.

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

## Cross-references

- `SESSION_START.md` — reading order, discipline floor, spec-drift policy.
- `AUTHORING_DISCIPLINE.md` — the pre-work and post-work doc gates that bookend every slice; the four-tier status taxonomy this rhythm advances projects through.
- `PLATFORM_STATUS.md` — current chain state surfaces here at every session sign-off.
- `HANDOVER_TEMPLATE.md` — the handover-is-final-commit rule's authoring template.
- T-D51 — `.throughline/` user-facing namespace, the namespace discipline that places chain state in `.claude-code/` instead.
