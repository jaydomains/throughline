<!-- Historical artifact. Cross-audit synthesis produced at the close of the five-audit sweep (2026-05-28). Committed retroactively 2026-05-30 (see handover 2026-05-30-audit-backfill-five-audit-reports.md). Transcribed verbatim from the original session deliverable — NOT edited, summarized, or updated. This is the document that actually informed Phases A–D scoping. -->

# Throughline — Cross-Audit Synthesis (closing all 5)

The five audits converge on a **small set of sites that surface under every lens** — the strongest possible signal for where to spend effort:

| Site | A1 build | A2 bug | A3 functional | A4 silent | A5 improve |
|---|---|---|---|---|---|
| **`resolveBundle` 3-arg omission** (reconcile/dump-zone/comm-model) | — | S5-02 (High) | F1-01 (**Major**) | — | I5-03 abstraction + I6-05 test |
| **dump-zone non-atomic apply** | — | S5-01 (High) | — | SF4-04 (Med) | I6-03 test (no idempotency key vs bootstrap) |
| **safe-regex ReDoS** | — | S2-01 (High) | — | — | I6-01 **confirmed live 106 s** + test |
| **frontend error-swallow hooks** | — | — | — | SF6-01/02 (**Crit**) | I3-01 hook + I6-06 test |
| **backend `test/**` untyped** | I1 | (enabled drift) | — | — | Seg7 Gap1 + Seg6 mock-drift |
| **route error→status mapping** | — | — | — | SF6-09 etc. | I5-02 central handler |
| **`shared` consumed as `./src`** | F1 (dist unrunnable) | — | I3 (dead dist) | — | — |

**Three workstreams would clear most of it:**

1. **A bundle-resolution + error-handling refactor slice** — `resolveProjectBundle(project)` (I5-03) + shared NotFound errors (I5-01) + central error handler (I5-02). Simultaneously fixes the audit-2 bug (S5-02), the audit-3 Major delta (F1-01), and the audit-4 status-code inconsistencies — and removes ~300 lines.

2. **A frontend error-surfacing slice** (audit-4 Workstream A) — render the 5 hooks' `error`, add catches to `void` mutations, extract `useResource` (I3-01). Clears 2 audit-4 Criticals + 5 Highs and ~100 lines in one coherent change.

3. **A green-gate hardening slice** — typecheck backend `test/**` (closes audit-1 I1, audit-5 Gap 1, the mock-drift class) + add the 7 paired regression tests (Seg 6) for the known defects. Turns the gate from "looks green" into "proves the things prior audits found broken."

**Session totals across all five audits:** Audit 1 — green gate passes, 1 functional build defect (dist unrunnable) + 16 dep advisories + Node/CI drift. Audit 2 — 0 Critical / 6 High / 13 Medium bugs. Audit 3 — 0 Critical / 7 Major / 9 Moderate spec deltas (key invariants T-D54/56/57/52/51 mostly hold). Audit 4 — **5 Critical / 15 High silent failures**, dominated by the "empty == healthy" conflation pattern. Audit 5 — ~540 extractable lines, 7 targeted regression tests, the green-gate true-coverage meta-finding.

**The headline of the whole session:** the build is green and the engines are faithful, but the system's weakest dimension is **observability of failure** (audit 4's Criticals + audit 5's green-gate gaps) — degraded/failed states masquerade as healthy/empty across the product, and the test+type gate doesn't yet prove the things the other audits found broken.

---

*All five audits were read-only investigation; no code was edited or committed during them. The per-audit reports (companion files `2026-05-28-audit-1-build-readiness.md` … `2026-05-28-audit-5-improvements.md`) are the detailed deliverables this synthesis draws from.*
