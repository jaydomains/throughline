-- Phase 6b — directives, reminders, notifier. The `directives` table already exists in
-- 0001_init.sql (id, project_id, parent_type, parent_id, kind, payload_json, next_fire_at,
-- created_at). This migration adds the substrate the 6b service + scheduler need:
--   1. `last_fired_at` column so the scheduler can record when a reminder fired (separate
--      from `next_fire_at`, which is forward-looking).
--   2. Index on (parent_type, parent_id) for the per-parent lookups that drive the badge,
--      item detail panel, and library editor's directives section.
--   3. Index on next_fire_at (filtered NOT NULL) for the reminder scheduler's tick scan;
--      one-shot reminders set next_fire_at=NULL on fire and fall out of the index.

ALTER TABLE directives ADD COLUMN last_fired_at TEXT;

CREATE INDEX idx_directives_parent ON directives(parent_type, parent_id);
CREATE INDEX idx_directives_next_fire ON directives(next_fire_at) WHERE next_fire_at IS NOT NULL;
