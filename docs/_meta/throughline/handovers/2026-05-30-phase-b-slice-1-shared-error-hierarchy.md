# Throughline — Phase B / Slice 1 Handover (chain-open)

**Generated:** 2026-05-30 (UTC)
**Last commit SHA:** _filled at merge_ — 2026-05-30
**Previous handover:** `handovers/2026-05-29-audit-fix-phase-a-foundation-fixes.md` (audit-fix Phase A, PR #67)

Chain `audit-fix-phase-b-error-bundle` (tracking issue #68). Slice 1 of 4 — establishes the shared domain-error hierarchy and consolidates the three duplicated NotFound families.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Shared `DomainError` hierarchy in `@throughline/shared` (statusCode + code + details) | built | `packages/shared/src/errors.ts`; exported via `packages/shared/src/index.ts` | `DomainError` → `NotFoundError` (404) → `Project`/`Item`/`SessionNotFoundError`. |
| Consolidate duplicate NotFound defs | built | 17 `ProjectNotFoundError` + 5 `ItemNotFoundError` + 2 `SessionNotFoundError` local defs deleted across 18 service/engine files | `grep` confirms zero local `export class (Project\|Item\|Session)NotFoundError extends Error` remain. |
| Repoint all import sites to `@throughline/shared` | built | 13 route/service importers + 5 test files repointed | typecheck (incl. backend `test/**`) green proves every site resolves. |
| Collapse the 6-alias `instanceof` chain | built | `intelligence/routes.ts` `mapError` | Six aliased `ProjectNotFoundError` imports → one `instanceof ProjectNotFoundError`. |
| Mint T-D58 + §14 index row | built | `DECISIONS.md` T-D58; `SPEC.md §14` row (section 3) | — |
| No HTTP behaviour change this slice | held | routes still catch/map; statusCode/code inert until slice 3 | 500 backend + 182 frontend tests pass unchanged. |

Green gate: typecheck / 500 backend + 182 frontend tests / lint / build all green. Net −135 lines across 36 files + new `errors.ts`.

---

## Last Decision Minted

- **T-D58 — Shared domain-error hierarchy: errors carry their canonical HTTP status; routes never decide it.** Domain errors live once in `@throughline/shared` under a `DomainError` base carrying `statusCode` + stable `code` + optional `details`; the central handler (C-D23, slice 3) reads them. Rationale: status-on-the-class makes the SF6-09 404-vs-400 drift structurally impossible, and one shared identity collapses the aliased-`instanceof` chains. Lands in: `DECISIONS.md` (T-D58 body), `SPEC.md §14` (index row, section 3). Implemented across the chain — slice 1 mints the hierarchy + the three NotFound families; slices 2–3 fan out and wire the handler.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/shared/src/errors.ts` — the shared hierarchy (`DomainError`, `NotFoundError`, `Project`/`Item`/`SessionNotFoundError`).

**Modified:**
- `packages/shared/src/index.ts` — re-export `./errors.js`.
- 18 backend service/engine files — local NotFound class defs deleted, import from `@throughline/shared` added (e.g. `items/service.ts`, `library/service.ts`, `intelligence/{rag,chat,retro,sequencing,periodic-review,stakeholder}.ts`, `methodology/{companion,session-start}/engine.ts`, `semble`/`reconcile`/`dump-zone`/`sessions`/`code-todo`/`md-ingest`/`directives` `service.ts`, `github/pr-linking.ts`).
- 13 route/service importers repointed to `@throughline/shared` (incl. the `intelligence/routes.ts` 6-alias collapse; `sessions/routes.ts`, `github/routes.ts`, and the multi-line route imports in `code-todo`/`directives`/`dump-zone`/`items`/`library`/`md-ingest`/`methodology/companion`/`methodology/session-start`/`reconcile`/`semble` routes).
- 5 test files repointed (`rag`, `chat`, `retro-review`, `sequencing-stakeholder`, and the stakeholder import within it).
- `DECISIONS.md` (T-D58), `SPEC.md` (§14 row), `PLATFORM_STATUS.md` (Snapshot / Current Phase / Locked Decisions + T-D58 / Recent Slice History roll).

**Deleted:** _none_ (class defs removed in-file, no file deletions).

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Audit undercount | `intelligence/stakeholder.ts` | Audit said 16 `ProjectNotFoundError` / 4 `ItemNotFoundError`; `stakeholder.ts` (UTF-8 em-dashes trip grep's binary heuristic) holds a 17th Project + 5th Item def. | Found via `Read`/`grep -a`; consolidated with the rest. True counts 17/5/2. |
| Message normalization | `intelligence/stakeholder.ts`, `intelligence/retro.ts` | Two cosmetic variants: `item … not found in project`, `session … not found in project`. | Normalized to canonical `… not found`. No test/contract asserted the variant text; recorded for honesty. |

---

## Open Questions

- [ ] Slice 2 — migrate the remaining ~50 backend domain-error classes onto the shared base with canonical `statusCode`/`code` (executes T-D58, no new anchor); resolved in the slice-2 PR.
- [ ] Slice 3 — central `setErrorHandler` + `mapDomainError` (mints C-D23), delete the 63 hand-rolled try/catch blocks, normalize SF6-09 codes, define the error-response type in `@throughline/shared`; resolved in the slice-3 PR.
- [ ] Slice 4 — `resolveProjectBundle` helper + 4 call sites + T-D51 Implications amendment; resolved in the slice-4 (chain-close) PR.

---

## Recently Resolved

- **Six-alias `instanceof` chain** (`intelligence/routes.ts`) — was the canonical illustration of the per-module duplication; collapsed to one check by this slice.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):** `@throughline/shared` — now the single home for the three NotFound classes (and, from slice 2, the rest).

**Downstream (consumes this slice):**
- Slice 2 — extends the `DomainError` base across the remaining backend error classes. Pending.
- Slice 3 — the central handler reads `statusCode`/`code`/`details` off these classes. Pending.
- Frontend — may reference the shared `code` values; error-response type arrives in slice 3. Pending.

---

## Reference

- Decisions: `DECISIONS.md` T-D58; `SPEC.md §14`.
- Chain: tracking issue #68 (`audit-fix-phase-b-error-bundle`); 4 slices (S1 hierarchy → S2 migration → S3 handler/C-D23 → S4 bundle/T-D51 amendment).
- PR: _Phase B / Slice 1 (this PR)_.
