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
- [x] All nine view-mode routes render an empty stub under `/projects/:id/...` (`packages/frontend/src/App.tsx` routes; `src/views/stubs.tsx`)
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

## Phase 4 — Capture surfaces

- [ ] Scratchpad always-visible in header
- [ ] Scratchpad has no AI processing and no review modal
- [ ] Session dump zone accepts paste + file drop
- [ ] Library dump zone accepts paste + file drop
- [ ] Dump zone extraction parameterised by active project's bundle
- [ ] Review modal shows proposed-items + cross-session re-route option
- [ ] Voice input via browser-native speech recognition (desktop-only)
- [ ] Voice destination toggle (session vs library dump zone)
- [ ] Voice transcript pipes into dump zone flow
- [ ] Claude Code push: inbox directory configurable
- [ ] Inbox watcher picks up new files
- [ ] Inbox queue processes serially with per-file state tracking
- [ ] Inbox file → project routing convention works
- [ ] Processed files archive to dated subdirectory (default 30-day retention)
- [ ] Failed files quarantine with sibling error metadata
- [ ] Code TODO/FIXME import: manual trigger in UI
- [ ] TODO patterns default to `TODO:`, `FIXME:`, `XXX:`
- [ ] All non-scratchpad surfaces apply only after review

---

## Phase 5 — Reconcile engine

- [ ] Reconcile diff produces all six categories
- [ ] Edited row covers title and description changes under one row
- [ ] Review modal renders the six-category structure
- [ ] User can accept / reject per category before applying
- [ ] Apply mutates state and audit-logs every change
- [ ] Contradicted spawns code-drift signal (not state revert)
- [ ] Drift signal tier reflects PR association (tier-2 if associated, tier-3 otherwise)

---

## Phase 6 — Library, directives, repo `.md` ingestion

- [ ] Library entries scoped per project
- [ ] Library entries: notes, prompts, snippets, imported docs all functional
- [ ] Notes attachable to multiple items; many-to-many table populated
- [ ] Prompts support `{{var_name}}` placeholders with fill-in modal
- [ ] Snippet quick-copy button always visible
- [ ] Imported docs: AI generates summary + tag suggestions on import
- [ ] Library entry full-text search
- [ ] Library entry semantic search routed (Semble for code-related queries — placeholder until Phase 11; local embeddings for text queries — placeholder until Phase 14)
- [ ] Cross-project library toggle
- [ ] Pin directive: parent view shows pinned item sticky
- [ ] Reminder directive: relative + absolute + recurrence rules
- [ ] Reminder fires OS notification regardless of browser tab state
- [ ] Recurring reminders persist until directive removed
- [ ] Include-in-prompt directive: session-start prompt auto-prepends flagged items (placeholder hook until Phase 13)
- [ ] Directives view groups by type (pinned / reminders / include-in-prompt)
- [ ] Directives view shows count per group, each collapsible
- [ ] Reminders sorted by next firing within their group
- [ ] Repo `.md` ingestion: folder-opt-in selector
- [ ] `.md` re-ingest: snapshot by default with per-entry track-source toggle
- [ ] Library entries audit-logged

---

## Phase 7 — SiteMesh bundle delivery & bundle-aware capture parameterisation

- [ ] `methodologies/sitemesh/bundle.md` authored per the eleven-section structure
- [ ] SiteMesh bundle parses cleanly through the bundle loader
- [ ] SiteMesh-bound project: item types `todo` and `decision` declared by bundle and surfaced in UI
- [ ] SiteMesh-bound project: status lifecycles per bundle (todos 4 states; decisions 3 states)
- [ ] SiteMesh-bound project: todos and decisions render on separate boards
- [ ] Methodology-context fields populate on items (primary unit / phase / anchor citations / marker refs)
- [ ] Modules view renders for SiteMesh-bound projects with primary-unit grouping, tier classification, phase indicators, anchor/marker counts
- [ ] No code path uses SiteMesh-specific terminology unmediated by the bundle (verified by review)
- [ ] Phase 3 UI works for both freeform-bound and SiteMesh-bound projects without per-bundle code branches

---

## Phase 8 — Methodology gate runtime (four phase moments + PR-open)

- [ ] Gate dispatcher implemented per C-D6
- [ ] Pre-write moment dispatch (provisional trigger: signal file + UI action)
- [ ] Per-commit moment dispatch (provisional trigger: `.git/COMMIT_EDITMSG` watch or installed pre-commit hook)
- [ ] Plan-mode moment dispatch (provisional trigger: plan-mode marker file in Claude Code inbox)
- [ ] Post-commit moment dispatch (provisional trigger: git log poll or installed post-commit hook)
- [ ] PR-open moment dispatch via GitHub poller (placeholder until Phase 10 polling lives)
- [ ] Multi-gate per phase moment supported; gates run independently
- [ ] Each gate firing writes to `gate_firings`
- [ ] Each gate firing writes an audit-log entry
- [ ] Mechanical gates execute scripts and validators via child-process spawn
- [ ] Judgement gates call Anthropic with bundle-supplied prompt template
- [ ] Gate failures surface in methodology-gates view as proposals
- [ ] "Override with reason" action records audit-log row with reason + original findings reference
- [ ] "Fix and retry" action re-fires the gate
- [ ] SiteMesh per-commit moment: verify-structure.sh and sitemesh-pre-commit run as two independent gates
- [ ] Throughline never silently blocks the underlying repo

---

## Phase 9 — Discipline-drift engine

- [ ] Discipline-drift scanners instantiate from the loaded bundle's validation-rules section
- [ ] Scanners watch project doc files via chokidar
- [ ] Pre-write moment also fires write-time scanners
- [ ] Signals write to `drift_signals` with `stream='discipline'`
- [ ] Signals scoped to `item_id` or `primary_unit_ref` where applicable
- [ ] Methodology-gates view shows category-grouped lists
- [ ] Modules view shows badges on affected primary units
- [ ] Items associated with affected primary units inherit a methodology-drift indicator in list rows and detail panel
- [ ] Freeform-bound projects: scanner instantiation is no-op (verified)
- [ ] Bundle re-load tears down and rebuilds scanners

---

## Phase 10 — GitHub integration & code-drift detection

- [ ] GitHub PAT stored in secrets file (not datastore)
- [ ] Polling at 60s for active sessions, 5min otherwise
- [ ] ETag caching reduces redundant API calls
- [ ] Per-project GitHub `owner/repo` configuration
- [ ] PR badges render (needs review / approved / merged)
- [ ] Activity timestamps + PR links surface per session
- [ ] Auto-reconcile on merge with high/medium/low confidence branches
- [ ] High-confidence: auto-apply with toast + 24h undo
- [ ] Medium: notification badge + one-click approve
- [ ] Low: opens reconcile modal as normal
- [ ] Confidence scores logged to audit history from day 1
- [ ] Manual item-to-PR linking: auto-detect from active branch
- [ ] Manual item-to-PR linking: override action
- [ ] Manual item-to-PR linking: skip path
- [ ] Re-association possible from item detail panel anytime
- [ ] Code-drift tier-1: Semgrep findings read via GitHub API and matched to items by rule filename
- [ ] Tier-1 failure badges item red; passing clears badge
- [ ] Tier-2 GitHub revert event detection; item badged orange
- [ ] Tier-3 watches for new PRs touching files in `item_code_refs`; item badged yellow
- [ ] Tier-4 dedup: cosine ≥ 0.80 trigger, AI confirmation pass for 0.70–0.80
- [ ] Tier-4 signals route to drift inbox (not item badge)
- [ ] Tier-4 stale signals auto-dismiss after 7 days with audit-logged reason
- [ ] Drift inbox count surfaces in header (counts both streams)
- [ ] Drift signal carries explicit reasoning text
- [ ] Re-verify-via-AI action available on every signal
- [ ] Manual re-open action available on every signal
- [ ] Orphaned rules tracked when item with verifier rule is deleted
- [ ] Orphaned rules surface in periodic review hygiene list and settings panel
- [ ] One-click cleanup-PR-draft action constructs PR via API
- [ ] Dismiss-without-removal supported and audit-logged
- [ ] Workflow-template warning fires at first GitHub-integration use if expected workflow not present in repo
- [ ] PR-open methodology gate fires via Phase 8 dispatcher

---

## Phase 11 — Semble integration

- [ ] Backend spawns Semble as a child process
- [ ] Semble lifecycle (start, restart) managed by backend
- [ ] Semble indexes the configured per-project repo on first connection
- [ ] Semble re-indexes incrementally on file changes
- [ ] Done-time code linking: Semble searches by item title + description
- [ ] Top results presented to user for confirmation
- [ ] Confirmed locations stored as `item_code_refs`
- [ ] Plain-English code Q&A: scratchpad/library question routes to Semble + Anthropic summarisation
- [ ] Code Q&A returns answer with source links
- [ ] Dump zone item creation enrichment: Semble suggestions appear in review modal
- [ ] Tier-3 code-drift detection begins firing as items accumulate code refs

---

## Phase 12 — Companion review runtime

- [ ] Bundle-declared checklists instantiate as `ChecklistRun` records
- [ ] Step state machine: pending → in-progress → passed | failed | skipped
- [ ] Mechanical steps execute via shared mechanical-execution infrastructure
- [ ] Mechanical step findings write to audit log
- [ ] Judgement steps open a UI panel
- [ ] Judgement steps accept user judgement with rationale
- [ ] Judgement steps optionally hand off to AI-via-Anthropic (default Sonnet)
- [ ] AI-judgement results carry prompt fingerprint and model in audit log
- [ ] Step transitions audit-logged
- [ ] Run completion offers optional library-note summary attached to discussed items
- [ ] Failed mechanical steps do not halt the run; override audit-logged and run continues

---

## Phase 13 — Session-start scaffolding

- [ ] Endpoint generates session-start prompts for the active project
- [ ] Companion-mode selection: bundle-declared enum with default
- [ ] Context-assembly retrieves project spec, decisions, anchors, markers, execution-plan slice, dependencies
- [ ] Include-in-prompt directives auto-prepend to the generated prompt
- [ ] Anthropic Haiku call classifies relevance
- [ ] Bundle templates section provides the prompt template
- [ ] One-click copy-to-clipboard
- [ ] Cost telemetry records every assembly call
- [ ] Freeform-bound project produces a minimum-spec prompt

---

## Phase 14 — RAG & intelligence layer

- [ ] Text substrate: local embeddings generated incrementally on content edit
- [ ] Text substrate: top-k cosine retrieval + Anthropic summarisation
- [ ] Code substrate: routed to Semble per Phase 11
- [ ] Audit-history substrate: structured queries on the audit log
- [ ] Router: keyword heuristics first pass
- [ ] Router: user-overridable per-query toggle
- [ ] RAG response cites sources across substrates
- [ ] Queries project-scoped by default with cross-project toggle
- [ ] End-of-session retro: user-initiated trigger only
- [ ] Retro generates one-page summary using items + audit + Claude Code transcripts + methodology-context updates in window
- [ ] Retro saved as library note
- [ ] Retro optionally attached to discussed items
- [ ] Retro optionally appended to `session-start.md` for next session
- [ ] Periodic review: configurable interval (default 2 weeks)
- [ ] Periodic review hygiene questions cover code-drift, discipline-drift, orphaned rules, bundle-declared hygiene categories
- [ ] Dependency-aware sequencing: topological sort weighted by blocker chain depth + downstream-unblocked count
- [ ] Sequencing deprioritises items in primary units failing methodology gates
- [ ] "Do next" view surfaces unblock-impact summaries
- [ ] Stakeholder view toggle re-renders item content in plain language
- [ ] Stakeholder view cache invalidates on item edit
- [ ] Per-list chat panel reads session items + methodology context as input
- [ ] Per-list chat proposed changes route through review
- [ ] Dump zone chat mode toggle: paste, refine, apply through review
- [ ] Chat history persisted per context and retrievable

---

## Phase 15 — Backup, cost meter, settings polish, hygiene

- [ ] Manual export downloads SQLite file as timestamped copy
- [ ] API keys excluded from export
- [ ] `methodologies/` directory excluded from export (ships with install)
- [ ] Header backup indicator turns red after threshold days (default 7)
- [ ] Auto-copy target path setting works
- [ ] Auto-copy fires on schedule when target set
- [ ] Cost meter visible in header at all times
- [ ] Cost meter breaks down by feature category
- [ ] Cost meter shows day / week / month
- [ ] Cost meter scopes per active project with global rollup option
- [ ] Daily threshold warning (configurable; default = no threshold)
- [ ] Orphaned rules panel functional in settings
- [ ] Settings panel exposes every knob in SPEC §7.25
- [ ] Settings: Anthropic API key
- [ ] Settings: GitHub PAT
- [ ] Settings: per-project local repo path
- [ ] Settings: per-project methodology bundle binding (default freeform)
- [ ] Settings: default model selector + per-feature overrides
- [ ] Settings: stale threshold
- [ ] Settings: backup nudge interval + auto-copy target
- [ ] Settings: periodic review interval
- [ ] Settings: GitHub default `owner/repo` per project and per-session branch fields
- [ ] Settings: Claude Code inbox directory + archive retention
- [ ] Settings: OS notification permission grant button
- [ ] Settings: cost meter daily threshold

---

## Phase 16 — Definition of Done walkthrough

- [ ] §11 bullet — methodology runtime loads bundles from `methodologies/`; eleven-section parsing; runtime configures validators, sweeps, marker scanners, state-machine transitions (one or more gates per phase moment), review-checklist steps, template parsers
- [ ] §11 bullet — SiteMesh and freeform bundles both ship and load
- [ ] §11 bullet — multi-project: create / switch / archive / delete functional; coexist; per-project state; default bundle freeform
- [ ] §11 bullet — items live in one local datastore per project with stable identifiers; sessions are saved views
- [ ] §11 bullet — items support infinite nesting, methodology-defined type lifecycles, blockers, tags, methodology-context refs, branch + PR refs, code refs, verifier rules, audit log
- [ ] §11 bullet — nine view modes functional and switchable; modules and methodology-gates hide where bundle declares none
- [ ] §11 bullet — all capture surfaces functional with consistent review-before-apply where applicable
- [ ] §11 bullet — reconcile produces structured diffs with all six categories and applies cleanly
- [ ] §11 bullet — three directive types functional with OS notification integration; directives view groups by type
- [ ] §11 bullet — four library content types all first-class
- [ ] §11 bullet — GitHub integration polls at documented cadence, PR state surfaces, auto-reconcile on merge confidence-thresholded; manual item-to-PR linking functional
- [ ] §11 bullet — methodology gates fire on PR open, transition events, and commit-prep moments; failures surface as proposals; never silently block
- [ ] §11 bullet — both code-drift (four tiers) and discipline-drift (bundle-defined) streams active and surfacing
- [ ] §11 bullet — stale yellow flag appears in all list views and detail panel header
- [ ] §11 bullet — Semble local integration: indexing, code Q&A, item enrichment functional
- [ ] §11 bullet — Personal RAG with three substrates and router functional
- [ ] §11 bullet — end-of-session retro, periodic review, dependency sequencing, stakeholder toggle, command palette, companion runtime, session-start scaffolding functional
- [ ] §11 bullet — cost meter visible in header at all times
- [ ] §11 bullet — GitHub auto-apply confidence scores logged in audit log from day 1
- [ ] §11 bullet — single-file backup with optional auto-copy
- [ ] §11 bullet — settings panel covers all required knobs
- [ ] §11 bullet — backend installs and runs via documented single-command setup; frontend served from backend
