<!-- Template version: 1.0 -->

# Throughline Handover — Doc-PR vs auto-continue-chain collision reconciliation

**Generated:** 2026-05-30
**Last commit SHA:** pending — 2026-05-30
**Previous handover:** `2026-05-30-phase-b-slice-4-resolve-project-bundle.md` (PR #74 — Phase B Slice 4, chain-close)

A reconciliation session, not a build slice. Two doc-only PRs were queued the prior evening
ahead of the public repo flip: PR #70 (public-facing README rewrite) and PR #71
(PLATFORM_STATUS reconciliation — correct the Phase A snapshot date and add the Phase B
chain-open framing). Overnight, the audit-fix **Phase B** auto-continue chain ran to
completion across four slices (#69/#72/#73/#74) with no spec-author input. Each slice's
post-work sign-off rewrote the `PLATFORM_STATUS.md` Snapshot / Current Phase lines — the same
lines PR #71 targeted — leaving #71 fully redundant (its intended content rolled off and was
replaced by a strictly-more-current state) and leaving #70 merely base-stale (its own file,
`README.md`, was untouched by the chain).

This handover records the resolution and the discipline-framework finding it surfaced.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| PR #71 categorised against current main | built | main `PLATFORM_STATUS.md` Snapshot ("As of 2026-05-30. Audit-fix **Phase B** … complete") vs #71 diff (asserts "Phase B chain-open … slice 1 pending") | Category **A — fully redundant**. #71's date fix + #67-merge framing already on main; the rest is stale/regressive. |
| PR #71 closed without merging | built | #71 closed; supersession comment posted | Branch `claude/platform-status-audit-fix-open` left in place for archaeology; deletion deferred. |
| PR #70 confirmed clean against main | built | `git rev-list --count ab5da46..origin/main -- README.md` = 0 | No overnight slice touched `README.md`; merge of main is conflict-free. |
| PR #70 branch updated onto main + pushed | built | merge commit `da41e45` (`origin/main` 2fe1b3e merged into `claude/readme-public-draft-F8Jvb`); CI re-running | Clears the `behind` state; merge to follow once CI is green. |
| This handover landed | built | this file | Records the collision finding for future absorption. |

---

## Last Decision Minted

> No new T-D / C-D anchors minted. This session resolved a process collision and recorded a
> discipline-framework finding; it changed no active decision.

The finding below is a **candidate** discipline rule, flagged here for absorption into
`AUTO_CONTINUE_WORKFLOW.md` or `AUTHORING_DISCIPLINE.md` by a future cohort hardener or the
next session to touch those docs. It is not minted as an anchor in this session.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `docs/_meta/throughline/handovers/2026-05-30-doc-pr-chain-collision-reconciliation.md` — this handover.

No code or rolling-doc files changed in this branch. PR #70's base-refresh (merge commit
`da41e45`) carries only the mechanical merge of main; its substantive diff remains the single
`README.md` rewrite.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Queued doc-PR stranded by concurrent chain | `docs/_meta/throughline/PLATFORM_STATUS.md` | PR #71 was authored against a Phase-A-merged / Phase-B-pending snapshot; the overnight Phase B chain rolled that snapshot to "Phase B complete", making #71 redundant and conflicted | Closed #71 (Category A); recorded the collision as a discipline finding (below) rather than force-resolving the conflict backward |

---

## Open Questions

- [ ] Absorb the doc-PR-collision rule into discipline docs — landing site: `AUTO_CONTINUE_WORKFLOW.md` (as a "concurrent doc-PR collision" constraint) **or** `AUTHORING_DISCIPLINE.md` (as a discipline-framework note). Deferred to a future cohort hardener or the next session touching those files.

---

## Recently Resolved

- PR #71 (PLATFORM_STATUS reconciliation) — was queued in the README/PLATFORM_STATUS doc-PR pair; resolved by closing-as-superseded once the Phase B chain landed the same reconciliation organically.
- PR #70 `behind` state — was flagged in the prior evening's status check; resolved by merging current main into the branch (`da41e45`).

---

## Cross-Module Dependencies

_none_ — documentation-only session; no module surface.

---

## Discipline-framework finding: doc-PRs vs concurrent auto-continue chains

**What happened.** A doc-PR (#71) editing a *rolling shared file* (`PLATFORM_STATUS.md`) was
queued while an auto-continue chain (Phase B, 4 slices) was free to run. The chain's per-slice
post-work gate rewrites that file's Snapshot / Current Phase / Recent Slice History / Locked
Decisions sections every slice. By the time the doc-PR would merge, the targeted lines had
been rewritten out from under it — four times. Result: the doc-PR was either redundant (#71)
or, had the rewrite been smaller, would have demanded a backward-resolving merge conflict.

**File-class distinction (the load-bearing part).** The collision is specific to the
**rolling-doc class** — files the auto-continue post-work gate mutates every slice:
`PLATFORM_STATUS.md` (Snapshot, Current Phase, Recent Slice History, Locked Decisions),
and to a lesser extent `AUTHORING_DISCIPLINE.md` / `SESSION_START.md` when a slice touches
them. **Own-file PRs do not collide**: PR #70 (`README.md`) and ordinary code-file PRs are
untouched by the chain and only ever go base-stale, which a clean merge fixes. The rule
applies *only* to the rolling-doc class.

**Mitigation (either suffices).**
1. **Land doc-PRs against rolling shared files *before* spawning the chain** — so the chain
   builds on top of them and rolls them forward normally, or
2. **Hold auto-continue while such doc-PRs are open** — pause the chain (marker file /
   `/pause` comment) until the rolling-doc PR merges, then resume.

**Recommendation for future absorption.** This belongs in `AUTO_CONTINUE_WORKFLOW.md` as a
"concurrent doc-PR collision" constraint (the chain runner is the natural owner of "what may
run alongside me"), with a one-line cross-reference from `AUTHORING_DISCIPLINE.md`. Left for a
future cohort hardener or the next session to touch those docs — not minted here.

---

## Phase B chain context (why this cohort surfaced the finding)

The collision opportunity existed because the **entire Phase B chain ran overnight without
spec-author input** — chain-open (#69) through chain-close (#74), four slices, auto-continuing
on the gate signals alone. That is itself a strong framework validation: an architectural
refactor of real size (shared `DomainError` hierarchy; ~57 error classes migrated onto a
canonical-status base; a central Fastify `setErrorHandler` replacing ~50–63 hand-rolled
try/catch blocks; three anchors minted — T-D58, C-D23, and the T-D51 Implications amendment;
net ≈ −135 lines) landed unsupervised with the green gate (typecheck incl. backend `test/**`,
501 backend + 182 frontend tests, lint, build) passing on every slice. The discipline holds on
large work without supervision. The same unsupervised throughput is exactly what stranded the
concurrently-queued doc-PR — hence the finding.

---

## Reference

- Spec / decisions / build-state docs this session operates against: `docs/_meta/throughline/PLATFORM_STATUS.md`, `docs/_meta/throughline/AUTHORING_DISCIPLINE.md`, `docs/_meta/throughline/AUTO_CONTINUE_WORKFLOW.md`
- PRs: #70 (README, updated + open), #71 (PLATFORM_STATUS, closed-superseded), #69/#72/#73/#74 (Phase B chain, merged), issue #68 (Phase B tracking)
