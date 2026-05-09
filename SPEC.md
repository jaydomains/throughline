# Throughline

**Code identifier:** `throughline`
**Tool class:** Local single-user session companion
**Owner:** Kunda Tech (Jay)
**Repo path:** `throughline/`
**Last updated:** 2026-05-09

---

## TL;DR

Throughline is a session companion for parallel AI-coded development. It tracks outstanding work across multiple Claude Code sessions, surfaces drift in completed items by combining static rule checks (Semgrep) with semantic code search (Semble), and turns saved notes and prompts into active memory. It runs locally as a backend service and a browser UI on the user's laptop. Single user, single machine, single-file datastore.

---

## 1. Authority and verification

This spec describes the **target end state** of Throughline v1 at the functional level. It is the source of truth for *what* Throughline does and *why*. It is not the source of truth for *how* — implementation choices (languages, frameworks, libraries, schema, file paths) are owned by `CODE_SPEC.md` and produced by Claude Code from this spec.

The codebase is the source of truth for what's currently built. When this spec and the code disagree on functionality, one must be updated to match the other or the discrepancy must be recorded as a deliberate decision in section 14. Silent drift is the failure.

Verification checklist: `./CHECKLIST.md` — read at session start, update at session end.

---

## 2. What Throughline is

Throughline tracks work across parallel Claude Code sessions. It exists because keeping global state across many concurrent AI coding sessions, fragmented `.md` files, and chat scrollback overwhelms working memory.

It does five things:

- **Tracks outstanding work** — todos and decisions with status lifecycle, blockers, tags, and infinite nesting. Items live in one pool; sessions are saved views over that pool.
- **Captures messy input** — paste a Claude Code transcript, drop a `.md` file, dictate while driving, or jot to the scratchpad. AI extracts and classifies; the user reviews before items land.
- **Stores reference material** — notes, prompts, snippets, imported docs in a searchable library. Items can carry directives that turn them into reminders or session-prompt augmentations.
- **Detects drift on completed items** — tiered signal system combining static rule checks (Semgrep, via GitHub Actions), semantic code search (Semble, locally), GitHub PR events, and dump-zone heuristics. Strong signals badge items directly; weak signals collect in a drift inbox.
- **Closes the loop with GitHub** — the backend polls for PR events, surfaces status, and triggers reconcile flows on merge with confidence-thresholded apply.

---

## 3. Architecture

Throughline runs as two pieces on the user's laptop.

**Backend service.** A long-lived local service handling all persistence, file watching, Semble and Semgrep integration, GitHub polling, scheduled work (reminders, periodic reviews), Anthropic API calls, and Claude Code → Throughline push. Auto-runs on login.

**Browser UI.** A web UI served from the backend over a local-only address. The browser does not access the filesystem, OS notifications, or external networks directly; the backend mediates everything.

Throughline opens by starting the backend (one command, scriptable on login) and pointing a browser at its local address. Closing the tab does not kill anything in flight — reminders fire, polling continues, drift checks run.

The split between backend and browser is a functional decision: the UI alone could not do background work, scheduled tasks, or filesystem watching. Putting those in the backend lets the user close the browser without losing the things that matter.

---

## 4. Who uses it

Single user — Jay. No multi-user model. No auth. No sharing. Everything runs on Jay's laptop for Jay alone.

---

## 5. What Throughline does NOT do

- No multi-user collaboration, shared sessions, comments, or assignment.
- No cloud sync across devices. Copying the local datastore is the only cross-device mechanism.
- No webhooks. GitHub awareness is polling-only.
- No background work outside the local backend process. If the backend isn't running, nothing fires.
- No binary asset storage — text and structured data only.
- No replacement for Git, GitHub, Claude Code, or any IDE. Throughline observes and aggregates.
- **No autonomous code execution, external API mutations, or repo file writes without explicit human review.** Internal file movements within Throughline-managed directories (Claude Code inbox archiving, failure quarantine, datastore housekeeping) are not user-facing writes and run autonomously.
- No silent state changes. Done items are auto-marked done by AI only with confidence-thresholded auto-apply, audit log entry, and one-click undo.
- No standalone code architecture viewer. Throughline visualises the work; code architecture lives in tools designed for that purpose (Semble for search, Semgrep for rule verification).

---

## 6. Glossary

| Term | Definition |
|---|---|
| **Item** | A unit of tracked work or decision. Carries identity, lifecycle status, blockers, tags, parent/children, session memberships, code refs, verifier rules, directives, optional branch reference. Two types: `todo` and `decision`. |
| **Session** | A saved view that filters items by membership. Roughly one Claude Code session, branch, or focused effort. Items can belong to multiple sessions. |
| **Board** | Within a session view, items split into two columns: todos and decisions. Different lifecycles, rendered side by side. |
| **Library entry** | Non-item reference content: notes, prompts, snippets, imported docs. Notes can attach to one or more items. |
| **Directive** | An active rule attached to an item or library entry. Three types: pin, reminder, include-in-session-prompt. |
| **Dump zone** | Capture surface where unstructured text or files are pasted, processed by AI, and routed to items or library entries after human review. |
| **Scratchpad** | Friction-free capture surface. Type a thought, comes back later. No review modal, no AI processing. |
| **Reconcile** | The flow that takes new input and produces a structured diff against existing items for review and apply. |
| **Drift** | The state of an item being marked done but showing signals of regression or wrong-classification. |
| **Drift inbox** | Aggregator for weak drift signals. Strong signals badge items directly; weak signals collect here so they don't pollute main views. |
| **Orphaned rule** | A Semgrep verifier rule whose owning item has been deleted. Stays in the repo until manually cleaned up; tracked by Throughline for hygiene surfacing. |
| **View mode** | The top-level UI mode: home, sessions, tree, graph, library, directives. |

---

## 7. Core functionality

### 7.1 Items as first-class data, sessions as views

Items live in a single pool with stable identifiers. A session is a saved view definition that filters the pool by item membership.

**Membership and routing.** A new item created from session A's dump zone is associated with session A by default. Reconcile against session B can add session B to an item's membership without duplicating the item. Marking an item done in any session view marks it done everywhere it appears. Identity is global; visibility is filtered.

**Cross-session routing at capture.** When dump zone extraction proposes an item that obviously belongs to a different session, the review modal lets the user re-route before applying.

**Session deletion.** Deleting a session removes the view definition only. Member items persist, accessible from other views or the home surface. Items have no "orphan" state.

### 7.2 Item shape

Each item carries:

- A stable identifier
- A type — `todo` or `decision`
- A title — short imperative for todos, declarative for decisions (one line)
- A long-form description in markdown
- A status — for todos: `todo` / `in-progress` / `blocked` / `done`. For decisions: `open` / `locked` / `superseded`
- A free-text blocker description for external waits ("waiting on Carel's review")
- Structured blocker references — links to other items that block this one, driving graph edges
- Tags — drawn from the module taxonomy plus custom user tags
- Parent and children references — supporting infinite nesting
- Session memberships — the saved views this item appears in
- **Branch reference (optional)** — name of the git branch this item relates to, used for PR association and drift detection. May be auto-populated from the active session's branch field, or set manually.
- **PR association (optional)** — references to one or more pull requests this item is tied to, used for tier-2 drift detection. Populated automatically by GitHub auto-reconcile (7.10) or manually (7.11).
- Attached notes — references to library notes (replaces the per-item journal field — see 7.6)
- Code references — code locations identified by Semble for this item
- Verifier rule references — Semgrep rules that verify this item if marked done
- Directives — active behavioural rules
- Audit history reference
- Created-at and updated-at timestamps

### 7.3 Boards

Within a session view, items split into:

- **Todos board** — actionable items, four-state lifecycle.
- **Decisions board** — architectural commitments, three-state lifecycle.

The split exists because todos and decisions have different shapes and lifecycles. Mixing obscures both.

### 7.4 Capture surfaces

Seven ways data enters Throughline:

- **Scratchpad** — friction-free text input always visible in the header. Type a thought, save, come back. No review modal, no AI, no routing. Lowest-friction inbox.
- **Manual entry** — direct creation of items in any session view. Inline, fast, keyboard-driven.
- **Session dump zone** — paste any unstructured text or drop text-readable files. AI extracts items, classifies, suggests tags, asks clarifying questions, suggests target session. Always opens a review modal before items land.
- **Library dump zone** — same paradigm for reference material.
- **Voice input** — browser-native speech recognition. Hold-to-talk. **Desktop-only in v1** because the browser tab must be open at the laptop where the backend runs. Mobile voice capture is gated by the parked LAN-mobile-UI item (§12).
  - **Destination selection.** Before transcription begins, the user picks the destination (session dump zone or library dump zone) via a quick toggle in the voice capture overlay. Default is "session dump zone, current session." Selection persists for the current session until explicitly changed.
- **Claude Code push** — Claude Code drops a file at a configurable inbox directory on the user's laptop. The backend watches the directory, picks up new files, runs them through the dump zone flow with a "from Claude Code session: <branch>" annotation. Eliminates manual transcript paste.
  - **Backend down behaviour.** Files queue in the inbox directory until the backend reads them on next start. No work is lost; the inbox is just a directory on disk.
  - **Post-processing.** On successful processing, files move to a dated archive subdirectory (default 30-day retention, configurable in settings). On processing failure, files move to a failures subdirectory with sibling error metadata files capturing the cause for retry or manual inspection.
- **Code TODO/FIXME import** — backend scans the repo for configurable patterns and surfaces them as candidate items with file:line references.

All capture surfaces except scratchpad use the standard review-before-apply flow.

### 7.5 Reconciliation

When new input updates an existing list (Claude Code transcript, PR description, session note), reconcile produces a structured diff with six categories:

- **Completed** — input indicates the item is done.
- **New** — input introduces an item that doesn't already exist.
- **Edited** — input refines either the title or the description (or both) of an existing item without changing identity. This category covers what was previously called "renamed" plus description-only updates.
- **Blocker changes** — input adds, removes, or updates a blocker on an existing item.
- **Contradicted** — input claims an existing done item is broken, regressed, or incorrect. **Contradicted items are not auto-reverted** — instead, they spawn a tier-2 drift signal (if a PR is associated) or tier-3 signal (otherwise) and are surfaced via the drift inbox or item badge for the user to act on. Drift discipline applies; reconcile does not silently re-open items based on input alone.
- **No-change** — input mentions the item but doesn't update it.

User reviews the whole diff and applies it.

The one exception is GitHub-triggered reconcile on PR merge with high confidence (see 7.10).

### 7.6 Library

Four content types, all first-class:

- **Notes** — long-form markdown. Tagged. Optionally attached to one or more items. **Replaces the per-item journal field from earlier drafts** — there is now one place for journaled thinking, not two.
- **Prompts** — saved prompt templates with optional `{{variable}}` placeholders. One-click "use" opens a fill-in modal and copies the resulting prompt to clipboard, ready for Claude Code.
- **Snippets** — short reference text or code blocks. Quick-copy button always visible.
- **Imported docs** — `.md` files dragged in or repo-ingested. AI generates summary and tag suggestions on import.

All library entries support full-text search, AI semantic search (routed to Semble for code-related queries, local embeddings for note-related queries), tag filtering, and pinning to sidebar top.

### 7.7 Repo `.md` ingestion

Folder-opt-in. User points the backend at a directory; the backend scans for `.md` files and offers to ingest them as library imported-doc entries. AI generates summary and tag suggestions during import. Per-folder opt-in keeps `node_modules` and similar noise out.

### 7.8 Directives layer

Items and library entries can carry directives. Three types in v1:

- **Pin** — sticky in its parent view.
- **Reminder** — relative ("in 3 days") or absolute ("Friday 14:00"); supports recurrence rules. Fires via OS notification when due, regardless of whether the browser tab is open.
- **Include in session-start prompt** — Throughline maintains a generated session-start prompt that auto-prepends every flagged item. One-click copy when starting a Claude Code session.

Items with active directives display a badge icon. A dedicated **Directives view mode** lists every active directive across the app, **grouped by type**:

- **Pinned** — unordered, stickied items
- **Reminders** — sorted by next firing (soonest first)
- **Include-in-prompt** — unordered, all flagged items

Each group has a count and is collapsible. Pins and include-in-prompt directives are always-active and don't have a "next firing" — sorting them by firing time would be meaningless, hence the type grouping.

Directive types from earlier drafts (append-to-document, surface-on-tag, surface-on-session, recur-only-without-time-anchor) are deferred. Most can be reproduced through saved-view bookmarks plus the existing reconcile mechanism if they prove necessary.

### 7.9 View modes

A view mode toggle in the header switches between renderings of the same data pool:

- **Home** (default) — across-everything surface. The answer to "where am I right now." Top of view: items in progress this week, items recently flagged with drift signals, items mentioned in the last Claude Code push, items unblocked since last visit. Below: drift inbox count, scratchpad jot count, recent activity feed. Not a session, not a board.
- **Sessions** — sidebar of session views, main area shows the selected session's two boards.
- **Tree** — file-explorer-style hierarchy with grouping selector (by tag, session, status, blocker). Drag-drop between folders re-tags items. Items show their session memberships in brackets.
- **Graph** — interactive node-edge graph rendering. Nodes are items. Edges show parent-child, blocked-by, and cross-session mentions. "Show chains" mode highlights blocker dependency paths and root blockers.
- **Library** — sidebar of library entries with category filters and search; main area shows selected entry with editor.
- **Directives** — directives across the app, grouped by type per 7.8.

The architecture view from earlier drafts is dropped. Code architecture visualisation depends on either static analysis (which fails on architectures that route through a runtime message bus) or bespoke parsing (which couples Throughline tightly to a specific codebase). Neither path fits. Code intelligence is delegated to Semble (search) and Semgrep (rule verification).

### 7.10 GitHub integration

Backend job, polling-based.

- **Configuration** — Personal Access Token in backend config, default `owner/repo`, optional per-session `branch` field.
- **Polling cadence** — 60 seconds when a session is "active" (pinned by user or dumped to within last 2 hours), 5 minutes otherwise. Authenticated rate limit (5000/hr) is comfortable margin.
- **Events tracked** — PR opened, approving review submitted, PR merged, PR reverted.
- **Surface** — per-session badges (🟡 needs review / 🟢 approved / ✓ merged), activity timestamp, PR link.
- **Auto-reconcile on merge** — when a tracked branch merges, the backend opens the reconcile flow with PR description + squashed commit message + diff stats as input. Behaviour by AI confidence:
  - **High** — PR description literally names items, sub-items addressed, no scope ambiguity. Auto-apply with toast and 24-hour undo. Audit log captures PR number, AI reasoning, confidence score, and full PR description used. Items auto-applied as completed have the merged PR populated as their PR association.
  - **Medium** — notification badge, one-click approve.
  - **Low** — opens reconcile modal as normal for human review.

### 7.11 Drift detection

Tiered system combining four signal sources. Strong signals badge the affected item directly. Weak signals collect in the drift inbox so they don't pollute the main views.

**Tier 1 — Semgrep failure (strongest signal).** When an item is marked done, the user is offered a chance to attach a Semgrep rule that verifies the work. The rule lives in the repo; Semgrep runs on every PR via GitHub Actions. If the rule starts failing on a future PR, the item is badged red — definitively regressed.

**Tier 2 — GitHub revert event (strong signal).** A PR that a done item is associated with gets reverted. Item badged orange.

**Tier 3 — relevant code touched (medium signal).** Semble identifies the code location of a done item at done-time; that location persists as code references on the item. The backend watches for new PRs that touch those files. When they do, item gets a yellow ⚠ badge. User reviews when convenient.

**Tier 4 — duplicate-looking dump entry (weak signal).** A new dump zone item looks semantically similar to an already-done item. Goes to the drift inbox, not to the item itself. **If not acted on within 7 days, the signal is auto-dismissed with a "stale-no-action" reason recorded in the audit log** — searchable later, never silently lost.

The drift inbox surfaces as a count in the header (e.g. "3 items might need a look"). Click to expand. Strong signals stay on items where they're impossible to miss. This separation prevents badge fatigue without sacrificing detection volume.

Each drift signal carries explicit reasoning ("PR #847 touched files in this item's code references"). User can re-verify via AI ("does this still look done given the recent changes?") or manually re-open the item.

**Manual item-to-PR linking.** Tier-2 detection requires items to be associated with a PR. When auto-reconcile populates this on merge, no user action is needed. When a user manually marks an item done, Throughline attempts to associate the item with a PR via this sequence:

1. **Auto-detect** — read the active git branch (from the user's repo path setting), look up its associated PR via the GitHub API, propose that PR as the association.
2. **Override** — the item detail panel shows the proposed PR with a "wrong PR / pick another" action; the user can search recent PRs and pick or paste a PR number.
3. **Skip** — if no PR is detected and the user doesn't pick one, the item is marked done without PR association. Tier-2 drift detection is unavailable for that item; tiers 1 (if a verifier rule is attached), 3, and 4 remain.

Items can be re-associated with a PR at any time from the detail panel.

### 7.12 Code intelligence (Semble)

Semble runs locally as a service started by the backend on launch. Indexes the user's repo on first connection, watches for changes, re-indexes incrementally. Local-only, no API key.

Three uses inside Throughline:

- **Auto-link items to code at done-time.** When marking an item done, Semble searches the repo for code matching the item title and description. Top results presented for user confirmation. Confirmed locations stored as code references and used for tier-3 drift detection.
- **Plain-English code Q&A.** From scratchpad or library, the user types "where is upload validation handled?" Throughline asks Semble for relevant chunks, asks Anthropic to summarise them in plain English. Returns a readable answer plus links to source. This is the workable form of "ask questions about your own data," scoped to code.
- **Item creation enrichment.** Dump zone extraction runs item titles through Semble in the background. Suggested code references appear in the review modal so items land already linked to relevant code areas.

Semble also runs as an MCP server for the user's Claude Code (separate setup from Throughline; recommended regardless because it makes Claude Code dramatically cheaper and more accurate).

### 7.13 Static rule verification (Semgrep)

Semgrep runs in GitHub Actions on every PR. Findings post to the PR via Semgrep's GitHub integration. The backend reads findings via the GitHub API and overlays them on items via verifier rule references.

**Rule convention.** Throughline-managed rules live in a dedicated subdirectory of the repo's Semgrep configuration area, with one rule file per item, named by the item's stable identifier. This convention is what allows the backend to match Semgrep findings to items unambiguously when reading via the GitHub API. The exact path is configurable in settings.

**Workflow setup.** Throughline does not create or manage the GitHub Actions workflow. Users add a one-time workflow file pointing Semgrep at the rules path; a recommended template ships with Throughline. The backend warns at first GitHub-integration use if the expected workflow is not present in the repo.

**Drafting.** When marking an item done, the user is offered the option to write a Semgrep rule that locks in the work. AI helps draft the rule from the item description ("the upload endpoint must call validate_upload before processing"). The user reviews and commits the rule file to the repo. The item is now self-verifying.

**Deletion behaviour.** When an item with verifier rules is deleted, the rule files in the repo are **not auto-removed** — Throughline does not write to the repo without explicit user action. Instead:

- The rule is **orphan-flagged** in Throughline. The item is gone, but Throughline tracks the orphaned rule's continued existence in the repo.
- Orphaned rules surface in the periodic review hygiene list and in a dedicated "orphaned rules" panel in settings.
- From the orphaned rule's entry, a one-click action drafts a PR removing the rule file. The user reviews and merges the PR; the rule is gone from both the repo and Throughline's tracking on next poll.
- The user can also dismiss an orphaned rule entry without removing the file (e.g., to keep the rule active under new ownership). Dismissal is recorded in the audit log.

This avoids autonomous repo writes while preventing rule files from silently rotting in CI.

Items without verifier rules still benefit from drift detection tiers 2–4. Verifier rules upgrade them to tier 1.

### 7.14 Item detail panel

Right-side slide-in panel opening when an item is clicked from any view. Contains:

- Title, description, status, tags, blockers (free-text and structured ref picker)
- Branch reference and PR associations (with override actions)
- Attached notes (from library; click to open in editor)
- Code references (with Semble-linked summaries)
- Verifier rules (current pass/fail state from latest GitHub Actions run)
- Directives
- Activity log (full audit history)
- Linked items (children, parents, items mentioning this one, items mentioned by this one)
- Git context (PR, commit, branch references)

Closes with Esc or click-out. Arrow keys move through items in the parent list with the panel staying open and updating, supporting fast review sweeps.

### 7.15 Intelligence layer

- **End-of-session retro.** When a session is marked as wrapping, AI generates a one-page summary using the session's items, audit log entries from the session window, and Claude Code transcripts pushed during the session. Saved to library as a note. Optionally attached to items the retro discusses. Optionally appended to a `session-start.md` for the next session.
- **Periodic review.** Configurable interval (default 2 weeks). Surfaces hygiene questions: items in tier-3 drift state without action, decisions older than 60 days, sessions untouched 30+ days, blockers held longest, **orphaned verifier rules awaiting cleanup**. Powered by audit log queries.
- **Dependency-aware sequencing.** Topological sort across open items, weighted by blocker chain depth and number of downstream-unblocked items. "Do next" view surfaces "if you unblock these 3, 17 items become unblocked."
- **Personal RAG (three substrates).** AI-assisted search across personal data with three substrates and a router:
  - **Code substrate** (Semble) — for queries about code locations, implementations, where-things-live.
  - **Notes substrate** — local embedding-based search over library note content and item descriptions. Indexes incrementally on edit.
  - **Audit substrate** — structured queries over the audit log for time/actor/state-transition questions ("what got reopened this week").
  Router chooses one or more substrates per query, synthesises answer with citations.
- **Stakeholder view toggle.** Re-renders item content in plain language, AI-generated. Generated on demand and cached; cache invalidates on item edit.

All AI features use the Anthropic API key from backend config. Model selection is per-feature: Haiku for cheap classification, Sonnet for default, Opus for harder reasoning.

### 7.16 Chat mode

- **Dump zone chat mode** — toggle within the dump zone. Paste content, AI responds, user refines, AI adjusts. When ready, "apply" sends the result through the standard review modal.
- **Per-list chat panel** — chat scoped to the selected session view. AI reads the session's items as context. User asks "what's blocking the most stuff," "summarise where this list stands," "what should I do next." Proposed changes route through review.

Chat history is persisted per context, retrievable later.

### 7.17 Multi-list and AI consolidation export

- **Combine lists into markdown** — multi-select sessions, pick combine mode (one big `.md` with each session as a section, or zip of separate `.md` files), apply optional filters (only open items, only tagged X, only blocked), download.
- **AI consolidation** — drag in files plus paste text plus optionally pick existing sessions, AI synthesises a polished single `.md` document (e.g. merge three session transcripts and an audit doc into a clean handoff brief). Generated document opens in editor for final adjustments before download.

Per-session markdown export available as a fast path: copy a session as markdown to clipboard, formatted for paste-back into Claude Code.

### 7.18 Mermaid generation

Mermaid is an export format. Generate from any scope: a single session, items tagged X, a blocker chain. AI-generated mermaid from pasted content when the user wants to diagram something Throughline doesn't natively know about. Export as `.mmd` text or rendered SVG.

### 7.19 Audit log (queryable)

Every state change to **every item and every library entry** generates an audit log entry: timestamp, actor (user manual edit, AI extraction, AI reconcile, GitHub auto-apply), field changed, old value, new value, trigger context (PR number for GitHub triggers, model and prompt fingerprint for AI triggers).

The audit log is queryable; queries power the periodic review, retro generation, drift detection tier 1, and the personal RAG audit-history substrate. Visible in the item detail panel's history tab; searchable by time range, actor, or trigger type.

### 7.20 Backup

Backup is a single-file copy of the underlying datastore. That's it.

A header indicator turns red when no backup has been made in the configurable threshold (default 7 days). Manual export downloads a timestamped copy. Restore is putting the file back. No serialisation transformation, no separate backup format.

Optional auto-copy: configure the backend to copy the datastore to an external location (Dropbox, Drive, USB) on a schedule. Off by default; on if the user sets a target path in settings.

### 7.21 Command palette and keyboard navigation

`Cmd+K` (or `Ctrl+K`) opens fuzzy-search command palette. Jump to any session, item, library entry, directive. Run any action: new item, reconcile, export, switch view mode, open settings. Quick search across all data.

Keyboard navigation throughout: tab/shift-tab for indent/outdent in lists, arrow keys for item navigation, Enter to edit, Esc to close panels, `?` for keyboard reference.

### 7.22 Settings and cost meter

- **Anthropic API key** (backend config, not browser-accessible).
- **GitHub PAT** (backend config).
- **Local repo path** — filesystem path to the user's repo on the laptop. Used by Semble for indexing, by code TODO/FIXME import, and by `.md` ingestion. Distinct from the GitHub `owner/repo` remote setting.
- **Default model** selector (Haiku / Sonnet / Opus). Per-feature override available.
- **Stale threshold** for items not updated in N days → yellow flag. **Surfaced as a yellow border on item rows in list and tree views, and as a yellow status indicator in the item detail panel header.**
- **Backup nudge interval** and optional auto-copy target path.
- **Periodic review interval** for hygiene prompts.
- **GitHub default `owner/repo`** and per-session branch fields.
- **Claude Code inbox directory** path and processed-archive retention.
- **Semgrep rules path** within the repo.
- **OS notification permission** (one-time grant, mediated by backend).
- **Cost meter** — running token spend and dollar estimate for the current day, week, and month, broken down by feature category. Visible in header at all times. Warns when daily threshold (configurable) is exceeded.
- **Orphaned rules panel** — list of verifier rules whose owning items were deleted; one-click PR-draft cleanup or dismiss-without-removal.

---

## 8. Data categories and relationships

Throughline persists state across these functional categories:

- **Items** — the primary entity. One record per tracked todo or decision. Fields per 7.2.
- **Sessions** — saved view definitions: name, branch, context, settings.
- **Library entries** — notes, prompts, snippets, imported docs (per 7.6).
- **Directives** — active rules attached to items or library entries.
- **Audit history** — append-only record of every state change across items and library entries.
- **Chat history** — per-context conversation records (dump zone, per-list).
- **Drift signals** — weak signals queued for the drift inbox with auto-dismissal tracking.
- **Orphaned rules** — verifier rules whose owning items have been deleted, awaiting cleanup.
- **Local embeddings** — vector representations supporting the notes RAG substrate.
- **Claude Code inbox queue** — records of files received via the watched directory and their processing state.
- **Cost telemetry** — per-AI-call spend records for the cost meter.
- **GitHub state cache** — polling state, last-known PR states, ETag values.
- **Settings** — user configuration (excluding API keys).

**Relationships:**

- Items have **many-to-many** relationships with sessions (membership), library notes (attachment), code locations (Semble-confirmed references), and PR associations (per 7.11).
- Items have **one-to-many** relationships with verifier rules (a rule belongs to one item) and audit history entries (an item accumulates history).
- Library entries also accumulate audit history (one-to-many).
- Directives have a **one-to-many** relationship from their parent (an item or library entry).
- Sessions and items both reference branches as free-text strings; branches are not first-class entities.

**Conventions:**

- Stable identifiers per record, generated locally.
- Created-at and updated-at timestamps on mutable records.
- API keys live separately from primary state and never appear in backups.

Schema, indexing, and migration choreography live in `CODE_SPEC.md`.

---

## 9. AI role

The backend calls Anthropic for AI features. Every AI call is human-initiated or human-action-derived; no scheduled background AI work.

| Call | Trigger | Default model | Auto-apply threshold |
|---|---|---|---|
| Dump zone extraction | User submits dump zone | Sonnet | None (always reviewed) |
| Reconcile diff generation | User opens reconcile | Sonnet | None for manual; high-confidence only for GitHub auto-merge |
| Per-list chat | User sends chat message | Sonnet | N/A |
| End-of-session retro | User wraps session | Sonnet | None |
| Personal RAG (notes) | User submits question | Sonnet | None |
| Plain-English code Q&A | User submits question (Semble-routed) | Sonnet | None |
| Semantic dedup similarity | New item proposed | Haiku | None |
| Drift re-verify | User clicks re-verify on done item | Sonnet | None |
| AI tag suggestion | User adds untagged item | Haiku | None |
| Stakeholder view rendering | User toggles | Sonnet (cached) | None |
| Mermaid generation | User triggers export | Sonnet | None |
| Semgrep rule drafting | User locks in done item | Sonnet | None |

Cost is the user's responsibility; settings expose model selection per feature category for cost control. Cost meter (7.22) tracks spend in real time.

---

## 10. Integration points

| Integration | Direction | Mechanism |
|---|---|---|
| Anthropic API | OUT | Backend HTTPS, key from backend config |
| GitHub REST API | OUT | Backend polling |
| Semble | LOCAL | Backend-managed local service |
| Semgrep | OUT (CI) | GitHub Actions; results read via GitHub API |
| Local filesystem | IN/OUT | Backend native FS access |
| OS notifications | OUT | Backend → cross-platform OS notification capability (macOS Notification Center / Windows Toast / Linux libnotify) |
| Browser speech recognition | IN | Browser-native (voice capture) |
| Clipboard | OUT | Browser-native |

No webhook receivers in v1. No outbound emails or messaging.

**Backend mediates all external network calls.** The browser does not call Anthropic, GitHub, or any external service directly. All outbound HTTPS originates from the backend, isolating API keys to the backend process and giving the backend a single audit point for external traffic. Cite T-D32.

---

## 11. Definition of done — v1

Throughline v1 ships when all of the following are true:

- All items live in one local datastore with stable identifiers; sessions are saved views with member-by-membership semantics.
- Items support infinite nesting, four-state todo lifecycle, three-state decision lifecycle, free-text and structured blockers, full tag taxonomy, branch reference, PR associations, code refs, verifier rules, audit log.
- Six view modes (home, sessions, tree, graph, library, directives) functional and switchable.
- Scratchpad, dump zone (session and library), voice input, Claude Code push, code TODO import, manual entry all functional with consistent review-before-apply where applicable.
- Reconcile produces structured diffs with all six categories (completed, new, edited, blocker changes, contradicted, no-change) and applies cleanly.
- Three directive types (pin, reminder, include-in-prompt) functional, with OS notification integration for reminders. Directives view groups by type.
- GitHub integration polls at documented cadence, surfaces PR state, triggers reconcile on merge with confidence-thresholded behaviour. Manual item-to-PR linking (auto-detect + override + skip) functional.
- Drift detection: tier 1 (Semgrep) wired via GitHub Actions, tier 2 (revert events) functional, tier 3 (Semble code refs + PR file watch) functional, tier 4 (dedup) routes to drift inbox with 7-day auto-dismissal recorded in audit log. Verifier rule deletion behaviour (orphan-flag + cleanup PR drafting) functional.
- Semble local integration: indexing, code Q&A, item enrichment all functional.
- Personal RAG: notes substrate, code substrate (via Semble), audit history substrate, router functional.
- End-of-session retro, periodic review, dependency sequencing, stakeholder toggle, command palette functional.
- Cost meter visible in header at all times.
- Confidence scores logged into audit history from day 1 to support threshold tuning per §13.
- Local persistence with single-file backup and optional auto-copy target.
- Settings panel covers API keys, models, repo path, all path conventions, thresholds, notification permission, cost thresholds, orphaned rules panel.
- Backend installs and runs via documented single-command setup. Frontend ships served from the backend.

---

## 12. Out of scope, parked, future

**Out of scope (deliberately not built in v1 or v1.1):**

Multi-user collaboration. User accounts, auth, login flows. Multi-device sync. Email or Slack inbound integration. Calendar integration. Themes, custom colour schemes. Mobile-native app. Browser extension. Localisation beyond English. Encryption beyond what the OS provides for the local datastore.

**Parked (deferred, may revisit):**

Mobile UI accessing the local backend over LAN. Cross-machine sync via cloud storage. Webhook receivers (would require a tunnel or public endpoint). Real-time collaborative cursors. Auto-deletion of verifier rule files via PR-as-code (currently orphan-flag + manual cleanup-PR-draft only).

**Future (not committed):**

Embedding components inside SiteMesh as customer-facing features. Note: this is no longer a v1 design constraint. Throughline is scoped to its own job. Any future reuse path requires extracting pure components and is its own project.

---

## 13. Open questions

- **Reminder semantics** — relative + absolute both, with recurrence rule support. Confirm.
- **Recurring reminders** — auto-clear on action or persist until directive removed. Recommended: persist; user explicitly stops the recurrence.
- **Confidence threshold values** for GitHub auto-apply: needs calibration during build. **Plan: instrument confidence scores into the audit log from day 1 (T-D6 already requires this) so threshold tuning has empirical data. Target: revisit thresholds after the first 10 PR-merge auto-reconcile runs and again after 50.**
- **Stakeholder view caching** — invalidate on item edit. Confirm acceptable staleness.
- **Voice input language** — English only or browser-locale auto.
- **Code TODO/FIXME patterns** — configurable patterns with sensible defaults (`TODO:`, `FIXME:`, `XXX:`).
- **Library prompt variable syntax** — `{{var_name}}` (Mustache-conventional).
- **Cost meter daily threshold default** — pending real usage data.
- **Tier-4 dedup similarity threshold** — what numeric similarity score (and computed how — local embedding cosine, AI-judged similarity, both?) constitutes "duplicate-looking"? Recommended starting point: cosine similarity ≥ 0.80 against existing item embeddings, AI confirmation pass for borderline 0.70–0.80. Calibrate during build.
- **Home view "this week" and "since last visit" semantics** — recommended: "this week" = rolling 7 days from now; "since last visit" = since the last time the home view was rendered (timestamp persisted on view exit). Confirm.
- **RAG router decision mechanism** — how does the router pick between code / notes / audit substrates? Options: AI classification (extra Anthropic call, accurate but slower/costlier), keyword heuristics ("where is X" → code, "when did" → audit, default → notes), user-selectable per-query toggle. Recommended: keyword heuristics first pass with user-overridable toggle; AI classification deferred unless heuristics prove inadequate.
- **Repo `.md` re-ingest behaviour on file change** — snapshot at import time (file becomes a fixed library entry, no auto-update) or live mirror (entry updates as file changes). Recommended: snapshot by default with a per-entry "track source" toggle to enable live mirror for entries the user actively maintains.
- **TODO/FIXME import trigger** — manual user invocation, on backend start, on file change, or scheduled. Recommended: manual invocation in v1; auto-scan on backend start and on file change deferred unless manual proves insufficient.
- **End-of-session retro trigger** — user-initiated only, or also inferred from inactivity (e.g., session untouched for 7 days)? Recommended: user-initiated only in v1. Inactivity-inferred retros risk generating noise for sessions the user simply hasn't returned to yet.

---

## 14. Throughline-specific decisions

Anchor format: `T-D{n}`. Full text in `DECISIONS.md`.

| Anchor | Subject | Section |
|---|---|---|
| T-D1 | Items as first-class data with stable identifiers; sessions are saved views, not containers | 7.1, 8 |
| T-D2 | Local backend service + browser UI on user's laptop; backend handles persistence, scheduling, file watching, external network calls; UI is a presentation layer over the backend | 3 |
| T-D3 | Single-file local datastore with single-file backup; no JSON serialisation layer | 7.20, 8 |
| T-D4 | API keys live in backend configuration, separate from primary state; never accessible to the browser; never included in backups | 8, 7.22 |
| T-D5 | AI-proposed writes go through review modal; only confidence-thresholded GitHub auto-apply bypasses (with audit + 24h undo) | 7.5, 7.10 |
| T-D6 | Auto-apply on PR merge requires high-confidence assessment + audit entry + 24-hour undo | 7.10 |
| T-D7 | Polling-only for GitHub (single-user, local backend doesn't need webhooks) | 7.10 |
| T-D8 | Free-text blockers and structured blocker references coexist on items | 7.2 |
| T-D9 | Notes consolidated into library; library notes attach to items via many-to-many. No per-item journal field | 7.2, 7.6 |
| T-D10 | Library has four content types: notes, prompts, snippets, imported docs | 7.6 |
| T-D11 | Folder-opt-in for repo `.md` ingestion | 7.7 |
| T-D12 | Three directive types in v1: pin, reminder, include-in-prompt. Others deferred | 7.8 |
| T-D13 | Code architecture visualisation dropped from Throughline; delegated to Semble (search) and Semgrep (rule verification) | 7.9, 7.12, 7.13 |
| T-D14 | Mermaid is an export format only; primary visual interaction is the in-app interactive graph view | 7.18 |
| T-D15 | SiteMesh component reuse not a Throughline goal in v1; scoped to its own job | 12 |
| T-D16 | Single spec covers all of v1; no spec split per feature area | (this spec) |
| T-D17 | Claude Code push via watched filesystem inbox at a configurable directory, not clipboard or transcript paste; processed files archive to dated subdirectory, failed files archive with sibling error metadata | 7.4 |
| T-D18 | Stakeholder view toggle exists from v1 | 7.15 |
| T-D19 | Confidence-thresholded auto-apply: high → auto with toast + 24h undo, medium → notification + one-click, low → reconcile modal | 7.10 |
| T-D20 | Local backend rather than browser-only — file watching, background work, scheduled tasks live in the backend; browser handles UI only | 3 |
| T-D21 | All capture surfaces except scratchpad use review-before-apply; scratchpad is friction-free with no AI processing | 7.4 |
| T-D22 | Drift detection runs in four tiers (Semgrep, revert events, Semble-linked file watch, dedup); strong signals badge items, weak signals collect in drift inbox; tier-4 weak signals auto-dismiss with audit-logged reason after 7 days | 7.11 |
| T-D23 | Periodic review runs on configurable interval, surfaces as user-initiated questions, not background AI activity | 7.15 |
| T-D24 | Chat history persisted per context for retrieval | 7.16 |
| T-D25 | Audit log entries never expose API keys or full prompt content beyond what's needed for trigger reconstruction | 7.19, 8 |
| T-D26 | Personal RAG has three substrates (notes via local embeddings, code via Semble, audit history via structured queries); router decides which per query | 7.15 |
| T-D27 | Semgrep runs in GitHub Actions, not in the backend; backend reads findings via GitHub API. Rules follow a one-file-per-item convention named by item identifier in a Throughline-managed subdirectory of the repo's Semgrep config area; workflow is user-managed with a recommended template shipped by Throughline | 7.13 |
| T-D28 | Semble runs as a backend-managed local service; indexes user's repo, watches for changes, re-indexes incrementally | 7.12 |
| T-D29 | Backup is a single-file copy of the underlying datastore; optional configurable auto-copy target | 7.20 |
| T-D30 | Cost meter visible in header at all times; tracks per-feature spend with configurable warning threshold | 7.22 |
| T-D31 | Home view (not a session) is the default landing surface | 7.9 |
| T-D32 | Backend mediates all external network calls (Anthropic, GitHub). Browser does not access external networks; all outbound HTTPS originates from the backend. Isolates API keys to the backend process and gives a single audit point for external traffic | 3, 8, 10 |
| T-D33 | OS notifications are abstracted across platforms via a single capability layer in the backend, not duplicated per platform | 10 |
| T-D34 | Verifier rule lifecycle on item deletion: orphan-flag, not auto-removal. Rule files stay in the repo until the user merges a cleanup PR; orphaned rules surface in the periodic review hygiene list and a dedicated settings panel; one-click cleanup-PR-draft action available; dismiss-without-removal also supported and audit-logged | 7.13, 7.15, 7.22 |
| T-D35 | Manual item-to-PR linking via auto-detect from active git branch + user override + skip-acceptable. Items without PR association lose tier-2 drift coverage but retain tiers 1, 3, 4 | 7.11 |
| T-D36 | Reconcile diff has six categories: completed, new, edited (covers rename + description refinement), blocker changes, contradicted, no-change. Contradicted items spawn a drift signal rather than auto-reverting state — drift discipline applies | 7.5 |
| T-D37 | Audit log scope covers items and library entries (both accumulate history) | 7.19, 8 |
| T-D38 | Internal file movements within Throughline-managed directories (inbox archiving, failure quarantine) are not user-facing writes and run autonomously; carve-out from the no-autonomous-writes principle | 5, 7.4 |
| T-D39 | Items carry an optional branch reference, populated automatically from session context or set manually; branches remain free-text strings, not first-class entities | 7.2, 8 |

---

## 15. Dependencies

External services and capabilities Throughline depends on. Specific tool and library choices belong in `CODE_SPEC.md`.

| Dependency | Purpose | Required for |
|---|---|---|
| Anthropic API account | All AI features | Extraction, reconcile, chat, RAG, retro, drift re-verify, mermaid, stakeholder, Semgrep rule drafting |
| GitHub account with PAT | Repo and PR awareness | GitHub integration, auto-reconcile, drift signals (tiers 1, 2, 3) |
| Semgrep + GitHub Actions configured on the user's repo | Static rule verification | Tier 1 drift detection |
| Semble | Local code search | Code Q&A, item enrichment, tier 3 drift detection |
| Local environment capable of running a long-lived backend service alongside a modern browser | Backend + UI runtime | Everything |
| Cross-platform OS notification capability | Reminder firing | Time-based directives |
| Browser-native speech recognition | Voice capture | Voice input |
| Repo on the user's laptop (path configured in settings) | Code intelligence + drift detection | Semble indexing, Semgrep rule commits, code TODO import |

Throughline degrades gracefully when dependencies are absent: no Anthropic key disables AI features but everything else works; no GitHub PAT disables polling but sessions remain editable; no Semble disables code Q&A and tier 3 drift detection (other tiers still work).

---

## 16. How to use this spec in Claude Code sessions

Paste at the start of any Throughline development session:

> Read `SPEC.md` and `CHECKLIST.md` before starting. The spec is authoritative for functional intent. The code spec is authoritative for implementation. The checklist is authoritative for build state. Update the checklist as work progresses. Any deviation from the spec at the functional level requires either a code change to match, or an explicit spec update with a decision recorded in section 14. Implementation choices that do not change functionality are recorded in `CODE_SPEC.md` only.

If the session involves Semble, Semgrep, GitHub integration, or Anthropic API calls, confirm the relevant integration is currently configured locally before starting.

---

*End of Throughline v1 spec.*
