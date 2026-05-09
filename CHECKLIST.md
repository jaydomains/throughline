# Throughline v1 — Build Checklist

Read at session start. Update at session end. One section per ROADMAP phase. Items are intentionally implementation-light — the *what*, not the *how*.

When a phase completes, leave its section in place so the build-state record is preserved.

---

## Phase 0 — Repo bootstrap & decision freeze

- [x] Repo directory created at chosen path
- [x] SPEC.md placed at the repo's chosen location
- [x] §16 path references updated to match chosen structure
- [x] §14 ledger pointer path updated to match chosen structure
- [x] TL;DR `Repo path` corrected for standalone repo
- [x] README.md written
- [x] DECISIONS.md written with all 39 T-D anchor entries
- [x] CODE_SPEC.md written with C-D1 (TypeScript stack) anchored
- [x] ROADMAP.md written
- [x] CHECKLIST.md initialised
- [x] .gitignore written
- [x] Errors / contradictions in SPEC.md surfaced for spec author

---

## Phase 1 — Backend skeleton & datastore

- [ ] Backend bootstraps via documented single command
- [ ] Backend binds to 127.0.0.1 only
- [ ] Health endpoint responds
- [ ] SQLite datastore file created on first run
- [ ] Migration runner applies in order, records to `_migrations` table
- [ ] All schema tables present per CODE_SPEC.md §2
- [ ] Settings load/save round-trips via REST
- [ ] Secrets file separation (T-D4) honoured: API keys never written to datastore
- [ ] Audit log records test mutations end-to-end
- [ ] Cost telemetry table receives stub writes
- [ ] Login auto-start documented per platform

---

## Phase 2 — Browser UI shell & view-mode plumbing

- [ ] React app served by backend at `/`
- [ ] All six view-mode routes render an empty stub
- [ ] Header view-mode toggle switches routes
- [ ] Header includes scratchpad placeholder, cost meter placeholder, backup indicator placeholder
- [ ] Command palette opens/closes via `Cmd+K` / `Ctrl+K`
- [ ] Command palette fuzzy-search infrastructure ready
- [ ] Keyboard navigation primitives in place (tab/shift-tab indent, arrow nav, Esc close, `?` reference)
- [ ] SSE channel established and demonstrates ping/pong

---

## Phase 3 — Items, sessions, manual entry, item detail panel

- [ ] Item create / read / update / delete via UI
- [ ] Session create / read / update / delete via UI
- [ ] Item-session many-to-many membership works
- [ ] Status lifecycle enforced (todos: 4 states; decisions: 3 states)
- [ ] Free-text blocker description field functional
- [ ] Structured blocker references functional
- [ ] Tags add/remove
- [ ] Parent/child nesting renders to arbitrary depth
- [ ] Branch reference field on items (auto-populates from session, override available)
- [ ] Todos board and decisions board render side by side per session
- [ ] Item detail panel slides in from right
- [ ] Detail panel arrow-key navigation through parent list
- [ ] Detail panel shows: status, tags, blockers, branch ref, code refs (placeholder), verifier rules (placeholder), directives (placeholder), audit history, linked items, git context
- [ ] Manual entry inline form is keyboard-driven
- [ ] All lifecycle transitions audit-logged

---

## Phase 4 — Capture surfaces

- [ ] Scratchpad always-visible in header
- [ ] Scratchpad has no AI processing and no review modal
- [ ] Session dump zone accepts paste + file drop
- [ ] Library dump zone accepts paste + file drop
- [ ] Dump zone routes through Anthropic for extraction
- [ ] Review modal shows proposed-items + cross-session re-route option
- [ ] Voice input via browser-native speech recognition (desktop-only)
- [ ] Voice destination toggle (session vs library dump zone)
- [ ] Voice transcript pipes into dump zone flow
- [ ] Claude Code push: inbox directory configurable
- [ ] Inbox watcher picks up new files
- [ ] Inbox queue processes serially with per-file state tracking
- [ ] Processed files archive to dated subdirectory (default 30-day retention)
- [ ] Failed files quarantine with sibling error metadata
- [ ] Code TODO/FIXME import: manual trigger in UI
- [ ] TODO patterns default to `TODO:`, `FIXME:`, `XXX:`
- [ ] All non-scratchpad surfaces apply only after review

---

## Phase 5 — Reconcile engine

- [ ] Reconcile diff produces all six categories (completed, new, edited, blocker changes, contradicted, no-change)
- [ ] Edited covers rename + description-only updates
- [ ] Review modal renders the six-category structure
- [ ] User can accept / reject per category before applying
- [ ] Apply mutates state and audit-logs every change
- [ ] Contradicted spawns drift signal (not state revert)
- [ ] Drift signal tier reflects PR association (tier-2 if associated, tier-3 otherwise)

---

## Phase 6 — Library, directives, repo `.md` ingestion

- [ ] Library entries: notes, prompts, snippets, imported docs all functional
- [ ] Notes attachable to multiple items; many-to-many table populated
- [ ] Prompts support `{{var_name}}` placeholders with fill-in modal
- [ ] Snippet quick-copy button always visible
- [ ] Imported docs: AI generates summary + tag suggestions on import
- [ ] Library entry full-text search
- [ ] Library entry semantic search routed (Semble for code-related queries — placeholder until Phase 8; local embeddings for note-related queries — placeholder until Phase 9)
- [ ] Pin directive: parent view shows pinned item sticky
- [ ] Reminder directive: relative + absolute + recurrence rules
- [ ] Reminder fires OS notification regardless of browser tab state
- [ ] Recurring reminders persist until directive removed
- [ ] Include-in-prompt directive: session-start prompt auto-prepends flagged items
- [ ] One-click copy session-start prompt to clipboard
- [ ] Directives view groups by type (pinned / reminders / include-in-prompt)
- [ ] Directives view shows count per group, each collapsible
- [ ] Reminders sorted by next firing within their group
- [ ] Repo `.md` ingestion: folder-opt-in selector
- [ ] `.md` re-ingest: snapshot by default with per-entry track-source toggle
- [ ] Library entries audit-logged (T-D37)

---

## Phase 7 — GitHub integration & drift detection (tiers 1–4)

- [ ] GitHub PAT stored in secrets file (not datastore)
- [ ] Polling at 60s for active sessions, 5min otherwise
- [ ] ETag caching reduces redundant API calls
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
- [ ] Tier-1 Semgrep findings read via GitHub API and matched to items by rule filename
- [ ] Tier-1 failure badges item red; passing clears badge
- [ ] Tier-2 GitHub revert event detection; item badged orange
- [ ] Tier-3 watches for new PRs touching files in `item_code_refs`; item badged yellow
- [ ] Tier-4 dedup: cosine ≥ 0.80 trigger, AI confirmation pass for 0.70–0.80
- [ ] Tier-4 signals route to drift inbox (not item badge)
- [ ] Tier-4 stale signals auto-dismiss after 7 days with audit-logged reason
- [ ] Drift inbox count surfaces in header
- [ ] Drift signal carries explicit reasoning text
- [ ] Re-verify-via-AI action available on every signal
- [ ] Manual re-open action available on every signal
- [ ] Orphaned rules tracked when item with verifier rule is deleted
- [ ] Orphaned rules surface in periodic review hygiene list and settings panel
- [ ] One-click cleanup-PR-draft action constructs PR via API
- [ ] Dismiss-without-removal supported and audit-logged
- [ ] Workflow-template warning fires at first GitHub-integration use if expected workflow not present in repo

---

## Phase 8 — Semble integration

- [ ] Backend spawns Semble as a child process
- [ ] Semble lifecycle (start, restart) managed by backend
- [ ] Semble indexes the configured repo on first connection
- [ ] Semble re-indexes incrementally on file changes
- [ ] Done-time code linking: Semble searches by item title + description
- [ ] Top results presented to user for confirmation
- [ ] Confirmed locations stored as `item_code_refs`
- [ ] Plain-English code Q&A: scratchpad/library question routes to Semble + Anthropic summarisation
- [ ] Code Q&A returns answer with source links
- [ ] Dump zone item creation enrichment: Semble suggestions appear in review modal
- [ ] Tier-3 drift detection begins firing as items accumulate code refs

---

## Phase 9 — RAG & intelligence layer

- [ ] Notes substrate: local embeddings generated incrementally on note edit
- [ ] Notes substrate: top-k cosine retrieval + Anthropic summarisation
- [ ] Code substrate: routed to Semble per Phase 8
- [ ] Audit-history substrate: structured queries on the audit log
- [ ] Router: keyword heuristics first pass
- [ ] Router: user-overridable per-query toggle
- [ ] RAG response cites sources across substrates
- [ ] End-of-session retro: user-initiated trigger only
- [ ] Retro generates one-page summary using items + audit + Claude Code transcripts in window
- [ ] Retro saved as library note
- [ ] Retro optionally attached to discussed items
- [ ] Retro optionally appended to `session-start.md` for next session
- [ ] Periodic review: configurable interval (default 2 weeks)
- [ ] Periodic review hygiene questions cover tier-3 drift no-action, decisions older than 60 days, sessions untouched 30+ days, longest-held blockers, orphaned verifier rules
- [ ] Dependency-aware sequencing: topological sort weighted by blocker chain depth + downstream-unblocked count
- [ ] "Do next" view surfaces unblock-impact summaries
- [ ] Stakeholder view toggle re-renders item content in plain language
- [ ] Stakeholder view cache invalidates on item edit
- [ ] Per-list chat panel reads session items as context
- [ ] Per-list chat proposed changes route through review
- [ ] Dump zone chat mode toggle: paste, refine, apply through review
- [ ] Chat history persisted per context and retrievable

---

## Phase 10 — Backup, cost meter, hygiene polish

- [ ] Manual export downloads SQLite file as timestamped copy
- [ ] API keys excluded from export (T-D25, T-D4)
- [ ] Header backup indicator turns red after threshold days (default 7)
- [ ] Auto-copy target path setting works
- [ ] Auto-copy fires on schedule when target set
- [ ] Cost meter visible in header at all times
- [ ] Cost meter breaks down by feature category
- [ ] Cost meter shows day / week / month
- [ ] Daily threshold warning (configurable; default = no threshold)
- [ ] Orphaned rules panel functional in settings
- [ ] Stale-item indicator (yellow border + detail-panel header indicator) per §7.22
- [ ] Settings panel exposes every knob in §7.22
- [ ] Settings: Anthropic API key
- [ ] Settings: GitHub PAT
- [ ] Settings: local repo path
- [ ] Settings: default model selector + per-feature overrides
- [ ] Settings: stale threshold
- [ ] Settings: backup nudge interval + auto-copy target
- [ ] Settings: periodic review interval
- [ ] Settings: GitHub default `owner/repo` and per-session branch fields
- [ ] Settings: Claude Code inbox directory + archive retention
- [ ] Settings: Semgrep rules path
- [ ] Settings: OS notification permission grant button
- [ ] Settings: cost meter daily threshold

---

## Phase 11 — Definition of Done walkthrough

- [ ] §11 bullet 1 — items in single datastore with stable IDs; sessions are saved views
- [ ] §11 bullet 2 — items support full schema per §7.2 + branch/PR/code/verifier/audit
- [ ] §11 bullet 3 — six view modes functional and switchable
- [ ] §11 bullet 4 — all capture surfaces functional with consistent review-before-apply
- [ ] §11 bullet 5 — reconcile produces six categories cleanly
- [ ] §11 bullet 6 — three directive types functional with OS notifications; directives view groups by type
- [ ] §11 bullet 7 — GitHub polling + PR state + auto-reconcile + manual item-PR linking
- [ ] §11 bullet 8 — drift tiers 1–4 + orphan-flag lifecycle
- [ ] §11 bullet 9 — Semble local integration functional
- [ ] §11 bullet 10 — Personal RAG with three substrates and router
- [ ] §11 bullet 11 — retro, periodic review, dependency sequencing, stakeholder, command palette functional
- [ ] §11 bullet 12 — cost meter visible in header at all times
- [ ] §11 bullet 13 — confidence scores logged from day 1
- [ ] §11 bullet 14 — single-file backup + optional auto-copy
- [ ] §11 bullet 15 — settings panel covers all required knobs
- [ ] §11 bullet 16 — backend single-command setup; frontend served from backend
