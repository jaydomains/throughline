# Throughline v1 Decision Ledger

This file holds the **full text** of every `T-D{n}` anchor referenced in `SPEC.md` §14. SPEC.md §14 is the index (subject + sections); this file is the body (decision + context + rationale + implications).

All v1 entries are `active`. Status changes (e.g., `superseded`) require an update both here and in §14.

Where rationale could not be recovered from SPEC.md, the entry is marked `<!-- RATIONALE NEEDED -->` rather than fabricated.

---

## T-D1 — Items as first-class data with stable identifiers; sessions are saved views, not containers

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.1, 8

### Decision
Items live in a single global pool with stable identifiers. A session is a saved view definition that filters the pool by item membership. Items can belong to multiple sessions; marking an item done in any view marks it done everywhere.

### Context
Earlier drafts treated sessions as containers. That forced duplication of items across sessions and made cross-session reasoning awkward.

### Rationale
A single global identity simplifies routing, drift detection, and reconcile. Cross-session item membership is many-to-many without duplication. Session deletion drops the view definition without orphaning items.

### Implications
Items table holds the canonical record; a join table holds session memberships. UI must show session memberships per item. Reconcile against session B can add membership without creating new items. Status changes propagate to every view the item appears in.

---

## T-D2 — Local backend service + browser UI on user's laptop

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 3

### Decision
Throughline runs as two pieces on the user's laptop: a long-lived backend service and a browser UI. Backend handles persistence, scheduling, file watching, external network calls, and Claude Code → Throughline push. UI is a presentation layer over the backend.

### Context
A browser-only design could not do background work, scheduled tasks, or filesystem watching.

### Rationale
Closing the browser tab must not kill reminders, polling, or drift checks. Filesystem and OS notifications must be reachable. Putting these in the backend lets the user close the browser without losing the things that matter.

### Implications
Two-process deployment. Login auto-start required. Backend exposes a local-only HTTP surface for the browser. Backend owns all state.

---

## T-D3 — Single-file local datastore with single-file backup; no JSON serialisation layer

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.20, 8

### Decision
All Throughline state lives in a single-file local datastore. Backup is a copy of that file. There is no separate serialisation layer between the datastore and the backup format.

### Context
Backup needs to be trivially reliable for a single-user tool with one machine.

### Rationale
A single file means restore is "put the file back" — no transformation, no version skew between datastore and backup format. Eliminates a class of bugs.

### Implications
SQLite (or similar) is the natural choice. Schema migrations apply in-place. No separate export format. API keys must live outside the datastore (T-D4) so backups are safe to share.

---

## T-D4 — API keys live in backend configuration, separate from primary state

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 8, 7.22

### Decision
Anthropic API keys, GitHub PATs, and any future API keys live in backend configuration, separate from the primary datastore. Keys are never accessible to the browser and never included in backups.

### Context
Backups are designed to be copyable to external locations (Dropbox, Drive, USB — T-D29). Keys in backups are leakable.

### Rationale
Splitting keys out of state keeps backups safe to share or store off-machine. Browser isolation prevents key exfiltration through XSS or rogue extensions.

### Implications
Two configuration surfaces: the datastore (state) and a backend-only secrets config. Settings UI may let the user enter keys, but the values land in backend config, not datastore.

---

## T-D5 — AI-proposed writes go through review modal

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.5, 7.10

### Decision
Every AI-proposed change passes through a review modal before applying. The only exception is confidence-thresholded GitHub auto-apply on PR merge, and that exception still records audit entries and offers 24-hour undo.

### Context
AI extraction is fallible. §5 establishes "no silent state changes" as a core principle.

### Rationale
Review-before-apply is the operationalisation of that principle. It costs the user a click but guards against silent corruption of the work pool.

### Implications
Every capture surface except scratchpad routes through review. Confidence scoring must be exposed to the UI for the auto-apply branch (T-D6, T-D19).

---

## T-D6 — Auto-apply on PR merge requires high-confidence + audit + 24h undo

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.10

### Decision
PR-merge auto-reconcile may auto-apply only when AI confidence is high. Each auto-apply records: PR number, AI reasoning, confidence score, and the full PR description used. A 24-hour undo window applies.

### Context
Bypassing review for convenience must not destroy work.

### Rationale
Audit captures full provenance; undo limits damage from a bad auto-apply. Logging confidence scores from day 1 enables empirical threshold tuning post-launch (per §13).

### Implications
Confidence scoring must be instrumented from the first AI-reconcile call. Undo must be re-implementable from audit-log entries (i.e., entries are reversible). UI shows a toast on auto-apply with an undo affordance.

---

## T-D7 — Polling-only for GitHub

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.10

### Decision
GitHub awareness is via polling. No webhook receivers in v1.

### Context
Single-user, local backend. Webhooks would require a public endpoint or a tunnel.

### Rationale
The authenticated GitHub rate limit (5000/hr) is comfortable margin given the cadence (60s active, 5min otherwise). Polling avoids the operational complexity of inbound traffic.

### Implications
ETag caching needed to stay efficient under the rate limit. Polling cadence varies by session activity (active: 60s, otherwise: 5min). State cache (8) tracks last-known PR states.

---

## T-D8 — Free-text and structured blockers coexist on items

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.2

### Decision
Items carry both a free-text blocker description and structured blocker references to other items.

### Context
Some blockers are external ("waiting on Carel's review") and have no item to link to. Others are internal and should drive graph edges.

### Rationale
Forcing all blockers to be items would clutter the pool with placeholder items for external waits. Forcing all to be free-text would lose the graph signal needed for blocker-chain visualisation and dependency-aware sequencing (§7.15).

### Implications
UI needs both inputs. Graph view edges come from structured refs only. Free-text shows in the item card. Both contribute to the "blocked" lifecycle state.

---

## T-D9 — Notes consolidated into library; no per-item journal field

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.2, 7.6

### Decision
Long-form journaled thinking lives in library notes attached to items via a many-to-many relationship. Items do not carry a per-item journal field.

### Context
Earlier drafts had both a per-item journal field and library notes — two places for the same content.

### Rationale
One place reduces split-brain decisions about where to write. Notes can attach to multiple items, which a per-item field couldn't model.

### Implications
Item detail panel shows attached notes (linked, not embedded). Library is where note editing happens. Many-to-many join table needed.

---

## T-D10 — Library has four content types: notes, prompts, snippets, imported docs

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.6

### Decision
The library supports exactly four content types: notes, prompts, snippets, imported docs. Each first-class.

### Context
The library is the home for non-item reference content captured or referenced during sessions.

### Rationale
<!-- RATIONALE NEEDED -->

### Implications
Each type has a distinct UI affordance: notes use a markdown editor; prompts have variable fill-in; snippets have a quick-copy button; imported docs are read-mostly with AI-generated summary and tags. Future content types require a decision update.

---

## T-D11 — Folder-opt-in for repo `.md` ingestion

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.7

### Decision
Repo `.md` ingestion requires the user to point the backend at specific directories. No recursive whole-repo scan by default.

### Context
A whole-repo scan ingests `node_modules`, vendored docs, generated files — noise.

### Rationale
Per-folder opt-in keeps the library focused on docs the user actually wants surfaced.

### Implications
Settings carries a list of opted-in directories. Ingestion is a discrete user action per folder. Re-ingest behaviour on file change is a §13 open item (recommended snapshot + per-entry track-source toggle).

---

## T-D12 — Three directive types in v1: pin, reminder, include-in-prompt

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.8

### Decision
V1 supports exactly three directive types: pin, reminder (relative / absolute / recurring), and include-in-session-start-prompt. Append-to-document, surface-on-tag, surface-on-session, and recur-only-without-time-anchor are deferred.

### Context
Earlier drafts had a longer directive taxonomy; expansion risked complexity without proven need.

### Rationale
Most deferred directives can be reproduced through saved-view bookmarks plus the existing reconcile mechanism. The three v1 types cover the friction points: sticky surfacing, time-based firing, prompt augmentation.

### Implications
UI exposes three directive options. Deferred types stay parked unless evidence demands them. Directives view groups by type (pinned / reminders / include-in-prompt).

---

## T-D13 — Code architecture visualisation dropped; delegated to Semble + Semgrep

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.9, 7.12, 7.13

### Decision
Throughline does not visualise code architecture. Code search delegates to Semble; rule verification delegates to Semgrep.

### Context
An architecture view was considered for earlier drafts.

### Rationale
Static analysis fails on architectures that route through a runtime message bus. Bespoke parsing couples Throughline to a specific codebase. Neither path fits a tool meant to work across many sessions and repos.

### Implications
View modes do not include "architecture." Semble and Semgrep are first-class dependencies. Throughline's job is visualising work, not code.

---

## T-D14 — Mermaid is an export format only; primary visual is the in-app graph view

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.18

### Decision
Mermaid is an export format. The primary visual interaction with the data is the in-app interactive graph view.

### Context
Mermaid was considered as a possible primary visualisation.

### Rationale
An interactive graph view supports navigation (click to open, drag, hover for context); a static Mermaid render does not. Mermaid remains useful for export to docs, PRs, and chat.

### Implications
Graph view is built natively. Mermaid generation is on-demand AI output for any chosen scope (single session, items tagged X, blocker chain). Output as `.mmd` text or rendered SVG.

---

## T-D15 — SiteMesh component reuse is not a v1 goal

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 12

### Decision
Throughline is not designed to feed components into SiteMesh in v1. It is scoped to its own job.

### Context
Earlier framing considered SiteMesh component extraction as a v1 design constraint.

### Rationale
Designing for reuse in another product distorts the API and slows v1. Any future reuse path requires extracting pure components and is its own project.

### Implications
No abstractions are added to ease external embedding. UI components are tailored to Throughline's use cases.

---

## T-D16 — Single spec covers all of v1; no spec split per feature area

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** (this spec)

### Decision
One functional spec (`SPEC.md`) covers all of v1. No per-feature-area spec split.

### Context
A multi-spec layout was considered.

### Rationale
<!-- RATIONALE NEEDED -->

### Implications
All functional decisions land in one document. `CODE_SPEC.md` and `DECISIONS.md` split *implementation* and *decision-rationale* concerns rather than feature-area concerns. Cross-references stay within a single document.

---

## T-D17 — Claude Code push via watched filesystem inbox

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.4

### Decision
Claude Code feeds Throughline by dropping files at a configurable inbox directory. The backend watches the directory, picks up new files, and runs them through the dump zone flow with a "from Claude Code session: <branch>" annotation. Processed files archive to a dated subdirectory (default 30-day retention, configurable). Failed files move to a failures subdirectory with sibling error metadata.

### Context
Earlier drafts considered clipboard or transcript paste.

### Rationale
A watched directory is robust to backend downtime — files queue on disk and are picked up on next start. Clipboard requires Throughline to be active. Eliminates manual transcript paste.

### Implications
Inbox path configurable. Archive retention configurable. Failure files preserved for retry or manual inspection. Internal moves run autonomously per T-D38.

---

## T-D18 — Stakeholder view toggle exists from v1

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.15

### Decision
Stakeholder view (re-render item content in plain language) ships in v1.

### Context
Stakeholder view is one of several intelligence-layer features.

### Rationale
<!-- RATIONALE NEEDED -->

### Implications
Each item's content has a cached plain-language rendering. Cache invalidates on item edit (per §13 recommendation). One AI call per item per regeneration; cost flows through the cost meter (T-D30).

---

## T-D19 — Confidence-thresholded auto-apply: high → auto, medium → one-click, low → modal

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.10

### Decision
AI confidence on PR-merge auto-reconcile maps to three branches:
- **High** — auto-apply with toast + 24h undo (T-D6).
- **Medium** — notification badge + one-click approve.
- **Low** — reconcile modal as normal for human review.

### Context
A binary apply/don't-apply on confidence wastes the medium-confidence cases that just need a glance.

### Rationale
Three branches match three user costs: zero-touch when AI is sure, one click when likely-correct, full review when uncertain.

### Implications
Confidence scoring must produce a numeric or categorical signal usable by the dispatch logic. Threshold values themselves are §13 open items; instrument scores from day 1 to enable tuning.

---

## T-D20 — Local backend rather than browser-only

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 3

### Decision
Background work, scheduled tasks, and filesystem watching live in the backend. The browser handles UI only.

### Context
Same problem as T-D2 from a different angle: where does background state live?

### Rationale
Browsers cannot reliably run timers when their tab is closed, cannot watch filesystems, and cannot persist state across machine restarts the way a local service can.

### Implications
Backend must be installable as a long-lived process. UI gracefully handles backend-down state (e.g., shows a "backend not running" banner instead of crashing).

---

## T-D21 — Review-before-apply for all capture surfaces except scratchpad

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.4

### Decision
Scratchpad is friction-free with no AI processing and no review modal. Every other capture surface (manual entry, dump zones, voice, Claude Code push, code TODO/FIXME import) routes through review.

### Context
Capturing thoughts under load needs zero friction. Capturing items into the work pool needs verification.

### Rationale
Mixing the two modes would dilute both — either AI-processing the scratchpad (slows capture) or skipping review on dump zones (silent state changes). Scratchpad serves the "lowest-friction inbox" role; everything else is reviewed.

### Implications
Scratchpad UI is always visible in the header. Manual review of scratchpad content is implicit. Dump zone is the friction-tolerant counterpart with full AI extraction + review modal.

---

## T-D22 — Drift detection in 4 tiers; tier-4 auto-dismisses after 7 days

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.11

### Decision
Drift detection runs in four tiers:
- **Tier 1** — Semgrep failure (red badge).
- **Tier 2** — GitHub revert event (orange badge).
- **Tier 3** — relevant code touched, Semble-linked (yellow badge).
- **Tier 4** — duplicate-looking dump entry (drift inbox).

Tier-4 weak signals auto-dismiss after 7 days with a "stale-no-action" reason recorded in the audit log.

### Context
A single-channel drift system either over-alerts (badge fatigue) or under-detects.

### Rationale
Strong signals badge directly so they cannot be missed. Weak signals collect in the inbox so they don't pollute main views. Auto-dismissal of tier-4 prevents inbox bloat while preserving searchability via the audit log.

### Implications
Each tier is a separate signal pipeline. Drift inbox UI counter in the header. Audit log queryable for stale-dismissal reason. Re-verify-via-AI action available on every signal.

---

## T-D23 — Periodic review user-initiated, not background AI

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.15

### Decision
Periodic review surfaces hygiene questions on a configurable interval (default 2 weeks), but only when the user opens the review surface. No background AI activity.

### Context
§9 establishes "every AI call is human-initiated or human-action-derived; no scheduled background AI work."

### Rationale
Background AI runs are surprise costs and surprise state changes; both erode trust. Audit-log queries (no AI) are cheap and run continuously; AI summary/synthesis fires only when the user opens the review.

### Implications
Hygiene queries run on audit-log data without AI. AI calls in the periodic review fire on user open. Cost meter (T-D30) shows zero spend during quiet periods.

---

## T-D24 — Chat history persisted per context

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.16

### Decision
Chat history (dump zone chat, per-list chat) is persisted per context for retrieval.

### Context
Chat surfaces accumulate useful state — refinements, decisions, abandoned drafts.

### Rationale
<!-- RATIONALE NEEDED -->

### Implications
Storage is per-context (per-dump-zone, per-list). Retrievable later. Where chat actions cause state changes, those changes are also captured in the audit log per T-D37.

---

## T-D25 — Audit log never exposes API keys or full prompt content

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.19, 8

### Decision
Audit log entries record actor, field changed, old value, new value, and trigger context. Entries never include API keys and never include full prompt content beyond what's needed to reconstruct the trigger.

### Context
The audit log is searchable, visible in the UI, and part of the datastore (and therefore part of any backup).

### Rationale
Backups must be safe to share (T-D3, T-D4, T-D29). Excluding keys and full prompts keeps that contract intact.

### Implications
Trigger context records model + prompt fingerprint, not the prompt itself. API keys never written to audit-log fields by any code path. Entries remain useful for reconstruction without leaking secrets or user data.

---

## T-D26 — Personal RAG has 3 substrates with a router

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.15

### Decision
Personal RAG supports three substrates:
- **Code** — Semble.
- **Notes** — local embeddings over library notes and item descriptions.
- **Audit history** — structured queries over the audit log.

A router selects one or more substrates per query and synthesises an answer with citations.

### Context
A single-substrate RAG either misses code intent (notes-only) or misses time/state context (code-only).

### Rationale
Three substrates cover three classes of personal knowledge: where things are in code, what was thought about them, and when state transitions happened.

### Implications
Each substrate has its own indexer and query path. Router decision mechanism is a §13 open item; recommended heuristics-first (keywords like "where is X" → code, "when did" → audit, default → notes), with user-overridable per-query toggle.

---

## T-D27 — Semgrep in GitHub Actions; one-file-per-item rule convention; user-managed workflow

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.13

### Decision
Semgrep runs in GitHub Actions on every PR, not in the backend. Backend reads findings via the GitHub API. Throughline-managed rules live in a configurable subdirectory of the repo's Semgrep config area, with one rule file per item, named by the item's stable identifier. The GitHub Actions workflow is user-managed; a recommended template ships with Throughline. The backend warns at first GitHub-integration use if the expected workflow is absent.

### Context
Tier-1 drift requires reliable rule execution. Backend execution would be brittle and tie up local resources.

### Rationale
GitHub Actions is already the CI substrate; running Semgrep there is free and reliable. The one-file-per-item naming convention is what allows the backend to match findings to items unambiguously when reading via API.

### Implications
Workflow setup is a one-time user task. Rule path configurable in settings (§7.22). Verifier rule lifecycle on item deletion follows T-D34 (orphan-flag, not auto-removal).

---

## T-D28 — Semble runs as a backend-managed local service

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.12

### Decision
Semble runs locally as a service started by the backend on launch. It indexes the user's repo on first connection, watches for changes, and re-indexes incrementally. No API key.

### Context
Code search is needed for tier-3 drift detection, plain-English code Q&A, and item-creation enrichment.

### Rationale
A local-only service avoids the per-call cost and latency of cloud code search. No API key keeps configuration light.

### Implications
Backend manages Semble lifecycle (start, restart, indexing trigger). Semble runs alongside Throughline as a separate process. Repo path setting (§7.22) drives Semble's index target.

---

## T-D29 — Backup is a single-file copy; optional configurable auto-copy

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.20

### Decision
Backup is a single-file copy of the underlying datastore. Optional configurable auto-copy target (Dropbox, Drive, USB, etc.) on a schedule. Off by default.

### Context
A reliable backup story is necessary even for a single-user tool.

### Rationale
Single-file copy means restore is "put the file back" — no transformation. Auto-copy off-by-default avoids surprising file writes; on when the user opts in.

### Implications
Header indicator turns red after the configurable threshold (default 7 days) without a backup. Manual export downloads a timestamped copy. Optional scheduled copy when the user sets a target path.

---

## T-D30 — Cost meter visible in header at all times

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.22

### Decision
Running token spend and dollar estimate are visible in the UI header at all times, broken down by feature category for the current day, week, and month. A configurable daily threshold warns when exceeded.

### Context
AI costs are user-borne and easy to lose track of (§9: "Cost is the user's responsibility").

### Rationale
Always-visible cost meter creates awareness without requiring the user to open a settings panel. Per-category breakdown surfaces which features are spending.

### Implications
Cost telemetry table writes per AI call. UI subscribes to running totals. Daily threshold default is a §13 open item (no recommendation in spec).

---

## T-D31 — Home view (not a session) is the default landing surface

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.9

### Decision
Home view is the default landing surface when Throughline opens. It is not a session and not a board. It surfaces in-progress items, recent drift signals, items mentioned in the last Claude Code push, items unblocked since last visit, drift inbox count, scratchpad jot count, and recent activity.

### Context
Defaulting to "last session opened" reinforces session silos.

### Rationale
A user opening Throughline most often wants the cross-cut answer ("where am I right now"), not the last view they had open. Sessions are still one click away.

### Implications
Home view computes its panels from across the pool. "Since last visit" timestamp persists on view exit (per §13 recommendation). Home is the only view mode that aggregates across the whole pool.

---

## T-D32 — Backend mediates all external network calls

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 3, 8, 10

### Decision
All outbound HTTPS originates from the backend. The browser does not call Anthropic, GitHub, or any other external service directly.

### Context
Browser-originated calls would expose API keys to client code and route audit through whatever the browser saw.

### Rationale
Backend mediation isolates API keys to the backend process and gives a single audit point for external traffic.

### Implications
Every external integration has a backend endpoint. Browser only talks to the local backend. Content Security Policy can be tight.

---

## T-D33 — OS notifications abstracted across platforms via a single capability layer

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 10

### Decision
OS notifications are abstracted across platforms (macOS Notification Center, Windows Toast, Linux libnotify) via a single capability layer in the backend. Not duplicated per platform.

### Context
Reminder firing must work on whatever OS the user runs.

### Rationale
A single abstraction concentrates platform quirks in one place and simplifies feature code that wants to fire a notification.

### Implications
Notification permission handled once at the backend layer. UI does not call OS notification APIs directly. Adding a new platform is a single integration point.

---

## T-D34 — Verifier rule lifecycle on item deletion: orphan-flag, not auto-removal

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.13, 7.15, 7.22

### Decision
When an item with verifier rules is deleted, the rule files in the repo are not auto-removed. The rule is orphan-flagged in Throughline and surfaces in the periodic review hygiene list and a dedicated settings panel. A one-click action drafts a cleanup PR for user review and merge. Dismiss-without-removal is also supported and audit-logged.

### Context
Deleting items in Throughline must not silently mutate the user's repo (§5).

### Rationale
Orphan-flagging keeps the user in control while preventing rule files from rotting in CI. The PR-draft action is the bridge: it stages the change for human review rather than writing autonomously.

### Implications
Orphaned-rules tracking table. Settings panel surfacing every orphan. PR-drafting code path. Dismissal recorded in audit log. Periodic review hygiene list includes orphans.

---

## T-D35 — Manual item-to-PR linking: auto-detect + override + skip

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.11

### Decision
When marking an item done manually, Throughline associates the item with a PR via three steps:
1. **Auto-detect** — read the active git branch, look up its PR via GitHub API, propose as the association.
2. **Override** — user can pick another PR or paste a PR number.
3. **Skip** — if no PR is detected and the user doesn't pick one, the item is marked done without PR association.

Skipped items lose tier-2 drift coverage but retain tiers 1 (with verifier rule), 3, and 4.

### Context
Tier-2 drift detection requires a PR association. Auto-reconcile populates this on merge; manual completion needs a fallback.

### Rationale
Auto-detect handles the common case. Override handles ambiguity. Skip respects items that genuinely have no PR (decisions, infra work, cross-repo work).

### Implications
Item detail panel shows the proposed PR with override + skip actions. Re-association possible at any time from the detail panel.

---

## T-D36 — Reconcile diff has 6 categories; contradicted spawns drift signal

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.5

### Decision
Reconcile diff produces six categories: completed, new, edited (covers rename + description refinement), blocker changes, contradicted, no-change. Contradicted items spawn a drift signal (tier-2 if a PR is associated, tier-3 otherwise) rather than auto-reverting state.

### Context
A reconcile that auto-reverts on "input claims this is broken" is a silent state change driven by potentially-noisy input.

### Rationale
Drift discipline applies. Contradicted-as-drift means the user adjudicates rather than the input deciding for them. Consolidating "renamed" and "description refined" under "edited" simplifies the diff vocabulary.

### Implications
Reconcile applies across five categories directly; the sixth (contradicted) routes to drift. UI clearly distinguishes contradicted from completed in the review modal.

---

## T-D37 — Audit log scope: items + library entries

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.19, 8

### Decision
The audit log records every state change to every item and every library entry.

### Context
Library entries are mutable state too — notes get edited, prompts get refined, snippets get updated.

### Rationale
One audit substrate for both classes of mutable state preserves a uniform query surface for periodic review and the audit-log RAG substrate (T-D26).

### Implications
Audit log table records both entity types with a discriminator. UI shows history in both item and library detail panels. RAG audit substrate queries across both.

---

## T-D38 — Internal Throughline-managed file moves are autonomous

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 5, 7.4

### Decision
Internal file movements within Throughline-managed directories (Claude Code inbox archiving, failure quarantine, datastore housekeeping) are not user-facing writes and run autonomously. Carve-out from the no-autonomous-writes principle.

### Context
§5 establishes "no autonomous repo file writes" to protect the user's repo from surprise changes.

### Rationale
Inbox archiving and failure quarantine are bookkeeping inside Throughline-owned directories, not user-visible mutations. Gating them behind review would defeat the watched-FS-inbox model (T-D17).

### Implications
Archiving and failure-quarantine code paths run without user prompts. Logging may be added for transparency. Throughline-managed directories are clearly delineated from user-managed directories in settings.

---

## T-D39 — Items carry an optional branch reference; branches not first-class

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.2, 8

### Decision
Items carry an optional branch reference, populated automatically from the active session's branch field or set manually. Branches remain free-text strings, not first-class entities.

### Context
PR association (T-D35) requires a branch to look up. Tier-2/3 drift detection benefits from branch context.

### Rationale
First-class branches would introduce a new entity, lifecycle, and indexing concerns. A free-text reference does the job — git is the source of truth for branch identity.

### Implications
No branches table. Sessions and items both reference branches by string. Cleanup of stale branch references is the user's concern (handled at the git layer, not the Throughline layer).
