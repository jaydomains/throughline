<!-- Template version: 1.0 -->

# Throughline — Pass 1b (GraphView implementation) Handover

**Generated:** 2026-05-17 (pre-merge)
**Last commit SHA:** see PR head — branch `claude/graphview-implementation-daCgm` (PR not yet merged; update to merge SHA on merge)
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-17-pass-1a-docs-license-sitemesh.md` (Pass 1a — docs / license / SiteMesh removal)

This slice is **not a ROADMAP phase**. It is the second remediation pass from the v1 pre-launch verification: implement the graph view so SPEC §11's "nine view modes functional" DoD bullet — checked at Phase 16 over a permanent stub (Cat-1 honesty blocker) — is honestly true. Pass 1a explicitly deferred GraphView here.

A mockup detour landed first: a whole-app design handoff was uploaded to `docs/_meta/throughline/mockups/` (commit `2cd6bd0`); GraphView's visual layer was re-planned against it. The handoff contains **no graph screen** (graph is a `StubScreen` filed under "apply the vocabulary as phases get built out"), so it informs styling vocabulary only, not graph layout.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Graph view functional (SPEC §11 "nine view modes functional and switchable") | built | `packages/frontend/src/views/GraphView.tsx`, `views/graph/layout.ts`; `CHECKLIST.md` §11 row + Pass 1b section | Replaces `views/stubs.tsx` GraphView stub; wired in `App.tsx` |
| Nodes are items; parent-child + blocked-by edges (SPEC §7.11, CODE_SPEC §18) | built | `views/graph/layout.ts` `buildGraph`; `test/graphLayout.test.ts` | Edges from `parent_id` + `blockers[]` (T-D8); out-of-set refs ignored; cycle-guarded |
| "Show chains" — blocker paths + root blockers (SPEC §7.11) | built | `layout.ts` `analyseChains`; `GraphView.tsx` toggle; `test/graphView.test.tsx` | Root blocker defined structurally (blocks ≥1, blocked by none in-set) |
| Interactive (select → detail, pan/zoom) | built | `GraphView.tsx` (pointer pan, zoom buttons, `ItemDetailPanel` on node click) | Reuses Tree-view pattern: ↑/↓ cycle, Esc close (panel-owned) |
| Stale ⚑ / drift ↯ indicators on nodes (T-D46 consistency) | built | `GraphView.tsx` `GraphNodeView`; `views/graph/graph.css` no-fill pills | |
| Cross-session-mention edge (SPEC §7.11) | missing (deferred) | `DECISIONS.md` WN-1b-a; `CHECKLIST.md` Pass 1b unchecked row | No mention/reference field in the `Item` model — spec-author decision required. Not a separate §11 DoD line |
| Communication-model graph layer (SPEC §7.11) | missing (deferred) | `DECISIONS.md` WN-1b-b; `CHECKLIST.md` Pass 1b unchecked row | Parser extracts only `communication_model.edge_types`, not per-unit routing/producer contract — spec-author decision required. Not a separate §11 DoD line |
| Visual layer per design handoff | partial (scoped) | `views/graph/graph.css` `--gv-*`; `DECISIONS.md` WN-1b-c | Direction A·dark tokens scoped to `.graph-view`; full design-system adoption (theme.css swap, sidebar, settings, SSE) is a separate redesign pass |
| Suite green | built | frontend 112/112; `pnpm -r typecheck` 3/3 clean; `pnpm --filter @throughline/frontend build` clean; backend 257/257 unaffected | |

---

## Last Decision Minted

> No new T-D / C-D anchors minted (SESSION_START anchor convention — anchors are not invented mid-session). Three working notes proposed for the spec author, appended to `DECISIONS.md`: **WN-1b-a** (cross-session-mention has no data model), **WN-1b-b** (comm-model layer needs contract-source parsing), **WN-1b-c** (graph adopts design tokens scoped-only). Implementation-shape choice (dependency-free SVG renderer instead of `cytoscape.js`, under CODE_SPEC's "or similar") recorded in `CODE_SPEC.md` §18 only, per the spec-drift policy.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/frontend/src/views/GraphView.tsx` — SVG graph renderer (nodes, edges, Show-chains, pan/zoom, node→panel, empty state).
- `packages/frontend/src/views/graph/layout.ts` — pure deterministic graph model (`buildGraph`), chain analysis (`analyseChains`), layered placement (`computeLayout`).
- `packages/frontend/src/views/graph/graph.css` — GraphView-scoped Direction A·dark tokens (`--gv-*`) + styling.
- `packages/frontend/test/graphLayout.test.ts` — pure-module unit tests.
- `packages/frontend/test/graphView.test.tsx` — component/interaction tests.
- `docs/_meta/throughline/mockups/**` — design handoff (uploaded by the user, commit `2cd6bd0`) + earlier placeholder `README.md` (commit `b2e269a`).
- `docs/_meta/throughline/handovers/2026-05-17-pass-1b-graphview.md` — this handover.

**Modified:**
- `packages/frontend/src/App.tsx` — import `GraphView` from its own module instead of `stubs.js`.
- `packages/frontend/src/views/stubs.tsx` — removed the `GraphView` stub export.
- `packages/frontend/test/stubs.test.tsx` — removed the obsolete Graph-stub test (GraphView has dedicated coverage).
- `CODE_SPEC.md` — §18 graph-view bullet revised to as-built (renderer choice + deferred layers + scoped tokens).
- `DECISIONS.md` — appended "Working notes" section with WN-1b-a / WN-1b-b / WN-1b-c.
- `CHECKLIST.md` — §11 nine-view-modes row + Phase-2 stub row annotated; new "Pass 1b" section.

**Deleted:** _none_ (GraphView stub removed in-place from `stubs.tsx`, not a file delete).

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Mockup detour mid-slice | `docs/_meta/throughline/mockups/**` | Plan was approved, then paused to add a mockup folder; the user uploaded a whole-app design handoff and asked for a visual re-plan. | Placeholder committed (`b2e269a`), handoff uploaded (`2cd6bd0`), GraphView re-planned against it. Handoff has no graph screen → informs styling vocabulary only; pure-layout + SVG architecture held as predicted. |
| Design handoff is whole-app, slice is graph-only | `views/graph/graph.css` | Handoff prescribes a 10-step app-wide redesign (theme.css swap, sidebar, settings, SSE). Pass 1b is narrowly GraphView. | Tokens adopted **scoped** to `.graph-view` (`--gv-*`), nothing leaks; full adoption flagged as a separate pass (WN-1b-c). User-confirmed via question ("Graph-scoped tokens only"). |
| Two §7.11 edge types unbuildable from current data | `DECISIONS.md` | Cross-session "mentions" and comm-model emit/consume edges have no backing data model / parsed contract. | Deferred + surfaced as WN-1b-a / WN-1b-b (spec-drift "surface, do not silently resolve"); user-confirmed "Defer + spec clarification" for both. §11 DoD honesty satisfied by the functional item graph. |
| Stale handover-test on `stubs.tsx` GraphView | `test/stubs.test.tsx` | Removing the stub broke an existing typecheck (`stubs.test.tsx` imported `GraphView`). | Removed the obsolete Graph-stub test; coverage moved to `test/graphView.test.tsx`. |

---

## Open Questions

- [ ] **WN-1b-a — cross-session-mention edge.** No mention/reference relation in the `Item` model. Resolution: spec author ratifies one of (add a mention relation / redefine as shared-session co-membership / drop the §7.11 clause). Landing site: `DECISIONS.md` working note → SPEC §7.11 + item model.
- [ ] **WN-1b-b — communication-model graph layer.** Bundle parser only extracts `edge_types`. Resolution: spec author ratifies one of (extend §6 grammar+parser / approximate via primary-unit aggregation / narrow §7.11). Landing site: `DECISIONS.md` working note → bundle parser + SPEC §7.11.
- [ ] **WN-1b-c — full design-system adoption.** GraphView uses scoped `--gv-*` tokens; the rest of the app still runs the old `styles.css`. Resolution: a dedicated redesign pass implements the handoff's 10 steps and reconciles the scoped tokens into the global system. Landing site: future redesign-pass PR.
- [ ] Other v1 pre-launch verification findings (Cat-2 CHECKLIST residue beyond Cluster A, Cat-3 code-discipline, `pnpm lint` no-op, open spec Qs, flaky `companion.test.ts:294`) — untouched here; separate remediation passes (carried from Pass 1a).

---

## Recently Resolved

- **GraphView permanent stub vs checked §11 DoD bullet** — flagged in `2026-05-17-pass-1a-docs-license-sitemesh.md` as the Pass-1b open question / Cat-1 blocker; resolved by this slice (functional graph; CHECKLIST §11 row now honestly true with the two §7.11 sub-features explicitly deferred).
- **`stubs.tsx` GraphView SiteMesh-scrubbed body** — Pass 1a left the scrubbed stub in place for Pass 1b; the stub is now removed entirely.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- `useItems` / `useItemPolicy` / `useStaleThreshold` hooks, `ItemDetailPanel`, `keyboard/modalStack` — existing frontend contracts, unchanged.
- `@throughline/shared` `Item` (`parent_id`, `blockers[]`, `session_ids[]`, `methodology_drift`, `code_drift_tier`) — read-only consumption.
- Design handoff `theme.css` Direction A·dark token values — copied as scoped `--gv-*` constants.

**Downstream (consumes this slice):**
- A future design-system redesign pass — must reconcile `views/graph/graph.css` `--gv-*` into the global token system (WN-1b-c).
- Spec author — WN-1b-a / WN-1b-b decisions feed back into SPEC §7.11, the `Item` model, and the bundle parser.

---

## Reference

- Spec / decisions / build-state docs this slice operates against: `SPEC.md` (§7.11, §11), `CODE_SPEC.md` (§18), `DECISIONS.md` (T-D8; new WN-1b-a/b/c), `CHECKLIST.md` (§11, Phase 2, Pass 1b), `SESSION_START.md`.
- Design handoff: `docs/_meta/throughline/mockups/THROUGHLINE/design_handoff_throughline_ui/README.md`.
- PR: https://github.com/jaydomains/throughline/pull/26
