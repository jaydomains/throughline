# Throughline

**Code identifier:** `throughline`
**Tool class:** Local single-user methodology runtime for AI-assisted software development
**Owner:** Kunda Tech (Jay)
**Repo path:** `throughline/`
**Last updated:** 2026-05-09

---

## TL;DR

Throughline is a methodology runtime for AI-assisted software development. It loads a methodology bundle that codifies your documentation discipline (file conventions, anchor format, marker taxonomy, build phases, review patterns, validation rules), then applies that methodology to one or more projects you bring. It tracks outstanding work across parallel AI coding sessions, parses your project's docs and code, surfaces drift between intent and implementation, hosts your review patterns as structured workflows, and scaffolds session handovers. The same Throughline supports any project that has a methodology bundle declared for it. SiteMesh's authoring discipline is the first bundle Throughline ships with, alongside a minimum-spec freeform bundle for lightweight projects.

---

## 1. Authority and verification

This spec describes the **target end state** of Throughline v1 at the functional level. It is the source of truth for *what* Throughline does and *why*. It is not the source of truth for *how* — implementation choices (languages, frameworks, libraries, schema, file paths) are owned by `CODE_SPEC.md` and produced by Claude Code from this spec.

The codebase is the source of truth for what's currently built. When this spec and the code disagree on functionality, one must be updated to match the other or the discrepancy must be recorded as a deliberate decision in section 14. Silent drift is the failure.

Verification checklist: `./CHECKLIST.md` — read at session start, update at session end.

---

## 2. What Throughline is

Throughline tracks AI-assisted software development across parallel sessions, parses the project's documentation, hosts the development discipline as enforceable runtime behaviour, and surfaces drift between intent and implementation. It exists because keeping global state across many concurrent AI coding sessions, fragmented `.md` files, and chat scrollback overwhelms working memory — and because the discipline that keeps AI-assisted development honest is currently re-enacted by hand every session.

The product has three layers, in order of foundation:

**The methodology runtime (core).** Throughline loads a methodology bundle describing how a project is documented and built. The bundle codifies file conventions, anchor format, marker taxonomy, build-phase state machine, review patterns, and validation rules. Throughline applies that methodology to projects: parses their docs, enforces structural conformance, runs review checklists as structured workflows, gates build phases, detects drift, scaffolds handovers, and surfaces what's blocking what.

**The tracker (surface over the runtime).** Items, sessions, library, directives, drift detection, audit log. The familiar work-tracking surface — but informed by the methodology beneath. A tracked item knows which primary unit it belongs to, which anchor it cites, what phase it's in, whether its associated PR has cleared the methodology's gates. The tracker isn't free-form; it's methodology-aware.

**The intelligence layer (over both).** AI capabilities that operate against the runtime + tracker substrate: dump zone extraction, reconcile, chat mode, RAG over the project's docs and code, end-of-session retros, dependency-aware sequencing, stakeholder view rendering, drift re-verification. Always reviewable before applying; methodology gates apply.

Throughline is single-user. Multi-project from v1 — each project binds to a methodology bundle, and projects can use the same or different bundles. All state lives locally. v1 ships with two bundles: SiteMesh (the rich-discipline reference) and freeform (a minimum-spec bundle for lightweight projects). New methodology bundles can be authored over time as projects need them.

---

## 3. Architecture

Throughline runs as two pieces on the user's laptop.

**Backend service.** A long-lived local service handling all persistence, methodology bundle loading and enforcement, project doc parsing, file watching, Semble and Semgrep integration, GitHub polling, scheduled work (reminders, periodic reviews), Anthropic API calls, and Claude Code → Throughline push. Auto-runs on login.

**Browser UI.** A web UI served from the backend over a local-only address. The browser does not access the filesystem, OS notifications, or external networks directly; the backend mediates everything.

Throughline opens by starting the backend (one command, scriptable on login) and pointing a browser at its local address. Closing the tab does not kill anything in flight — reminders fire, polling continues, drift checks run, methodology gates enforce.

The split between backend and browser is a functional decision: the UI alone could not do background work, scheduled tasks, filesystem watching, methodology rule enforcement, or AI call mediation. Putting those in the backend lets the user close the browser without losing the things that matter.

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
- No replacement for Git, GitHub, Claude Code, or any IDE. Throughline observes, aggregates, and applies methodology rules.
- No autonomous code execution, external API mutations, or repo file writes without explicit human review. Internal file movements within Throughline-managed directories (Claude Code inbox archiving, failure quarantine, datastore housekeeping) are not user-facing writes and run autonomously.
- No silent state changes. Done items are auto-marked done by AI only with confidence-thresholded auto-apply, audit log entry, and one-click undo. Methodology gates fire as proposals to the user, never as enforced blocks on the underlying repo.
- No standalone code architecture viewer. Throughline visualises work and methodology state; code architecture lives in tools designed for that purpose (Semble for search, Semgrep for rule verification).
- No in-app authoring of methodology bundles in v1. v1 ships with SiteMesh and freeform bundles; any others Jay drafts manually as markdown files. In-app bundle authoring is a v2 concern.
- No whiteboards in v1. Deferred to v1.1 once Throughline is in regular use and the gap is felt empirically.

---

## 6. Glossary

| Term | Definition |
|---|---|
| **Methodology bundle** | A configuration file (or set of files) declaring how a methodology works: file conventions, anchor format, marker rules, state machine, review patterns, validation rules. Bundles are loaded by Throughline at project-binding time. |
| **Project** | A codebase + a methodology bundle binding + Throughline state for tracking work on that codebase. Projects are first-class entities. |
| **Primary unit** | The methodology's main "thing" — module, component, feature, package, etc. SiteMesh bundle's primary unit is the module. Freeform bundle declares no primary unit. |
| **Module** *(SiteMesh-specific term, surfaced via the bundle)* | In SiteMesh, a gateable workflow that emits data and consumes data. Defined by the SiteMesh bundle, not by Throughline core. |
| **Item** | A unit of tracked work or decision. Carries identity, lifecycle status, blockers, tags, parent/children, session memberships, code refs, verifier rules, directives, optional branch and PR references, methodology-context references (which primary unit, which phase, which anchor). |
| **Session** | A saved view that filters items by membership. Roughly one Claude Code session or focused effort. Items can belong to multiple sessions. |
| **Board** | Within a session view, items split into columns by item type as the methodology defines. SiteMesh: todos and decisions. Freeform: a single board of tasks. |
| **Library entry** | Non-item reference content: notes, prompts, snippets, imported docs. Notes can attach to one or more items. |
| **Directive** | An active rule attached to an item or library entry. Three types: pin, reminder, include-in-session-prompt. |
| **Dump zone** | Capture surface where unstructured text or files are pasted, processed by AI, and routed to items or library entries after human review. |
| **Scratchpad** | Friction-free capture surface. Type a thought, comes back later. No review modal, no AI processing. |
| **Reconcile** | The flow that takes new input and produces a structured diff against existing items for review and apply. |
| **Drift (code)** | The state of an item being marked done but showing signals of regression or wrong-classification in code. Four tiers; strong signals badge items, weak signals collect in the drift inbox. |
| **Drift (discipline)** | The state of a project's documentation or state violating the methodology bundle's rules: missing required files, malformed anchors, banned strings, unresolved markers in wrong phase, broken cross-references. Surfaced like code drift. Categories are bundle-defined. |
| **Drift inbox** | Aggregator for weak drift signals. Strong signals badge items directly; weak signals collect here so they don't pollute main views. |
| **Phase** | A state in the methodology's build state machine. Bundle-defined. SiteMesh example: doc-readiness, code-PR. Freeform: a single open phase. Transitions require gate clearance. |
| **Gate** | A check or set of checks that must pass for a phase transition or review step. One phase moment can support multiple gates (each producing its own findings stream). SiteMesh per-commit moment example: `verify-structure.sh` for code architecture rules and `sitemesh-pre-commit` for docs banned-string sweep — two independent gates at the same moment. |
| **View mode** | The top-level UI mode: home, projects, sessions, modules (when bundle declares primary units), tree, graph, library, directives, methodology gates. |

---

## 7. Core functionality

### 7.1 Methodology runtime

Throughline's core is a runtime that loads and applies methodology bundles. A methodology bundle codifies how a project is documented, built, and reviewed.

**Bundle structure** (eleven sections; see SiteMesh bundle as reference implementation):

1. **Identity** — name, version, authority precedence
2. **Project layout** — primary unit definition, tier classification, doc set per unit, fixed-format templates for each doc type, runtime artefact directories
3. **Anchor system** — format, namespace, body structure, status vocabulary, heading tags, state transitions (supersession, amendment, revision, move), banned content in anchor bodies
4. **Marker system** — inline marker formats, categories, gating behaviour
5. **State machine** — phases, transitions, gate declarations. **One or more gates per phase moment**, each with its own check definitions. Gates produce independent findings streams; one gate can pass while another at the same moment fails.
6. **Communication model** — edge types, routing rules, producer ownership
7. **Gating model** — how primary units are tier/feature/permission-gated
8. **Review patterns** — companion checklists with mechanical vs judgement steps, companion modes
9. **Templates** — handover, decision, research artefact, execution plan, fixed doc outlines
10. **Validation rules** — banned-string sweeps, implementation-discipline rules, cross-reference resolution, structural validation
11. **Authority hierarchy** — source ranking, drift policy

**Bundle loading.** A project's methodology binding names a bundle. On project open, Throughline parses the bundle and configures the runtime: structural validators, banned-string greps, marker scanners, state-machine transitions, review-checklist steps, template parsers. The same Throughline UI and data model serve any project; behaviour adapts to the bundle.

**Bundle authoring.** v1 ships with two bundles: SiteMesh (rich-discipline reference) and freeform (minimum-spec, no primary units, no anchors, no markers, single board, single item type called "task"). Additional bundles are authored as markdown files following the eleven-section structure and committed to Throughline's `methodologies/` directory. In-app bundle authoring (a UI for drafting and editing bundles) is deferred to v2.

**Methodology-agnostic core.** Throughline core has no hardcoded knowledge of modules, anchors, markers, or phases. All those concepts come from bundles. A project bound to the freeform bundle (no primary units, no anchors, no markers, no gates) runs as a lightweight task tracker. A project bound to SiteMesh gets the full methodology-runtime experience. Bundles are not optional — every project binds to one (the freeform bundle exists precisely to support the "I just want to track some stuff" case).

### 7.2 Projects as first-class entities

A project is a codebase + a methodology bundle binding + Throughline state. Multiple projects coexist in one Throughline instance.

**Project shape:**

- A name and stable identifier
- Local repo path (where the codebase lives on disk)
- GitHub remote (optional, for the GitHub integration)
- Methodology bundle binding (a reference to a bundle in Throughline's `methodologies/` directory; defaults to `freeform` if user does not select another at project create)
- Settings (which override Throughline defaults: branch, stale threshold, polling cadence, etc.)
- State (parsed doc state, last scan timestamp, gating state, etc.)

**Project lifecycle:**

- **Create** — user supplies repo path and selects methodology bundle (defaults to `freeform`). Throughline scans the repo, parses docs against the bundle, populates initial state.
- **Switch** — user moves between projects via the projects view. Each project's sessions, items, library entries belong to it.
- **Archive** — project is dormant but state preserved. Useful for shipped projects you may revisit.
- **Delete** — project state removed. Codebase untouched.

**Cross-project queries.** Some surfaces (the library, the rollup view) can span projects. Most surfaces are project-scoped by default with explicit cross-project toggles where useful.

### 7.3 Items as first-class data, sessions as views, primary units as methodology-defined groupings

Items live in a single pool per project with stable identifiers. A session is a saved view that filters items by membership. A primary unit (whatever the methodology's bundle calls it — SiteMesh: module) is a methodology-defined grouping of items.

**Sessions and items.** A new item created from a session's dump zone is associated with that session by default. Reconcile against another session can add membership without duplicating. Marking an item done in any session view marks it done everywhere it appears. Identity is global; visibility is filtered.

**Primary units and items.** When the methodology defines primary units, items can be associated with one or more units. The modules view (§7.11) shows items grouped by their primary-unit membership. An item can belong to zero, one, or many primary units. For bundles that declare no primary units (freeform), this association is absent.

**Cross-session routing at capture.** When dump zone extraction proposes an item that obviously belongs to a different session or different primary unit, the review modal lets the user re-route before applying.

**Session deletion.** Deleting a session removes the view definition only. Member items persist, accessible from other views, the home surface, or their primary-unit association.

### 7.4 Item shape

Each item carries:

- A stable identifier
- A type — methodology-defined (SiteMesh: `todo` or `decision`; freeform: `task`)
- A title — short imperative for todos, declarative for decisions (one line)
- A long-form description in markdown
- A status — methodology-defined lifecycle (SiteMesh: todos use `todo`/`in-progress`/`blocked`/`done`; decisions use `open`/`locked`/`superseded`. Freeform: `open`/`done`.)
- A free-text blocker description for external waits
- Structured blocker references — links to other items that block this one
- Tags — drawn from the project's tag vocabulary plus custom user tags
- Parent and children references — supporting infinite nesting
- Session memberships
- Methodology-context references — which primary unit(s) the item belongs to, which phase the item is in, which methodology-anchored decisions it cites, which marker types apply to it
- Branch reference (optional) — git branch the item relates to (free-text)
- PR associations (optional) — pull requests the item is tied to, used for tier-2 drift detection
- Attached notes — library notes attached via many-to-many
- Code references — code locations identified by Semble for this item
- Verifier rule references — methodology-defined verification rules (SiteMesh: Semgrep rules) that verify this item if marked done
- Directives — active behavioural rules
- Audit history reference
- Created-at and updated-at timestamps

### 7.5 Boards

Within a session view, items split into columns determined by the methodology. SiteMesh's bundle declares two boards: todos and decisions. Freeform declares one board ("tasks"). A different methodology might declare three or more.

The split exists because item types with different shapes and lifecycles mixed together obscure both. Methodologies that distinguish item types get separate boards; methodologies that don't, don't.

### 7.6 Capture surfaces

Seven ways data enters Throughline:

- **Scratchpad** — friction-free text input always visible in the header. Type a thought, save, come back. No review modal, no AI, no routing. Lowest-friction inbox.
- **Manual entry** — direct creation of items in any session view. Inline, fast, keyboard-driven.
- **Session dump zone** — paste unstructured text or drop text-readable files. AI extracts items, classifies according to the methodology's item types, suggests tags, asks clarifying questions, suggests target session and primary unit. Always opens a review modal before items land.
- **Library dump zone** — same paradigm for reference material.
- **Voice input** — browser-native speech recognition. Hold-to-talk. Desktop-only in v1 (browser tab must be open at the laptop where the backend runs). Mobile gated by the parked LAN-mobile-UI item (§12).
  - **Destination selection.** Before transcription begins, the user picks the destination (session dump zone or library dump zone) via a toggle in the voice capture overlay.
- **Claude Code push** — Claude Code drops a file at a configurable inbox directory on the user's laptop. The backend watches the directory, picks up new files, runs them through the dump zone flow.
  - **Backend down behaviour.** Files queue in the inbox directory until the backend reads them on next start.
  - **Post-processing.** On success, files move to a dated archive subdirectory (default 30-day retention). On failure, files move to a failures subdirectory with sibling error metadata.
- **Code TODO/FIXME import** — backend scans the repo for configurable patterns on manual user invocation in v1 (auto-scan deferred). Surfaces matches as candidate items with file:line references.

All capture surfaces except scratchpad use the standard review-before-apply flow.

### 7.7 Reconciliation

When new input updates an existing list (Claude Code transcript, PR description, session note), reconcile produces a structured diff with six categories:

- **Completed** — input indicates the item is done
- **New** — input introduces an item that doesn't already exist
- **Edited** — input refines title or description without changing identity
- **Blocker changes** — input adds, removes, or updates a blocker
- **Contradicted** — input claims an existing done item is broken, regressed, or incorrect. Contradicted items spawn a drift signal rather than auto-reverting state — drift discipline applies; reconcile does not silently re-open items based on input alone.
- **No-change** — input mentions the item but doesn't update it

User reviews the whole diff and applies it. The one exception is GitHub-triggered reconcile on PR merge with high confidence (see 7.13).

### 7.8 Library

Four content types, all first-class:

- **Notes** — long-form markdown. Tagged. Optionally attached to one or more items. Replaces per-item journal fields — one place for journaled thinking.
- **Prompts** — saved prompt templates with optional `{{variable}}` placeholders. One-click "use" opens a fill-in modal and copies the resulting prompt to clipboard.
- **Snippets** — short reference text or code blocks. Quick-copy button always visible.
- **Imported docs** — `.md` files dragged in or repo-ingested. AI generates summary and tag suggestions on import.

All library entries support full-text search, AI semantic search (routed to Semble for code-related queries, local embeddings for text-content queries), tag filtering, and pinning to sidebar top.

Whiteboards as a fifth library content type are deferred to v1.1 (see §12).

### 7.9 Repo `.md` ingestion

Folder-opt-in. User points the backend at a directory; the backend scans for `.md` files and offers to ingest them as library imported-doc entries. AI generates summary and tag suggestions during import. Per-folder opt-in keeps `node_modules` and similar noise out.

Default re-ingest behaviour is snapshot at import time. Per-entry "track source" toggle is available for entries the user wants kept in sync with the source file on disk; tracked entries re-ingest on file change.

### 7.10 Directives layer

Items and library entries can carry directives. Three types in v1:

- **Pin** — sticky in its parent view.
- **Reminder** — relative ("in 3 days") or absolute ("Friday 14:00"); supports recurrence rules. Fires via OS notification when due, regardless of whether the browser tab is open.
- **Include in session-start prompt** — Throughline maintains a generated session-start prompt that auto-prepends every flagged item. One-click copy when starting a Claude Code session.

Items with active directives display a badge icon. A dedicated **Directives view mode** lists every active directive across the app, grouped by type:

- **Pinned** — unordered
- **Reminders** — sorted by next firing
- **Include-in-prompt** — unordered

Each group is collapsible.

### 7.11 View modes

A view mode toggle in the header switches between renderings of the same data:

- **Home** (default) — across-everything surface scoped to the current project. Top of view: items in progress this week (rolling 7 days from now), items recently flagged with drift signals (code or discipline), items mentioned in the last Claude Code push, items unblocked since last visit (last-render timestamp persisted), methodology phase indicators per the bundle's state machine. Below: drift inbox count, scratchpad jot count, recent activity feed.
- **Projects** — list of all projects, switching surface, project state at a glance.
- **Sessions** — sidebar of session views for the current project; main area shows the selected session's boards.
- **Modules** — primary-unit-grouped view. Hidden for projects bound to bundles that declare no primary unit (freeform). For bundles that do declare a primary unit, this view shows primary units with their tier classification, current phase, gating state, anchor count, marker count, and build state per the bundle's primary-unit rules.
- **Tree** — file-explorer-style hierarchy with grouping selector (by tag, session, primary unit, status, blocker). Drag-drop between folders re-tags items.
- **Graph** — interactive node-edge graph rendering. Nodes are items; edges show parent-child, blocked-by, and cross-session mentions. "Show chains" mode highlights blocker dependency paths and root blockers. For methodologies with a communication model declared, an additional graph layer shows primary-unit-level emit/consume edges based on the methodology's contract source.
- **Library** — sidebar of library entries with category filters and search; main area shows selected entry with editor (notes, prompts, snippets) or reader (imported docs).
- **Directives** — directives across the app, grouped by type per 7.10.
- **Methodology gates** — what's currently blocking what across the current project. Primary units in phases awaiting gate clearance. Primary units with broken anchor references. Primary units failing structural conformance. Aggregates across all bundle-defined gates. Hidden for freeform-bound projects (which have no gates).

### 7.12 Discipline gates as runtime behaviour

The methodology bundle's gate definitions (per its state machine and validation rules) execute as Throughline runtime behaviour, not as discipline you enforce manually. Each phase moment supports one or more gates; the bundle declares which gates fire at each moment and what each gate checks. Gates produce independent findings streams; one gate can pass while another at the same moment fails.

**Pre-write gates** — when a session is about to write to project docs, Throughline runs the bundle's pre-write checks. (SiteMesh example: cited anchors must resolve; sub-agent line numbers verified; confident-sounding patterns flagged for ground-truth check.)

**Per-commit gates** — when an item transitions state or a commit is being prepared, Throughline runs the bundle's per-commit checks. SiteMesh's per-commit moment declares two gates: `verify-structure.sh` (9 code architecture rules) and `sitemesh-pre-commit` (docs banned-string sweep). Two independent gates at the same moment.

**Plan-mode gates** — when Claude Code is operating in plan mode, Throughline can validate the proposed plan against the bundle's plan-mode rules.

**Post-commit gates** — after a commit lands, Throughline re-scans and confirms the bundle's post-commit conditions. (SiteMesh example: no banned strings introduced; all citations still resolve; no markers regressed into wrong phases.)

Gate failures surface as proposals: "this commit would introduce two banned strings; review here." Throughline never silently blocks. The user can override (with audit log entry) or fix and retry.

### 7.13 GitHub integration

Backend job, polling-based.

- **Configuration** — Personal Access Token in backend config, per-project `owner/repo`, optional per-session `branch` field.
- **Polling cadence** — 60 seconds when a session is "active" (pinned or dumped to within last 2 hours), 5 minutes otherwise. Authenticated rate limit (5000/hr) is comfortable margin.
- **Events tracked** — PR opened, approving review submitted, PR merged, PR reverted.
- **Surface** — per-session badges (🟡 needs review / 🟢 approved / ✓ merged), activity timestamp, PR link.
- **Auto-reconcile on merge** — when a tracked branch merges, the backend opens the reconcile flow with PR description + squashed commit message + diff stats as input. Behaviour by AI confidence:
  - **High** — auto-apply with toast and 24-hour undo. Audit log captures PR number, AI reasoning, confidence score, and full PR description used.
  - **Medium** — notification badge, one-click approve.
  - **Low** — opens reconcile modal as normal for human review.
- **Methodology gate enforcement on PR open** — when a PR opens, Throughline runs the methodology's PR-open gates as declared in the bundle (SiteMesh example: live `[UNRESOLVED-(b/c)]` markers in affected SPEC.md files fail the gate). Failures surface as a notification with link to the failing rules. Throughline does not block the PR — the human reviewer decides whether the gate failure is acceptable for this PR.

### 7.14 Drift detection — code and discipline

Two streams of drift detection running in parallel.

**Code drift (four tiers):**

- **Tier 1** — Semgrep failure on a verifier rule attached to a done item. Item badged red.
- **Tier 2** — GitHub revert event on a PR a done item is associated with. Item badged orange.
- **Tier 3** — new PR touches files in a done item's code references. Item badged yellow.
- **Tier 4** — duplicate-looking dump zone entry matching a done item (cosine similarity ≥ 0.80, with AI confirmation pass for borderline 0.70–0.80). Goes to drift inbox; auto-dismissed with audit-logged "stale-no-action" reason after 7 days.

**Discipline drift (bundle-defined).** Categories are declared by the methodology bundle, not hardcoded in the runtime. The runtime hosts whatever drift categories the bundle declares. SiteMesh examples:

- Structural conformance failures (missing required files, wrong section ordering, malformed anchor bodies)
- Banned-string violations (per the bundle's banned-string sweep)
- Marker violations (markers in inappropriate phases per the bundle's marker rules; SiteMesh example: live `[UNRESOLVED-(b/c)]` markers past doc-readiness)
- Cross-reference failures (anchor cited that doesn't exist, anchor cited that's superseded without acknowledgment, doc pointer pointing to a non-existent heading)
- Phase transition violations (a primary unit attempted to enter a later phase with unresolved blocking markers)

Discipline drift surfaces in the methodology-gates view and as badges on affected primary units in the primary-units view. Items associated with primary units in discipline drift inherit a methodology-drift indicator.

**Manual item-to-PR linking** for tier-2 detection: auto-detect from the active git branch on the session, with user override available and skip acceptable. Items without PR association lose tier-2 only.

**Drift re-verify**: every done item has a manual re-verify button; AI returns *still looks done / unclear / appears regressed*.

### 7.15 Code intelligence (Semble)

Semble runs locally as a service started by the backend on launch. Indexes the user's repo (project's local path), watches for changes, re-indexes incrementally.

Three uses inside Throughline:

- **Auto-link items to code at done-time.** When marking an item done, Semble searches the repo for code matching the item title and description. Top results presented for user confirmation; confirmed locations stored as code references and used for tier-3 drift detection.
- **Plain-English code Q&A.** From scratchpad or library, the user types "where is upload validation handled?" Throughline asks Semble for relevant chunks, asks Anthropic to summarise them in plain English. Returns a readable answer plus links to source.
- **Item creation enrichment.** Dump zone extraction runs item titles through Semble in the background. Suggested code references appear in the review modal so items land already linked to relevant code areas.

Semble also runs as an MCP server for Claude Code (separate setup; recommended regardless).

### 7.16 Static rule verification (Semgrep)

Semgrep runs in GitHub Actions on every PR. Findings post to the PR via Semgrep's GitHub integration. The backend reads findings via the GitHub API and overlays them on items via verifier rule references.

**Rule convention** — methodology-defined. The SiteMesh bundle declares: rules live in a dedicated subdirectory of the repo's Semgrep config area, one rule file per item, named by the item's stable identifier. Other methodologies may define different conventions.

**Workflow setup** — Throughline does not create or manage the GitHub Actions workflow. Users add a one-time workflow file pointing Semgrep at the rules path; recommended template ships with Throughline. The backend warns at first GitHub-integration use if the expected workflow is not present.

**Drafting** — when marking an item done, the user is offered the option to write a Semgrep rule that locks in the work. AI helps draft the rule from the item description. The user reviews and commits the rule file to the repo.

**Deletion behaviour** — when an item with verifier rules is deleted, the rule files in the repo are not auto-removed. Throughline orphan-flags the rule, surfaces it in periodic review and a settings panel, and offers a one-click action that drafts a PR removing the rule file. The user reviews and merges; the rule is gone from both repo and Throughline's tracking on next poll. Dismiss-without-removal is also supported and audit-logged.

### 7.17 Item detail panel

Right-side slide-in panel opening when an item is clicked from any view. Contains:

- Title, description, status, tags, blockers (free-text and structured ref picker). **Stale yellow flag appears in the panel header when the item has not been updated in the configured threshold.**
- Methodology context — which primary unit(s), which phase, which anchors cited, which markers active
- Branch reference and PR associations (with override actions)
- Attached notes (from library; click to open in editor)
- Code references (with Semble-linked summaries)
- Verifier rules (current pass/fail state from latest GitHub Actions run)
- Directives
- Activity log (full audit history, including methodology-gate firings)
- Linked items (children, parents, items mentioning this one, items mentioned by this one)
- Git context (PR, commit, branch references)

Closes with Esc or click-out. Arrow keys move through items in the parent list with the panel staying open and updating.

**Stale flag placement.** The yellow flag also appears next to item titles in all list views (session boards, tree view, search results) so stale items surface incidentally during normal scanning.

### 7.18 Intelligence layer

- **End-of-session retro.** When a session is marked as wrapping (user-initiated in v1; inactivity-inferred deferred), AI generates a one-page summary using the session's items, audit log entries from the session window, Claude Code transcripts pushed during the session, and methodology-context updates (markers cleared, phases transitioned, gates fired). Saved to library as a note. Optionally attached to items the retro discusses. Optionally appended to a `session-start.md` for the next session.
- **Periodic review.** Configurable interval (default 2 weeks). Surfaces hygiene questions from both code-drift and discipline-drift streams: items in tier-3 drift state without action, decisions older than 60 days, sessions untouched 30+ days, blockers held longest, orphaned verifier rules awaiting cleanup, primary units in their first non-finalised phase past the configured threshold (SiteMesh example: modules in doc-readiness past threshold), markers live in inappropriate phases per the bundle's rules.
- **Dependency-aware sequencing.** Topological sort across open items, weighted by blocker chain depth and number of downstream-unblocked items. "Do next" view surfaces "if you unblock these 3, 17 items become unblocked." Methodology-aware: items in primary units failing methodology gates are deprioritised pending gate clearance.
- **Personal RAG (three substrates).** AI-assisted search across personal data with three substrates and a router:
  - **Code substrate** (Semble) — for queries about code locations, implementations
  - **Text substrate** — local embedding-based search over library content, item descriptions, project docs
  - **Audit substrate** — structured queries over the audit log for time/actor/state-transition questions
  Router uses keyword heuristics with user-overridable substrate selection. AI classification of query intent is deferred.
- **Stakeholder view toggle.** Re-renders item content in plain language, AI-generated. Cached; invalidates on item edit.
- **Companion runtime.** The methodology's review checklist runs inside Throughline as a structured workflow. The bundle declares which checklist steps are mechanical (Throughline executes) and which are judgement (Throughline surfaces for human or AI reviewer). For SiteMesh: anchor citation validation and marker presence are mechanical; scope, regression, and summary assessments are judgement steps that open a panel for the call. Output lands in the audit log.
- **Session-start scaffolding.** When opening a slice or session, Throughline assembles the right context (project spec + relevant decisions + active anchors + open markers + execution-plan slice + cross-primary-unit dependencies) and produces a prompt for that session, in the methodology's appropriate companion mode.

All AI features use the Anthropic API key from backend config. Model selection is per-feature: Haiku for cheap classification, Sonnet for default, Opus for harder reasoning.

### 7.19 Chat mode

- **Dump zone chat mode** — toggle within the dump zone. Paste content, AI responds, user refines, AI adjusts. When ready, "apply" sends the result through the standard review modal.
- **Per-list chat panel** — chat scoped to the selected session view. AI reads the session's items as context plus methodology context for the current project. User asks "what's blocking the most stuff," "summarise where this list stands," "what should I do next given my current phase." Proposed changes route through review.

Chat history is persisted per context, retrievable later.

### 7.20 Multi-list and AI consolidation export

- **Combine sessions into markdown** — multi-select sessions, pick combine mode (one big `.md` with each session as a section, or zip of separate `.md` files), apply optional filters (only open items, only tagged X, only blocked), download.
- **AI consolidation** — drag in files plus paste text plus optionally pick existing sessions or library entries, AI synthesises a polished single `.md` document. Generated document opens in editor for final adjustments before download.

Per-session markdown export available as a fast path: copy a session as markdown to clipboard, formatted for paste-back into Claude Code.

### 7.21 Mermaid generation

Mermaid is an export format. Generate from any scope: a single session, items tagged X, a blocker chain, the project's primary-unit topology, a methodology gate state. AI-generated mermaid from pasted content when the user wants to diagram something Throughline doesn't natively know about. Export as `.mmd` text or rendered SVG.

### 7.22 Audit log (queryable)

Every state change to every item, library entry, project, methodology bundle binding, and gate firing generates an audit log entry: timestamp, actor (user manual edit, AI extraction, AI reconcile, GitHub auto-apply, methodology gate), field changed, old value, new value, trigger context (PR number for GitHub triggers, model and prompt fingerprint for AI triggers, gate identifier for methodology triggers).

The audit log is queryable; queries power the periodic review, retro generation, drift detection tier 1, the personal RAG audit-history substrate, and methodology-state reconstruction. Visible in the item detail panel's history tab; searchable by time range, actor, or trigger type.

### 7.23 Backup

Backup is a single-file copy of the underlying datastore. Manual export downloads a timestamped copy. Restore is putting the file back. No serialisation transformation, no separate backup format.

Optional auto-copy: configure the backend to copy the datastore to an external location (Dropbox, Drive, USB) on a schedule.

Header indicator turns red when no backup has been made in the configurable threshold (default 7 days).

### 7.24 Command palette and keyboard navigation

`Cmd+K` (or `Ctrl+K`) opens fuzzy-search command palette. Jump to any project, session, item, library entry, directive, primary unit, methodology gate. Run any action: new item, reconcile, export, switch view mode, switch project, open settings.

Keyboard navigation throughout: tab/shift-tab for indent/outdent in lists, arrow keys for item navigation, Enter to edit, Esc to close panels, `?` for keyboard reference.

### 7.25 Settings and cost meter

- **Anthropic API key** (backend config, not browser-accessible)
- **GitHub PAT** (backend config)
- **Per-project local repo path**
- **Per-project methodology bundle binding** (defaults to `freeform` at project create)
- **Default model** selector (Haiku / Sonnet / Opus); per-feature override available
- **Stale threshold** for items not updated in N days → yellow flag (appears in list views and detail panel header per 7.17)
- **Backup nudge interval** and optional auto-copy target path
- **Periodic review interval**
- **Per-project GitHub default `owner/repo`** and per-session branch fields
- **Claude Code inbox directory** path and processed-archive retention
- **OS notification permission** (one-time grant, mediated by backend)
- **Cost meter** — running token spend and dollar estimate for the current day, week, and month, broken down by feature category. Visible in header at all times. Warns when daily threshold (configurable) is exceeded.
- **Orphaned verifier rules panel** — methodology-defined (SiteMesh: Semgrep rule files); one-click PR-draft cleanup or dismiss-without-removal

---

## 8. Data categories and relationships

Throughline persists state across these functional categories:

- **Projects** — codebase + methodology binding + state
- **Methodology bundles** — loaded bundle definitions referenced by projects
- **Items** — per-project, primary entity
- **Sessions** — per-project saved view definitions
- **Library entries** — per-project notes, prompts, snippets, imported docs
- **Directives** — active rules attached to items or library entries
- **Audit history** — append-only record of every state change across items, library entries, projects, methodology bindings, and gate firings
- **Chat history** — per-context conversation records
- **Drift signals** — both code-drift and discipline-drift, queued for the drift inbox with auto-dismissal tracking
- **Orphaned verifier rules** — methodology-specific cleanup queue
- **Local embeddings** — vector representations supporting the text RAG substrate
- **Claude Code inbox queue** — records of files received via the watched directory and their processing state
- **Cost telemetry** — per-AI-call spend records
- **GitHub state cache** — polling state, last-known PR states, ETag values
- **Settings** — user configuration (excluding API keys)

**Relationships:**

- Items have many-to-many relationships with sessions (membership), primary units (methodology-defined groupings), library notes (attachment), code locations (Semble-confirmed), PR associations
- Items have one-to-many relationships with verifier rules and audit history entries
- Library entries, projects, and methodology bindings also accumulate audit history
- Directives have a one-to-many relationship from their parent (an item or library entry)
- Projects bind to one methodology bundle
- A methodology bundle is shared by zero, one, or many projects

Conventions: stable identifiers per record, generated locally; created-at and updated-at timestamps; API keys live separately from primary state and never appear in backups.

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
| Personal RAG (text) | User submits question | Sonnet | None |
| Plain-English code Q&A | User submits question (Semble-routed) | Sonnet | None |
| Semantic dedup similarity | New item proposed | Haiku | None |
| Drift re-verify | User clicks re-verify | Sonnet | None |
| AI tag suggestion | User adds untagged item | Haiku | None |
| Stakeholder view rendering | User toggles | Sonnet (cached) | None |
| Mermaid generation | User triggers export | Sonnet | None |
| Verifier rule drafting | User locks in done item | Sonnet | None |
| Companion review (judgement steps) | Methodology checklist runs | Sonnet | None |
| Session-start prompt assembly | User opens slice/session | Haiku | None (output is a prompt to copy) |

Cost is the user's responsibility; settings expose model selection per feature category. Cost meter tracks spend in real time.

---

## 10. Integration points

| Integration | Direction | Mechanism |
|---|---|---|
| Anthropic API | OUT | Backend HTTPS, key from backend config |
| GitHub REST API | OUT | Backend polling |
| Semble | LOCAL | Backend-managed local service |
| Semgrep | OUT (CI) | GitHub Actions; results read via GitHub API |
| Local filesystem | IN/OUT | Backend native FS access |
| OS notifications | OUT | Backend → cross-platform OS notification capability |
| Browser speech recognition | IN | Browser-native (voice capture) |
| Clipboard | OUT | Browser-native |

No webhook receivers in v1. No outbound emails or messaging.

**Backend mediates all external network calls.** The browser does not call Anthropic, GitHub, or any external service directly. All outbound HTTPS originates from the backend, isolating API keys to the backend process and giving the backend a single audit point for external traffic.

---

## 11. Definition of done — v1

Throughline v1 ships when all of the following are true:

- Methodology runtime: bundles load from `methodologies/` directory; bundle structure parsed against the eleven-section spec; runtime configures structural validators, banned-string greps, marker scanners, state-machine transitions (one or more gates per phase moment), review-checklist steps, and template parsers from bundle content
- SiteMesh and freeform bundles both ship with Throughline as concrete methodologies
- Multi-project: projects are first-class; create / switch / archive / delete all functional; multiple projects coexist; each project has its own state; default bundle at create is freeform
- All items live in one local datastore per project with stable identifiers; sessions are saved views with member-by-membership semantics
- Items support infinite nesting, methodology-defined type lifecycles, free-text and structured blockers, full tag taxonomy, methodology-context references, branch + PR references, code refs, verifier rules, audit log
- Nine view modes (home, projects, sessions, modules, tree, graph, library, directives, methodology gates) functional and switchable; modules and methodology-gates views hide for projects bound to bundles that declare no primary units or no gates respectively
- Scratchpad, dump zone (session and library), voice input, Claude Code push, code TODO import (manual invocation), manual entry all functional with consistent review-before-apply where applicable
- Reconcile produces structured diffs with all six categories and applies cleanly
- Three directive types (pin, reminder, include-in-prompt) functional, with OS notification integration for reminders. Directives view groups by type.
- Four library content types (notes, prompts, snippets, imported docs) all first-class
- GitHub integration polls at documented cadence, surfaces PR state, triggers reconcile on merge with confidence-thresholded behaviour. Manual item-to-PR linking functional.
- Methodology gates fire on PR open, transition events, and commit-prep moments. Failures surface as proposals; never silently block.
- Drift detection: both code-drift (four tiers; tier-4 similarity threshold cosine ≥ 0.80 with AI confirmation pass for borderline 0.70–0.80) and discipline-drift (bundle-defined categories) streams active and surfacing
- Stale yellow flag appears in all list views and detail panel header
- Semble local integration: indexing, code Q&A, item enrichment all functional
- Personal RAG: text substrate, code substrate (via Semble), audit history substrate, router (keyword heuristics with user override) functional
- End-of-session retro, periodic review, dependency sequencing, stakeholder toggle, command palette, companion runtime, session-start scaffolding functional
- Cost meter visible in header at all times
- GitHub auto-apply confidence scores logged in the audit log from day 1 to support threshold tuning per section 13
- Local persistence with single-file backup and optional auto-copy target
- Settings panel covers per-project + global settings, API keys, models, repo path, all path conventions, thresholds, notification permission, cost thresholds, orphaned-rules panel
- Backend installs and runs via documented single-command setup. Frontend ships served from the backend.

---

## 12. Out of scope, parked, future

**Out of scope (deliberately not built in v1 or v1.1):**

Multi-user collaboration. User accounts, auth, login flows. Multi-device sync. Email or Slack inbound integration. Calendar integration. Themes, custom colour schemes. Mobile-native app. Browser extension. Localisation beyond English. Encryption beyond what the OS provides for the local datastore.

**Parked (deferred, may revisit):**

Whiteboards as a fifth library content type (canvas-based ideation surface with AI extraction). Deferred to v1.1 once Throughline is in regular use and the gap is felt empirically. In-app methodology bundle authoring (a UI for drafting and editing bundles). Mobile UI accessing the local backend over LAN. Cross-machine sync via cloud storage. Webhook receivers. Real-time collaborative cursors. AI-collaborative whiteboard (AI proposes additions to the board, real-time collaboration, auto-organisation). Auto-deletion of verifier rule files via PR-as-code (replacing the current one-click PR-draft flow). Bundle inheritance (a bundle extends another and overrides sections). Bundle versioning mechanism.

**Future (not committed):**

Bundle ecosystem (multiple methodology bundles authored by Jay or others, available as a library). Embedding components inside SiteMesh or other tools as customer-facing features. Any path requires extracting pure components and is its own project.

---

## 13. Open questions

- **Reminder semantics** — relative + absolute both, with recurrence rule support. Confirm.
- **Recurring reminders** — auto-clear on action or persist until directive removed. Recommended: persist; user explicitly stops the recurrence.
- **Confidence threshold values** for GitHub auto-apply: needs calibration during build. Plan: instrument confidence scores into the audit log from day 1; revisit thresholds after first 10 PR-merge auto-reconcile runs and again after 50.
- **Stakeholder view caching** — invalidate on item edit. Confirm acceptable staleness.
- **Voice input language** — English only or browser-locale auto.
- **Code TODO/FIXME patterns** — configurable patterns with sensible defaults (`TODO:`, `FIXME:`, `XXX:`).
- **Library prompt variable syntax** — `{{var_name}}` (Mustache-conventional).
- **Cost meter daily threshold default** — pending real usage data.
- **Bundle versioning** — v1 ships with no bundle-versioning mechanism. Bundles are always-current; changes apply immediately to all bound projects. Acceptable in v1 because Jay is the only user and controls all bundle changes. Bundle change events are audit-logged (per T-D36) so unexpected retroactive effect can be traced if encountered. Revisit when (a) a bundle change has unintended retroactive effect, or (b) Throughline gains a second user authoring their own bundles.
- **Bundle authoring path for the SiteMesh bundle** — three discipline-doc gaps in flight (PR drafting): `[UNRESOLVED-(a/b/c)]` marker rules in AUTHORING_DISCIPLINE.md §3.F, verify-structure / sitemesh-pre-commit gate split in §9, SESSION_START.md §4 amendment. CODE_SPEC.md outline (lower priority) deferred. None block v1 Throughline build; they affect the SiteMesh bundle's completeness.

---

## 14. Throughline-specific decisions

Anchor format: `T-D{n}`. Full text in `docs/throughline/DECISIONS.md`.

| Anchor | Subject | Section |
|---|---|---|
| T-D1 | Items as first-class data with stable identifiers; sessions are saved views, not containers | 7.3, 8 |
| T-D2 | Local backend service + browser UI on user's laptop; backend handles persistence, scheduling, file watching, methodology runtime, external network calls; UI is a presentation layer over the backend | 3 |
| T-D3 | Single-file local datastore with single-file backup; no JSON serialisation layer | 7.23, 8 |
| T-D4 | API keys live in backend configuration, separate from primary state; never accessible to the browser; never included in backups | 8, 7.25 |
| T-D5 | AI-proposed writes go through review modal; only confidence-thresholded GitHub auto-apply bypasses (with audit + 24h undo) | 7.7, 7.13 |
| T-D6 | Auto-apply on PR merge requires high-confidence assessment + audit entry + 24-hour undo | 7.13 |
| T-D7 | Polling-only for GitHub (single-user, local backend doesn't need webhooks) | 7.13 |
| T-D8 | Free-text blockers and structured blocker references coexist on items | 7.4 |
| T-D9 | Notes consolidated into library; library notes attach to items via many-to-many. No per-item journal field. | 7.4, 7.8 |
| T-D10 | Library has four content types: notes, prompts, snippets, imported docs. Whiteboards deferred to v1.1. | 7.8, 12 |
| T-D11 | Folder-opt-in for repo `.md` ingestion; snapshot by default with per-entry track-source toggle for re-ingest on change | 7.9 |
| T-D12 | Three directive types in v1: pin, reminder, include-in-prompt. Others deferred. | 7.10 |
| T-D13 | Code architecture visualisation dropped from Throughline; delegated to Semble (search) and Semgrep (rule verification) | 7.11, 7.15, 7.16 |
| T-D14 | Mermaid is an export format only; primary visual interaction is the in-app interactive graph view | 7.21 |
| T-D15 | Single spec covers all of v1; no spec split per feature area | (this spec) |
| T-D16 | Claude Code push via watched filesystem inbox at a configurable directory; processed files archive to dated subdirectory, failed files archive with sibling error metadata | 7.6 |
| T-D17 | Stakeholder view toggle exists from v1 | 7.18 |
| T-D18 | Confidence-thresholded auto-apply: high → auto with toast + 24h undo, medium → notification + one-click, low → reconcile modal | 7.13 |
| T-D19 | Local backend rather than browser-only — file watching, background work, scheduled tasks, methodology runtime live in the backend; browser handles UI only | 3 |
| T-D20 | All capture surfaces except scratchpad use review-before-apply; scratchpad is friction-free with no AI processing | 7.6 |
| T-D21 | Drift detection runs in two streams (code-drift four tiers; discipline-drift bundle-defined categories); strong signals badge items, weak signals collect in drift inbox; tier-4 code-drift weak signals use cosine ≥ 0.80 (with AI confirmation pass for 0.70–0.80) and auto-dismiss with audit-logged reason after 7 days | 7.14 |
| T-D22 | Periodic review runs on configurable interval, surfaces as user-initiated questions, not background AI activity | 7.18 |
| T-D23 | Chat history persisted per context for retrieval | 7.19 |
| T-D24 | Audit log entries never expose API keys or full prompt content beyond what's needed for trigger reconstruction | 7.22, 8 |
| T-D25 | Personal RAG has three substrates (text via local embeddings, code via Semble, audit history via structured queries); router uses keyword heuristics with user override; AI classification of query intent deferred | 7.18 |
| T-D26 | Semgrep runs in GitHub Actions, not in the backend; backend reads findings via GitHub API. Methodology bundle defines rule conventions; SiteMesh bundle declares one-file-per-item named by item identifier. | 7.16 |
| T-D27 | Semble runs as a backend-managed local service; indexes user's repo, watches for changes, re-indexes incrementally | 7.15 |
| T-D28 | Backup is a single-file copy of the underlying datastore; optional configurable auto-copy target | 7.23 |
| T-D29 | Cost meter visible in header at all times; tracks per-feature spend with configurable warning threshold | 7.25 |
| T-D30 | Home view (not a session, not a project) is the default landing surface, scoped to current project; "this week" semantics rolling 7 days from now, "since last visit" uses persisted last-render timestamp | 7.11 |
| T-D31 | Backend mediates all external network calls (Anthropic, GitHub). Browser does not access external networks; all outbound HTTPS originates from the backend. Isolates API keys to the backend process and gives a single audit point for external traffic. | 3, 8, 10 |
| T-D32 | OS notifications are abstracted across platforms via a single capability layer in the backend, not duplicated per platform | 10 |
| T-D33 | Verifier rule lifecycle on item deletion: orphan-flag, not auto-removal. Methodology bundle defines verifier-rule type and storage; SiteMesh bundle declares Semgrep rules in repo Semgrep config area. Rule files stay until user merges a cleanup PR; orphans surface in periodic review and settings; one-click cleanup-PR-draft action available; dismiss-without-removal also supported. | 7.16 |
| T-D34 | Manual item-to-PR linking via auto-detect from active git branch + user override + skip-acceptable. Items without PR association lose tier-2 drift coverage but retain tiers 1, 3, 4. | 7.14 |
| T-D35 | Reconcile diff has six categories: completed, new, edited (covers title and description changes under one row), blocker changes, contradicted (spawns drift signal rather than auto-revert), no-change | 7.7 |
| T-D36 | Audit log scope covers items, library entries, projects, methodology bindings, and gate firings | 7.22, 8 |
| T-D37 | Internal file movements within Throughline-managed directories (inbox archiving, failure quarantine) are not user-facing writes and run autonomously; carve-out from the no-autonomous-writes principle | 5, 7.6 |
| T-D38 | Items carry optional branch and PR references, populated automatically from session context or set manually; branches remain free-text strings, not first-class entities; items reference PRs (not branches as first-class fields) | 7.4, 8 |
| T-D39 | Methodology runtime as the product core. Throughline is methodology-agnostic; bundles configure all methodology-specific concepts (primary unit, anchor format, marker rules, state machine, review patterns, validation). Tracker, library, and intelligence layer are surfaces over the runtime. | 2, 7.1 |
| T-D40 | Projects as first-class entities, multiple projects coexist, each binds to a methodology bundle. v1 multi-project from day one. | 7.2, 8 |
| T-D41 | SiteMesh and freeform bundles ship with Throughline as the first two concrete methodologies. Additional bundles authored as markdown in `methodologies/` directory; in-app bundle authoring deferred to v2. | 7.1, 12 |
| T-D42 | Eleven-section bundle structure: identity, project layout, anchor system, marker system, state machine, communication model, gating model, review patterns, templates, validation rules, authority hierarchy. Bundle structure is the contract; bundle content is methodology-specific. State-machine section declares one or more gates per phase moment, each with its own check definitions. | 7.1, 7.12 |
| T-D43 | Whiteboards deferred to v1.1. Library has four content types in v1. Whiteboards reconsidered once Throughline is in regular use and the gap is felt empirically. | 7.8, 12 |
| T-D44 | Methodology gates fire as proposals to the user, never as enforced blocks on the underlying repo. The user can override (with audit log entry) or fix and retry. | 5, 7.12 |
| T-D45 | Companion review checklist runs inside Throughline as a structured workflow. Methodology bundle defines which steps are mechanical (Throughline runs) vs judgement (Throughline surfaces for human or AI reviewer). | 7.18 |
| T-D46 | Stale threshold yellow flag appears next to item titles in all list views (session boards, tree view, search results) and in the item detail panel header | 7.17, 7.25 |
| T-D47 | Throughline ships with SiteMesh and freeform bundles in v1. Every project binds to one bundle; `none` is not a valid binding. The freeform bundle (no markers, no anchors, no gates, single board with single item type called "task") supports the "I just want to track some stuff" case without code-level special-casing. | 7.1, 7.2 |
| T-D48 | Spec language is methodology-agnostic throughout. Runtime concepts are described first; SiteMesh-specific terms appear only as parenthetical examples. Bundle authors reading the spec see what the runtime expects, not just what SiteMesh happens to do. | 7.14, 7.18, 7.13 |

---

## 15. Dependencies

External services and capabilities Throughline depends on. Specific tool and library choices belong in `CODE_SPEC.md`.

| Dependency | Purpose | Required for |
|---|---|---|
| Anthropic API account | All AI features | Extraction, reconcile, chat, RAG, retro, drift re-verify, mermaid, stakeholder, verifier rule drafting, companion review, session-start scaffolding |
| GitHub account with PAT | Repo and PR awareness | GitHub integration, auto-reconcile, drift signals (code-drift tiers 1, 2, 3) |
| Semgrep + GitHub Actions configured on the user's repos | Static rule verification | Code-drift tier 1 (for projects whose bundle declares Semgrep-based verifier rules) |
| Semble | Local code search | Code Q&A, item enrichment, code-drift tier 3 |
| Local environment capable of running a long-lived backend service alongside a modern browser | Backend + UI runtime | Everything |
| Cross-platform OS notification capability | Reminder firing | Time-based directives |
| Browser-native speech recognition | Voice capture | Voice input |
| Repos on the user's laptop (paths configured per-project) | Code intelligence + drift detection + methodology parsing | Semble indexing, Semgrep rule commits, code TODO import, methodology runtime |

Throughline degrades gracefully when dependencies are absent: no Anthropic key disables AI features but everything else works; no GitHub PAT disables polling but sessions remain editable; no Semble disables code Q&A and code-drift tier 3; a project bound to the freeform bundle gets a methodology-free tracker experience natively (no missing-feature warnings).

---

## 16. How to use this spec in Claude Code sessions

Paste at the start of any Throughline development session:

> Read `docs/throughline/SPEC.md` and `docs/throughline/CHECKLIST.md` before starting. The spec is authoritative for functional intent. The code spec is authoritative for implementation. The checklist is authoritative for build state. Update the checklist as work progresses. Any deviation from the spec at the functional level requires either a code change to match, or an explicit spec update with a decision recorded in section 14. Implementation choices that do not change functionality are recorded in `CODE_SPEC.md` only.

If the session involves Semble, Semgrep, GitHub integration, Anthropic API calls, or methodology bundle parsing, confirm the relevant integration is currently configured locally before starting.

---

*End of Throughline v1 spec.*
