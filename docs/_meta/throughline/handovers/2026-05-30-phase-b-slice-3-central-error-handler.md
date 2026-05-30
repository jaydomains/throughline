# Throughline — Phase B / Slice 3 Handover

**Generated:** 2026-05-30 (UTC)
**Last commit SHA:** _filled at merge_ — 2026-05-30
**Previous handover:** `handovers/2026-05-30-phase-b-slice-2-error-class-migration.md` (Phase B / Slice 2, PR #72)

Chain `audit-fix-phase-b-error-bundle` (issue #68), slice 3 of 4. Installs the central Fastify error handler and deletes the hand-rolled per-route domain-error mapping. **Mints C-D23.** This is where the SF6-09 normalizations (slices 1–2) go live.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Central `setErrorHandler` + `mapDomainError` | built | `packages/backend/src/http/error-handler.ts`; registered in `server.ts` right after app creation | reads `statusCode`/`code`/`details` off any thrown `DomainError`. |
| Canonical `ErrorResponse` type in `@throughline/shared` | built | `packages/shared/src/errors.ts` | `{ error, message?, ...details }`; partial Gap-2 progress. |
| Delete hand-rolled try/catch domain mapping | built | ~50 blocks removed across 14 route files + 3 `mapError` helpers (`intelligence`/`companion`/`session-start`); net −442 lines | only `instanceof UndoError` (×2) remains in routes. |
| Context fields preserved via `details` | built | 7 classes carry `details` (duplicate_repo_path, bundle_not_loaded, bundle_id_mismatch, invalid_project_config, cross_project_mutation, validation_failed, policy_violation) | handler spreads them into the body. |
| `UndoError` + generic-catch routes left route-local | built | 2 `UndoError` catches kept; `settings`/`notifier`/`backup` catches untouched | per slice-2 flag. |
| Mints C-D23 + AUTHORING_DISCIPLINE Gap-2 parenthetical | built | `CODE_SPEC.md` C-D23; `AUTHORING_DISCIPLINE.md` | C-D23 noted as spanning slices 1+3. |

Green gate: typecheck (incl. backend `test/**`) / 500 backend + 182 frontend tests / lint (clean) / build — all green.

---

## Last Decision Minted

- **C-D23 — Central Fastify error handler + canonical `ErrorResponse` body shape** (implementation-only; cites T-D58). One `setErrorHandler` maps any thrown `DomainError` to `{ error: code, message, ...details }` at `err.statusCode`; non-domain thrown errors keep Fastify semantics (4xx preserved, else logged 500). Spans Phase B slices 1 (hierarchy) + 3 (handler/body) — single anchor. Lands in `CODE_SPEC.md`.

---

## Status/code flips now live (the SF6-09 fix — D5 enumeration)

These responses changed when the central handler replaced the route catches. **No existing test asserted the old values** (full suite green), and the frontend does not branch on error codes — so these are corrections, not regressions. Phase D's wire-contract test will assert the canonical forms.

**Status normalizations (→ 404):**
- `items` create (`POST /items`): `ProjectNotFoundError` / `ItemNotFoundError` **400 → 404**.
- `items` add-blocker: `ItemNotFoundError` **400 `blocker_not_found` → 404 `item_not_found`**.

**Code normalizations (generic `not_found` → specific; `message` now always present):**
- `semble`: `not_found` → `item_not_found` / `project_not_found`.
- `intelligence`: ProjectNotFound `not_found` → `project_not_found`.
- `directives`: `not_found` → `directive_not_found`.
- `dump-zone`: `not_found` → `proposal_not_found`.
- `reconcile`: `not_found` → `reconcile_run_not_found`.
- `library`: `not_found` → `library_entry_not_found`.
- `methodology/companion`: `not_found` → `checklist_not_found`/`run_not_found`/`step_not_found`; `invalid_request` → `step_kind`/`run_completed`.
- `methodology/session-start`: `not_found` → `project_not_found`/`bundle_unresolved`.
- All migrated domain errors now include a `message` field (many route replies previously omitted it).

Unchanged: every already-specific code (`project_not_found` in projects/bootstrap, `no_bundle_bound`, `validation_failed`, `duplicate_repo_path`, `invalid_*`, `cross_project_*`, `folder_*`, etc.) and all 2xx behaviour.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:** `packages/backend/src/http/error-handler.ts` (central handler).

**Modified:**
- `packages/shared/src/errors.ts` — `ErrorResponse` interface.
- `packages/backend/src/server.ts` — register the handler before routes.
- 7 service files — `details` added to context-bearing errors (`projects`, `init/config-reader`, `reconcile`, `bootstrap`, `items`).
- 14 route files — removed ~50 domain-mapping try/catch blocks + 3 `mapError` helpers + dead imports (`bootstrap`, `code-todo`, `directives`, `dump-zone`, `items`, `library`, `md-ingest`, `projects`, `reconcile`, `semble`, `sessions`, `intelligence`, `methodology/companion`, `methodology/session-start`, `github` [domain catches only; `UndoError` kept]).
- `CODE_SPEC.md` (C-D23), `AUTHORING_DISCIPLINE.md` (Gap-2 parenthetical), `PLATFORM_STATUS.md` (refresh + C-D23).

**Deleted:** _none_ (blocks removed in-file).

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Unused `reply` param | `bootstrap/routes.ts` | A handler's `reply` became unused once its catch was removed (lint warning). | Dropped `reply` from that handler's signature. |

---

## Open Questions

- [ ] Slice 4 (chain-close, I5-03) — `resolveProjectBundle(registry, project)` helper threading `repo_path`; fix the 4 omitting call sites (`reconcile/service.ts`, `routes/communication-model.ts` ×2, `dump-zone/service.ts`); amend T-D51 Implications (structurally non-omittable `repo_path`); regression tests for arm-2 resolution.

---

## Recently Resolved

- **63 hand-rolled try/catch blocks** (audit I5-02) — replaced by one central handler.
- **SF6-09 status/code drift** — now structurally impossible (status lives on the class, one handler reads it). The specific flips are enumerated above.
- **`UndoError` overload + generic-catch routes** (flagged in slice 2) — resolved by keeping them route-local (documented in C-D23 implications).

---

## Cross-Module Dependencies

**Upstream:** `@throughline/shared` `DomainError`/`NotFoundError`/`ErrorResponse`.

**Downstream:** Slice 4 (independent bundle topic). Frontend — unaffected (no error-code branching); `ErrorResponse` now available in shared for Phase D.

---

## Reference

- Decisions: `CODE_SPEC.md` C-D23; `DECISIONS.md` T-D58 (executed).
- Chain: issue #68; slice 3 of 4.
- PR: _Phase B / Slice 3 (this PR)_.
