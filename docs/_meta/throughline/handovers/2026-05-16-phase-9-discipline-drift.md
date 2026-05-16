<!-- Template version: 1.0 -->

# Throughline — Phase 9: Discipline-drift Engine Handover

**Generated:** 2026-05-16 (pre-merge)
**Last commit SHA:** see PR head — branch `claude/throughline-phase-9-6NFQV`, 2026-05-16 (merge SHA not yet known at authoring time)
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-16-phase-8-gate-runtime.md` (Phase 8 — methodology gate runtime)

ROADMAP §Phase 9. Implements C-D7 against SPEC §7.14: bundle-declared discipline-drift category scanners, file-watcher + pre-write + manual triggers, the shared `drift_signals` table with `stream='discipline'`, and surfacing in the methodology-gates view, modules-view badges, and item-level indicators.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Scanners instantiate from the bundle validation-rules section (C-D7, C-D4) | built | `packages/backend/src/methodology/drift/discipline/{engine,scanners}.ts`; `discipline-drift.test.ts` "instantiates scanners …" | `check_kind` → generic primitive (banned_string/structural/cross_reference/regex), C-D15-style catalogue. |
| File changes in declared doc paths fire relevant scanners (chokidar) | built | `engine.ts` watcher; `discipline-drift.test.ts` file-change case | Watch surface + fan-out derived from active projects (md-ingest watcher convention). |
| Pre-write moment also fires write-time scanners | built | gate-runtime `onMoment` hook (`gates/runtime.ts`); `server.ts` wiring; `discipline-drift.test.ts` "pre-write moment …" | Methodology-agnostic hook; no runtime→engine import. |
| Signals write to `drift_signals` with `stream='discipline'` (T-D21) | built | `drift/service.ts` `createDisciplineSignal`; audit-logged (T-D36) | Table pre-existed (0001); no migration needed. |
| Signals scoped to `item_id` / `primary_unit_ref` where applicable | built | `scanners.ts` `crossReferenceScan`; `drift/service.ts` counts/item queries; `discipline-drift.test.ts` "cross_reference … scope" | cross_reference → citing item + its units; others project-scoped (grammar limit — see Open Questions). |
| Methodology-gates view shows category-grouped lists | built | `frontend/src/views/GatesView.tsx`; `gatesView.test.tsx` Phase-9 case | Re-scan button = the explicit user trigger. |
| Modules view badges affected primary units | built | `frontend/src/views/stubs.tsx` ModulesView; `phase7.test.tsx` Phase-9 case; `items/service.ts` `drift_signal_count` | `disciplineCountsByPrimaryUnit` UNION-dedups. |
| Item methodology-drift indicator (list rows + detail panel) | built | `ItemRow.tsx`, `ItemDetailPanel.tsx`; `disciplineDriftItem.test.tsx`; derived `Item.methodology_drift` | Flag derived, never persisted. |
| Freeform-bound projects: scanner instantiation is a verified no-op | built | `discipline-drift.test.ts` "freeform-bound … no-op" | Zero categories → all open discipline signals reconciled away. |
| Bundle re-load tears down / rebuilds scanners | built | loader `onBundleReloaded` hook; `engine.reloadForBundle`; `discipline-drift.test.ts` "bundle re-load …" | Re-load reconciles away dropped-category signals. |

Tests: backend 153 (was 147), frontend 77 (was 73), typecheck clean. `pnpm lint` is a no-op (carry-forward from 6a–8).

---

## Last Decision Minted

> No new T-D / C-D anchors minted. Implementation followed T-D21, T-D42, T-D44, T-D36; C-D7, C-D4, C-D6, C-D15. One implementation-shape decision recorded in `CODE_SPEC.md` C-D7 implications (spec-drift policy → CODE_SPEC only): **discipline-drift signal scoping uses the `item_anchor_citations` linkage for `cross_reference`; `banned_string`/`structural`/`regex` stay project-scoped** because the T-D42 grammar declares no file→unit/item mapping. Approved with the user during plan-mode (the C-D15 precedent for grammar-preserving, methodology-agnostic primitives).

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/backend/src/methodology/drift/discipline/scanners.ts` — generic scanner catalogue (banned_string/structural/cross_reference/regex).
- `packages/backend/src/methodology/drift/discipline/engine.ts` — per-project engine: chokidar watch, idempotent signal lifecycle, triggers, reload teardown.
- `packages/backend/src/methodology/drift/routes.ts` — `GET/POST /api/projects/:id/discipline-drift[/rescan]`.
- `packages/shared/src/drift.ts` — `DisciplineDriftSignal` / grouped result types.
- `packages/backend/test/discipline-drift.test.ts` — 6 backend cases.
- `packages/frontend/test/disciplineDriftItem.test.tsx` — item-indicator cases.
- `docs/_meta/throughline/handovers/2026-05-16-phase-9-discipline-drift.md` — this handover.

**Modified:**
- `packages/backend/src/drift/service.ts` — discipline create/dismiss/list + `disciplineCountsByPrimaryUnit` / `disciplineDriftItemIds` (exported, reused by items service).
- `packages/backend/src/methodology/gates/{runtime,checks}.ts` — `onMoment` hook; `resolveDocSurface` exported for scanner reuse.
- `packages/backend/src/methodology/loader.ts` — `onBundleReloaded` hook on (re)load.
- `packages/backend/src/items/service.ts` — derive `methodology_drift`; `drift_signal_count` on `ModuleSummary`.
- `packages/backend/src/server.ts` — engine constructed before gate runtime; routes; start/stop; late-bound registry reload hook.
- `packages/shared/src/{index,items}.ts` — export `drift.ts`; `Item.methodology_drift`, `ModuleSummary.drift_signal_count`.
- `packages/frontend/src/{api.ts,views/GatesView.tsx,views/stubs.tsx,components/ItemRow.tsx,components/ItemDetailPanel.tsx,styles.css}` — surfacing.
- `packages/frontend/test/{fixtures/mockApi.ts,gatesView.test.tsx,phase7.test.tsx}` — fixtures + Phase-9 assertions.
- `methodologies/test-bundle/bundle.md` — added a `cross_reference` drift category so the worked example exercises item/unit-scoped signals.
- `CODE_SPEC.md` (C-D7 implications expanded), `CHECKLIST.md` (§Phase 9 closed).

**Deleted:** _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Signal scoping fork | `scanners.ts` / CODE_SPEC C-D7 | Plan flagged file→unit/item attribution as undecided (affects a "Done when" criterion). | Resolved with the user in plan-mode: anchor-citation linkage for `cross_reference`, project-scoped otherwise. Recorded CODE_SPEC-only; surfaced as an Open Question. |
| CODE_SPEC path name | `CODE_SPEC.md` C-D7 | C-D7 named `backend/src/methodology/drift/discipline-scanners/`. | Implemented as `…/drift/discipline/` (engine + scanners). CODE_SPEC implications updated to the real layout. |
| test-bundle extended | `methodologies/test-bundle/bundle.md` | A `cross_reference` category was added to exercise item/unit scoping. | Accepted — consistent with the bundle's stated "exercise the grammar non-trivially" purpose; no test asserts its category count. |
| `pnpm lint` no-op | repo | Carry-forward from 6a–8. | Relied on `pnpm typecheck` + full suites (backend 153, frontend 77). |

---

## Open Questions

- [ ] **File → primary-unit / item attribution for non-anchor categories.** `banned_string`/`structural`/`regex` findings are project-scoped because the T-D42 grammar has no file→unit mapping. A bundle that wants those badged per unit needs a grammar extension (a doc→unit declaration) — a spec-author change. Landing site: SPEC §7.14 / T-D42 clarification, then CODE_SPEC C-D7.
- [ ] **Mid-session new-project file-watching.** A project created after startup is covered by pre-write/manual immediately and by file-change after the next `refresh()`; there is no project-create → `engine.refresh()` hook (ProjectsService has no lifecycle callback). Landing site: a small projects-service hook, or Phase-10 wiring.
- [ ] **Drift inbox / re-verify-via-AI.** C-D7 mentions a header drift-inbox counter and the re-verify action; those are the shared T-D21 surface delivered with Phase 10 (code-drift) — out of Phase-9 scope.

---

## Recently Resolved

- **Phase 9 downstream dependency from Phase 8** — the phase-8 handover named "Phase 9 discipline-drift reuses the pre-write moment's dispatch path"; delivered via the `onMoment` hook on the gate runtime.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- Phase 1 bundle loader/parser (C-D4) — `validation_rules.discipline_drift_categories`, `resolveBundle` (C-D14), `onBundleReloaded`.
- Phase 8 gate runtime (C-D6) — the `onMoment` pre-write dispatch; `resolveDocSurface` doc-surface helper; anchor-citation gathering idiom.
- Phase 3 items + `item_anchor_citations` / `item_primary_unit_refs` — the cross_reference → item → unit scoping linkage.
- Audit substrate (T-D36); shared `drift_signals` table (T-D21, Phase 5 first producer).

**Downstream (consumes this slice's work):**
- **Phase 10 GitHub / code-drift** — shares `drift_signals`; the header drift-inbox counter and re-verify-via-AI action will count/operate over both streams.
- **Phase 14 RAG / periodic review** — hygiene queries span the discipline-drift stream (ROADMAP Phase 14 depends on Phase 9).

---

## Reference

- Specs operated against: `SPEC.md` §7.14; `CODE_SPEC.md` C-D7 (+ C-D4/C-D6/C-D15 reused); `DECISIONS.md` T-D21/T-D42/T-D44/T-D36; `ROADMAP.md`/`CHECKLIST.md` §Phase 9.
- Previous handover: `docs/_meta/throughline/handovers/2026-05-16-phase-8-gate-runtime.md`.
- PR: opened at phase close on branch `claude/throughline-phase-9-6NFQV`.
