-- Phase E / E20 (F4-01) — add `project_spec` as the fifth library content type (T-D10
-- amended). The `library_entries.type` column carries a CHECK constraint that SQLite cannot
-- ALTER in place, so the table is rebuilt with the widened CHECK.
--
-- Correctness constraints driving this rebuild:
--   1. The rebuilt table MUST reproduce the *full current* schema — every column added since
--      0001: summary (0004); source_path/source_tracked/source_hash/ingested_at (0006);
--      bootstrap_id/bootstrap_stale (0012) — and all three indexes.
--   2. `library_entries_fts` is an FTS5 external-content index keyed by `content_rowid='rowid'`
--      (0004). The copy MUST preserve rowid so the index stays aligned; the three sync triggers
--      are dropped with the old table and recreated verbatim.
--   3. No table carries an incoming FK to `library_entries` (item_attached_notes references it
--      by id but declares no FK), so the DROP cannot cascade-delete; the only FK is
--      library_entries→projects (outgoing), unaffected. Runs inside the migration runner's
--      transaction (PRAGMA foreign_keys is a no-op there and is not needed here).

DROP TRIGGER library_entries_ai;
DROP TRIGGER library_entries_ad;
DROP TRIGGER library_entries_au;

CREATE TABLE library_entries_new (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('note', 'prompt', 'snippet', 'imported_doc', 'project_spec')),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL DEFAULT '',
  tags_json       TEXT NOT NULL DEFAULT '[]',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  summary         TEXT,
  source_path     TEXT,
  source_tracked  INTEGER NOT NULL DEFAULT 0,
  source_hash     TEXT,
  ingested_at     TEXT,
  bootstrap_id    TEXT,
  bootstrap_stale INTEGER NOT NULL DEFAULT 0
);

-- Preserve rowid so the external-content FTS index remains valid against the rebuilt table.
INSERT INTO library_entries_new
  (rowid, id, project_id, type, title, body, tags_json, created_at, updated_at,
   summary, source_path, source_tracked, source_hash, ingested_at, bootstrap_id, bootstrap_stale)
  SELECT
   rowid, id, project_id, type, title, body, tags_json, created_at, updated_at,
   summary, source_path, source_tracked, source_hash, ingested_at, bootstrap_id, bootstrap_stale
  FROM library_entries;

DROP TABLE library_entries;
ALTER TABLE library_entries_new RENAME TO library_entries;

-- Recreate all three indexes (0001 idx_library_project, 0006 partial source-tracked,
-- 0012 unique bootstrap_id).
CREATE INDEX idx_library_project ON library_entries(project_id);
CREATE INDEX idx_library_source_tracked
  ON library_entries(project_id, source_tracked) WHERE source_tracked = 1;
CREATE UNIQUE INDEX idx_library_entries_bootstrap_id
  ON library_entries(project_id, bootstrap_id) WHERE bootstrap_id IS NOT NULL;

-- Recreate the FTS sync triggers verbatim from 0004 (dropped with the old table).
CREATE TRIGGER library_entries_ai AFTER INSERT ON library_entries BEGIN
  INSERT INTO library_entries_fts(rowid, title, body, tags_text)
  VALUES (
    new.rowid,
    new.title,
    new.body,
    COALESCE((SELECT GROUP_CONCAT(value, ' ') FROM json_each(new.tags_json)), '')
  );
END;

CREATE TRIGGER library_entries_ad AFTER DELETE ON library_entries BEGIN
  INSERT INTO library_entries_fts(library_entries_fts, rowid, title, body, tags_text)
  VALUES (
    'delete',
    old.rowid,
    old.title,
    old.body,
    COALESCE((SELECT GROUP_CONCAT(value, ' ') FROM json_each(old.tags_json)), '')
  );
END;

CREATE TRIGGER library_entries_au AFTER UPDATE ON library_entries BEGIN
  INSERT INTO library_entries_fts(library_entries_fts, rowid, title, body, tags_text)
  VALUES (
    'delete',
    old.rowid,
    old.title,
    old.body,
    COALESCE((SELECT GROUP_CONCAT(value, ' ') FROM json_each(old.tags_json)), '')
  );
  INSERT INTO library_entries_fts(rowid, title, body, tags_text)
  VALUES (
    new.rowid,
    new.title,
    new.body,
    COALESCE((SELECT GROUP_CONCAT(value, ' ') FROM json_each(new.tags_json)), '')
  );
END;
