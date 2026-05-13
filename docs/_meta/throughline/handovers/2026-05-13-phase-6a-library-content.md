<!-- Template version: 1.0 -->

# Throughline — Phase 6a Handover

**Generated:** 2026-05-13 (pre-merge)
**Last commit SHA:** see PR head — 2026-05-13
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-13-phase-5-reconcile.md` (Phase 5 — reconcile engine)

Phase 6 was sliced into 6a / 6b / 6c at session author's direction. 6a (this slice) lands the library content surface: full CRUD across the four T-D10 content types, T-D9 notes↔items many-to-many, FTS5-backed full-text search, a stubbed semantic-search route ready for Phase 11/14 to fill, `{{var_name}}` prompt placeholder fill, cross-project library toggle, and full audit-log producer coverage. 6b will deliver directives + reminders + the OS notification capability layer; 6c will deliver folder-opt-in repo `.md` ingestion with AI summarisation and tracked re-ingest.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Library has four content types: notes, prompts, snippets, imported docs (T-D10) | built | `packages/shared/src/library.ts` `LIBRARY_ENTRY_TYPES`; `packages/backend/src/library/service.ts` full CRUD; `packages/frontend/src/views/LibraryView.tsx` per-type `EntryEditor` rendering; backend test "creates entries of each of the four types" | All four types share the same row schema with `type` discriminator. Per-type behaviour lives in the editor (read-only imported docs, copy button on snippets, prompt-fill on prompts, attach-to-item on notes). |
| Notes ↔ items many-to-many (T-D9) | built | `packages/backend/src/library/service.ts` `attach / detach / listAttachedItems / listAttachedNotes`; `AttachNotANoteError` enforces type='note'; `CrossProjectAttachError` enforces same-project pairing; `packages/frontend/src/components/{AttachItemModal,AttachNoteToItemModal}.tsx` for both directions; backend tests cover idempotency + T-D9 guard + cross-project guard | UI mounts the attach modal both from the library editor (pick items for this note) and the item detail panel (pick notes for this item). |
| Prompts support `{{var_name}}` placeholders with fill-in modal | built | `packages/shared/src/library.ts` `extractPromptVariables` + `renderPromptBody`; `packages/backend/src/library/service.ts` `fillPrompt`; `packages/frontend/src/components/PromptFillModal.tsx`; backend "prompt-fill substitutes placeholders and reports missing variables" + frontend "renders the prompt fill modal and copies the rendered output" | Shared helpers prevent the backend's render path and the frontend's input generation from drifting on which token shape counts as a variable. Missing values render as empty strings; `missing_vars` returns alongside `rendered`. |
| Snippet quick-copy button always visible | built | `LibraryView.tsx` `EntryEditor` Copy button for `type='snippet'`; uses `navigator.clipboard.writeText(entry.body)`; "snippet quick-copy writes the body to clipboard" frontend test | Visible at the top-right of the editor when a snippet is selected; emits a 1.5s toast on success. |
| Library entry full-text search | built | `0004_library_extensions.sql` FTS5 virtual table + sync triggers; `library/service.ts` `search()`; `LibraryView.tsx` debounced search input; backend "FTS search returns matches scoped per project" + "FTS search finds matches in body and tags" + frontend "search input debounces and routes to the FTS endpoint" | FTS over title + body + tags_text (space-joined from `tags_json`). Triggers keep the index in sync on insert/update/delete. First consumer of the FTS5 + sync-triggers convention. |
| Library entry semantic search routed (placeholder for Phase 11/14) | built | `library/service.ts` `semanticSearch()`; `POST .../library/semantic-search` route; backend "semantic-search returns the stub envelope" | Returns `{ entries: [], via: 'semantic-stub', truncated: false }`. The route exists today so Phase 11 (Semble for code-related) / Phase 14 (local embeddings for text) can fill it without route churn. |
| Cross-project library toggle | built | `LibraryView.tsx` `library-scope-toggle`; `listLibrary(projectId, { scope: 'global' })` and `search({ scope: 'global' })` propagate through to backend; backend "returns global-scope list across projects when projectId is null" + frontend "cross-project toggle issues a global-scope search" | The toggle is a single checkbox in the sidebar. Default is per-project (consistent with the convention that surfaces are project-scoped by default with explicit cross-project opt-in). |
| Library entries audit-logged (T-D36) | built | `library/service.ts` calls `appendAudit` on `create / update / delete / attach / detach`; per-field audit rows on update; backend "update mutates fields and audit-logs each change" | Title/body/tags/summary changes each write a separate audit row so the audit substrate has the granularity Phase 14 hygiene queries need. |
| Item detail panel surfaces attached notes (T-D9 from items side) | built | `packages/frontend/src/components/ItemDetailPanel.tsx` "Attached notes" section with detach button + AttachNoteToItemModal trigger | The existing Phase 3 placeholder for "directives in Phase 6" is now narrowed to "directives in Phase 6b". |

---

## Last Decision Minted

No new T-D anchors. Implementation followed existing decisions: T-D9 (notes ↔ items M2M), T-D10 (four content types), T-D36 (audit-log scope covers library), §13 adopted defaults (`{{var_name}}` prompt syntax).

Conventions adopted (apply going forward):

- **PATCH for partial updates with optional fields in the body.** First Throughline consumer here (`PATCH /api/projects/:id/library/:entryId` with `UpdateLibraryEntryInput`). Future phases follow this REST convention; the equivalent shape for items (`updateItem`) was already PATCH but used a wider input type that wasn't formalised. Future phases authoring update endpoints should default to PATCH + optional fields rather than POST or PUT.
- **Shared helpers for token grammar between backend and frontend.** `extractPromptVariables` + `renderPromptBody` live in `packages/shared/src/library.ts` so the prompt-fill modal's input-field generation and the backend's render path use the same regex and the same substitution semantics. Future surfaces with structured token grammars (Phase 13 session-start templates, Phase 12 companion-review template parsers) should adopt the same pattern: parse + render helpers in `shared`, with backend and frontend consuming them rather than re-implementing.
- **FTS5 virtual table + sync triggers for full-text search.** First consumer for the library; Phase 7+ item-search and Phase 14 RAG text substrate can either reuse this pattern (FTS5 + content-shadow + INSERT/UPDATE/DELETE triggers) or layer on top once embeddings ship. Note that FTS5 `MATCH` does not accept table aliases — `library_entries_fts MATCH ?` is required, not `f MATCH ?` (caught during 6a; documented inline in `service.ts`).
- **Search-stub routes exist today; substrates fill in their respective phases.** `semanticSearch()` returns `via: 'semantic-stub'` rather than 404. The frontend wires against a real surface so Phase 11/14 can plug in without route churn. Pattern: when a surface is named in the spec but the substrate that fills it lands later, ship the stub return today so the UI and consumers are real.
- **Validate-then-transact for ownership-against-the-route-context.** Continued from Phase 5: `attach` validates the note + item belong to the same project before any insert. `CrossProjectAttachError` surfaces as HTTP 422.
- **Cross-package type ownership.** When the Phase 4 capture types added a `LibraryEntry` placeholder, the comment said "Phase 6 owns the full surface". This slice executed that: `LibraryEntry / LibraryEntryType / CreateLibraryEntryInput` moved from `shared/capture.ts` to `shared/library.ts`. Six import sites updated, no re-export bridge needed (the 20-site threshold for keeping a bridge per session author's direction). The pattern: when types outgrow their original module, move them, count import sites, and choose move-vs-bridge based on count.

---

## Active Blockers

_none_

Provisional / parked items:
- **Pinned-sticky rendering across all list views.** Phase 6b will introduce the pin directive. 6a's library sidebar + the item detail panel both already render every entry without sticky-on-pinned behaviour; 6b will add sticky logic where it applies (session board for items, library sidebar for library entries). Sticky on tree/graph/modules deferred to those views' own polish slices.
- **Imported-doc rendering today is read-only markdown without summary.** When 6c populates `library_entries.summary` on import, the editor surfaces it above the body (already wired — `EntryEditor` renders the summary section when set). Until 6c lands, the column stays null for entries the user creates manually.

---

## Files Changed Since Last Handover

**New (backend):**
- `packages/backend/src/db/migrations/0004_library_extensions.sql` — `item_attached_notes.attached_at` column, reverse-lookup index on `library_entry_id`, `library_entries.summary` column, FTS5 virtual table + insert/update/delete sync triggers.

**New (frontend):**
- `packages/frontend/src/views/LibraryView.tsx` — three-pane library view (sidebar filter/search/list + main editor); replaces the Phase 4 stub.
- `packages/frontend/src/components/PromptFillModal.tsx` — `{{var_name}}` fill flow with copy-to-clipboard.
- `packages/frontend/src/components/AttachItemModal.tsx` — pick items to attach a note to (library-editor side).
- `packages/frontend/src/components/AttachNoteToItemModal.tsx` — pick notes to attach to an item (item-detail-panel side).
- `packages/frontend/src/components/TagChipsEditor.tsx` — reusable tag chip editor; first consumer is the library editor, expected to be re-used by 6b directive modal + item detail panel polish.

**New (shared):**
- `packages/shared/src/library.ts` — `LibraryEntry / LibraryEntryType / CreateLibraryEntryInput / UpdateLibraryEntryInput / AttachedItemSummary / LibrarySearchRequest / LibrarySearchResult / PromptFillRequest / PromptFillResult` + `LIBRARY_ENTRY_TYPES` array + `isLibraryEntryType` guard + `extractPromptVariables` + `renderPromptBody` helpers.

**New (tests):**
- `packages/backend/test/library.test.ts` — rewritten from the Phase 4 stub; 18 tests covering CRUD, audit, attach/detach with T-D9 + cross-project guards, FTS search per-project + global, semantic-stub envelope, prompt-fill rendering + missing-var reporting.
- `packages/frontend/test/library.test.tsx` — 9 tests covering renderer + type filter + debounced search + cross-project scope + prompt-fill modal + snippet copy + attach modal + title PATCH + attached-items section.

**Modified:**
- `packages/backend/src/library/service.ts` — full rewrite from the Phase 4 minimal stub; new error classes (`AttachNotANoteError`, `CrossProjectAttachError`, `NotAPromptError`, `LibraryEntryNotFoundError`, `ItemNotFoundError`).
- `packages/backend/src/library/routes.ts` — `PATCH / DELETE` + `POST/DELETE attach/:itemId` + `GET attached-items / attached-notes` + `POST prompt-fill` + `POST search / semantic-search`.
- `packages/backend/test/dumpZone.test.ts` — adjusts `library.list(project.id)` to the new filter-object signature.
- `packages/shared/src/capture.ts` — removes the placeholder `LibraryEntry` types; imports `LibraryEntryType` from `library.ts` for the still-living `ProposedLibraryEntry` shape.
- `packages/shared/src/index.ts` — exports `./library.js`.
- `packages/frontend/src/api.ts` — adds `getLibraryEntry / updateLibraryEntry / deleteLibraryEntry / attachLibraryNote / detachLibraryNote / listAttachedItems / listAttachedNotes / fillPrompt / searchLibrary / semanticSearchLibrary`; extends `listLibrary` with `{ type?, scope? }` opts.
- `packages/frontend/src/App.tsx` — imports `LibraryView` from its new home (`views/LibraryView.js`).
- `packages/frontend/src/views/stubs.tsx` — removes the now-moved `LibraryView` and its now-unused imports.
- `packages/frontend/src/components/ItemDetailPanel.tsx` — replaces the Phase 6 placeholder section with a live "Attached notes (T-D9)" list + attach modal trigger.
- `packages/frontend/src/styles.css` — promotes the modal `:where(...)` form-row selector to include prompt-fill and attach modals; appends Phase 6a library styles.
- `packages/frontend/test/fixtures/mockApi.ts` — state-backed library mocks for the new methods + `seedLibraryEntry` + `seedAttachment` helpers; `applyDumpZone` populates `summary: null` on created entries.
- `packages/frontend/test/stubs.test.tsx` — drops the `LibraryView` import (it's no longer a stub).
- `CHECKLIST.md` — ticks the nine 6a rows with evidence pointers; reorganises §Phase 6 under the three sub-PR labels (6a / 6b / 6c) so the slicing is legible from the build state.

**Deleted:** _none_.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| FTS5 `MATCH` table-alias syntax | `packages/backend/src/library/service.ts` | First implementation used `library_entries_fts f` + `f MATCH ?` — FTS5 does not accept aliases on the left side of `MATCH` and errors with "no such column: f". Caught by backend test "FTS search returns matches scoped per project". | Refactor to use the literal table name on the MATCH expression. Documented inline as a future-author guard. |
| `library.list()` signature change | `packages/backend/test/dumpZone.test.ts` | Phase 4 stub was `list(projectId: string)`; the 6a rewrite takes a filter object (`{ projectId, type? }`) so the global-scope path can pass `projectId: null`. One existing test caller (in `dumpZone.test.ts`) needed the new shape. | Updated the call site. No production code outside `library/service.ts` consumes `list` directly. |
| Cross-package type ownership for `LibraryEntry` | `packages/shared/src/{capture,library}.ts` | Phase 4 placed `LibraryEntry / LibraryEntryType / CreateLibraryEntryInput` in `capture.ts` with a comment that Phase 6 would move them. 6a executes the move. | Six import sites updated. Re-export bridge skipped because the count is well under the 20-site threshold per session-author direction. `ProposedLibraryEntry` in `capture.ts` now imports `LibraryEntryType` from `library.ts`. |
| `userEvent.setup()` clipboard polyfill | `packages/frontend/test/library.test.tsx` | First attempt to mock `navigator.clipboard.writeText` used `Object.defineProperty(navigator, 'clipboard', ...)` — fails because user-event v14's `setup()` installs its own clipboard polyfill which subsequent `defineProperty` calls either silently fail or get overwritten. | `vi.spyOn(navigator.clipboard, 'writeText')` AFTER `userEvent.setup()` runs is the working pattern. Documented inline in the two affected tests. Future tests touching clipboard should use this pattern. |
| Imported-doc summary scaffolding lands ahead of producer | `packages/backend/src/db/migrations/0004_library_extensions.sql` + `LibraryView.tsx` | The `summary` column + the editor's read-only summary section both land in 6a, but the producer (AI-summarisation on import) lands in 6c. | Accepted as scaffolding. The column is null for entries the user creates manually; 6c populates it on `.md` import. Editor renders the summary section only when non-null, so the UX degrades gracefully. |

---

## Open Questions

- [ ] **Cross-project library scope toggle granularity.** SPEC §7.8 says "All library entries support full-text search …" without naming whether the global cross-project view is the default. v1 defaults to per-project; the toggle is an explicit UI control. Flag for spec-author confirmation in a future cycle.
- [ ] **Imported-doc summary on manual creation.** When a user manually creates an `imported_doc` library entry (not via 6c repo ingestion), the summary stays null. Is that the right behaviour, or should the editor expose a "summarise this" action that calls Anthropic? Probably the latter; flagged for 6c or a Phase 14 hygiene slice.
- [ ] **TagChipsEditor consolidation.** The library editor uses `TagChipsEditor`; the item detail panel still uses its inline add-tag form. A future polish slice should switch the panel to `TagChipsEditor` for consistency. Not blocking.
- [ ] **PATCH-with-optional-fields convention discovery.** Phase 6a writes this convention down; existing endpoints (`updateItem`, `updateSession`) already match it informally. Future endpoint authors will follow it; the convention may earn a brief callout in `CODE_SPEC.md` if the pattern surfaces a question.

---

## Recently Resolved

- **Phase 5 open question: "Library scoped per project."** — already implemented at the schema level in Phase 1; 6a confirms it surfaces correctly in the UI with the cross-project toggle as the documented escape hatch.
- **Phase 4 deferral: "Library entry update / delete / attach-to-item / search land in Phase 6."** — done in 6a.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- Phase 1 backend: project + audit log + migration runner (FTS5 is enabled via SQLite's bundled support; no new compile flags).
- Phase 3 backend: items service is queried to validate cross-project attach and to build the attach-modal item list.
- Phase 4 capture: the library dump zone still mounts at the top of `LibraryView` and writes through the same `createLibraryEntry` API that 6a extends.
- Phase 4 conventions: `useModalRegistration`, `form-row` / `form-actions` CSS reuse, click-outside backdrop pattern.

**Downstream (consumes this slice's work):**
- **Phase 6b directives.** Directive CRUD will live next to library entries (both project-scoped, both audit-logged). The shared modal styles + `TagChipsEditor` are likely consumers. The "Directives (n)" header hint will count rows from `directives` joined against parent type. Reminder rows depend on `next_fire_at` indexing — already present in `0001_init.sql`.
- **Phase 6c repo .md ingestion.** Imported-doc creation goes through `library.create({ type: 'imported_doc', ..., summary, source_path })`. The `summary` column and the editor's summary section are ready; the `source_path` + `tracked` + `source_mtime` + `source_hash` columns land in 6c's migration `0006_library_md_folders.sql`.
- **Phase 11 Semble.** `semanticSearch()` routing currently returns the stub; the route + envelope shape are ready for Semble to fill in for code-related queries.
- **Phase 13 session-start.** `LibraryEntry` of type `prompt` with `include_in_prompt` directives (Phase 6b) will feed the session-start prompt assembly. The shared `extractPromptVariables` / `renderPromptBody` helpers are likely consumers.
- **Phase 14 RAG text substrate.** FTS5 patterns + `text_embeddings` blob storage (already in `0001_init.sql`) compose with the library content surface that 6a built; Phase 14's local-embeddings call replaces the semantic-search stub.
- **Phase 14 periodic-review hygiene.** Audit-log rows produced by `library.create / update / attach / detach` feed "library entries created since last review", "notes attached but never edited" hygiene queries.

---

## Reference

- Specs operated against: `SPEC.md` §7.8 (library), §7.10 (directives — partial; 6b lands the rest), §13 (adopted defaults: `{{var_name}}`), §15 (degrade-gracefully); `CODE_SPEC.md` §3 (schema rows), §16 (audit log); T-D9, T-D10, T-D36, T-D47; ROADMAP §Phase 6.
- Previous handover: `docs/_meta/throughline/handovers/2026-05-13-phase-5-reconcile.md`.
- PR: filled in at PR open.
