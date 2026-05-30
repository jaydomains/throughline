# Throughline — Phase B / Slice 4 Handover (chain-close)

**Generated:** 2026-05-30 (UTC)
**Last commit SHA:** _filled at merge_ — 2026-05-30
**Previous handover:** `handovers/2026-05-30-phase-b-slice-3-central-error-handler.md` (Phase B / Slice 3, PR #73)

Chain `audit-fix-phase-b-error-bundle` (issue #68), **slice 4 of 4 — chain close**. Introduces `resolveProjectBundle` and fixes the four call sites that omitted `repo_path`, closing F1-01 / S5-02. Amends T-D51; no new anchor.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| `resolveProjectBundle(registry, project)` helper | built | `packages/backend/src/methodology/loader.ts` | takes the project so `repo_path` is structurally threaded; `Pick<Project, …>` param. |
| Fix the 4 omitting call sites | built | `reconcile/service.ts:121`, `routes/communication-model.ts:49`+`:100`, `dump-zone/service.ts:130` | 0 remaining `resolveBundle(project.bundle_id, project.bundle_path)` 2-arg calls. |
| Amend T-D51 Implications | built | `DECISIONS.md` T-D51 (2026-05-30 amendment) | names the helper canonical, records the F1-01 omission, states `repo_path` structurally non-omittable. |
| Arm-2 regression test | built | `test/loader.test.ts` — "resolveProjectBundle threads project.repo_path …" | helper resolves arm 2 (9.9.9); the old omission falls to arm 3 (1.0.0). 501 backend tests (+1). |

Green gate: typecheck (incl. backend `test/**`) / 501 backend + 182 frontend tests / lint / build — all green.

---

## Last Decision Minted

> No new anchor. Amends **T-D51** Implications (`resolveProjectBundle` as the canonical project→bundle path; `repo_path` structurally non-omittable; closes F1-01 / S5-02). Per spec-author decision D2-B, the helper is a reconciliation of an existing T-D51 commitment, not a new architectural decision — so an amendment, not a C-D.

---

## Chain Summary — `audit-fix-phase-b-error-bundle`

| Slice | PR | Merged | Fix-rounds | Net lines |
|---|---|---|---|---|
| S1 — shared `DomainError` hierarchy + Project/Item/Session NotFound consolidation (mints T-D58) | #69 | 2026-05-30 | 0 | +236 / −192 |
| S2 — migrate remaining 47 HTTP-mapped error classes onto the base | #72 | 2026-05-30 | 0 | +223 / −98 |
| S3 — central `setErrorHandler` + delete ~50 hand-rolled try/catch (mints C-D23) | #73 | 2026-05-30 | 1 (Gitar security fold-in: suppress raw 5xx message) | +397 / −700 |
| S4 — `resolveProjectBundle` + 4 call sites + T-D51 amendment (chain close) | _this PR_ | 2026-05-30 | 0 | ~+110 / −9 |
| **Chain totals** | 4 PRs | | **1** | **net ≈ −135** |

Closed: **I5-01** (duplicate NotFound families), **I5-02** (central handler), **I5-03** (bundle helper) + side-effects **S5-02**, **F1-01**, **SF6-09**. Anchors: **T-D58** (S1), **C-D23** (S3), T-D51 amendment (S4).

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**Modified:**
- `packages/backend/src/methodology/loader.ts` — `resolveProjectBundle` helper + `Project` import.
- `packages/backend/src/reconcile/service.ts`, `routes/communication-model.ts`, `dump-zone/service.ts` — call sites routed through the helper; imports updated.
- `packages/backend/test/loader.test.ts` — arm-2 threading regression test.
- `DECISIONS.md` — T-D51 Implications amendment.
- `docs/_meta/throughline/PLATFORM_STATUS.md` — chain-close refresh.

**New:** this handover. **Deleted:** _none_.

---

## Drift Flags

_none_

---

## Open Questions

- [ ] **Audit-fix Phase C** — next workstream (spec author opens). Phase B (A→B→C→D cohort) is `feature-complete`; a cohort-level hardener and `production-ready` promotion follow once C/D land (or per the spec author's cadence).
- [ ] Branch-protection required-check enforcement for `.github/workflows/ci.yml` — still a pending repo-admin action (carried across the cohort).

---

## Recently Resolved

- **F1-01 / S5-02 (wrong bundle resolved)** — the 4 call sites omitting `repo_path` now thread it via `resolveProjectBundle`; arm 2 can't be silently skipped.
- **Phase B chain complete** — error-handling + bundle-resolution refactor closed across 4 slices.

---

## Cross-Module Dependencies

**Upstream:** `@throughline/shared` (`Project` type); the methodology registry's `resolveBundle` (T-D51/C-D19 three-arm resolver).

**Downstream:** any future project→bundle resolution uses `resolveProjectBundle`. _none_ pending.

---

## Reference

- Decisions: `DECISIONS.md` T-D51 (amended); chain anchors T-D58, C-D23.
- Chain: issue #68 (close); 4 slices.
- PR: _Phase B / Slice 4 (this PR)_.
