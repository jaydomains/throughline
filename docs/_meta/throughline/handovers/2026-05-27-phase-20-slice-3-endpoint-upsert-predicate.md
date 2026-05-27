# Throughline Handover — Phase 20 Slice 3: bootstrap-ingest endpoint + transactional upsert + conflict predicate

**Generated:** 2026-05-27
**Last commit SHA:** pending — 2026-05-27
**Previous handover:** `2026-05-27-phase-20-slice-2-derive-id-module.md` (Slice 2 — PR #54, merged 2026-05-27, 0 fix-rounds)

Third slice of the Phase 20 bootstrap-ingest chain (tracking issue [#52](https://github.com/jaydomains/throughline/issues/52)). The chain's biggest slice; ships the consumer-side bootstrap pipeline end-to-end.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| C-D20 surface 2 — `POST /api/projects/:id/import` endpoint with JSON body, transactional upsert, per-row result classification | built | `packages/backend/src/bootstrap/routes.ts`; `packages/backend/src/server.ts` wiring | Returns `{ result: { project_id, rows, counts } }`; error mapping 404 / 400 / 400 (project_not_found / no_bundle_bound / validation_failed). Audit per row via existing `appendAudit`. |
| C-D20 surface 4 — `hasUserEditsSinceLastBootstrap(db, entityType, entityId)` predicate as single source of truth | built | `packages/backend/src/bootstrap/predicate.ts`; 5 predicate tests | Scans `audit_log` via existing `idx_audit_entity` index. Excludes `field` values prefixed `bootstrap_` (matches `bootstrap_import`, `bootstrap_reimport`, `bootstrap_stale`). Slice 4 GET /conflicts will call the same helper. |
| T-D53 — bundle-aware validator (file shape + item type/status check + duplicate detection + override-namespace handling) | built | `packages/backend/src/bootstrap/validator.ts`; 8 validator tests | Returns result-type `{ ok: true, parsed } \| { ok: false, errors }`. Bundle-aware validation calls `bundleItemPolicy(bundle)` and checks `policy.types` + `policy.statuses_by_type[type]`. No-bundle-bound projects rejected up-front. |
| T-D54 — three-state classification per row + idempotent stale sweep | built | `packages/backend/src/bootstrap/service.ts`; 8 service tests | NEW: `service.create` + raw-UPDATE bootstrap_id + emit `bootstrap_import`. REIMPORT: raw-UPDATE entity fields + emit single `bootstrap_reimport` (no per-field audits). CONFLICT: no SQL; record classification. STALE: end-of-tx sweep; `bootstrap_stale=0` filter prevents re-flipping on subsequent empty imports. |
| Chain progression: Slice 2 ticked in `CHECKLIST.md`; `PLATFORM_STATUS.md` Snapshot + Current Phase rolled; `.claude-code/auto-continue-state.json` records Slice 2 merged + Slice 3 open | built | `CHECKLIST.md` §20 Slice 2 box ticked; `PLATFORM_STATUS.md` Snapshot + Current Phase + drift note on C-D20 update; `.claude-code/auto-continue-state.json` (`slices[1].status: "merged"`, `slices[2].status: "open"`, `currentIndex: 2`) | Standard per-slice post-work refresh. The chain-state `notes.slice3CodeSpecUpdate` captures the C-D20 wording change for cross-slice memory. |

---

## Last Decision Minted

No new T-D anchors. C-D20 was **updated in this slice** to reflect an implementation-shape choice (per spec-drift policy: "implementation-shape choices update CODE_SPEC.md only"):

- **Inline upsert SQL in `bootstrap/service.ts` (vs `upsertByBootstrapId` methods on each entity service).** The original C-D20 wording prescribed adding `…upsertByBootstrapId` methods to items / sessions / library services. The methods would have been 100% bootstrap-specific (one caller), would have emitted no audit (because the audit field depends on context — `bootstrap_import` vs `bootstrap_reimport` vs `bootstrap_stale`), and would have created asymmetric audit semantics across the entity-service surfaces. Inline SQL co-locates classification logic with its corresponding write, keeps the audit emission in one place, and avoids spreading bootstrap-specific code across three modules. C-D20 prose updated in this slice's commit; no T-D change.

Other implementation-shape choices recorded inline:

- **Two-statement insert for new rows.** `service.create({...})` for the entity insert (which emits the `create` audit), followed by raw `UPDATE ... SET bootstrap_id = ?, bootstrap_stale = 0 WHERE id = ?`, then the `bootstrap_import` audit. The `create` audit chronologically pre-dates `bootstrap_import`, so the predicate's "since last import" scan correctly ignores it on subsequent re-imports.
- **Override-namespace exception in bootstrap_id prefix validation.** The validator allows `bootstrap_id` starting `override:` regardless of the row's `source_type`, matching T-D54's "override:<user-slug>" semantics where a user-authored slug decouples identity from natural-key derivation. Non-override prefixes must match `<source_type>:`.
- **Stale sweep guarded by `bootstrap_stale=0` filter.** Without the filter, a re-import that drops a bootstrap_id from the file would re-emit a `bootstrap_stale` audit on every subsequent run. The filter makes the stale flip idempotent.
- **No `audit_log` schema change.** T-D36 polymorphic identity stands; bootstrap audits ride the existing `(entity_type, entity_id)` tuple with `trigger_context_json` carrying `bootstrap_id`, `source_type`, and `status`.
- **`LIKE 'bootstrap\_%' ESCAPE '\'` in the predicate.** Matches the bootstrap-emitted audit field family without over-matching (e.g., a hypothetical user-authored field name `bootstrap-suggest` would not collide because `-` is not `_`).

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/backend/src/bootstrap/predicate.ts` — `hasUserEditsSinceLastBootstrap(db, entityType, entityId)`. ~70 lines.
- `packages/backend/src/bootstrap/validator.ts` — T-D53 stateless validator: file-shape check, bundle-aware item validation, duplicate `bootstrap_id` detection. Exports `validateBootstrapFile`, `ItemRowInput`, `SessionRowInput`, `LibraryRowInput`, `ParsedBootstrapFile`, `BootstrapValidationError`, `ValidationResult`. ~300 lines.
- `packages/backend/src/bootstrap/service.ts` — `createBootstrapImportService({db, projects, items, sessions, library, registry})` → `BootstrapImportService.importBootstrap(projectId, input)`. Holds the four classification paths + stale sweep. ~340 lines.
- `packages/backend/src/bootstrap/routes.ts` — `POST /api/projects/:id/import` endpoint registration. ~50 lines.
- `packages/backend/test/bootstrap-ingest.test.ts` — 24 tests across three describe blocks (predicate, validator, service). ~480 lines.
- `docs/_meta/throughline/handovers/2026-05-27-phase-20-slice-3-endpoint-upsert-predicate.md` — this handover.

**Modified:**
- `packages/backend/src/server.ts` — imports + wires `createBootstrapImportService` and `registerBootstrapRoutes`. The bootstrap service consumes existing `items` / `sessions` / `library` / `projects` / `registry` instances; no new lifecycle.
- `CODE_SPEC.md` C-D20 endpoint bullet — rewritten to reflect the inline-SQL choice (vs `upsertByBootstrapId` methods); rationale captured in the same sentence.
- `CHECKLIST.md` §20 — Slice 2 box ticked with PR #54 evidence and handover path.
- `docs/_meta/throughline/PLATFORM_STATUS.md` — Snapshot updated for Slice 2 merged + Slice 3 in flight; C-D20 update noted in Snapshot; Current Phase rolled.
- `.claude-code/auto-continue-state.json` — Slice 2 merged (PR #54, 0 fix-rounds); Slice 3 open; `currentIndex: 2`; `notes.slice3CodeSpecUpdate` captures the C-D20 wording change for cross-slice memory.

**Deleted:** _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| C-D20 endpoint bullet update — inline SQL vs `upsertByBootstrapId` methods | `CODE_SPEC.md` (C-D20 endpoint bullet) | Original C-D20 prescription named `…upsertByBootstrapId` methods on each entity service. During Slice 3 design the asymmetric-audit problem surfaced: these methods would emit no audit (the bootstrap service emits it), creating an inconsistent API where other entity service methods (create/update) DO emit audit. Inline upsert SQL in `bootstrap/service.ts` resolves this by co-locating the classification logic with its corresponding write. | C-D20 prose rewritten in this slice's commit per spec-drift policy ("implementation-shape choices update CODE_SPEC.md only"). No T-D anchor change. Documented here so future slices reading C-D20 understand why the wording shifted between the doc-prereq cohort and the build cohort. |
| Slice 3 line count exceeded chain-calibration upper bound | `packages/backend/src/bootstrap/` (~1600 lines incl. tests) | Chain-open plan estimated 900–1100 lines; actual landed ~1622 (5 new modules + 24 tests). The validator was more verbose than projected (one helper per entity type rather than a generic schema-walker — chosen for typecheck clarity over LOC frugality) and the service test count came in at 24 vs the projected 15–20. | Observed-but-not-fixed: the size came from clarity choices, not from missing decomposition; pre-emptive Slice 3 split would have created two PRs with shared test scaffolding. Chain calibration note in `.claude-code/auto-continue-state.json` still says "retroactive split if three fix-rounds fire" — that guidance stands. |
| `pushIf` helper authored then removed for lint compliance | `packages/backend/src/bootstrap/validator.ts` | First draft used a `pushIf(errors, cond, path, message)` helper for the recurring guard pattern. The helper went unused after the `valid` flag refactor and triggered `@typescript-eslint/no-unused-vars`. | Folded inline pre-commit by deleting the dead helper. No runtime behaviour change. |
| Test-file `bundleItemPolicy` import was type-only-effective | `packages/backend/test/bootstrap-ingest.test.ts` | The test imported `bundleItemPolicy` for use only in `ReturnType<typeof bundleItemPolicy>` (return-type annotation) — ESLint `consistent-type-imports` flagged the import line as all-type-only. | Folded inline pre-commit by removing the import; the helper function's return type is inferred. No runtime behaviour change. |

---

## Open Questions

- [ ] **Audit covering index `(entity_type, entity_id, timestamp, field)` benchmark.** C-D20 notes a covering index "may be a benchmark-driven follow-up if import latency dominates at realistic row counts". The existing `idx_audit_entity (entity_type, entity_id)` covers the predicate's per-row scan; performance is acceptable for v1. Landing site: a future perf-tuning slice if needed; not in Phase 20 scope.
- [ ] **Slice 4 review-UI consumer shape.** Slice 3 exposes per-row `{ bootstrap_id, entity_type, entity_id, status, reason? }` and `counts`. Slice 4's GET /conflicts will return the current conflict + stale subset (querying current state, not the last import's result). Shape pinning lands in Slice 4.
- [ ] **`@bootstrap-id:` override extraction at validator level.** The Slice 2 module exports `extractBootstrapIdOverride()` but Slice 3's validator does not invoke it — the producer (Phase 21) is responsible for translating natural-key derivation + override extraction into the final `bootstrap_id` value before emitting the file. Slice 3 trusts the `bootstrap_id` field as-is. If a future change shifts override extraction to the consumer side, this is the integration site.

---

## Recently Resolved

- **Phase 20 Slice 2 merged** — was flagged in `2026-05-27-phase-20-slice-2-derive-id-module.md` as "PR pending"; resolved by PR #54 merge with 0 fix-rounds (Gitar approved with no findings).
- **C-D20 `upsertByBootstrapId` prescription** — was the doc-prereq cohort's implementation guidance; updated this slice to reflect the inline-SQL choice with documented rationale.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- Slice 1 schema migration (`0012_phase20_bootstrap.sql`) — `bootstrap_id` columns and unique partial indexes that the upsert writes to and the predicate scans on.
- Slice 2 `derive-id` module — `SourceType` discriminated union + `SOURCE_TYPES` consumed by the validator for type-narrowing and error-message construction.
- `packages/backend/src/items/policy.ts` (`bundleItemPolicy`) — bundle-aware item validation calls this with the resolved bundle.
- `packages/backend/src/methodology/loader.ts` (`MethodologyRegistry.resolveBundle`) — bundle resolution per Phase 19's three-arm loader (Slice 1) so bundle-aware validation operates against the right bundle.
- `packages/backend/src/items/service.ts` / `sessions/service.ts` / `library/service.ts` `create()` methods — used for new-row inserts.
- `packages/backend/src/audit/log.ts` `appendAudit` — used for per-row `bootstrap_import` / `bootstrap_reimport` / `bootstrap_stale` audits.

**Downstream (consumes this slice's work):**
- **Slice 4** (review-UI + GET /conflicts + POST /resolve) — consumes `hasUserEditsSinceLastBootstrap` from this slice's predicate module; consumes the `RowResult` / `BootstrapImportResult` shapes from this slice's service module; the SettingsView entry block reads counts from a future GET endpoint that will also live in this directory.
- **Phase 21** (bootstrap producer) — Claude Code emits files in the T-D53 shape this slice's validator accepts; producer-side `bootstrap_id` derivation uses Slice 2's rules so the consumer recognises them.

---

## Reference

- `DECISIONS.md` T-D53 — bootstrap import file shape + bundle-aware validation + exclusions.
- `DECISIONS.md` T-D54 — idempotent upsert; three row states; per-source-type derivation; `@bootstrap-id:` override.
- `CODE_SPEC.md` C-D20 — five implementation surfaces; this slice lands 2 + 4; C-D20 endpoint bullet updated in this slice.
- `SPEC.md` §7.27 — bootstrap functional behaviour.
- Slice 1 handover: `docs/_meta/throughline/handovers/2026-05-27-phase-20-slice-1-schema-migration.md`.
- Slice 2 handover: `docs/_meta/throughline/handovers/2026-05-27-phase-20-slice-2-derive-id-module.md`.
- Plan: `/root/.claude/plans/plan-mode-phase-20-build-misty-dove.md` (session-local).
- Tracking issue: [#52](https://github.com/jaydomains/throughline/issues/52).
- Chain state: `.claude-code/auto-continue-state.json`.
- PR: pending.
