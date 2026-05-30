# Throughline — Phase B / Slice 2 Handover

**Generated:** 2026-05-30 (UTC)
**Last commit SHA:** _filled at merge_ — 2026-05-30
**Previous handover:** `handovers/2026-05-30-phase-b-slice-1-shared-error-hierarchy.md` (Phase B / Slice 1, PR #69)

Chain `audit-fix-phase-b-error-bundle` (issue #68), slice 2 of 4. Migrates the remaining HTTP-mapped backend domain-error classes onto the shared `DomainError` base with canonical `statusCode` + `code`. **Executes T-D58; no new anchor.** No HTTP behaviour change — routes still catch and map; the canonical values are inert until slice 3 installs the central handler.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Migrate remaining HTTP-mapped error classes onto `DomainError`/`NotFoundError` | built | 47 classes across 16 files; `git grep "extends Error"` leaves only the 6 intended skips | 15 `NotFoundError` (404) + 32 `DomainError` (400/409/422). |
| Each carries canonical `statusCode` + `code` | built | diff review against the normalization table below | messages kept byte-identical (incl. `≠`, `§`). |
| No behaviour change this slice | held | 500 backend + 182 frontend tests pass unchanged; routes untouched | canonical values inert until slice 3 / C-D23. |

Green gate: typecheck (incl. backend `test/**`) / 500 backend + 182 frontend tests / lint / build — all green.

---

## Last Decision Minted

> No new decisions minted. Slice 2 executes **T-D58** (introduced Phase B slice 1). No companion C-D — the per-class canonical mapping is recorded in the SF6-09 normalization table below, not as an anchor.

---

## SF6-09 Canonical Normalization Table

Every HTTP-mapped domain error now carries one canonical `statusCode` + `code` on its class. Columns flag where this **changes the wire response** vs current route behaviour — those changes take effect in **slice 3** (when the central handler emits `err.code`/`err.statusCode`); they are inert in this slice. Frontend impact: none — `jsonFetch` throws a generic `Error` on `!res.ok` and never branches on the `error` code (verified across `packages/frontend/src`).

**Status normalizations (the SF6-09 fixes — effective slice 3):**
| Class | Canonical | Was (per route) | Change |
|---|---|---|---|
| `ItemNotFoundError` (slice 1) | 404 | 404 in most routes, **400** in `items/routes.ts:101,197` | items routes normalize to 404 in slice 3 |
| `ProjectNotFoundError` (slice 1) | 404 | 404 in most routes, **400** in `items/routes.ts:101` | normalizes to 404 in slice 3 |

**Code normalizations (generic → specific; effective slice 3):**
| Class | Canonical code | Was emitted as |
|---|---|---|
| `DirectiveNotFoundError` | `directive_not_found` | `not_found` |
| `ProposalNotFoundError` | `proposal_not_found` | `not_found` |
| `ReconcileRunNotFoundError` | `reconcile_run_not_found` | `not_found` |
| `LibraryEntryNotFoundError` | `library_entry_not_found` | `not_found` |
| `ChecklistNotFoundError` / `RunNotFoundError` / `StepNotFoundError` | `checklist_not_found` / `run_not_found` / `step_not_found` | `not_found` (shared companion `mapError`) |
| `BundleUnresolvedError` | `bundle_unresolved` | `not_found` (session-start) |
| `StepKindError` / `RunCompletedError` | `step_kind` / `run_completed` | `invalid_request` (shared) |

**Unchanged (canonical = current):** all others — `parent_not_found`, `proposal_not_pending`, `run_not_pending`, `duplicate_repo_path`, `github_not_configured`, `cross_project_*`, `invalid_*`, `folder_*`, `not_a_note`/`not_a_prompt`, `bundle_not_loaded`, `bundle_id_mismatch`, `invalid_project_config`, `policy_violation`, `cycle`, `path_escape`, `validation_failed`, `no_bundle_bound`, `source_file_missing`, `repo_path_missing`, `not_an_imported_doc`, `invalid_type`, `project_not_found` (bootstrap).

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**Modified (16 service/engine files, 47 classes):**
- `methodology/session-start/engine.ts` (2), `methodology/companion/engine.ts` (5), `library/service.ts` (5), `directives/service.ts` (6), `items/service.ts` (2), `projects/service.ts` (4), `init/config-reader.ts` (2), `code-todo/service.ts` (1), `reconcile/service.ts` (3), `md-ingest/service.ts` (6), `dump-zone/service.ts` (2), `github/orphan-rules.ts` (2), `github/reverify.ts` (1), `bootstrap/service.ts` (3), `bootstrap/render.ts` (2), `bootstrap/path-guard.ts` (1) — each `extends Error` → `extends DomainError`/`NotFoundError`, `super(...)` gains canonical `statusCode`/`code`, shared import added; public parameter fields preserved.
- `docs/_meta/throughline/PLATFORM_STATUS.md` — Snapshot / Current Phase / Recent Slice History refreshed (Locked Decisions unchanged — no new anchor).

**Deleted:** _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| `UndoError` overloaded | `github/auto-reconcile.ts`, `github/routes.ts` | One class maps to **409 `undo_unavailable`** (undo path) AND **404 `run_not_found`** (approve path) — it cannot carry a single canonical status. | **Excluded from slice 2** (stays plain `Error`). Slice 3 decides: split into two errors or keep route-local. Flagged, not silently forced. |
| Generic-catch routes | `settings/routes.ts`, `notifier/routes.ts` | Catch `err instanceof Error` → 400/structured, not domain-error `instanceof`. `InvalidAutoCopyTargetError` (backup) reaches a 400 via this generic catch. | Out of slice-2 scope (slice 2 = `instanceof`-mapped classes only). Slice 3 decides whether to narrow these catches / migrate `InvalidAutoCopyTargetError`. |

---

## Open Questions

- [ ] Slice 3 (I5-02, mints C-D23) — install central `setErrorHandler` + `mapDomainError`; delete the 63 hand-rolled try/catch blocks; the canonical codes/statuses above become live (SF6-09 fixed); resolve `UndoError` and the generic-catch routes; define the `ErrorResponse` type in `@throughline/shared`. **S3 PR description must enumerate the status/code flips** (per spec-author D5).
- [ ] Slice 4 (chain-close, I5-03) — `resolveProjectBundle` + 4 call sites + T-D51 amendment.

---

## Recently Resolved

- **~50 backend error classes carried no HTTP status** — flagged in slice 1's T-D58 context; this slice gives every HTTP-mapped one its canonical `statusCode`+`code`, so the central handler in slice 3 can be a uniform reader.

---

## Cross-Module Dependencies

**Upstream:** `@throughline/shared` `DomainError`/`NotFoundError` (slice 1).

**Downstream:**
- Slice 3 — the central handler reads `statusCode`/`code`/`details` off every migrated class; deletes the route catches. Pending.
- Frontend — unaffected (does not branch on error codes).

---

## Reference

- Decisions: `DECISIONS.md` T-D58 (executed here).
- Chain: issue #68; slice 2 of 4.
- PR: _Phase B / Slice 2 (this PR)_.
