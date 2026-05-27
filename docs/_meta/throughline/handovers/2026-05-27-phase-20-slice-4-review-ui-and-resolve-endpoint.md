# Throughline Handover — Phase 20 Slice 4: review queue UI + GET /import/conflicts + POST /import/resolve + SettingsView entry block

**Generated:** 2026-05-27
**Last commit SHA:** pending — 2026-05-27
**Previous handover:** `2026-05-27-phase-20-slice-3-endpoint-upsert-predicate.md` (Slice 3 — PR #55, merged 2026-05-27, 1 fix-round)

Final slice of the Phase 20 bootstrap-ingest chain (tracking issue [#52](https://github.com/jaydomains/throughline/issues/52)). Chain closes when this PR merges.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| C-D20 surface 5 — review queue UI lists conflicted rows from POST /import results + stale rows from a GET endpoint; per-row resolution actions | built | `packages/frontend/src/components/BootstrapReviewModal.tsx`; `packages/backend/src/bootstrap/routes.ts` (GET + POST); `packages/backend/src/bootstrap/service.ts` (`listConflicts`, `resolveConflicts`) | Two-section modal; in-flight conflicts from `lastImport`/`lastImportFile` props; stale rows from the GET endpoint. V1 actions: conflict keep_mine + take_theirs; stale keep + delete. |
| `GET /api/projects/:id/import/conflicts` — returns currently-stale rows | built | `packages/backend/src/bootstrap/routes.ts`; `service.listConflicts()`; 4 backend tests | Queries the three affected tables for `bootstrap_stale=1 AND bootstrap_id IS NOT NULL`; returns ordered by `bootstrap_id`. |
| `POST /api/projects/:id/import/resolve` — applies per-row resolutions transactionally | built | `packages/backend/src/bootstrap/routes.ts`; `service.resolveConflicts()`; 6 backend tests | Conflict take_theirs re-validates the proposed row against the bound bundle. Stale delete goes through entity-service `delete()` so cascades + hooks fire. All resolutions run in one SQLite transaction; per-row errors collected without aborting the batch. |
| SettingsView entry block surfaces stale count + opens the modal | built | `packages/frontend/src/views/SettingsView.tsx` `BootstrapReviewBlock`; 2 SettingsView tests | Colocated with existing `ThroughlineStatusBlock` (lowest-architectural-cost placement; C-D20 deliberately left placement open). Conditionally mounts the modal so `useModalRegistration` only fires when opened. |
| Frontend API client + shared types | built | `packages/frontend/src/api.ts` (`importBootstrap`, `listBootstrapConflicts`, `resolveBootstrap`); `packages/shared/src/bootstrap.ts` (request/response shapes) | Shared types mirror the backend service's exported types; runtime backend service remains the source of truth. |
| Chain progression: Slice 3 ticked in `CHECKLIST.md`; `PLATFORM_STATUS.md` Snapshot + Current Phase rolled; `.claude-code/auto-continue-state.json` records Slice 3 merged + Slice 4 open | built | `CHECKLIST.md` §20 Slice 3 box ticked; `PLATFORM_STATUS.md` Snapshot + Current Phase; `.claude-code/auto-continue-state.json` (`slices[2].status: "merged"`, `slices[3].status: "open"`, `currentIndex: 3`) | Standard per-slice post-work refresh; PLATFORM_STATUS Current Phase notes "chain closes on merge". |

---

## Last Decision Minted

No new decisions minted. Implementation followed T-D54 (conflict + stale review surface) and C-D20 surface 5 (UI placement deliberately left open). Implementation-shape choices recorded inline:

- **Conflicts are not persisted; stale rows are.** The bootstrap service drops the proposed row's identity when classifying a row as conflict (no persistent conflict storage). The review modal sources conflicts from the in-memory `BootstrapImportResult` returned by the most recent `POST /api/projects/:id/import` call and the corresponding `BootstrapFile` the caller submitted. Stale rows live in the entity tables (`bootstrap_stale=1`) and are queryable via the GET endpoint. Rationale: persistent conflict storage would require either (a) a new `bootstrap_conflicts` table (adds migration risk + a v1 surface no consumer needs persisted across sessions), or (b) storing the entire submitted bootstrap file (large blob, opaque schema). The in-memory-during-import path matches T-D54's "review queue" semantics without inventing new storage; a user who closes the modal without resolving can simply re-run the bootstrap to surface conflicts again (idempotent re-run is the chain's invariant).

- **V1 carve-outs: `merge_fields` and `archive` deferred.**
  - **`merge_fields`** (per-field conflict resolution) requires a UI for per-field choice, which has substantially more surface area than keep_mine / take_theirs. v1 ships the two terminal choices; per-field merging lands in a follow-up polish slice if the user pattern surfaces.
  - **`archive`** (for stale rows) requires an archive surface that does not exist in v1 — no table column, no view filter. Adding one without a clear consumer would be premature abstraction. v1 ships `keep` (unflip stale) and `delete` (cascade-delete) which together cover the actionable cases; archive becomes meaningful when there's a place to "show only non-archived rows".

- **`stale keep` emits `bootstrap_reimport` audit.** Unflipping `bootstrap_stale=0` is essentially "user re-anchors this row to the bootstrap surface — keep it as canonical". Writing the audit under the `bootstrap_*` family (rather than a `stale_keep` field) means the predicate's "since last import" scan treats this as a fresh import reference point; a subsequent user edit followed by another import correctly fires the conflict path. The alternative (a new `bootstrap_stale_keep` field outside the family) would break the predicate's invariant.

- **Conditional modal mounting in `SettingsView`.** `BootstrapReviewBlock` mounts the modal only when `open === true` (`{open && <BootstrapReviewModal />}`) rather than passing `open={open}` to a permanently-mounted modal. This means `useModalRegistration` fires only when the modal is actually open, so existing SettingsView tests don't need to wrap their render in `ModalStackProvider`. Trade-off: each open/close cycle recreates the modal's internal state, but the modal has no expensive setup that would suffer from re-mounting.

- **Take-theirs re-validates against the bound bundle.** The `resolveConflicts` path calls the same `validateBootstrapFile` used by the import endpoint to ensure the proposed row still satisfies the bound bundle's policy. A user resolving a stale conflict against a bundle that has since changed (e.g. dropped the `task` type) gets a clear validation error instead of a silent insert of a bundle-illegal row.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/shared/src/bootstrap.ts` — request/response shapes mirroring the backend service's exports. ~70 lines.
- `packages/backend/test/bootstrap-resolve.test.ts` — 10 tests across three describe blocks (listConflicts; stale keep/delete; conflict keep_mine/take_theirs/validation). ~240 lines.
- `packages/frontend/src/components/BootstrapReviewModal.tsx` — two-section review modal with per-row radio actions. ~220 lines.
- `packages/frontend/test/bootstrapReviewModal.test.tsx` — 6 tests covering open/closed; stale load; in-flight conflicts; proposed-row availability; apply flow; error surfacing. ~210 lines.
- `docs/_meta/throughline/handovers/2026-05-27-phase-20-slice-4-review-ui-and-resolve-endpoint.md` — this handover.

**Modified:**
- `packages/backend/src/bootstrap/service.ts` — adds `listConflicts(projectId)` and `resolveConflicts(projectId, conflicts, stale)` methods + their types (`StaleRow`, `ListConflictsResult`, `ConflictAction`, `StaleAction`, `ConflictResolution`, `StaleResolution`, `ResolveResult`). ~190 added lines.
- `packages/backend/src/bootstrap/routes.ts` — adds `GET /api/projects/:id/import/conflicts` and `POST /api/projects/:id/import/resolve` route handlers. ~40 added lines.
- `packages/frontend/src/api.ts` — adds `importBootstrap`, `listBootstrapConflicts`, `resolveBootstrap` client methods + shared-type imports.
- `packages/frontend/src/views/SettingsView.tsx` — adds `BootstrapReviewBlock` component co-located with `ThroughlineStatusBlock`; imports the modal.
- `packages/frontend/test/fixtures/mockApi.ts` — adds three vi.fn() mocks for the new endpoints.
- `packages/frontend/test/settingsView.test.tsx` — 2 new tests in the Phase 15 settings panel describe block covering the bootstrap-review-block UI.
- `packages/shared/src/index.ts` — exports the new bootstrap types module.
- `CHECKLIST.md` §20 — Slice 3 box ticked with PR #55 evidence and handover path.
- `docs/_meta/throughline/PLATFORM_STATUS.md` — Snapshot updated for Slices 1–3 merged + Slice 4 in flight (chain closes on merge); Current Phase rolled.
- `.claude-code/auto-continue-state.json` — Slice 3 merged (PR #55, 1 fix-round); Slice 4 open; `currentIndex: 3`.

**Deleted:** _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| `merge_fields` action deferred (v1 carve-out) | `packages/backend/src/bootstrap/service.ts` `ConflictAction` type | T-D54 names `keep_mine` / `take_theirs` / `merge_fields` as the three conflict actions. v1 implements two of three; per-field merge UI is substantial additional surface area. | Documented as v1 carve-out in this handover. The `ConflictAction` type definition deliberately omits `merge_fields` so adding it later is a compile-time-visible widening rather than a silent gap. Lands in a future polish slice when a clear consumer pattern emerges. |
| `archive` action deferred (v1 carve-out) | `packages/backend/src/bootstrap/service.ts` `StaleAction` type | T-D54 names `keep` / `archive` / `delete` for stale rows. v1 implements keep + delete; archive requires an archive surface that does not exist anywhere in v1 (no column, no view filter). | Documented as v1 carve-out in this handover. Same approach as `merge_fields`: type omits the deferred value so the gap is visible. Adding archive is a join-table-or-column add plus a view-filter wiring — substantial new surface; lands when an archive concept lands more broadly. |
| Stale `keep` writes a `bootstrap_reimport` audit (not a fresh field name) | `packages/backend/src/bootstrap/service.ts` `runResolveTransaction` | The semantic of "user accepts the stale row stays" is closer to "user re-anchors this row to bootstrap surface" than to "user kept a previous state". The cleanest mapping is `bootstrap_reimport` because the predicate's "since last import" reference point updates correctly. Authoring a new audit `field` value like `bootstrap_stale_keep` would have leaked the v1 carve-out into the audit-log namespace. | Folded inline; documented in this handover. The slice's `resolveConflicts` tests cover the audit emission shape. |

---

## Open Questions

- [ ] **Per-field merge UI (`merge_fields` action).** Deferred to a polish slice when a clear pattern emerges. Landing site: a follow-up frontend-heavy slice that adds the per-field UI; backend acceptance is small (one additional case in `runResolveTransaction`).
- [ ] **Archive surface for stale rows.** Deferred until an archive concept lands more broadly (a column or join-table addition, plus a view-filter pattern). Landing site: a future cross-cutting slice; not Phase 20.
- [ ] **`BootstrapReviewModal` accessibility polish.** v1 uses radio inputs + plain HTML; no keyboard-shortcut for "apply all keep_mine", no per-row diff view, no per-row link to the existing entity. Phase 16 DOD walkthrough may surface a11y findings; landing site: a future polish slice.
- [ ] **Auto-open the review modal after an import that produces conflicts.** Currently the SettingsView block surfaces stale rows only; in-flight conflicts from a just-completed import live on the response payload of the calling surface (whatever code drives `POST /import`). A user-friendly auto-open would wire the modal to the import response across whatever surface eventually exposes the file-upload action (not built in this slice). Landing site: Phase 21's bootstrap producer side (watcher + worker) will be the natural caller.

---

## Recently Resolved

- **Phase 20 Slice 3 merged** — was flagged in `2026-05-27-phase-20-slice-3-endpoint-upsert-predicate.md` as "PR pending"; resolved by PR #55 merge with 1 fix-round (same-millisecond predicate edge case folded inline via rowid tie-break).
- **C-D20 surface 5 placement decision** — was an open call at chain-open ("could move to dedicated block if surfacing density grows"); resolved by Slice 4 placing the entry block alongside the existing `ThroughlineStatusBlock` per the chain-calibration note. Documented in this handover and in the Slice 4 commit.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- Slice 1 schema (`bootstrap_stale` column on items / sessions / library_entries) — the GET endpoint queries on this column.
- Slice 3 `validateBootstrapFile` — `resolveConflicts(take_theirs)` re-validates the proposed row against the bound bundle.
- Slice 3 `runResolveTransaction` reuses the per-table `applyItemReimport` / `applySessionReimport` / `applyLibraryReimport` helpers from Slice 3.
- Existing `ItemsService.delete` / `SessionsService.delete` / `LibraryService.delete` — used for stale-delete action so cascades + hooks fire correctly.
- Existing `ModalStackProvider` / `useModalRegistration` from `packages/frontend/src/keyboard/modalStack.tsx`.

**Downstream (consumes this slice's work):**
- **Phase 21** (bootstrap producer) — Claude Code's bootstrap output triggers a chokidar watcher (C-D21); the watcher's worker will call `POST /api/projects/:id/import` and could auto-open the BootstrapReviewModal with the response payload as the most-natural UX surface for the user-driven review.
- **Future polish slices** — `merge_fields`, `archive`, and the a11y polish enumerated in Open Questions.

---

## Phase 20 chain summary

Chain `phase-20-bootstrap-ingest` closes when this PR merges:

| Slice | PR | Merged | Fix-rounds | Lines |
|---|---|---|---|---|
| 1 — Schema migration | #53 | 2026-05-27T19:29Z | 0 | ~340 |
| 2 — Derivation module | #54 | 2026-05-27T19:37Z | 0 | ~360 |
| 3 — Endpoint + upsert + predicate | #55 | 2026-05-27T20:01Z | 1 | ~1788 |
| 4 — Review UI + GET/POST resolve | #56 (pending) | — | TBD | ~1325 |

**Chain totals (pre-merge):** 4 slices over ~3 hours; 1 fix-round (Slice 3 same-millisecond predicate); 0 halt classes triggered; 1 C-D20 implementation-shape update (Slice 3 endpoint bullet) per spec-drift policy. All ROADMAP §20 Done-when criteria met.

---

## Reference

- `DECISIONS.md` T-D53, T-D54 — file shape + idempotent upsert + per-source-type derivation.
- `CODE_SPEC.md` C-D20 — five implementation surfaces; this slice lands surface 5 + the auxiliary GET/POST resolve endpoints.
- `SPEC.md` §7.27 — bootstrap functional behaviour.
- Slice 1 handover: `docs/_meta/throughline/handovers/2026-05-27-phase-20-slice-1-schema-migration.md`.
- Slice 2 handover: `docs/_meta/throughline/handovers/2026-05-27-phase-20-slice-2-derive-id-module.md`.
- Slice 3 handover: `docs/_meta/throughline/handovers/2026-05-27-phase-20-slice-3-endpoint-upsert-predicate.md`.
- Plan: `/root/.claude/plans/plan-mode-phase-20-build-misty-dove.md` (session-local).
- Tracking issue: [#52](https://github.com/jaydomains/throughline/issues/52).
- Chain state: `.claude-code/auto-continue-state.json`.
- PR: pending.
