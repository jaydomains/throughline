-- Phase 20 — bootstrap server-side ingest substrate (T-D53, T-D54, C-D20).
-- Adds the storage layer for the bootstrap import pipeline: every row that lands via
-- `POST /api/projects/:id/import` (Slice 3) carries a deterministic `bootstrap_id`
-- derived per source type, and re-import upserts on `(project_id, bootstrap_id)`.
--
-- Two columns per affected entity table:
--   1. `bootstrap_id` — nullable TEXT. Non-null only on bootstrap-imported rows;
--      existing creation paths (manual `POST /api/projects/:id/items`, manual
--      session / library creation, md-ingest at `(project_id, source_path)` in
--      0006) write NULL and are unaffected. A unique partial index on
--      `(project_id, bootstrap_id) WHERE bootstrap_id IS NOT NULL` enforces
--      identity for re-import without collapsing NULLs (SQLite's UNIQUE treats
--      multiple NULLs as distinct; the partial-index `WHERE` clause makes that
--      contract explicit and skips the index entirely for non-bootstrap rows).
--   2. `bootstrap_stale` — INTEGER 0/1, NOT NULL DEFAULT 0. The Slice 3 upsert
--      flips this to 1 on rows whose `bootstrap_id` appeared in a prior import
--      but is absent from the current one (T-D54). Never auto-deleted; surfaces
--      in the Slice 4 review queue with keep / archive / delete actions.
--
-- INTEGER for the boolean follows the established convention in 0006
-- (`source_tracked INTEGER NOT NULL DEFAULT 0`); SQLite has no native BOOLEAN.
-- Index naming follows 0006's `idx_library_source_tracked` partial-index
-- precedent (table-scoped name, column hint, no per-condition suffix).

ALTER TABLE items ADD COLUMN bootstrap_id    TEXT;
ALTER TABLE items ADD COLUMN bootstrap_stale INTEGER NOT NULL DEFAULT 0;

ALTER TABLE sessions ADD COLUMN bootstrap_id    TEXT;
ALTER TABLE sessions ADD COLUMN bootstrap_stale INTEGER NOT NULL DEFAULT 0;

ALTER TABLE library_entries ADD COLUMN bootstrap_id    TEXT;
ALTER TABLE library_entries ADD COLUMN bootstrap_stale INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX idx_items_bootstrap_id
  ON items(project_id, bootstrap_id) WHERE bootstrap_id IS NOT NULL;

CREATE UNIQUE INDEX idx_sessions_bootstrap_id
  ON sessions(project_id, bootstrap_id) WHERE bootstrap_id IS NOT NULL;

CREATE UNIQUE INDEX idx_library_entries_bootstrap_id
  ON library_entries(project_id, bootstrap_id) WHERE bootstrap_id IS NOT NULL;
