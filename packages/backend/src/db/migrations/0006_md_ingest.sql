-- Phase 6c — repo `.md` ingestion (T-D11, SPEC §7.9). Builds on 0001/0004 which created
-- `library_entries` (+ the 0004 `summary` column the imported-doc panel already renders).
-- This migration adds the substrate the 6c ingestion surface needs:
--   1. `md_ingest_folders` — per-project opt-in directories (T-D11: "Settings carries a
--      list of opted-in directories"). Paths are stored relative to the project's
--      repo_path; the service confines every path to the repo_path subtree (C-D10) so the
--      REST surface can never be coaxed into an arbitrary-filesystem read.
--   2. Imported-doc source-tracking columns on `library_entries`:
--      - source_path:    rel_path of the originating `.md` file (NULL for non-ingested
--                        entries and for hand-authored imported docs).
--      - source_tracked: 1 when the entry mirrors the file on disk (per-entry "track
--                        source" toggle, §7.9 / §13 adopted default). Snapshot (0) by
--                        default — re-ingest is an explicit user/watch action.
--      - source_hash:    sha256 of the file content at last ingest, so scan/re-ingest can
--                        classify new/changed/unchanged without re-summarising blindly.
--      - ingested_at:    timestamp of the last ingest (initial import or re-ingest).
-- The 0004 FTS triggers cover library_entries' (title, body, tags) — the new columns are
-- metadata only and stay out of the FTS index, so no trigger changes are needed.

CREATE TABLE md_ingest_folders (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rel_path    TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_md_ingest_folders_project_path
  ON md_ingest_folders(project_id, rel_path);

ALTER TABLE library_entries ADD COLUMN source_path TEXT;
ALTER TABLE library_entries ADD COLUMN source_tracked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE library_entries ADD COLUMN source_hash TEXT;
ALTER TABLE library_entries ADD COLUMN ingested_at TEXT;

-- Tracked-entry lookup for the chokidar watcher's path → entry resolution.
CREATE INDEX idx_library_source_tracked
  ON library_entries(project_id, source_tracked) WHERE source_tracked = 1;
