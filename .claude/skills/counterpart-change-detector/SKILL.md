---
name: counterpart-change-detector
description: >-
  Reliably wait for and react to an asynchronous counterpart — a peer reviewer, another
  agent, or a human collaborator — who pushes commits or posts comments to a shared git
  branch or pull/merge request. Use in any back-and-forth role that must self-wake on the
  other party's activity: peer or two-party review/audit loops, planner↔auditor or
  executor↔reviewer handoffs, "babysitting"/monitoring someone else's PR or branch, or any
  "poll until the counterpart responds" task. Provides a transportable, parameterized
  two-arm `git ls-remote` poll loop (targeted branch tip + broad new-ref scan), a self-echo
  filter so your own pushes don't wake you, and — load-bearing — the mandatory on-wake
  comment-read step, because a branch watcher is blind to comment-only replies. Prefer this
  over sleeping/spin-polling or assuming a subscription will catch everything.
---

# Counterpart-change detector

A discipline + a script for the recurring problem in asynchronous two-party agent loops:
**you must keep working/idle until the other party acts, then react promptly — without
spin-polling, and without missing anything.**

The other party signals in two channels that need **different instruments**:

- **Commits** (a branch tip moves) — cheap to detect by polling refs.
- **Comments / reviews** (a reply with no commit) — *invisible* to a ref watcher.

The single most important rule in this skill: **the watcher tells you _that_ something
changed; it never tells you _what_. So every wake is paired with a comment+diff read.** A
ref watcher used alone will silently miss every reply-only round.

## When to use

- Peer review / two-auditor / planner↔auditor / executor↔reviewer loops.
- Watching a PR/MR you opened for CI, review comments, or a counterpart's pushes.
- Any role told to "wait for X, then respond," where X is another party's git activity.

## When NOT to use

- You control both sides synchronously (just do the next step).
- A reliable push subscription exists for *all* the events you care about (use it). Note:
  in practice subscriptions often deliver failures/comments but **not** clean-green or
  silent progress — if in doubt, poll.
- You only need a single "is it done yet" check (one `git ls-remote` call, no loop).

## Mechanism — two arms

Run `scripts/watch-counterpart.sh` under your harness's background-notification primitive so
each line it prints becomes a wake. It queries the **remote directly** every `POLL_SECONDS`
(`git ls-remote` — never local fetch state or a cached API, both of which lag) and emits a
line only on a delta from its in-memory baseline:

1. **Targeted arm** — watches one known branch's tip SHA (`WATCH_BRANCH`). Emits `MOVED …`
   when it changes. Use when you know the counterpart's branch.
2. **Broad arm** — `comm -13` over the full sorted ref set (minus your self-filter). Emits
   `REF …` for any new/changed ref. This **backstops an unknown branch name** — it's how you
   detect the counterpart's *first* branch when you can't predict its name.

Both arms run together; the broad arm makes the targeted arm optional-but-faster.

## The load-bearing pairing — on every wake

When a `MOVED`/`REF` line wakes you, the change could be a commit **or** the watcher could
have stayed silent through a comment-only reply since your last action. So **on every wake,
and before ending any turn where you're waiting on the counterpart, do both**:

1. **Read the branch delta** — `git fetch` the ref, `git diff`/`git log` the new commits.
2. **Read the comments/reviews** via your platform's API — the watcher cannot see these.
   (GitHub MCP `pull_request_read` get_comments/get_review_comments; or `gh pr view
   --comments`; or the equivalent. Recipes in `reference/operating-guide.md`.)

Then: verify the change against the code/claims (don't act on assertion), and respond or
fold. Treat the watcher as a *prompt to verify*, never as the verification.

## Self-echo filter

Set `SELF_EXCLUDE` to an extended-regex matching **your own** ref name(s) so your own
pushes (wake-logs, fix commits) don't wake you. Filtering is by ref name, not author — keep
your branch name distinct from the counterpart's.

## Parameters (all via env; nothing project-specific is baked in)

| Var | Default | Meaning |
|---|---|---|
| `REMOTE` | `origin` | Remote name/URL to query. |
| `WATCH_BRANCH` | _(empty)_ | Counterpart's known branch (targeted arm). Empty ⇒ broad arm only. |
| `SELF_EXCLUDE` | _(empty)_ | Extended-regex of ref names to ignore — **set to your own branch.** |
| `REF_GLOB` | `refs/heads/*` | Ref namespace to scan. |
| `POLL_SECONDS` | `90` | Poll cadence. 30–90s for remotes (rate limits); never sub-second. |

The calling role prompt supplies these. The script and skill hardcode no repo, branch,
anchor system, or discipline rule.

## Known limitations (read before relying on it)

- **Comment-blind.** Refs only. Mitigation = the on-wake pairing above. *This is not
  optional.*
- **Background-runtime cap.** Harness background tasks are often killed at a cap (e.g.
  ~30 min). On the stop/timeout notification, **re-arm immediately**; assume a finite
  lifetime, not "set and forget."
- **Latency.** Up to `POLL_SECONDS` + harness scheduling. Not instant.
- **Transient `ls-remote` failure.** The script guards empty results (skips, never clobbers
  the baseline) but has no retry/backoff — sustained remote failure = silent no-wake.
- **Re-arm gap.** A change landing between a cap-kill and your re-arm is caught on the next
  poll, not when it happened.

Full invocation recipes, platform comment-read snippets, and per-limitation mitigations are
in `reference/operating-guide.md`. Read it before first use in a new harness.
