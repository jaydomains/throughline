-- Phase 4 — capture surfaces. Adds tables for in-flight dump-zone proposals (review-before-apply
-- per T-D5/T-D20) and code-TODO scan runs. scratchpad_jots, cc_inbox_queue, library_entries,
-- and cost_telemetry already exist from 0001_init.sql.

CREATE TABLE proposed_extractions (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target          TEXT NOT NULL CHECK (target IN ('session', 'library')),
  source          TEXT NOT NULL,            -- 'paste' | 'voice' | 'inbox' | 'code_todo'
  extractor       TEXT NOT NULL,            -- 'anthropic' | 'heuristic'
  raw_text        TEXT NOT NULL,
  payload_json    TEXT NOT NULL,            -- proposed items + clarifying questions + suggestions
  status          TEXT NOT NULL CHECK (status IN ('pending', 'applied', 'discarded')),
  created_at      TEXT NOT NULL,
  resolved_at     TEXT
);
CREATE INDEX idx_proposed_extractions_project ON proposed_extractions(project_id, status);

CREATE TABLE code_todo_scans (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  patterns_json   TEXT NOT NULL,            -- patterns matched in this run
  match_count     INTEGER NOT NULL,
  proposed_id     TEXT REFERENCES proposed_extractions(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL
);
CREATE INDEX idx_code_todo_scans_project ON code_todo_scans(project_id, created_at);
