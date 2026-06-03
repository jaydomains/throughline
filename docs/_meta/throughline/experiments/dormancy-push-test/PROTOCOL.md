# Dormancy push-delivery test — protocol

**Purpose.** Empirically determine whether a GitHub **PR-activity push subscription** wakes a
**dormant, subscribe-only** session across three dormancy windows. This settles whether the
six role files (and the `counterpart-change-detector` skill) may document a push subscription
as anything stronger than a *latency optimization*.

**Why this exists.** During the planner role-file audit (PR #119), all three live sessions
(planner, plan-auditor, plan-overseer) observed that a re-armed poll dies across dormancy, and
that a push subscription did **not** demonstrably wake them either — but with both instruments
armed, "push didn't fire" could not be cleanly isolated from "the poll woke me first." This test
removes the poll so push is the **only** wake mechanism, and measures it directly.

**Default disposition unless this test refutes it:** push = latency-only, never relied on for
dormancy survival (per spec-author ruling). A positive result here is what would license
*upgrading* that language, via a separate follow-up PR — **not** a revision to `planner.md`.

---

## Roles

- **Subject session** — a dedicated, throwaway session whose *only* job is to be a clean
  dormancy test subject. It runs the Subject Runbook below. It is **not** a role-loop session.
- **Orchestrator** — the human / dispatching layer. Posts the trigger comments, performs the
  forced container reclaim for window (c), and records negative (no-wake) outcomes that a
  non-running subject cannot self-report.

---

## Hard rules for the subject (read first — violating any of these invalidates the run)

1. **Arm NO poll.** No `Monitor`, no background `Bash`, no `counterpart-change-detector`, no
   `until`/`while` loop, no self-scheduled check of any kind. The push subscription must be the
   **only** thing that can wake you. A single armed poll confounds the entire test.
2. **One subscription, one PR.** Subscribe only to this test PR. Do not subscribe to anything
   else.
3. **Genuinely idle during quiet windows.** End your turn and wait. Do **not** "just check"
   GitHub during a quiet window — a manual check is a manual wake and confounds the result.
4. **Self-report positives; orchestrator reports negatives.** If you wake, you record it. If you
   do **not** wake, you are by definition not running and cannot record it — the orchestrator
   records that from the outside after the tolerance expires.
5. **Durability.** Every state transition is written to `RESULTS.md` and **committed to this
   branch** before you end a turn, so a fresh/reclaimed session can reconstruct where it was.

---

## The three measurement windows

| Window | Dormancy condition | Idle duration before trigger | Trigger comment tag |
|--------|--------------------|------------------------------|---------------------|
| **A** | Past the ~30-min runtime cap | ≥ **35 min** (clears the ~30-min cap with margin) | `[DORMANCY-TEST A]` |
| **B** | Overnight / multi-hour quiet | ≥ **8 h** (overnight) | `[DORMANCY-TEST B]` |
| **C** | Forced container reclamation | until orchestrator reclaims, then comment | `[DORMANCY-TEST C]` |

Windows run **in order A → B → C** within the subject's lifecycle. C is **last** because it
destroys the container.

### Trigger comment format (orchestrator posts these)

```
[DORMANCY-TEST <A|B|C>] nonce=<random> posted_at=<UTC ISO-8601>
```

The subject reads the authoritative post time from the GitHub comment's `created_at` (not from
the body text), and matches the window by the tag + nonce.

---

## Verdict definitions (timing tolerances)

Let `latency = T_wake_observed − T_comment_posted` (using the comment's `created_at` as
`T_comment_posted`, and the moment your `<github-webhook-activity>` event fired as
`T_wake_observed`).

| Verdict | Condition |
|---------|-----------|
| **WOKE** | A `<github-webhook-activity>` push event delivering the tagged comment fired with `latency ≤ 5 min`. |
| **DELAYED** | Such an event fired with `5 min < latency ≤ 30 min`. |
| **DID-NOT-WAKE** | No such event by `T_comment_posted + 30 min` (windows A, C) or by the orchestrator's next-morning check (window B). Recorded by the **orchestrator**. A subject that resumed only because a human re-prompted it also records **DID-NOT-WAKE** (note: "resumed via manual re-prompt, no push event"). |

"Push" here means the harness delivered the subscribed comment as an event **without** any poll
armed. Resumption via manual re-prompt or via reading the branch is explicitly **not** a push
wake.

---

## Subject Runbook (executable without further input)

> Timestamps are UTC ISO-8601 (`date -u +%Y-%m-%dT%H:%M:%SZ`). After every step that writes
> `RESULTS.md`, `git add … && git commit && git push` so the state is durable.

**Step 0 — Intake.** Read this PROTOCOL.md fully. Confirm you are the subject and will arm **no
poll**. Read `RESULTS.md`; if rows already exist (you are a resumed/reclaimed session),
reconstruct your position from the last committed row rather than starting over.

**Step 1 — Subscribe.** Record `T_subscribe`. Call `subscribe_pr_activity` on **this** test PR.
Write the `SUBSCRIBED` row to `RESULTS.md` (incl. `T_subscribe`, "poll armed: NONE"). Commit.

**Step 2 — Window A.**
  - Write `IDLE-START A @ <UTC>` to `RESULTS.md`. Commit. **End your turn.** Do nothing else.
  - **On wake:** if a `<github-webhook-activity>` event delivers `[DORMANCY-TEST A]`, immediately
    read its `created_at`, compute `latency`, classify the verdict, and write the Window-A row
    (`T_comment_posted`, `T_wake_observed`, `latency`, verdict, "wake source: push event").
    Commit. Go to Step 3.
  - **If a human re-prompts you** (no A event in your context): write Window-A verdict
    **DID-NOT-WAKE** ("resumed via manual re-prompt"). Commit. Go to Step 3.

**Step 3 — Window B.** Same shape as A, but the idle window is overnight (≥ 8 h). Write
  `IDLE-START B @ <UTC>`, commit, end turn. On wake (or manual re-prompt) record the Window-B
  row exactly as in Step 2. Commit. Go to Step 4.

**Step 4 — Window C (forced reclamation).**
  - Write `CHECKPOINT-C: subscribed, idle, awaiting reclaim @ <UTC>` to `RESULTS.md`. Commit.
    **End your turn.** This is the instrumented pause point the orchestrator waits for.
  - The orchestrator then **forces a container reclaim**, and afterwards posts
    `[DORMANCY-TEST C]`.
  - **If a session wakes** delivering the C comment: record Window-C row (verdict + latency +
    "wake source: push event after reclaim"). Confirm your pre-reclaim in-memory context was lost
    (expected) and that you could only reconstruct position by reading `RESULTS.md` from the
    branch — note that. Commit.
  - **No-wake for C** is recorded by the **orchestrator** (a reclaimed, non-running subject
    cannot self-report).

**Step 5 — Finalize.** Ensure `RESULTS.md` has a verdict for all three windows and the summary
  block filled. Stop. The findings are then lifted into a **separate follow-up PR** (per ruling);
  this throwaway PR/branch is disposable and may be closed/deleted afterward.

---

## Orchestrator checklist

1. Dispatch the subject session pointed at this branch + PR; instruct it to run the Subject
   Runbook. Do not arm anything on its behalf.
2. **Window A:** after the subject commits `IDLE-START A`, wait until `IDLE-START A + 35 min`,
   then post the `[DORMANCY-TEST A]` comment. If no subject activity by `+30 min` after posting,
   record **DID-NOT-WAKE (A)** in `RESULTS.md` and manually re-prompt the subject to continue to B.
3. **Window B:** after `IDLE-START B`, wait ≥ 8 h (overnight), post `[DORMANCY-TEST B]`. Check
   next morning; record verdict (incl. DID-NOT-WAKE if no wake) and re-prompt to continue to C if
   needed.
4. **Window C:** after the subject commits `CHECKPOINT-C`, **force the container reclaim**, then
   post `[DORMANCY-TEST C]`. Check for subject wake within `+30 min`; if none, record
   **DID-NOT-WAKE (C)**.
5. Confirm `RESULTS.md` is complete; open the separate findings follow-up PR.

---

## Interpreting the result (what each outcome means for the role files)

- **A, B, C all WOKE** → push survives in-session dormancy *and* container reclamation. This
  refutes the conservative default: a follow-up PR may upgrade the role files / skill to document
  push as a genuine dormancy backstop (not just latency).
- **A, B WOKE but C DID-NOT-WAKE** → push survives in-session dormancy but not reclamation.
  Document push as a within-session latency/dormancy aid that does **not** survive reaping; keep
  the asymmetric-stand-down + F6 path as the reaping-survival mechanism.
- **Any of A/B DID-NOT-WAKE** → push is not even a reliable in-session dormancy instrument; the
  conservative default stands unchanged (push = latency-only) or push is dropped as a documented
  backstop entirely.

Whatever the outcome, it lands as a **separate follow-up PR**; it does not gate or modify the
planner role file’s convergence on #119.
