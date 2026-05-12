-- Initial Throughline schema. Tables and column shapes follow CODE_SPEC.md §3.
-- Per-project entity tables carry project_id (C-D5). Bundle_id is NOT NULL (T-D47).

CREATE TABLE projects (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  repo_path       TEXT NOT NULL,
  github_owner    TEXT,
  github_repo     TEXT,
  bundle_id       TEXT NOT NULL,
  state           TEXT NOT NULL CHECK (state IN ('active', 'archived')),
  settings_json   TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  archived_at     TEXT
);

CREATE TABLE items (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL,
  blocker_text    TEXT,
  parent_id       TEXT REFERENCES items(id) ON DELETE SET NULL,
  branch_ref      TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX idx_items_project ON items(project_id);
CREATE INDEX idx_items_parent ON items(parent_id);

CREATE TABLE item_tags (
  item_id         TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tag             TEXT NOT NULL,
  PRIMARY KEY (item_id, tag)
);

CREATE TABLE item_blockers (
  item_id             TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  blocked_by_item_id  TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, blocked_by_item_id)
);

CREATE TABLE sessions (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  branch_ref      TEXT,
  context         TEXT,
  settings_json   TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX idx_sessions_project ON sessions(project_id);

CREATE TABLE item_session_memberships (
  item_id         TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, session_id)
);

CREATE TABLE item_primary_unit_refs (
  item_id           TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  primary_unit_ref  TEXT NOT NULL,
  PRIMARY KEY (item_id, primary_unit_ref)
);

CREATE TABLE item_phase_refs (
  item_id         TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  phase_id        TEXT NOT NULL,
  PRIMARY KEY (item_id, phase_id)
);

CREATE TABLE item_anchor_citations (
  item_id         TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  anchor_id       TEXT NOT NULL,
  PRIMARY KEY (item_id, anchor_id)
);

CREATE TABLE item_marker_refs (
  item_id         TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  marker_id       TEXT NOT NULL,
  PRIMARY KEY (item_id, marker_id)
);

CREATE TABLE item_pr_associations (
  item_id           TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  pr_number         INTEGER NOT NULL,
  repo              TEXT NOT NULL,
  auto_detected_at  TEXT,
  PRIMARY KEY (item_id, repo, pr_number)
);

CREATE TABLE item_code_refs (
  id              TEXT PRIMARY KEY,
  item_id         TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  path            TEXT NOT NULL,
  line_start      INTEGER NOT NULL,
  line_end        INTEGER NOT NULL,
  summary         TEXT
);
CREATE INDEX idx_item_code_refs_item ON item_code_refs(item_id);

CREATE TABLE item_verifier_rules (
  id              TEXT PRIMARY KEY,
  item_id         TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  rule_path       TEXT NOT NULL,
  rule_id         TEXT NOT NULL,
  last_status     TEXT,
  last_run_at     TEXT
);

CREATE TABLE item_attached_notes (
  item_id           TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  library_entry_id  TEXT NOT NULL,
  PRIMARY KEY (item_id, library_entry_id)
);

CREATE TABLE library_entries (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('note', 'prompt', 'snippet', 'imported_doc')),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL DEFAULT '',
  tags_json       TEXT NOT NULL DEFAULT '[]',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX idx_library_project ON library_entries(project_id);

CREATE TABLE directives (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_type     TEXT NOT NULL CHECK (parent_type IN ('item', 'library')),
  parent_id       TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('pin', 'reminder', 'include_prompt')),
  payload_json    TEXT NOT NULL DEFAULT '{}',
  next_fire_at    TEXT,
  created_at      TEXT NOT NULL
);
CREATE INDEX idx_directives_project ON directives(project_id);

CREATE TABLE audit_log (
  id                    TEXT PRIMARY KEY,
  timestamp             TEXT NOT NULL,
  project_id            TEXT,
  entity_type           TEXT NOT NULL,
  entity_id             TEXT NOT NULL,
  actor                 TEXT NOT NULL,
  field                 TEXT NOT NULL,
  old_value             TEXT,
  new_value             TEXT,
  trigger_context_json  TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_audit_project ON audit_log(project_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);

CREATE TABLE chat_history (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  context_type    TEXT NOT NULL,
  context_id      TEXT NOT NULL,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  created_at      TEXT NOT NULL
);

CREATE TABLE drift_signals (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stream              TEXT NOT NULL CHECK (stream IN ('code', 'discipline')),
  category            TEXT NOT NULL,
  item_id             TEXT REFERENCES items(id) ON DELETE SET NULL,
  primary_unit_ref    TEXT,
  reason              TEXT NOT NULL,
  payload_json        TEXT,
  created_at          TEXT NOT NULL,
  dismissed_at        TEXT,
  dismiss_reason      TEXT
);

CREATE TABLE gate_firings (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  moment          TEXT NOT NULL,
  gate_id         TEXT NOT NULL,
  status          TEXT NOT NULL,
  findings_json   TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL
);

CREATE TABLE checklist_runs (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  checklist_id    TEXT NOT NULL,
  state           TEXT NOT NULL,
  started_at      TEXT NOT NULL,
  completed_at    TEXT
);

CREATE TABLE checklist_run_steps (
  run_id          TEXT NOT NULL REFERENCES checklist_runs(id) ON DELETE CASCADE,
  step_id         TEXT NOT NULL,
  state           TEXT NOT NULL,
  findings_json   TEXT,
  transitioned_at TEXT NOT NULL,
  PRIMARY KEY (run_id, step_id)
);

CREATE TABLE orphaned_rules (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rule_path         TEXT NOT NULL,
  original_item_id  TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  dismissed_at      TEXT
);

CREATE TABLE text_embeddings (
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  chunk_index     INTEGER NOT NULL,
  embedding_blob  BLOB NOT NULL,
  PRIMARY KEY (entity_type, entity_id, chunk_index)
);

CREATE TABLE cc_inbox_queue (
  id              TEXT PRIMARY KEY,
  original_path   TEXT NOT NULL,
  received_at     TEXT NOT NULL,
  state           TEXT NOT NULL CHECK (state IN ('queued', 'processed', 'failed')),
  error_text      TEXT
);

CREATE TABLE cost_telemetry (
  id              TEXT PRIMARY KEY,
  project_id      TEXT REFERENCES projects(id) ON DELETE SET NULL,
  timestamp       TEXT NOT NULL,
  feature         TEXT NOT NULL,
  model           TEXT NOT NULL,
  input_tokens    INTEGER NOT NULL,
  output_tokens   INTEGER NOT NULL,
  usd_estimate    REAL NOT NULL
);
CREATE INDEX idx_cost_project_time ON cost_telemetry(project_id, timestamp);

CREATE TABLE github_state_cache (
  repo            TEXT NOT NULL,
  pr_number       INTEGER NOT NULL,
  etag            TEXT,
  last_payload_json TEXT,
  last_polled_at  TEXT,
  PRIMARY KEY (repo, pr_number)
);

CREATE TABLE settings (
  key             TEXT PRIMARY KEY,
  value_json      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE scratchpad_jots (
  id              TEXT PRIMARY KEY,
  project_id      TEXT REFERENCES projects(id) ON DELETE SET NULL,
  body            TEXT NOT NULL,
  created_at      TEXT NOT NULL
);
