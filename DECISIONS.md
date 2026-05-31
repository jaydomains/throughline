# Throughline v1 Decision Ledger

This file holds the **full text** of every `T-D{n}` anchor referenced in `SPEC.md` §14. SPEC.md §14 is the index (subject + sections); this file is the body (decision + context + rationale + implications).

All v1 entries are `active`. Status changes (e.g., `superseded`) require an update both here and in §14.

Where rationale could not be recovered from SPEC.md, the entry is marked `<!-- RATIONALE NEEDED -->` rather than fabricated.

---

## T-D1 — Items as first-class data with stable identifiers; sessions are saved views, not containers

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.3, 8

### Decision
Items live in a single global pool (per project) with stable identifiers. A session is a saved view definition that filters the pool by item membership. Items can belong to multiple sessions; marking an item done in any view marks it done everywhere.

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
Throughline runs as two pieces on the user's laptop: a long-lived backend service and a browser UI. Backend handles persistence, scheduling, file watching, methodology runtime enforcement, external network calls, and Claude Code → Throughline push. UI is a presentation layer over the backend.

### Context
A browser-only design could not do background work, scheduled tasks, filesystem watching, or methodology rule enforcement.

### Rationale
Closing the browser tab must not kill reminders, polling, drift checks, or gate enforcement. Filesystem and OS notifications must be reachable. Putting these in the backend lets the user close the browser without losing the things that matter.

### Implications
Two-process deployment. Login auto-start required. Backend exposes a local-only HTTP surface for the browser. Backend owns all state and runs the methodology runtime.

---

## T-D3 — Single-file local datastore with single-file backup; no JSON serialisation layer

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.23, 8

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
- **Sections affected:** 8, 7.25

### Decision
Anthropic API keys, GitHub PATs, and any future API keys live in backend configuration, separate from the primary datastore. Keys are never accessible to the browser and never included in backups.

### Context
Backups are designed to be copyable to external locations (Dropbox, Drive, USB — T-D28). Keys in backups are leakable.

### Rationale
Splitting keys out of state keeps backups safe to share or store off-machine. Browser isolation prevents key exfiltration through XSS or rogue extensions.

### Implications
Two configuration surfaces: the datastore (state) and a backend-only secrets config. Settings UI may let the user enter keys, but the values land in backend config, not datastore.

---

## T-D5 — AI-proposed writes go through review modal

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.7, 7.13

### Decision
Every AI-proposed change passes through a review modal before applying. The only exception is confidence-thresholded GitHub auto-apply on PR merge, and that exception still records audit entries and offers 24-hour undo.

### Context
AI extraction is fallible. §5 establishes "no silent state changes" as a core principle.

### Rationale
Review-before-apply is the operationalisation of that principle. It costs the user a click but guards against silent corruption of the work pool.

### Implications
Every capture surface except scratchpad routes through review. Confidence scoring must be exposed to the UI for the auto-apply branch (T-D6, T-D18).

---

## T-D6 — Auto-apply on PR merge requires high-confidence + audit + 24h undo

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.13

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
- **Sections affected:** 7.13

### Decision
GitHub awareness is via polling. No webhook receivers in v1.

### Context
Single-user, local backend. Webhooks would require a public endpoint or a tunnel.

### Rationale
The authenticated GitHub rate limit (5000/hr) is comfortable margin given the cadence (60s active, 5min otherwise). Polling avoids the operational complexity of inbound traffic.

### Implications
ETag caching needed to stay efficient under the rate limit. Polling cadence varies by session activity (active: 60s, otherwise: 5min). State cache (§8) tracks last-known PR states.

---

## T-D8 — Free-text and structured blockers coexist on items

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.4

### Decision
Items carry both a free-text blocker description and structured blocker references to other items.

### Context
Some blockers are external ("waiting on Carel's review") and have no item to link to. Others are internal and should drive graph edges.

### Rationale
Forcing all blockers to be items would clutter the pool with placeholder items for external waits. Forcing all to be free-text would lose the graph signal needed for blocker-chain visualisation and dependency-aware sequencing (§7.18).

### Implications
UI needs both inputs. Graph view edges come from structured refs only. Free-text shows in the item card. Both contribute to the "blocked" lifecycle state.

---

## T-D9 — Notes consolidated into library; no per-item journal field

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.4, 7.8

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
- **Sections affected:** 7.8, 12

### Decision
The library supports exactly four content types in v1: notes, prompts, snippets, imported docs. Each first-class. Whiteboards are deferred to v1.1 (T-D43) and reconsidered once Throughline is in regular use and the gap is felt empirically.

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
- **Sections affected:** 7.9

### Decision
Repo `.md` ingestion requires the user to point the backend at specific directories. No recursive whole-repo scan by default.

### Context
A whole-repo scan ingests `node_modules`, vendored docs, generated files — noise.

### Rationale
Per-folder opt-in keeps the library focused on docs the user actually wants surfaced.

### Implications
Settings carries a list of opted-in directories. Ingestion is a discrete user action per folder. Re-ingest behaviour on file change is a §13 recommended-default item (snapshot + per-entry track-source toggle).

---

## T-D12 — Three directive types in v1: pin, reminder, include-in-prompt

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.10

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
- **Sections affected:** 7.11, 7.15, 7.16

### Decision
Throughline does not visualise code architecture. Code search delegates to Semble; rule verification delegates to Semgrep (or whatever verifier tool a methodology bundle declares).

### Context
An architecture view was considered for earlier drafts.

### Rationale
Static analysis fails on architectures that route through a runtime message bus. Bespoke parsing couples Throughline to a specific codebase. Neither path fits a tool meant to work across many sessions and repos.

### Implications
View modes do not include "architecture." Semble and Semgrep are first-class dependencies for rich-discipline-bound projects. Throughline's job is visualising work and methodology state, not code.

---

## T-D14 — Mermaid is an export format only; primary visual is the in-app graph view

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.21

### Decision
Mermaid is an export format. The primary visual interaction with the data is the in-app interactive graph view.

### Context
Mermaid was considered as a possible primary visualisation.

### Rationale
An interactive graph view supports navigation (click to open, drag, hover for context); a static Mermaid render does not. Mermaid remains useful for export to docs, PRs, and chat.

### Implications
Graph view is built natively. Mermaid generation is on-demand AI output for any chosen scope (single session, items tagged X, blocker chain, primary-unit topology, methodology-gate state). Output as `.mmd` text or rendered SVG.

---

## T-D15 — Single spec covers all of v1; no spec split per feature area

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

## T-D16 — Claude Code push via watched filesystem inbox

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.6

### Decision
Claude Code feeds Throughline by dropping files at a configurable inbox directory. The backend watches the directory, picks up new files, and runs them through the dump zone flow with a "from Claude Code session: <branch>" annotation. Processed files archive to a dated subdirectory (default 30-day retention, configurable). Failed files move to a failures subdirectory with sibling error metadata.

### Context
Earlier drafts considered clipboard or transcript paste.

### Rationale
A watched directory is robust to backend downtime — files queue on disk and are picked up on next start. Clipboard requires Throughline to be active. Eliminates manual transcript paste.

### Implications
Inbox path configurable. Archive retention configurable. Failure files preserved for retry or manual inspection. Internal moves run autonomously per T-D37.

---

## T-D17 — Stakeholder view toggle exists from v1

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.18

### Decision
Stakeholder view (re-render item content in plain language) ships in v1.

### Context
Stakeholder view is one of several intelligence-layer features.

### Rationale
<!-- RATIONALE NEEDED -->

### Implications
Each item's content has a cached plain-language rendering. Cache invalidates on item edit (per §13 recommendation). One AI call per item per regeneration; cost flows through the cost meter (T-D29).

---

## T-D18 — Confidence-thresholded auto-apply: high → auto, medium → one-click, low → modal

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.13

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

## T-D19 — Local backend rather than browser-only

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 3

### Decision
Background work, scheduled tasks, filesystem watching, and methodology runtime live in the backend. The browser handles UI only.

### Context
Same problem as T-D2 from a different angle: where does background state and runtime enforcement live?

### Rationale
Browsers cannot reliably run timers when their tab is closed, cannot watch filesystems, cannot run methodology validators against project repos, and cannot persist state across machine restarts the way a local service can.

### Implications
Backend must be installable as a long-lived process. UI gracefully handles backend-down state (e.g., shows a "backend not running" banner instead of crashing).

---

## T-D20 — Review-before-apply for all capture surfaces except scratchpad

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.6

### Decision
Scratchpad is friction-free with no AI processing and no review modal. Every other capture surface (manual entry, dump zones, voice, Claude Code push, code TODO/FIXME import) routes through review.

### Context
Capturing thoughts under load needs zero friction. Capturing items into the work pool needs verification.

### Rationale
Mixing the two modes would dilute both — either AI-processing the scratchpad (slows capture) or skipping review on dump zones (silent state changes). Scratchpad serves the "lowest-friction inbox" role; everything else is reviewed.

### Implications
Scratchpad UI is always visible in the header. Manual review of scratchpad content is implicit. Dump zone is the friction-tolerant counterpart with full AI extraction + review modal.

---

## T-D21 — Drift detection runs in two streams: code-drift (four tiers) and discipline-drift (bundle-defined categories)

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.14

### Decision
Drift detection runs in two parallel streams.

**Code-drift, four tiers:**
- **Tier 1** — Semgrep failure on a verifier rule attached to a done item (red badge).
- **Tier 2** — GitHub revert event on a PR a done item is associated with (orange badge).
- **Tier 3** — new PR touches files in a done item's code references (yellow badge).
- **Tier 4** — duplicate-looking dump zone entry matching a done item, cosine similarity ≥ 0.80 with AI confirmation pass for borderline 0.70–0.80. Routes to drift inbox; auto-dismisses with an audit-logged "stale-no-action" reason after 7 days.

**Discipline-drift, bundle-defined categories:** the methodology bundle declares the categories. Examples a rich bundle might declare include structural conformance failures, banned-string violations, marker violations in wrong phases, cross-reference failures, and phase-transition violations. The runtime hosts whatever drift categories the bundle declares; freeform declares none, so the discipline-drift stream is a no-op there.

### Context
A single-channel drift system either over-alerts (badge fatigue) or under-detects. A code-only drift system misses methodology violations that show up in docs rather than code.

### Rationale
Strong signals badge directly so they cannot be missed. Weak signals collect in the inbox so they don't pollute main views. Auto-dismissal of tier-4 prevents inbox bloat while preserving searchability via the audit log. Two streams keep code regressions and methodology violations on equal footing without forcing one taxonomy to model the other.

### Implications
Code-drift and discipline-drift share the `drift_signals` table with a `stream` discriminator. Each tier and each discipline category is a separate signal pipeline. Drift inbox UI counter in the header. Audit log queryable for stale-dismissal reason. Re-verify-via-AI action available on every signal. Discipline-drift surfaces in the methodology-gates view and as badges on affected primary units.

---

## T-D22 — Periodic review user-initiated, not background AI

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.18

### Decision
Periodic review surfaces hygiene questions on a configurable interval (default 2 weeks), but only when the user opens the review surface. No background AI activity.

### Context
§9 establishes "every AI call is human-initiated or human-action-derived; no scheduled background AI work."

### Rationale
Background AI runs are surprise costs and surprise state changes; both erode trust. Audit-log queries (no AI) are cheap and run continuously; AI summary/synthesis fires only when the user opens the review.

### Implications
Hygiene queries run on audit-log data without AI. AI calls in the periodic review fire on user open. Cost meter (T-D29) shows zero spend during quiet periods.

---

## T-D23 — Chat history persisted per context

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.19

### Decision
Chat history (dump zone chat, per-list chat) is persisted per context for retrieval.

### Context
Chat surfaces accumulate useful state — refinements, decisions, abandoned drafts.

### Rationale
<!-- RATIONALE NEEDED -->

### Implications
Storage is per-context (per-dump-zone, per-list). Retrievable later. Where chat actions cause state changes, those changes are also captured in the audit log per T-D36.

---

## T-D24 — Audit log never exposes API keys or full prompt content

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.22, 8

### Decision
Audit log entries record actor, field changed, old value, new value, and trigger context. Entries never include API keys and never include full prompt content beyond what's needed to reconstruct the trigger.

### Context
The audit log is searchable, visible in the UI, and part of the datastore (and therefore part of any backup).

### Rationale
Backups must be safe to share (T-D3, T-D4, T-D28). Excluding keys and full prompts keeps that contract intact.

### Implications
Trigger context records model + prompt fingerprint, not the prompt itself. API keys never written to audit-log fields by any code path. Entries remain useful for reconstruction without leaking secrets or user data.

---

## T-D25 — Personal RAG has 3 substrates with a router

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.18

### Decision
Personal RAG supports three substrates:
- **Code** — Semble.
- **Text** — local embeddings over library content, item descriptions, and project docs.
- **Audit history** — structured queries over the audit log.

A router selects one or more substrates per query and synthesises an answer with citations.

### Context
A single-substrate RAG either misses code intent (text-only) or misses time/state context (code-only).

### Rationale
Three substrates cover three classes of personal knowledge: where things are in code, what was thought about them, and when state transitions happened.

### Implications
Each substrate has its own indexer and query path. Router uses keyword heuristics ("where is X" → code, "when did" → audit, default → text) with user-overridable per-query toggle; AI classification of query intent is deferred.

---

## T-D26 — Semgrep in GitHub Actions; bundle-defined rule conventions; user-managed workflow

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.16

### Decision
Semgrep runs in GitHub Actions on every PR, not in the backend. Backend reads findings via the GitHub API. The methodology bundle defines rule conventions; a rich bundle might declare that rules live in a dedicated subdirectory of the repo's Semgrep config area, with one rule file per item, named by the item's stable identifier. Other methodologies may define different conventions. The GitHub Actions workflow is user-managed; a recommended template ships with Throughline. The backend warns at first GitHub-integration use if the expected workflow is not present.

### Context
Tier-1 drift requires reliable rule execution. Backend execution would be brittle and tie up local resources. The methodology runtime owns rule conventions so different bundles can declare different verifier-tool conventions over time.

### Rationale
GitHub Actions is already the CI substrate; running the verifier there is free and reliable. **Boundary clarification (Q7, SPEC §7.16):** the integration boundary is the GitHub Checks annotation contract — the backend matches a check run's annotation rule identifiers to items via the bundle-defined rule-identifier convention, which is what lets the backend match findings unambiguously while letting other annotation-posting tools or conventions slot in. Semgrep is the v1 reference/recommended tool; the contract, not the tool, is what Throughline integrates against. No new T-D anchor — the underlying decision is unchanged; the wording is tightened in place and the anchor ID is retained (canonical via SPEC §14).

### Implications
Workflow setup is a one-time user task. Rule path configurable in settings per project. Verifier rule lifecycle on item deletion follows T-D33 (orphan-flag, not auto-removal).

---

## T-D27 — Semble integrated keyless and local, invoked per query on demand

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.15

### Decision
Throughline integrates Semble for code intelligence: keyless, local, invoked on demand. Semble runs on the user's machine with no API key; Throughline points it at the project's repo path per query and consumes the results.

### Context
Code search is needed for code-drift tier 3, plain-English code Q&A, and item-creation enrichment.

### Rationale
Local keyless code search avoids the per-call cost and latency of cloud code search and keeps configuration light. **Lifecycle revision (Phase 11):** the original framing — a backend-started long-lived service that watches the repo and re-indexes incrementally — was written before the real Semble interface was confirmed. Phase-11 spec analysis established that Semble is a Python tool offering stdio-MCP or a one-shot CLI with on-demand, per-session-cached indexing and no HTTP/socket or backend-managed daemon. The decision to use Semble (keyless, local) is unchanged; the *how* is now per-query CLI invocation, not service supervision. Implementation shape: CODE_SPEC C-D17.

### Implications
Throughline invokes Semble per query (no start/restart/indexing-trigger supervision). The per-project repo path is passed per invocation as Semble's index target. Graceful degradation when Semble is absent follows SPEC §15. No new T-D anchor — the underlying decision is unchanged; the shape change is captured in CODE_SPEC C-D17.

---

## T-D28 — Backup is a single-file copy; optional configurable auto-copy

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.23

### Decision
Backup is a single-file copy of the underlying datastore. Optional configurable auto-copy target (Dropbox, Drive, USB, etc.) on a schedule. Off by default.

### Context
A reliable backup story is necessary even for a single-user tool.

### Rationale
Single-file copy means restore is "put the file back" — no transformation. Auto-copy off-by-default avoids surprising file writes; on when the user opts in.

### Implications
Header indicator turns red after the configurable threshold (default 7 days) without a backup. Manual export downloads a timestamped copy. Optional scheduled copy when the user sets a target path.

---

## T-D29 — Cost meter visible in header at all times

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.25

### Decision
Running token spend and dollar estimate are visible in the UI header at all times, broken down by feature category for the current day, week, and month. A configurable daily threshold warns when exceeded.

### Context
AI costs are user-borne and easy to lose track of (§9: "Cost is the user's responsibility").

### Rationale
Always-visible cost meter creates awareness without requiring the user to open a settings panel. Per-category breakdown surfaces which features are spending.

### Implications
Cost telemetry table writes per AI call. UI subscribes to running totals. Daily threshold default is a §13 open item (no recommendation in spec).

---

## T-D30 — Home view (not a session) is the default landing surface

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.11

### Decision
Home view is the default landing surface when Throughline opens, scoped to the current project. It is not a session and not a board. It surfaces in-progress items this week, recent drift signals (code and discipline), items mentioned in the last Claude Code push, items unblocked since last visit, methodology phase indicators per the bundle's state machine, drift inbox count, scratchpad jot count, and recent activity.

### Context
Defaulting to "last session opened" reinforces session silos.

### Rationale
A user opening Throughline most often wants the cross-cut answer ("where am I right now"), not the last view they had open. Sessions are still one click away.

### Implications
Home view computes its panels from across the project's pool. "This week" = rolling 7 days from now. "Since last visit" timestamp persists on view exit (per §13 recommendation). Home is the only view mode that aggregates across the whole project pool.

---

## T-D31 — Backend mediates all external network calls

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

## T-D32 — OS notifications abstracted across platforms via a single capability layer

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

## T-D33 — Verifier rule lifecycle on item deletion: orphan-flag, not auto-removal

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.16

### Decision
When an item with verifier rules is deleted, the rule files in the repo are not auto-removed. The methodology bundle defines verifier-rule type and storage; a rich bundle might declare Semgrep rules living in the repo's Semgrep config area. The rule is orphan-flagged in Throughline and surfaces in the periodic review hygiene list and a dedicated settings panel. A one-click action drafts a cleanup PR for user review and merge. Dismiss-without-removal is also supported and audit-logged.

### Context
Deleting items in Throughline must not silently mutate the user's repo (§5).

### Rationale
Orphan-flagging keeps the user in control while preventing rule files from rotting in CI. The PR-draft action is the bridge: it stages the change for human review rather than writing autonomously. Bundle-defined storage lets other methodologies adopt different verifier-rule conventions without reshuffling the orphan-handling code path.

### Implications
Orphaned-rules tracking table. Settings panel surfacing every orphan. PR-drafting code path. Dismissal recorded in audit log. Periodic review hygiene list includes orphans.

---

## T-D34 — Manual item-to-PR linking: auto-detect + override + skip

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.14

### Decision
When marking an item done manually, Throughline associates the item with a PR via three steps:
1. **Auto-detect** — read the active git branch, look up its PR via GitHub API, propose as the association.
2. **Override** — user can pick another PR or paste a PR number.
3. **Skip** — if no PR is detected and the user doesn't pick one, the item is marked done without PR association.

Skipped items lose code-drift tier-2 coverage but retain tiers 1 (with verifier rule), 3, and 4.

### Context
Code-drift tier-2 detection requires a PR association. Auto-reconcile populates this on merge; manual completion needs a fallback.

### Rationale
Auto-detect handles the common case. Override handles ambiguity. Skip respects items that genuinely have no PR (decisions, infra work, cross-repo work).

### Implications
Item detail panel shows the proposed PR with override + skip actions. Re-association possible at any time from the detail panel.

---

## T-D35 — Reconcile diff has 6 categories; edited covers title and description; contradicted spawns drift signal

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.7

### Decision
Reconcile diff produces six categories: completed, new, edited (covers title and description changes under one row), blocker changes, contradicted, no-change. Contradicted items spawn a drift signal (code-drift tier-2 if a PR is associated, code-drift tier-3 otherwise) rather than auto-reverting state.

### Context
A reconcile that auto-reverts on "input claims this is broken" is a silent state change driven by potentially-noisy input.

### Rationale
Drift discipline applies. Contradicted-as-drift means the user adjudicates rather than the input deciding for them. Consolidating title and description refinements under "edited" simplifies the diff vocabulary.

### Implications
Reconcile applies across five categories directly; the sixth (contradicted) routes to drift. UI clearly distinguishes contradicted from completed in the review modal.

---

## T-D36 — Audit log scope covers items, sessions, library entries, projects, methodology bindings, and gate firings

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.22, 8

### Decision
The audit log records every state change to every item, session, library entry, project, methodology bundle binding, and every methodology gate firing.

### Context
Items and library entries are mutable state; sessions are views over items (T-D1) but their own CRUD — create, rename, branch-ref edits, delete — is itself a state change that affects which items render in which view; projects and bundle bindings change less often but their changes (project create/archive, bundle re-bind, bundle file change) materially alter what the runtime enforces; gate firings are the methodology runtime's primary externally-visible behaviour.

### Rationale
One audit substrate across all of these preserves a uniform query surface for periodic review, the audit-log RAG substrate (T-D25), and methodology-state reconstruction. Bundle changes audit-logged means a retroactive effect (a bundle change altering interpretation of existing data) is traceable to its trigger. Sessions included in scope because session lifecycle changes feed the periodic-review hygiene queries ("sessions untouched 30+ days", SPEC §7.18) and need an honest history of their own renames and member-changes — otherwise the periodic-review surface would be querying a partial substrate.

### Implications
Audit log table records all entity types with a discriminator. Gate-firing entries record the moment, gate identifier, status, and findings reference. Session entries record create / rename / branch-ref / membership-add / membership-remove / delete. UI shows history in item, library, project, session, and methodology-gates detail panels. RAG audit substrate queries across the full surface.

---

## T-D37 — Internal Throughline-managed file moves are autonomous

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 5, 7.6

### Decision
Internal file movements within Throughline-managed directories (Claude Code inbox archiving, failure quarantine, datastore housekeeping) are not user-facing writes and run autonomously. Carve-out from the no-autonomous-writes principle.

### Context
§5 establishes "no autonomous repo file writes" to protect the user's repo from surprise changes.

### Rationale
Inbox archiving and failure quarantine are bookkeeping inside Throughline-owned directories, not user-visible mutations. Gating them behind review would defeat the watched-FS-inbox model (T-D16).

### Implications
Archiving and failure-quarantine code paths run without user prompts. Logging may be added for transparency. Throughline-managed directories are clearly delineated from user-managed directories in settings.

---

## T-D38 — Items carry optional branch and PR references; branches free-text, PRs first-class

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.4, 8

### Decision
Items carry an optional branch reference and optional PR associations. Branch references are populated automatically from the active session's branch field or set manually; branches remain free-text strings, not first-class entities. PR associations are first-class fields on items — items reference PRs (not branches as first-class fields) — and drive code-drift tier-2.

### Context
PR association (T-D34) requires a branch to look up. Code-drift tiers 2 and 3 benefit from branch context. PRs, by contrast, are the unit drift-detection signals key on directly.

### Rationale
First-class branches would introduce a new entity, lifecycle, and indexing concerns. A free-text reference does the job — git is the source of truth for branch identity. PRs as first-class fields make tier-2 drift detection clean: the item points at the PR, the GitHub poller updates the PR's status, the signal pipeline reads the association.

### Implications
No branches table. Sessions and items both reference branches by string. Items have a structured PR association table. Cleanup of stale branch references is the user's concern (handled at the git layer, not the Throughline layer).

---

## T-D39 — Methodology runtime as the product core

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 2, 7.1

### Decision
The methodology runtime is Throughline's core. Throughline is methodology-agnostic; methodology bundles configure all methodology-specific concepts (primary unit, anchor format, marker rules, state machine, review patterns, validation). The tracker (items, sessions, library, directives, drift, audit) and the intelligence layer (RAG, retro, sequencing, stakeholder, companion review, session-start scaffolding) are surfaces over the runtime, not standalone products.

### Context
Earlier framing treated Throughline as a tracker with intelligence features. One rich authoring discipline was a specific consumer of the tracker; running other projects required mental translation or code branches per project.

### Rationale
The discipline that keeps AI-assisted development honest is currently re-enacted by hand every session. Codifying it as a bundle and applying it as runtime behaviour eliminates the per-session re-work. With a methodology-agnostic runtime, the same Throughline supports any project that declares a bundle binding — freeform, the `test-bundle`, a user-owned bundle via `bundle_path`, or whatever ships later — without code-path special-casing per methodology.

### Implications
Code paths must not hardcode any bundle's terminology. The runtime calls into the loaded bundle for validators, gates, item-type vocabulary, review patterns, templates, and primary-unit grouping. Tracker and intelligence-layer features parameterise their behaviour on bundle declarations. Adding a new methodology is authoring a bundle, not changing code.

---

## T-D40 — Projects as first-class entities; multi-project from v1

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.2, 8

### Decision
Projects are first-class entities. Multiple projects coexist in one Throughline instance. Each project is a codebase + a methodology bundle binding + Throughline state. Project lifecycle (create, switch, archive, delete) is functional from v1.

### Context
Earlier framing scoped Throughline to a single repo. Even single-user work spans multiple projects (a primary project, side projects, experiments) over time; serialising them through one tracker instance loses cross-project carry-over.

### Rationale
The same Throughline is meant to support any project that declares a methodology binding. Multi-project is the substrate that makes one tool useful across the user's full work surface rather than being scoped to a single repo. Doing it from v1 avoids a single-project schema becoming retrofitted later.

### Implications
Schema carries a `project_id` foreign key on per-project entities (items, sessions, library entries, drift signals, audit history, etc.). A dedicated projects view mode lists, switches, archives, and deletes projects. Most surfaces are project-scoped by default with explicit cross-project toggles (library, rollup) where useful. Project create defaults the bundle binding to freeform (T-D47).

---

## T-D41 — Repo-shipped bundles: freeform default + generic test-bundle fixture

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.1, 12

> **Body revised in place (bundle-externalisation refactor, 2026-05).** Anchor ID retained, canonical via SPEC §14. The original decision shipped a rich-discipline reference bundle inside the repo; the externalisation refactor (C-D14) moved proprietary discipline out of the repo and replaced the in-repo reference with a generic, business-neutral `test-bundle` grammar fixture.

### Decision
Throughline v1 ships two repo-resident methodology bundles: `freeform` (the minimum-spec default) and a generic `test-bundle` grammar fixture that exercises every section of the eleven-section structure (T-D42). Rich user-owned discipline bundles are authored as markdown files following the eleven-section structure and bound per-project via `bundle_path` (C-D14) so proprietary discipline never enters the public repo. Additional repo-shipped bundles may be added under `methodologies/`. In-app bundle authoring (a UI for drafting and editing bundles) is deferred to v2.

### Context
The methodology runtime is methodology-agnostic, but it must be exercised against real bundles from day one to prove the runtime contract. The repo is also public, so the in-repo bundles must contain no business-internal discipline.

### Rationale
Freeform proves the runtime can host a minimum-spec methodology and gives "I just want to track some stuff" projects a first-class home (T-D47). The `test-bundle` proves the runtime can host a non-trivial bundle (primary unit with tier rules, anchors, markers, a phase state machine, multiple item types on separate boards, multi-gate moments) without shipping any proprietary discipline. The external `bundle_path` mechanism (C-D14) lets a rich user-owned bundle bind with full watch/hot-reload parity. Shipping freeform + a non-trivial fixture stress-tests the bundle contract under both ends of the spectrum, surfacing parser and validator gaps a single bundle would miss.

### Implications
The bundle loader must succeed against both repo-shipped bundles and against external bundles resolved via `bundle_path`. The repo-shipped bundles are part of the shipped artefact under the `methodologies/` directory. Freeform is the create-time default binding. Drafting a further bundle is a markdown-authoring task, not a code task.

---

## T-D42 — Eleven-section bundle structure with multi-gate-per-phase-moment

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.1, 7.12

### Decision
Every methodology bundle declares eleven sections: identity, project layout, anchor system, marker system, state machine, communication model, gating model, review patterns, templates, validation rules, authority hierarchy. The state-machine section declares one or more gates per phase moment, each with its own check definitions. Gates produce independent findings streams; one gate can pass while another at the same moment fails.

### Context
A fixed contract is the only way the runtime can generically parse and apply different bundles. Real-world methodology gating has multiple distinct checks at the same phase moment (the `test-bundle`'s per-commit moment declares two independent gates at the same moment: a structure check for code architecture rules and a banned-string sweep for docs).

### Rationale
A fixed-section structure lets the runtime walk known headings and dispatch each to a typed parser. Multi-gate-per-phase-moment captures the actual decomposition of real gating: code architecture checks and docs checks are independent concerns that happen to fire at the same trigger; conflating them under a single per-moment check loses the granularity needed to surface partial pass/fail.

### Implications
Bundle parser walks the eleven sections by heading. The state-machine parser models each phase moment as `[gate_id → gate_spec]`. Gate firings produce per-gate findings streams in the audit log (T-D36). UI surfaces gate-level pass/fail in the methodology-gates view, not just phase-moment pass/fail.

---

## T-D43 — Whiteboards deferred to v1.1

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.8, 12

### Decision
The library has four content types in v1 (notes, prompts, snippets, imported docs — T-D10). Whiteboards as a fifth canvas-based ideation surface with AI extraction are deferred to v1.1, reconsidered once Throughline is in regular use and the gap is felt empirically.

### Context
Whiteboards were considered as a v1 library content type. The feature has obvious appeal but uncertain shape.

### Rationale
The gap needs to be felt empirically before designing the feature; building it pre-emptively risks designing for use cases that don't materialise in actual single-user practice. Deferring keeps v1 scope tight without precluding the addition.

### Implications
No canvas substrate in v1. Library schema remains extensible so adding a fifth type later does not require a destructive migration. Whiteboards parked in §12 of SPEC.md until reconsidered.

---

## T-D44 — Methodology gates fire as proposals, never enforced blocks

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 5, 7.12

### Decision
Methodology gate failures surface as proposals to the user — "this commit would introduce two banned strings; review here" — with an audit-logged override path. Throughline never silently blocks the underlying repo. The user can override (with audit log entry) or fix and retry.

### Context
A gate that blocks the user's commit, PR, or write outright would put Throughline in the way of work the user might have explicit reason to do anyway. §5 already establishes "no silent state changes"; gates are an analogous concern in the opposite direction.

### Rationale
The user must remain in control of the repo. Gating is a discipline aid, not a guardrail enforced over the user's head. Audit-logged overrides preserve the discipline trace without forcing the discipline. The PR-open gate (§7.13) follows the same rule: failures notify, do not block.

### Implications
Every gate has an "override with reason" affordance and a "fix and retry" affordance. Override entries are first-class audit-log rows recording the override reason and the gate's original findings. UI surfaces gate failures in the methodology-gates view and as notifications, never as a forced state-machine halt.

---

## T-D45 — Companion review runs as a structured workflow

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.18

### Decision
The methodology bundle's companion review checklist runs inside Throughline as a structured workflow. The bundle declares which checklist steps are mechanical (Throughline executes a script or validator) and which are judgement (Throughline surfaces a panel for human or AI reviewer to make the call). Step completions and findings land in the audit log.

### Context
Review patterns are part of the bundle's eleven-section structure (§8 of the bundle: review patterns). They were previously re-enacted by hand each session.

### Rationale
Codifying review as a workflow makes step status, completion, and findings queryable. The mechanical/judgement split lets fully automatable checks (e.g., anchor citation validation, marker presence) run without human bottlenecking while preserving human judgement where the call is genuinely subjective (scope, regression, summary assessments).

### Implications
A workflow engine drives review-pattern execution. Mechanical-step results write directly to the audit log. Judgement steps open a panel and capture the call (the call can be made by the user or by AI-via-Anthropic, default model Sonnet per §9). Companion review output is queryable across sessions via the audit-log RAG substrate (T-D25).

---

## T-D46 — Stale yellow flag in list views and detail panel header

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.17, 7.25

### Decision
The configured stale-threshold yellow flag appears next to item titles in every list view (session boards, tree view, search results) and in the item detail panel header.

### Context
Items go stale silently when surfaced only in their detail panel.

### Rationale
Surfacing the flag in list contexts catches staleness incidentally during normal scanning — the user sees stale items while doing other work, not only when they go looking. The detail-panel header repeats the flag for items the user has drilled into.

### Implications
List-row components render the flag based on the per-item updated-at vs the configured threshold. Detail-panel header renders the same flag inline with the title. The stale threshold itself is a settings knob (§7.25).

---

## T-D47 — Freeform bundle as second concrete; no `none` binding

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.1, 7.2

### Decision
Every project binds to exactly one methodology bundle; `none` is not a valid binding. The freeform bundle (no markers, no anchors, no gates, single board with single item type called "task") supports the "I just want to track some stuff" case without code-level special-casing.

### Context
The runtime is methodology-agnostic (T-D39). Lightweight projects still need a binding for code paths to work uniformly.

### Rationale
A `none` binding would require `if (project.has_bundle)` branches throughout the runtime — defeating the methodology-agnostic core. A freeform bundle that legitimately declares "no primary units, no anchors, no gates" lets every code path treat every project uniformly. The runtime asks the bundle what to do; freeform answers "nothing methodology-specific."

### Implications
Settings.bundle is a non-nullable foreign key. Freeform is the create-time default. Views that depend on bundle features (modules, methodology-gates) hide for freeform-bound projects via the bundle's own declarations (no primary units → no modules view; no gates → no methodology-gates view), not via a special "freeform" code path.

---

## T-D48 — Methodology-agnostic spec language

- **Date:** 2026-05-09
- **Status:** active
- **Sections affected:** 7.14, 7.18, 7.13

### Decision
SPEC.md describes what the runtime expects, not what any one bundle happens to do. Runtime concepts are introduced first; bundle-specific terms appear only as parenthetical examples.

### Context
Earlier spec drafts used one rich bundle's vocabulary (module, anchor, marker) as if it were universal Throughline language. Bundle authors reading the spec then had to translate that bundle's terms back to runtime concepts.

### Rationale
Bundle authors must be able to read the spec and see the runtime contract directly. Using one bundle's terms as if universal hides the fact that those terms belong to that bundle. The methodology-agnostic core (T-D39) only holds if the spec language reflects it.

### Implications
Documentation review checks for bundle-specific terminology used as if it were universal. New spec sections introduce the runtime concept first (e.g., "primary unit") and any bundle-specific term in parentheses ("module"). The glossary makes the runtime-vs-bundle distinction explicit per term.

---

## T-D49 — Communication-model bundle §6 grammar + per-project supply split

- **Date:** 2026-05-24
- **Status:** active — implemented in Phase 18 (PR #31), resolves WN-1b-b
- **Sections affected:** 7.11

### Decision
Bundle §6 "Communication model" is a typed-record grammar, not a free-form bullet list:

- §2 "Project layout" enumerates the **architectural-tier vocabulary** the model resolves against, via a top-level `tiers: <a>, <b>, …` line. This vocabulary is distinct from a primary unit's item-count `tier_rules` text (C-D13).
- §6 declares three sub-section kinds via h3 headings:
  - `### Edge type: <name>` — `when:` clause (a `<tier-a> <-> <tier-b>` pair, or the keyword `any`), `mechanism:` (`direct` or `via <module-id>`), optional `contract_source: <slug>`, optional `invariant: violation`.
  - `### Tier routing: <tier-name>` — `mechanism:` override applied to any edge touching a module of that tier; optional `note:`.
  - `### Producer ownership` — `rule: producer-owns-shape` plus optional `notes:`.
- Tier-name resolution against §2's `tiers:` happens at **parse time**: an `Edge type` `when:` or `Tier routing:` heading referencing an undeclared tier raises a structural error attached to §6.

The bundle declares the shape; the **project supplies the per-project pieces** — same bundle-declares / project-supplies split as `bundle_path` (C-D14):

- For each edge type whose §6 declaration carries `contract_source:`, the project supplies a path on disk in `projects.settings_json.communication_model.contract_sources: Record<edge-type-name, repo-relative-or-absolute path>`. Only edge types with a declared `contract_source:` surface in the resolved view.
- For each item-derived module (= C-D13 modules), the project supplies an architectural-tier assignment in `projects.settings_json.communication_model.module_tiers: Record<module-name, tier-name>`. Tier names come from §2's `tiers:` vocabulary. Module-tier assignment is per-project (not bundle-declared) because the architectural-tier vocabulary is methodology-wide but which modules sit in which tier is project-specific.

### Context
Pre-Phase-18 the bundle parser extracted only an `edge_types: string[]` bullet list, leaving `routing_rules` / `producer_ownership_rules` empty — DECISIONS WN-1b-b flagged this as insufficient to render the §7.11 communication-model layer. The Phase-18 spec-author resolution chose a typed grammar, with per-project supply for both contract-source paths AND module-tier assignments (the latter clarified mid-phase: tier vocabulary is bundle-declared, tier assignments are per-project).

### Rationale
- **Typed records over bullets.** Edge types, tier-routing rules, and producer-ownership carry distinct fields; encoding them as h3 sub-sections with key-value bodies mirrors the existing state-machine `### Item type:` / `### Gates: <moment>` convention (T-D42).
- **Parse-time tier resolution.** Catching unknown tier names at bundle load surfaces errors next to the bundle author, not at derivation time when the connection back to the bundle is lost.
- **Per-project supply.** Contract files live in the project repo, not in the bundle (the bundle is methodology-wide; the repo is the project). Module-tier assignment is per-project for the same reason: the bundle declares the tier vocabulary; which item-derived modules sit in which tier depends on this specific project's items and how the project author classifies them.

### Implications
Bundle parser (`bundle-parser/communication-model.ts`) walks h3 sub-sections like `state-machine.ts`. View endpoint `GET /api/projects/:id/communication-model` returns `{ bundle, contract_sources, module_tiers, resolved: { contract_sources, module_tiers, declared_tiers } }`; PUT replaces the `communication_model` block in `settings_json`. SettingsView surfaces both blocks behind a "configured but not yet consumed in Phase 18" hint. Implementation-shape detail in C-D18.

---

## T-D50 — Communication-model graph is rule-level with coupled freshness

- **Date:** 2026-05-24
- **Status:** active — implemented in Phase 18 (PR #31), resolves WN-1b-b
- **Sections affected:** 7.11

### Decision
The communication-model graph rendered in GraphView (§7.11) is **rule-level**, not instance-level: each declared edge type expands into one edge per ordered-distinct pair of modules whose tiers satisfy its `when:` clause (self-loops excluded). Module nodes are **synthesised** from the project's items — the module set is the union of `Item.methodology_context.primary_unit_refs` over all items in the project (= the C-D13 modules service), with each module's tier read from `projects.settings_json.communication_model.module_tiers` (resolver `valid:false` and unassigned both map to a null tier; pairs matching tier-pair `when:` clauses skip null-tier endpoints, but `when: any` includes them).

Tier-routing overrides (`### Tier routing:` rules in §6) replace the edge type's mechanism on any edge touching a module of that tier. When both endpoints carry conflicting overrides, the tier name that sorts lexicographically first wins; the winning tier is reported on the edge as `mechanism_overridden_by_tier` so the renderer can surface it. `invariant: violation` is parsed-and-carried on every emitted edge and **rendered as a styling hint** (danger colour + violation badge in the side panel); Phase-18 **does not enforce** routing invariants — enforcement is a later phase.

The graph tracks current item state — **coupled freshness**: the synthesised module set and per-module item counts depend on items' `primary_unit_refs`, so the graph re-derives whenever the project's items change (the relevant change set: item creation, deletion, or methodology-context edits; not title / status / description / tag edits). The frontend implements this by deriving a stable `commItemsKey` from items and using it as a dependency for the fetch effect.

Concrete-instance edges parsed from contract files (the `contract_source:` paths the project supplies) are **out of scope for Phase 18**: the paths are stored but never read. Instance-level edges and routing-invariant enforcement are deferred to a later phase.

### Context
WN-1b-b's open candidate (1) — "extend the §6 bundle grammar + parser to capture per-unit routing/producer rules, then draw the layer" — would, taken literally, require parsing each project's contract files to enumerate concrete producer→consumer edges. Phase 18 scope was scoped narrower than that: ratify the grammar (T-D49), render the rule-level expansion now, defer instance-level. Mid-phase Gitar review on the frontend slice surfaced the coupled-freshness property when Gitar flagged that the comm graph fetched only on mount/projectId change and would go stale on item changes; the spec author reframed that fix as a property of T-D50's render semantics, not a refresh bug.

### Rationale
- **Rule-level reads the bundle straight.** What the bundle declares is the typology of legal communication. Rule-level expansion makes that typology visible at the project level without claiming to enumerate actual runtime traffic.
- **Synthesised modules over a separate module-registry.** Modules come from items' primary_unit_refs (C-D13). Introducing a separate module table for the graph would duplicate state and drift from the modules view.
- **Coupled freshness is render-correctness, not perf.** A graph that silently shows stale modules after item changes mis-represents the project. The narrow re-fetch key (`ref:count|…`) keeps refresh rate off the hot path while honouring correctness.
- **Parse-and-carry for invariants.** `invariant: violation` is visible to users without code committing to an enforcement model that hasn't been spec-decided yet.

### Implications
Pure derivation `(bundle, modules, module_tiers) → { modules, edges, producer_owns_shape }` in the backend; endpoint `GET /api/projects/:id/communication-model/graph`. Frontend renders modules in tier swimlanes via a pure layout; mediated edges (`mechanism: via <id>`) draw as two arrows through the mediator module when it's in the graph, else as a single curve with a `via <id>` badge. The `commItemsKey` derivation lives in shared graph utilities so it's unit-testable. Implementation-shape detail in C-D18.

---

## T-D51 — `.throughline/` per-repo config convention; third bundle-resolution arm

- **Date:** 2026-05-25
- **Status:** active — to be implemented in Phase 19, resolves WN-clone-Q1
- **Sections affected:** 7.1, 7.2, 7.26

### Decision
A user-owned repo may carry a `.throughline/` directory at its root that holds the project's Throughline configuration alongside the repo's own code. The directory's v1 contents are documented in `docs/.throughline-schema.md`: a required `.throughline/project.json` (project config) and an optional `.throughline/bundle.md` (per-repo bundle). `.throughline/` is config only; no secrets (T-D4), no items, no sessions, no library, no audit log, no embeddings.

The bundle loader gains a third resolution arm. For a project's bound `bundle_id`, the resolution order is now:

1. `<bundle_path>/bundle.md` — explicit external path, when `bundle_path` is set on the project (current C-D14).
2. `<repo_path>/.throughline/bundle.md` — per-repo carve-out, when the project's repo carries one and `bundle_path` is unset.
3. `<install-root>/methodologies/<bundle_id>/bundle.md` — install-shipped default fallback (freeform, test-bundle).

The third arm is what makes a user-owned repo's discipline travel with the repo: a fresh clone of a repo carrying `.throughline/bundle.md` resolves to that bundle without the user manually setting `bundle_path` after binding. Arm 1 retains precedence so an explicitly-configured external path (e.g. a shared bundle directory across multiple repos) keeps overriding the in-repo file.

Out of scope for this decision: writing into `.throughline/` from Throughline (bootstrap-style imports, audit logs, item exports) is not part of `.throughline/`'s contract — that surface lives in later phases and uses different files outside `.throughline/`. The schema doc documents this explicitly.

### Context
The bundle externalisation refactor (handover `2026-05-16-bundle-externalisation-refactor.md`) removed user-owned bundles from Throughline's repo so the public codebase stays methodology-neutral. That convention bound Throughline's repo, not the user's. A user repo electing to keep its own discipline alongside its own code is a different concern — and is the path that makes clone-and-go work for any future user.

### Rationale
A repo-local convention with a fixed directory name lets a freshly-cloned repo carry enough configuration to bind to Throughline on first run without bespoke setup. Putting it at `.throughline/` (dotted, single name) matches established conventions (`.github/`, `.vscode/`) and signals tooling-config-not-source. The three-arm resolution preserves the existing two arms unchanged — externalisation (C-D14) and install-fallback (C-D3) — and inserts the new arm in the natural priority slot between them.

### Implications
A repo with `.throughline/bundle.md` and `bundle_path` set sees `bundle_path` win — explicit configuration overrides the carve-out, by design. A repo carrying `.throughline/bundle.md` whose bound `bundle_id` does not match the in-repo bundle's declared id is a project-create / project-update validation error (`bundle_id_mismatch`) so silent divergence cannot accrue. Implementation shape lives in C-D19.

**Amendment (2026-05-30, audit-fix Phase B slice 4).** The canonical way to resolve a project's bundle is `resolveProjectBundle(registry, project)` (`packages/backend/src/methodology/loader.ts`), which threads the project's `repo_path` into the resolver. This exists because four call sites (`reconcile/service.ts`, `routes/communication-model.ts` ×2, `dump-zone/service.ts`) had been calling `registry.resolveBundle(project.bundle_id, project.bundle_path)` **by hand and omitting `repo_path`** — which silently skipped arm 2 and fell through to the install-shipped default, resolving the wrong bundle for clone-and-go repos (audit findings F1-01 / S5-02). Because the helper takes the project rather than loose fields, `repo_path` is **structurally non-omittable**: no call site can skip arm 2 without bypassing the helper entirely. New project→bundle resolution goes through `resolveProjectBundle`; calling `registry.resolveBundle(...)` directly with a project's fields is the anti-pattern this amendment closes. (Regression: `test/loader.test.ts` "resolveProjectBundle threads project.repo_path …".)

---

## T-D52 — `throughline init` requires the running backend; CLI does not write the datastore directly

- **Date:** 2026-05-25
- **Status:** active — to be implemented in Phase 19, resolves WN-clone-Q4
- **Sections affected:** 7.26, 10

### Decision
The `throughline init` CLI subcommand has a single write path: existing HTTP endpoints against the running backend (project create / update, secrets, future bootstrap). It does not open the SQLite datastore directly, does not import any backend modules that do, and does not embed schema knowledge.

On invocation the CLI probes `GET /health` against the configured local-loopback port. On any probe failure (connection refused, timeout, non-2xx) the CLI prints exactly:

> `Start the backend first: pnpm --filter @throughline/backend start`

and exits non-zero. On probe success the CLI reads the repo's `.throughline/project.json`, auto-detects `github_owner` / `github_repo` from the git remote if absent, and issues the bootstrap calls against the backend.

Out of scope for this decision: a `--start-backend` flag that would spawn the backend process itself is polish and is deferred — adding it later does not change this decision's shape, because the auto-spawn would only stand in for the manual `pnpm` command without altering the single-write-path invariant.

### Context
The clone-and-go shape (T-D51) requires a CLI surface for the first-touch bind step. The temptation to let the CLI write SQLite directly — "the backend is just a Node process, the CLI can be too" — would create a second write path that has to track every schema change. Discipline-drift between the two paths is the failure mode this avoids.

### Rationale
A single write path means every project carrying a Throughline binding lands through one set of validators (the HTTP endpoint handlers). A schema migration touches one writer; the CLI does not need to know SQLite, migration versions, or any backend-internal type. The `/health` probe with a fixed error string keeps the failure mode legible to the user: the next instruction is on screen, copy-paste runnable.

### Implications
The CLI subcommand lives in the backend package (`packages/backend/src/cli/`), so the backend's HTTP client is in-process — no extra dependency. The `init` flow's audit-log entries are written by the backend handlers it calls, not by the CLI; `actor` reflects the handler, with the CLI's invocation surfaced via the `trigger_context_json` shape the backend already supports (T-D24, T-D36). Implementation shape lives in C-D19.

---

## T-D53 — Bootstrap import file shape: structured per-source rows for items, sessions, and decision/note library entries; bundle-aware validation; secrets and runtime state excluded

- **Date:** 2026-05-25
- **Status:** active — to be implemented in Phase 20, resolves WN-clone-Q2
- **Sections affected:** 7.27, 14

### Decision
The bootstrap import file is a structured artifact produced by Phase 21's Claude Code session against a user-owned repo's existing state (handover files, DECISIONS.md, ROADMAP.md, CHECKLIST.md and equivalents). It carries three entity types — items (work units), sessions (one per discovered handover), and library entries (each DECISIONS-style anchor tagged `decision`, narrative notes tagged otherwise). Every row carries a deterministic `bootstrap_id` (T-D54) and names its `source_type` (`decision`, `roadmap`, `handover`, `checklist`, `override`) so re-import can resolve identity per type.

Required fields per row: `bootstrap_id`, `source_type`, plus entity-type-specific identity (`title` + `type` + `status` for items; `name` + optional `branch_ref` for sessions; `type` + `title` + `body` + `tags` for library entries). Optional fields are entity-shaped and validated against existing entity schemas. Bundle-awareness validation is mandatory: item `type` values must appear in the bound bundle's `ItemPolicy.types`; status values must appear in the bound bundle's `status_lifecycles` for that type; library tags including `decision` are accepted unconditionally. A bootstrap file landing against a project with no bundle bound is rejected up-front with a clear error pointing the user at clone-and-go init (§7.26).

Explicitly excluded from the bootstrap file: API keys and secrets (T-D4 — stay in backend config, never on disk under the repo), audit log (rebuilt from re-import as `bootstrap_import` / `bootstrap_reimport` events per T-D54), embeddings and intelligence caches (regenerated lazily through existing indexing paths), telemetry and prompt fingerprints (per-install cache layer), settings, gate-firing history, methodology bindings (those come from clone-and-go init per T-D51 / T-D52).

### Context
WN-clone-Q2 surfaced the question of how decisions land in the bootstrap import (as `library_entries` of type `note` tagged `decision`, not items). The broader file-shape question came up alongside it: what entity types the file carries, what fields are required per row, how it validates against a project's bound methodology bundle, and what must stay out of it so secrets and runtime state never live on disk under a user-owned repo. Phase 20 builds the consumer side of the bootstrap pipeline; the producer (Phase 21's Claude Code session) needs a fixed target shape to emit against, so the file's contract is pinned here ahead of either side's build.

### Rationale
DECISIONS-style anchored rationale (`T-D…`, `WN-…`, equivalents in user bundles) is imported as library entries of type `note` tagged `decision`, never as items (WN-clone-Q2). Items are work units with status lifecycles; decisions are rationale records with anchor IDs. Conflating the two would inflate work counts and corrupt every items-based metric.

### Implications
Phase 21's Claude Code invocation is the *producer* of this file; bootstrap ingest is the *consumer* — the two are separately phased and independently testable. Implementation in C-D20.

---

## T-D54 — Bootstrap re-run is idempotent upsert on `(project_id, bootstrap_id)`; three row states; bootstrap_id derived per source type with a universal `@bootstrap-id:` override

- **Date:** 2026-05-25
- **Status:** active — to be implemented in Phase 20, resolves WN-clone-Q3
- **Sections affected:** 7.27, 14

### Decision
Bundles evolve post-launch; users will re-bootstrap as their methodology firms up. Every row in the bootstrap import file (T-D53) carries a deterministic `bootstrap_id` and re-import upserts on `(project_id, bootstrap_id)`. The format is `<source-type>:<stable-key>` — the prefix prevents accidental cross-source collision and is human-readable for debugging. Each affected entity table (`items`, `sessions`, `library_entries`) gains a nullable `bootstrap_id TEXT` column with a unique partial index on `(project_id, bootstrap_id)` where non-null. Existing creation paths (manual `POST /api/projects/:id/items`, manual library/session creation, md-ingest at `(project_id, source_path)`) are unaffected — only bootstrap-imported rows carry a `bootstrap_id`.

Derivation rules per source type:

- `decision:<anchor-id>` — DECISIONS-style anchored rationale (`T-D…`, `WN-…`, equivalents in user bundles). Anchor ID is the stable key. Body edits and section moves preserve identity; anchor renames create new identity, which is correct because renames are semantically meaningful.
- `roadmap:phase-<n>` — ROADMAP phase entries. Phase number is the stable key.
- `handover:<filename>` — One identity per handover file. Where the bootstrap parser detects in-file session anchors, `handover:<filename>#<in-file-anchor>` disambiguates sub-sessions. Handover filenames are dated, append-only artifacts in practice; renames are rare and treated as new identity.
- `checklist:<sha256-16-of-normalized-text>` — Normalized text is lowercase, whitespace collapsed, trailing punctuation stripped. Casing/whitespace/punctuation typo-fixes preserve identity for free; word-level semantic edits create new identity, and the stale-flag (below) surfaces the prior row for user ack.
- `override:<user-slug>` — Any source row may carry `<!-- @bootstrap-id: my-slug -->`; the override wins over every derivation rule.

`@bootstrap-id:` is the universal escape hatch for any case where the natural key shifts — CHECKLIST row word-level edits, ROADMAP phase renumbering, handover file renames or splits, anchor renames that should preserve identity. Costs ~10 lines in the parser; the user is expected to add overrides pre-emptively before a refactor they know will move natural keys, or to ack-stale the orphaned rows afterward.

Hash convention: sha256, 16-char hex prefix, unsalted — distinct from the privacy-salted `promptFingerprint` (T-D24) and the change-detection `contentHash` / `hashContent`. Three named functions, three named purposes; the new `bootstrapId` helper lives in `packages/backend/src/bootstrap/derive-id.ts` (C-D20) with one resolver per source type. Two rows resolving to the same `bootstrap_id` in a single import file are rejected up-front with an error citing both source rows — the parser never silently collapses duplicates.

Three row states at import time:

1. **New** — `bootstrap_id` absent in `(project_id, bootstrap_id)`. Insert. Audit `bootstrap_import` with `source_type` and `bootstrap_id` in `trigger_context`.
2. **Existing, no user edits since last import** — `bootstrap_id` present, and no non-`bootstrap_*` audit entries touch this entity since the prior `bootstrap_import` / `bootstrap_reimport`. Update in place. Audit `bootstrap_reimport`.
3. **Existing, user edits since last import** — `bootstrap_id` present, and the user has touched the entity since the prior import. Do not auto-overwrite. Queue a per-row conflict in the review queue (C-D20). User picks `keep_mine` (drop incoming), `take_theirs` (overwrite, audit trail preserved), or `merge_fields` (per-field choice).

Rows whose `bootstrap_id` appeared in a prior import but is absent from the current one are flagged `bootstrap_stale=true` on the entity; never auto-deleted. Stale entities surface in the review queue with `keep` / `archive` / `delete` actions.

### Context
WN-clone-Q3 surfaced the idempotent-upsert model for bootstrap re-run — `bootstrap_id`-keyed upsert with three row states and stale-flagging on rows that drop out — but explicitly deferred the per-source-type derivation rules and the universal override mechanism to Phase 20 docs (this session). Phase 20's build needs the derivation rules per source type, the override syntax, and the row-state classifier pinned before the schema migration and the import endpoint can be drafted.

### Rationale
The per-source-type prefix in `bootstrap_id` (`<source-type>:<stable-key>`) prevents accidental cross-source collision and stays human-readable for debugging. Pinning identity per source type means a CHECKLIST text edit and a ROADMAP phase renumbering each get a derivation rule that fits their semantics; the universal `@bootstrap-id:` override is the explicit escape hatch for any case where the natural key shifts. The three named hash functions (`promptFingerprint` salted for privacy, `contentHash` unsalted for change detection, `bootstrapId` unsalted for identity) read as siblings in the codebase precisely because each does one thing.

### Implications
Implementation in C-D20.

---

## T-D55 — Bootstrap prompt is a repo-owned generic template at `packages/backend/src/bootstrap/prompt-template.md`; bundle-aware via runtime bundle-read, not Throughline-side templating

- **Date:** 2026-05-26
- **Status:** active — to be implemented in Phase 21, resolves WN-clone-Q5
- **Sections affected:** 7.28, 14

### Decision
The bootstrap prompt template is a single repo-owned markdown file at `packages/backend/src/bootstrap/prompt-template.md`. The Throughline repo ships and maintains exactly one prompt template; per-bundle prompts are explicitly rejected — they would shift maintenance burden onto every external bundle author for a feature most users run once (WN-clone-Q5).

The template is generic. Bundle-awareness is achieved at run time by the prompt instructing Claude Code to read the project's resolved bundle file directly (at the path Throughline supplies as part of the prompt's parameter block) and walk its §2–§11 itself. The template does NOT carry `{{section-N}}`-style placeholders, and Throughline does NOT run a bundle-section extractor that inlines bundle sections into the prompt; the bundle grammar (T-D49 and predecessors) is plain h2/h3 markdown that an LLM with file-read access walks unaided. Mirrors the dump-zone extractor's per-bundle parameter-injection posture (`packages/backend/src/dump-zone/extractor.ts`), scaled to a larger payload where read-the-file beats extract-and-inline.

The prompt template carries:

- A preamble describing the bootstrap task (produce a structured import file matching the T-D53 shape against the bound bundle's policy).
- Instructions to read the bound bundle file and apply its §2 project layout, §5 lifecycle, §6 communication-model grammar, §7 items policy, etc. as extraction policy.
- The bootstrap-id derivation rules per source type (T-D54: `decision:<anchor-id>`, `roadmap:phase-<n>`, `handover:<filename>`, `checklist:<sha256-16-of-normalized-text>`, `override:<user-slug>`) and the `<!-- @bootstrap-id: my-slug -->` override convention.
- The bootstrap import file's required and optional fields per row, per entity type (T-D53), and the explicit exclusions (secrets per T-D4, audit history, embeddings, settings, methodology bindings).
- Graceful-degradation guidance: bundles without certain sections, repos without ROADMAP.md / CHECKLIST.md, handover directories absent — surface as fewer rows, not failure (informed by WN-clone-Q7).

The only Throughline-side templating is a small fixed parameter block prepended to the template body at render time: the resolved bundle file path (via the existing three-arm resolver in `packages/backend/src/methodology/loader.ts` per C-D14 / C-D19), the canonical repo root, and the declared output file path (`.throughline/bootstrap-output.json` per T-D56). No general-purpose templating engine is introduced; the parameter block is a fixed-shape header rendered by string-substitution.

### Context
WN-clone-Q5 already settled the high-level shape — one prompt, bundle parameterises at run time, mirroring the dump-zone extractor pattern. The implementation surfaces — where the file lives in the repo, how the bundle is incorporated, what specifically the template carries vs what it pushes onto Claude Code's bundle-reading — were deferred to this phase. Pinning those choices ahead of the Phase 21 build prevents the prompt template landing in an arbitrary location and prevents Throughline shipping a templating engine the spec does not require.

### Rationale
- **Co-located with bootstrap code.** The prompt template is a runtime artefact loaded by Throughline at init time. `packages/backend/src/bootstrap/derive-id.ts` (per C-D20) already lives at this path; co-location follows Throughline's pattern of placing resource files next to the code that loads them — the bundle-parser modules adjacent to their grammar code is the nearest precedent.
- **Not in `docs/_meta/throughline/prompts/`.** That directory is ephemeral by convention — session prompts self-delete after each session, and the directory does not exist on main between sessions. A durable template alongside ephemeral session prompts would mix two lifecycles in one directory and dilute the "this directory is for session prompts that get cleaned up" signal.
- **Runtime bundle-read over Throughline-side section extraction.** The bundle's narrative sections (§2 project layout, §5 lifecycle, §6 communication model, §7 items) are many KB of prose. Templating those in would mean Throughline ships a bundle-section extractor for a single consumer, and the prompt template churns whenever the bundle grammar evolves. Pointing Claude Code at the file is simpler and stable; the bundle grammar is plain markdown that an LLM with file access walks unaided.
- **Fixed parameter header is the right templating dose.** The bundle file path, repo root, and output file path vary per project and cannot be hard-coded into the template. Prepending them as a small fixed-shape parameter block at render time is the minimum templating that delivers the use case without growing a general-purpose engine.

### Implications
- Implementation surfaces (the template loader, the render endpoint, the parameter-block injection point, the chokidar watcher, the archive / quarantine convention, the SettingsView init block) live in C-D21.
- Bundle evolution does not churn the prompt template — only the bundle file does. The template's only coupling to the bundle is the instruction "read the bundle at this path and apply its sections as extraction policy."
- A future per-bundle prompt override (a bundle author wishing to ship their own prompt template) is explicitly out of scope — it would re-introduce the maintenance burden WN-clone-Q5 rejected. If a future user need surfaces, it lands as a separate decision.
- The template ships under version control like any other code artefact; edits to the prompt are reviewable diffs against `packages/backend/src/bootstrap/prompt-template.md`.

---

## T-D56 — Claude Code invocation contract: user-driven invocation, Throughline watches `.throughline/bootstrap-output.json` via chokidar; subprocess-spawning explicitly deferred

- **Date:** 2026-05-26
- **Status:** active — to be implemented in Phase 21
- **Sections affected:** 7.28, 14

### Decision
Throughline does not spawn Claude Code as a subprocess. The invocation contract between Throughline and Claude Code is file-mediated: Throughline writes the rendered prompt to a known path under the project's `.throughline/` directory and declares the expected output path in the prompt's parameter block; the user invokes Claude Code against the prompt in their normal environment; Claude Code writes the bootstrap import file to the declared output path; Throughline detects the file via a chokidar watcher and hands it to the Phase 20 ingest endpoint.

Concretely:

- Throughline's render endpoint (C-D21) renders the prompt template (T-D55) against the project's resolved bundle and writes `<repo_path>/.throughline/bootstrap-prompt.md`. The expected output path `<repo_path>/.throughline/bootstrap-output.json` is declared in the prompt's parameter block; Claude Code is instructed to write its result there.
- The user invokes Claude Code in their normal CLI / IDE environment, passing it the rendered prompt — the prompt itself includes the read-the-bundle instructions and the write-here output path.
- A backend-side chokidar watcher (refcounted per project, mirroring the existing `packages/backend/src/inbox/watcher.ts` and `packages/backend/src/md-ingest/watcher.ts` idiom) detects `bootstrap-output.json` write completion and routes the file to the Phase 20 ingest path (`POST /api/projects/:id/import` per C-D20).
- After successful ingest, the file is archived to `.throughline/bootstrap-archive/<timestamp>-bootstrap-output.json`, mirroring the inbox worker's archive-on-success pattern (`packages/backend/src/inbox/worker.ts`). Failures move the file to `.throughline/bootstrap-quarantine/<timestamp>-bootstrap-output.json` with a sibling `<timestamp>-bootstrap-output.error.json` carrying the validation error so the user can fix and re-run.
- Re-bootstrap is the same flow re-run: regenerating the rendered prompt is a no-op for identity (the template is unchanged); writing a new `bootstrap-output.json` triggers the same watcher path; T-D54's idempotent upsert handles row classification across new / reimported / conflicted / stale states.

Subprocess-spawning Claude Code from the backend is explicitly deferred. Every existing subprocess invocation in the backend — `packages/backend/src/github/local-git.ts`, `packages/backend/src/semble/client.ts`, `packages/backend/src/methodology/gates/checks.ts`, `packages/backend/src/methodology/gates/hook-installer.ts` — targets short-running deterministic-output tools with one-shot `execFile` + `promisify`. Claude Code is a long-running interactive agent with the user's auth context, tool-use approvals, and streaming output that does not fit this idiom; bridging it would be a phase of work in its own right and is not required for the v1 invocation contract.

Manual paste is the floor and is NOT the contract — the file-watch path is the contract, and clone-and-go's UX cost is exactly one extra command for the user to run.

### Context
The producer side of the bootstrap pipeline — Phase 21's "Claude Code emits an import file against a user-owned repo" — needs a fixed invocation contract before Throughline's init flow can render a prompt with a known output path, and before the prompt itself can instruct Claude Code where to write. WN-clone-Q5 settled the prompt shape (one generic template, bundle-aware at run time) but did not address invocation; this anchor settles the invocation half of the producer side. No prior working note covers invocation, so T-D56 stands on its own without a `resolves` line.

### Rationale
- **Direct precedent in the repo.** `packages/backend/src/inbox/watcher.ts` + `packages/backend/src/inbox/worker.ts` is the existing "Claude Code writes a file, Throughline ingests" pattern — already in production for transcript ingestion via the `~/.throughline-inbox` directory. Bootstrap-output is the same shape with a different output path and a different downstream consumer (Phase 20's ingest endpoint instead of the transcript router).
- **User's Claude Code, not Throughline's.** The user's local Claude Code install carries their auth, their model entitlements, their tool permissions. Subprocess-spawning from the backend would either inherit the user's environment fragilely or require re-doing auth on the backend side. File-mediated handoff respects the boundary cleanly.
- **Bootstrap runs rarely.** Bootstrap fires once per fresh bind, occasionally on re-bootstrap when the bundle evolves. The UX gap between "click a button" and "run one command in your normal Claude Code environment" is small relative to the engineering cost of bridging it.
- **`.throughline/` is the right surface.** Per T-D51, `.throughline/` carries config; secrets stay out (T-D4). Bootstrap prompt and output land in `.throughline/` because they are init-time transient artefacts adjacent to project configuration — the rendered prompt is regenerated each invocation, and the output file is archived after ingest.

### Implications
- The `.throughline/` directory's contract extends to carry bootstrap-init transient files (`bootstrap-prompt.md`, `bootstrap-output.json`, `bootstrap-archive/`, `bootstrap-quarantine/`). The `docs/.throughline-schema.md` schema doc gains a transient-files section documenting these as Throughline-managed (not user-authored), with a Throughline-managed `.throughline/.gitignore` so transient ingest state never enters the user's git history.
- The watcher refcounts per project (mirroring the existing `inbox/watcher.ts` and `md-ingest/watcher.ts` idiom). Watcher lifecycle ties to project lifecycle: registered on render-endpoint first call for a project, unregistered on project delete.
- Subprocess-spawning Claude Code remains a future polish path; should Throughline later grow that infrastructure, T-D56 is amended, not contradicted — the file-watch contract is the v1 floor.
- Implementation surfaces (the render endpoint, the watcher, the worker, the archive / quarantine convention, the init UX block) live in C-D21.

---

## T-D57 — Discipline-drift scanners do not auto-run on bind for projects imported via bootstrap; SettingsView gains a "Run discipline scan" trigger

- **Date:** 2026-05-26
- **Status:** active — to be implemented in Phase 22, resolves WN-clone-Q6
- **Sections affected:** 7.14, 14

### Decision
Discipline-drift scanners do not auto-run on bind for projects that were imported via the bootstrap pipeline (T-D53 / T-D54 / C-D20). Such projects surface in SettingsView with a "Run discipline scan" trigger that the user invokes once they have triaged the bootstrap-imported items. Periodic-review scheduling is gated on the first user-invoked scan: until that scan completes, scheduled re-scans are suppressed for the project. On-bind discipline-scan behaviour for ongoing (non-bootstrapped) projects is unchanged.

### Context
Bootstrap brings months — sometimes years — of project history into Throughline in a single transaction: DECISIONS anchors, ROADMAP phases, CHECKLIST items, handover directories. The bootstrap-imported rows are what the user wants to look at first. Discipline-drift scanners running automatically against a months-old repo on bind would produce hundreds of signals — stale CHECKLIST ticks, handovers that no longer match the current bundle's discipline declarations, drifted anchor references — and bury the imported items behind a wall of drift-inbox noise on day one of adoption. The clone-and-go bootstrap posture (WN-clone-Q7) explicitly accepts that day-one state is partial-knowledge: the user has imported their history but hasn't yet decided what they want Throughline to draw attention to. Auto-run-on-bind contradicts that posture.

### Rationale
- **Trigger ownership belongs to the user, not the bind event.** Auto-run-on-bind is appropriate when a project's discipline state is known to be current (ongoing projects whose drift was triaged yesterday). For bootstrapped projects the discipline state is unknown — the bundle may have moved since the imported sources were authored, or the imported sources may pre-date the project's adoption of the bundle entirely. Gating the first scan behind explicit user action ensures the drift inbox is meaningful from the moment the user looks at it.
- **Periodic-review gating prevents background re-flooding.** Without gating periodic-review on the first user-invoked scan, the next periodic-review tick would produce the same flood the auto-run would have caused. Tying the periodic-review enable to the first user-invoked scan keeps the bootstrap-day-one inbox quiet without permanently disabling scanning for bootstrapped projects.
- **Non-bootstrapped projects keep current behaviour.** On-bind discipline-scan behaviour for ongoing (non-bootstrapped) projects is unchanged — those projects have a known-current discipline state and benefit from immediate scanning. T-D57 does not alter the existing scanner behaviour; it only gates the *first scan* for bootstrap-imported projects.
- **One trigger, two surfaces.** The "Run discipline scan" trigger in SettingsView serves both the bootstrap-day-one case (initial scan, prominent affordance) and the user-driven re-scan case (any project, any time; less prominent affordance once the project has completed its first scan). One UX surface, two contexts.

### Implications
- The project record gains discipline-scan state tracking with three distinct states: **pre-scan** (bootstrap default, applied to projects created via the bootstrap pipeline), **running** (a scan is in flight), and **complete** (with a last-run timestamp tracked alongside). The exact column shape — enum + nullable timestamp, single discriminated value, or other — is an implementation-shape choice for the build session; the requirement is the three-state distinction and the last-run timestamp. Ongoing (non-bootstrapped) projects skip the pre-scan state.
- The bootstrap import pipeline (Phase 20, per T-D53 / T-D54 / C-D20) sets the project's discipline-scan state to pre-scan on the first successful bootstrap import for the project. (Phase 22 spec-author-confirmed amendment 2026-05-28: original wording said "as part of project creation"; Phase 20's `importBootstrap` upserts into projects created via the standard create-project flow rather than creating projects itself, so the activation point is the first successful import, not creation. Idempotent: re-imports do not overwrite an existing state.)
- SettingsView renders the "Run discipline scan" trigger conditionally: prominently when the project is in pre-scan; as a less prominent re-scan affordance once the project has reached complete.
- Periodic-review scheduling reads the project's discipline-scan state and skips bootstrapped projects until they reach complete. From the first user-invoked scan onward, periodic-review behaves identically to ongoing projects.
- **No companion C-D anchor for Phase 22.** Phase 22 is small enough (Sizing: small in ROADMAP) that the implementation-shape detail lives directly in T-D57's Implications rather than a separate C-D anchor. The other producer-side phases (19, 20, 21) each carry a companion C-D (C-D19, C-D20, C-D21) because their build surfaces are larger and benefit from a separate implementation-rationale layer; Phase 22 does not.
- Existing discipline-drift scanners, the drift inbox, the audit log, and on-bind behaviour for non-bootstrapped projects are unchanged. This anchor only changes the *activation* of the first scan for bootstrap-imported projects, not the scan internals.

---

## T-D58 — Shared domain-error hierarchy: errors carry their canonical HTTP status; routes never decide it

- **Date:** 2026-05-30
- **Status:** active — audit-fix Phase B (slice 1 mints the hierarchy + consolidates the three NotFound families; slice 2 migrates the remaining backend error classes onto it; slice 3 wires the central handler per C-D23)
- **Sections affected:** 3, 14

### Decision
Domain errors are defined once in `@throughline/shared` (`packages/shared/src/errors.ts`) under a common abstract base `DomainError` that carries the error's canonical HTTP `statusCode`, a stable string `code`, and optional structured `details`. A `NotFoundError` subclass fixes `statusCode: 404`; concrete errors (`ProjectNotFoundError`, `ItemNotFoundError`, `SessionNotFoundError`, and — across slice 2 — the rest of the backend's HTTP-mapped domain errors) extend the appropriate base and set their canonical `code`. The HTTP status for a domain error is a property of the error class, not a decision re-made in each route's catch block. A central Fastify error handler (C-D23) reads `statusCode`/`code`/`details` off any thrown `DomainError` and emits the canonical response; routes stop hand-rolling status mapping.

### Context
The backend had accreted 17 identical `ProjectNotFoundError` definitions, 5 `ItemNotFoundError`, and 2 `SessionNotFoundError` — one per module — plus ~50 other domain-error classes, none carrying a status code. Status was assigned ad hoc in 63 hand-rolled try/catch blocks across 20 route files. The same error mapped to different HTTP codes in different routes (`ItemNotFoundError` → 404 in most routes but 400 in `items/routes.ts`; audit SF6-09), and `intelligence/routes.ts` imported six *different* `ProjectNotFoundError` classes under aliases to `instanceof`-check them in a single handler. The duplication made one `instanceof` impossible and let status-code drift accrue silently.

### Rationale
- **Status on the class makes drift structurally impossible.** When the canonical code lives on the error, two routes throwing the same error cannot return different statuses — one source of truth. SF6-09 cannot recur.
- **One definition, one identity.** A single shared class means `instanceof` works across every consumer; the six-alias chain in `intelligence/routes.ts` collapses to one check, and future call sites cannot accidentally reference a different module's copy.
- **The central handler becomes trivial and uniform.** Reading `statusCode`/`code`/`details` off the error replaces 63 bespoke catch blocks with one handler and guarantees a single response shape (C-D23).
- **Shared, not backend-local.** Housing the hierarchy in `@throughline/shared` lets the frontend reference the same `code` values and error-response type (the latter lands in slice 3 — partial progress on the wire-contract gap the green-gate reckoning names).

### Implications
- `packages/shared/src/errors.ts` is the single home for HTTP-mapped domain errors; new such errors are defined there (or extend the shared base) rather than redeclared per module.
- The `code` string is a stable wire value (e.g. `project_not_found`); renaming one is a contract change.
- Message text is normalized at consolidation: the former per-module copies were byte-identical except two cosmetic variants (`item … not found in project`, `session … not found in project`) that collapse to the canonical `… not found`. No test or contract asserted the variant text.
- Errors that are not HTTP-mapped (internal/programmer errors) do not extend `DomainError`; the central handler rethrows them to Fastify's default 500 path.
- Implemented across the Phase B chain: slice 1 (this) mints the hierarchy + the three NotFound families; slice 2 migrates the remaining ~50 backend error classes onto the base with canonical codes; slice 3 installs the central handler (C-D23) and deletes the hand-rolled blocks.

---

## T-D59 — Wire-contract response types live in `@throughline/shared`; the client/server contract is verified, not cast

- **Date:** 2026-05-30
- **Status:** active — audit-fix Phase D (slice D-1 mints this and closes the green-gate Gap 2)
- **Sections affected:** 3, 14

### Decision
HTTP response shapes are declared once in `@throughline/shared` (`packages/shared/src/wire.ts`) as named envelope types — `MethodologiesResponse`, `ItemsResponse`, `ItemResponse`, `PolicyResponse`, `SessionsResponse`, `SessionResponse`, … — rather than re-declared frontend-local or written inline at each `jsonFetch` call site. The backend route handlers annotate their success payload against the shared type (so `tsc` fails if a handler stops producing the declared shape), the frontend `jsonFetch<T>` targets the same shared type, and a wire-contract test (`packages/backend/test/wire-contract.test.ts`) injects each endpoint and asserts the running backend emits the declared shape. The contract is thus verified at compile time on both sides and at runtime by the test — not trusted via an unvalidated `as T` cast at the fetch boundary.

### Context
Audit-1 finding I1 (the green-gate reckoning, `AUTHORING_DISCIPLINE.md`) named two gaps between what the gate runs and what it verifies. Gap 1 (backend `test/**` excluded from typecheck) closed in Phase A. Gap 2: response shapes were partly frontend-local (the `MethodologySummary` interface lived in `packages/frontend/src/api.ts`) and `jsonFetch<T>(…) as T` cast the payload unchecked — `typecheck` proved the frontend was self-consistent with its *assumptions* about the wire, not that those assumptions matched what the backend sent. Phase B slice 3 moved the error-response type (`ErrorResponse`) to shared as partial progress; this anchor completes the success path.

### Rationale
- **One definition per endpoint.** Both sides import the same type, so a backend shape change is a compile error on the backend and a type mismatch on the frontend — not a silent runtime surprise.
- **The test closes the runtime half.** Compile-time agreement only proves the two sides agree with *each other's types*; the wire-contract test proves the backend's actual JSON matches, which is what the `as T` cast had been assuming for free.
- **Bounded surface, extensible pattern.** D-1 moves the one frontend-local named type (`MethodologySummary`) and the core entity-read envelopes (the endpoints the Phase C data hooks consume); new endpoints follow the same shared-envelope + annotated-handler + contract-test pattern.

### Implications
- New response shapes are named types in `packages/shared/src/wire.ts`; backend handlers annotate their success payload against them (via a typed local `const` where the handler also returns a `reply.code(...).send(...)` error branch), and the frontend `jsonFetch` targets them.
- `jsonFetch<T>` still performs a structural cast, but `T` is now a shared, test-verified contract — the cast is checked by the wire-contract test rather than taken on faith.
- The wire-contract test is extended whenever a new endpoint's envelope is added to `wire.ts`; a backend shape drift fails the test instead of reaching the client.
- Closes `AUTHORING_DISCIPLINE.md` green-gate **Gap 2**; with Gap 1 (Phase A) already closed, the gate's coverage now matches what its four-command shape implies (at compile time + via the contract test, not runtime omniscience over every payload).

---

## T-D60 — Refuse-rather-than-fallback: a degraded or failed capability is disclosed, never silently substituted

- **Date:** 2026-05-31
- **Status:** active — audit-fix Phase E (slice E1 mints this; closes SF3-01, SF3-02, S4-03 and retro-anchors the Phase-D SF2-01 drift-side precedent)
- **Sections affected:** 7.18, 8, 14
- **Reach:** broad — the entire dishonest-degradation pattern, not RAG alone. Minted once here and cited downstream by the capability-honesty slices (E2 AI/chat, E3 Semble, E4 notifier).

### Decision
When a capability is absent, degraded, or fails, Throughline **discloses that state** rather than passing a substitute result off as authoritative or rendering a failure as a healthy-empty result. Disclosure rides the **shared wire contract** (extending T-D59), not a side channel: the response type carries the capability state so the client cannot mistake degraded output for the real thing. Concretely for the text RAG substrate (C-D2): the local embedder reports its `kind` and `RagQueryResult.embedder` surfaces `'transformers'` (authoritative), `'fallback'` (capability-absent honest-distinct mode), `'unavailable'` (refused — embedder threw or produced no vector), or `null` (substrate does not embed). An embed-failure is therefore never indistinguishable from "nothing matched".

### Context
Audit-4 SF3-01 (Crit): `intelligence/embeddings.ts` pinned a SHA1 lexical fallback on import failure and `RagQueryResult` had no field disclosing it, so keyword-class citations were indistinguishable from real model retrieval. SF3-02 (High): `text-index.ts`'s `if (!qv) return []` collapsed an embed-failure into an honest-empty. S4-03 (Med): a runtime extractor throw after the backend resolved was unhandled and crashed the RAG call (the fallback only ever covered the *import* failure). The common thread is a trust violation the product implicitly forbids — a failure masquerading as a healthy or empty state.

### Rationale
- **The contract expresses truth (T-D59 kinship).** Putting the capability state on the shared response type means a backend that starts degrading is a typed, test-observable contract fact, not a silent runtime surprise — and the frontend can render the degraded state honestly.
- **Capability-gating stays; silent substitution goes.** Throughline already degrades gracefully when a dependency is absent (no key, no Semble, no model). T-D60 keeps that — but the degraded mode must announce itself. The line is *disclosed-degraded* (allowed) vs *undisclosed-substitute* (forbidden).
- **Refuse over fake.** An unexpected runtime failure is refused and surfaced, not papered over with a substitute, because a substitute the user cannot distinguish from the real answer is worse than an honest refusal.

### Implications
- **Supersedes audit-3's blessing of the silent C-D2 fallback.** T-D60 supersedes the Segment-7 "intentional-but-silent" sanction recorded in `audits/2026-05-28-audit-3-functional-correctness.md:81` ("C-D2 offline deterministic embedding fallback when `@xenova/transformers` absent") — a silent capability substitution is exactly the dishonest-degradation pattern T-D60 forbids.
- **Narrows C-D2.** C-D2's operative scope is narrowed to **capability-absent honest-distinct mode** only: the local-embedding substrate may operate as an *honestly-disclosed* capability-absent mode, never as an undisclosed SHA1 substitute. The offline *silent* fallback is removed. The narrowing is recorded here (T-D60 is its canonical home, per the SESSION_START anchor convention that supersession is recorded at the superseding anchor); C-D2's body is left intact as the superseded baseline with a one-line non-normative status pointer to this anchor.
- **Downstream slices cite this anchor.** E2 (AI/chat capability honesty), E3 (Semble degradation), and E4 (notifier capability) apply the same principle without re-minting.

---

## Working notes (proposals — not yet minted anchors)

Per `SESSION_START.md` (Anchor conventions): new anchors are not invented mid-session; candidate decisions are recorded here as working notes for the spec author to ratify, revise, or reject. These are surfaced, not silently resolved (spec-drift policy).

### WN-1b-a — Cross-session-mention graph edge has no data model

- **Date:** 2026-05-17
- **Raised by:** Pass 1b (GraphView)
- **Status:** implemented in Phase 17 (PR #30) — spec-author ratification of SPEC §7.11/§7.17 wording pending the separate follow-up clarification PR

**Observation.** SPEC §7.11 says graph edges show "parent-child, blocked-by, and **cross-session mentions**". The `Item` model (`packages/shared/src/items.ts`) had no mention/reference field — only `parent_id`, `blockers[]` (item-id refs, T-D8), and `session_ids[]` (multi-session membership). There was no captured "item A mentions item B" relation anywhere in the datastore.

**Decision deferred (Pass 1b).** Pass 1b shipped parent-child + blocked-by + "Show chains" and did **not** invent a cross-session edge. Candidate resolutions surfaced for the spec author: (1) add a mention/reference relation to the item model and capture it; (2) redefine the edge as shared-session co-membership (derivable from `session_ids`); (3) drop the clause from §7.11.

**Resolution (Phase 17).** The spec author chose option (1): build mentions as a first-class relation. As built — mentions are a derived projection of an item's description text via the explicit `@item:<id>` token (21-char nanoid), resolved to live same-project items (self-ref dropped) and stored in the `item_mentions` join table mirroring `item_blockers`, re-derived on every `items.create`/`items.update` with an unchanged-set short-circuit. Surfaced as `Item.mentions`, the `…/items/:itemId/links` endpoint (§7.17 "Linked items": parents/children/mentioning/mentioned), and a third non-structural GraphView edge kind (§7.11). The chosen reference convention (`@item:<id>`) and the §7.11/§7.17 wording are to be ratified into SPEC by the separate follow-up clarification PR — implementation was allowed to settle first; not silently edited. No new T-D/C-D anchor minted (SESSION_START anchor convention); CODE_SPEC §18 carries the implementation-shape detail. The §11 DoD bullet is satisfied by the functional item graph.

### WN-1b-b — Communication-model graph layer needs contract-source parsing

- **Date:** 2026-05-17
- **Raised by:** Pass 1b (GraphView)
- **Status:** resolved — implemented in Phase 18 (PR #31). Spec-author chose candidate (1): extend the §6 bundle grammar + parser (T-D49) and render the rule-level layer (T-D50). Instance-level edges from parsed contract files remain deferred to a later phase, by design.

**Observation.** SPEC §7.11 calls for "an additional graph layer [showing] primary-unit-level emit/consume edges based on the methodology's contract source" for bundles that declare a communication model. The bundle parser (`bundle-parser/communication-model.ts`) extracts only `edge_types` (e.g. `emit`, `consume`, `depends-on`) and leaves `routing_rules` / `producer_ownership_rules` empty — there is no parsed per-unit producer/consumer contract to draw edges from.

**Decision deferred (Pass 1b).** The layer was not built. Candidate resolutions surfaced: (1) extend the §6 bundle grammar + parser to capture per-unit routing/producer rules, then draw the layer; (2) approximate by aggregating item-level parent/blocker edges to `methodology_context.primary_unit_refs` (labelled an approximation, not contract-derived); (3) narrow §7.11's wording. Not a separate §11 DoD line.

**Resolution (Phase 18).** The spec author chose candidate (1) with a scope split: ratify the grammar and render the rule-level layer now; defer concrete-instance edges (parsed from contract files on disk) to a later phase. T-D49 ratifies the §6 grammar (tier vocabulary in §2, typed edge-type / tier-routing / producer-ownership sub-sections) and the bundle-declares / project-supplies split for contract paths and module-tier assignments. T-D50 ratifies the render semantics (rule-level expansion, mediated-edge two-arrow rendering, parse-and-carry for `invariant: violation`, coupled freshness with item state). C-D18 records the implementation shape (h3-walking parser, per-project view + settings endpoint, pure derivation, GraphView fourth-layer toggle). The Pass-1b CHECKLIST row flips here; SPEC §7.11 is updated functionally in this PR (not deferred to a separate ratification round, because the grammar+render scope is itself the spec answer the working note asked for).

### WN-1b-c — GraphView adopts design-handoff tokens scoped-only

- **Date:** 2026-05-17
- **Raised by:** Pass 1b (GraphView)
- **Status:** resolved — UI redesign Slice 1 (2026-05-17) reconciled the scoped tokens into the global system

**Observation.** The design handoff (`docs/_meta/throughline/mockups/.../README.md`) is a whole-app redesign (tokens, sidebar, settings, every screen) and contains **no graph screen** — graph is a `StubScreen` filed under "apply the new vocabulary as those phases get built out". Pass 1b is narrowly GraphView.

**Choice taken.** GraphView adopts the "Direction A · dark" tokens namespaced (`--gv-*`) and confined to `.graph-view`; the rest of the app keeps the current `styles.css`. Full design-system adoption (theme.css swap, `data-direction`/`data-theme`/`data-density`, settings keys, SSE hot-reload) is a separate, larger redesign pass and is out of Pass 1b scope. Recorded as implementation-shape per the spec-drift policy (CODE_SPEC-only); flagged here so the redesign pass reconciles the scoped tokens into the global system.

**Resolution (UI redesign, Slice 1).** The dedicated redesign pass landed. `styles.css` now carries the full handoff token system (3 directions × 2 themes × 3 densities); the `--gv-*` block in `views/graph/graph.css` was deleted and every rule repointed to the global tokens. GraphView now follows `data-direction`/`data-theme`/`data-density` like the rest of the app. No scoped token system remains; nothing further deferred.

### WN-clone-Q1 — Bundle location convention permits .throughline/bundle.md alongside externalised paths *(resolved 2026-05-24)*

The just-completed bundle externalisation moved bundles out of Throughline's own repo (handover `2026-05-16-bundle-externalisation-refactor.md`) so that user-owned discipline does not enter Throughline's public codebase. That convention binds Throughline's repo, not the user's. A user-owned repo that carries `.throughline/bundle.md` is keeping its own discipline alongside its own code — a different concern entirely. The loader gains a third resolution arm: `<bundle_path>/bundle.md` (explicit external, current C-D14), `<repo_path>/.throughline/bundle.md` (per-repo carve-out, new), `<install>/methodologies/<bundle_id>/bundle.md` (default fallback). Resolved by T-D51 (introduced 2026-05-25).

### WN-clone-Q2 — Bootstrap imports decisions as library notes, not items *(resolved 2026-05-24)*

DECISIONS.md anchored entries (T-Dn, WN-x, equivalents in user bundles) are rationale records with anchor IDs, not work units. Items are work units with status lifecycles per `ItemPolicy.status_lifecycles`. Treating decisions as items would inflate work counts, corrupt every items-based metric, and conflate two different audit surfaces. Bootstrap places decisions in `library_entries` (type `note`, tagged `decision`); the Items view stays clean. Resolved by T-D53 (introduced 2026-05-25).

### WN-clone-Q3 — Bootstrap is re-runnable via idempotent upsert keyed on deterministic bootstrap_id *(resolved 2026-05-24)*

Bundles evolve post-launch; users will re-bootstrap as their methodology firms up. The import file gives every row a stable `bootstrap_id` derived deterministically from source content (e.g. hash of `(handover-filename, anchor-id)` for sessions, `(CHECKLIST-row-text, line-number)` for items). Re-import upserts on `(project_id, bootstrap_id)`. Three row states at import: new (insert); existing with no user edits since last import (update in place, audit `bootstrap_reimport`); existing with user edits since last import (surface conflict in review queue — user picks `keep_mine` / `take_theirs` / `merge_fields`). Rows whose `bootstrap_id` no longer appears in a later import get flagged `bootstrap_stale=true`; never auto-deleted. Specific derivation rules per source type are spec-author work in Session 3 (Phase 20 docs); the high-level model lands here. Resolved by T-D54 (introduced 2026-05-25).

### WN-clone-Q4 — throughline init requires the backend running; CLI does not write SQLite directly *(resolved 2026-05-24)*

Two write paths (HTTP backend + CLI direct-to-SQLite) would share schema knowledge and drift. The CLI probes `/health` and prints `Start the backend first: pnpm --filter @throughline/backend start` on failure. Single write path through existing project / secrets / bootstrap endpoints. Optional QoL flag `--start-backend` to spawn the backend itself is polish, deferred. Resolved by T-D52 (introduced 2026-05-25).

### WN-clone-Q5 — Bootstrap prompt is generic and bundle-aware at run time, not per-bundle *(resolved 2026-05-24)*

Throughline already adapts at run time per bundle: dump-zone extractor injects `ItemPolicy.types` / `status_lifecycles` into the Sonnet prompt (`packages/backend/src/dump-zone/extractor.ts`); discipline-drift scanners instantiate per bundle rules; gate firings dispatch off bundle's §5 moments. Bootstrap follows the same pattern. Per-bundle prompts would shift maintenance burden onto every external bundle author — hostile UX for a feature most users run once. The Throughline repo ships and maintains one prompt; the bundle parameterises it (the prompt reads the bound bundle's §2–§11 as preamble and adapts extraction heuristics accordingly). Resolved by T-D55 (introduced 2026-05-26).

### WN-clone-Q6 — Discipline-drift scanners do not auto-run on bind; user invokes via "Run discipline scan" *(resolved 2026-05-24)*

Discipline-drift scanners running automatically on bind against a months-old repo would produce hundreds of signals, overwhelming the drift inbox on day one and burying the bootstrap-imported items the user actually wants to see. SettingsView gains a "Run discipline scan" trigger; periodic-review scheduling re-enables ongoing scanning post-bootstrap once the user has triaged what they care about. Existing on-bind behaviour for ongoing (non-bootstrapped) projects is unchanged. Resolved by T-D57 (introduced 2026-05-26).

### WN-clone-Q7 — Clone-and-go shapes every future adoption, not just the spec author's SiteMesh adoption *(design principle, 2026-05-24)*

The Throughline repo goes public; clone-and-go shapes every future adoption story. Designing for the spec author's immediate SiteMesh adoption (e.g. handover format hardcoded to this repo's template) is a local-optimum trap. The bootstrap prompt and `.throughline/` config convention work against any bundle-aware repo, with quality degrading gracefully when sources are absent (e.g. freeform bundles surface less; missing handover dirs are skipped; absent ROADMAP.md is acceptable). Informs design decisions across T-D51 through T-D57 (Phases 19–22) rather than resolving to a single anchor.
