# Throughline v1 — Code Specification

This document is the **technical implementation spec** for Throughline v1. SPEC.md is authoritative for *what* and *why*; this file is authoritative for *how*. Where SPEC.md fixes a decision, this file derives from it. Where SPEC.md is silent or vague, this file is implementation-only and labelled as such.

If a SPEC.md statement turns out to be too vague to derive implementation from, the gap is surfaced under [Questions for the spec author](#questions-for-the-spec-author) at the end of this file rather than guessed.

## Anchor convention

Implementation-level decisions in this file use `C-D{n}` anchors (Code Decision). They are distinct from `T-D{n}` anchors in SPEC.md §14 (currently 60 entries; see `SPEC.md §14` for the canonical live index). C-D anchors are referenceable from code comments, PR descriptions, and other docs.

Any C-D may be promoted to a T-D later if it crosses the line into a functional decision; that promotion requires a SPEC.md §14 update.

---

## C-D1 — TypeScript end-to-end stack

- **Status:** active (implementation-only)
- **Cites:** T-D2, T-D3, T-D31

### Decision
- **Backend:** Node.js (LTS) with TypeScript. Web framework: Fastify. Process manager: native `node` invocation; login auto-start via `launchd` (macOS) / Task Scheduler (Windows) / systemd user unit (Linux).
- **Browser UI:** React with TypeScript. Build via Vite. Served by the backend as static assets at `http://127.0.0.1:<port>/`.
- **Datastore:** SQLite via `better-sqlite3`. Single file on disk, satisfying T-D3.
- **Backend ↔ browser transport:** local HTTP for request/response, Server-Sent Events for backend-pushed updates (drift signals appearing, gate firings, polling state changes, cost meter ticks). WebSocket reserved if SSE proves insufficient under load.
- **Process boundaries:** Throughline backend (long-lived) and browser; Semble runs only as a short-lived per-query child process (C-D17, T-D27). No other long-lived processes.

### Rationale
TypeScript on both ends shares types between API and UI without an IDL layer. Node.js has mature support for filesystem watching, short-lived child-process spawning (Semble per query, git), and HTTP servers. SQLite is the canonical single-file datastore. Fastify is fast, opinionated about plugins, and ergonomic for the kind of REST + SSE the backend needs.

Python was considered for the AI ecosystem but rejected because:
- The Anthropic SDK works equally well in TypeScript.
- The cross-process management of Semble + a frontend is simpler when the backend, frontend, and shared types all share a runtime.
- Single language reduces the Phase-1 install footprint.

### Implications
- One package manager (`pnpm`) at the repo root with workspaces for `backend`, `web`, and shared types.
- Local embeddings (T-D25 text substrate) use a TypeScript-friendly model — see C-D2.
- All file watching uses `chokidar`.
- Cross-platform OS notifications (T-D32) via `node-notifier` or platform-specific shell-outs in a single capability layer.

---

## C-D2 — Local embeddings via Transformers.js

- **Status:** active (implementation-only)
- **Cites:** T-D25, T-D31

> Narrowed-in-part by T-D60 (2026-05-31): capability-absent honest-distinct mode only; the silent SHA1 fallback is removed (the degraded embedder is now disclosed on `RagQueryResult.embedder`, never an undisclosed substitute). The narrowing's substance lives in T-D60 — see `DECISIONS.md` / `SPEC.md §14`; the C-D2 body below is the superseded baseline.

### Decision
The text RAG substrate (T-D25) uses local embeddings generated in-process by `@xenova/transformers` (Transformers.js) running a small sentence-embedding model (e.g., `all-MiniLM-L6-v2` ONNX). Embeddings stored in SQLite in a `text_embeddings` table; cosine similarity computed in-memory or via `sqlite-vss` if performance demands it.

### Rationale
T-D31 mandates the backend mediates external network calls. Sending notes and project docs to a remote embedding API would still satisfy T-D31 but adds cost and a privacy surface for personal data. Local embeddings keep the substrate fully offline.

### Implications
- First-launch model download (cached locally afterwards).
- Embedding generation is incremental on content edit (library entries, item descriptions, project doc files within ingested folders).
- No external API for the text substrate; code substrate still uses Semble per T-D27.

---

## C-D3 — Methodology bundles ship under install-root `methodologies/` as eleven-section markdown

- **Status:** active (implementation-only)
- **Cites:** T-D41, T-D42, T-D47

### Decision
Methodology bundles live at `<install-root>/methodologies/<bundle-id>/bundle.md`. The bundle file is a single markdown document with eleven H2 headings, one per bundle section, in the canonical order:

```
## 1. Identity
## 2. Project layout
## 3. Anchor system
## 4. Marker system
## 5. State machine
## 6. Communication model
## 7. Gating model
## 8. Review patterns
## 9. Templates
## 10. Validation rules
## 11. Authority hierarchy
```

Throughline ships only two bundles under `methodologies/`: `freeform/bundle.md` (the minimum-spec default, T-D47) and `test-bundle/bundle.md` (a generic, business-neutral grammar fixture for the runtime and tests). User-specific, business-internal bundles do **not** live in this repo — they are kept outside Throughline and bound per-project via `bundle_path` (C-D14), so the public repository ships no proprietary discipline.

### Rationale
Single-user, install-shipped bundles do not need a per-user authoring path in v1 (T-D41). Install-root `methodologies/` keeps bundles co-located with the artefact they configure and makes them a first-class deployable. A fixed H2-heading convention lets the parser dispatch each section to a typed handler without negotiating ordering or hierarchy. A single bundle.md per directory keeps reasoning about "what is a bundle" trivial; future bundles that want to split content across files can do so under their directory with the bundle.md as the index. **Spec ratification (Q5, SPEC §7.1).** SPEC §7.1 now formalises this eleven-section H2 grammar as the bundle-file contract and ratifies one `bundle.md` per directory as v1, with multi-file bundles (bundle.md as manifest) preserved as a documented v2 possibility — the convention here is confirmed as built; no shape change.

### Implications
- Bundle discovery is `fs.readdir('methodologies/')` for install-shipped bundles; per-project external bundles resolve through `bundle_path` (C-D14) and are not part of that scan.
- The parser walks H2 headings in order; out-of-order or missing headings produce structural-validation errors at load time.
- In-app authoring (T-D41 deferred to v2) would write a user bundle to that user's external `bundle_path` directory, not into the repo's `methodologies/`.
- Backup never copies the `methodologies/` directory — bundles ship with the install, not with the datastore (T-D3).

---

## C-D4 — Bundle parser: typed-section dispatch with structural validation at load time

- **Status:** active (implementation-only)
- **Cites:** T-D42, T-D44

### Decision
The bundle parser walks the eleven H2 sections in order and dispatches each to a typed parser function. Each typed parser returns a typed structure or a structural-validation error. The loader composes the eleven outputs into a single `LoadedBundle` object that the runtime consumes.

Typed structures (illustrative):
- **Identity** → `{ name, version, authority_precedence: string[] }`
- **Project layout** → `{ primary_unit?: { name, tier_rules, doc_set, templates_by_doc_type }, runtime_artefact_dirs: string[] }`
- **Anchor system** → `{ format_regex, namespace, body_sections, status_vocabulary, heading_tags, state_transitions, banned_content_in_bodies }`
- **Marker system** → `{ formats, categories, gating_behaviour_by_category }`
- **State machine** → `{ phases, transitions, gates_by_moment: Record<PhaseMoment, GateSpec[]> }` — multi-gate per moment per T-D42.
- **Communication model** → `{ edge_types, routing_rules, producer_ownership_rules }`
- **Gating model** → `{ tier_rules, feature_rules, permission_rules }`
- **Review patterns** → `{ checklists: ChecklistSpec[], companion_modes: CompanionMode[] }`
- **Templates** → `{ handover, decision, research_artefact, execution_plan, fixed_doc_outlines }`
- **Validation rules** → `{ banned_string_sweeps, implementation_discipline_rules, cross_reference_resolution_rules, structural_validation_rules, discipline_drift_categories }`
- **Authority hierarchy** → `{ source_ranking: string[], drift_policy }`

Structural-validation errors at load time fail loudly with a bundle-load error, surfacing in the UI as a settings-panel banner. A failed load means projects bound to that bundle fall back to read-only display until the bundle is fixed.

### Rationale
Typed-section dispatch keeps each parser narrowly scoped and unit-testable. Validating at load time (rather than at every gate firing) means malformed bundles are caught before they corrupt the runtime's behaviour. Failing-loud avoids silent fallback to partial bundle interpretation, which would hide methodology bugs.

### Implications
- `backend/src/methodology/bundle-parser/` houses one file per section.
- The parser writes an audit-log entry (T-D36) on every successful load and on every load failure with the validation error.
- Bundle changes (file edit) trigger re-load via `chokidar` watching `methodologies/**/bundle.md`; on successful re-load, a re-load audit entry records old and new identity-section version strings.
- The freeform bundle's sections legitimately declare "none" for primary unit, anchors, markers, gates, etc. — typed parsers must accept that shape rather than treat it as malformed.

---

## C-D5 — Projects are first-class with `project_id` foreign keys throughout per-project tables

- **Status:** active (implementation-only)
- **Cites:** T-D40, T-D47

### Decision
Schema:

```
projects (
  id TEXT PRIMARY KEY,         -- nanoid
  name TEXT NOT NULL,
  repo_path TEXT NOT NULL,
  github_owner TEXT,
  github_repo TEXT,
  bundle_id TEXT NOT NULL,     -- references methodologies/<bundle_id>/bundle.md (or external dir, see bundle_path)
  bundle_path TEXT,            -- C-D14: optional external bundle dir; when set, resolves <bundle_path>/bundle.md
  state TEXT NOT NULL,         -- 'active' | 'archived'
  settings_json TEXT NOT NULL, -- per-project overrides
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  archived_at TIMESTAMP
)
```

`bundle_id` is non-nullable per T-D47. Default at project create is `'freeform'`. `bundle_path` is the optional escape hatch for user-owned bundles that live outside the repo (C-D14): when set it points at a directory containing `bundle.md`, which the loader resolves in preference to `methodologies/<bundle_id>/`; `bundle_id` stays non-null and remains the project's declared bundle identifier either way.

All per-project entity tables (`items`, `sessions`, `library_entries`, `directives`, `drift_signals`, `orphaned_rules`, `chat_history`, `gate_firings`, `discipline_drift_categories_state`) carry a `project_id` foreign key. Cross-project tables — `audit_log`, `cost_telemetry`, `github_state_cache`, `cc_inbox_queue`, `settings` — record `project_id` where relevant but are queried globally by default.

### Rationale
Foreign keys at the table level make project-scoped queries the default code path. Multi-project tables (audit log, cost telemetry) carry `project_id` so per-project rollups remain trivial. A single non-nullable `bundle_id` on every project means the runtime never branches on "does this project have a bundle" — it always does (freeform if nothing else).

### Implications
- Most query helpers take `project_id` as the first parameter.
- The active project is tracked in browser state (URL prefix `/projects/:id/...`) and persisted as the last-opened project for next launch.
- Cross-project surfaces (library cross-project toggle, rollup view) opt in by passing `project_id: null` to query helpers.
- Project archive sets `state='archived'` and `archived_at`; archived projects are hidden from the projects view by default with a toggle to show them.
- Project delete removes all rows with that `project_id` cascade; codebase on disk is untouched per SPEC §7.2.

---

## C-D6 — Methodology gate runtime: moment-trigger dispatch, multi-gate per moment, independent findings streams

- **Status:** active (implementation-only)
- **Cites:** T-D42, T-D44, T-D36

### Decision
Four phase moments are wired in the backend: `pre-write`, `per-commit`, `plan-mode`, `post-commit`. Each moment has a dispatch path:

1. **Trigger** — the moment fires. Trigger mechanism is per-moment (see [Questions for the spec author](#questions-for-the-spec-author) for the four trigger-detection gaps; v1 implementation provisionally uses signal-file conventions in the Throughline-managed inbox plus explicit UI triggers).
2. **Resolve gates** — the runtime asks the loaded bundle for `gates_by_moment[moment]` (per C-D4); zero or more `GateSpec` entries are returned.
3. **Run each gate** — gates run independently. Mechanical gates execute scripts or validators; judgement gates call Anthropic (default Sonnet per SPEC §9). Each gate produces its own findings stream.
4. **Record** — each gate firing writes a row to `gate_firings (id, project_id, moment, gate_id, status, findings_json, created_at)`. An audit-log entry (T-D36, with `entity_type='gate_firing'`) records the firing.
5. **Surface** — failures appear as proposals in the methodology-gates view; never as repo-level blocks (T-D44). Each failure carries an "override with reason" action (writes an audit-log override row) and a "fix and retry" action (re-triggers the gate for that moment).

Gates at the same moment run concurrently when independent; the bundle can declare ordering dependencies that the runtime honours.

### Rationale
A single dispatch path keeps gate behaviour uniform across moments. Independent per-gate findings streams preserve the granularity needed for multi-gate moments (T-D42). Writing to a dedicated `gate_firings` table plus the audit log makes both fine-grained per-firing queries and broad audit-history queries cheap.

### Implications
- `backend/src/methodology/gates/` contains the dispatcher and per-moment trigger handlers.
- Mechanical gate execution uses sandboxed child-process spawn for shell scripts; output captured and parsed per the bundle's gate spec.
- Judgement gates use the standard Anthropic client; prompt-fingerprint discipline (T-D24) applies.
- PR-open methodology gate enforcement (§7.13) reuses this dispatcher with `moment='pr-open'` (effectively a fifth moment specific to GitHub integration, surfaced separately because its trigger is the GitHub poller rather than a local event).
- Override audit-log rows include the override reason text and the original findings reference for traceability.

---

## C-D7 — Discipline-drift engine: bundle-declared categories, shared signals table with `stream` discriminator

- **Status:** active (implementation-only)
- **Cites:** T-D21, T-D42

### Decision
Discipline-drift categories come from the loaded bundle's validation-rules section (`discipline_drift_categories` per C-D4). The runtime instantiates one scanner per category at bundle load. Scanners run on three triggers:

1. **Project doc file changes** — `chokidar` watching the project's `repo_path` for changes to files declared as doc files in the bundle's project-layout section.
2. **Explicit user re-scan** — UI action from the methodology-gates view.
3. **At pre-write phase moment** — scanners relevant to write-time conformance fire as part of the pre-write moment's gate dispatch.

Discipline-drift signals share the `drift_signals` table with code-drift, distinguished by a `stream` field:

```
drift_signals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  stream TEXT NOT NULL,        -- 'code' | 'discipline'
  category TEXT NOT NULL,      -- code: 'tier-1'..'tier-4'; discipline: bundle-declared category name
  item_id TEXT,                -- nullable for discipline signals not item-scoped
  primary_unit_ref TEXT,       -- bundle-defined identifier of affected primary unit, if any
  reason TEXT NOT NULL,
  payload_json TEXT,
  created_at TIMESTAMP NOT NULL,
  dismissed_at TIMESTAMP,
  dismiss_reason TEXT
)
```

Discipline-drift surfaces:
- In the methodology-gates view as a category-grouped list.
- As badges on affected primary units in the modules view (when bundle declares primary units).
- As a `methodology-drift` indicator on items associated with affected primary units, both in list rows and the item detail panel.

For freeform-bound projects (which declare zero discipline-drift categories), the scanner instantiation is a no-op.

### Rationale
A shared `drift_signals` table lets the drift inbox UI and the re-verify-via-AI action reuse one code path across streams. The `stream` discriminator makes per-stream filtering trivial. Wiring discipline-drift to file-system change events keeps the signal stream live without polling, and reusing the pre-write moment's dispatch lets the bundle declare scanners that should fire at gate time without duplicating trigger logic.

### Implications
- `backend/src/methodology/drift/discipline/` hosts the engine (`engine.ts`) and the
  generic scanner catalogue (`scanners.ts`); scanners are instantiated per scan from the
  loaded bundle's `validation_rules.discipline_drift_categories` (C-D4 output). Each
  category's `check_kind` selects a generic primitive — `banned_string` / `structural` /
  `cross_reference` / `regex` — mirroring the C-D15 built-in-catalogue idea for gates
  (the grammar carries no scanner→implementation binding).
- The engine derives its watched doc surface and file-change fan-out from the active
  project list (the md-ingest watcher convention), so a project created mid-session is
  covered after the next `refresh()`; bundle re-load (registry `onBundleReloaded` hook)
  re-runs every trigger so dropped categories' signals are reconciled away.
- The pre-write moment fires write-time scanners through a methodology-agnostic
  `onMoment` hook on the gate runtime (C-D6) rather than the runtime importing the drift
  engine — reuse without a backward dependency.
- **Signal scoping (implementation-shape; CODE_SPEC-only per the spec-drift policy).**
  The T-D42 bundle grammar declares no file→primary-unit or file→item mapping. The only
  file-independent item attribution it affords is `item_anchor_citations` (the linkage
  the Phase-8 anchor-resolution gate already uses): a `cross_reference` finding on a
  cited anchor is scoped to every item citing that anchor, and `disciplineCountsByPrimaryUnit`
  / `disciplineDriftItemIds` expand item-scoped signals to those items' primary units so
  the modules-view badge and the item-level `methodology_drift` indicator light up.
  `banned_string`, `structural`, and `regex` findings have no such linkage and stay
  project-scoped (`item_id` / `primary_unit_ref` NULL). A general file→unit attribution
  is a spec-author question, surfaced (not silently resolved) — see the handover Open
  Question.
- Signal lifecycle is idempotent: each scan reconciles a category's open signals against
  the current findings (`(category, item_id, primary_unit_ref, reason)` identity; the
  finding ref is folded into the reason), so a re-scan over unchanged repo state is a
  no-op, a fix dismisses the signal ("no longer reproduces"), and a re-load that drops a
  category dismisses its orphans ("category no longer declared by bundle"). Every create
  and dismiss is audit-logged (T-D36) under `actor='methodology_runtime'`.
- Surfacing: `GET/POST /api/projects/:id/discipline-drift[/rescan]` (the explicit
  user-rescan trigger); the methodology-gates view renders a category-grouped section;
  `ModuleSummary.drift_signal_count` badges units; the derived `Item.methodology_drift`
  flag (never persisted) drives the list-row + detail-panel indicator.
- Scanner registration is per-project per-bundle; bundle changes (re-load) tear down and rebuild scanners.
- Code-drift pipelines (tiers 1–4) write to the same table with `stream='code'`.
- The drift inbox UI in the header counts both streams together but supports filtering by stream.

---

## C-D8 — Companion review workflow engine: step state machine, mechanical/judgement dispatch

- **Status:** active (implementation-only)
- **Cites:** T-D45, T-D36

### Decision
The bundle's review-patterns section declares one or more checklists (`ChecklistSpec` per C-D4). When the user starts a companion review (UI action: "Run companion review on this slice"), the runtime instantiates a `ChecklistRun` with each step in state `pending`.

Step lifecycle:
- `pending` → `in-progress` when the step starts.
- `in-progress` → `passed | failed | skipped` when the step resolves.

Step dispatch:
- **Mechanical step** — the runtime executes the bundle-declared check (regex sweep, script invocation, structural validator). Result `passed | failed` plus a finding payload.
- **Judgement step** — the runtime opens a panel in the UI. The judgement can be (a) made by the user directly with a text rationale, or (b) handed to AI-via-Anthropic (default Sonnet per SPEC §9) returning a structured judgement that the user reviews before committing.

Step transitions are sequential by default; the bundle can declare parallel-eligible steps. Step results write to a `checklist_run_steps` table; each transition writes an audit-log entry (T-D36, `entity_type='checklist_step'`).

When the run completes, an optional library-note summary (markdown) is offered for save, attaching to discussed items.

### Rationale
A workflow engine generalises across bundle checklists; a rich bundle's anchor-citation-validation + scope-assessment pattern is one shape, but freeform projects could declare entirely different patterns. The mechanical/judgement split lets fully automatable checks run without human bottlenecking while preserving human judgement for genuinely subjective calls. Persisting step state means a run can be paused, resumed, or audited later.

### Implications
- `backend/src/methodology/companion/` houses the workflow engine.
- AI-judgement step results carry the `prompt_fingerprint` and model in their audit-log row per T-D24.
- A failed mechanical step does not halt the run; the user can override the failure (audit-logged) and continue.
- The companion review's library-note summary is a normal library entry (T-D10) and follows the same edit/attach flows.

---

## C-D9 — Session-start scaffolding: bundle-driven template selection + project-context retrieval pipeline

- **Status:** active (implementation-only)
- **Cites:** T-D45 (companion-runtime kin), T-D12 (include-in-prompt directives)

### Decision
When the user opens a slice or session and triggers "generate session-start prompt", the runtime runs a context-assembly pipeline:

1. **Resolve companion mode** — the bundle's review-patterns section declares one or more companion modes (e.g. a "doc-readiness mode" and a "code-PR mode"). The user picks a mode; default is the bundle's first-declared mode.
2. **Gather context** — for the current project and chosen mode, retrieve: project spec excerpts, decisions relevant to the active primary unit (if bundle declares primary units), active anchors and open markers, execution-plan slice for the chosen mode, cross-primary-unit dependencies, and any items carrying include-in-prompt directives (T-D12).
3. **Relevance classification** — Anthropic Haiku (per SPEC §9: "Session-start prompt assembly: Haiku") classifies which decisions and anchors are relevant to the slice; full text included for high-relevance, citations only for medium, dropped for low.
4. **Render** — the bundle's templates section provides the session-start template for that companion mode; the assembled context fills the template; output is a prompt string.
5. **Surface** — UI shows the rendered prompt with a one-click copy-to-clipboard.

### Rationale
Bundle-driven template selection keeps Throughline methodology-agnostic — each bundle declares its own companion modes; a different bundle declares different modes. Relevance classification via the cheapest model (Haiku) keeps cost low for what is a frequently-used feature. Templates lifted from the bundle's templates section means the bundle author controls prompt shape without code changes. **Spec ratification (Q6, SPEC §7.18).** SPEC §7.18 now formalises a companion mode as a bundle-declared identifier whose sole v1 runtime effect is this template selection (steps 1/4), default = first-declared mode — ratifying this pipeline's contract as built. Richer mode coupling is spec-deferred to a worked example; no shape change here.

### Implications
- `backend/src/methodology/session-start/` houses the pipeline.
- Cached context: the previous session-start prompt is stored per session for re-render-without-AI when the user wants a quick repeat.
- Cost telemetry (T-D29) records every prompt-assembly call.
- A freeform-bound project's session-start scaffolding produces a minimum-spec prompt (the bundle declares a single template with no methodology-specific context).

---

## C-D10 — Repo `.md` ingestion folders are confined to the project's `repo_path` subtree

SPEC §7.9 / T-D11 specify folder-opt-in ("the user points the backend at a directory") without bounding *where* on disk. The REST surface (`POST /api/projects/:id/md-ingest/folders`, `…/scan`, `…/ingest`) takes a user-supplied path; an unbounded path would let any client read arbitrary filesystem locations through the API.

Implementation decision: every opt-in folder path is confined to the project's `repo_path` subtree. Paths are stored *relative* to `repo_path` in `md_ingest_folders`. Confinement is enforced two ways: (1) lexical containment — absolute paths and `..`-escapes are rejected before resolution, and the resolved path must equal or sit strictly under `resolve(repo_path)`; (2) the directory walk skips symlinks (the Phase 4 code-todo scanner's `withFileTypes` no-symlink idiom), so a symlink inside an opted-in folder cannot redirect ingestion outside the subtree. `realpath` is deliberately not used — `repo_path` is itself frequently a symlinked temp dir under test, and lexical containment + no-symlink-walk is sufficient. This mirrors the existing code-todo scanner, which already scopes to `repo_path`.

Because `ingest` accepts user-supplied `req.paths` (not just paths the scan produced), it re-asserts the no-symlink guarantee at read time rather than trusting the scan: every component from the opted-in folder root down to the target file is `lstat`-checked, and a path traversing any symlink is skipped (not read). This closes the scan→ingest TOCTOU window where a symlink could be swapped in after a clean scan.

---

## C-D11 — `md_ingest_folders` table; tracked re-ingest re-summarises (cost flows through the meter)

T-D11 says "Settings carries a list of opted-in directories." Implementation shape: a dedicated `md_ingest_folders(id, project_id, rel_path, created_at)` table with a unique `(project_id, rel_path)` index, rather than a blob in `projects.settings_json`. Rationale: it matches the table-per-feature convention already used for `code_todo_scans` / `proposed_extractions`, makes folder add/remove individually auditable (T-D36), and keeps the opt-in list project-scoped and FK-cascaded with the project. Imported-doc source tracking lives on `library_entries` (new columns `source_path`, `source_tracked`, `source_hash`, `ingested_at`) so re-ingest reuses the library service's create/update path (FTS triggers + audit stay uniform).

Re-ingest semantics: snapshot by default; the per-entry `source_tracked` toggle (§13 adopted default) makes an entry mirror its source file. **Tracked re-ingest re-summarises via AI** — "re-ingest" is "re-import" per §7.9, and tracking is an explicit per-entry opt-in, so the AI cost is user-chosen and flows through `cost_telemetry` (T-D29) with a prompt fingerprint in the audit trigger context (T-D24), exactly like the dump-zone extractor. Re-ingest is hash-gated: an unchanged file is a no-op (no AI call, no cost), and the summariser degrades to the heuristic path when no API key is configured (SPEC §15).

---

## C-D12 — Bundles declare item types in the State machine section; `ItemPolicy` carries per-type lifecycles

- **Status:** active (implementation-only)
- **Cites:** T-D42, T-D47, T-D48; SPEC §7.4, §7.5

### Decision
SPEC §7.4/§7.5 require methodology-defined item types, each with its own status lifecycle, rendered as separate boards (the `test-bundle`: `task` with `open/doing/blocked/done`, `note` with `draft/published`). The eleven-section bundle structure (T-D42) has no dedicated "item types" section, so item types are declared inside **§5 State machine** via `### Item type: <id>` sub-blocks — mirroring the existing `### Gates: <moment>` sub-heading convention — each carrying `board:`, `statuses:`, and `transitions:` key-value lines. The parser populates `StateMachine.item_types: ItemTypeSpec[]`.

`ItemPolicy` gains `statuses_by_type: Record<string,string[]>` and each `Board` gains a board-scoped `statuses: string[]`. The flat `ItemPolicy.statuses` is retained as the de-duplicated union of every type's statuses for generic, non-item-type-aware consumers (reconcile, dump-zone, tree-by-status). Item create/update validate the status against the **item type's** lifecycle, not the union. Bundles that declare no item types (freeform) yield an empty `item_types` and the runtime infers a single board from the state machine's `phases` — the existing freeform behaviour, unchanged.

### Rationale
The State machine section already owns lifecycle/transition semantics, so per-type lifecycles belong there rather than in a new section that would break the fixed eleven-section contract (T-D42). Reusing the `### <Label>: <id>` sub-block convention keeps the parser uniform. Retaining the flat union keeps every existing generic consumer working without an item-type-aware rewrite (no per-bundle branch — T-D48). Per-type validation is what makes "todos and decisions are different shapes" real rather than cosmetic.

### Implications
- `state-machine.ts` parses top-level `phases`/`transitions` from the region before the first `###` so item-type sub-blocks don't bleed into them.
- `bundleItemPolicy` is the single place that maps a `LoadedBundle` to boards/types/statuses; no consumer hardcodes item-type vocabulary.
- The four methodology-context join tables (`item_primary_unit_refs`, `item_phase_refs`, `item_anchor_citations`, `item_marker_refs`) round-trip on the `Item` shape and through create/update with audit-logged per-dimension diffs (T-D36).

---

## C-D13 — Modules view endpoint: primary units derived from item refs; tier classification is bundle-rule-driven

- **Status:** active (implementation-only)
- **Cites:** T-D39, T-D48; SPEC §7.11

### Decision
`GET /api/projects/:id/modules` returns `{ primary_unit_label, modules: ModuleSummary[] }`. Primary units are the distinct `item_primary_unit_refs` values across the project's items; per unit the endpoint reports item count, distinct phase refs (phase indicators), anchor-citation count, marker-ref count, and a tier label. `primary_unit_label` is the bundle's primary-unit `name` (e.g. "module" in a rich bundle), or `null` when the bundle declares no primary unit (freeform) — the view stays hidden via the existing `has_primary_unit` gate, not a freeform code branch.

Tier classification is bundle-driven: the primary unit's `tier_rules` string declares ordered count bands of the form `<tier> <=<n> items; <tier> ><n> items`. The runtime evaluates bands against the unit's item count and the first satisfied band wins; an empty/unparseable rule yields `untiered`. No tier-inference engine — the bundle author owns the thresholds.

### Rationale
Deriving primary units from item refs (rather than a separate registry) keeps "a module is wherever items say they belong" true to T-D39 and needs no extra authoring surface. A declarative count-band rule in the bundle keeps tier classification methodology-agnostic (T-D48) and v1-simple while still being the bundle author's decision, not the runtime's.

### Implications
- `ItemsService.modules(projectId)` is the single derivation point; the route is a thin pass-through.
- The frontend Modules view renders the table generically (label, tier, counts, phases) with no bundle-specific terms baked in — `primary_unit_label` and tier strings come from the bundle.

---

## C-D14 — Per-project `bundle_path` externalises user bundles; loader resolves external-first with watch parity

- **Status:** active (implementation-only)
- **Cites:** T-D41, T-D47; C-D3, C-D4, C-D5

### Decision
Projects carry an optional `bundle_path` column (nullable; migration `0007_project_bundle_path.sql`). Resolution for a project's bundle is: if `bundle_path` is set, load `<bundle_path>/bundle.md`; otherwise load the install-shipped `methodologies/<bundle_id>/bundle.md`. `bundle_id` stays non-nullable (T-D47) and remains the declared identifier in both cases.

The methodology registry exposes `resolveBundle(bundle_id, bundle_path?)` / `hasBundle(bundle_id, bundle_path?)`; all per-project consumers (project create/update validation, item policy, reconcile, dump-zone) resolve through these rather than the install-only `get`/`has`. External bundles get the same `chokidar` hot-reload as install-shipped ones: each distinct external `bundle.md` is an additional watch target, refcounted by the projects bound to it — registered on project create (and on `bundle_path` change), unregistered on project delete or when the last referencing project drops it. On backend start the registry re-registers watch targets for every project already carrying a `bundle_path`.

This is what keeps proprietary discipline out of the public repo: `methodologies/` ships only `freeform` and the generic `test-bundle` fixture; business-internal bundles live in a user-owned directory referenced by `bundle_path` (C-D3).

### Rationale
A per-project path with install-fallback is the minimum mechanism that lets a user keep a private bundle outside Throughline without forking the repo, while leaving the freeform default and the single-non-null-`bundle_id` invariant (C-D5) untouched. Watch parity removes the asymmetry where canonical bundles hot-reload but user bundles would not; refcounting the watch target keeps the watcher set exactly as large as the live project bindings require.

### Implications
- The registry holds a second cache keyed by absolute external `bundle.md` path, alongside the install cache keyed by bundle id; both are populated/refreshed by load and by the watcher.
- `bundle_path` is validated at project create/update to a normalized absolute path with no `..` traversal (the canonical form is what gets persisted); an invalid value is rejected with `invalid_bundle_path` before it reaches the loader.
- The external read is attempted directly (no `existsSync` pre-check — TOCTOU-prone and blind to `EACCES`/`EIO`); any fs failure becomes a normal bundle-load error result, so neither the chokidar watcher nor `resolveBundle` can throw. A missing/malformed/unreadable external `bundle.md` therefore rejects create/update with `bundle_not_loaded`.
- Backup still never copies `methodologies/` (C-D3); a user's external bundle directory is likewise their own to back up — it is not part of the datastore.
- No bundle-authoring UI in v1 (T-D41); `bundle_path` is set via the project create/update API.

---

## C-D15 — Mechanical gates dispatch to a built-in generic check catalogue by gate-id keyword

- **Status:** active (implementation-only)
- **Cites:** T-D42, T-D44, C-D4, C-D6

### Decision
The bundle grammar parses each gate as `id | kind | description` (C-D4); it carries no field binding a `mechanical` gate to a concrete check. SPEC §7.12 / CODE_SPEC §7 only require mechanical gates to run "scripts or validators". The v1 runtime therefore ships a fixed catalogue of generic mechanical-check primitives, each driven off the bundle's already-typed sections rather than gate-specific configuration:

- **`banned-string`** — sweeps the bundle's declared doc surface (`project_layout.primary_unit.doc_set` + `runtime_artefact_dirs`) for `validation_rules.banned_string_sweeps` ∪ `anchor_system.banned_content_in_bodies`.
- **`structural`** — required `doc_set` files present under `repo_path`.
- **`anchor-resolution`** — every anchor in `item_anchor_citations` matches `anchor_system.format_regex` and resolves to a heading in the doc surface; a cited anchor whose nearby `status:` term is non-live (`status_vocabulary[1..]`) fails.
- **`blocking-marker`** — scans the doc surface for `marker_system.formats` (preferring formats named in the gate description).
- **`script-spawn`** — `child_process` execution of a `*.sh` named in the gate description (or the gate id), under `repo_path`, non-zero exit = fail.

A `GateSpec` is dispatched to one primitive by a documented gate-id keyword convention (`*banned*`→banned-string, `*structure|structural|conformance*`→structural, `*anchor*`→anchor-resolution, `*marker*`→blocking-marker, `*verify*` or a `.sh` token in the description→script-spawn). An unrecognised mechanical gate, an unreadable `repo_path`, or any check exception records a non-blocking `skipped`/`error` finding — never a repo block (T-D44).

### Rationale
The alternative — adding a fourth check-binding token to the gate line — is a change to the eleven-section grammar (C-D4) and the shipped `test-bundle` fixture, i.e. a spec-author / Phase-1 change, not a Phase-8 implementation detail. Keeping the binding implicit (gate-id keyword → built-in primitive over the bundle's typed sections) leaves the grammar and fixture untouched, stays methodology-agnostic, and covers the worked example (`test-bundle`'s four mechanical gates) without bundle-specific runtime code. Per the spec-drift policy this is an implementation-shape choice, so it lands as a C-D anchor in CODE_SPEC.md only; no SPEC.md change.

### Implications
- `backend/src/methodology/gates/checks.ts` holds the catalogue + `resolveCheckKind`.
- Bundles whose gate ids do not match the keyword convention get `skipped` mechanical firings — visible in the methodology-gates view, never a block. A future grammar extension can supersede the keyword heuristic without changing the dispatch/record path.
- Judgement gates bypass the catalogue: they call Anthropic (`claude-sonnet-4-6`, hardcoded default-parameter, matching the dump-zone / reconcile / md-ingest factories) with the gate description + a project-state digest; the audit row carries model + prompt fingerprint only (T-D24) and a `cost_telemetry` row is written (T-D29).

---

## C-D16 — GitHub poller + code-drift pipeline: fetch-idiom client, local-git-first diff seam, confidence-thresholded auto-reconcile

- **Cites:** T-D6, T-D7, T-D18, T-D21 (code stream), T-D26, T-D31, T-D33, T-D34; SPEC §7.13/7.14/7.16; C-D6 (pr-open dispatch), C-D7 (shared `drift_signals`)

### Decision
The Phase-10 GitHub subsystem (`backend/src/github/`) is built as a thin `fetch`-based REST client (no `@octokit/rest`) plus a local-git diff seam (`child_process git`, no `simple-git`), behind a polling loop that drives PR-state surfacing, the `pr-open` gate, code-drift tiers 1-4, confidence-thresholded auto-reconcile, manual item-to-PR linking, and the orphaned-rule lifecycle.

### Context
CODE_SPEC §4 named `@octokit/rest` and §12 named `simple-git`. The established repo precedent is the opposite: `ai/anthropic.ts` deliberately talks JSON-over-HTTPS directly with an injectable `fetchImpl` (offline-testable, SDK-free, "promote when the surface grows"), and §7 already records the Phase-8 hook-installer shelling `git` directly rather than adding `simple-git`. Adding the SDKs now would itself be drift against that precedent.

### Rationale
- **Rate-limit posture.** Authenticated REST conditional GETs that return `304` do **not** count against the primary rate limit, so ETag-cached lifecycle polling (60s active / 5min idle, T-D7) is effectively free. The only expensive payload is a PR's changed-file list / diff-stat.
- **Hybrid diff seam.** Therefore the *single* expensive seam — changed-file enumeration (tier-3) and diff-stat (auto-reconcile) — goes **local-git-first**: the backend already has `repo_path`; `git diff --name-only base...head` costs no API call, no payload, and is offline-testable with a real temp repo. Base/head SHAs come from the cheap metadata call already made for state. `refs/pull/N/head` lives on the base repo, so fork PRs work; the fetch-on-miss is lazy and best-effort; on any miss the caller falls back to the GitHub `pulls/{n}/files` API. **Tiers 1 (Semgrep check-run annotations) and 2 (revert metadata) are GitHub-only facts and stay API-only** — there is no local-git path for them.
- **SDK-free.** A `fetch` client with injectable `fetchImpl` keeps the offline/degraded story (no PAT ⇒ inert, mirroring `AnthropicClient.available()`), adds zero dependencies, and matches the in-repo idiom.

### Implications
- **Layout.** `backend/src/github/`: `api.ts` (fetch/ETag client + the documented `listPullFiles` API fallback), `local-git.ts` (the hybrid seam), `state-cache.ts` (`github_state_cache`; a synthetic `pr_number=0` row holds the repo-level list ETag — schema unchanged from 0001), `poller.ts`, `tiers.ts` (1-3, idempotent), `tier4.ts` (token-cosine dedup + 7-day stale sweep), `auto-reconcile.ts`, `pr-linking.ts`, `orphan-rules.ts`, `reverify.ts`, `routes.ts`. Migration `0009` is index-only (confidence/undo ride in `audit_log.trigger_context_json` per §6/§16).
- **Auto-reconcile (T-D6/T-D18).** PR description + merge msg + diff-stat → reconcile engine → confidence dispatch: high = auto-apply + toast + 24h undo (in-memory fast path; the reversal snapshot is also persisted in the audit row so undo survives a restart within the window, §6; provenance + confidence audit-logged as `actor='ai_auto_apply'` **from day 1**, §13 calibration); medium = run left pending, one-click approve = the normal apply; low = modal. The v1 confidence formula (heuristic-extractor never auto-applies; any `contradicted` row forces a human; small all-completed/no-change ⇒ high; completed-dominated ⇒ medium) is a §13 partially-blocking knob, project-overridable via `settings_json.github_auto_reconcile`.
- **"Active session" approximation (implementation-shape; CODE_SPEC-only per the spec-drift policy).** SPEC §7.13's "pinned or dumped within 2h" has no first-class signal (sessions carry no pin / last-dump column). v1 approximates "active" as *a session or reconcile run touched within 2h*. Surfaced as an Open Question, not silently resolved.
- **SSE push deferred.** `routes/events.ts` is ping-only and no broadcast bus exists; Phase-10 surfacing stays REST-poll (the Phase-9 precedent). Building a bus is a separate cross-cutting slice.
- **Verifier-tool plurality (Questions for the spec author #7) — resolved per SPEC §7.16 (Q7).** The integration boundary is the GitHub Checks annotation contract: tier-1 matches check-run annotations to `item_verifier_rules` by the bundle-defined rule-identifier convention (rule id ↔ annotation title / message), annotation-generic and not Semgrep-hardcoded. Semgrep is the v1 reference/recommended tool; this as-built behaviour is ratified — no shape change.
- Code-drift signals share the `drift_signals` table with `stream='code'` (C-D7); the drift inbox counts both streams, excludes strong code tiers 1-3 (they badge items via the derived `Item.code_drift_tier`), and reuses one re-verify / reopen / dismiss code path across streams.

---

## C-D17 — Semble integration: per-query `execFile` CLI invocation, keyless, capability-gated

- **Cites:** T-D27 (keyless local Semble), T-D13 (code search delegated to Semble); SPEC §7.15/§15/§10; C-D16 (shared one-shot `execFile` precedent), `ai/anthropic.ts` (`available()` degradation pattern)

### Decision
Throughline calls Semble as a one-shot `execFile` child process per code-search query — not a long-lived supervised subprocess, MCP-stdio service, or HTTP/socket server. The Semble command resolves from `THROUGHLINE_SEMBLE_CMD`, defaulting to `semble` on `PATH`. "Configured" means the command resolves and executes; there is no secret-presence check (Semble is keyless, T-D27). When the binary is absent or a call fails, code intelligence degrades exactly as the no-API-key path does for Anthropic.

### Context
SPEC §7.15 / T-D27 / the prior CODE_SPEC §1 diagram and §4 row described Semble as a long-lived backend-started service that watches the repo and re-indexes incrementally, read via a local socket over an "MCP-style or HTTP API." Phase-11 spec analysis against the real tool (MinishLab/semble: Python; stdio-MCP **or** one-shot CLI; on-demand, per-session-cached indexing; no HTTP/socket mode; no API key) showed that framing was inaccurate. SPEC §7.15 and T-D27 were corrected functionally; this anchor records the implementation-shape consequence.

### Rationale
- **Precedent.** The repo already shells one-shot children via `execFile`/`execFileSync` in `methodology/gates/hook-installer.ts`, `methodology/gates/checks.ts`, `github/local-git.ts`, `github/pr-linking.ts`, with the documented "don't add a dependency for a one-shot binary call" rationale (C-D16, hook-installer header). Per-query Semble is the same idiom: zero new dependencies, no MCP client (none exists in the tree).
- **No supervisor.** A one-shot process exits per call — no start/restart/health/kill lifecycle, no per-project process registry, no multi-project index-target contention.
- **Keyless + capability gate.** Mirrors `AnthropicClient.available()` → feature-disable: a resolvable command ⇒ code Q&A / done-time linking / enrichment / code-drift tier-3 active; unresolvable or failing ⇒ those inert, everything else unaffected (SPEC §15 graceful degradation).
- **Indexing.** Semble's own per-session index cache covers query-batch performance; Throughline's existing `chokidar` watchers do not drive re-index (Semble re-indexes on next invocation).

### Implications
- A small Semble client (e.g. `backend/src/semble/client.ts`) exposing `available()` + `search(...)`, `execFile`-based, command from config, offline-testable by injecting the exec impl — mirroring `ai/anthropic.ts` shape.
- `THROUGHLINE_SEMBLE_CMD` joins the `THROUGHLINE_*` env-override family in `config.ts`; surfaced in §19 Settings & config as a non-secret per-install command field (settings store, not `secrets.json` — the settings secret-key guard is satisfied: no key material).
- Consumers: done-time linking, code Q&A (`library/service.ts` `semanticSearch()` stub plug-point + scratchpad), dump-zone enrichment, dormant code-drift tier-3 (`drift/service.ts`) once `item_code_refs` populate.
- No new T-D anchor: the underlying decision (use Semble; keyless; local) is unchanged from T-D27; only the shape changed.

---

## C-D18 — Communication-model layer: h3-walking parser, per-project view + settings, pure rule-level derivation, GraphView fourth-layer toggle

- **Cites:** T-D49 (bundle §6 grammar + per-project supply), T-D50 (rule-level graph + coupled freshness); SPEC §7.11; C-D4 (bundle parser typed dispatch), C-D13 (modules service), C-D14 (per-project `bundle_path`)

### Decision
The §6 communication-model parser is an h3-walking grammar reader, not a bullet extractor — mirroring `state-machine.ts`'s `### Item type:` / `### Gates: <moment>` walk. The project-level supply (`contract_sources`, `module_tiers`) lives under `projects.settings_json.communication_model` and surfaces via a per-project view endpoint with replace-semantics PUT. Graph derivation is a pure function over `(bundle, modules, module_tiers)`; the GraphView fourth-layer toggle renders the derived graph behind a toolbar button that hides for bundles whose §6 is `none`.

### Decision detail

- **Bundle parser** — `packages/backend/src/methodology/bundle-parser/communication-model.ts`. Splits the §6 body into h3 regions; matches headings against `Edge type: <name>`, `Tier routing: <tier>`, `Producer ownership`; parses each region's body via the existing `parseKeyValueLines` helper. Errors aggregate into the section's `BundleStructuralError[]` (unknown sub-section, missing `when:` / `mechanism:`, mechanism both "direct" and "via", duplicate edge-type name, tier name not in §2's `tiers:`, producer-ownership rule != `producer-owns-shape`). Tier vocabulary parses out of §2's top-level body in `project-layout.ts`, then threads into the §6 parser via `parseBundle/index.ts` so tier-resolution failures attach to §6 with the right section name.
- **Per-project view** — `GET /api/projects/:id/communication-model` returns `{ bundle, contract_sources, module_tiers, resolved: { contract_sources: Record<edge-type-name, { absolute_path, configured }>, module_tiers: Record<module-name, { tier|null, valid }>, declared_tiers: string[] } }`. Resolution is path-join only (no file reads): absolute paths pass through, relative resolves against `project.repo_path`. Only edge types whose §6 declaration carries `contract_source:` appear in `resolved.contract_sources`. `resolved.module_tiers` carries one entry per item-derived module; `valid: true` iff the assigned tier is in `declared_tiers` (unassigned and invalid both surface as `tier: null`).
- **Settings writer** — `PUT /api/projects/:id/communication-model` replaces the `communication_model` block in `settings_json` wholesale (matching the project PATCH path's wholesale-replace semantics in `projects/service.ts`). Empty-string values are filtered out on write so the stored shape stays clean.
- **Graph derivation** — `packages/backend/src/methodology/communication-model/graph.ts`, pure. Modules sort by ref for determinism. Pair enumeration is unordered with self-loops excluded; `when: any` matches every pair; `when: <a> <-> <b>` matches by tier set (symmetric, including same-tier when a == b); modules with `tier: null` skip tier-pair matches but match `any`. Tier-routing overrides apply when either endpoint sits in a tier with a `### Tier routing:` rule; two-rule conflicts resolve by sorting tier names lexicographically. `producer_owns_shape` mirrors `bundle.producer_ownership !== null`. Endpoint: `GET /api/projects/:id/communication-model/graph`.
- **Frontend** — `views/graph/communicationLayout.ts` lays modules in horizontal tier swimlanes (declared tiers in §2 order, plus an `unassigned` lane at the bottom if any module's tier is null). `views/graph/CommunicationGraphCanvas.tsx` is a dependency-free SVG renderer using the same arrow markers and tokens as the item graph. Direct edges draw as a single curve; `mechanism: via <id>` edges draw as two curves through the mediator module when it's in the graph, otherwise as a single curve with a `via <id>` text badge. `views/graph/ModulePanel.tsx` is the side panel (ref, tier, item count, producer-owns-shape, incident edges with mechanism / contract-source / routing-tier / violation badge). `views/GraphView.tsx` carries the "Show communication model" toolbar button (hidden when the project has no comm model declared — modules empty AND declared_tiers empty), mode swap, and the coupled-freshness fetch effect keyed on a `commItemsKey` derived from items. The edge-identity helper and the coupled-freshness key derivation both live in `views/graph/commUtils.ts` so the rendering and key logic are unit-testable in isolation.
- **Coupled freshness (T-D50 render property)** — the comm graph re-derives whenever the project's item set changes in a way that affects modules. `computeCommItemsKey(items)` projects items to a deterministic `ref:count|ref:count|…` string (only ref-set + per-ref item_count, not item titles / statuses / descriptions). The fetch effect depends on `[projectId, commItemsKey]`, so refetch fires on item creation / deletion / methodology-context edit but not on title/status/description edits.

### Rationale
- **H3 walk mirrors §5.** §6 conceptually parallels §5 (typed sub-sections, each describing one declarative record); reusing the same walking pattern keeps the parser surface familiar and lets the §6 author look at the test-bundle's §5 for shape examples.
- **Parse-time tier resolution.** Catching unknown tier names at bundle load surfaces errors next to the bundle author, not at derivation time when the connection back to the bundle is lost.
- **Replace-semantics on the settings PUT.** Project PATCH already replaces `settings_json` wholesale; matching that for the communication-model sub-block avoids introducing a new merge convention. The narrow per-block endpoint lets the frontend skip the "fetch full settings, merge, PUT back" dance.
- **Pure derivation.** Same posture as `items/service.ts`'s `modules()` and `bundle-parser`: deterministic, no side effects, easy to assert in unit tests, replayable for diffs.
- **`commItemsKey` precision.** Re-fetching on every item edit would re-render the comm graph (and re-charge any AI calls Phase-19 might wire downstream) for inputs that don't move the graph. Keying on the (ref, count) projection captures the minimum change set that does.
- **Toggle hidden, not disabled, for freeform.** A toggle that's always visible but inert teaches users to ignore it; a toggle that appears only when meaningful is a clearer signal that the layer is bundle-dependent.

### Implications
- Test-bundle's §2 declares `tiers: tier-a, tier-b` and §6 declares a `mediated` edge type (via `router`, invariant violation), a `direct-call` edge type, a `tier-b` routing override, and a `producer-owns-shape` rule — exercising every grammar arm. Bundle authors can copy this shape.
- The freeform bundle's §6 stays `none`; the parser short-circuits and the frontend toggle stays hidden.
- Concrete-instance edges from contract files and routing-invariant enforcement are deferred (T-D50). When that phase lands, the `contract_sources` paths the project supplies become live inputs; until then they persist but are not consumed (the SettingsView surface makes this explicit).
- `commUtils.ts` is the natural landing site for any future shared comm-graph helper; reach for it before duplicating across Canvas / Panel / GraphView.

---

## C-D19 — Clone-and-go runtime: `.throughline/` reader, third bundle-resolution arm, `throughline init` CLI

- **Status:** active (implementation-only)
- **Cites:** T-D51, T-D52, T-D4; T-D41, T-D47; C-D3, C-D14

### Decision
Phase 19 builds eight surfaces that together realise clone-and-go. The split is bundle-resolution / per-repo config / CLI / UI / lifecycle — eight named pieces with one canonical location each.

- **Bundle loader third arm.** `packages/backend/src/methodology/loader.ts` (and the registry's `resolveBundle` / `hasBundle`) gain a `repo_path` parameter and try `<repo_path>/.throughline/bundle.md` between the `bundle_path` arm (C-D14) and the install-shipped fallback. The chokidar watcher refcounts the per-repo file the same way it refcounts external `bundle_path` files. The cached key for an in-repo bundle is its absolute resolved path, so the same repo opened twice resolves to one watch target.
- **`.throughline/project.json` init config reader.** `packages/backend/src/init/config-reader.ts` reads and validates the file against the schema documented in `docs/.throughline-schema.md`. Validation rejects unknown top-level keys (forward-compat by explicit version-bump, not silent acceptance), trims paths, and surfaces a structured `InitConfigError` discriminated union the CLI and UI both consume.
- **Git-remote auto-detection.** `packages/backend/src/init/git-remote.ts` shells `git remote get-url origin` under `repo_path` and parses `github_owner` / `github_repo` from the URL (SSH and HTTPS forms). Used by the CLI and the project-create endpoint when `.throughline/project.json` omits `github_owner` / `github_repo`. An unrecognised remote is a soft failure: the user fills the fields in the UI.
- **CLI `init` subcommand.** `packages/backend/src/cli/init/` is wired into `packages/backend/src/cli/index.ts`. Its only side effects are HTTP calls against the running backend (T-D52). The `/health` probe and the error string are hard-coded constants; the port reads from the backend's local-loopback config.
- **NewProjectModal `bundle_path` field.** The existing modal in `packages/frontend/src/components/NewProjectModal.tsx` surfaces the existing C-D14 column as an optional field. No new endpoint — the field rides the existing project-create payload.
- **SettingsView missing-config component.** `packages/frontend/src/views/SettingsView.tsx` gains a per-project block that surfaces whether `.throughline/` is absent, partial, or complete, with an explicit "re-read .throughline/" action. The block is the user's view of init state after the first bind. (2026-05-28 amendment per Phase 21 Slice 4 spec-author Q3 decision: this surface was consolidated with C-D20 surface 5 and C-D21 surface 6 into a single `BootstrapBlock` exported from `packages/frontend/src/views/SettingsView.tsx`. The `data-testid="throughline-status"` banner inside `BootstrapBlock` carries the absent/partial/complete states described here. See handover `docs/_meta/throughline/handovers/2026-05-28-phase-21-slice-4-unified-bootstrap-block.md`.)
- **Re-init flow.** The project-update endpoint accepts a `reinit_throughline: true` flag that re-reads `.throughline/project.json`, re-runs git-remote auto-detection, and updates only the fields the file supplies — never overwriting items, sessions, library entries, secrets (T-D4), or audit history. Re-init writes a single audit row of kind `project_reinit` with the diff.
- **Repo-path normalisation.** Project create and update normalise `repo_path` to an absolute, symlink-resolved canonical form before persisting. A second create attempt against an equivalent path collides on the existing project-id uniqueness check rather than producing two projects bound to the same repo.

### Rationale
Eight surfaces is the minimum that delivers a clone-and-go cycle (`git clone … && throughline init`) end-to-end against the existing backend, without introducing a second write path or migrating any existing convention. Putting all init-side code under `packages/backend/src/init/` and `packages/backend/src/cli/init/` keeps the new code one directory move away from removal if the spec author later reshapes init. Reusing the existing project-create / project-update endpoints means no new persistence layer learns about clone-and-go.

### Implications
- The bundle loader's existing `resolveBundle` signature gains an optional `repo_path` argument; callers without a repo context still resolve via arms 1 and 3. Project-create / project-update pass the project's `repo_path` through.
- `repo_path` normalisation runs once on write; the canonical form is what subsequent code sees. Existing rows are not back-filled by the migration-less Phase 19 — they normalise lazily on next update.
- The CLI ships inside the backend package (`packages/backend`), invocable via `pnpm --filter @throughline/backend exec throughline init`. A standalone install vector (e.g. `npm i -g`) is out of scope here; it can be added later without re-shaping the subcommand.
- Audit entries for init-side writes ride the existing handler audit paths (T-D36). The CLI never writes audit rows; the backend handlers do.
- Secrets (T-D4) remain backend-config only — `.throughline/` carries no key material, so `git diff .throughline/` is never a key-leak surface.

---

## C-D20 — Bootstrap ingest path: `bootstrap_id` columns + partial indices on items/sessions/library_entries, `POST /api/projects/:id/import` endpoint, transactional upsert with per-row conflict surfacing, review queue UI

- **Status:** active (implementation-only)
- **Cites:** T-D53, T-D54; T-D4, T-D24, T-D36

### Decision
Phase 20 builds five surfaces that together realise bootstrap server-side ingest. The split is schema / endpoint / derivation / conflict-detection / review-UI — five named pieces with one canonical location each.

- **Schema.** A new migration adds `bootstrap_id TEXT` (nullable) and a unique partial index `(project_id, bootstrap_id) WHERE bootstrap_id IS NOT NULL` to `items`, `sessions`, and `library_entries`. The nullable column preserves existing creation paths — manual `POST /api/projects/:id/items` (`packages/backend/src/items/routes.ts`), manual session and library creation, and the md-ingest path at `(project_id, source_path, type='imported_doc')` (`packages/backend/src/md-ingest/service.ts`) — only bootstrap-imported rows carry a `bootstrap_id`. The md-ingest upsert at `(project_id, source_path)` and the bootstrap upsert at `(project_id, bootstrap_id)` coexist on `library_entries` without collision because they key on different columns.
- **Endpoint.** `POST /api/projects/:id/import` accepts the bootstrap import file as a JSON body (schema per T-D53), validates it against the project's bound methodology bundle, runs the upsert in a single SQLite transaction, and returns a per-row result classification (`new` / `reimported` / `conflict` / `stale_flagged`). Validator structure mirrors `packages/backend/src/md-ingest/service.ts`: a stateless parser/validator layer feeds a stateful upsert layer that calls existing `items.create` / `sessions.create` / `library.create` for inserts (followed by a raw `UPDATE` to stamp `bootstrap_id` / `bootstrap_stale` on the freshly-inserted row) and emits its own raw `UPDATE` statements inline for reimports and the stale sweep — the upsert SQL lives in `packages/backend/src/bootstrap/service.ts` rather than as `…upsertByBootstrapId` methods on each entity service because the reimport path emits a single `bootstrap_reimport` audit (not per-field audits, which would mis-attribute the bootstrap-side rewrite as user edits and corrupt the predicate's reading on the next re-import). Audit entries are appended per row via existing `appendAudit` (`packages/backend/src/audit/log.ts`) with `field: 'bootstrap_import'` or `'bootstrap_reimport'` and `trigger_context_json` carrying `bootstrap_id`, `source_type`, and result status. Audit entity identity is the existing polymorphic `(entity_type, entity_id)` tuple (T-D36) — no schema change to `audit_log`.
- **Derivation module.** `packages/backend/src/bootstrap/derive-id.ts` exports `bootstrapId(sourceType, key)` returning the `<source-type>:<stable-key>` form. One resolver per source type (`decision`, `roadmap`, `handover`, `checklist`, `override`). Content-hashed types (currently `checklist`) reuse `createHash('sha256').update(...).digest('hex').slice(0, 16)`; non-hashed types pass the stable key through. Unit-test heavy, runtime-light; lives adjacent to (not inside) `packages/backend/src/ai/fingerprint.ts` so the three hashing conventions remain readable as siblings.
- **Conflict-detection predicate.** A service-layer helper `hasUserEditsSinceLastBootstrap(entityType, entityId)` is the single source of truth for "user-edited since last import" — both the API and the review queue UI consult it so they cannot disagree. The helper scans `audit_log` filtered by `(entity_type, entity_id)` (covered by the existing `idx_audit_entity` per `0001_init.sql`) and the row's prior `bootstrap_import` / `bootstrap_reimport` timestamp, excluding `field` values prefixed `bootstrap_`. The per-row scan runs once per imported row inside the import transaction; Phase 20 build may benefit from a covering index on `(entity_type, entity_id, timestamp, field)` if benchmarks show the predicate dominates import latency at realistic row counts, but the existing `idx_audit_entity` should suffice for v1.
- **Review queue UI.** A new client surface lists conflicted rows from `POST /api/projects/:id/import` results with per-row resolution actions (`keep_mine` / `take_theirs` / `merge_fields` for conflicts; `keep` / `archive` / `delete` for stale rows). UI surface placement and visual treatment are deliberately not pinned here — the Phase 20 build slice owns those calls. (2026-05-28 amendment per Phase 21 Slice 4 spec-author Q3 decision: the `BootstrapReviewBlock` shipped in Phase 20 Slice 4 was subsequently consolidated with C-D19 surface 6 and C-D21 surface 6 into a single `BootstrapBlock`; the review-queue subsection lives inside it as `data-testid="bootstrap-review-block"`. The `BootstrapReviewModal` mount is unchanged. See handover `docs/_meta/throughline/handovers/2026-05-28-phase-21-slice-4-unified-bootstrap-block.md`.)

### Rationale
Five surfaces is the minimum that delivers a bootstrap-import cycle end-to-end against the existing backend without introducing a second write path. The schema choice — nullable `bootstrap_id` column plus a unique partial index — preserves every existing creation path on items, sessions, and library_entries: manual creation, md-ingest at `(project_id, source_path)`, and bootstrap at `(project_id, bootstrap_id)` coexist because they key on different columns. The validator/upsert split mirrors md-ingest's stateless-parser / stateful-upsert structure, so the bootstrap endpoint reuses the existing entity-creation contracts rather than introducing parallel write surfaces. The conflict-detection predicate lives in one helper (`hasUserEditsSinceLastBootstrap`) so the API and the review queue UI cannot disagree on what "user-edited since last import" means. The three hash conventions (`promptFingerprint` salted for privacy per T-D24, `contentHash` unsalted for change detection, the new unsalted `bootstrapId` for identity) live adjacent in the backend tree so a reader sees three named functions with three named purposes side by side.

### Implications
- The new migration is additive: nullable `bootstrap_id` column plus a unique partial index per table — no back-fill, no impact on existing rows or existing creation paths.
- Audit entity identity stays on the existing polymorphic `(entity_type, entity_id)` tuple per T-D36 — no schema change to `audit_log`. Per-row audit entries ride `appendAudit` with `field: 'bootstrap_import'` / `'bootstrap_reimport'` and `bootstrap_id` / `source_type` / result status in `trigger_context_json`.
- The conflict-detection predicate's per-row audit scan runs once per imported row inside the import transaction. The existing `idx_audit_entity` index (per `0001_init.sql`) should suffice for v1; a covering index on `(entity_type, entity_id, timestamp, field)` is a benchmark-driven follow-up if import latency dominates at realistic row counts.
- Review queue UI surface placement and visual treatment are deliberately not pinned in C-D20 — the Phase 20 build slice owns those calls.

---

## C-D21 — Bootstrap producer surfaces: prompt template, render endpoint, file watcher, archive/quarantine worker, re-bootstrap, init UX block

- **Status:** active (implementation-only)
- **Cites:** T-D55, T-D56; T-D4, T-D51, T-D53, T-D54; C-D14, C-D19, C-D20

### Decision
Phase 21 builds six surfaces that together realise the bootstrap producer side. The split is template / render / watcher / worker / re-bootstrap / UX — six named pieces with one canonical location each.

- **Prompt template.** `packages/backend/src/bootstrap/prompt-template.md` (per T-D55). Single repo-owned generic markdown file. Loaded at run time by the render endpoint; never edited per-bundle. Sits adjacent to `packages/backend/src/bootstrap/derive-id.ts` (per C-D20).
- **Render endpoint.** `POST /api/projects/:id/bootstrap/render` reads the prompt template, prepends a small fixed parameter block (resolved bundle file path via the existing three-arm resolver in `packages/backend/src/methodology/loader.ts` per C-D14 / C-D19, canonical repo root, declared output path `<repo_path>/.throughline/bootstrap-output.json`), writes the rendered prompt to `<repo_path>/.throughline/bootstrap-prompt.md`, and returns the file path plus a copy-pasteable invocation command for the user. Repo root is repo-canonicalised (per C-D19's normalisation) before injection so the output file cannot be redirected outside the project's repo.
- **Bootstrap-output watcher.** `packages/backend/src/bootstrap/watcher.ts` is a chokidar watcher mirroring the inbox watcher's shape (`packages/backend/src/inbox/watcher.ts`). Refcounted per project: registered on render-endpoint first call for a project, unregistered on project delete. Watches `<repo_path>/.throughline/bootstrap-output.json`. On detected write completion, hands off to the worker.
- **Archive / quarantine worker.** `packages/backend/src/bootstrap/worker.ts` mirrors `packages/backend/src/inbox/worker.ts`. Routes the detected output file to the Phase 20 ingest path (`POST /api/projects/:id/import` per C-D20). On successful ingest, moves the file to `<repo_path>/.throughline/bootstrap-archive/<timestamp>-bootstrap-output.json`. On ingest failure, moves to `<repo_path>/.throughline/bootstrap-quarantine/<timestamp>-bootstrap-output.json` and writes a sibling `<timestamp>-bootstrap-output.error.json` carrying the validator error.
- **Re-bootstrap.** Re-running the render endpoint regenerates `bootstrap-prompt.md`; the user re-invokes Claude Code; a new `bootstrap-output.json` write triggers the same watcher path. T-D54's idempotent upsert handles row classification (new / reimported / conflicted / stale); no special re-bootstrap code path is required.
- **Init UX block.** SettingsView gains a per-project bootstrap block (alongside the C-D19 `.throughline/` missing-config component) surfacing bootstrap state: "no bootstrap output yet" / "ingested at `<timestamp>`: N new, M reimported, K conflicts" with a copy-paste invocation command. The block also surfaces quarantine state when present, linking the user to the error file. (2026-05-28 amendment per Phase 21 Slice 4 spec-author Q3 decision: at build time the spec-author elected to consolidate this surface with C-D19 surface 6 and C-D20 surface 5 into a single `BootstrapBlock` exported from `packages/frontend/src/views/SettingsView.tsx` rather than keep three sibling blocks. The "alongside" phrasing above describes the original design intent; shipped reality is one unified container holding the three previously-sibling subsections. See handover `docs/_meta/throughline/handovers/2026-05-28-phase-21-slice-4-unified-bootstrap-block.md`.)

### Rationale
Six surfaces is the minimum that delivers a bootstrap-producer cycle end-to-end against the existing backend without introducing a second AnthropicClient call site (Throughline does not call Anthropic for the bootstrap prompt; the user's Claude Code does), a backend-side subprocess for Claude Code (T-D56 explicitly defers), or any new persistence layer. The render endpoint, watcher, and worker each mirror an existing precedent: render reuses the bundle-resolver from C-D14 / C-D19; watcher mirrors `inbox/watcher.ts`; worker mirrors `inbox/worker.ts`. The `.throughline/` directory surface extension is additive — the directory already carries `project.json` and `bundle.md` per T-D51; bootstrap transient files (prompt, output, archive, quarantine) land alongside without renaming or restructuring.

### Implications
- The `docs/.throughline-schema.md` schema doc gains a "Throughline-managed transient files" section documenting `bootstrap-prompt.md`, `bootstrap-output.json`, `bootstrap-archive/`, `bootstrap-quarantine/`, and a Throughline-managed `.throughline/.gitignore` covering the transient paths so they never enter the user's git history.
- The bootstrap watcher and worker share the `appendAudit` audit pattern (`packages/backend/src/audit/log.ts`); per-row audit entries land via the ingest endpoint per C-D20. The producer side adds no new audit field shape.
- Quarantine files persist until the user clears them; the SettingsView init block is the user's surface for noticing and clearing them.
- Render-endpoint security: both the rendered prompt path and the declared output path live under `<repo_path>/.throughline/`; the repo root is canonicalised before injection so the output file cannot be redirected outside the project's repo. The render endpoint never writes outside `<repo_path>/.throughline/`.
- Future polish (subprocess-spawning Claude Code) lands as additional C-D anchors when T-D56 is amended; the file-watch path stays as the v1 floor either way.

---

## C-D22 — Source-vs-built export resolution for TS-source workspace packages

- **Status:** active (implementation-only)
- **Cites:** — (monorepo build hygiene; no governing T-D)

### Decision
Workspace packages that ship TypeScript source (`@throughline/shared`) declare a dual-condition `exports` map so the built `dist/` is runnable under plain `node`, while every development / typecheck / test / bundle path continues to resolve source directly with no build prerequisite for the dev loop:

```jsonc
// packages/shared/package.json
"main": "./dist/index.js",
"types": "./dist/index.d.ts",
"exports": {
  ".": {
    "types": "./src/index.ts",
    "development": "./src/index.ts",
    "default": "./dist/index.js"
  }
}
```

Resolution outcomes:
- `tsc` (NodeNext and Bundler) picks `types` → source; typecheck needs no prior build.
- Vite (serve) and Vitest set the `development` condition → source.
- Vite production build and plain `node dist/index.js` fall through to `default` → built `dist/`.
- `tsx` (backend `dev` / `start`) shares Node's `node` / `import` / `default` conditions, so it would otherwise resolve `default` → `dist`; the backend `dev` / `start` scripts pass `--conditions=development` to keep tsx on source. If a future tsx release stops honouring `--conditions`, the fallback is to build shared in a `predev` step.

### Rationale
Before this, `main` / `types` / `exports` all pointed at `./src/index.ts`. Every run path used `tsx`, so the breakage was latent — but `tsc` emitted a `dist/` nothing consumed, and `node dist/index.js` could not import the package (the `.js`→`.ts` mapping fails under plain Node). The dual-condition map fixes the misleading artifact and gives `dist/` a real consumer (the node runtime path) without forcing a build into the zero-build dev loop. Keying the split on the standard `development` condition (honoured by Vite/Vitest out of the box) rather than a bespoke condition keeps it composing with the existing toolchain.

### Implications
- Any future workspace package that ships TS source and is expected to be node-runnable from its build output adopts this same three-key (`types` / `development` / `default`) shape.
- Consumers that bypass `exports` (legacy tooling reading `main` / `types`) resolve `dist`, which exists after the package's `tsc` build — the base tsconfig sets `declaration: true`, emitting `dist/index.d.ts`.
- The root `build` script already builds `@throughline/shared` before the frontend/backend builds, so the `default`→`dist` path is satisfied by build ordering; no new build step is introduced.

---

## C-D23 — Central Fastify error handler + canonical `ErrorResponse` body shape

- **Status:** active (implementation-only)
- **Cites:** T-D58
- **Spans:** Phase B slice 1 (the `@throughline/shared` `DomainError` hierarchy) and slice 3 (this handler + the response body shape). Single anchor; the implementation deliberately crosses two slices.

### Decision
A single Fastify `setErrorHandler` (registered in `server.ts` immediately after the app is created, before any route) is the one place that turns a thrown domain error into an HTTP response. It lives in `packages/backend/src/http/error-handler.ts`. The handler:
- For any `err instanceof DomainError` (T-D58): replies `err.statusCode` with the canonical body `{ error: err.code, message: err.message, ...err.details }`.
- For any other thrown error: preserves Fastify semantics — an explicit `err.statusCode` (4xx) is kept; everything else is a logged 500. Body shape `{ error, message }`.

The canonical body is the `ErrorResponse` interface exported from `@throughline/shared` (`{ error: string; message?: string; [k: string]: unknown }`) — shared so frontend and backend reference one wire contract (partial progress on the wire-contract gap; full closure is Phase D).

Per-route `try/catch` blocks that hand-rolled domain-error → status mapping are deleted; routes `await` the service and let domain errors propagate. Inline pre-condition guards that `return reply.code(...).send(...)` directly (not via a thrown error) are unchanged — they never reached an error handler and still don't.

### Rationale
- **One mapping site eliminates status drift.** With the status on the error class (T-D58) and one handler reading it, the same error cannot return different statuses from different routes (audit SF6-09). The 63 hand-rolled blocks across 20 files collapse to one handler.
- **Only thrown errors route here.** No Fastify schema validation is in use, so inline `reply.code(...)` validation replies bypass the handler entirely and are untouched — keeping the blast radius to genuine thrown domain errors.
- **`details` carries context.** Errors that previously had route-added context fields (`duplicate_repo_path` → `repo_path`/`project_id`; `bundle_not_loaded` → `bundle_id`; `bundle_id_mismatch`; `invalid_project_config` → `path`; `cross_project_mutation` → `item_ids`; `validation_failed` → `errors`; `policy_violation` → `field`) now carry that context in `DomainError.details`, which the handler spreads into the body — preserving the responses.

### Implications
- New endpoints throw domain errors (defined in `@throughline/shared` or extending its base) rather than catching-and-mapping; no per-route error plumbing.
- Canonical `code` strings are the wire contract for the `error` field. The frontend currently does not branch on them (`jsonFetch` throws a generic `Error` on `!res.ok`), so the slice-3 normalization of generic `not_found` codes to specific ones is frontend-safe; this is verified, not assumed.
- Exceptions deliberately left route-local: `UndoError` (overloaded — 409 `undo_unavailable` in undo vs 404 `run_not_found` in approve — cannot carry one canonical status; its two `github/routes.ts` catches stay) and the generic-`Error` catches in `settings`/`notifier`/`backup` routes (they catch non-domain failures with bespoke handling).

---

## C-D24 — `useResource` / `usePolledResource` frontend data-fetching hook pair

- **Status:** active (implementation-only)
- **Cites:** —
- **Spans:** Phase C slice 1 (the hook pair + three proof adopters) and slice 2 (remaining adopters + consumer error rendering).

### Decision
Every frontend data hook is built on one of two primitives in `packages/frontend/src/hooks/useResource.ts`, both returning the single `ResourceState<T>` contract `{ data, loading, error, refresh }`:
- **`useResource<T>(fetcher, initial)`** — fetch once per `fetcher` identity and on `refresh()`. The canonical replacement for the hand-rolled `useState` triple + `alive` unmount guard + imperative refresh that every fetch-once hook repeated.
- **`usePolledResource<T>(fetcher, initial, intervalMs)`** — same contract, re-run on a fixed interval. Subsequent ticks do not toggle `loading` (no flicker); a successful tick clears a prior `error`, a failed tick sets it.

The `fetcher` is `(() => Promise<T>) | null`; callers build it with `useMemo` keyed on the inputs it closes over, and pass `null` to mean "disabled — reset to `initial`". The hook owns the `alive` guard, error capture (`e instanceof Error ? e : new Error(String(e))`), and a stable `refresh`.

### Rationale
- **The `error` slot was the SF6 surface.** SF6-01..12 were all instances of the same shape: hooks exposed (or silently dropped) an `error` that consumers never rendered. Owning the triple once makes the error slot uniform and unavoidable, so consumers can rely on a single contract rather than each hook inventing its own (some exposing `error`, some swallowing to empty/`EMPTY`).
- **One unmount-guard pattern.** The `let alive = true; … return () => { alive = false }` idiom was copied across six-plus hooks; centralising it removes the per-hook drift and the chance of a missed guard.
- **`useMemo`-nullable fetcher, not `enabled` flag.** A `null` fetcher both disables the fetch and types the "no input yet" case (e.g. `projectId === null`) without threading a separate boolean or asserting non-null inside the fetcher body.

### Implications
- New data hooks wrap a memoised fetcher in `useResource` / `usePolledResource` rather than re-deriving the triple; consumers read `error` and render it.
- An unmemoised fetcher re-fetches every render — the one footgun, documented at the call site.
- Polled hooks that previously swallowed errors silently (`useCostMeter`, `useBackupStatus`) adopt `usePolledResource` in slice 2, gaining an `error` slot without changing their poll cadence. `useBackendHealth` is a deliberate exception: a failed `/health` request *is* its datum (it maps to `healthy: false`, the banner), not an error to surface, so it keeps its bespoke shape.

---

## C-D25 — System-state visibility component (`HealthStatus`, tri-state healthy/degraded/absent, rendered in-context)

- **Status:** active (implementation-only)
- **Cites:** T-D60 (refuse-rather-than-fallback kinship); LBD-2 (the spec-author ruling this encodes); SF2-02 / SF2-06 (the silent failures it surfaces)
- **Spans:** Phase E slice E6.

### Decision
A single shared presentational component, `packages/frontend/src/components/HealthStatus.tsx`, renders a capability's tri-state health — `healthy` / `degraded` / `absent` (`HealthState` in `packages/shared/src/health.ts`) — **in-context, beside the feature it concerns**, deliberately **not** as a consolidated "system health" panel (LBD-2). The caller fetches the state (via `useResource` / a polled hook, C-D24) and passes the resolved `state` plus a `label` and optional `detail` (the honest "why" — a parse error, a job's `last_error`). The three states are distinct on purpose: `degraded` (bound-but-broken) must read differently from `absent` (legitimately not in use) — the distinction the silent failures erased.

### Rationale
- **One component, many surfaces.** E6 renders it for per-project methodology bundle health (SF2-02/SF2-06 — `degraded` for a bound-but-broken bundle vs `absent` for a freeform project) and for background-job loop health (the C-D26 data, E5); E7 reuses it for the bootstrap quarantine surface. A single component keeps the tri-state vocabulary and styling uniform rather than each surface inventing its own.
- **In-context, not consolidated (LBD-2).** Health renders beside the feature it concerns so the user sees it where they act, not in a separate dashboard they must think to visit.
- **Presentational / fetch-agnostic.** The component owns no fetching; it takes a resolved `state`, so it composes with the C-D24 hooks and any future health source without coupling.

### Implications
- New capability-health surfaces render `<HealthStatus state=… label=… detail=… />` rather than a bespoke badge; the backend supplies a `HealthState` (or a shape that maps to one).
- The frontend visibility layer (C-D25) and the backend data model (C-D26) are **separate anchors** (LBD-3): the component evolves with UI concerns, the model with backend concerns.
- `degraded` carries `role="alert"` so a bound-but-broken capability is announced, not merely styled.

---

## C-D26 — Background-job health model (`lastRunAt` / `lastError` / `healthy` per loop)

- **Status:** active (implementation-only)
- **Cites:** T-D60 (refuse-rather-than-fallback kinship); SF5-01/02/04 (the silent-failure findings it closes)
- **Spans:** Phase E slice E5.

### Decision
Each long-running background loop (the backup scheduler, the reminder scheduler, the GitHub poller) owns a `JobHealth` tracker (`packages/backend/src/health/job-health.ts`) holding `{ last_run_at, last_error, healthy }`. The loop calls `recordSuccess(now)` after a clean tick and `recordFailure(now, err)` after a tick that threw; a `JobHealthRegistry` collects every tracker and `GET /api/background-jobs/health` returns the snapshot as the shared `BackgroundJobsHealthResponse` (`packages/shared/src/health.ts`).

The granularity is **one health record per loop** (not per project / per reminder). The reminder loop's health reflects only a *thrown* tick failure — a graceful non-delivery (the notifier reporting `unavailable` / `failed`, T-D60 / E4) is the notifier's capability state, not a scheduler fault, and does not flip `healthy`.

### Rationale
- **The silent failure SF5-01/02/04 was the absence of state.** All three loops caught-and-logged: a loop that started failing every tick was indistinguishable from a healthy idle loop, because no field anywhere recorded the failure. C-D26 makes the failure a typed, queryable fact — the backend half of the refuse-rather-than-fallback principle (T-D60) for background work.
- **Backend data layer, distinct from the C-D25 frontend convention (LBD-3).** The model (`last_run_at` / `last_error` / `healthy`) and the visibility component (C-D25, the in-context tri-state renderer minted in E6) have independent evolution pressure, so they are separate anchors. E5 lands the model + route; E6's C-D25 renders it (and bundle-health) in-context.
- **Optimistic initial state.** A tracker starts `healthy: true` with `last_run_at: null` — "no failure observed, not yet run" — rather than asserting a health it cannot yet know.

### Implications
- New background loops take an optional `health?: JobHealth` and record success/failure per tick; the registry and route pick them up with no route change.
- `GET /api/background-jobs/health` is the single read surface; the E6 C-D25 component consumes it to render per-loop health beside the features each loop drives.
- Health is most-recent-tick semantics: the poller (per-project, concurrent) reflects the latest poll's outcome, surfacing the most recent `last_error`.

---

## 1. Process model

```
┌─────────────────────────┐    SSE + REST    ┌─────────────────────────┐
│  Browser UI (React)     │ ◄──────────────► │  Backend (Node.js)      │
│  http://127.0.0.1:PORT  │                  │  - persistence (SQLite) │
└─────────────────────────┘                  │  - methodology runtime  │
                                              │  - file watching        │
                                              │  - polling (GitHub)     │
                                              │  - reminders            │
                                              │  - Anthropic / GitHub   │
                                              │  - OS notifications     │
                                              └────────────┬────────────┘
                                                           │ execFile per query (C-D17)
                                                           ▼
                                              ┌──────────────────────────┐
                                              │  Semble CLI (on demand)   │
                                              └──────────────────────────┘
```

Backend exposes:
- `GET /` — serves the React UI.
- `GET /api/projects` — list, switch, archive, delete (T-D40).
- `GET /api/projects/:id/...` — project-scoped REST endpoints for entity CRUD.
- `GET /api/methodologies` — list loaded bundles + their parsed identity sections.
- `GET /events` — SSE stream for backend-pushed updates (drift signals, gate firings, cost meter, polling state, bundle reloads).
- `POST /api/...` — mutations.

Bind to `127.0.0.1` only (T-D31 implication: no external network).

The methodology runtime is a backend subsystem composed of: bundle loader (C-D4), gate dispatcher (C-D6), discipline-drift engine (C-D7), companion workflow engine (C-D8), and session-start pipeline (C-D9). Each project has a `LoadedBundle` reference cached in memory; bundle file changes trigger re-load and re-instantiation of project-bound scanners.

---

## 2. Bundle loading & runtime configuration

Bundle discovery on backend start:

1. `fs.readdir('methodologies/')` — for each directory, look for `bundle.md`.
2. Parse each `bundle.md` per C-D4.
3. Store `LoadedBundle` objects in an in-memory registry keyed by bundle directory name.
4. For each project in `projects`, resolve its bundle (C-D14: `bundle_path/bundle.md` if set, else `methodologies/<bundle_id>/bundle.md`) against the registry; if missing or malformed, project state goes to `bundle-error` and the UI surfaces a banner with the error.
5. Re-register external-bundle watch targets for every project already carrying a `bundle_path` (C-D14).

Live bundle reload: `chokidar` watches `methodologies/**/bundle.md` plus every project's external `bundle_path/bundle.md` (C-D14, refcounted by binding). On change:
- Re-parse the bundle.
- If parse succeeds, swap the registry entry, re-instantiate all project-bound scanners (C-D7) and re-resolve gates (C-D6), and write an audit-log entry per affected project recording the bundle change.
- If parse fails, leave the old `LoadedBundle` in place and surface the validation error in the UI.

The freeform bundle's typed parsers must accept "declares no primary unit / no anchors / no markers / no gates / no companion modes" as legitimate output; downstream subsystems treat absence as no-op rather than malformed (T-D47).

---

## 3. Persistence

### Schema sketch (SQLite)

Tables (one row per record unless noted):

| Table | Notes |
|---|---|
| `projects` | C-D5 — `id`, `name`, `repo_path`, `github_owner`, `github_repo`, `bundle_id` (non-nullable, T-D47), `bundle_path` (nullable, C-D14), `state`, `settings_json`, timestamps. |
| `items` | per §7.4; `id`, `project_id`, `type` (bundle-defined), `title`, `description`, `status` (bundle-defined), `blocker_text`, `parent_id`, timestamps. |
| `item_tags` | join: `item_id`, `tag`. |
| `item_blockers` | structured blocker refs (T-D8): `item_id`, `blocked_by_item_id`. |
| `item_session_memberships` | many-to-many (T-D1): `item_id`, `session_id`. |
| `item_primary_unit_refs` | T-D39, §7.3: `item_id`, `primary_unit_ref`. Empty for freeform-bound projects. |
| `item_phase_refs` | which phase the item is in per bundle's state machine: `item_id`, `phase_id`. |
| `item_anchor_citations` | which methodology-anchored decisions the item cites: `item_id`, `anchor_id`. |
| `item_marker_refs` | which marker types apply to the item: `item_id`, `marker_id`. |
| `item_pr_associations` | T-D34, T-D38: `item_id`, `pr_number`, `repo`, `auto_detected_at`. |
| `item_branch_ref` | T-D38 free-text branch reference; can live as a column on `items` rather than a side table. |
| `item_code_refs` | Semble-confirmed locations (§7.15): `item_id`, `path`, `line_start`, `line_end`, `summary`. |
| `item_verifier_rules` | §7.16: `item_id`, `rule_path`, `rule_id`, `last_status`, `last_run_at`. |
| `item_attached_notes` | many-to-many (T-D9): `item_id`, `library_entry_id`. |
| `sessions` | view definitions: `id`, `project_id`, `name`, `branch_ref`, `context`, `settings_json`. |
| `library_entries` | T-D10: `id`, `project_id`, `type` (note/prompt/snippet/imported_doc), `title`, `body`, `tags_json`, timestamps. |
| `directives` | T-D12: `id`, `parent_type` (item/library), `parent_id`, `kind` (pin/reminder/include_prompt), `payload_json`, `next_fire_at`. |
| `audit_log` | T-D36: `id`, `timestamp`, `project_id` (nullable for global entries), `entity_type` (item/library/project/bundle_binding/gate_firing/checklist_step), `entity_id`, `actor`, `field`, `old_value`, `new_value`, `trigger_context_json`. |
| `chat_history` | T-D23: `id`, `project_id`, `context_type`, `context_id`, `role`, `content`, `created_at`. |
| `drift_signals` | C-D7 — shared by code and discipline streams via `stream` discriminator. |
| `gate_firings` | C-D6: `id`, `project_id`, `moment`, `gate_id`, `status`, `findings_json`, `created_at`. |
| `checklist_runs` | C-D8: `id`, `project_id`, `checklist_id`, `state`, `started_at`, `completed_at`. |
| `checklist_run_steps` | C-D8: `run_id`, `step_id`, `state`, `findings_json`, `transitioned_at`. |
| `orphaned_rules` | T-D33: `id`, `project_id`, `rule_path`, `original_item_id`, `created_at`, `dismissed_at`. |
| `text_embeddings` | C-D2: `entity_type`, `entity_id`, `chunk_index`, `embedding_blob`. |
| `cc_inbox_queue` | T-D16: `id`, `original_path`, `received_at`, `state` (queued/processed/failed), `error_text`. |
| `cost_telemetry` | T-D29: `id`, `project_id`, `timestamp`, `feature`, `model`, `input_tokens`, `output_tokens`, `usd_estimate`. |
| `github_state_cache` | T-D7: `repo`, `pr_number`, `etag`, `last_payload_json`, `last_polled_at`. |
| `settings` | key-value store excluding API keys (T-D4); per-project overrides live under `projects.settings_json`. |

API keys (T-D4) live in a separate config file at a backend-only path (e.g., `~/.config/throughline/secrets.json`), never written to SQLite, never read by browser code.

### Schema migrations

Numbered SQL files run in order on backend start. Each migration recorded in a `_migrations` table to prevent reapplication. A migration that requires data transformation runs in a single transaction.

### Identifiers

`nanoid`-style stable identifiers per record (per §8 "Stable identifiers per record, generated locally"). Verifier rule files named by item identifier per the bundle's declaration; a rich bundle might declare `{item_id}.yml` (T-D26).

---

## 4. External integrations

All outbound HTTPS originates from the backend (T-D31).

| Integration | Implementation |
|---|---|
| **Anthropic** | `@anthropic-ai/sdk`. Per-feature model selection (§9). Cost telemetry written per call (T-D29). Prompt fingerprint hashed and recorded; full prompt never persisted (T-D24). |
| **GitHub** | `@octokit/rest`. ETag-cached polling per T-D7. Cadence: 60s for active sessions, 5min otherwise. PR-open gate enforcement reuses the gate dispatcher (C-D6) with moment `pr-open`. |
| **Semble** | Backend invokes the `semble` CLI per query via `execFile` (C-D17, T-D27) — same one-shot child-process precedent as `github/local-git.ts`, `github/pr-linking.ts`, `methodology/gates/hook-installer.ts`, `methodology/gates/checks.ts`. No long-lived subprocess, MCP transport, or socket. Keyless (T-D27); command from `THROUGHLINE_SEMBLE_CMD` (default `semble` on `PATH`). |
| **Semgrep** | No direct integration. Backend reads Semgrep findings from PRs via GitHub API; bundle declares rule conventions (T-D26). |
| **OS notifications** | Single backend capability layer per T-D32. Implementation: `node-notifier` for the cross-platform path; platform-specific shell-outs as fallback if `node-notifier` falls short on a target OS. |

---

## 5. Capture surfaces

Capture lands in the active project (URL prefix `/projects/:id/...`). Bundle-aware extraction: the dump zone extraction call tells the AI which item types the bundle declares for the active project.

| Surface | Implementation |
|---|---|
| **Scratchpad** (T-D20) | Header component with always-visible textarea. Saves to a `scratchpad_jots` table (or a single growing record). No AI, no review. |
| **Manual entry** | Inline item form per board. Item types come from the bundle's project-layout section. |
| **Session dump zone** | POST to `/api/projects/:id/dump-zone/process`. Backend calls Anthropic for extraction parameterised by the project's loaded bundle. Returns a proposed-items payload. UI shows review modal; user applies (T-D5). |
| **Library dump zone** | Same paradigm scoped to library entries. |
| **Voice input** | Browser-native `SpeechRecognition`. Desktop-only in v1 (§7.6). Transcript pipes into the dump zone flow. Destination selection (session vs library) per §7.6. |
| **Claude Code push** (T-D16) | `chokidar` watches the inbox directory. New files enqueue into `cc_inbox_queue`. Worker drains the queue: extracts, runs through dump zone flow against the project inferred from the inbox-file convention, archives on success or quarantines on failure (T-D37). |
| **Code TODO/FIXME import** | Manual trigger in v1 (§13 default adopted). User invokes; backend scans the configured project repo path for `TODO:`, `FIXME:`, `XXX:` (defaults from §13); proposes as items via review flow. |

The Claude Code inbox-to-project mapping convention is a build-time decision: inbox files name the target project in a header line or filename prefix, defaulting to the last-active project if absent.

---

## 6. Reconcile engine

Implements the six-category diff (T-D35):

```
input ─► Anthropic (extraction + classification, bundle-parameterised)
             │
             ▼
       proposed-diff JSON
             │
             ├─ completed   ─►  user reviews ─► applies + audit-log
             ├─ new         ─►  user reviews ─► applies + audit-log
             ├─ edited      ─►  user reviews ─► applies + audit-log   (covers title and description under one row)
             ├─ blocker     ─►  user reviews ─► applies + audit-log
             ├─ no-change   ─►  user reviews ─► no-op
             └─ contradicted ─► spawn drift signal (T-D21), do NOT revert
```

GitHub-merge auto-reconcile (T-D6, T-D18) bypasses review for high-confidence with audit + 24h undo. Confidence scoring stored in `audit_log.trigger_context_json`.

Contradicted-as-drift writes a `drift_signals` row with `stream='code'`, `category='tier-2'` if the item has a PR association, else `'tier-3'`.

---

## 7. Methodology gate runtime

Per C-D6. Phase-moment triggers in v1:

| Moment | Trigger mechanism (v1 implementation) |
|---|---|
| `pre-write` | Claude Code POSTs a pre-write message to the local-loopback gate-trigger channel (SPEC §7.12), plus an explicit UI action ("Run pre-write checks on this slice"). Best-effort delivery. |
| `per-commit` | Either an item state transition (internal) or a git pre-commit hook POSTing to the loopback channel (SPEC §7.12). Both fire the same gate. Durable delivery via the hook event queue. |
| `plan-mode` | Claude Code POSTs a plan-mode message to the loopback channel (SPEC §7.12). Best-effort delivery. |
| `post-commit` | A git post-commit hook POSTs to the loopback channel (SPEC §7.12). Durable delivery via the hook event queue. |
| `pr-open` | GitHub poller detects a newly opened PR on a tracked branch; dispatches to the gate runtime with `moment='pr-open'`. |

Each moment resolves the bundle's `gates_by_moment[moment]` (zero or more `GateSpec`). Gates run independently per C-D6.

The loopback channel is `POST /api/gate-trigger` (`{ moment, project_id?, repo_path?, head_sha? }`); the server already binds `127.0.0.1` only (T-D31) so the channel is loopback by construction. Each moment resolves `gates_by_moment[moment]` and runs each gate independently, writing one `gate_firings` row + one audit-log entry (`entity_type='gate_firing'`, `actor='methodology_runtime'`) per firing. `pr-open` is exposed as `runMoment(project, 'pr-open')` for the Phase-10 poller to drive.

Mechanical gate execution: a `GateSpec` is dispatched by gate-id keyword to a built-in generic check primitive (banned-string sweep / structural / anchor-resolution / blocking-marker / script-spawn) driven off the bundle's typed sections — full mechanism and rationale in **C-D15**. Scripts execute via `child_process`; sweeps and validators run in-process over the bundle's declared doc surface under `repo_path`.

Judgement gates: Anthropic call parameterised by the gate description + a project-state digest. Model `claude-sonnet-4-6` as a hardcoded factory default-parameter, matching the existing AI factories (dump-zone extractor, reconcile engine, md-ingest summariser) — no settings/env read. Audit row carries model + prompt fingerprint only (T-D24); a `cost_telemetry` row is written (T-D29).

Findings surface in the methodology-gates view; UI shows per-gate pass/fail with override (audit-logged reason + original findings ref) + fix-and-retry (re-run the moment) actions (T-D44).

**Hook path resolution.** Throughline resolves the active hooks directory via git's canonical path-resolution mechanism (`git rev-parse --git-path hooks`) rather than joining `repo_path` with `.git/hooks`. This correctly handles linked worktrees, submodules whose `.git` is a gitdir pointer file, and `core.hooksPath` overrides (e.g., Husky). The Phase-8 implementation invokes `git` directly via `child_process` for this single one-shot path query rather than adding the `simple-git` dependency (still planned for §12's branch-read use); the resolution behaviour is identical. Installed hooks are advisory, non-blocking (always `exit 0`), and chain a pre-existing hook preserved as `<hook>.local` rather than replacing it (SPEC §7.12 hook collision policy). Consent is the per-project `settings_json.install_gate_hooks` flag; install is idempotent and re-applied at startup for consented projects; failure is audit-logged and non-fatal.

**Port stability for hook scripts.** The backend's bound port can change between runs (configurable; tests bind ephemeral ports). Installed hook scripts therefore do not embed the port. The backend writes its current bound URL to `<dataDir>/runtime.json` on startup; hook scripts read that file at fire time (and fall back to the durable queue if it is absent or the POST fails). A port change requires no hook reinstall.

**Hook event queue.** When a hook fires and the backend is unreachable, the hook appends the event to a durable on-disk queue: one file per event under `<dataDir>/gate-hook-queue/`, named `<timestamp>-<nanoid>.json`, containing `{ moment, repo_path, head_sha?, fired_at }`. On startup the backend drains this directory before serving — reading each file, resolving the repo to a project, dispatching the corresponding gate, then deleting the file on success or moving it to a sibling `failures/` subdirectory with an `.error.json` companion on failure. This mirrors the Phase 4 inbox watcher's queue-drain-on-startup and quarantine-on-failure pattern (`packages/backend/src/inbox/`), reusing its serial-drain and dated-archive idioms where they apply.

---

## 8. Discipline-drift engine

Per C-D7. Scanner instantiation happens at bundle load per project. Scanners watch the project's `repo_path` via `chokidar`, scoped to doc files declared in the bundle's project-layout section.

For each declared discipline-drift category, a scanner is registered with:
- A trigger set (file-change globs, explicit re-scan, pre-write moment).
- A check function (regex sweep, structural validator, cross-reference resolver, etc., per the category's declaration in the bundle's validation-rules section).
- A finding payload schema.

Findings write to `drift_signals` with `stream='discipline'`, `category=<bundle-category-name>`, and optional `item_id` or `primary_unit_ref` to scope the signal.

Surfaces:
- Methodology-gates view shows category-grouped lists.
- Modules view shows badges on affected primary units.
- Item detail panel and list rows show a `methodology-drift` indicator for items associated with affected primary units.

For freeform-bound projects (zero declared categories), scanner registration is a no-op.

---

## 9. Code-drift pipelines (four tiers)

| Tier | Trigger | Action |
|---|---|---|
| 1 | Semgrep finding read from GitHub API matching `item_verifier_rules.rule_id` | Update `last_status`; insert `drift_signals` row with `stream='code'`, `category='tier-1'`; UI badges item red. |
| 2 | GitHub revert event polled on a PR in `item_pr_associations` | Insert `stream='code'`, `category='tier-2'`; UI badges item orange. |
| 3 | New PR's changed files overlap `item_code_refs.path` | Insert `stream='code'`, `category='tier-3'`; UI badges item yellow. |
| 4 | New dump zone item ≥ 0.80 cosine similar to a done item (recommended default §13 adopted; AI confirmation 0.70–0.80) | Insert `stream='code'`, `category='tier-4'`; routes to drift inbox; auto-dismiss after 7 days with audit-logged reason. |

Strong tiers (1–3) badge items directly. Tier 4 routes to inbox per T-D21.

---

## 10. Companion review workflow engine

Per C-D8. Bundle-declared checklists instantiate as `ChecklistRun` records. Mechanical steps execute via the same pipeline as mechanical gates (regex, scripts, validators); judgement steps open a UI panel with optional AI-via-Anthropic judgement.

Step state machine:

```
pending ─► in-progress ─► passed | failed | skipped
```

Run state machine:

```
not-started ─► running ─► completed | aborted
```

A completed run optionally generates a library-note summary (T-D10) attached to the items discussed during the run.

---

## 11. Session-start scaffolding

Per C-D9. Endpoint: `POST /api/projects/:id/session-start-prompt`.

Pipeline:
1. Resolve companion mode (user choice or bundle default).
2. Gather context — query project state for relevant decisions, anchors, markers, execution-plan slice, dependencies, include-in-prompt directives.
3. Anthropic Haiku call for relevance classification (per SPEC §9).
4. Render via the bundle's templates section for the chosen mode.
5. Return prompt string for UI copy-to-clipboard.

Cost telemetry recorded per call.

---

## 12. Manual item-to-PR linking (T-D34)

Sequence on manual done-marking:
1. Read active branch via `simple-git` from the configured project repo path.
2. Look up branch's PR via GitHub API.
3. Propose; user accepts, picks another, or skips.
4. Result written to `item_pr_associations` (or omitted on skip).

---

## 13. Orphaned rule lifecycle (T-D33)

Item delete:
1. Read `item_verifier_rules` for the item.
2. For each rule, insert into `orphaned_rules` with `original_item_id` and `rule_path`.
3. Delete `item_verifier_rules` rows; do NOT touch the file in the repo.
4. Surface in periodic review (T-D22) and settings panel.
5. PR-draft action: backend constructs a branch + commit removing the file via Octokit; opens a PR; URL returned to user.

---

## 14. AI integration

Per-feature model defaults (per SPEC §9). Settings (§7.25) allow per-feature override.

| Feature | Default model |
|---|---|
| Dump zone extraction | `claude-sonnet-4-6` |
| Reconcile diff generation | `claude-sonnet-4-6` |
| Per-list chat | `claude-sonnet-4-6` |
| End-of-session retro | `claude-sonnet-4-6` |
| Personal RAG (text) | `claude-sonnet-4-6` |
| Plain-English code Q&A | `claude-sonnet-4-6` |
| Semantic dedup similarity | `claude-haiku-4-5` |
| Drift re-verify | `claude-sonnet-4-6` |
| AI tag suggestion | `claude-haiku-4-5` |
| Stakeholder view rendering | `claude-sonnet-4-6` (cached) |
| Mermaid generation | `claude-sonnet-4-6` |
| Verifier rule drafting | `claude-sonnet-4-6` |
| Companion review (judgement steps) | `claude-sonnet-4-6` |
| Session-start prompt assembly | `claude-haiku-4-5` |

Cost telemetry (T-D29) writes a `cost_telemetry` row per call: input tokens, output tokens, model, USD estimate (computed from a small price-table constant), feature, project_id.

Audit log entries for AI-actor changes record `model` and a `prompt_fingerprint` (hash) — never the full prompt content (T-D24).

---

## 15. Personal RAG (T-D25)

Three substrates, one router. Queries are project-scoped by default with explicit cross-project toggle.

| Substrate | Index | Query path |
|---|---|---|
| Text (C-D2) | `text_embeddings` | Embed query, top-k cosine over library entries + item descriptions + ingested project doc chunks for the active project, summarise via Anthropic. |
| Code (Semble) | Semble's per-project index | Backend → Semble → relevant chunks → summarise via Anthropic. |
| Audit history | SQL on `audit_log` | Structured query scoped by `project_id` (or global with cross-project toggle). |

Router (per §13 recommendation, adopted): keyword heuristics first ("where is X" → code, "when did" → audit, default → text), with user-overridable per-query toggle. AI classification deferred unless heuristics prove inadequate.

---

## 16. Audit log

Single `audit_log` table per T-D36; `entity_type` discriminator spans items, library entries, projects, methodology bundle bindings, gate firings, and checklist steps. Every state change inserts a row. Trigger context records:
- For user actions: `actor: "user"`, `client: "browser"`.
- For AI actions: `actor: "ai"`, `model`, `prompt_fingerprint`, `confidence_score?`, `feature`.
- For GitHub auto-apply (T-D6): `actor: "ai_auto_apply"`, `pr_number`, `pr_description`, `confidence_score`, `model`.
- For inbox processing: `actor: "inbox_worker"`, `inbox_file_id`.
- For gate firings (T-D36): `actor: "methodology_runtime"`, `moment`, `gate_id`, `status`.
- For bundle reloads: `actor: "bundle_loader"`, `old_version`, `new_version`.
- For overrides (T-D44): `actor: "user"`, `override_reason`, `original_findings_ref`.

Never write API keys, never write full prompt content (T-D24).

---

## 17. Backup (T-D28)

- Manual export: `POST /api/backup/export` returns the SQLite file as a download with timestamped filename. API keys (T-D4) live elsewhere and are not included. The `methodologies/` directory is not part of the backup (C-D3 — bundles ship with the install).
- Auto-copy: cron-style scheduled job in the backend; copies the datastore file to `settings.auto_copy_target_path` if set.
- Header indicator: red after `settings.backup_threshold_days` (default 7) without a backup.

---

## 18. Frontend implementation

Nine view modes per SPEC §7.11 (T-D30 for home). Routes:

```
/projects                                — projects view (T-D40)
/projects/:id                            — home view for that project (default landing within a project)
/projects/:id/sessions/:session_id       — session view
/projects/:id/modules                    — primary-unit-grouped (hidden if bundle declares no primary unit)
/projects/:id/tree
/projects/:id/graph
/projects/:id/library
/projects/:id/directives
/projects/:id/methodology-gates          — hidden if bundle declares no gates
```

- **Command palette** (§7.24): `Cmd+K`/`Ctrl+K`; fuzzy search via `fuse.js`; jumps to entities or runs commands across projects.
- **Keyboard navigation**: Tab/Shift-Tab indent, arrow nav, Enter edit, Esc close, `?` reference. Implemented via a centralised key-binding layer.
- **Graph view**: implemented as a dependency-free, deterministic SVG renderer over a pure layout module (`views/graph/layout.ts` → `views/GraphView.tsx`) rather than `cytoscape.js` — the CODE_SPEC's "or similar" latitude, chosen because the runtime is offline/ephemeral (no registry guarantee) and a deterministic SVG layout is reproducible and jsdom-testable. Nodes are items; edges are parent-child (`parent_id`), structured blockers (`blockers[]`, T-D8) and **mentions** (`mentions[]` — Phase 17). "Show chains" highlights blocker dependency paths and structural root blockers. Mentions are a derived projection of description text: a user references another item with the explicit `@item:<id>` token (21-char nanoid); the backend re-parses on every `items.create`/`items.update` (same-project resolution, self-ref dropped, unchanged-set short-circuit) and stores them in the `item_mentions` join table mirroring `item_blockers` (migration `0011_phase17_mentions.sql`). Mention edges are non-structural — excluded from longest-path layering and "Show chains". The detail-panel "Linked items" §7.17 relations (parents/children/mentioning/mentioned) are served by `GET …/items/:itemId/links` (`items.links()`, batched `WHERE id IN (...)`). The **communication-model fourth layer (§7.11)** lands in Phase 18 (T-D49, T-D50, C-D18): a "Show communication model" toggle swaps the canvas to a module-level graph with tier swimlanes, rule-level edges (mediated edges rendered as two arrows through the mediator), and a `ModulePanel` side panel; toggle hidden for bundles whose §6 is `none`. SPEC §7.11/§7.17 functional ratification of the mention model is a separate follow-up clarification PR (implementation settled first; not silently edited); §7.11's communication-model wording is updated in PR #31 itself (the grammar+render scope is the spec answer to WN-1b-b). The §11 DoD bullet ("nine view modes functional and switchable") is satisfied by the functional item graph; the comm-model layer is a fourth layer on the same view, not a separate mode. Visual layer adopts the design-handoff "Direction A · dark" tokens **scoped to `.graph-view`** (`views/graph/graph.css`, `--gv-*` namespace); the full design-system adoption (theme.css swap, sidebar, settings keys, SSE hot-reload) is a separate redesign pass (WN-1b-c).
- **Item detail panel** (§7.17): right-side slide-in. Arrow keys move through parent list with panel staying open. Stale yellow flag in header per T-D46.
- **Stale-item indicator** (T-D46): yellow flag next to item titles in all list views (session boards, tree view, search results).
- **Modules view** rendering depends on bundle: tier classification, current phase, gating state, anchor count, marker count come from the bundle's project-layout + state-machine + anchor + marker sections.

---

## 19. Settings & config

Settings UI exposes (mirrors §7.25):
- Anthropic API key (writes to backend secrets file, T-D4).
- GitHub PAT (writes to backend secrets file, T-D4).
- Per-project local repo path.
- Per-project methodology bundle binding (default freeform per T-D47).
- Default model selector + per-feature overrides.
- Stale threshold (days).
- Backup nudge interval + auto-copy target.
- Periodic review interval.
- GitHub default `owner/repo` per project + per-session branch fields.
- Claude Code inbox directory + archive retention.
- OS notification permission (one-time grant button).
- Cost meter daily threshold (default value: see Questions for the spec author).
- Orphaned rules panel.

---

## 20. Templates shipped with Throughline

| Template | Location | Purpose |
|---|---|---|
| Freeform methodology bundle | `methodologies/freeform/bundle.md` | T-D41, T-D47 — minimum-spec default bundle. |
| Test-bundle fixture | `methodologies/test-bundle/bundle.md` | Generic, business-neutral grammar fixture (multiple item types, per-type lifecycles, multi-gate moment, anchors, markers). Not a real methodology; ships for runtime/tests only. User bundles live outside the repo via `bundle_path` (C-D14). |
| Semgrep GitHub Actions workflow | `templates/github-actions/throughline-semgrep.yml` | T-D26 — recommended workflow for users to add to their repo. |
| Claude Code session-start prompt template | `templates/claude-code/session-start.md` | §16 — starter prompt for new sessions. |

---

## 21. Build / dev tooling (implementation-only)

- `pnpm` workspaces.
- `tsc --noEmit` for type-checking; `vite build` for the web; `tsup` or plain `tsc` for the backend.
- `vitest` for unit tests; `playwright` for end-to-end UI tests once UI lands.
- `eslint` + `prettier`.
- No CI in this repo for v1 (single-user tool); Semgrep CI lives in the user's *target* repo, not this one.

---

## Questions for the spec author

These are SPEC.md v5.1 gaps that came up during this regeneration. Each is too thin to derive from with confidence; the recommended action is a short SPEC.md amendment.

1–4. **Gate trigger mechanisms** — resolved per SPEC §7.12 amendments: single local-loopback transport; Claude Code sends plan-mode/pre-write, git hooks send per-commit/post-commit; consented idempotent hook install; best-effort (Claude Code) vs durable (hook queue) delivery.
5. **Bundle markdown convention** — resolved per SPEC §7.1 (Q5). The eleven-section H2 grammar (`## 1. Identity` … `## 11. Authority hierarchy`, canonical order, parser-dispatched, structural-validation on out-of-order/missing/duplicate) is ratified as built (C-D3). v1 ships one `bundle.md` per directory; multi-file bundles (bundle.md as manifest) are a documented v2 possibility.
6. **Companion modes ↔ review patterns relationship** — resolved per SPEC §7.18 (Q6). A companion mode is a bundle-declared identifier in the review-patterns section; its v1 runtime effect is session-start template selection only, default = first-declared mode (C-D9). Richer coupling (mode-gated checklists, mode-scoped context, mode-derived phase) is explicitly deferred to a worked example, not template-only forever.
7. **Verifier-tool plurality** — resolved per SPEC §7.16 (Q7). The integration boundary is the GitHub Checks annotation contract; the bundle defines the rule-identifier convention; the match is annotation-generic and not Semgrep-hardcoded (C-D16). Semgrep is the v1 reference/recommended tool. SPEC §7.16 and T-D26 are reconciled under this boundary.
8. **Voice input language default** (§13). Open question without a recommendation. Implementation needs a default for the speech-recognition `lang` parameter on first launch. Recommendation request: pick one.
9. **Cost meter daily threshold default value** (§13, §7.25). Spec says "pending real usage data." Settings panel needs a starting default. Recommendation request: pick a placeholder value (e.g., $5) or explicitly default to "no threshold / never warn."
