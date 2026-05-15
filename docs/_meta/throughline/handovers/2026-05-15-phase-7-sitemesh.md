<!-- Template version: 1.0 -->

# Throughline — Phase 7 Handover

**Generated:** 2026-05-15 (pre-merge)
**Last commit SHA:** see PR #12 head — branch `claude/throughline-phase-7-sitemesh-zGvPj`, 2026-05-15
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-15-phase-6c-md-ingestion.md` (Phase 6c — repo `.md` ingestion; completed Phase 6)

Phase 7 authors the SiteMesh rich-discipline reference bundle and parameterises the runtime on it: bundle-declared item types on separate boards with per-type status lifecycles, methodology-context fields on items end-to-end, and a live Modules view. The freeform path is unchanged; no SiteMesh terminology is hardcoded in code (T-D48).

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| `methodologies/sitemesh/bundle.md` authored per eleven-section structure (T-D41, T-D42) | built | `methodologies/sitemesh/bundle.md`; `packages/backend/test/sitemesh.test.ts` "parses cleanly through the bundle loader" | Primary unit `module`, anchor/marker systems, phase state machine, multi-gate moments, two item types, companion modes, templates, drift categories. |
| SiteMesh bundle parses cleanly through the loader (§Phase 7 done-when) | built | `bundle-parser.test.ts` + `sitemesh.test.ts`; loader unchanged (`methodology/loader.ts`) | Existing 11-section grammar; only the State-machine parser extended. |
| Item types `todo`/`decision` declared by bundle, surfaced in UI (§7.4, §7.5, C-D12) | built | `state-machine.ts` `extractItemTypes`; `items/policy.ts`; `Board.tsx`; `test/phase7.test.tsx` | `### Item type: <id>` sub-blocks parsed into `StateMachine.item_types`. |
| Status lifecycles per bundle (todos 4 states; decisions 3 states) | built | `items/policy.ts` `statuses_by_type`; `service.ts` create/update validation; `sitemesh.test.ts` "validates status against the item type lifecycle" | Per-type validation; flat union retained for generic consumers. |
| Todos and decisions render on separate boards (§7.5) | built | `SessionView.tsx` (iterates `policy.boards`) + `Board.tsx` (board-scoped `statuses`); `phase7.test.tsx` | Decision board does not carry todo-only columns. |
| Methodology-context fields populate on items (primary unit / phase / anchor / marker) | built | `service.ts` `loadItemChildren`/`writeContext`; `ItemDetailPanel.tsx` `MethodologyContextField`; `sitemesh.test.ts` round-trip + audit | PATCH semantics: an omitted dimension is left untouched; per-dimension audit diffs (T-D36). |
| Modules view: grouping, tier, phase indicators, anchor/marker counts (§7.11, C-D13) | built | `GET /api/projects/:id/modules` (`items/routes.ts` + `service.ts` `modules()`); `ModulesView` in `views/stubs.tsx`; `sitemesh.test.ts` + `phase7.test.tsx` | Tier classification driven by the bundle's `tier_rules` count bands. |
| No code path uses SiteMesh terminology unmediated by the bundle (T-D48) | built | review; `'module'` fallback in `stubs.tsx` changed to generic `'primary unit'` | `primary_unit_label`/tier strings come from the bundle. |
| Phase 3 UI works for freeform- and SiteMesh-bound projects without per-bundle branches | built | `bundleItemPolicy` single derivation point; freeform tests still green (`items.test.ts`) | Boards/columns/validation all read the policy. |

---

## Last Decision Minted

Two new **C-D** anchors (CODE_SPEC.md):

- **C-D12 — bundles declare item types in §5 State machine; `ItemPolicy` carries per-type lifecycles.** Rationale: the eleven-section contract (T-D42) has no item-types section, so `### Item type: <id>` sub-blocks reuse the existing `### Gates: <moment>` convention; the flat `statuses` union is retained so generic consumers (reconcile/dump-zone/tree) need no item-type-aware rewrite (no per-bundle branch — T-D48). Lands in `packages/shared/src/bundle.ts`, `shared/src/items.ts`, `methodology/bundle-parser/state-machine.ts`, `items/policy.ts`, `items/service.ts`.
- **C-D13 — Modules endpoint: primary units derived from item refs; tier classification bundle-rule-driven.** Rationale: deriving units from `item_primary_unit_refs` needs no extra authoring surface and keeps T-D39 true; a declarative count-band `tier_rules` string keeps tier classification methodology-agnostic and v1-simple. Lands in `items/service.ts` `modules()`, `items/routes.ts`.

No new T-D anchors. Implementation followed T-D39, T-D41, T-D42, T-D47, T-D48.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `methodologies/sitemesh/bundle.md` — SiteMesh rich-discipline reference bundle (eleven sections).
- `packages/backend/test/sitemesh.test.ts` — 6 tests (parse, boards, per-type validation, context round-trip, modules, freeform).
- `packages/frontend/test/phase7.test.tsx` — 2 tests (two boards w/ per-type columns; Modules table).

**Modified (shared):** `bundle.ts` (`ItemTypeSpec`, `StateMachine.item_types`); `items.ts` (`MethodologyContext`, per-type `statuses_by_type`, `Board.statuses`, `ModuleSummary`/`ModulesResult`, context inputs).

**Modified (backend):** `bundle-parser/state-machine.ts` (`### Item type:` parsing; header-scoped top-level phases/transitions); `items/policy.ts` (multi-board derivation + `bundleDoneStatusForType`); `items/service.ts` (per-type validation, context join-table round-trip + audit, `modules()`); `items/routes.ts` (`/modules`, context pass-through, explicit PATCH input build); `items.test.ts` (freeform Board shape).

**Modified (frontend):** `api.ts` (`getModules`); `Board.tsx` (board-scoped columns); `ItemDetailPanel.tsx` (context editor + per-type status cycle); `views/stubs.tsx` (live `ModulesView`); `styles.css` (Phase 7 styles); test `fixtures/mockApi.ts`, `dumpZone.test.tsx`, `voiceCapture.test.tsx` (new shapes/mocks).

**Modified (docs):** `CODE_SPEC.md` (C-D12, C-D13); `CHECKLIST.md` (nine Phase 7 rows ticked).

**Deleted:** _none_.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Item-type grammar home | `state-machine.ts` | Plan said "declare item types in the bundle markdown" without fixing which section. | Chose §5 State machine (`### Item type:` sub-blocks) over a new section — preserves the fixed eleven-section contract (T-D42). Recorded as C-D12. |
| Top-level vs sub-block keys | `state-machine.ts` | Item-type sub-blocks also carry `transitions:`, which `parseKeyValueLines` over the whole body would let bleed into the state machine's own transitions. | Parse top-level `phases`/`transitions` only from the region before the first `###`. |
| `'module'` fallback in UI | `views/stubs.tsx` | The Modules view defaulted `primary_unit_label` to the SiteMesh term `'module'` — unmediated terminology (T-D48). | Changed to the runtime-generic `'primary unit'`; the real label always comes from the bundle when modules load. |
| `pnpm lint` is a no-op | repo | Carry-forward from 6c. | Relied on `pnpm typecheck` as the static gate, consistent with prior slices. |

---

## Open Questions

- [ ] **Real lint wiring.** Still a no-op (carry-forward from 6a/6b/6c). Repo-infra slice.
- [ ] **Per-type terminal status for reconcile/dump-zone.** `bundleDoneStatus` still uses the flat-union last status; `bundleDoneStatusForType` exists but reconcile/dump-zone are not item-type aware. Acceptable for v1; revisit if a bundle's union ordering misleads those flows.
- [ ] **Gate execution.** Phase 7 only declares SiteMesh gates so `has_gates` is true; the dispatcher is Phase 8 (C-D6).
- [ ] **TagChipsEditor consolidation (carry-forward from 6a/6b).** Still not done; not blocking.

---

## Recently Resolved

- **Phase 7 (whole phase)** — was the open phase after Phase 6 closed in `2026-05-15-phase-6c-md-ingestion.md`; delivered here.
- **Phase 3 `policy.ts` pre-Phase-7 catch-all** — the placeholder branch flagged in `items/policy.ts` ("Phase 7 replaces this branch with SiteMesh's todo + decision boards") is now driven by bundle-declared item types.
- **Phase 2 `ModulesView` stub** — the empty stub flagged since Phase 2 is now a live primary-unit-grouped view.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- Phase 1 backend: `items` + the four `item_*_refs` tables (migration `0001_init.sql`), audit substrate (T-D36), projects service.
- Phase 3 backend: items service / policy / `ItemPolicy`; the `### Gates: <moment>` sub-heading convention reused for `### Item type:`.
- Phase 2/3 frontend: `SessionView`/`Board`/`ItemDetailPanel`, view-mode toggle + `has_primary_unit` gate, `ProjectBundleGuard`.

**Downstream (consumes this slice's work):**
- **Phase 8 gate runtime** — SiteMesh's `gates_by_moment` (incl. the per-commit two-gate moment) is the non-trivial bundle Phase 8 fires against.
- **Phase 9 discipline-drift** — SiteMesh's `discipline_drift_categories` (banned-strings / structural / cross-reference) are the categories Phase 9 instantiates scanners from.
- **Phase 11+** — `methodology_context` (primary unit / phase / anchors / markers) on items is the substrate for modules-scoped drift badges and session-start context.

---

## Reference

- Specs operated against: `SPEC.md` §7.3/§7.4/§7.5/§7.11/§7.12; `CODE_SPEC.md` C-D3/C-D4/C-D5 + new C-D12/C-D13; T-D39, T-D41, T-D42, T-D47, T-D48; ROADMAP §Phase 7.
- Previous handover: `docs/_meta/throughline/handovers/2026-05-15-phase-6c-md-ingestion.md`.
- PR: #12 — https://github.com/jaydomains/throughline/pull/12
