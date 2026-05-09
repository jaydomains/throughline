# Throughline v1 — Code Specification

This document is the **technical implementation spec** for Throughline v1. SPEC.md is authoritative for *what* and *why*; this file is authoritative for *how*. Where SPEC.md fixes a decision, this file derives from it. Where SPEC.md is silent or vague, this file is implementation-only and labelled as such.

If a SPEC.md statement turns out to be too vague to derive implementation from, the gap is surfaced under [Questions for the spec author](#questions-for-the-spec-author) at the end of this file rather than guessed.

## Anchor convention

Implementation-level decisions in this file use `C-D{n}` anchors (Code Decision). They are distinct from `T-D{n}` anchors in SPEC.md §14 (which remain canonical and frozen at 39). C-D anchors are referenceable from code comments, PR descriptions, and other docs.

Any C-D may be promoted to a T-D later if it crosses the line into a functional decision; that promotion requires a SPEC.md §14 update.

---

## C-D1 — TypeScript end-to-end stack

- **Status:** active (implementation-only)
- **Cites:** T-D2, T-D3, T-D32

### Decision
- **Backend:** Node.js (LTS) with TypeScript. Web framework: Fastify. Process manager: native `node` invocation; login auto-start via `launchd` (macOS) / Task Scheduler (Windows) / systemd user unit (Linux).
- **Browser UI:** React with TypeScript. Build via Vite. Served by the backend as static assets at `http://127.0.0.1:<port>/`.
- **Datastore:** SQLite via `better-sqlite3`. Single file on disk, satisfying T-D3.
- **Backend ↔ browser transport:** local HTTP for request/response, Server-Sent Events for backend-pushed updates (drift signals appearing, polling state changes, cost meter ticks). WebSocket reserved if SSE proves insufficient under load.
- **Process boundaries:** Throughline backend, Semble local service (T-D28, lifecycle-managed by backend), browser. No other long-lived processes.

### Rationale
TypeScript on both ends shares types between API and UI without an IDL layer. Node.js has mature support for filesystem watching, child-process supervision (Semble), and HTTP servers. SQLite is the canonical single-file datastore. Fastify is fast, opinionated about plugins, and ergonomic for the kind of REST + SSE the backend needs.

Python was considered for the AI ecosystem but rejected because:
- The Anthropic SDK works equally well in TypeScript.
- The cross-process management of Semble + a frontend is simpler when the backend, frontend, and shared types all share a runtime.
- Single language reduces the Phase-0 install footprint.

### Implications
- One package manager (`pnpm`) at the repo root with workspaces for `backend`, `web`, and shared types.
- Local embeddings (T-D26 notes substrate) use a TypeScript-friendly model — see C-D2.
- All file watching uses `chokidar`.
- Cross-platform OS notifications (T-D33) via `node-notifier` or platform-specific shell-outs in a single capability layer.

---

## C-D2 — Local embeddings via Transformers.js

- **Status:** active (implementation-only)
- **Cites:** T-D26, T-D32

### Decision
The notes RAG substrate (T-D26) uses local embeddings generated in-process by `@xenova/transformers` (Transformers.js) running a small sentence-embedding model (e.g., `all-MiniLM-L6-v2` ONNX). Embeddings stored in SQLite in a `notes_embeddings` table; cosine similarity computed in-memory or via `sqlite-vss` if performance demands it.

### Rationale
T-D32 mandates the backend mediates external network calls. Sending notes to a remote embedding API would still satisfy T-D32 but adds cost and a privacy surface for personal notes. Local embeddings keep the substrate fully offline.

### Implications
- First-launch model download (cached locally afterwards).
- Embedding generation is incremental on note edit.
- No external API for the notes substrate; code substrate still uses Semble per T-D28.

---

## 1. Process model

```
┌─────────────────────────┐    SSE + REST    ┌─────────────────────────┐
│  Browser UI (React)     │ ◄──────────────► │  Backend (Node.js)      │
│  http://127.0.0.1:PORT  │                  │  - persistence (SQLite) │
└─────────────────────────┘                  │  - file watching        │
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
- `GET /api/...` — REST endpoints for entity CRUD.
- `GET /events` — SSE stream for backend-pushed updates.
- `POST /api/...` — mutations.

Bind to `127.0.0.1` only (T-D32 implication: no external network).

## 2. Persistence

### Schema sketch (SQLite)

Tables (one row per record unless noted):

| Table | Notes |
|---|---|
| `items` | core entity per §7.2; columns include `id`, `type`, `title`, `description`, `status`, `blocker_text`, `branch_ref`, `parent_id`, `created_at`, `updated_at`. |
| `item_tags` | join: `item_id`, `tag`. |
| `item_blockers` | structured blocker refs (T-D8): `item_id`, `blocked_by_item_id`. |
| `item_session_memberships` | many-to-many (T-D1): `item_id`, `session_id`. |
| `item_pr_associations` | T-D35: `item_id`, `pr_number`, `repo`, `auto_detected_at`. |
| `item_code_refs` | Semble-confirmed locations (§7.12): `item_id`, `path`, `line_start`, `line_end`, `summary`. |
| `item_verifier_rules` | §7.13: `item_id`, `rule_path`, `rule_id`, `last_status`, `last_run_at`. |
| `item_attached_notes` | many-to-many (T-D9): `item_id`, `library_entry_id`. |
| `sessions` | view definitions: `id`, `name`, `branch_ref`, `context`, `settings_json`. |
| `library_entries` | T-D10: `id`, `type` (note/prompt/snippet/imported_doc), `title`, `body`, `tags_json`, `created_at`, `updated_at`. |
| `directives` | T-D12: `id`, `parent_type` (item/library), `parent_id`, `kind` (pin/reminder/include_prompt), `payload_json`, `next_fire_at`. |
| `audit_log` | T-D37: `id`, `timestamp`, `entity_type`, `entity_id`, `actor`, `field`, `old_value`, `new_value`, `trigger_context_json`. |
| `chat_history` | T-D24: `id`, `context_type`, `context_id`, `role`, `content`, `created_at`. |
| `drift_signals` | T-D22: `id`, `item_id`, `tier`, `reason`, `created_at`, `dismissed_at`, `dismiss_reason`. |
| `orphaned_rules` | T-D34: `id`, `rule_path`, `original_item_id`, `created_at`, `dismissed_at`. |
| `notes_embeddings` | C-D2: `library_entry_id`, `chunk_index`, `embedding_blob`. |
| `cc_inbox_queue` | T-D17: `id`, `original_path`, `received_at`, `state` (queued/processed/failed), `error_text`. |
| `cost_telemetry` | T-D30: `id`, `timestamp`, `feature`, `model`, `input_tokens`, `output_tokens`, `usd_estimate`. |
| `github_state_cache` | T-D7: `repo`, `pr_number`, `etag`, `last_payload_json`, `last_polled_at`. |
| `settings` | key-value store excluding API keys (T-D4). |

API keys (T-D4) live in a separate config file at a backend-only path (e.g., `~/.config/throughline/secrets.json`), never written to SQLite, never read by browser code.

### Schema migrations

Numbered SQL files run in order on backend start. Each migration recorded in a `_migrations` table to prevent reapplication. A migration that requires data transformation runs in a single transaction.

### Identifiers

`nanoid`-style stable identifiers per record (per §8 "Stable identifiers per record, generated locally"). Rule files (T-D27) named `{item_id}.yml`.

## 3. External integrations

All outbound HTTPS originates from the backend (T-D32).

| Integration | Implementation |
|---|---|
| **Anthropic** | `@anthropic-ai/sdk`. Per-feature model selection (§9). Cost telemetry written per call (T-D30). |
| **GitHub** | `@octokit/rest`. ETag-cached polling per T-D7. Cadence: 60s for active sessions, 5min otherwise. |
| **Semble** | Backend spawns Semble as a child process (T-D28). MCP-style or HTTP API per Semble's interface; backend reads via local socket. |
| **Semgrep** | No direct integration. Backend reads Semgrep findings from PRs via GitHub API (T-D27); rules live in the user's repo at the configurable Throughline-managed subdirectory. |
| **OS notifications** | Single backend capability layer per T-D33. Implementation: `node-notifier` for the cross-platform path; platform-specific shell-outs as fallback if `node-notifier` falls short on a target OS. |

## 4. Capture surfaces

| Surface | Implementation |
|---|---|
| **Scratchpad** (T-D21) | Header component with always-visible textarea. Saves to a `scratchpad_jots` table (or a single growing record). No AI, no review. |
| **Manual entry** | Inline item form per board. Reviewed implicitly by virtue of being typed by the user. |
| **Session dump zone** | POST to `/api/dump-zone/process`. Backend calls Anthropic for extraction. Returns a proposed-items payload. UI shows review modal; user applies (T-D5). |
| **Library dump zone** | Same paradigm scoped to library entries. |
| **Voice input** | Browser-native `SpeechRecognition`. Desktop-only in v1 (§7.4). Transcript pipes into the dump zone flow. |
| **Claude Code push** (T-D17) | `chokidar` watches the inbox directory. New files enqueue into `cc_inbox_queue`. Worker drains the queue: extracts, runs through dump zone, archives on success or quarantines on failure (T-D38). |
| **Code TODO/FIXME import** | Manual trigger in v1 (§13 recommended default adopted). User invokes; backend scans the configured repo path for `TODO:`, `FIXME:`, `XXX:` (defaults from §13); proposes as items via review flow. |

## 5. Reconcile engine

Implements the six-category diff (T-D36):

```
input ─► Anthropic (extraction + classification)
             │
             ▼
       proposed-diff JSON
             │
             ├─ completed   ─►  user reviews ─► applies + audit-log
             ├─ new         ─►  user reviews ─► applies + audit-log
             ├─ edited      ─►  user reviews ─► applies + audit-log
             ├─ blocker     ─►  user reviews ─► applies + audit-log
             ├─ no-change   ─►  user reviews ─► no-op
             └─ contradicted ─► spawn drift signal (T-D22), do NOT revert
```

GitHub-merge auto-reconcile (T-D6, T-D19) bypasses review for high-confidence with audit + 24h undo. Confidence scoring stored in `audit_log.trigger_context_json`.

## 6. Drift detection pipelines

| Tier | Trigger | Action |
|---|---|---|
| 1 | Semgrep finding read from GitHub API matching `item_verifier_rules.rule_id` | Update `last_status`; UI badges item red. |
| 2 | GitHub revert event polled on a PR in `item_pr_associations` | Insert orange-tier `drift_signals` row; UI badges item orange. |
| 3 | New PR's changed files overlap `item_code_refs.path` | Insert yellow-tier `drift_signals` row; UI badges item yellow. |
| 4 | New dump zone item ≥ 0.80 cosine similar to a done item (recommended default §13 adopted; AI confirmation 0.70–0.80) | Insert weak-tier `drift_signals` row; routes to drift inbox; auto-dismiss after 7 days with audit-logged reason. |

Strong tiers (1–3) badge items directly. Tier 4 routes to inbox per T-D22.

## 7. Manual item-to-PR linking (T-D35)

Sequence on manual done-marking:
1. Read active branch via `simple-git` from the configured repo path.
2. Look up branch's PR via GitHub API.
3. Propose; user accepts, picks another, or skips.
4. Result written to `item_pr_associations` (or omitted on skip).

## 8. Orphaned rule lifecycle (T-D34)

Item delete:
1. Read `item_verifier_rules` for the item.
2. For each rule, insert into `orphaned_rules` with `original_item_id` and `rule_path`.
3. Delete `item_verifier_rules` rows; do NOT touch the file in the repo.
4. Surface in periodic review (T-D23) and settings panel.
5. PR-draft action: backend constructs a branch + commit removing the file via Octokit; opens a PR; URL returned to user.

## 9. AI integration

Per-feature model defaults (§9). Settings (§7.22) allow per-feature override.

| Feature | Default model |
|---|---|
| Dump zone extraction | `claude-sonnet-4-6` |
| Reconcile diff generation | `claude-sonnet-4-6` |
| Per-list chat | `claude-sonnet-4-6` |
| End-of-session retro | `claude-sonnet-4-6` |
| Personal RAG (notes) | `claude-sonnet-4-6` |
| Plain-English code Q&A | `claude-sonnet-4-6` |
| Semantic dedup similarity | `claude-haiku-4-5` |
| Drift re-verify | `claude-sonnet-4-6` |
| AI tag suggestion | `claude-haiku-4-5` |
| Stakeholder view rendering | `claude-sonnet-4-6` (cached) |
| Mermaid generation | `claude-sonnet-4-6` |
| Semgrep rule drafting | `claude-sonnet-4-6` |

Cost telemetry (T-D30) writes `cost_telemetry` row per call: input tokens, output tokens, model, USD estimate (computed from a small price-table constant).

Audit log entries for AI-actor changes record `model` and a `prompt_fingerprint` (hash) — never the full prompt content (T-D25).

## 10. Personal RAG (T-D26)

Three substrates, one router.

| Substrate | Index | Query path |
|---|---|---|
| Notes (C-D2) | `notes_embeddings` | Embed query, top-k cosine, fetch chunks, summarise via Anthropic. |
| Code (Semble) | Semble's index | Backend → Semble → relevant chunks → summarise via Anthropic. |
| Audit history | SQL on `audit_log` | Structured query (e.g., "what was reopened this week" → `WHERE field = 'status' AND new_value LIKE 'todo' AND timestamp > now() - 7d`). |

Router (per §13 recommendation, adopted): keyword heuristics first ("where is X" → code, "when did" → audit, default → notes), with user-overridable per-query toggle. AI classification deferred unless heuristics prove inadequate.

## 11. Audit log (T-D37, T-D25)

Single `audit_log` table; entity discriminator field. Every state change inserts a row. Trigger context records:
- For user actions: `actor: "user"`, `client: "browser"`.
- For AI actions: `actor: "ai"`, `model`, `prompt_fingerprint`, `confidence_score?`, `feature`.
- For GitHub auto-apply (T-D6): `actor: "ai_auto_apply"`, `pr_number`, `pr_description`, `confidence_score`, `model`.
- For inbox processing: `actor: "inbox_worker"`, `inbox_file_id`.

Never write API keys, never write full prompt content (T-D25).

## 12. Backup (T-D29)

- Manual export: `POST /api/backup/export` returns the SQLite file as a download with timestamped filename. API keys (T-D4) live elsewhere and are not included.
- Auto-copy: cron-style scheduled job in the backend; copies the datastore file to `settings.auto_copy_target_path` if set.
- Header indicator: red after `settings.backup_threshold_days` (default 7) without a backup.

## 13. Frontend implementation

- **View modes** (T-D31, §7.9): React Router routes `/`, `/sessions/:id`, `/tree`, `/graph`, `/library`, `/directives`. Header view-mode toggle.
- **Command palette** (§7.21): `Cmd+K`/`Ctrl+K`; fuzzy search via `fuse.js`; jumps to entities or runs commands.
- **Keyboard navigation**: Tab/Shift-Tab indent, arrow nav, Enter edit, Esc close, `?` reference. Implemented via a centralised key-binding layer.
- **Graph view**: `cytoscape.js` or similar. Nodes are items; edges are parent-child + structured blockers + cross-session mentions.
- **Item detail panel** (§7.14): right-side slide-in. Arrow keys move through parent list with panel staying open.
- **Stale-item indicator** (T-D from §7.22 implication): yellow border on item rows in list/tree views; yellow status indicator in detail-panel header for items not updated in N days.

## 14. Settings & config

Settings UI exposes (mirrors §7.22):
- Anthropic API key (writes to backend secrets file, T-D4).
- GitHub PAT (writes to backend secrets file, T-D4).
- Local repo path.
- Default model selector + per-feature overrides.
- Stale threshold (days).
- Backup nudge interval + auto-copy target.
- Periodic review interval.
- GitHub default `owner/repo` + per-session branch fields.
- Claude Code inbox directory + archive retention.
- Semgrep rules path.
- OS notification permission (one-time grant button).
- Cost meter daily threshold (default value: see Questions for the spec author).
- Orphaned rules panel.

## 15. Recommended templates shipped with Throughline

| Template | Location | Purpose |
|---|---|---|
| Semgrep GitHub Actions workflow | `templates/github-actions/throughline-semgrep.yml` | T-D27 — recommended workflow for users to add to their repo. |
| Claude Code session-start prompt | `templates/claude-code/session-start.md` | §16 — starter prompt for new sessions. |

## 16. Build / dev tooling (implementation-only)

- `pnpm` workspaces.
- `tsc --noEmit` for type-checking; `vite build` for the web; `tsup` or plain `tsc` for the backend.
- `vitest` for unit tests; `playwright` for end-to-end UI tests once UI lands.
- `eslint` + `prettier`.
- No CI in this repo for v1 (single-user tool); Semgrep CI lives in the user's *target* repo, not this one.

## Questions for the spec author

These are SPEC.md gaps that came up during implementation specification. Each is too thin to derive from with confidence; the recommended action is a short SPEC.md amendment.

1. **Voice input language default** (§13). The spec lists "English only or browser-locale auto" as an open question without a recommendation. Implementation needs a default for the speech-recognition `lang` parameter on first launch. Recommendation request: pick one.
2. **Cost meter daily threshold default value** (§13, §7.22). Spec says "pending real usage data" — but the settings panel needs a starting default. Recommendation request: pick a placeholder value (e.g., $5) or explicitly default to "no threshold / never warn."
3. **§7.11 tier terminology drift**. Intro paragraph splits "strong → badge / weak → inbox," but tier 3 is described as "medium signal" and still badges. Behaviour is unambiguous; vocabulary is mildly inconsistent. Recommendation request: flag for v2 cleanup; behaviour stands as written for v1 (per project owner direction this session).
4. **TL;DR header `Repo path: tools/throughline/`** — fixed in this session's edit (changed to `throughline/`) under the extended carve-out. Noted here for completeness; no further action needed.
5. **§14 ledger pointer path** — fixed in this session's edit (changed to `DECISIONS.md`) under the extended carve-out. Noted here for completeness.
6. **Per-feature model selection naming** (§9 + §7.22). Spec says "Default model selector (Haiku / Sonnet / Opus)" without committing to model versions. C-D1 picks current versions (`claude-sonnet-4-6`, `claude-haiku-4-5`). Recommendation request: confirm version-pinning policy or decree "always latest" semantics.
