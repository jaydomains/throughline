# Dormancy push-delivery test — throwaway harness

**This branch/PR is a disposable test substrate**, not a product change. It exists so a dedicated
subscribe-only session can measure whether a GitHub PR-activity **push subscription** wakes a
**dormant** session — the empirical question left open by the planner role-file audit (PR #119).

- `PROTOCOL.md` — the full, self-contained test protocol (subject runbook + orchestrator
  checklist + verdict definitions). A dispatched subject session runs it without further input.
- `RESULTS.md` — the template the subject/orchestrator fill in as the run proceeds.

**Do not merge this to ship anything.** The *findings* land as a **separate small follow-up PR**
per the spec-author ruling; this harness PR can be closed/deleted once the run is done. It does
**not** gate or modify the planner role file's convergence on #119.
