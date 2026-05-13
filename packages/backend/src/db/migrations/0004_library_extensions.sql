-- Phase 6a — library content surface. Builds on 0001_init.sql which already created
-- `library_entries` and `item_attached_notes`. This migration adds the substrate the
-- full Phase 6a service needs:
--   1. Reverse-lookup index on item_attached_notes(library_entry_id) so the "what items
--      does this note attach to?" query is O(log n) instead of a project-wide scan.
--   2. `attached_at` timestamp on item_attached_notes for audit reconstruction (when the
--      attach actually happened).
--   3. `summary` column on library_entries — scaffolding for the Phase 6c imported-doc
--      AI summary; rendered today by the read-only imported-doc panel when present.
--   4. FTS5 virtual table over library_entries (title + body + tags) with triggers to
--      keep it in sync. First consumer of the FTS5 + sync-triggers convention;
--      Phase 7+ item search and Phase 14 RAG text substrate can either reuse this
--      pattern or layer on top once embeddings ship.

ALTER TABLE item_attached_notes ADD COLUMN attached_at TEXT;
UPDATE item_attached_notes SET attached_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE attached_at IS NULL;
CREATE INDEX idx_attached_notes_entry ON item_attached_notes(library_entry_id);

ALTER TABLE library_entries ADD COLUMN summary TEXT;

CREATE VIRTUAL TABLE library_entries_fts USING fts5(
  title,
  body,
  tags_text,
  content='library_entries',
  content_rowid='rowid'
);

-- The FTS5 'content=' option means rowid + the listed columns are sourced from the
-- backing table. tags_json is JSON; we synthesise a space-joined tags_text per row in
-- the triggers so a search for "inbox" can match a row tagged with "inbox".

INSERT INTO library_entries_fts (rowid, title, body, tags_text)
SELECT
  rowid,
  title,
  body,
  COALESCE((SELECT GROUP_CONCAT(value, ' ') FROM json_each(tags_json)), '')
FROM library_entries;

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
