#!/usr/bin/env bash
#
# watch-counterpart.sh — emit one line per change to a counterpart's git refs on a remote.
#
# Part of the `counterpart-change-detector` skill. VCS-generic (git only); contains NO
# project-specific paths, branch names, or rules — everything is configured via env vars
# supplied by the calling role.
#
# Run it under your harness's background-notification primitive so each stdout line becomes
# a wake (e.g. the Monitor tool with persistent:true, or a backgrounded Bash task). It does
# NOT self-exit on no-change; it runs until killed.
#
# ── Configuration (all env; all optional) ───────────────────────────────────────────────
#   REMOTE        Remote name or URL to query.                     Default: origin
#   WATCH_BRANCH  Counterpart's known branch (short name) to watch Default: <empty> → off
#                 for tip changes. Empty disables the targeted arm; the broad arm still
#                 catches it as a new ref.
#   SELF_EXCLUDE  Extended-regex (grep -E) of ref *names* to drop  Default: <empty> → none
#                 from the broad arm. SET THIS TO YOUR OWN BRANCH so your own pushes do not
#                 wake you. Example: 'my-review-branch|wip/me/'
#   REF_GLOB      Ref namespace to scan.                           Default: refs/heads/*
#   POLL_SECONDS  Poll cadence in seconds (>=30 for remotes).      Default: 90
#
# ── Output (each line → one wake) ────────────────────────────────────────────────────────
#   START <config>            once, at arm time (lets you confirm the baseline took).
#   MOVED <branch> <a>..<b>   targeted arm: the watched branch tip changed (a→b, short shas).
#   REF   <sha> <ref>         broad arm: a new-or-changed ref appeared (self-excluded).
#
# ── CRITICAL ─────────────────────────────────────────────────────────────────────────────
#   This watches REFS (commits) ONLY. It is blind to PR/MR comments and reviews. On every
#   wake you MUST also read the counterpart's comments/reviews via your platform API and
#   diff the branch — the watcher is a prompt to verify, not the verification. See the
#   skill's reference/operating-guide.md ("on-wake checklist").

set -u

REMOTE="${REMOTE:-origin}"
WATCH_BRANCH="${WATCH_BRANCH:-}"
SELF_EXCLUDE="${SELF_EXCLUDE:-}"
REF_GLOB="${REF_GLOB:-refs/heads/*}"
POLL_SECONDS="${POLL_SECONDS:-90}"

# grep -v the self-filter only when one is set (an empty pattern matches everything).
_filter() {
  if [ -n "$SELF_EXCLUDE" ]; then grep -Ev -- "$SELF_EXCLUDE"; else cat; fi
}

# Full sorted ref snapshot, self-filtered. Empty on transient failure (caller guards).
_snapshot() {
  git ls-remote "$REMOTE" "$REF_GLOB" 2>/dev/null | _filter | sort
}

# Tip SHA of the watched branch (empty if no WATCH_BRANCH or on transient failure).
_tip() {
  [ -n "$WATCH_BRANCH" ] || return 0
  git ls-remote "$REMOTE" "refs/heads/$WATCH_BRANCH" 2>/dev/null | awk '{print $1}'
}

prev_tip="$(_tip)"
prev_all="$(_snapshot)"
echo "START remote=$REMOTE branch=${WATCH_BRANCH:-<none>} glob=$REF_GLOB every=${POLL_SECONDS}s self_exclude=${SELF_EXCLUDE:-<none>}"

while true; do
  sleep "$POLL_SECONDS"

  # ── Targeted arm: the counterpart's known branch tip. ──────────────────────────────────
  if [ -n "$WATCH_BRANCH" ]; then
    cur_tip="$(_tip)"
    if [ -n "$cur_tip" ] && [ "$cur_tip" != "$prev_tip" ]; then
      echo "MOVED $WATCH_BRANCH ${prev_tip:0:9}..${cur_tip:0:9}"
      prev_tip="$cur_tip"
    fi
  fi

  # ── Broad arm: any new/changed ref (catches unknown branch names). ─────────────────────
  cur_all="$(_snapshot)"
  if [ -n "$cur_all" ]; then                       # guard: skip transient-empty, don't clobber baseline
    delta="$(comm -13 <(printf '%s\n' "$prev_all") <(printf '%s\n' "$cur_all"))"
    if [ -n "$delta" ]; then
      while IFS= read -r line; do
        [ -n "$line" ] && echo "REF $line"
      done <<< "$delta"
      prev_all="$cur_all"
    fi
  fi
done
