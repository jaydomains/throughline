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

interface AuditRowRef {
  timestamp: string;
  rowid: number;
}

export function hasUserEditsSinceLastBootstrap(
  db: DB,
  entityType: BootstrapEntityType,
  entityId: string,
): boolean {
  // Find the most recent bootstrap_import / bootstrap_reimport reference for
  // this entity. Ordering is `(timestamp DESC, rowid DESC)` rather than
  // `(timestamp DESC, id DESC)` because `audit_log.id` is a `nanoid` —
  // randomly distributed across the URL-safe alphabet, NOT
  // insertion-ordered. SQLite's implicit `rowid` is monotonically
  // increasing per INSERT (the table is not `WITHOUT ROWID`), so it is the
  // correct tie-break when two audits share a millisecond. Both queries
  // here use the same `(timestamp, rowid)` ordering so the sinceRow and
  // editRow checks are mutually consistent.
  const sinceRow = db
    .prepare(
      `SELECT timestamp, rowid FROM audit_log
       WHERE entity_type = ? AND entity_id = ?
         AND (field = 'bootstrap_import' OR field = 'bootstrap_reimport')
       ORDER BY timestamp DESC, rowid DESC
       LIMIT 1`,
    )
    .get(entityType, entityId) as AuditRowRef | undefined;

  if (!sinceRow) return false;

  // Any non-`bootstrap_*` audit strictly after the reference point counts
  // as a user edit. The `(timestamp > ? OR (timestamp = ? AND rowid > ?))`
  // form catches the same-millisecond edge case — a user edit landing in
  // the same `Date().toISOString()` slice as the bootstrap audit (which
  // happens whenever the bootstrap path and a user write share a single
  // ms tick) gets a strictly greater `rowid` because better-sqlite3 is
  // synchronous and INSERTs are linearised by call order.
  const editRow = db
    .prepare(
      `SELECT 1 FROM audit_log
       WHERE entity_type = ? AND entity_id = ?
         AND (timestamp > ? OR (timestamp = ? AND rowid > ?))
         AND field NOT LIKE 'bootstrap\\_%' ESCAPE '\\'
       LIMIT 1`,
    )
    .get(entityType, entityId, sinceRow.timestamp, sinceRow.timestamp, sinceRow.rowid) as
      | { 1: number }
      | undefined;

  return editRow !== undefined;
}
