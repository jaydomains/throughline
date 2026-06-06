# Dormancy push-delivery test — results

Fill this in as the run proceeds (subject self-reports positives; orchestrator records
negatives). All timestamps **UTC ISO-8601**. See `PROTOCOL.md` for definitions. Commit every
update to this branch so a reclaimed/fresh session can resume from the last row.

- **Test PR:** #<fill> (`claude/dormancy-push-test`)
- **Subject session id / dispatch note:** <fill>
- **Poll armed at any point?** MUST be **NONE** (a single armed poll invalidates the run)

---

## Event log (append-only; commit each row)

| UTC | event | detail |
|-----|-------|--------|
| <fill> | SUBSCRIBED | `T_subscribe=…`; poll armed: NONE |
| <fill> | IDLE-START A | ended turn; awaiting push |
| … | … | … |

---

## Window verdicts

### Window A — past the ~30-min runtime cap
- `IDLE-START A` (UTC): <fill>
- `T_comment_posted` (comment `created_at`, UTC): <fill>
- `T_wake_observed` (UTC): <fill / n/a>
- `latency`: <fill / n/a>
- **wake source:** <push event | manual re-prompt | none>
- **verdict:** <WOKE | DELAYED | DID-NOT-WAKE>
- notes: <fill>

### Window B — overnight / multi-hour quiet
- `IDLE-START B` (UTC): <fill>
- `T_comment_posted` (UTC): <fill>
- `T_wake_observed` (UTC): <fill / n/a>
- `latency`: <fill / n/a>
- **wake source:** <push event | manual re-prompt | none>
- **verdict:** <WOKE | DELAYED | DID-NOT-WAKE>
- notes: <fill>

### Window C — forced container reclamation
- `CHECKPOINT-C` committed (UTC): <fill>
- reclaim triggered (orchestrator, UTC): <fill>
- `T_comment_posted` (UTC): <fill>
- `T_wake_observed` (UTC): <fill / n/a>
- `latency`: <fill / n/a>
- **wake source:** <push event after reclaim | none>
- in-memory context lost / resumed via branch read? <fill>
- **verdict:** <WOKE | DELAYED | DID-NOT-WAKE>
- notes: <fill>

---

## Summary / disposition

- A: <verdict> · B: <verdict> · C: <verdict>
- **Interpretation** (per PROTOCOL.md "Interpreting the result"): <fill>
- **Recommended follow-up PR action** (does push documentation in the role files / skill change?):
  <fill — and remember: lands as a SEPARATE follow-up PR, never a revision to planner.md>
