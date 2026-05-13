-- Phase 5 — reconcile engine. Pending reconcile runs (review-before-apply per T-D5).
-- drift_signals already exists from 0001_init.sql; Phase 5 is the first producer for
-- contradicted-as-drift per T-D35 (stream='code', tier-2 if item has a PR association,
-- tier-3 otherwise).

CREATE TABLE reconcile_runs (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id      TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  source          TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('pending', 'applied', 'discarded')),
  raw_text        TEXT NOT NULL,
  diff_json       TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  resolved_at     TEXT
);
CREATE INDEX idx_reconcile_runs_project_status ON reconcile_runs(project_id, status);
CREATE INDEX idx_reconcile_runs_project_created ON reconcile_runs(project_id, created_at);
