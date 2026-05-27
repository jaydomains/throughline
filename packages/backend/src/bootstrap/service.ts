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

// Slice 4 — review surface (C-D20 surface 5). `listConflicts` returns the
// currently-stale rows (the persistent surface — rows whose bootstrap_id
// dropped out of a prior import and were flagged `bootstrap_stale=1`).
// In-flight conflicts from a just-completed import live in the
// `BootstrapImportResult.rows` payload returned by `importBootstrap`; the
// review modal consumes both sources.

export interface StaleRow {
  entity_type: BootstrapEntityType;
  entity_id: string;
  bootstrap_id: string;
  title: string;
}

export interface ListConflictsResult {
  project_id: string;
  stale: StaleRow[];
}

// Resolution actions per T-D54.
//   * conflict path: keep_mine (no-op), take_theirs (overwrite with the
//     proposed row provided by the caller; the bootstrap result payload
//     does not persist proposed rows, so the caller — typically the
//     review modal — passes back what it received from the import call).
//     merge_fields (per-field choice) is a v1 carve-out; left to a
//     future polish slice once the modal UX takes shape.
//   * stale path:    keep   (unflip bootstrap_stale; user accepts the row
//                     stays as the canonical record),
//                    delete (call entity-service delete; cascades the
//                     row's tags/refs per FK constraints).
//                    archive is deferred — no archive surface exists in
//                     v1 to hide a kept-but-archived row; reopening when
//                     a future archive surface lands.

export type ConflictAction = 'keep_mine' | 'take_theirs';
export type StaleAction = 'keep' | 'delete';

export interface ConflictResolution {
  entity_type: BootstrapEntityType;
  entity_id: string;
  bootstrap_id: string;
  action: ConflictAction;
  proposed?: unknown; // required when action='take_theirs'; must validate against the bound bundle.
  source_type?: string; // optional, used for audit trigger_context when take_theirs is applied.
}

export interface StaleResolution {
  entity_type: BootstrapEntityType;
  entity_id: string;
  bootstrap_id: string;
  action: StaleAction;
}

export interface ResolveResult {
  applied: number;
  noop: number;
  errors: Array<{ entity_id: string; message: string }>;
}

export interface BootstrapImportService {
  importBootstrap(projectId: string, input: unknown): BootstrapImportResult;
  listConflicts(projectId: string): ListConflictsResult;
  resolveConflicts(
    projectId: string,
    conflicts: ConflictResolution[],
    stale: StaleResolution[],
  ): ResolveResult;
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
  // Exhaustive narrowing — the `never` branch traps any future
  // BootstrapEntityType addition that lands without an audit mapping.
  if (t === 'item') return 'item';
  if (t === 'session') return 'session';
  if (t === 'library') return 'library';
  const exhaustive: never = t;
  throw new Error(`bootstrap: unknown entity_type "${exhaustive as string}"`);
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
    listConflicts(projectId) {
      const project = svc.projects.get(projectId);
      if (!project) throw new BootstrapProjectNotFoundError(projectId);
      return listStaleRows(svc.db, projectId);
    },
    resolveConflicts(projectId, conflicts, stale) {
      // Bundle is required for take_theirs (we re-validate proposed rows
      // against the bound bundle's ItemPolicy) but not for keep_mine /
      // keep / delete. Resolving without a bundle present is allowed for
      // the no-validation actions; take_theirs against no-bundle is
      // rejected per-row with a clear error.
      const project = svc.projects.get(projectId);
      if (!project) throw new BootstrapProjectNotFoundError(projectId);
      return runResolveTransaction(svc, projectId, conflicts, stale);
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

function listStaleRows(db: DB, projectId: string): ListConflictsResult {
  const stale: StaleRow[] = [];
  type StaleQueryRow = { id: string; bootstrap_id: string; title: string };
  const itemRows = db
    .prepare(
      `SELECT id, bootstrap_id, title FROM items
       WHERE project_id = ? AND bootstrap_stale = 1 AND bootstrap_id IS NOT NULL
       ORDER BY bootstrap_id`,
    )
    .all(projectId) as StaleQueryRow[];
  for (const r of itemRows) {
    stale.push({ entity_type: 'item', entity_id: r.id, bootstrap_id: r.bootstrap_id, title: r.title });
  }
  type StaleSessionRow = { id: string; bootstrap_id: string; name: string };
  const sessionRows = db
    .prepare(
      `SELECT id, bootstrap_id, name FROM sessions
       WHERE project_id = ? AND bootstrap_stale = 1 AND bootstrap_id IS NOT NULL
       ORDER BY bootstrap_id`,
    )
    .all(projectId) as StaleSessionRow[];
  for (const r of sessionRows) {
    stale.push({ entity_type: 'session', entity_id: r.id, bootstrap_id: r.bootstrap_id, title: r.name });
  }
  const libraryRows = db
    .prepare(
      `SELECT id, bootstrap_id, title FROM library_entries
       WHERE project_id = ? AND bootstrap_stale = 1 AND bootstrap_id IS NOT NULL
       ORDER BY bootstrap_id`,
    )
    .all(projectId) as StaleQueryRow[];
  for (const r of libraryRows) {
    stale.push({ entity_type: 'library', entity_id: r.id, bootstrap_id: r.bootstrap_id, title: r.title });
  }
  return { project_id: projectId, stale };
}

const VALID_ENTITY_TYPES: ReadonlySet<BootstrapEntityType> = new Set(['item', 'session', 'library']);

function isBootstrapEntityType(v: unknown): v is BootstrapEntityType {
  return typeof v === 'string' && VALID_ENTITY_TYPES.has(v as BootstrapEntityType);
}

function tableForEntity(t: BootstrapEntityType): 'items' | 'sessions' | 'library_entries' {
  // Exhaustive narrowing — defends against runtime payloads slipping past
  // the up-front validation in `runResolveTransaction`. Invalid entity_type
  // values land as per-row errors before reaching this helper.
  if (t === 'item') return 'items';
  if (t === 'session') return 'sessions';
  if (t === 'library') return 'library_entries';
  const exhaustive: never = t;
  throw new Error(`bootstrap: unknown entity_type "${exhaustive as string}"`);
}

function entityExists(
  db: DB,
  projectId: string,
  entityType: BootstrapEntityType,
  entityId: string,
): boolean {
  const row = db
    .prepare(`SELECT 1 FROM ${tableForEntity(entityType)} WHERE id = ? AND project_id = ? LIMIT 1`)
    .get(entityId, projectId);
  return row !== undefined;
}

function runResolveTransaction(
  svc: DBService,
  projectId: string,
  conflicts: ConflictResolution[],
  stale: StaleResolution[],
): ResolveResult {
  const { db } = svc;
  // Resolve policy lazily — only needed when at least one take_theirs lands.
  // Avoids requiring a bound bundle for the keep_mine / keep / delete-only
  // resolve case (matches the listConflicts contract above).
  let policyCache: ItemPolicy | null = null;
  function getPolicy(): ItemPolicy {
    if (policyCache) return policyCache;
    policyCache = resolvePolicy(svc, projectId);
    return policyCache;
  }

  const result: ResolveResult = { applied: 0, noop: 0, errors: [] };
  const tx = db.transaction(() => {
    for (const c of conflicts) {
      // Up-front validation — invalid entity_type / action lands as a
      // per-row error here (matching the tolerant-batch pattern) rather
      // than reaching `tableForEntity` and either silently falling
      // through to library_entries (the bug Gitar flagged on PR #56) or
      // throwing out of the transaction.
      if (!isBootstrapEntityType(c.entity_type)) {
        result.errors.push({
          entity_id: c.entity_id ?? '<missing>',
          message: `invalid entity_type "${String(c.entity_type)}" (expected one of: item, session, library)`,
        });
        continue;
      }
      if (c.action !== 'keep_mine' && c.action !== 'take_theirs') {
        result.errors.push({
          entity_id: c.entity_id,
          message: `invalid conflict action "${String(c.action)}" (expected one of: keep_mine, take_theirs)`,
        });
        continue;
      }
      if (!entityExists(db, projectId, c.entity_type, c.entity_id)) {
        result.errors.push({ entity_id: c.entity_id, message: 'entity_not_found' });
        continue;
      }
      if (c.action === 'keep_mine') {
        result.noop += 1;
        continue;
      }
      // take_theirs — apply the proposed row, re-validating against the bound bundle.
      const validation = validateBootstrapFile(
        {
          version: 1,
          [c.entity_type === 'item' ? 'items' : c.entity_type === 'session' ? 'sessions' : 'library_entries']: [
            c.proposed,
          ],
        },
        getPolicy(),
      );
      if (!validation.ok) {
        result.errors.push({
          entity_id: c.entity_id,
          message: `proposed row failed validation: ${validation.errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`,
        });
        continue;
      }
      const parsed = validation.parsed;
      if (c.entity_type === 'item') {
        const row = parsed.items[0];
        if (!row) {
          result.errors.push({ entity_id: c.entity_id, message: 'proposed row missing for item' });
          continue;
        }
        applyItemReimport(db, c.entity_id, row);
        emitImportAudit(
          db,
          projectId,
          'item',
          c.entity_id,
          c.bootstrap_id,
          c.source_type ?? row.source_type,
          'bootstrap_reimport',
          'reimported',
        );
      } else if (c.entity_type === 'session') {
        const row = parsed.sessions[0];
        if (!row) {
          result.errors.push({ entity_id: c.entity_id, message: 'proposed row missing for session' });
          continue;
        }
        applySessionReimport(db, c.entity_id, row);
        emitImportAudit(
          db,
          projectId,
          'session',
          c.entity_id,
          c.bootstrap_id,
          c.source_type ?? row.source_type,
          'bootstrap_reimport',
          'reimported',
        );
      } else {
        const row = parsed.library_entries[0];
        if (!row) {
          result.errors.push({ entity_id: c.entity_id, message: 'proposed row missing for library entry' });
          continue;
        }
        applyLibraryReimport(db, c.entity_id, row);
        emitImportAudit(
          db,
          projectId,
          'library',
          c.entity_id,
          c.bootstrap_id,
          c.source_type ?? row.source_type,
          'bootstrap_reimport',
          'reimported',
        );
      }
      result.applied += 1;
    }

    for (const s of stale) {
      if (!isBootstrapEntityType(s.entity_type)) {
        result.errors.push({
          entity_id: s.entity_id ?? '<missing>',
          message: `invalid entity_type "${String(s.entity_type)}" (expected one of: item, session, library)`,
        });
        continue;
      }
      if (s.action !== 'keep' && s.action !== 'delete') {
        result.errors.push({
          entity_id: s.entity_id,
          message: `invalid stale action "${String(s.action)}" (expected one of: keep, delete)`,
        });
        continue;
      }
      if (!entityExists(db, projectId, s.entity_type, s.entity_id)) {
        result.errors.push({ entity_id: s.entity_id, message: 'entity_not_found' });
        continue;
      }
      if (s.action === 'keep') {
        // Unflip bootstrap_stale; emit bootstrap_reimport audit so the
        // user-acknowledged state lives in the audit trail under the
        // bootstrap_* family (preserving the predicate's reading on
        // subsequent imports).
        const table = tableForEntity(s.entity_type);
        db.prepare(`UPDATE ${table} SET bootstrap_stale = 0, updated_at = ? WHERE id = ?`).run(
          new Date().toISOString(),
          s.entity_id,
        );
        const sourceType = s.bootstrap_id.split(':')[0] ?? 'unknown';
        emitImportAudit(
          db,
          projectId,
          s.entity_type,
          s.entity_id,
          s.bootstrap_id,
          sourceType,
          'bootstrap_reimport',
          'reimported',
        );
        result.applied += 1;
      } else {
        // delete — go through the entity service so cascade audit /
        // hooks fire (T-D33 orphan rules, mentions cascade, etc.).
        if (s.entity_type === 'item') {
          svc.items.delete(s.entity_id);
        } else if (s.entity_type === 'session') {
          svc.sessions.delete(s.entity_id);
        } else {
          svc.library.delete(s.entity_id);
        }
        result.applied += 1;
      }
    }
  });
  tx();
  return result;
}

// Re-export for the routes layer + tests.
export { validateBootstrapFile } from './validator.js';
export { hasUserEditsSinceLastBootstrap } from './predicate.js';
