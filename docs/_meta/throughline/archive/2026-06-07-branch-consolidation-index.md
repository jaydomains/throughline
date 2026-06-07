# Branch Consolidation — durable artifacts (2026-06-07)

This change preserves session-state artifacts (wake-logs, audit findings, governance
positions, reviewer status records) that lived **only** on feature/session branches
and were never merged to `main`. It was assembled ahead of a branch cleanup whose
goal is to leave only `main` (plus any active branch) standing.

All seven source branches come from the same completed audit cycle — the audit-trio
role-file review (PRs #136/#137/#138) and the audit-remediation-plan review (PR #135),
plus the full-repo end-to-end audit overpass. Every source branch is **terminally
stood down** (its own tip commit declares "TERMINAL stand-down" / "role complete" /
"termination declared").

Each file below is copied verbatim from its source branch tip. No code changes —
documentation/meta only. After this PR merges, every source branch can be deleted
without losing operational history.

This is the second such consolidation; see
`docs/_meta/throughline/archive/2026-06-06-branch-consolidation-index.md` for the prior round.

## Provenance

| Artifact (path in this PR) | Source branch | Source tip |
|---|---|---|
| `audits/2026-06-06-auditor-b-full-repo-audit.md` | `claude/bold-cannon-S1V32` | `10d3366` |
| `audits/2026-06-06-auditor-b-slice-1-deployability.md` | `claude/bold-cannon-S1V32` | `10d3366` |
| `plans/2026-06-06-audit-remediation-plan-overseer-positions.md` | `claude/elegant-einstein-fsSgg` | `e9442f9` |
| `plans/2026-06-06-audit-remediation-plan-overseer-wake-log.md` | `claude/elegant-einstein-fsSgg` | `e9442f9` |
| `audits/2026-06-06-audit-role-files-auditor-a-reviewer-wake-log.md` | `claude/festive-faraday-E2riS` | `5471b3d` |
| `plans/2026-06-06-audit-overseer-wake-log.md` | `claude/loving-meitner-TZNYK` | `03f8bbe` |
| `plans/2026-06-06-remediation-plan-AUDIT-positions.md` | `claude/stoic-keller-jSY5K` | `cae677c` |
| `plans/2026-06-06-remediation-plan-AUDIT-wake-log.md` | `claude/stoic-keller-jSY5K` | `cae677c` |
| `audits/2026-06-06-auditor-b-reviewer-pre-registered-positions.md` ¹ | `claude/nice-clarke-ApQQO` | `a1e36c2` |
| `audits/2026-06-06-auditor-b-reviewer-status.md` ¹ | `claude/nice-clarke-ApQQO` | `a1e36c2` |
| `audits/2026-06-06-auditor-b-reviewer-wake-log.md` ¹ | `claude/nice-clarke-ApQQO` | `a1e36c2` |

All paths above are relative to `docs/_meta/throughline/`.

¹ Originally `PRE-REGISTERED-POSITIONS.md`, `STATUS.md`, and `WAKE-LOG.md` under a
top-level scratch directory `.review-auditor-b/` on the source branch; relocated into
`docs/_meta/throughline/audits/` with dated, role-prefixed names to keep the repo root
clean. Content unchanged. (Same convention as footnote ¹ of the 2026-06-06 index.)

## Branches deleted with NO preservation needed

- `claude/audit-overpass` (`ad898d0`) — its single commit touches **no files**; it was
  a findings-only audit run (Auditor-A) whose findings were posted as PR comments, not
  written to disk. Those findings were already reconciled into `main`'s remediation plan
  (`docs/_meta/throughline/plans/2026-06-06-audit-remediation-plan.md`, items M-1..M-14).
  Nothing unique on the branch.

## Branches deletable after this PR merges

All seven source branches, none active:

- `claude/bold-cannon-S1V32`
- `claude/elegant-einstein-fsSgg`
- `claude/festive-faraday-E2riS`
- `claude/loving-meitner-TZNYK`
- `claude/nice-clarke-ApQQO`
- `claude/stoic-keller-jSY5K`
- `claude/audit-overpass` (no preservation needed; see above)
