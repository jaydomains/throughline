import type { AuditActor, AuditEntityType, ItemPolicy } from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';
import type { ItemsService } from '../items/service.js';
import type { LibraryService } from '../library/service.js';
import type { SessionsService } from '../sessions/service.js';
import type { ProjectsService } from '../projects/service.js';
import type { MethodologyRegistry } from '../methodology/loader.js';
import { bundleItemPolicy } from '../items/policy.js';
import { hasUserEditsSinceLastBootstrap, type BootstrapEntityType } from './predicate.js';
import {
  validateBootstrapFile,
  type BootstrapValidationError,
  type ItemRowInput,
  type LibraryRowInput,
  type ParsedBootstrapFile,
  type SessionRowInput,
} from './validator.js';

// C-D20 surfaces 2 + 4 — `POST /api/projects/:id/import` orchestration.
// The bootstrap service is the stateful upsert layer that consumes the
// validator's parsed file and applies it transactionally:
//
//   * NEW rows         → call existing entity service `create()` (which
//                        emits `create` audit) then raw-UPDATE `bootstrap_id`;
//                        emit `bootstrap_import` audit.
//   * REIMPORT rows    → raw-UPDATE entity fields + `bootstrap_stale=0`;
//                        emit `bootstrap_reimport` audit (single audit row;
//                        no per-field `actor: 'user'` audit churn).
//   * CONFLICT rows    → no SQL action; record per-row classification with
//                        a reason; the Slice 4 review-UI surfaces them.
//   * STALE rows       → at end-of-transaction sweep: rows whose
//                        `bootstrap_id` is non-null and absent from the
//                        current import set get `bootstrap_stale=1`;
//                        emit `bootstrap_stale` audit. Never auto-deleted.
//
// C-D20 originally named `upsertByBootstrapId` methods on each entity
// service; this slice keeps the upsert SQL inline in this module instead.
// The methods would have been 100% bootstrap-specific with asymmetric audit
// semantics (no audit emission inside the method); inline SQL co-locates
// the classification logic with its corresponding write, and the audit
// emission stays in one place. CODE_SPEC.md C-D20 is updated in this slice
// to reflect this implementation-shape choice; no T-D anchor changes.

export type RowStatus = 'new' | 'reimported' | 'conflict' | 'stale_flagged';

export interface RowResult {
  bootstrap_id: string;
  entity_type: BootstrapEntityType;
  entity_id: string | null; // null when classification is conflict-without-prior-resolution
  status: RowStatus;
  reason?: string;
}

export interface BootstrapImportResult {
  project_id: string;
  rows: RowResult[];
  counts: { new: number; reimported: number; conflict: number; stale_flagged: number };
}

export class BootstrapValidationFailedError extends Error {
  constructor(public errors: BootstrapValidationError[]) {
    super(`bootstrap import file failed validation (${errors.length} error${errors.length === 1 ? '' : 's'})`);
  }
}

export class BootstrapProjectNotFoundError extends Error {
  constructor(public projectId: string) {
    super(`project ${projectId} not found`);
  }
}

export class BootstrapNoBundleBoundError extends Error {
  constructor(public projectId: string) {
    super(`project ${projectId} has no bundle bound; clone-and-go init (§7.26) is required before bootstrap`);
  }
}

export interface BootstrapImportService {
  importBootstrap(projectId: string, input: unknown): BootstrapImportResult;
}

interface DBService {
  db: DB;
  projects: ProjectsService;
  items: ItemsService;
  sessions: SessionsService;
  library: LibraryService;
  registry: MethodologyRegistry;
}

function resolvePolicy(svc: DBService, projectId: string): ItemPolicy {
  const project = svc.projects.get(projectId);
  if (!project) throw new BootstrapProjectNotFoundError(projectId);
  const result = svc.registry.resolveBundle(project.bundle_id, project.bundle_path, project.repo_path);
  if (result.status !== 'loaded') {
    throw new BootstrapNoBundleBoundError(projectId);
  }
  return bundleItemPolicy(result.bundle);
}

const BOOTSTRAP_ACTOR: AuditActor = 'system';

function entityTypeForAudit(t: BootstrapEntityType): AuditEntityType {
  return t === 'item' ? 'item' : t === 'session' ? 'session' : 'library';
}

function emitImportAudit(
  db: DB,
  projectId: string,
  entityType: BootstrapEntityType,
  entityId: string,
  bootstrapId: string,
  sourceType: string,
  field: 'bootstrap_import' | 'bootstrap_reimport' | 'bootstrap_stale',
  status: RowStatus,
): void {
  appendAudit(db, {
    projectId,
    entityType: entityTypeForAudit(entityType),
    entityId,
    actor: BOOTSTRAP_ACTOR,
    field,
    triggerContext: { bootstrap_id: bootstrapId, source_type: sourceType, status },
  });
}

function findExistingByBootstrapId(
  db: DB,
  table: 'items' | 'sessions' | 'library_entries',
  projectId: string,
  bootstrapId: string,
): string | null {
  const row = db
    .prepare(`SELECT id FROM ${table} WHERE project_id = ? AND bootstrap_id = ?`)
    .get(projectId, bootstrapId) as { id: string } | undefined;
  return row?.id ?? null;
}

function stampBootstrapId(
  db: DB,
  table: 'items' | 'sessions' | 'library_entries',
  entityId: string,
  bootstrapId: string,
): void {
  db.prepare(
    `UPDATE ${table} SET bootstrap_id = ?, bootstrap_stale = 0 WHERE id = ?`,
  ).run(bootstrapId, entityId);
}

function applyItemReimport(db: DB, entityId: string, row: ItemRowInput): void {
  const now = new Date().toISOString();
  // Update the core columns. The validator already proved type+status are
  // bundle-valid for this row; the re-import overwrites without re-validating
  // (the project's bundle has not changed mid-transaction).
  db.prepare(
    `UPDATE items
       SET title = ?, description = ?, type = ?, status = ?,
           blocker_text = ?, branch_ref = ?,
           bootstrap_stale = 0, updated_at = ?
     WHERE id = ?`,
  ).run(
    row.title,
    row.description ?? '',
    row.type,
    row.status,
    row.blocker_text ?? null,
    row.branch_ref ?? null,
    now,
    entityId,
  );
  // Replace item_tags wholesale when `tags` is provided; leave alone when
  // not provided (the optional-field-absence-means-no-update convention).
  if (row.tags !== undefined) {
    db.prepare('DELETE FROM item_tags WHERE item_id = ?').run(entityId);
    const insertTag = db.prepare('INSERT INTO item_tags (item_id, tag) VALUES (?, ?)');
    for (const tag of row.tags) {
      insertTag.run(entityId, tag);
    }
  }
}

function applySessionReimport(db: DB, entityId: string, row: SessionRowInput): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE sessions
       SET name = ?, branch_ref = ?, context = ?, bootstrap_stale = 0, updated_at = ?
     WHERE id = ?`,
  ).run(row.name, row.branch_ref ?? null, row.context ?? null, now, entityId);
}

function applyLibraryReimport(db: DB, entityId: string, row: LibraryRowInput): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE library_entries
       SET title = ?, body = ?, tags_json = ?, summary = ?, type = ?,
           bootstrap_stale = 0, updated_at = ?
     WHERE id = ?`,
  ).run(
    row.title,
    row.body,
    JSON.stringify(row.tags),
    row.summary ?? null,
    row.type,
    now,
    entityId,
  );
}

export function createBootstrapImportService(svc: DBService): BootstrapImportService {
  return {
    importBootstrap(projectId, input) {
      const policy = resolvePolicy(svc, projectId);
      const validation = validateBootstrapFile(input, policy);
      if (!validation.ok) {
        throw new BootstrapValidationFailedError(validation.errors);
      }
      return runImportTransaction(svc, projectId, validation.parsed);
    },
  };
}

function runImportTransaction(
  svc: DBService,
  projectId: string,
  parsed: ParsedBootstrapFile,
): BootstrapImportResult {
  const { db, items, sessions, library } = svc;
  const rows: RowResult[] = [];
  const counts = { new: 0, reimported: 0, conflict: 0, stale_flagged: 0 };

  // Capture the set of bootstrap_ids referenced in this import. The
  // stale-sweep at end-of-transaction flips bootstrap_stale=1 on rows whose
  // bootstrap_id is non-null, absent from this set, and currently
  // bootstrap_stale=0. Captured before the transaction body so the sweep
  // sees the input shape regardless of which rows the transaction inserts.
  const itemBootstrapIds = new Set(parsed.items.map((r) => r.bootstrap_id));
  const sessionBootstrapIds = new Set(parsed.sessions.map((r) => r.bootstrap_id));
  const libraryBootstrapIds = new Set(parsed.library_entries.map((r) => r.bootstrap_id));

  const tx = db.transaction(() => {
    // --- items ---
    for (const row of parsed.items) {
      const existing = findExistingByBootstrapId(db, 'items', projectId, row.bootstrap_id);
      if (existing === null) {
        const created = items.create({
          project_id: projectId,
          title: row.title,
          type: row.type,
          status: row.status,
          ...(row.description !== undefined ? { description: row.description } : {}),
          // CreateItemInput.blocker_text is `string` (not nullable); a row
          // carrying `blocker_text: null` is treated as "no blocker text",
          // matching the absent-field case.
          ...(typeof row.blocker_text === 'string' ? { blocker_text: row.blocker_text } : {}),
          ...(row.branch_ref !== undefined ? { branch_ref: row.branch_ref } : {}),
          ...(row.tags !== undefined ? { tags: row.tags } : {}),
        });
        stampBootstrapId(db, 'items', created.id, row.bootstrap_id);
        emitImportAudit(db, projectId, 'item', created.id, row.bootstrap_id, row.source_type, 'bootstrap_import', 'new');
        rows.push({ bootstrap_id: row.bootstrap_id, entity_type: 'item', entity_id: created.id, status: 'new' });
        counts.new += 1;
        continue;
      }
      if (hasUserEditsSinceLastBootstrap(db, 'item', existing)) {
        rows.push({
          bootstrap_id: row.bootstrap_id,
          entity_type: 'item',
          entity_id: existing,
          status: 'conflict',
          reason: 'user_edits_since_last_bootstrap',
        });
        counts.conflict += 1;
        continue;
      }
      applyItemReimport(db, existing, row);
      emitImportAudit(db, projectId, 'item', existing, row.bootstrap_id, row.source_type, 'bootstrap_reimport', 'reimported');
      rows.push({ bootstrap_id: row.bootstrap_id, entity_type: 'item', entity_id: existing, status: 'reimported' });
      counts.reimported += 1;
    }

    // --- sessions ---
    for (const row of parsed.sessions) {
      const existing = findExistingByBootstrapId(db, 'sessions', projectId, row.bootstrap_id);
      if (existing === null) {
        const created = sessions.create({
          project_id: projectId,
          name: row.name,
          ...(row.branch_ref !== undefined ? { branch_ref: row.branch_ref } : {}),
          ...(row.context !== undefined ? { context: row.context } : {}),
        });
        stampBootstrapId(db, 'sessions', created.id, row.bootstrap_id);
        emitImportAudit(db, projectId, 'session', created.id, row.bootstrap_id, row.source_type, 'bootstrap_import', 'new');
        rows.push({ bootstrap_id: row.bootstrap_id, entity_type: 'session', entity_id: created.id, status: 'new' });
        counts.new += 1;
        continue;
      }
      if (hasUserEditsSinceLastBootstrap(db, 'session', existing)) {
        rows.push({
          bootstrap_id: row.bootstrap_id,
          entity_type: 'session',
          entity_id: existing,
          status: 'conflict',
          reason: 'user_edits_since_last_bootstrap',
        });
        counts.conflict += 1;
        continue;
      }
      applySessionReimport(db, existing, row);
      emitImportAudit(db, projectId, 'session', existing, row.bootstrap_id, row.source_type, 'bootstrap_reimport', 'reimported');
      rows.push({ bootstrap_id: row.bootstrap_id, entity_type: 'session', entity_id: existing, status: 'reimported' });
      counts.reimported += 1;
    }

    // --- library_entries ---
    for (const row of parsed.library_entries) {
      const existing = findExistingByBootstrapId(db, 'library_entries', projectId, row.bootstrap_id);
      if (existing === null) {
        const created = library.create({
          project_id: projectId,
          type: row.type,
          title: row.title,
          body: row.body,
          tags: row.tags,
          ...(row.summary !== undefined && row.summary !== null ? { summary: row.summary } : {}),
        });
        stampBootstrapId(db, 'library_entries', created.id, row.bootstrap_id);
        emitImportAudit(db, projectId, 'library', created.id, row.bootstrap_id, row.source_type, 'bootstrap_import', 'new');
        rows.push({ bootstrap_id: row.bootstrap_id, entity_type: 'library', entity_id: created.id, status: 'new' });
        counts.new += 1;
        continue;
      }
      if (hasUserEditsSinceLastBootstrap(db, 'library', existing)) {
        rows.push({
          bootstrap_id: row.bootstrap_id,
          entity_type: 'library',
          entity_id: existing,
          status: 'conflict',
          reason: 'user_edits_since_last_bootstrap',
        });
        counts.conflict += 1;
        continue;
      }
      applyLibraryReimport(db, existing, row);
      emitImportAudit(db, projectId, 'library', existing, row.bootstrap_id, row.source_type, 'bootstrap_reimport', 'reimported');
      rows.push({ bootstrap_id: row.bootstrap_id, entity_type: 'library', entity_id: existing, status: 'reimported' });
      counts.reimported += 1;
    }

    // --- stale sweep ---
    // Per T-D54: rows whose bootstrap_id appeared in a prior import but is
    // absent from the current one get `bootstrap_stale=true`. The sweep
    // operates per entity table; only flips rows currently bootstrap_stale=0
    // so re-running an import does not emit duplicate `bootstrap_stale`
    // audit rows. Rows are never auto-deleted (T-D54: surfaces in the
    // review queue with keep / archive / delete actions).
    sweepStale(db, projectId, 'items', 'item', itemBootstrapIds, rows, counts);
    sweepStale(db, projectId, 'sessions', 'session', sessionBootstrapIds, rows, counts);
    sweepStale(db, projectId, 'library_entries', 'library', libraryBootstrapIds, rows, counts);
  });
  tx();

  return { project_id: projectId, rows, counts };
}

function sweepStale(
  db: DB,
  projectId: string,
  table: 'items' | 'sessions' | 'library_entries',
  entityType: BootstrapEntityType,
  presentIds: Set<string>,
  rows: RowResult[],
  counts: BootstrapImportResult['counts'],
): void {
  const stale = db
    .prepare(
      `SELECT id, bootstrap_id FROM ${table}
       WHERE project_id = ? AND bootstrap_id IS NOT NULL AND bootstrap_stale = 0`,
    )
    .all(projectId) as Array<{ id: string; bootstrap_id: string }>;
  for (const { id, bootstrap_id } of stale) {
    if (presentIds.has(bootstrap_id)) continue;
    db.prepare(`UPDATE ${table} SET bootstrap_stale = 1, updated_at = ? WHERE id = ?`).run(
      new Date().toISOString(),
      id,
    );
    // Source type derived from the bootstrap_id prefix; the audit row keeps
    // the same trigger_context shape as bootstrap_import / bootstrap_reimport.
    const sourceType = bootstrap_id.split(':')[0] ?? 'unknown';
    emitImportAudit(db, projectId, entityType, id, bootstrap_id, sourceType, 'bootstrap_stale', 'stale_flagged');
    rows.push({ bootstrap_id, entity_type: entityType, entity_id: id, status: 'stale_flagged' });
    counts.stale_flagged += 1;
  }
}

// Re-export for the routes layer + tests.
export { validateBootstrapFile } from './validator.js';
export { hasUserEditsSinceLastBootstrap } from './predicate.js';
