# Throughline v1 — Build Checklist

Read at session start. Update at session end. One section per ROADMAP phase. Items are intentionally implementation-light — the *what*, not the *how*.

When a phase completes, leave its section in place so the build-state record is preserved.

---

## Phase 0 — Repo bootstrap & v5.1 documentation regeneration

- [x] SPEC.md v5.1 in place (no edits this session)
- [x] DECISIONS.md regenerated against v5.1 §14 (48 T-D anchors)
- [x] Existing T-D bodies renumbered to match new §14 numbering
- [x] T-D10 refined to call out four-content-types + whiteboards-deferred wording
- [x] T-D21 expanded to the two-stream framing (code-drift + discipline-drift)
- [x] T-D26 refined for bundle-defined verifier-rule conventions
- [x] T-D33 refined for bundle-defined verifier-rule type/storage
- [x] T-D35 refined: "edited (covers title and description under one row)"
- [x] T-D36 expanded to projects + methodology bindings + gate firings
- [x] T-D38 refined: items reference PRs (not branches as first-class fields)
- [x] T-D39–T-D48 authored with full bodies
- [x] Rationale-needed markers preserved where the rationale isn't recoverable
- [x] CODE_SPEC.md regenerated against v5.1 (methodology runtime + project model + bundle parsing + gate runtime + discipline-drift + companion runtime + session-start scaffolding)
- [x] C-D1 and C-D2 preserved
- [x] C-D3 through C-D9 authored
- [x] CODE_SPEC.md Questions for the spec author surfaces remaining gaps
- [x] ROADMAP.md regenerated against v5.1 (sixteen phases, runtime-first)
- [x] CHECKLIST.md regenerated to match the new ROADMAP
- [x] README.md reframed to describe Throughline as a methodology runtime
- [x] §13 recommended defaults adopted at the relevant phases
- [x] §13 open questions without recommended defaults flagged with build-time fallbacks

---

## Phase 1 — Backend skeleton, datastore, project model, bundle loader, freeform bundle

- [x] Backend bootstraps via documented single command (`pnpm dev` / `pnpm --filter @throughline/backend start`)
- [x] Backend binds to 127.0.0.1 only
- [x] Health endpoint responds (`/health` returns ok, paths, secrets presence)
- [x] SQLite datastore file created on first run
- [x] Migration runner applies in order, records to `_migrations` table
- [x] All schema tables present per CODE_SPEC.md §3
- [x] `projects` table with non-nullable `bundle_id` foreign key (T-D47)
- [x] All per-project entity tables carry `project_id`
- [x] Audit log records mutations across items, library entries, projects, bundle bindings, gate firings, checklist steps (tables + helper in place; producers wired for projects, settings, and bundle bindings this phase; items/library/gate-firings/checklist-step producers wire up in later phases)
- [x] Cost telemetry table receives stub writes scoped per project (table + `recordCost` helper exist; producers wire up when AI features land in Phase 4+)
- [x] Settings load/save round-trips via REST (GET/PUT `/api/settings`)
- [x] Secrets file separation honoured: API keys never written to datastore (`~/.throughline/secrets.json`; settings layer rejects secret-looking keys)
- [x] Bundle discovery scans `methodologies/` on backend start
- [x] Bundle parser walks eleven H2 sections in order
- [x] Typed section parsers produce `LoadedBundle` objects
- [x] Structural validation errors fail loudly (logged + exposed via `/api/methodologies` per-bundle `status: 'error'` payload; UI banner deferred to Phase 2)
- [x] `methodologies/freeform/bundle.md` ships with the install and loads cleanly
- [x] Freeform bundle's "no primary unit / no anchors / no markers / no gates / no companion modes" declarations parse as legitimate
- [x] Project create/archive/delete functional via REST + minimal CLI (switch endpoint deferred to Phase 2 per plan amendment — no UI consumer yet)
- [x] Project create defaults bundle binding to `freeform`
- [x] Bundle file change triggers re-load with audit-log entry per affected project
- [x] Login auto-start documented per platform (`docs/install/auto-start.md`)

---

## Phase 2 — Browser UI shell & nine view-mode plumbing

- [x] React app served by backend at `/` (`packages/backend/src/routes/web.ts` resolves `packages/frontend/dist`; smoke test served `index.html` + hashed assets + SPA fallback)
- [x] Project switcher in header lists and switches projects (`packages/frontend/src/components/ProjectSwitcher.tsx`; calls `POST /api/projects/:id/switch` to persist `last_active_project_id`)
- [x] All nine view-mode routes render an empty stub under `/projects/:id/...` (`packages/frontend/src/App.tsx` routes; `src/views/stubs.tsx`) <!-- Phase 2 shipped routes as stubs; each was later built out. The graph route's permanent stub is superseded by Pass 1b — see the Pass 1b section. -->

- [x] Modules view mode hidden for projects whose bundle declares no primary unit (`ViewToggle` filters via `VIEW_MODES[].visibleFor`; `ModulesView` guard redirects on direct nav; verified by `test/viewToggle.test.tsx`, `test/stubs.test.tsx`)
- [x] Methodology-gates view mode hidden for projects whose bundle declares no gates (same mechanism; verified by `test/viewToggle.test.tsx`, `test/stubs.test.tsx`)
- [x] Header view-mode toggle switches routes (`packages/frontend/src/components/ViewToggle.tsx`; NavLinks per view mode)
- [x] Header includes scratchpad placeholder, cost meter placeholder, backup indicator placeholder (`packages/frontend/src/components/Header.tsx` + `ScratchpadPlaceholder.tsx`; real behaviour wires up in Phases 4 / 15)
- [x] Command palette opens/closes via `Cmd+K` / `Ctrl+K` (`useHotkey('mod+k')` in `App.tsx`; `CommandPalette.tsx`)
- [x] Command palette fuzzy-search infrastructure ready (`fuse.js` over project / view / action items; verified by `test/commandPalette.test.tsx`)
- [x] Command palette can jump across projects (project entries always indexed regardless of active project)
- [x] Keyboard navigation primitives in place (tab/shift-tab indent, arrow nav, Esc close, `?` reference) — Esc + `?` + `Cmd/Ctrl+K` global hotkeys wired this phase via `src/keyboard/{useHotkey.ts,modalStack.tsx,registry.tsx}`; Tab/Shift-Tab + arrow consumer registration deferred to Phase 3 list rows, but the bindings are registered in the help modal so the contract is in place. **Phase 3 update:** arrow consumers now live in `ItemDetailPanel.tsx` (cycle through parent list while panel stays open). Tab/Shift-Tab indent consumers still pending the in-row reparent UI; the bindings continue to register globally with the documented contract.
- [x] SSE channel established and demonstrates ping/pong (`packages/backend/src/routes/events.ts` emits `welcome` + 15s `ping`; `packages/frontend/src/hooks/useSSE.ts` consumes; live-channel pill in header reflects connection state; verified by `test/server.test.ts`)
- [x] Backend-down state shows a banner rather than crashing (`packages/frontend/src/hooks/useBackendHealth.ts` polls `/health` every 10s; `DownBanner` renders on failure)

---

## Phase 3 — Items, sessions, manual entry, item detail panel

- [x] Item create / read / update / delete via UI within a project (`packages/backend/src/items/{service,routes}.ts`; `packages/frontend/src/components/{Board,ItemRow,ItemDetailPanel}.tsx`; verified by `test/items.test.ts`, `test/sessionView.test.tsx`)
- [x] Session create / read / update / delete within a project (`packages/backend/src/sessions/{service,routes}.ts`; `packages/frontend/src/views/SessionsIndex.tsx`; verified by `test/sessions.test.ts`, `test/sessionView.test.tsx`)
- [x] Item-session many-to-many membership works (`items.addSessionMembership` / endpoint `POST /api/projects/:id/items/:itemId/sessions/:sessionId`; `GET /api/projects/:id/items?session_id=` filters per session; verified by `test/items.test.ts` "lists items filtered by session membership")
- [x] Item types come from the active project's bundle (freeform: `task`) (`packages/backend/src/items/policy.ts`; `GET /api/projects/:id/policy` exposes; verified by `test/items.test.ts` "returns freeform policy")
- [x] Status lifecycle enforced per bundle declaration (freeform: `open`/`done`) (`createItemsService.update` validates against `bundleItemPolicy`; rejects unknown statuses with `ItemPolicyError`)
- [x] Free-text blocker description field functional (`items.blocker_text` column; detail panel field; verified by `test/items.test.ts` T-D8 row)
- [x] Structured blocker references functional (`item_blockers` table; `addBlocker`/`removeBlocker`; self-block + cycle guards)
- [x] Tags add/remove (`item_tags` table; `addTag`/`removeTag` with audit; detail panel UI)
- [x] Parent/child nesting renders to arbitrary depth (`items.parent_id`; cycle check on parent update; tree view groups by parent)
- [x] Branch reference free-text field on items (auto-populates from session, override available) (`items.branch_ref` column; detail panel input; auto-populate from active session lands when a session UI sets a default — column + UI in place)
- [x] Bundle-defined boards render correctly (freeform: single board called "tasks") (`bundleItemPolicy` returns `[{id:'tasks',label:'Tasks',type:'task'}]`; `Board.tsx` renders per-policy)
- [x] Item detail panel slides in from right (`packages/frontend/src/components/ItemDetailPanel.tsx` + `.detail-panel.open` CSS)
- [x] Detail panel arrow-key navigation through parent list (`useHotkey('arrowdown'|'arrowup')` cycles `siblings`; verified by `test/sessionView.test.tsx` "opens the detail panel on item click and cycles via arrow keys")
- [x] Detail panel shows: status, tags, blockers, branch ref, methodology context (placeholder until bundle declares fields), code refs (placeholder), verifier rules (placeholder), directives (placeholder), audit history, linked items, git context (`ItemDetailPanel.tsx` renders every section; placeholders labelled with their landing phase)
- [x] Stale yellow flag renders in detail panel header per stale threshold (`isStale(item.updated_at, days)` from `useStaleThreshold`; default 14 days; setting key `stale_threshold_days`)
- [x] Stale yellow flag renders next to item titles in list views (`ItemRow.tsx` + `TreeView.tsx`; verified by `test/sessionView.test.tsx` stale-flag test)
- [x] Manual entry inline form is keyboard-driven (`Board.tsx` inline form: focus → type → Enter creates; Esc clears draft)
- [x] All lifecycle transitions audit-logged (`appendAudit` called on every item + session mutation; verified by `test/items.test.ts` "audit-logs status transitions on update" and `test/sessions.test.ts" full-field audit)

---

## Phase 3.5 — Projects view create UI (hygiene)

Phase 1 shipped project create/archive/delete via REST + CLI; Phase 2 left the Projects view as a stub. This slice wires the create half into the UI. Switch is already wired via the header palette; archive/delete UI remain deferred to a later slice.

- [x] "New project" CTA on the Projects view opens a modal (`packages/frontend/src/views/stubs.tsx` ProjectsView; `packages/frontend/src/components/NewProjectModal.tsx`)
- [x] Modal collects name, repo path, methodology bundle (dropdown populated from `GET /api/methodologies`; defaults to freeform when loaded, else first loaded bundle)
- [x] Submit POSTs `/api/projects` via `api.createProject`, refreshes `useProjects`, fire-and-forget `api.switchProject`, navigates to `/projects/:id` (App.tsx onCreated wiring)
- [x] Cancel button, Esc, and backdrop click all close the modal (`useModalRegistration('new-project')` + click-outside guard mirroring `HelpModal.tsx`)
- [x] Verified by `packages/frontend/test/newProjectModal.test.tsx` (8 cases) and `packages/frontend/test/stubs.test.tsx` ProjectsView prop update

---

## Phase 4 — Capture surfaces

- [x] Scratchpad always-visible in header (`packages/frontend/src/components/Scratchpad.tsx`; mounted in `Header.tsx`)
- [x] Scratchpad has no AI processing and no review modal (no `propose`/`apply` calls; `packages/backend/src/scratchpad/service.ts` writes only `scratchpad_jots` + audit row; verified by `test/scratchpad.test.ts` and `test/scratchpad.test.tsx`)
- [x] Session dump zone accepts paste + file drop (`packages/frontend/src/components/DumpZone.tsx`; mounted in `SessionView.tsx`)
- [x] Library dump zone accepts paste + file drop (same component with `target='library'`; mounted in `LibraryView` in `views/stubs.tsx`)
- [x] Dump zone extraction parameterised by active project's bundle (`packages/backend/src/dump-zone/extractor.ts`: bundle's `ItemPolicy.types`/`statuses` flow into both the Anthropic system prompt and the heuristic fallback's defaults; `dump-zone/service.ts` re-validates at apply via `bundleItemPolicy`)
- [x] Review modal shows proposed-items + cross-session re-route option (`packages/frontend/src/components/DumpZoneReviewModal.tsx`; per-row session select; `test/dumpZone.test.tsx` covers the re-route case)
- [x] Voice input via browser-native speech recognition (desktop-only) (`packages/frontend/src/components/VoiceCapture.tsx`; uses `window.SpeechRecognition`/`webkitSpeechRecognition`; renders an unsupported button when absent)
- [x] Voice destination toggle (session vs library dump zone) (resolved by mounting one `VoiceCapture` per DumpZone instance; the surface the user opens determines destination)
- [x] Voice transcript pipes into dump zone flow (`VoiceCapture` `onTranscript`/`onSubmit` → `DumpZone.propose('voice', transcript)`)
- [x] Claude Code push: inbox directory configurable (`config.inboxDir` resolved in `packages/backend/src/config.ts`; `THROUGHLINE_DATA_DIR` env override flows through)
- [x] Inbox watcher picks up new files (`packages/backend/src/inbox/watcher.ts` chokidar watch; startup scan picks up files queued while backend was down per SPEC §7.6)
- [x] Inbox queue processes serially with per-file state tracking (`packages/backend/src/inbox/worker.ts` drain() loops over queued rows one-at-a-time; `cc_inbox_queue.state` advances queued → processed/failed)
- [x] Inbox file → project routing convention works (filename prefix `<projectId>__<rest>` per `worker.ts`; falls back to `last_active_project_id` from settings; `test/inbox.test.ts` covers prefix, fallback, and orphan-quarantine paths)
- [x] Processed files archive to dated subdirectory (default 30-day retention) (`<archiveDir>/YYYY-MM-DD/<filename>`; 30-day retention policy is documented but the cleanup job lands with Phase 15 hygiene per CODE_SPEC §17)
- [x] Failed files quarantine with sibling error metadata (`<failuresDir>/<filename>` + `.error.json` with `{ error, received_at, attempted_project_id }`; verified by `test/inbox.test.ts`)
- [x] Code TODO/FIXME import: manual trigger in UI (`HomeView` Scan repo for TODOs button; routes through the dump-zone proposal pipeline so apply uses the same review modal)
- [x] TODO patterns default to `TODO:`, `FIXME:`, `XXX:` (`packages/backend/src/code-todo/scanner.ts` `DEFAULT_PATTERNS`)
- [x] All non-scratchpad surfaces apply only after review (paste/voice/inbox/code-todo all funnel through `dump-zone/service.propose` → `proposed_extractions` row in `pending`; only `apply` mutates items / library entries)

---

## Phase 5 — Reconcile engine

- [x] Reconcile diff produces all six categories (`packages/backend/src/reconcile/engine.ts` Anthropic + heuristic engines; `packages/shared/src/reconcile.ts` discriminated `ReconcileRow` union of completed/new/edited/blocker/contradicted/no_change; verified by `packages/backend/test/reconcile.test.ts` per-category cases)
- [x] Edited row covers title and description changes under one row (`ReconcileRowEdited` carries `next_title`+`next_description`; `reconcile/service.ts` apply path issues a single `items.update({ title, description })`; verified by `packages/backend/test/reconcile.test.ts` "applies edited rows by updating title and description")
- [x] Review modal renders the six-category structure (`packages/frontend/src/components/ReconcileModal.tsx` fixed `CATEGORY_ORDER` sections; verified by `packages/frontend/test/reconcile.test.tsx` "renders sections for each category present in the diff")
- [x] User can accept / reject per category before applying (per-row accept checkbox + edit-in-place for new/edited/blocker rows in `ReconcileModal.tsx`; reject routes a `decisions[row_id]='reject'` into the apply request; verified by `packages/frontend/test/reconcile.test.tsx` "unchecking a row routes a reject decision" and backend `respects per-row reject decisions`)
- [x] Apply mutates state and audit-logs every change (`reconcile/service.ts` dispatches per category via `items.update` / `items.create` so existing audit producers fire; top-level `reconcile_apply` + per-noop `reconcile_review_noop` audit rows; verified by `packages/backend/test/reconcile.test.ts` "applies completed rows by updating item status and audit-logging")
- [x] Contradicted spawns code-drift signal (not state revert) (`packages/backend/src/drift/service.ts` `createCodeSignal` called from the contradicted branch in `reconcile/service.ts`; item status remains unchanged; verified by `packages/backend/test/reconcile.test.ts` "contradicted rows spawn tier-2 drift signals when item has a PR association" — asserts both signal write and unchanged item status)
- [x] Drift signal tier reflects PR association (tier-2 if associated, tier-3 otherwise) (`drift.hasPrAssociation(item_id)` decides `category` at apply time; verified by both PR-associated (tier-2) and PR-less (tier-3) backend cases)

---

## Phase 6 — Library, directives, repo `.md` ingestion

Sliced into three sub-PRs at the session author's direction: **6a** library content, **6b** directives + reminders + notifier, **6c** repo `.md` ingestion. The CHECKLIST rows ticked in each sub-PR carry the slice label inline.

- [x] **(6a)** Library entries scoped per project (`packages/backend/src/library/service.ts` `list({ projectId })` filters by project; `listLibrary(projectId, { scope: 'project' })` is the default in `packages/frontend/src/api.ts`; verified by `packages/backend/test/library.test.ts` "filters list by type" and "returns global-scope list across projects when projectId is null")
- [x] **(6a)** Library entries: notes, prompts, snippets, imported docs all functional (full CRUD via `packages/backend/src/library/routes.ts` `GET / POST / PATCH / DELETE`; per-type renderer in `packages/frontend/src/views/LibraryView.tsx` `EntryEditor`; verified by `packages/backend/test/library.test.ts` "creates entries of each of the four types" + `packages/frontend/test/library.test.tsx` "renders entries from the API")
- [x] **(6a)** Notes attachable to multiple items; many-to-many table populated (`packages/backend/src/library/service.ts` `attach / detach / listAttachedItems / listAttachedNotes`; T-D9 type='note' guard via `AttachNotANoteError`; cross-project guard via `CrossProjectAttachError`; `packages/frontend/src/components/{AttachItemModal,AttachNoteToItemModal}.tsx` multi-select UI; verified by backend tests "attach a note to an item happy path", "attach is idempotent on duplicates", "attach rejects when the entry is not a note", "attach rejects cross-project pairs", and frontend test "attach modal applies attach/detach diffs through the API")
- [x] **(6a)** Prompts support `{{var_name}}` placeholders with fill-in modal (shared helpers `extractPromptVariables` + `renderPromptBody` in `packages/shared/src/library.ts`; backend `fillPrompt` in `library/service.ts`; UI in `packages/frontend/src/components/PromptFillModal.tsx`; verified by backend "prompt-fill substitutes placeholders and reports missing variables" + "prompt-fill rejects non-prompt entries" and frontend "renders the prompt fill modal and copies the rendered output")
- [x] **(6a)** Snippet quick-copy button always visible (`packages/frontend/src/views/LibraryView.tsx` `EntryEditor` renders the Copy button for `type='snippet'`; uses `navigator.clipboard.writeText(entry.body)`; verified by frontend "snippet quick-copy writes the body to clipboard")
- [x] **(6c)** Imported docs: AI generates summary + tag suggestions on import (`packages/backend/src/md-ingest/summariser.ts` `createAnthropicSummariser` returns STRICT-JSON `{summary, tags}` with heuristic + routing fallbacks per the Phase 4 extractor convention; `md-ingest/service.ts` `ingest()` writes them onto the `imported_doc` entry and records cost telemetry T-D29 + prompt fingerprint T-D24; verified by `packages/backend/test/md-ingest-summariser.test.ts` "anthropic: parses STRICT JSON…" / "degrades to heuristic on non-JSON" and `packages/backend/test/md-ingest.test.ts` "ingest creates an imported_doc entry with summary + tags and audits" + "records cost telemetry + prompt fingerprint when the AI summariser runs")
- [x] **(6a)** Library entry full-text search (FTS5 virtual table `library_entries_fts` in `packages/backend/src/db/migrations/0004_library_extensions.sql` + sync triggers; `library/service.ts` `search()` returns `via: 'fts'`; UI debounced search in `LibraryView.tsx`; verified by backend "FTS search returns matches scoped per project" + "FTS search finds matches in body and tags" and frontend "search input debounces and routes to the FTS endpoint")
- [x] **(6a)** Library entry semantic search routed (Semble for code-related queries — placeholder until Phase 11; local embeddings for text queries — placeholder until Phase 14) (`library/service.ts` `semanticSearch()` returns `via: 'semantic-stub'`; `POST /api/projects/:id/library/semantic-search` route exists; verified by backend "semantic-search returns the stub envelope")
- [x] **(6a)** Cross-project library toggle (`LibraryView.tsx` `library-scope-toggle` checkbox switches `scope` between `'project'` and `'global'`; `listLibrary(projectId, { scope: 'global' })` and `search({ scope: 'global' })` both pass through; verified by backend "returns global-scope list across projects when projectId is null" + frontend "cross-project toggle issues a global-scope search")
- [x] **(6b)** Pin directive: parent view shows pinned item sticky (Phase 6 pin scope = session board + library sidebar per the 6a handover; `packages/frontend/src/components/Board.tsx` partitions items into `pinned` / `unpinned` and renders a `📌 pinned` divider; `packages/frontend/src/views/LibraryView.tsx` partitions the sidebar list the same way; verified by frontend "renders pinned entries above unpinned ones with a divider" and "adding a pin via the entry editor pushes the entry to the top")
- [x] **(6b)** Reminder directive: relative + absolute + recurrence rules (shared helpers `parseRelativeReminder` + `computeNextFireAt` + `advanceRecurrence` in `packages/shared/src/directives.ts`; backend `createDirectivesService` validates + normalises payloads; `packages/frontend/src/components/DirectiveModal.tsx` exposes mode radio + recurrence checkbox; verified by backend "creates an absolute reminder and stores next_fire_at", "creates a relative reminder and resolves next_fire_at via the shared parser", "rejects an unrecognised relative_spec" and frontend "creates an absolute reminder from the library editor" + "creates a relative reminder with recurrence")
- [x] **(6b)** Reminder fires OS notification regardless of browser tab state (`packages/backend/src/directives/scheduler.ts` polls `listDueReminders` on a configurable tick — default 30s — and dispatches via the T-D32 notifier capability layer in `packages/backend/src/notifier/index.ts`; scheduler runs from `server.ts`, lifecycle bound to the server's `close()` so it's tab-independent; verified by backend "tick fires a past-due reminder via the notifier and marks it fired")
- [x] **(6b)** Recurring reminders persist until directive removed (§13 adopted default — `markFired` advances `next_fire_at` from the previous schedule rather than from `now`, anchoring the cadence; one-shot reminders set `next_fire_at=NULL` on fire but the row remains; verified by backend "markFired on recurring advances next_fire_at by the recurrence interval" + "one-shot reminder does not refire on the next tick")
- [x] **(6b)** Include-in-prompt directive: session-start prompt auto-prepends flagged items (placeholder hook until Phase 13) (data side complete — `kind='include_prompt'` directives stored, queryable via `service.list({ kind: 'include_prompt' })` and `listForParent`; Phase 13's session-start pipeline consumes this list to assemble the prompt; verified by backend "list filters by kind and parent" and frontend "renders three collapsible groups with per-group counts")
- [x] **(6b)** Directives view groups by type (pinned / reminders / include-in-prompt) (`packages/frontend/src/views/DirectivesView.tsx` renders three sections in fixed order with section-level testids; verified by frontend "renders three collapsible groups with per-group counts")
- [x] **(6b)** Directives view shows count per group, each collapsible (count in `directives-count-<kind>`; collapse toggles `aria-expanded` on the section header; verified by frontend "renders three collapsible groups with per-group counts" + "collapses a group on header click")
- [x] **(6b)** Reminders sorted by next firing within their group (`sortDirectives('reminder', …)` uses `next_fire_at.localeCompare`; already-fired one-shots — `next_fire_at=null` — sort last so the active queue surfaces first; verified by frontend "sorts reminders by next_fire_at within their group")
- [x] **(6c)** Repo `.md` ingestion: folder-opt-in selector (`packages/backend/src/md-ingest/service.ts` `addFolder/listFolders/removeFolder/scan/ingest` with `md_ingest_folders` table from `0006_md_ingest.sql`; folders confined to `repo_path` per C-D10; `packages/frontend/src/components/MdFolderManager.tsx` collapsible panel in `LibraryView` lists/adds/removes folders, scans, and ingests a selected subset; verified by `packages/backend/test/md-ingest.test.ts` "adds a folder confined to repo_path and rejects escaping paths" + "scans for .md files and classifies new / unchanged / changed" and `packages/frontend/test/md-ingest.test.tsx` "lists opted-in folders, scans, and ingests selected docs" + "rejects an out-of-repo folder add")
- [x] **(6c)** `.md` re-ingest: snapshot by default with per-entry track-source toggle (`source_tracked` defaults to 0 in `0006_md_ingest.sql`; `md-ingest/service.ts` `setTracked` + hash-gated `reingestEntry`; `md-ingest/watcher.ts` chokidar watch over opted-in folders with a manual `syncOnce()` test seam re-ingests tracked entries on change; `LibraryView` `EntryEditor` exposes the track toggle + "Re-ingest now"; tracked re-ingest re-summarises per C-D11; verified by `packages/backend/test/md-ingest.test.ts` "setTracked toggles the per-entry flag; reingest is hash-gated", `packages/backend/test/md-ingest-watcher.test.ts` "syncOnce re-ingests a tracked entry whose file changed; leaves untracked alone" + "tolerates a tracked entry whose source file vanished", and `packages/frontend/test/md-ingest.test.tsx` "imported-doc entry exposes track-source toggle and re-ingest")
- [x] **(6a)** Library entries audit-logged (`appendAudit` called on every `create / update / delete / attach / detach` in `library/service.ts`; per-field audit rows on update; verified by backend "update mutates fields and audit-logs each change" + "attach a note to an item happy path + audit row")

---

## Phase 7 — Rich-bundle delivery & bundle-aware capture parameterisation

<!-- Phase 7 originally authored a business-internal rich bundle in-repo; superseded by the bundle-externalisation refactor (C-D14), which replaced it with the generic `test-bundle` fixture and external `bundle_path`. Rows below restated against the `test-bundle`; work is real, only the worked-example bundle changed. -->

- [x] `methodologies/test-bundle/bundle.md` authored per the eleven-section structure
- [x] The `test-bundle` parses cleanly through the bundle loader
- [x] Rich-bundle-bound project: item types `task` and `note` declared by bundle and surfaced in UI
- [x] Rich-bundle-bound project: status lifecycles per bundle (`task` 4 states; `note` 2 states)
- [x] Rich-bundle-bound project: the two item types render on separate boards
- [x] Methodology-context fields populate on items (primary unit / phase / anchor citations / marker refs)
- [x] Modules view renders for rich-bundle-bound projects with primary-unit grouping, tier classification, phase indicators, anchor/marker counts
- [x] No code path uses bundle-specific terminology unmediated by the bundle (verified by review)
- [x] Phase 3 UI works for both freeform-bound and rich-bundle-bound projects without per-bundle code branches

---

## Refactor — Bundle externalisation (public-repo readiness)

Slice (not a ROADMAP phase): remove the business-internal rich bundle from the repo and add a configurable mechanism for user-owned bundles to live outside Throughline. C-D14.

- [x] `bundle_path` added to the project model (nullable) + schema migration `0007_project_bundle_path.sql`
- [x] Bundle loader resolves external `bundle_path/bundle.md` first, falls back to install-shipped `methodologies/<bundle_id>/`
- [x] External bundles get `chokidar` watch parity (refcounted by project binding; registered on create/`bundle_path` change, unregistered on delete; re-registered for existing projects on backend start)
- [x] Generic `methodologies/test-bundle/bundle.md` fixture authored (two item types w/ per-type lifecycles, multi-gate moment, anchors, markers); parses cleanly
- [x] Phase 7 tests retargeted from the former in-repo rich bundle to `methodologies/test-bundle/`; frontend mock ids de-business-named; all suites green (backend 132, frontend 70)
- [x] The former in-repo rich-bundle directory deleted from the repo
- [x] CODE_SPEC.md (C-D3, C-D5 updated; C-D14 minted; bundle-loading section + tables) and README.md (user-owned-bundle guide) documented

---

## Phase 8 — Methodology gate runtime (four phase moments + PR-open)

<!-- Trigger-mechanism wording below was the pre-resolution provisional (ROADMAP §7.12
     gap table). SPEC §7.12 (spec-clarification PR) superseded it with a single
     local-loopback HTTP channel + git hooks + durable hook queue; items ticked against
     the resolved mechanism, original text struck through for build-state history. -->
- [x] Gate dispatcher implemented per C-D6 (`methodology/gates/runtime.ts`)
- [x] Pre-write moment dispatch (~~signal file~~ → loopback `POST /api/gate-trigger` + UI "Run pre-write checks", best-effort)
- [x] Per-commit moment dispatch (~~`.git/COMMIT_EDITMSG` watch~~ → item state transition OR installed pre-commit hook → loopback; durable hook queue)
- [x] Plan-mode moment dispatch (~~marker file~~ → Claude Code POSTs to loopback channel, best-effort)
- [x] Post-commit moment dispatch (~~git log poll~~ → installed post-commit hook → loopback; durable hook queue)
- [x] PR-open moment dispatch via GitHub poller (`runMoment(project,'pr-open')` seam exposed; poller is Phase 10)
- [x] Multi-gate per phase moment supported; gates run independently (test-bundle per-commit ×2, verified)
- [x] Each gate firing writes to `gate_firings`
- [x] Each gate firing writes an audit-log entry (`entity_type='gate_firing'`, `actor='methodology_runtime'`)
- [x] Mechanical gates execute scripts and validators via child-process spawn (built-in catalogue, C-D15)
- [x] Judgement gates call Anthropic with bundle-supplied prompt template (`gates/judgement.ts`)
- [x] Gate failures surface in methodology-gates view as proposals (`views/GatesView.tsx`)
- [x] "Override with reason" action records audit-log row with reason + original findings reference
- [x] "Fix and retry" action re-fires the gate (re-run the moment)
- [x] Per-commit moment runs the test-bundle's two gates (structure-check + banned-string-sweep) as two independent gates <!-- the former in-repo rich bundle was removed per the bundle-externalisation refactor; test-bundle is the worked example -->
- [x] Throughline never silently blocks the underlying repo (advisory hooks `exit 0`; checks fail as proposals, T-D44)

---

## Phase 9 — Discipline-drift engine

- [x] Discipline-drift scanners instantiate from the loaded bundle's validation-rules section
- [x] Scanners watch project doc files via chokidar
- [x] Pre-write moment also fires write-time scanners
- [x] Signals write to `drift_signals` with `stream='discipline'`
- [x] Signals scoped to `item_id` or `primary_unit_ref` where applicable — `cross_reference` scopes to the citing item (via `item_anchor_citations`) and its primary units; `banned_string`/`structural`/`regex` are project-scoped (no file→unit linkage in the T-D42 grammar; see CODE_SPEC C-D7 implications + Open Question)
- [x] Methodology-gates view shows category-grouped lists
- [x] Modules view shows badges on affected primary units
- [x] Items associated with affected primary units inherit a methodology-drift indicator in list rows and detail panel
- [x] Freeform-bound projects: scanner instantiation is no-op (verified — `discipline-drift.test.ts` "freeform-bound projects are a verified no-op")
- [x] Bundle re-load tears down and rebuilds scanners (re-load reconciles away signals for categories the new bundle no longer declares)

---

## Phase 10 — GitHub integration & code-drift detection

- [x] GitHub PAT stored in secrets file (not datastore) — pre-existing `secrets/store.ts`; consumed by the fetch client (C-D16)
- [x] Polling at 60s for active sessions, 5min otherwise — per-project cadence gate; "active" approximated (C-D16 Open Question)
- [x] ETag caching reduces redundant API calls — repo-level list ETag + 304 short-circuit (rate-limit-free, C-D16)
- [x] Per-project GitHub `owner/repo` configuration — pre-existing `projects.github_owner/repo`; subsystem inert without it
- [x] PR badges render (needs review / approved / merged) — `PrBadges` component (SPEC §7.13)
- [x] Activity timestamps + PR links surface per session — `PrBadges` (title carries activity_at; href = PR url)
- [x] Auto-reconcile on merge with high/medium/low confidence branches — `auto-reconcile.ts`
- [x] High-confidence: auto-apply with toast + 24h undo — in-memory snapshot undo + audit provenance
- [x] Medium: notification badge + one-click approve — run left pending; `auto-reconcile/approve`
- [x] Low: opens reconcile modal as normal — disposition `modal`, run left pending
- [x] Confidence scores logged to audit history from day 1 — `actor='ai_auto_apply'`, every disposition (T-D6)
- [x] Manual item-to-PR linking: auto-detect from active branch — `pr-linking.ts` (git via child_process)
- [x] Manual item-to-PR linking: override action — `setPrLink(pr_number)` with explicit number
- [x] Manual item-to-PR linking: skip path — detect returns null candidate; no association written
- [x] Re-association possible from item detail panel anytime — detail-panel PR section (detect/clear)
- [x] Code-drift tier-1: verifier findings read via the GitHub Checks annotation contract and matched to items by the bundle-defined rule-identifier convention — annotation-generic, Semgrep is the v1 reference tool (verifier-tool plurality resolved per SPEC §7.16 / Q7, C-D16)
- [x] Tier-1 failure badges item red; passing clears badge — idempotent; passing dismisses open tier-1
- [x] Tier-2 GitHub revert event detection; item badged orange — revert-PR detection over `item_pr_associations`
- [x] Tier-3 watches for new PRs touching files in `item_code_refs`; item badged yellow — wired + tested; dormant until Phase 11 populates refs (per ROADMAP)
- [x] Tier-4 dedup: cosine ≥ 0.80 trigger, AI confirmation pass for 0.70–0.80 — `tier4.ts` token-cosine (Phase-14 embedding swap point)
- [x] Tier-4 signals route to drift inbox (not item badge) — inbox excludes strong tiers
- [x] Tier-4 stale signals auto-dismiss after 7 days with audit-logged reason — `dismissStale` (`stale-no-action`)
- [x] Drift inbox count surfaces in header (counts both streams) — header pill + `useDriftInbox`
- [x] Drift signal carries explicit reasoning text — `reason` on every signal; rendered in the inbox
- [x] Re-verify-via-AI action available on every signal — `reverify.ts` (Sonnet; heuristic 'unclear' fallback)
- [x] Manual re-open action available on every signal — `reopenSignal`
- [x] Orphaned rules tracked when item with verifier rule is deleted — items `onDelete` hook → `orphan-rules.ts`
- [~] Orphaned rules surface in periodic review hygiene list and settings panel — settings/API surface delivered; periodic-review hygiene list is Phase 14 (per ROADMAP)
- [x] One-click cleanup-PR-draft action constructs PR via API — `draftRuleRemovalPr` (branch+delete+PR)
- [x] Dismiss-without-removal supported and audit-logged — `orphanRules.dismiss`
- [x] Workflow-template warning fires at first GitHub-integration use if expected workflow not present in repo — `warnWorkflowIfMissing` (once per project, audit-logged)
- [x] PR-open methodology gate fires via Phase 8 dispatcher — poller `runMoment(project,'pr-open')` on newly observed open PR

---

## Phase 11 — Semble integration

- [x] Throughline invokes Semble via `execFile` per query (C-D17) — `semble/client.ts` one-shot child, injectable exec; verified by semble "search() passes the assumed argv"
- [x] Throughline resolves the Semble command via configurable setting (`THROUGHLINE_SEMBLE_CMD`, default `semble`) — `config.ts` `sembleCmd`; non-secret, not in `secrets.json`
- [x] Semble indexes the project repo path passed per invocation — client passes `--path <project.repo_path>` per call (Semble owns its per-session index cache; no Throughline-driven re-index, C-D17)
- [x] Done-time code linking: Semble searches by item title + description — `semble/service.ts` `searchForItem`; `POST /api/projects/:id/items/:itemId/code-search`
- [x] Top results presented to user for confirmation — `ItemDetailPanel` Code references section (candidate checklist → confirm)
- [x] Confirmed locations stored as `item_code_refs` — `confirmRefs` writes rows + audit; verified by semble "confirm → item_code_refs row + audit"
- [x] Plain-English code Q&A: library question routes to Semble + Anthropic summarisation — `codeQa`; surfaced in `LibraryView` "Ask the code" (library surface per spec-author decision; scratchpad stays AI-free per T-D20)
- [x] Code Q&A returns answer with source links — `CodeQaResult.answer` + `sources[]`; degradation paths tested
- [x] Dump zone item creation enrichment: Semble suggestions appear in review modal — `dump-zone/service.ts` `enrichItems` hook; `DumpZoneReviewModal` read-only suggestion row
- [x] Tier-3 code-drift detection begins firing as items accumulate code refs — no tier-3 code change (already wired); verified by semble "tier-3 then fires" after `confirmRefs`

---

## Phase 12 — Companion review runtime

- [x] Bundle-declared checklists instantiate as `ChecklistRun` records — `methodology/companion/engine.ts` `startRun`; `test/companion.test.ts` "instantiate as a ChecklistRun"
- [x] Step state machine: pending → in-progress → passed | failed | skipped — `engine.ts` `transition` + `ChecklistStepState` (shared `companion.ts`); test "shared check pipeline … audits each transition"
- [x] Mechanical steps execute via shared mechanical-execution infrastructure — reuses Phase-8 `gates/checks.ts` `runMechanicalCheck`/`resolveCheckKind`/`CheckContext`; test "mechanical step runs the shared check pipeline"
- [x] Mechanical step findings write to audit log — `transition` writes `entity_type='checklist_step'` (T-D36); test asserts `mechanical_started`/`mechanical_resolved` rows
- [x] Judgement steps open a UI panel — `GatesView.tsx` `CompanionReview` ("Ask AI" / "Record judgement" actions on judgement steps)
- [x] Judgement steps accept user judgement with rationale — `engine.resolveJudgementStep`; route `.../judgement`; test "user call with rationale"
- [x] Judgement steps optionally hand off to AI-via-Anthropic (default Sonnet) — `companion/judgement.ts` `createAnthropicCompanionJudge` (default `claude-sonnet-4-6`, SPEC §9); `engine.aiJudgeStep`
- [x] AI-judgement results carry prompt fingerprint and model in audit log — `aiJudgeStep` writes `ai_judgement_model` with `prompt_fingerprint` (T-D24) + cost telemetry; test "records model + fingerprint + cost"
- [x] Step transitions audit-logged — every `transition` + run-start/complete append an audit row; test assertions across cases
- [x] Run completion offers optional library-note summary attached to discussed items — `engine.completeRun` → `library.create({type:'note'})` + `library.attach` (T-D10); test "saves an optional library note attached to discussed items"
- [x] Failed mechanical steps do not halt the run; override audit-logged and run continues — `engine.overrideStep` (T-D44 kin); test "failed mechanical step does not halt the run; override is audit-logged and continues"

---

## Phase 13 — Session-start scaffolding

- [x] Endpoint generates session-start prompts for the active project (`POST /api/projects/:id/session-start-prompt` + `GET …/session-start/modes` — `methodology/session-start/routes.ts`; engine `generate`/`modes` in `methodology/session-start/engine.ts`; verified by backend "renders the bundle template for the chosen mode and lists open items")
- [x] Companion-mode selection: bundle-declared enum with default (`resolveMode`/`declaredModes` — first-declared mode is the default; `default` synthetic mode for freeform/none; invalid mode → `InvalidModeError` 400; verified by "lists the bundle-declared companion modes with the first as default" and "rejects a mode the bundle does not declare". The companion-modes ↔ review-patterns relationship (CODE_SPEC Q#6) is resolved per SPEC §7.18 — a companion mode is a bundle-declared identifier whose v1 effect is session-start template selection only; the as-built enum + first-declared default is ratified)
- [x] Context-assembly retrieves project spec, decisions, anchors, markers, execution-plan slice, dependencies (`assemble` — open items, decision-bearing items (boards beyond the first declared type), cited anchors, open markers, cross-primary-unit blocker edges; the bundle's per-mode template is the execution-plan slice (C-D9 step 4); verified by "renders the bundle template…" and "surfaces cross-primary-unit dependencies")
- [x] Include-in-prompt directives auto-prepend to the generated prompt (`includeBlocks` resolves each `kind:'include_prompt'` directive's parent item title+body or library entry body + optional note; prepended above the rendered template; verified by "auto-prepends include-in-prompt directives (item + library, with note)")
- [x] Anthropic Haiku call classifies relevance (`session-start/classifier.ts` `createAnthropicRelevanceClassifier` default `claude-haiku-4-5`; high ⇒ full text, medium ⇒ citation, low ⇒ dropped; capability-gated — no key ⇒ all-medium degrade, no call; verified by "classifier tiers drive decision rendering…" and "degrades to citation-only with no AI cost when the classifier is unavailable")
- [x] Bundle templates section provides the prompt template (`templateFor` reads `bundle.templates.session_start_by_mode[mode]`, falls back to `default` then a built-in minimum template; `{{var}}` substitution with unknown placeholders blanked; verified by "renders the bundle template for the chosen mode")
- [x] One-click copy-to-clipboard (`SessionStart` panel in `views/GatesView.tsx` — `navigator.clipboard.writeText`; verified by frontend "Phase 13 — session-start surface generates and copies a prompt")
- [x] Cost telemetry records every assembly call (`recordCost` feature `session_start_assembly` when the classifier used AI with token usage; T-D24 model + salted prompt-fingerprint audit row; verified by "classifier tiers drive decision rendering; AI telemetry is audited + costed" — exactly one cost row per fresh assembly, none on the degrade path or a cached re-render)
- [x] Freeform-bound project produces a minimum-spec prompt (freeform/none bundles expose the synthetic `default` mode and the freeform `session_start:default` template renders project name + open items; verified by "freeform-bound project produces a minimum-spec prompt via the default mode")

---

## Phase 14 — RAG & intelligence layer

- [x] **(14a)** Text substrate: local embeddings generated incrementally on content edit (`intelligence/embeddings.ts` Transformers.js-or-deterministic-fallback `TextEmbedder`; `intelligence/text-index.ts` `ensureFresh` re-embeds only content-hash-changed entities + prunes dead vectors; migration `0010` adds `project_id`/`content_hash`/`chunk_text`; test "reindex is incremental: stale on first pass, fresh (0) on the next")
- [x] **(14a)** Text substrate: top-k cosine retrieval + Anthropic summarisation (`text-index.ts` `search` cosine top-k; `rag.ts` `textQuery`→`synthesise` Sonnet; test "retrieves over items + library and synthesises with citations + cost when AI is on")
- [x] **(14a)** Code substrate: routed to Semble per Phase 11 (`rag.ts` `codeQuery`→`semble.codeQa`; test "code substrate maps Semble sources to code citations")
- [x] **(14a)** Audit-history substrate: structured queries on the audit log (`rag.ts` `auditQuery` token-LIKE SQL over `audit_log`; test "audit substrate returns structured citations scoped to the project")
- [x] **(14a)** Router: keyword heuristics first pass (`rag.ts` `routeQuery` code/audit/text regexes; test "keyword heuristics route code / audit / text")
- [x] **(14a)** Router: user-overridable per-query toggle (`RagQueryRequest.substrate`; `routed_by` 'override'|'heuristic'; test "an explicit substrate overrides the heuristic and is reported as such")
- [x] **(14a)** RAG response cites sources across substrates (`RagCitation[]` per substrate with ref/label/snippet; degrades to retrieval-only with no key — test "degrades to retrieval-only with no cost when Anthropic is absent")
- [x] **(14a)** Queries project-scoped by default with cross-project toggle (`RagQueryRequest.cross_project`; text/audit scope; test "is project-scoped by default and broadens under cross_project")
- [x] **(14b)** End-of-session retro: user-initiated trigger only (`intelligence/retro.ts` `generate`; `POST /api/projects/:id/intelligence/retro`; no scheduler — test "AI-summarises, saves a library note…")
- [x] **(14b)** Retro generates one-page summary using items + audit + Claude Code transcripts + methodology-context updates in window (`retro.ts` window = last-retro-or-session-created; items-in-session + windowed `audit_log` + methodology-event filter + `cc_inbox_queue` transcript refs; AI Sonnet, deterministic fallback — tests "AI-summarises…" / "degrades to a deterministic structured summary…")
- [x] **(14b)** Retro saved as library note (`library.create({ type:'note' })`; test asserts `note?.type === 'note'`)
- [x] **(14b)** Retro optionally attached to discussed items (`attach_to_items` → `library.attach`; test asserts `listAttachedNotes` includes the entry)
- [x] **(14b)** Retro optionally appended to `session-start.md` for next session (`append_to_session_start` → `appendFileSync(<repo>/session-start.md)`; test reads the file back)
- [x] **(14b)** Periodic review: configurable interval (default 2 weeks) (`periodic-review.ts` `intervalDays`: project settings_json → global setting → `DEFAULT_INTERVAL_DAYS=14`; test "honours a per-project interval override…")
- [x] **(14b)** Periodic review hygiene questions cover code-drift, discipline-drift, orphaned rules, bundle-declared hygiene categories (`buckets()` no-AI: code/discipline drift, orphaned rules, bundle discipline-drift categories, stale decisions, untouched sessions, longest-held blockers; T-D22 AI only on `synthesize` — tests "hygiene buckets run with no AI…" / "synthesise records the review-opened event even with no AI key")
- [x] **(14c)** Dependency-aware sequencing: topological sort weighted by blocker chain depth + downstream-unblocked count (`intelligence/sequencing.ts` `doNext`: open-subgraph blocker/dependent maps, memoised `chainDepth`/`downstream`, weighted sort; `GET /api/projects/:id/intelligence/do-next`; test "topo-orders by readiness + downstream impact…")
- [x] **(14c)** Sequencing deprioritises items in primary units failing methodology gates (`gateFailingUnits` from latest non-overridden fail/error firings → finding-ref→item→primary-unit; `gate_deprioritised` sinks in sort; test "deprioritises items whose primary unit has a failing, non-overridden gate"; attribution interpretation flagged in handover Open Questions)
- [x] **(14c)** "Do next" view surfaces unblock-impact summaries (`unblock_impact { if_you_unblock, items_freed }`; IntelligenceView Do-next panel; tests backend "…reports unblock impact" + frontend "loads the Do-next sequence with unblock-impact summary")
- [x] **(14c)** Stakeholder view toggle re-renders item content in plain language (`intelligence/stakeholder.ts` `render` Sonnet, deterministic fallback; `GET …/items/:itemId/stakeholder`; IntelligenceView stakeholder panel; test "AI-renders, caches, and records cost + audit")
- [x] **(14c)** Stakeholder view cache invalidates on item edit (audit-trail-as-cache keyed by `sha256(title+description+status)`; fingerprint mismatch ⇒ regenerate, §13 adopted; test "cache invalidates when the item content changes")
- [x] **(14d)** Per-list chat panel reads session items + methodology context as input (`intelligence/chat.ts` `sessionContext`: session items + bundle/anchors/markers/primary-units digest into the system prompt; `POST /api/projects/:id/intelligence/chat`; test "per-list chat persists the turn and replies with session + methodology context")
- [x] **(14d)** Per-list chat proposed changes route through review (`chat.propose` → `dumpZone.propose({ source:'paste' })`, no auto-mutation; `POST …/chat/propose`; test "proposed changes route through the dump-zone review modal")
- [x] **(14d)** Dump zone chat mode toggle: paste, refine, apply through review (`context_type:'dump_zone'` chat path + `propose` reuse the same review pipeline; IntelligenceView chat panel context-type toggle; test "persists history independently per context…")
- [x] **(14d)** Chat history persisted per context and retrievable (`chat_history` rows keyed by `(project_id, context_type, context_id)`, ordered `created_at, rowid`; `history()` + `GET …/chat`; tests "persists history independently per context…" / frontend "loads persisted chat history for a context")

---

## Phase 15 — Backup, cost meter, settings polish, hygiene

- [x] Manual export downloads SQLite file as timestamped copy (`POST /api/backup/export`; `backup/service.ts` online `db.backup()` snapshot, `backup/routes.ts` streams `throughline-backup-<ISO>.sqlite`; `api.exportBackup` triggers the browser download; `backup.test.ts`, `server.test.ts`)
- [x] API keys excluded from export (T-D4: keys live in `secrets.json`, never in the datastore — excluded by construction; `backup.test.ts` asserts the snapshot bytes contain no secret)
- [x] `methodologies/` directory excluded from export (ships with install) (C-D3: separate install dir, not part of the SQLite datastore the snapshot copies)
- [x] Header backup indicator turns red after threshold days (default 7) (`useBackupStatus` + `Header.tsx` backup pill; `backup/service.ts` `status()` `stale`; default `backup_threshold_days=7` per CODE_SPEC §17; `backup.test.ts`)
- [x] Auto-copy target path setting works (`auto_copy_target_path` setting; `backup/service.ts` `autoCopy()`; Settings panel surfaces a local-only warning when unset; `backup.test.ts`)
- [x] Auto-copy fires on schedule when target set (`backup/scheduler.ts` tick, due per `backup_nudge_interval_days`; wired in `server.ts`; `backup.test.ts` scheduler tick)
- [x] Cost meter visible in header at all times (`Header.tsx` cost pill via `useCostMeter`, always rendered)
- [x] Cost meter breaks down by feature category (`cost/summary.ts` `by_feature`; `cost-summary.test.ts`)
- [x] Cost meter shows day / week / month (`cost/summary.ts` day=UTC-calendar-day, week/month=rolling 7/30d per §13-adopted rolling-window convention; `cost-summary.test.ts`)
- [x] Cost meter scopes per active project with global rollup option (`scope=project|global`; header uses active project, settings shows global; `cost-summary.test.ts`)
- [x] Daily threshold warning (configurable; default = no threshold) (`cost_daily_threshold_usd`, default `null` per ROADMAP §13 / CODE_SPEC Q#9; `daily_threshold_exceeded` flag + header danger styling; `cost-summary.test.ts`)
- [x] Orphaned rules panel functional in settings (`SettingsView.tsx` `OrphanRulesSection`; backend `github/orphan-rules.ts` from Phase 10; list/dismiss/draft-cleanup-PR wired; `settingsView.test.tsx`)
- [x] Settings panel exposes every knob in SPEC §7.25 (`views/SettingsView.tsx` at `/settings`, header gear)
- [x] Settings: Anthropic API key (`secrets/routes.ts` write-only; `SecretsSection`; presence-only readback; `backup.test.ts`, `server.test.ts`, `settingsView.test.tsx`)
- [x] Settings: GitHub PAT (same write-only secrets path)
- [x] Settings: per-project local repo path (`ProjectSection` → `api.updateProject`)
- [x] Settings: per-project methodology bundle binding (default freeform) (`bundle_id` added to `UpdateProjectInput` + `projects.update` rebind/re-register/audit; `ProjectSection` bundle select; `settingsView.test.tsx`)
- [x] Settings: default model selector + per-feature overrides (`ModelSection` persists `default_model` + `model_override_<feature>`; override **consumption** across AI factories is a documented Phase-16 follow-up — see handover Drift Flags)
- [x] Settings: stale threshold (`stale_threshold_days`; `NumberSetting`)
- [x] Settings: backup nudge interval + auto-copy target (`backup_nudge_interval_days` + `auto_copy_target_path` in `BackupSection`)
- [x] Settings: periodic review interval (`periodic_review_interval_days`; consumed by Phase-14 periodic-review service)
- [x] Settings: GitHub default `owner/repo` per project and per-session branch fields (`ProjectSection` owner/repo; per-session branch is set on each session in the Sessions view — surfaced as a hint)
- [x] Settings: Claude Code inbox directory + archive retention (archive retention = `archive_retention_days`, default 30, consumed by the `backup/scheduler.ts` prune — closes the CHECKLIST §Phase 6c deferral; inbox directory is a `THROUGHLINE_*` env/config knob (`config.ts`), shown read-only in the panel as documented in the handover)
- [x] Settings: OS notification permission grant button (`notifier/routes.ts` `POST /api/notifications/test` fires through the T-D32 capability layer + records `os_notifications_enabled`; `NotificationsSection`; `settingsView.test.tsx`)
- [x] Settings: cost meter daily threshold (`cost_daily_threshold_usd`; `settingsView.test.tsx`)

---

## Phase 16 — Definition of Done walkthrough

Walkthrough verified against the full suite (backend 257/257, frontend 99/99, `pnpm -r typecheck` clean) plus a runtime smoke (`pnpm build` + backend `start`).

- [x] §11 bullet — methodology runtime loads bundles from `methodologies/`; eleven-section parsing; runtime configures validators, sweeps, marker scanners, state-machine transitions, review-checklist steps, template parsers — Phases 1/6/7/8; `methodology/loader.ts`, `bundle-parser.ts`, gate runtime; `test/{loader,bundle-parser,gates,companion}.test.ts`
- [x] §11 bullet — the `freeform` default and the generic `test-bundle` fixture ship and load; rich user-owned bundles resolve via per-project `bundle_path` (C-D14) — `methodologies/freeform/bundle.md` + `methodologies/test-bundle/bundle.md` + external-`bundle_path` resolution; `test/loader.test.ts`, `test/test-bundle.test.ts`
- [x] §11 bullet — multi-project: create / switch / archive / delete functional; coexist; per-project state; default bundle freeform — create+switch Phase 3.5; **archive/delete UI closed this phase** (`views/stubs.tsx` `ProjectsView`, `api.ts` `deleteProject`/`listProjects(includeArchived)`, `test/projectsLifecycle.test.tsx`); backend `projects/service.ts`+`routes.ts`
- [x] §11 bullet — items in one local datastore per project with stable identifiers; sessions are saved views — `items/service.ts`, `sessions/service.ts`; `test/{items,sessions}.test.ts`
- [x] §11 bullet — items support nesting, type lifecycles, blockers, tags, methodology-context refs, branch + PR refs, code refs, verifier rules, audit log — `items/service.ts`, `audit/log.ts`; `test/items.test.ts`
- [x] §11 bullet — nine view modes functional and switchable; modules/methodology-gates hide where bundle declares none — `components/ViewToggle.tsx`, `App.tsx` routes; `test/viewToggle.test.tsx` <!-- At Phase 16 this was checked while the graph view was still a permanent stub (v1 pre-launch verification Cat 1). Honestly true as of Pass 1b: graph is implemented (`views/GraphView.tsx`, `views/graph/layout.ts`; `test/{graphLayout,graphView}.test.ts(x)`). Two §7.11 sub-features deferred to spec-author clarification — see Pass 1b section. -->

- [x] §11 bullet — all capture surfaces functional with consistent review-before-apply — dump-zone/scratchpad/voice/Claude-Code-push/code-TODO; `test/{dumpZone,scratchpad,codeTodo}.test.ts(x)`
- [x] §11 bullet — reconcile produces structured diffs with all six categories and applies cleanly — `reconcile/engine.ts`+`service.ts`; `test/reconcile.test.ts`
- [x] §11 bullet — three directive types functional with OS notification integration; directives view groups by type — `directives/*`, `notifier/*`; `test/{directives,directives-scheduler,notifier}.test.ts`
- [x] §11 bullet — four library content types all first-class — `library/service.ts`; `test/library*`
- [x] §11 bullet — GitHub integration polls at documented cadence, PR state surfaces, auto-reconcile on merge confidence-thresholded; manual item-to-PR linking functional — `github/{poller,auto-reconcile,pr-linking}.ts` (Phase 10 handover)
- [x] §11 bullet — methodology gates fire on PR open, transition events, commit-prep; failures surface as proposals; never silently block — `methodology/gates/*` (Phase 8 handover)
- [x] §11 bullet — both code-drift (four tiers) and discipline-drift (bundle-defined) streams active and surfacing — `github/tier*`, `methodology/drift/*`; `test/discipline-drift.test.ts` (Phases 9/10)
- [x] §11 bullet — stale yellow flag appears in all list views and detail panel header — `components/{ItemRow,ItemDetailPanel}.tsx` (T-D46, Phase 9 handover)
- [x] §11 bullet — Semble local integration: indexing, code Q&A, item enrichment functional — `semble/service.ts` (Phase 11 handover)
- [x] §11 bullet — Personal RAG with three substrates and router functional — `intelligence/rag.ts`; `test/rag.test.ts` (now embedder-agnostic — Phase-14/15 open question closed)
- [x] §11 bullet — end-of-session retro, periodic review, dependency sequencing, stakeholder toggle, command palette, companion runtime, session-start scaffolding functional — `intelligence/*`, `methodology/{companion,session-start}/*`, `components/CommandPalette.tsx`
- [x] §11 bullet — cost meter visible in header at all times — `components/Header.tsx`, `cost/summary.ts` (Phase 15)
- [x] §11 bullet — GitHub auto-apply confidence scores logged in audit log from day 1 — `audit/log.ts` (`actor: ai_auto_apply`, CODE_SPEC §16; Phase 10)
- [x] §11 bullet — single-file backup with optional auto-copy — `backup/*` (Phase 15); `test/backup.test.ts`
- [x] §11 bullet — settings panel covers all required knobs — `views/SettingsView.tsx`; **per-feature model-override now consumed end-to-end** (`ai/model-resolver.ts`, wired into all live AI callsites; `test/model-resolver.test.ts`, `test/chat.test.ts` override-consumption)
- [x] §11 bullet — backend installs and runs via documented single-command setup; frontend served from backend — `pnpm build` + `pnpm --filter @throughline/backend start` (now `tsx`-run, resolves the workspace package consistently); smoke-verified: `/health` 200, `/` serves `index.html`, SPA route 200 (`routes/web.ts`)

---

## Pass 1b — GraphView implementation (v1 pre-launch remediation)

Not a ROADMAP phase. Closes the v1 pre-launch verification Cat-1 honesty blocker: SPEC §11 "nine view modes functional" was checked while the graph view was a permanent stub. Pass 1a deferred this here.

- [x] Graph view implemented — pure deterministic model+layout (`packages/frontend/src/views/graph/layout.ts`) + dependency-free SVG renderer (`packages/frontend/src/views/GraphView.tsx`); replaces the `views/stubs.tsx` `GraphView` stub; wired in `App.tsx`
- [x] Nodes are items; edges are parent-child (`parent_id`) + structured blockers (`blockers[]`, T-D8); arrowed, kind-styled
- [x] "Show chains" mode — highlights blocker dependency paths and structural root blockers; dims off-chain nodes/edges; surfaces root-blocker count
- [x] Interactive — pan/zoom controls; node click opens the existing `ItemDetailPanel` (↑/↓ cycle, Esc close — same pattern as Tree view); stale ⚑ / drift ↯ no-fill pills on nodes (T-D46 consistency); empty state
- [x] Visual layer adopts the design-handoff "Direction A · dark" tokens scoped to `.graph-view` (`views/graph/graph.css`, `--gv-*`); full design-system adoption deferred (DECISIONS WN-1b-c)
- [x] Tests — `test/graphLayout.test.ts` (model/layering/chain analysis, cycle-safety, order-independence), `test/graphView.test.tsx` (render, edges, Show-chains, node→panel, empty); obsolete Graph stub test removed from `test/stubs.test.tsx`
- [x] Full suite green — frontend 112/112, `pnpm -r typecheck` clean (3/3), `pnpm --filter @throughline/frontend build` clean
- [x] ~~Deferred~~ **cross-session-mention edge** (SPEC §7.11): **resolved in Phase 17** — `Item.mentions` projection + third graph edge kind. WN-1b-a status updated; SPEC §7.11/§7.17 ratification is the separate follow-up clarification PR. See "Phase 17 — Item mentions" below.
- [x] ~~Deferred~~ **communication-model graph layer** (SPEC §7.11): **resolved in Phase 18** — typed §6 grammar (T-D49), rule-level graph derivation + GraphView fourth layer (T-D50, C-D18). DECISIONS WN-1b-b status flipped. Concrete-instance edges from parsed contract files remain deferred to a later phase. See "Phase 18 — Communication-model graph layer" below.
- CODE_SPEC §18 graph-view bullet revised to the as-built shape (implementation-shape, CODE_SPEC-only per spec-drift policy). SPEC §7.11 functional text left to the spec author (surfaced via WN-1b-a/b, not silently edited).

---

## UI Redesign — full design-system adoption

Not a ROADMAP phase. Visual layer over the unchanged data model / view-mode plumbing, per the design handoff (`docs/_meta/throughline/mockups/THROUGHLINE/design_handoff_throughline_ui/`). One PR, four slice commits, Gitar-reviewed per slice. Offline posture held — fonts self-hosted (no Google Fonts CDN).

### Slice 1 — tokens + GraphView reconciliation

- [x] `packages/frontend/src/styles.css` token layer replaced wholesale with the handoff `theme.css` tokens — 3 directions × 2 themes × 3 densities, plus a `:root` A·dark fallback so the cascade never resolves unstyled
- [x] v1 default hardcoded `A · dark · comfortable` on `<body>` (`main.tsx`); Slice 4 makes it settings-driven
- [x] Legacy token names (`--bg-elev` / `--bg-soft` / `--border` / `--fg-dim`) aliased onto the new tokens so the ~25 existing components keep rendering; aliases removed per-component in the Slice 2 declass sweep
- [x] Fonts self-hosted offline via `@fontsource` (Geist Sans/Mono, Instrument Serif, IBM Plex Sans/Mono, JetBrains Mono — latin subset, theme-used weights); `src/fonts.css`; woff2 bundled by Vite — **no CDN call** (corrects the handoff README's Google Fonts `<link>`)
- [x] GraphView `--gv-*` scoped token block deleted (`views/graph/graph.css`); every rule repointed to global tokens — GraphView now follows direction/theme/density. **Closes DECISIONS WN-1b-c.**
- [x] Suite green — frontend 112/112, `pnpm --filter @throughline/frontend typecheck` clean, `build` clean (fonts emitted as offline assets)

### Slice 2 — shell + vocabulary sweep

- [x] `components/Icon.tsx` — 15-glyph inline-SVG icon set (typed `IconName`), ported from `prototype/icons.jsx`
- [x] `components/Wordmark.tsx` — direction-specific (A through-line glyph / B serif masthead / C terminal prompt); cursor blink gated behind `prefers-reduced-motion: no-preference`
- [x] `components/Sidebar.tsx` — two grouped nav rails (Project / Methodology) + settings link; replaces `ViewToggle`; visibility predicates (Primary units / Gates) preserved from `views/modes.ts`; directives count + drift-inbox warn badge
- [x] `Header.tsx` rebuilt to the handoff layout (Wordmark → hairline → project switcher → spacer → scratchpad → inbox → cost → live → jump); directives/drift/backup/settings moved to the sidebar
- [x] `App.tsx` switched to the `grid-template-areas` shell (`.app-root` → `.app` head/side/main); DownBanner kept above the grid
- [x] Shell + pill/tag/btn/card vocabulary appended to `styles.css`; dead `.app-shell`/`.header`/`.view-toggle`/`main.view` blocks removed
- [x] Declass pass — single global block zeroes legacy rounded corners and removes pastel tag/pill fills (per handoff README step 3) without touching the ~25 components individually; per-screen structural restyle is Slice 3
- [x] `ViewToggle.tsx` + `test/viewToggle.test.tsx` deleted; `test/sidebar.test.tsx` written (visibility predicates + no-project state); `test/directives.test.tsx` Header-hint test repointed to the sidebar count
- [x] Suite green — frontend 113/113, typecheck clean, build clean
### Slice 3 — HomeView build-out + Capture promotion + per-screen polish

- [x] `views/HomeView.tsx` — promoted out of `stubs.tsx` to a real surface: hero (eyebrow/h1/meta + scan & + Capture actions), 4-stat strip (in-progress / blocked / drift / directives), in-progress + blocked lists, drift summary, periodic-review nudge. Wired to `useItems` / `useDriftInbox` / `useDirectives` / `useStaleThreshold`. Code-TODO scan entry point preserved.
- [x] CC-push timeline and methodology phase card **intentionally omitted** — Throughline does not model that data yet; faking it was rejected (same honesty stance as Pass 1b's deferred edges)
- [x] `views/CaptureView.tsx` — first-class capture surface; new route `/projects/:id/capture`; sidebar "Dump zone" entry; embeds the existing `DumpZone` (review-before-apply modal unchanged, T-D5)
- [x] `HomeView` stub removed from `stubs.tsx`; `App.tsx` imports the real view; `test/stubs.test.tsx` HomeView-stub test removed (dedicated coverage in `homeView.test.tsx`, same pattern as Pass 1b's GraphView stub removal)
- [x] `test/homeView.test.tsx` rewritten (hero + stat strip + capture link + scan); `test/sidebar.test.tsx` covers the new Dump-zone entry implicitly via nav rendering
- [x] Per-screen polish: global declass + new pill/tag/btn/card vocabulary applies to Session / Gates / Drift via the shared stylesheet. **Deep structural restyle of those screens' markup (e.g. DumpZone `.dz`/`.review-sheet`, detail-panel slide-in) is deferred** — flagged in the handover; out of scope for a green-suite slice
- [x] Folded in two Slice-2 Gitar quality findings (PR #27): removed the dead `bundles` prop from `HeaderProps`/`App.tsx`; consolidated the duplicate `.main` selector
- [x] Suite green — frontend 114/114, typecheck clean, build clean
### Slice 4 — theme switcher + hot-reload + light mode + Directions B/C + density

- [x] Backend SSE hub built (`routes/events.ts` `createSSEHub`) — connection registry + `broadcast`; the events route registers/unregisters each connection; dead-pipe-safe. **This is new** — `useSSE`/events only handled welcome/ping before (verified, not assumed from the README)
- [x] `settings/service.ts` gains an optional `onChange(key,value)` hook fired after each successful write; `server.ts` wires it to broadcast `settings-changed` (the resolved theme triplet) for the three theme keys
- [x] `SETTINGS_DEFAULTS` += `theme_direction:'A'`, `theme_mode:'dark'`, `theme_density:'comfortable'` (so `/api/settings` returns them before first write — no FOUC fallback)
- [x] `useSSE` handles `settings-changed`, exposes `settingsChange`; `App` applies `data-direction/-theme/-density` live and feeds direction to the Wordmark
- [x] `src/theme.ts` — single `readTheme`/`applyTheme` helper used by both `main.tsx` (early pre-paint fetch, FOUC-safe, default fallback) and `App` (live SSE updates)
- [x] `SettingsView` Appearance section — direction (A/B/C), mode (light/dark), density (compact/comfortable/spacious) selects → `updateSettings`
- [x] Tests — backend `test/events.test.ts` (hub fan-out / unregister / dead-pipe), `test/settings.test.ts` onChange hook; frontend `test/theme.test.ts` (readTheme/applyTheme), `settingsView.test.tsx` appearance persistence
- [x] Folded in the Slice-3 Gitar finding (PR #27): HomeView item rows made informational (non-interactive) — no misleading affordance, since item deep-linking does not exist (honesty stance, same as Pass 1b deferrals)
- [x] Suite green — frontend 118/118, backend 261/261, `pnpm -r typecheck` clean, both builds clean

---

**Redesign close:** one PR (#27) titled "UI redesign: full design-system adoption", four slice commits + inline Gitar-finding fixes, merged to main when all four slices land Gitar-clean. No SPEC functional change (visual layer over the unchanged data model). Handover authored per `HANDOVER_TEMPLATE.md`.

---

## Pass 2 — mechanical pre-launch fixes (v1 pre-launch remediation)

Mechanical items from the v1 pre-launch verification findings (the subset that needs no spec-author decision). One PR, multi-slice. No SPEC functional change; no new T-D/C-D anchors (implementation-shape + doc fixes). Out of scope and left for the spec author: Q5/Q6/Q7, the four `RATIONALE NEEDED` markers, AI callsite↔panel asymmetry, the two Pass-1b GraphView spec gaps, voice-input/cost-threshold defaults, all v1.x items.

### Slice 1 — Lint configuration (wire ESLint)

- [x] Root no-op lint flag (carried since Phase 6a) closed: `@eslint/js` + `typescript-eslint` declared as root devDeps; the three `echo 'no lint config' && exit 0` scripts replaced with real `eslint` invocations (`shared`: `eslint src`; `backend`/`frontend`: `eslint src test`); `pnpm -r lint` convention preserved
- [x] Root `package.json` `"type": "module"` added (flat config is ESM; silences the Node reparse warning)
- [x] `eslint.config.js` `prefer-const` set to `{ ignoreReadBeforeAssign: true }` — the rule's own option for legitimately late-bound bindings (`server.ts` `disciplineEngine`, captured in the registry reload hook before assignment per C-D7); no code contortion
- [x] All surfaced findings fixed: 8 `import()`-type annotations hoisted to top-level `import type`, 7 unused vars/imports removed, 1 `prefer-const`, 1 dead `react-hooks/exhaustive-deps` disable comment replaced with a plain WHY note (no react-hooks plugin added — config kept minimal)
- [x] Suite green — `pnpm -r lint` clean, backend 261/261, frontend 118/118, `pnpm -r typecheck` clean

### Slice 2 — Backend robustness

- [x] companion `listRuns` flake (`companion.test.ts:294`) fixed at the source: `engine.ts` `ORDER BY started_at DESC` → `ORDER BY started_at DESC, rowid DESC`. `started_at` is ms-precision ISO; same-millisecond runs ordered non-deterministically. `rowid DESC` is a stable insertion-order tiebreaker (table is a normal-rowid `TEXT PRIMARY KEY`), making newest-first a real production guarantee, not a lucky test
- [x] Inbox watcher `stop()` made idempotent (`inbox/watcher.ts`): memoised `stopping` promise — a repeated `stop()` returns the same settled promise and never re-closes an already-closed chokidar watcher; `watcher` nulled after close
- [x] Regression test added — `inbox.test.ts` "inbox watcher" describe: `stop()` twice returns the same promise, both resolve, a third resolves `undefined`
- [x] Folded in the Slice-1 Gitar finding (PR #28): the `dbPath` field — genuinely dead (snapshots use better-sqlite3 `db.backup()`, not the file path) — fully removed from `CreateBackupServiceOptions` and all callers (`server.ts`, `backup.test.ts`), not left as a half-removed contract
- [x] Suite green — `pnpm -r lint` clean, backend 262/262, frontend 118/118, `pnpm -r typecheck` clean. (Pre-existing unrelated flake noted: `server.test.ts` backup/export shares a fixed `tmpdir()/throughline-backup` with concurrent test files; out of the Pass-2 scope list — not introduced here, passes isolated and on re-run)

### Slice 3 — Backend boundary validation

- [x] Reconcile `session_id` validated up front, not written-then-corrected (`reconcile/service.ts`): a single `sessionId` (normalised to null when the session doesn't exist) now feeds the items query, the engine diff, the INSERT, and the audit `triggerContext` — coherent from the first write. The post-INSERT `UPDATE … SET session_id = NULL` correction dance deleted; no transient invalid row ever persists. Final state identical
- [x] Gate-trigger explicit-project guard (`gates/routes.ts`): `/api/gate-trigger` with a supplied-but-unknown `project_id` now returns `404 project_not_found` (consistent with the four sibling gate routes) instead of dispatching into a silent null resolve that returned `{ ok:true, fired:0 }` — a misrouted hook now fails loudly. Loopback triggers with no `project_id` (best-effort, repo-path/no-resolve) unchanged
- [x] Regression tests added — `reconcile.test.ts`: a non-existent `session_id` normalises to null across row/diff/re-fetch; `server.test.ts` "POST /api/gate-trigger": unknown `project_id` → 404, no `project_id` → still `{ ok:true, fired:0 }`
- [x] Suite green — `pnpm -r lint` clean, backend 265/265, frontend 118/118, `pnpm -r typecheck` clean

### Slice 4 — Frontend async correctness

- [x] `useSessions.refresh` now returns `Promise<void>` (async/await form; no-projectId branch resolves immediately) — consistent with `useDriftInbox`/`SessionView`'s awaitable refresh; hook's own `useEffect` uses `void refresh()` to match the established pattern
- [x] `SessionsIndex.create()` now `await refresh()` before `navigate()` — the sessions list is reloaded before the route changes, instead of a fire-and-forget call racing the navigation
- [x] Regression assertion added to the existing `sessionView.test.tsx` "SessionsIndex" test: `listSessions` is called with the project id during the create→navigate flow
- [x] Suite green — `pnpm -r lint` clean, backend 265/265, frontend 118/118, `pnpm -r typecheck` clean

### Slice 5 — README + CLI help

- [x] CLI gained explicit `--help` / `-h` / `help` (`cli/index.ts`): help is what was asked for → printed to **stdout**, exit **0**. `helpText()` extracted; misuse (no command / unknown command / missing required arg) still routes through `usage()` → **stderr**, exit **2**. Manually verified all four paths
- [x] README CLI section points at `… src/cli/index.ts --help` ("full, always-current subcommand list") instead of the prior "run with no arguments" (which printed to stderr with exit 2 — a poor discovery path and an inaccurate instruction)
- [x] README auto-run wording made consistent — Architecture line now reads "configured for login auto-start", matching the Install section's "Login auto-start" and the doc title `docs/install/auto-start.md` ("# Login auto-start")
- [x] Discipline-doc discoverability: `SESSION_START.md` and `HANDOVER_TEMPLATE.md` added as rows to the README **Documentation** table (with a pointer to the Development-discipline section), so the table is a complete doc index rather than silently omitting the discipline floor
- [x] Suite green — `pnpm -r lint` clean, backend 265/265, frontend 118/118, `pnpm -r typecheck` clean, `pnpm build` clean

---

**Pass 2 close:** one PR (#28) titled "Pass 2 — mechanical pre-launch fixes", five slice commits + the inline Slice-1 Gitar `dbPath` fold-in (Slice 2). Merges to main when all slices land Gitar-clean. No SPEC functional change; no new T-D/C-D anchors (implementation-shape + doc fixes). Spec-author items (Q5/Q6/Q7, the four `RATIONALE NEEDED` markers, AI callsite↔panel asymmetry, the two Pass-1b GraphView gaps, voice/cost defaults, v1.x) deliberately untouched. Handover authored per `HANDOVER_TEMPLATE.md`.

---

## Spec clarification — Q5/Q6/Q7 close-out

Docs-only spec-author resolution slice. Ratify-as-built; no code, no new T-D/C-D anchors. Branch `claude/resolve-spec-questions-ybwen`.

- [x] Q5 (bundle markdown) resolved — SPEC §7.1 formalises the eleven-section H2 grammar; one `bundle.md` per directory in v1, multi-file (manifest) a documented v2 possibility. CODE_SPEC C-D3 body ratified; Questions item 5 closed
- [x] Q6 (companion modes ↔ review patterns) resolved — SPEC §7.18 formalises companion mode as a bundle-declared identifier; v1 effect = session-start template selection only; richer coupling explicitly deferred to a worked example. CODE_SPEC C-D9 body ratified; Questions item 6 closed; Phase-13 row provisional note retired
- [x] Q7 (verifier-tool plurality) resolved — SPEC §7.16 reframed to the GitHub Checks annotation contract (Semgrep = v1 reference tool); SPEC §10/§13/§14, DECISIONS T-D26 rationale, CODE_SPEC C-D16 reconciled under the boundary. Questions item 7 closed; Phase-10 row provisional note retired
- [x] CODE_SPEC "Questions for the spec author" items 5–7 closed with SPEC references (items 8–9 remain open)
- [x] Handover authored per `HANDOVER_TEMPLATE.md`; PR opened at close

---

## Phase 17 — Item mentions as a first-class relation

Builds the cross-session-mention edge deferred by Pass 1b (DECISIONS WN-1b-a). Chunked-execution PR #30, five slice commits + inline Gitar fold-in, single branch `claude/throughline-phase-17-items-kJJNB`. No SPEC.md functional edits — SPEC §7.11/§7.17 ratification is a separate follow-up clarification PR.

- [x] Slice 1 — data model + capture: migration `0011_phase17_mentions.sql` (`item_mentions` join table + reverse index, mirroring `item_blockers`); `Item.mentions: string[]` (shared); `items/mentions.ts` `parseMentionRefs` (explicit `@item:<id>` token, deduped, first-seen order); `items/service.ts` derives on create+update (same-project, self-dropped) with an unchanged-set short-circuit (no spurious write/audit), `loadItemChildren`+`rowToItemWithChildren` hydrate, `mentions` audit on change. `test/mentions.test.ts`
- [x] Slice 2 — linked-items endpoint: `GET /api/projects/:id/items/:itemId/links` → `{ parents, children, mentioning, mentioned }`; `items.links(id)` service method (batched `WHERE id IN (...)`); shared `ItemLinkSummary`/`ItemLinks`. `test/mentions.test.ts` + `test/server.test.ts`
- [x] Slice 3 — detail panel: `ItemDetailPanel` "Linked items" renders the four §7.17 groups (clickable, cycle via `onCycle`; muted em-dash for empty); `api.getItemLinks`; `styles.css` `.linked-*`. `test/linkedItems.test.tsx`
- [x] Slice 4 — GraphView mention edges: third `EdgeKind` `'mentions'`; `buildGraph` emits from `item.mentions` (out-of-set ignored); non-structural (excluded from layering + "Show chains"); accent-dotted style + legend entry. `test/graphLayout.test.ts` + `test/graphView.test.tsx`
- [x] Slice 5 — docs + handover: this section; Pass-1b cross-session-mention row flipped; CODE_SPEC §18 + item-model revised as-built; DECISIONS WN-1b-a status updated (no new anchor); handover per `HANDOVER_TEMPLATE.md`
- [x] Inline Gitar fold-in (Slice-2 finding): `links()` per-id `getRow` + JS re-sort replaced with batched `WHERE id IN (...) ORDER BY created_at, id` (loadItemChildren convention) — resolved on PR #30
- [x] Full suite green — backend 276/276, frontend 123/123, `pnpm -r lint` clean, `pnpm -r typecheck` clean, `pnpm build` clean

---

## Phase 18 — Communication-model graph layer

Resolves the deferred communication-model graph layer from Pass 1b (DECISIONS WN-1b-b). Chunked-execution PR #31, five slice commits + two inline Gitar fold-ins, single branch `claude/kind-heisenberg-cQiAl`. Mints T-D49 (§6 grammar + per-project supply split) and T-D50 (rule-level graph + coupled freshness with item state) in SPEC §14 / DECISIONS; mints C-D18 (implementation shape) in CODE_SPEC. SPEC §7.11 is updated functionally in this PR — the grammar+render scope is itself the spec answer WN-1b-b asked for.

- [x] Slice 1 — bundle §6 grammar + parser: §2 gains `tiers: <a>, <b>, …` line; §6 walks h3 sub-sections (`### Edge type:`, `### Tier routing:`, `### Producer ownership`) mirroring `state-machine.ts`. Tier-name resolution against §2 happens at parse time. Shared types `CommunicationEdgeType`, `TierPair`, `Mechanism`, `TierRoutingRule`, `ProducerOwnership`. `test/communicationModel.test.ts`; test-bundle's §2/§6 rewritten generically (router, tier-a/tier-b, mediated + direct-call, tier-b routing, producer-owns-shape)
- [x] Slice 2 — per-project view + settings: `projects.settings_json.communication_model.{contract_sources, module_tiers}`; `GET /api/projects/:id/communication-model` → `{ bundle, contract_sources, module_tiers, resolved: { contract_sources, module_tiers, declared_tiers } }` (pure path-join, no FS reads); replace-semantics `PUT`. SettingsView surfaces both blocks per project behind a "configured but not yet consumed" hint. `test/communicationView.test.ts` + `test/settingsView.test.tsx`
- [x] Slice 3 — pure rule-level derivation: `deriveCommunicationGraph({ bundle, modules, module_tiers })` enumerates edges by expanding each declared edge type over unordered module pairs (self-loops excluded) whose tiers satisfy `when:`; tier-routing overrides apply with lexicographic conflict-resolution; `producer_owns_shape` mirrors bundle declaration. `GET /api/projects/:id/communication-model/graph`. `test/communicationGraph.test.ts`
- [x] Slice 4 — GraphView fourth layer: "Show communication model" toolbar toggle (hidden for bundles whose §6 is `none`), tier-swimlane SVG canvas, mediated-edge two-arrow rendering through the mediator module, `invariant: violation` styled as danger + violation badge in the side panel, `ModulePanel` (ref / tier / item-count / producer-owns-shape / incident edges). `Show chains` disables in comm mode (mutually exclusive). Coupled freshness (T-D50): `commItemsKey` projects items to a `ref:count|…` string in `views/graph/commUtils.ts`; the fetch effect refetches when it changes. `test/communicationCanvas.test.tsx`
- [x] Slice 5 — docs + spec edits + handover: this section; Pass-1b WN-1b-b row flipped; SPEC §7.11 wording updated; T-D49 / T-D50 minted in SPEC §14 + DECISIONS; C-D18 minted in CODE_SPEC; CODE_SPEC §18 graph-view bullet updated; DECISIONS WN-1b-b Resolution paragraph; handover per `HANDOVER_TEMPLATE.md`
- [x] Inline Gitar fold-in #1 (Slice-2 finding): stale-view-state in `CommunicationModelSection.save()` — `load()` made awaitable + `save()` awaits it (commit `0734e73`); follow-up fix-round closed the structural cause by reading `view` via a ref so the three call-site closures no longer capture render-time view (commit `61834ff`). Resolved on PR #31
- [x] Inline Gitar fold-ins #2/#3 (Slice-4 findings): duplicated `edgeId` helper extracted to `views/graph/commUtils.ts`; comm-graph coupled-freshness via `commItemsKey` (a minimal deterministic projection of `ref → item_count` from items) added to the fetch effect's dependency array, so the graph refetches on module-set / item-count changes but not on item title / status / description edits. Spec-author reframed the freshness fix as a property of T-D50's render semantics, not just a refresh bug. Resolved on PR #31 (commit `c96ed73`)
- [x] Full suite green — backend 315/315, frontend 143/143, `pnpm -r lint` clean, `pnpm -r typecheck` clean

---

## Phase 19 — `.throughline/` config and CLI init

Phase 19 doc prerequisites landed in Session 2 of the doc-authoring stream (T-D51, T-D52, C-D19 minted; SPEC §7.26 + §14 amended; `docs/.throughline-schema.md` introduced). Build chain opened 2026-05-27 — tracking issue #46 (`Auto-continue: phase-19-clone-and-go`), chain state `.claude-code/auto-continue-state.json`.

Slices (per spec-author-approved decomposition):

- [x] **Slice 1** — Bundle loader third arm + repo-path normalisation (C-D19 surfaces 1 + 8). PR #47, merged 2026-05-27, 1 fix-round. Handover: `docs/_meta/throughline/handovers/2026-05-27-phase-19-slice-1-loader-third-arm-and-repo-path-normalisation.md`.
- [x] **Slice 2** — Init config-reader + git-remote auto-detect + re-init flow (C-D19 surfaces 2 + 3 + 7). PR #48, merged 2026-05-27, 1 fix-round. Handover: `docs/_meta/throughline/handovers/2026-05-27-phase-19-slice-2-init-readers-and-reinit-flow.md`.
- [x] **Slice 3** — CLI `throughline init` subcommand + T-D52 doc amendment (C-D19 surface 4). PR #49, merged 2026-05-27, 0 fix-rounds. Handover: `docs/_meta/throughline/handovers/2026-05-27-phase-19-slice-3-cli-init-subcommand.md`.
- [ ] **Slice 4** — Frontend NewProjectModal `bundle_path` field + SettingsView missing-config block (C-D19 surfaces 5 + 6). Backend extends `GET /api/projects/:id` response with `throughline_status` (absent / partial / complete) computed at request time. PR pending.

---

## Phase 20 — Bootstrap import file shape and idempotent re-run

Phase 20 doc prerequisites landed in Session 3 of the doc-authoring stream (T-D53, T-D54, C-D20 minted; SPEC §7.27 + §14 amended; `docs/.throughline-schema.md` extended). Build chain opened 2026-05-27 — tracking issue #52 (`Auto-continue: phase-20-bootstrap-ingest`), chain state `.claude-code/auto-continue-state.json`.

Slices (per spec-author-approved decomposition):

- [x] **Slice 1** — Schema migration: nullable `bootstrap_id TEXT` + `bootstrap_stale INTEGER` on items / sessions / library_entries, plus unique partial index per table on `(project_id, bootstrap_id) WHERE bootstrap_id IS NOT NULL` (C-D20 surface 1). PR #53, merged 2026-05-27, 0 fix-rounds. Handover: `docs/_meta/throughline/handovers/2026-05-27-phase-20-slice-1-schema-migration.md`.
- [x] **Slice 2** — Derivation module `packages/backend/src/bootstrap/derive-id.ts`: per-source-type resolvers (`decision`, `roadmap`, `handover`, `checklist`, `override`) + universal `@bootstrap-id:` override (C-D20 surface 3). PR #54, merged 2026-05-27, 0 fix-rounds. Handover: `docs/_meta/throughline/handovers/2026-05-27-phase-20-slice-2-derive-id-module.md`.
- [x] **Slice 3** — `POST /api/projects/:id/import` endpoint with bundle-aware validator, transactional upsert, per-row classification, and `hasUserEditsSinceLastBootstrap` predicate (C-D20 surfaces 2 + 4). PR #55, merged 2026-05-27, 1 fix-round (same-millisecond predicate edge case folded inline via rowid tie-break). Handover: `docs/_meta/throughline/handovers/2026-05-27-phase-20-slice-3-endpoint-upsert-predicate.md`.
- [x] **Slice 4** — Review queue UI (`BootstrapReviewModal`) + `GET /api/projects/:id/import/conflicts` + `POST /api/projects/:id/import/resolve` + SettingsView entry block (C-D20 surface 5). PR #56, merged 2026-05-27, 1 fix-round (backend `tableForEntity` exhaustive narrowing + frontend init `useEffect` guard against parent re-renders). Handover: `docs/_meta/throughline/handovers/2026-05-27-phase-20-slice-4-review-ui-and-resolve-endpoint.md`. V1 carve-outs: `merge_fields` and `archive` deferred to future polish slices. Chain `phase-20-bootstrap-ingest` closed on this PR's merge.

---

## Phase 21 — Bootstrap prompt template and Claude Code invocation contract

Phase 21 doc prerequisites landed in Session 4 of the doc-authoring stream (T-D55, T-D56, C-D21 minted; SPEC §7.28 + §14 amended; `docs/.throughline-schema.md` Throughline-managed transient files section added). Build chain opened 2026-05-28 — tracking issue #58 (`Auto-continue: phase-21-build-immutable-riddle`), chain state `.claude-code/auto-continue-state.json`.

Slices (per spec-author-approved decomposition):

- [x] **Slice 1** — Prompt template (`packages/backend/src/bootstrap/prompt-template.md`, T-D55) + `POST /api/projects/:id/bootstrap/render` endpoint + idempotent `.throughline/.gitignore` write + defence-in-depth path-guard utility (C-D21 surfaces 1, 2, and the `.gitignore` write from the implications block). PR #59, merged 2026-05-28, 1 fix-round (redundant `resolveBundle` call in `resolveBundleFile` folded inline by removing the inner call entirely; outer `loaded`-gate plus arm-2 `existsSync` correctly captures registry arm precedence). Handover: `docs/_meta/throughline/handovers/2026-05-28-phase-21-slice-1-prompt-template-render-endpoint-path-guard.md`.
- [x] **Slice 2** — Bootstrap-output chokidar watcher (`packages/backend/src/bootstrap/watcher.ts`, mirrors `inbox/watcher.ts`). Refcounted per project; startup-scan mirrors inbox `enqueueExistingFiles()`. Exposes `BootstrapWorker` interface for slice 3 wiring (C-D21 surface 3). PR #60, merged 2026-05-28, 1 fix-round (Gitar finding on `register()` after `stop()` race — late-register guard via the existing `stopping` flag; +1 regression test). Handover: `docs/_meta/throughline/handovers/2026-05-28-phase-21-slice-2-bootstrap-output-watcher.md`.
- [ ] **Slice 3** — Archive/quarantine worker (`packages/backend/src/bootstrap/worker.ts`) + `GET /api/projects/:id/bootstrap/state` read endpoint. Direct call to `BootstrapImportService.importBootstrap` (no HTTP self-call, inbox precedent). Archive on success, quarantine + `.error.json` on failure (C-D21 surface 4).
- [ ] **Slice 4** — Unified Bootstrap & clone-and-go SettingsView block. Consolidates the existing `ThroughlineStatusBlock` + new init affordance + existing `BootstrapReviewBlock` into a single component (resolves the placement question C-D20 left open) (C-D21 surface 6). Re-bootstrap (C-D21 surface 5) has no new code — same flow re-run; idempotency covered by slice 3 integration test.

---

## Phase 22 — Discipline-drift scan-on-demand for bootstrapped projects

Phase 22 doc prerequisites landed in Session 5 of the doc-authoring stream (T-D57 minted; SPEC §7.14 scan-on-demand mini-section + §14 row added; WN-clone-Q6 back-referenced; WN-clone-Q7 reframed as a durable design principle). Build prerequisites are complete and this phase is ready to open once Phase 21 lands.

_Slice splits land when this phase's build session opens._
