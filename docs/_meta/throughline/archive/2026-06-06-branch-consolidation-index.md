# Branch Consolidation — durable artifacts (2026-06-06)

This change preserves session-state artifacts (wake-logs, audit logs, experiment
records, review notes) that lived **only** on feature/session branches and were
never merged to `main`. It was assembled ahead of a branch cleanup whose goal is
to leave only `main` and `claude/pensive-feynman-e4UuF` standing.

Each file below is copied verbatim from its source branch tip. No code changes —
documentation/meta only. After this PR merges, every source branch can be deleted
without losing operational history.

## Provenance

| Artifact (path in this PR) | Source branch | Source tip |
|---|---|---|
| `plans/2026-05-31-phase-e-oq6-augmentation.md` | `claude/admiring-dijkstra-0hBh5` | `ad8236b` |
| `plans/phase-e-oq6-augmentation-wake-log.md` | `claude/admiring-dijkstra-0hBh5` | `ad8236b` |
| `experiments/dormancy-push-test/PROTOCOL.md` | `claude/dormancy-push-test` | `a8a78a2` |
| `experiments/dormancy-push-test/README.md` | `claude/dormancy-push-test` | `a8a78a2` |
| `experiments/dormancy-push-test/RESULTS.md` | `claude/dormancy-push-test` | `a8a78a2` |
| `plans/phase-e-E3-executor-wake-log.md` | `claude/e3-semble-honesty` | `a3c570e` |
| `audits/2026-06-02-phase-e-execution-audit-2-wake-log.md` | `claude/phase-e-auditor-2-review-grOlD` | `a552466` |
| `plans/2026-06-05-planner-pr-b-review-wake-log.md` | `claude/planner-pr-b-review` | `c826e82` |
| `audits/2026-06-02-planner-role-file-audit-wake-log.md` | `claude/planner-role-audit-FuAh9` | `0f6f34e` |
| `audits/2026-06-03-plan-auditor-role-file-audit-wake-log.md` | `claude/planner-role-audit-FuAh9` | `0f6f34e` |
| `audits/2026-06-03-plan-overseer-role-file-audit-wake-log.md` | `claude/planner-role-audit-FuAh9` | `0f6f34e` |
| `audits/2026-06-05-executor-role-file-audit-wake-log.md` | `claude/planner-role-audit-FuAh9` | `0f6f34e` |
| `audits/2026-06-05-persistence-amendment-audit-wake-log.md` | `claude/planner-role-audit-FuAh9` | `0f6f34e` |
| `audits/2026-06-06-execution-auditor-role-file-audit-wake-log.md` | `claude/planner-role-audit-FuAh9` | `0f6f34e` |
| `audits/2026-06-06-execution-overseer-role-file-audit-wake-log.md` | `claude/planner-role-audit-FuAh9` | `0f6f34e` |
| `audits/2026-06-03-planner-role-file-overseer-wake-log.md` | `claude/planner-role-overseer-P1NAz` | `f377b5f` |
| `audits/2026-06-03-role-files-suite-overseer-wake-log.md` | `claude/planner-role-overseer-P1NAz` | `f377b5f` |
| `plans/2026-06-03-plan-overseer-audit-wake-log-subagent-variant.md` | `claude/subagent-variant-overseer-audit` | `8d11099` |
| `audits/2026-06-04-subagent-variant-governance-review-notes-overseer.md` ¹ | `claude/subagent-variant-overseer-gov` | `e2161b4` |

¹ Originally `GOVERNANCE_REVIEW_NOTES_overseer.md` at the repo root; relocated into
`docs/_meta/throughline/audits/` with a dated name to keep the root clean. Content unchanged.

## Branches deleted with NO preservation needed

- `claude/busy-shannon-QjjRe` — fully merged (PR #82, direct ancestor of main); nothing unique.
- `claude/gifted-meitner-chJQE` — superseded planning artifact (open PR #84); no files unique to the branch.

## Note on the subagent-variant artifacts

`claude/subagent-variant-overseer-audit` and `-gov` reviewed the subagent-orchestrated
`plan-overseer.md` variant from PR #123, which was **reverted** from `main` by PR #124.
Their wake-log / governance notes are preserved here as the review trail explaining the
revert decision, not because the reviewed feature is in `main`.
