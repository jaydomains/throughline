# Throughline v1 — Code Specification

This document is the **technical implementation spec** for Throughline v1. SPEC.md is authoritative for *what* and *why*; this file is authoritative for *how*. Where SPEC.md fixes a decision, this file derives from it. Where SPEC.md is silent or vague, this file is implementation-only and labelled as such.

If a SPEC.md statement turns out to be too vague to derive implementation from, the gap is surfaced under [Questions for the spec author](#questions-for-the-spec-author) at the end of this file rather than guessed.

## Anchor convention

Implementation-level decisions in this file use `C-D{n}` anchors (Code Decision). They are distinct from `T-D{n}` anchors in SPEC.md §14 (which remain canonical at 48). C-D anchors are referenceable from code comments, PR descriptions, and other docs.

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
- **Process boundaries:** Throughline backend, Semble local service (T-D27, lifecycle-managed by backend), browser. No other long-lived processes.

### Rationale
TypeScript on both ends shares types between API and UI without an IDL layer. Node.js has mature support for filesystem watching, child-process supervision (Semble), and HTTP servers. SQLite is the canonical single-file datastore. Fastify is fast, opinionated about plugins, and ergonomic for the kind of REST + SSE the backend needs.

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

Throughline v1 ships with `methodologies/sitemesh/bundle.md` and `methodologies/freeform/bundle.md`. Additional bundles are dropped into the same directory.

### Rationale
Single-user, install-shipped bundles do not need a per-user authoring path in v1 (T-D41). Install-root `methodologies/` keeps bundles co-located with the artefact they configure and makes them a first-class deployable. A fixed H2-heading convention lets the parser dispatch each section to a typed handler without negotiating ordering or hierarchy. A single bundle.md per directory keeps reasoning about "what is a bundle" trivial; future bundles that want to split content across files can do so under their directory with the bundle.md as the index.

### Implications
- Bundle discovery is `fs.readdir('methodologies/')`.
- The parser walks H2 headings in order; out-of-order or missing headings produce structural-validation errors at load time.
- User-authored bundles drop into the same directory; in-app authoring (T-D41 deferred to v2) would write here.
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
  bundle_id TEXT NOT NULL,     -- references methodologies/<bundle_id>/bundle.md
  state TEXT NOT NULL,         -- 'active' | 'archived'
  settings_json TEXT NOT NULL, -- per-project overrides
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  archived_at TIMESTAMP
)
```

`bundle_id` is non-nullable per T-D47. Default at project create is `'freeform'`.

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
- `backend/src/methodology/drift/discipline-scanners/` instantiates scanners at bundle load (via C-D4 output).
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
A workflow engine generalises across bundle checklists; SiteMesh's anchor-citation-validation + scope-assessment pattern is one shape, but freeform projects could declare entirely different patterns. The mechanical/judgement split lets fully automatable checks run without human bottlenecking while preserving human judgement for genuinely subjective calls. Persisting step state means a run can be paused, resumed, or audited later.

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

1. **Resolve companion mode** — the bundle's review-patterns section declares one or more companion modes (e.g., SiteMesh's "doc-readiness mode" and "code-PR mode"). The user picks a mode; default is the bundle's first-declared mode.
2. **Gather context** — for the current project and chosen mode, retrieve: project spec excerpts, decisions relevant to the active primary unit (if bundle declares primary units), active anchors and open markers, execution-plan slice for the chosen mode, cross-primary-unit dependencies, and any items carrying include-in-prompt directives (T-D12).
3. **Relevance classification** — Anthropic Haiku (per SPEC §9: "Session-start prompt assembly: Haiku") classifies which decisions and anchors are relevant to the slice; full text included for high-relevance, citations only for medium, dropped for low.
4. **Render** — the bundle's templates section provides the session-start template for that companion mode; the assembled context fills the template; output is a prompt string.
5. **Surface** — UI shows the rendered prompt with a one-click copy-to-clipboard.

### Rationale
Bundle-driven template selection keeps Throughline methodology-agnostic — SiteMesh declares its specific companion modes; a different bundle declares different modes. Relevance classification via the cheapest model (Haiku) keeps cost low for what is a frequently-used feature. Templates lifted from the bundle's templates section means the bundle author controls prompt shape without code changes.

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
                                                           │ child process
                                                           ▼
                                              ┌─────────────────────────┐
                                              │  Semble local service   │
                                              └─────────────────────────┘
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
4. For each project in `projects`, resolve its `bundle_id` against the registry; if missing or malformed, project state goes to `bundle-error` and the UI surfaces a banner with the error.

Live bundle reload: `chokidar` watches `methodologies/**/bundle.md`. On change:
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
| `projects` | C-D5 — `id`, `name`, `repo_path`, `github_owner`, `github_repo`, `bundle_id` (non-nullable, T-D47), `state`, `settings_json`, timestamps. |
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

`nanoid`-style stable identifiers per record (per §8 "Stable identifiers per record, generated locally"). Verifier rule files named by item identifier per the bundle's declaration; SiteMesh declares `{item_id}.yml` (T-D26).

---

## 4. External integrations

All outbound HTTPS originates from the backend (T-D31).

| Integration | Implementation |
|---|---|
| **Anthropic** | `@anthropic-ai/sdk`. Per-feature model selection (§9). Cost telemetry written per call (T-D29). Prompt fingerprint hashed and recorded; full prompt never persisted (T-D24). |
| **GitHub** | `@octokit/rest`. ETag-cached polling per T-D7. Cadence: 60s for active sessions, 5min otherwise. PR-open gate enforcement reuses the gate dispatcher (C-D6) with moment `pr-open`. |
| **Semble** | Backend spawns Semble as a child process (T-D27). MCP-style or HTTP API per Semble's interface; backend reads via local socket. |
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
| `pre-write` | Explicit UI action ("Run pre-write checks on this slice") + signal-file convention in the Throughline-managed inbox written by Claude Code when about to write. Trigger details flagged for the spec author. |
| `per-commit` | Watch `<repo>/.git/COMMIT_EDITMSG` for activity; alternatively a git pre-commit hook the user installs that touches a signal file in the Throughline inbox. Both flagged for the spec author. |
| `plan-mode` | A plan-mode marker file convention in the Claude Code inbox; trigger details flagged for the spec author. |
| `post-commit` | Git log poll on the active branch during GitHub polling cadence; alternatively a git post-commit hook touching a signal file. Both flagged for the spec author. |
| `pr-open` | GitHub poller detects a newly opened PR on a tracked branch; dispatches to the gate runtime with `moment='pr-open'`. |

Each moment resolves the bundle's `gates_by_moment[moment]` (zero or more `GateSpec`). Gates run independently per C-D6.

Mechanical gate execution: scripts execute via `child_process.spawn` with stdout/stderr captured; banned-string sweeps and regex validators run in-process; structural validators run against parsed project docs cached in the runtime.

Judgement gates: Anthropic call with the gate's spec-declared prompt template (from the bundle's templates section), parameterised by the project's current state. Default model Sonnet per SPEC §9.

Findings surface in the methodology-gates view; UI shows per-gate pass/fail with override + fix-and-retry actions (T-D44).

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
- **Graph view**: `cytoscape.js` or similar. Nodes are items; edges are parent-child + structured blockers + cross-session mentions. Communication-model edges (§7.11) drawn from the bundle's communication-model section for projects whose bundle declares one.
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
| SiteMesh methodology bundle | `methodologies/sitemesh/bundle.md` | T-D41 — rich-discipline reference bundle. |
| Freeform methodology bundle | `methodologies/freeform/bundle.md` | T-D41, T-D47 — minimum-spec bundle. |
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

1. **Pre-write gate trigger** (§7.12). How does a session "signal it is about to write to project docs"? Candidates: signal file in the Throughline inbox written by Claude Code; explicit UI action; some other convention. v1 implementation plans to support both signal file and UI action, but the canonical Claude-Code-side convention is the spec author's call.
2. **Per-commit gate detection** (§7.12). How does Throughline detect a commit is being prepared? Candidates: watch `.git/COMMIT_EDITMSG`; user-installed git pre-commit hook touching a signal file; some other mechanism. The choice has UX implications (the hook approach requires the user to install a hook per repo).
3. **Plan-mode gate detection** (§7.12). How does Throughline know Claude Code is in plan mode? Candidates: a plan-mode marker file in the inbox; a Claude Code → Throughline push event with a plan-mode annotation. The spec assumes the integration but doesn't specify the protocol.
4. **Post-commit detection** (§7.12). Candidates: git log poll on the active branch (cheap, slightly lagged); user-installed git post-commit hook (immediate but requires per-repo install). The choice mirrors the per-commit gate.
5. **Bundle markdown convention** (§7.1, §11). SPEC.md says bundles are "markdown files following the eleven-section structure" without committing to a per-section heading convention. CODE_SPEC.md C-D3 picks H2 headings (`## 1. Identity`, etc.) with a single `bundle.md` per directory; confirm the convention or specify the alternative.
6. **Companion modes ↔ review patterns relationship** (§7.1 bundle structure §8; §7.18 session-start reference). §7.1's bundle §8 says "review patterns" includes "companion modes"; §7.18 references "the methodology's appropriate companion mode" without a worked example. Confirm: are companion modes a fixed list per bundle (e.g., SiteMesh's "doc-readiness", "code-PR"), parameterised by phase, or something else? CODE_SPEC.md C-D9 treats them as a bundle-declared enum with a default; spec confirmation would unblock the assembly pipeline's contract.
7. **Verifier-tool plurality** (§7.16; T-D26 wording). §7.16 still discusses Semgrep specifically as the verifier tool while T-D26 references "the methodology bundle defines rule conventions" implying methodology bundles could declare a different verifier tool entirely. Clarify: in v1, is Semgrep the only supported verifier tool (with bundles only varying naming/storage conventions), or can a bundle declare a different verifier-tool integration?
8. **Voice input language default** (§13). Open question without a recommendation. Implementation needs a default for the speech-recognition `lang` parameter on first launch. Recommendation request: pick one.
9. **Cost meter daily threshold default value** (§13, §7.25). Spec says "pending real usage data." Settings panel needs a starting default. Recommendation request: pick a placeholder value (e.g., $5) or explicitly default to "no threshold / never warn."
