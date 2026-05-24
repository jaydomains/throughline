<!-- Template version: 1.0 -->

# Throughline — Phase 18 (Communication-model graph layer) Handover

**Generated:** 2026-05-24 (UTC, pre-merge — planned merge date)
**Last commit SHA:** see PR #31 head — branch `claude/kind-heisenberg-cQiAl` (PR not yet merged; update to merge SHA on merge). This handover is part of the Slice-5 commit, per authoring rule 1.
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-18-phase-17-item-mentions.md` (Phase 17 — Item mentions)

ROADMAP Phase 18. Resolves DECISIONS WN-1b-b — the deferred communication-model graph layer from Pass 1b. Chunked-execution PR #31, five slice commits + three inline Gitar fold-ins, single branch. Mints T-D49 (§6 grammar + per-project supply split), T-D50 (rule-level graph + coupled freshness), and C-D18 (implementation shape). SPEC §7.11 wording updated in this PR — the grammar+render scope is itself the spec answer WN-1b-b asked for. Spec-author clarification mid-phase added the "module-tier assignment is per-project" decision before Slice 2 wired settings.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Bundle §6 grammar typed (T-D49) | built | `packages/backend/src/methodology/bundle-parser/communication-model.ts`; shared types `CommunicationEdgeType` / `TierPair` / `Mechanism` / `TierRoutingRule` / `ProducerOwnership` in `packages/shared/src/bundle.ts` | H3 walker mirrors `state-machine.ts`; tier-name resolution against §2's `tiers:` at parse time |
| §2 declares tier vocabulary | built | `packages/backend/src/methodology/bundle-parser/project-layout.ts` parses the top-level `tiers:` line; `ProjectLayout.tiers: string[]` | Distinct from primary-unit `tier_rules` (C-D13) |
| Per-project supply: contract paths + module-tier assignments | built | `projects.settings_json.communication_model.{contract_sources, module_tiers}`; view endpoint at `packages/backend/src/routes/communication-model.ts` | Replace-semantics PUT; pure path-join resolution, no FS reads |
| Rule-level graph derivation (T-D50) | built | `packages/backend/src/methodology/communication-model/graph.ts` pure `deriveCommunicationGraph`; route `GET …/communication-model/graph` | Self-loops excluded; tier-routing overrides with lex-tiebreak; `producer_owns_shape` mirrors bundle |
| Coupled freshness with item set (T-D50) | built | `packages/frontend/src/views/graph/commUtils.ts` `computeCommItemsKey`; GraphView fetch effect keyed on it | Refetches on ref-set / per-ref item_count changes; not on title / status / description edits |
| GraphView fourth-layer toggle (§7.11) | built | `packages/frontend/src/views/GraphView.tsx`; `views/graph/CommunicationGraphCanvas.tsx`; `views/graph/ModulePanel.tsx`; `views/graph/communicationLayout.ts`; `views/graph/graph.css` | Tier swimlanes, mediated edges as two arrows through the mediator, `invariant: violation` styled as danger, `ModulePanel` side panel; toggle hidden when §6 = none (freeform short-circuit) |
| Mutually-exclusive with "Show chains" | built | `GraphView.tsx` disables `graph-toggle-chains` while comm mode active | Toggle on resets `selectedId` and `selectedModule` |
| SettingsView surfaces both blocks | built | `packages/frontend/src/views/SettingsView.tsx` `CommunicationModelSection` | "Configured but not yet consumed in Phase 18" hint; freeform short-circuit; per-project picker |
| Test-bundle exercises every grammar arm | built | `methodologies/test-bundle/bundle.md` §2 + §6 rewritten | mediated (via router, violation), direct-call, tier-b routing, producer-owns-shape |
| Suite green | built | backend 315/315, frontend 143/143; `pnpm -r lint`/`typecheck` clean | CHECKLIST §"Phase 18" |

CHECKLIST §"Phase 18 — Communication-model graph layer": all rows ticked. Pass-1b "Deferred — communication-model graph layer" row flipped to resolved with a back-reference; DECISIONS WN-1b-b Status flipped to resolved-via-Phase-18; SPEC §7.11 wording updated to describe the as-built render scope.

---

## Last Decision Minted

> **T-D49** ratifies the §6 grammar (typed h3 sub-sections, tier vocabulary in §2, parse-time tier resolution) and the bundle-declares / project-supplies split for both `contract_sources` and `module_tiers`. Mid-phase spec-author clarification (binding-pause resolution before Slice 2): module-tier assignment is per-project, not bundle-declared — the bundle owns the tier vocabulary; which item-derived modules sit in which tier is project-specific.
>
> **T-D50** ratifies the render semantics: rule-level edge enumeration (one edge per declared edge type expanded over module pairs whose tiers satisfy `when:`, self-loops excluded), tier-routing override application with lexicographic conflict-resolution, parse-and-carry for `invariant: violation`, and **coupled freshness with item state** (the synthesised module set re-derives when items change, since modules depend on `Item.methodology_context.primary_unit_refs`). The coupled-freshness property is a Phase-18 spec-author reframing of a Gitar mid-phase finding on the frontend — the fix was applied as a property of T-D50, not just a render bug.
>
> **C-D18** records the implementation shape: h3-walking parser, per-project view + settings endpoint with replace-semantics PUT, pure derivation function, GraphView fourth-layer toggle with `commItemsKey`-driven coupled freshness, edge-identity and key-derivation helpers in `views/graph/commUtils.ts`. Concrete-instance edges parsed from contract files and routing-invariant enforcement are explicitly deferred to a later phase.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/shared/src/communication.ts` — `CommunicationProjectSettings`, `CommunicationModelView`, `UpdateCommunicationProjectSettingsInput`, `GraphModule`, `GraphEdge`, `CommunicationGraph`.
- `packages/backend/src/methodology/communication-model/view.ts` — pure view resolver + settings reader.
- `packages/backend/src/methodology/communication-model/graph.ts` — pure rule-level derivation.
- `packages/backend/src/routes/communication-model.ts` — view GET, settings PUT, graph GET.
- `packages/backend/test/communicationModel.test.ts` — §6 parser cases.
- `packages/backend/test/communicationView.test.ts` — resolver + view + settings round-trip.
- `packages/backend/test/communicationGraph.test.ts` — derivation + graph route.
- `packages/frontend/src/views/graph/communicationLayout.ts` — pure swimlane layout for the comm canvas.
- `packages/frontend/src/views/graph/CommunicationGraphCanvas.tsx` — SVG renderer.
- `packages/frontend/src/views/graph/ModulePanel.tsx` — side panel.
- `packages/frontend/src/views/graph/commUtils.ts` — shared `edgeId` + `computeCommItemsKey`.
- `packages/frontend/test/communicationCanvas.test.tsx` — layout + canvas + panel + GraphView integration + coupled-freshness key derivation.
- `docs/_meta/throughline/handovers/2026-05-24-phase-18-communication-model.md` — this file.

**Modified:**
- `packages/shared/src/bundle.ts` — `CommunicationEdgeType`, `TierPair`, `Mechanism`, `TierRoutingRule`, `ProducerOwnership`; `ProjectLayout.tiers: string[]`; replaces the placeholder `edge_types?: string[]` shape.
- `packages/shared/src/index.ts` — re-export `./communication.js`.
- `packages/backend/src/methodology/bundle-parser/communication-model.ts` — h3-walking grammar reader (rewritten from the bullet extractor).
- `packages/backend/src/methodology/bundle-parser/project-layout.ts` — parses top-level `tiers:` line.
- `packages/backend/src/methodology/bundle-parser/index.ts` — threads §2 tiers into §6 parser for parse-time resolution.
- `packages/backend/src/server.ts` — wires the new routes.
- `methodologies/test-bundle/bundle.md` — §2 `tiers: tier-a, tier-b`; §6 rewritten to typed grammar (mediated via router, direct-call, tier-b routing, producer-owns-shape).
- `packages/frontend/src/api.ts` — `getCommunicationModel`, `updateCommunicationModel`, `getCommunicationGraph`.
- `packages/frontend/test/fixtures/mockApi.ts` — corresponding mocks (default returns freeform-shape empty).
- `packages/frontend/src/views/SettingsView.tsx` — `CommunicationModelSection` per-project picker + contract-source inputs + module-tier dropdowns; `viewRef` pattern to close stale-view-state at the call sites (Slice-3 fold-in).
- `packages/frontend/src/views/GraphView.tsx` — "Show communication model" toggle, mode swap, freeform short-circuit, coupled-freshness fetch effect.
- `packages/frontend/src/views/graph/graph.css` — lane dividers + labels, comm-edge / mediated / routed / violation styling, module-panel layout.
- `packages/frontend/test/settingsView.test.tsx` — communication-model section behaviour (declared + freeform short-circuit).
- `SPEC.md` — §7.11 communication-model wording; §14 T-D49 + T-D50 rows.
- `DECISIONS.md` — T-D49 + T-D50 full sections; WN-1b-b status flipped with Resolution paragraph.
- `CODE_SPEC.md` — C-D18 full section; §18 graph-view bullet updated.
- `CHECKLIST.md` — Pass-1b row flipped; new Phase 18 section.

**Deleted:** _none_.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Slice-2 stale-view in `save()` closures | `views/SettingsView.tsx` | Plan's `save()` did fire-and-forget `load(sel)` after PUT; Gitar flagged that the call-site closures spread render-time `view`, racing under rapid edits | Initial fold-in (commit `0734e73`) made `load()` awaitable + `save()` awaits it. Spec-author then directed a structural follow-up: `viewRef` + one-key patch shape at the call sites so no `...view.*` spread captures stale state. Resolved on PR #31 (commit `61834ff`) |
| Slice-4 duplicated `edgeId` helper | `views/graph/CommunicationGraphCanvas.tsx`, `views/graph/ModulePanel.tsx` | Same `edgeId(e: GraphEdge): string` body in two files | Extracted to `views/graph/commUtils.ts`, both files import. Resolved on PR #31 (commit `c96ed73`) |
| Slice-4 comm graph not refreshed when items change | `views/GraphView.tsx` | Fetch only on mount/projectId; comm graph went stale relative to the item graph when items were added/removed | Spec-author reframed as a T-D50 render property (coupled freshness, not refresh bug). Added `computeCommItemsKey(items)` in `commUtils.ts` projecting items to `ref:count|…`; GraphView fetch effect depends on `[projectId, commItemsKey]` so it refetches on module-set / item-count changes only. Resolved on PR #31 (commit `c96ed73`) |
| Plan binding-pause: module-tier assignment ambiguous | `packages/shared/src/communication.ts`, `views/SettingsView.tsx` | Plan didn't pin where module → architectural-tier mapping lived. Surfaced after Slice 1 | Spec-author decided per-project: bundle owns tier vocabulary, project supplies which modules sit in which tier. Folded into Slice 2 alongside `contract_sources`. Documented in T-D49 |

---

## Open Questions

- [ ] **Concrete-instance edges from parsed contract files.** Phase 18 ships parse-and-render only. The `contract_sources` paths the project supplies persist in settings but are never read; the SettingsView surface makes this explicit ("configured but not yet consumed"). A later phase wires the ingestion: read each contract file at its resolved path, parse it for emit/consume declarations, lift them into instance-level edges over the same module set. Landing site: a future communication-model-instances phase.
- [ ] **Routing-invariant enforcement.** `invariant: violation` is parsed-and-carried on every emitted edge and rendered as a styling hint; Phase 18 does not enforce. Enforcement would turn instantiated `invariant: violation` edges into discipline-drift signals (C-D7 stream). Landing site: same future phase as above, or its own discipline-drift slice.
- [ ] **Two-rule tier-routing conflict semantics.** Phase 18 resolves conflicts deterministically by lexicographic tier-name precedence and surfaces the winning tier via `mechanism_overridden_by_tier`. The renderer shows the winning tier; it doesn't surface "two rules disagreed." If real bundles produce conflicts in practice, a future slice could add a warning surface (linter / UI badge / methodology-gate firing). Landing site: TBD when a real bundle hits this.
- [ ] **In-app bundle authoring for §6.** T-D41 defers in-app bundle authoring to v2. Until then, §6 grammar mistakes surface as bundle-load errors with a section attribution; the user edits the bundle file directly and the loader re-parses on save (C-D14 watch parity).

---

## Recently Resolved

- **WN-1b-b — Communication-model graph layer needs contract-source parsing** — flagged in `2026-05-17-pass-1b-graphview.md` Open Questions and carried through every handover since. Resolved here: spec-author chose candidate (1) with a scope split (rule-level layer now, instance-level deferred). DECISIONS WN-1b-b Status flipped to "resolved — implemented in Phase 18"; CHECKLIST Pass-1b deferred row flipped. T-D49, T-D50, C-D18 minted.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):** `bundle-parser/sections.ts` (`parseKeyValueLines`, `isNoneBody`); `state-machine.ts` h3-walker convention (mirrored, not imported); `items/service.ts` `modules()` (C-D13) for the synthesised module set; `projects/service.ts` `update()` settings_json wholesale-replace semantics; `MethodologyRegistry.resolveBundle()` (C-D14); GraphView toolbar / canvas / pan-zoom plumbing; settings-panel `Section` / `TextSetting` / `NumberSetting` helpers. All read-only / additive.

**Downstream (consumes this slice):** future communication-model-instances phase (reads `contract_sources` resolved paths; parses contract files; emits instance-level edges); future routing-invariant-enforcement phase (consumes `invariant: violation` on edges; emits discipline-drift signals); any consumer reading `CommunicationModel.edge_types[]` / `.tier_routing[]` / `.producer_ownership` from the shared types. **Breaking type change** for the §6 model: `edge_types: string[]` placeholder is replaced with `edge_types: CommunicationEdgeType[]`. Pre-Phase-18 callers were the parser itself (no external consumers in tree); migration is purely the bundle markdown — re-author §6 against the typed grammar. The freeform bundle stays `none` (no migration needed).

---

## Reference

- Docs operated against: `SPEC.md` (§7.11 wording updated, §14 T-D49 + T-D50 minted), `CODE_SPEC.md` (C-D18 minted, §18 graph-view bullet updated), `DECISIONS.md` (T-D49 + T-D50 full sections, WN-1b-b resolved), `CHECKLIST.md` (Pass-1b row flipped, Phase 18 section added), `SESSION_START.md`, `HANDOVER_TEMPLATE.md`.
- PR: #31 — https://github.com/jaydomains/throughline/pull/31
