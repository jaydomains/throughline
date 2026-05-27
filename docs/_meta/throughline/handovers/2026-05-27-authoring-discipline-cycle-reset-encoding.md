# Throughline Handover — AUTHORING_DISCIPLINE.md cycle-reset encoding

**Generated:** 2026-05-27
**Last commit SHA:** pending — 2026-05-27
**Previous handover:** `2026-05-26-cycle-reset-clarification.md` (PR #44 — `PLATFORM_STATUS.md` Update Protocol half of the cycle-reset encoding)

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Cycle-reset trigger encoded as settled rule in `AUTHORING_DISCIPLINE.md` cohort-level heavy hardener checklist (PR #43 carry-forward, `AUTHORING_DISCIPLINE.md` half) | built | `docs/_meta/throughline/AUTHORING_DISCIPLINE.md` cohort-level heavy hardener bullet ("PLATFORM_STATUS.md cohort transition prepared …") | Single-bullet inline-qualifier shape per user direction; co-tick semantics. |
| Bookkeeping: close the `PLATFORM_STATUS.md` Queued Work carry-forward bullet and trim the stale trailing sentence from the Update Protocol "Cycle reset" rule | built | `docs/_meta/throughline/PLATFORM_STATUS.md` Queued Work + Update Protocol | Carry-forward chain (PR #43 → #44 → this PR) now fully closed. |

---

## Last Decision Minted

No new decisions minted. This slice closes the second half of a process clarification that PR #44 opened — it encodes a discipline rule already established by PR #43 (cohort hardener) and PR #44 (`PLATFORM_STATUS.md` Update Protocol "Cycle reset"). No new T-D or C-D anchor; implementation-shape choice (bullet labelling: "cohort transition prepared" vs "cohort-roll") follows the same scope-of-action distinction PR #44 introduced on the `PLATFORM_STATUS.md` side.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**Modified:**
- `docs/_meta/throughline/AUTHORING_DISCIPLINE.md` — cohort-level heavy hardener checklist: the "PLATFORM_STATUS.md cohort-roll" bullet replaced by a "PLATFORM_STATUS.md cohort transition prepared" bullet that distinguishes what the hardener pass does (Snapshot promotion, Recent Slice History roll) from what it explicitly does *not* (Locked Decisions This Cycle table roll); cross-references the `PLATFORM_STATUS.md` Update Protocol "Cycle reset" rule for the trigger semantics.
- `docs/_meta/throughline/PLATFORM_STATUS.md` — Queued Work "Process clarification carry-forward (`AUTHORING_DISCIPLINE.md` half)" bullet removed (this PR closes it); Update Protocol "Cycle reset" bullet's trailing "still outstanding — see Queued Work" sentence trimmed (now stale).

**New:**
- `docs/_meta/throughline/handovers/2026-05-27-authoring-discipline-cycle-reset-encoding.md` — this handover.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| `PLATFORM_STATUS.md` Snapshot date + Recent Slice History not refreshed | `docs/_meta/throughline/PLATFORM_STATUS.md` | The per-slice light hardener bullet (`AUTHORING_DISCIPLINE.md` line 81) calls for `PLATFORM_STATUS.md` Snapshot / Current Phase / Recent Slice History / Locked Decisions refresh each slice. PR #44 also skipped this for the same reason: a process-doc slice that materially changes no anchors, phases, or build state would only churn dates and PR numbers. Recent Slice History also carries a one-time expanded-cohort-chain state ("rolls back to the standard most-recent-five at the next refresh") whose narrowing is a larger editorial choice than this slice's scope. | Observed but not fixed in this slice. Resolution site: next non-process slice (or an explicit small slice that does the Recent Slice History narrowing and Snapshot refresh together). Surfacing here so the next cohort hardener catches it. |

---

## Open Questions

- [ ] Whether to add an explicit carve-out to the per-slice light hardener bullet that "process-only slices with no anchor/phase/state change may skip Snapshot + Recent Slice History refresh" — both PR #44 and this slice exercised that carve-out implicitly. If formalised, encode in `AUTHORING_DISCIPLINE.md` line 81. If rejected, both slices should be backfilled. Landing site: future small process-doc slice or accepted-as-implicit-practice in next cohort hardener.

---

## Recently Resolved

- Cycle-reset trigger encoding in `AUTHORING_DISCIPLINE.md` cohort-level heavy hardener checklist — was flagged in `2026-05-26-cycle-reset-clarification.md` (PR #44) Open Questions as "still queued in PLATFORM_STATUS.md Queued Work"; resolved by this slice's single-bullet amendment. The two-PR carry-forward chain (`PLATFORM_STATUS.md` Update Protocol half in PR #44; `AUTHORING_DISCIPLINE.md` cohort-hardener-checklist half in this PR) closes the original PR #43 carry-forward in full.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):** _none_

**Downstream (consumes this slice's work):** _none_ — process-doc clarification; no module surface.

---

## Reference

- `docs/_meta/throughline/AUTHORING_DISCIPLINE.md` cohort-level heavy hardener checklist (where the encoding now lives).
- `docs/_meta/throughline/PLATFORM_STATUS.md` Update Protocol "Cycle reset" rule (canonical source of the rule; mirrored on the discipline side by this slice).
- PR #44 handover (`handovers/2026-05-26-cycle-reset-clarification.md`) — origin of this slice's carry-forward.
- PR #43 handover (`handovers/2026-05-26-cohort-hardener-phases-19-22.md`) — origin of the two-half carry-forward chain.
- PR: pending.
