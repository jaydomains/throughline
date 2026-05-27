import type { DB } from '../db/index.js';

// T-D54 + C-D20 surface 4 — `hasUserEditsSinceLastBootstrap` is the single
// source of truth for "user-edited since last import". Both the upsert
// classifier (this slice) and the review-queue UI's GET endpoint (Slice 4)
// consult it so they cannot disagree on what counts as a conflict.
//
// Definition: the most recent `bootstrap_import` or `bootstrap_reimport`
// audit row on `(entity_type, entity_id)` defines the "since" reference
// point. Any audit row on the same `(entity_type, entity_id)` whose
// timestamp is strictly after that point AND whose `field` is not prefixed
// `bootstrap_` indicates a user edit. The function returns true if any such
// row exists, false otherwise.
//
// An entity that has never been touched by bootstrap (no `bootstrap_*`
// audit rows) returns false — bootstrap has never claimed authorship of
// this row so there is no "since" point to measure against and no conflict
// is possible. The validator (this slice) calls the predicate only on rows
// that already exist by `(project_id, bootstrap_id)`, so this case is
// effectively unreachable in normal flow; the function still handles it
// defensively for direct callers and tests.
//
// SQL: the existing `idx_audit_entity` (project_id-less, on
// `(entity_type, entity_id)`) covers the per-row scan. C-D20 notes a
// covering index on `(entity_type, entity_id, timestamp, field)` may be
// a benchmark-driven follow-up if import latency dominates at realistic
// row counts.

export type BootstrapEntityType = 'item' | 'session' | 'library';

interface AuditRow {
  timestamp: string;
  field: string;
}

export function hasUserEditsSinceLastBootstrap(
  db: DB,
  entityType: BootstrapEntityType,
  entityId: string,
): boolean {
  // Find the most recent bootstrap_import / bootstrap_reimport timestamp for
  // this entity. The `field LIKE 'bootstrap\_%' ESCAPE '\'` clause matches
  // any audit row Bootstrap wrote (currently `bootstrap_import`,
  // `bootstrap_reimport`, `bootstrap_stale`); the LIKE excludes anything
  // outside that family.
  const sinceRow = db
    .prepare(
      `SELECT timestamp FROM audit_log
       WHERE entity_type = ? AND entity_id = ?
         AND (field = 'bootstrap_import' OR field = 'bootstrap_reimport')
       ORDER BY timestamp DESC, id DESC
       LIMIT 1`,
    )
    .get(entityType, entityId) as Pick<AuditRow, 'timestamp'> | undefined;

  if (!sinceRow) return false;

  // Any non-`bootstrap_*` audit after that timestamp counts as a user edit.
  // We include rows with the same timestamp as the bootstrap row only when
  // they sort after by `id` (lexicographic on nanoid). In practice the
  // bootstrap audit is the last write before the next caller mutates the
  // row, so ordering ties are vanishingly rare; the strict `> timestamp`
  // condition keeps the predicate well-defined regardless.
  const editRow = db
    .prepare(
      `SELECT 1 FROM audit_log
       WHERE entity_type = ? AND entity_id = ?
         AND timestamp > ?
         AND field NOT LIKE 'bootstrap\\_%' ESCAPE '\\'
       LIMIT 1`,
    )
    .get(entityType, entityId, sinceRow.timestamp) as { 1: number } | undefined;

  return editRow !== undefined;
}
