-- Phase 14 — RAG & intelligence layer (T-D25, C-D2; SPEC §7.18; CODE_SPEC §15).
-- The text RAG substrate needs project scoping ("for the active project", CODE_SPEC §15)
-- and incremental staleness detection ("embeddings generated incrementally on content
-- edit", C-D2). The 0001 text_embeddings sketch
-- (entity_type, entity_id, chunk_index, embedding_blob) carries neither — add them.
-- content_hash makes re-embed an exact-change comparison (no background AI, T-D22 kin);
-- chunk_text lets a citation carry a snippet without re-reading the source entity.
-- Schema-sketch deviation (CODE_SPEC §3) is implementation-shape only; recorded in the
-- handover Drift Flags. No functional/SPEC change.

ALTER TABLE text_embeddings ADD COLUMN project_id TEXT;
ALTER TABLE text_embeddings ADD COLUMN content_hash TEXT;
ALTER TABLE text_embeddings ADD COLUMN chunk_text TEXT;

CREATE INDEX IF NOT EXISTS idx_text_embeddings_project
  ON text_embeddings(project_id, entity_type, entity_id);
