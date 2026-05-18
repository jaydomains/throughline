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

## Working notes (proposals — not yet minted anchors)

Per `SESSION_START.md` (Anchor conventions): new anchors are not invented mid-session; candidate decisions are recorded here as working notes for the spec author to ratify, revise, or reject. These are surfaced, not silently resolved (spec-drift policy).

### WN-1b-a — Cross-session-mention graph edge has no data model

- **Date:** 2026-05-17
- **Raised by:** Pass 1b (GraphView)
- **Status:** open — spec-author decision required

**Observation.** SPEC §7.11 says graph edges show "parent-child, blocked-by, and **cross-session mentions**". The `Item` model (`packages/shared/src/items.ts`) has no mention/reference field — only `parent_id`, `blockers[]` (item-id refs, T-D8), and `session_ids[]` (multi-session membership). There is no captured "item A mentions item B" relation anywhere in the datastore.

**Decision deferred.** Pass 1b ships parent-child + blocked-by + "Show chains" (the two fully-supported edge types) and does **not** invent a cross-session edge. Candidate resolutions for the spec author: (1) add a mention/reference relation to the item model and capture it (capture surfaces / reconcile would need to populate it); (2) redefine the edge as shared-session co-membership (derivable today from `session_ids`); (3) drop the clause from §7.11. The §11 DoD bullet ("nine view modes functional and switchable") is satisfied without it.

### WN-1b-b — Communication-model graph layer needs contract-source parsing

- **Date:** 2026-05-17
- **Raised by:** Pass 1b (GraphView)
- **Status:** open — spec-author decision required

**Observation.** SPEC §7.11 calls for "an additional graph layer [showing] primary-unit-level emit/consume edges based on the methodology's contract source" for bundles that declare a communication model. The bundle parser (`bundle-parser/communication-model.ts`) extracts only `edge_types` (e.g. `emit`, `consume`, `depends-on`) and leaves `routing_rules` / `producer_ownership_rules` empty — there is no parsed per-unit producer/consumer contract to draw edges from.

**Decision deferred.** The layer is not built. Candidate resolutions: (1) extend the §6 bundle grammar + parser to capture per-unit routing/producer rules, then draw the layer; (2) approximate by aggregating item-level parent/blocker edges to `methodology_context.primary_unit_refs` (labelled an approximation, not contract-derived); (3) narrow §7.11's wording. Not a separate §11 DoD line.

### WN-1b-c — GraphView adopts design-handoff tokens scoped-only

- **Date:** 2026-05-17
- **Raised by:** Pass 1b (GraphView)
- **Status:** resolved — UI redesign Slice 1 (2026-05-17) reconciled the scoped tokens into the global system

**Observation.** The design handoff (`docs/_meta/throughline/mockups/.../README.md`) is a whole-app redesign (tokens, sidebar, settings, every screen) and contains **no graph screen** — graph is a `StubScreen` filed under "apply the new vocabulary as those phases get built out". Pass 1b is narrowly GraphView.

**Choice taken.** GraphView adopts the "Direction A · dark" tokens namespaced (`--gv-*`) and confined to `.graph-view`; the rest of the app keeps the current `styles.css`. Full design-system adoption (theme.css swap, `data-direction`/`data-theme`/`data-density`, settings keys, SSE hot-reload) is a separate, larger redesign pass and is out of Pass 1b scope. Recorded as implementation-shape per the spec-drift policy (CODE_SPEC-only); flagged here so the redesign pass reconciles the scoped tokens into the global system.

**Resolution (UI redesign, Slice 1).** The dedicated redesign pass landed. `styles.css` now carries the full handoff token system (3 directions × 2 themes × 3 densities); the `--gv-*` block in `views/graph/graph.css` was deleted and every rule repointed to the global tokens. GraphView now follows `data-direction`/`data-theme`/`data-density` like the rest of the app. No scoped token system remains; nothing further deferred.
