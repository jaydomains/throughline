<!-- Template version: 1.0 -->

# Throughline — Phase 13 (Session-start scaffolding) Handover

**Generated:** 2026-05-17 (UTC)
**Last commit SHA:** see PR head — branch `claude/throughline-phase-13-start-QVGO0` (PR not yet merged; update to merge SHA on merge)
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-16-phase-12-companion-runtime.md` (Phase 12 — Companion review runtime)

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Endpoint generates session-start prompts (C-D9, CODE_SPEC §11, SPEC §7.18) | built | `methodology/session-start/routes.ts` (`POST /api/projects/:id/session-start-prompt`, `GET …/session-start/modes`); `test/session-start.test.ts` "renders the bundle template for the chosen mode and lists open items" | |
| Companion-mode selection: bundle-declared enum + default (C-D9 step 1) | built | `engine.ts` `resolveMode`/`declaredModes`; tests "lists the bundle-declared companion modes…" + "rejects a mode the bundle does not declare" | First-declared mode is default; freeform ⇒ synthetic `default` |
| Context-assembly: spec/decisions/anchors/markers/exec-plan slice/dependencies (C-D9 step 2) | built | `engine.ts` `assemble`; tests "renders the bundle template…" + "surfaces cross-primary-unit dependencies" | Per-mode template is the exec-plan slice (C-D9 step 4); decisions = boards beyond the first declared item-type |
| Include-in-prompt directives auto-prepend (T-D12) | built | `engine.ts` `includeBlocks`; test "auto-prepends include-in-prompt directives (item + library, with note)" | Resolves item title+body / library body + optional note; prepended above the template |
| Anthropic Haiku relevance classification (SPEC §9) | built | `session-start/classifier.ts` `createAnthropicRelevanceClassifier` (default `claude-haiku-4-5`); tests "classifier tiers drive decision rendering…" + "degrades to citation-only…" | high⇒full / medium⇒citation / low⇒drop; capability-gated degrade, no call/cost without a key |
| Bundle templates section provides the prompt template (C-D9 step 4) | built | `engine.ts` `templateFor` reads `templates.session_start_by_mode[mode]`; `{{var}}` substitution, unknown placeholders blanked | Fallback chain: mode → `default` → built-in minimum template |
| One-click copy-to-clipboard (C-D9 step 5) | built | `views/GatesView.tsx` `SessionStart`; `test/gatesView.test.tsx` "Phase 13 — session-start surface generates and copies a prompt" | `navigator.clipboard.writeText` |
| Cost telemetry per assembly call (T-D29) + T-D24 fingerprint | built | `engine.ts` `recordCost` feature `session_start_assembly` + `relevance_model` audit row; test asserts exactly one cost row per fresh assembly, none on degrade/cache | Raw AI prompt never stored — only fingerprinted |
| Freeform-bound project ⇒ minimum-spec prompt | built | `engine.ts` `FREEFORM_MODE`/`MINIMUM_TEMPLATE`; test "freeform-bound project produces a minimum-spec prompt via the default mode" | |

CHECKLIST §Phase 13: all nine rows ticked with evidence.

---

## Last Decision Minted

> No new decisions minted. Implementation followed C-D9 (pipeline shape), T-D12
> (include-in-prompt directives), SPEC §7.18/§9 (Haiku, output-is-a-prompt), T-D24/T-D29
> (AI telemetry). Implementation-shape choices (no migration — the audit trail is the
> canonical assembly record and the re-render-without-AI cache, per the Phase-12
> precedent; "decisions" derived bundle-agnostically as items on boards beyond the first
> declared item-type; cache reuse is an explicit input-fingerprint comparison) are
> recorded in code headers and the Drift Flags below; none contradict C-D9 and none
> warrant a new anchor.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/shared/src/session-start.ts` — wire types (`SessionStartModesResult`, `SessionStartPromptResult`, `RelevanceClassification`, request shape).
- `packages/backend/src/methodology/session-start/classifier.ts` — Anthropic Haiku relevance classifier (capability-gated; degrades to all-medium, no cost).
- `packages/backend/src/methodology/session-start/engine.ts` — the C-D9 pipeline: mode resolve → context assemble → classify → render → audit/cost; audit-row-as-cache.
- `packages/backend/src/methodology/session-start/routes.ts` — `/session-start/modes` + `/session-start-prompt` endpoints.
- `packages/backend/test/session-start.test.ts` — modes/render/mode-validation/directive-prepend/classifier-tiers/degrade/cache/cross-unit-deps/freeform coverage.
- `docs/_meta/throughline/handovers/2026-05-17-phase-13-session-start.md` — this handover.

**Modified:**
- `packages/shared/src/index.ts` — export session-start types.
- `packages/shared/src/audit.ts` — add `session_start` to `AuditEntityType`.
- `packages/backend/src/server.ts` — construct classifier + engine; register routes.
- `packages/frontend/src/api.ts` — session-start API methods.
- `packages/frontend/src/views/GatesView.tsx` — `SessionStart` panel on the methodology surface.
- `packages/frontend/src/styles.css` — session-start styles (reuse gate/companion vocabulary).
- `packages/frontend/test/fixtures/mockApi.ts` — session-start mock methods.
- `packages/frontend/test/gatesView.test.tsx` — session-start surface test.
- `methodologies/test-bundle/bundle.md` — `session_start:standard|strict` templates extended with decisions/anchors/markers/dependencies placeholders (test fixture; exercises the full variable set).
- `CHECKLIST.md` — Phase 13 rows ticked with evidence.

**Deleted:** _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Phase-13 schema already sufficient | (no migration) | Plan assumed nothing; CODE_SPEC's "cached context… stored per session" implication could read as a new column | No migration. The latest `entity_type='session_start'`/`field='prompt_assembled'` audit row carries the input fingerprint + rendered prompt and *is* the re-render-without-AI cache (T-D45 kin; same discipline as Phase-12's "recover from audit trail"). Implementation-shape choice within CODE_SPEC §11; no functional/SPEC change |
| Cache-staleness was unspecified | `engine.ts` `assemble`/`cachedPrompt` | C-D9 says "stored… for re-render-without-AI" but never defines reuse-vs-regenerate | Made explicit (per spec-author clarification 2): an input fingerprint hashes every field that reaches the rendered prompt — mode, bundle id+version, open-item id/status/title, decision id/title/body, anchors, markers, cross-unit dep edges, include-prompt blocks. Exact match ⇒ serve cached, no Haiku call, no cost, no new audit row; any change regenerates. Time/event-based invalidation explicitly *not* used. Documented in the code header + test "re-render-without-AI…" |
| "Decisions" has no universal bundle vocabulary | `engine.ts` `assemble` | C-D9 step 2 says "decisions relevant to the active primary unit" but no bundle field names a decision type | Bundle-agnostic: decision-bearing items = items whose type is on a board beyond the first declared item-type (SiteMesh `decision`, test-bundle `note`); single-type/freeform ⇒ none. No status/type vocabulary hardcoded (consistent with C-D12) |
| test-bundle template only had 2 placeholders | `methodologies/test-bundle/bundle.md` | Fixture's `session_start` templates referenced only `{{project_name}}`/`{{open_items_list}}`, so context blocks never rendered and couldn't be tested | Extended the fixture's standard/strict templates with `{{decisions_block}}`/`{{anchors_block}}`/`{{markers_block}}`/`{{dependencies_block}}` (non-H2 to preserve the 11-section contract). No production bundle changed; SiteMesh is externalised |

---

## Open Questions

- [ ] **Companion modes ↔ review-patterns relationship** (CODE_SPEC "Questions for the spec author" #6) remains an explicit spec gap. Phase 13 proceeded per ROADMAP §Phase 13 with a bundle-declared enum + first-declared default and *no* behavioural coupling between mode and review-patterns/checklists — the mode only selects the `session_start:<mode>` template. Not silently resolved; spec confirmation would tighten the contract (e.g. whether a mode constrains which decisions/anchors are in-scope). Landing site: a spec clarification slice, or Phase 14 if a worked example forces it.
- [ ] **GatesView is becoming a multi-surface methodology view** (gate findings + companion review + session-start all render in `views/GatesView.tsx`). Flagged by the spec author as a future-polish concern — possibly merits a rename/restructure (e.g. a `MethodologyView` shell with tabbed sub-surfaces). Not Phase 13 scope. Landing site: a UI-polish slice (Phase 15 hygiene or a dedicated refactor slice).

---

## Recently Resolved

- Phase-12 handover Open Question "Phase 13 (session-start scaffolding, C-D9) remains" — closed: the pipeline is live, sharing the companion engine's `stateDigest`-style context-assembly idioms and the companion-mode parameter as anticipated.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- `methodology/loader.ts` — `resolveBundle` for `review_patterns.companion_modes` + `templates.session_start_by_mode` (Phase 7 / C-D14).
- `directives/service.ts` — `list({ kind:'include_prompt' })` for T-D12 auto-prepend (Phase 6b).
- `items/service.ts`, `library/service.ts` — item/library reads for open items, decisions, directive-parent resolution.
- `ai/anthropic.ts` — `AnthropicClient` for Haiku classification (capability-gated; no key ⇒ citation-only).
- `audit/log.ts`, `cost/telemetry.ts`, `ai/fingerprint.ts`, `ai/pricing.ts` — audit + cost + T-D24 fingerprint (T-D36, T-D29, T-D24).

**Downstream (consumes this slice):**
- Phase 14 (end-of-session retro / periodic review, §7.18, T-D22/T-D25) — the `entity_type='session_start'` audit rows are queryable hygiene/RAG input; consumer pending.
- A future UI-polish slice — may absorb the `SessionStart` panel into a restructured methodology view (see Open Questions).

---

## Reference

- Spec / decisions / build-state docs this slice operates against: `SPEC.md` (§7.18, §9), `CODE_SPEC.md` (C-D9, §11, Q#6), `DECISIONS.md` (T-D12, T-D45, T-D24, T-D29, T-D36), `CHECKLIST.md` (Phase 13), `ROADMAP.md` (Phase 13).
- PR: <link or number — fill on PR open>
