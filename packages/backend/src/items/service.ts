import { nanoid } from 'nanoid';
import type {
  BundleLoadResult,
  CreateItemInput,
  Item,
  ItemPolicy,
  UpdateItemInput,
} from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';
import type { MethodologyRegistry } from '../methodology/loader.js';
import type { ProjectsService } from '../projects/service.js';
import { bundleItemPolicy } from './policy.js';

interface ItemRow {
  id: string;
  project_id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  blocker_text: string | null;
  parent_id: string | null;
  branch_ref: string | null;
  created_at: string;
  updated_at: string;
}

export class ItemPolicyError extends Error {
  constructor(message: string, public field: 'type' | 'status') {
    super(message);
  }
}

export class ItemNotFoundError extends Error {
  constructor(id: string) {
    super(`item ${id} not found`);
  }
}

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`project ${id} not found`);
  }
}

export class BlockerCycleError extends Error {
  constructor() {
    super('blocker would form a cycle');
  }
}

export interface ListItemsFilter {
  project_id: string;
  session_id?: string;
  parent_id?: string | null;
}

export interface ItemsService {
  policy(projectId: string): ItemPolicy;
  list(filter: ListItemsFilter): Item[];
  get(id: string): Item | null;
  create(input: CreateItemInput): Item;
  update(id: string, input: UpdateItemInput): Item;
  delete(id: string): void;
  addTag(id: string, tag: string): void;
  removeTag(id: string, tag: string): void;
  addBlocker(id: string, blockedById: string): void;
  removeBlocker(id: string, blockedById: string): void;
  addSessionMembership(id: string, sessionId: string): void;
  removeSessionMembership(id: string, sessionId: string): void;
}

function rowToItem(db: DB, row: ItemRow): Item {
  const tags = (db.prepare('SELECT tag FROM item_tags WHERE item_id = ? ORDER BY tag').all(row.id) as Array<{ tag: string }>).map((r) => r.tag);
  const blockers = (db.prepare('SELECT blocked_by_item_id FROM item_blockers WHERE item_id = ?').all(row.id) as Array<{ blocked_by_item_id: string }>).map((r) => r.blocked_by_item_id);
  const session_ids = (db.prepare('SELECT session_id FROM item_session_memberships WHERE item_id = ?').all(row.id) as Array<{ session_id: string }>).map((r) => r.session_id);
  return {
    id: row.id,
    project_id: row.project_id,
    type: row.type,
    title: row.title,
    description: row.description,
    status: row.status,
    blocker_text: row.blocker_text,
    parent_id: row.parent_id,
    branch_ref: row.branch_ref,
    tags,
    blockers,
    session_ids,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function bundleFor(registry: MethodologyRegistry, bundleId: string): BundleLoadResult {
  const r = registry.get(bundleId);
  if (!r) throw new Error(`bundle "${bundleId}" not loaded`);
  return r;
}

function policyFor(registry: MethodologyRegistry, bundleId: string): ItemPolicy {
  const r = bundleFor(registry, bundleId);
  if (r.status !== 'loaded') {
    throw new Error(`bundle "${bundleId}" failed to load`);
  }
  return bundleItemPolicy(r.bundle);
}

export function createItemsService(
  db: DB,
  projects: ProjectsService,
  registry: MethodologyRegistry,
): ItemsService {
  function touch(id: string): void {
    db.prepare('UPDATE items SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  }

  function getRow(id: string): ItemRow | null {
    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as ItemRow | undefined;
    return row ?? null;
  }

  return {
    policy(projectId) {
      const project = projects.get(projectId);
      if (!project) throw new ProjectNotFoundError(projectId);
      return policyFor(registry, project.bundle_id);
    },

    list({ project_id, session_id, parent_id }) {
      const joinParams: unknown[] = [];
      const filterParams: unknown[] = [project_id];
      const filters: string[] = ['i.project_id = ?'];
      let joins = '';
      if (session_id !== undefined) {
        joins = ' INNER JOIN item_session_memberships m ON m.item_id = i.id AND m.session_id = ?';
        joinParams.push(session_id);
      }
      if (parent_id === null) filters.push('i.parent_id IS NULL');
      else if (parent_id !== undefined) {
        filters.push('i.parent_id = ?');
        filterParams.push(parent_id);
      }
      const sql = `SELECT i.* FROM items i${joins} WHERE ${filters.join(' AND ')} ORDER BY i.created_at ASC`;
      const rows = db.prepare(sql).all(...joinParams, ...filterParams) as ItemRow[];
      return rows.map((r) => rowToItem(db, r));
    },

    get(id) {
      const row = getRow(id);
      return row ? rowToItem(db, row) : null;
    },

    create(input) {
      const project = projects.get(input.project_id);
      if (!project) throw new ProjectNotFoundError(input.project_id);
      const policy = policyFor(registry, project.bundle_id);
      const type = input.type ?? policy.types[0];
      if (type === undefined || !policy.types.includes(type)) {
        throw new ItemPolicyError(`item type "${input.type}" not allowed by bundle ${policy.bundle_id}`, 'type');
      }
      const status = input.status ?? policy.statuses[0];
      if (status === undefined || !policy.statuses.includes(status)) {
        throw new ItemPolicyError(`item status "${input.status}" not allowed by bundle ${policy.bundle_id}`, 'status');
      }
      if (input.parent_id !== undefined && input.parent_id !== null) {
        const parent = getRow(input.parent_id);
        if (!parent || parent.project_id !== project.id) {
          throw new ItemNotFoundError(input.parent_id);
        }
      }
      const id = nanoid();
      const now = new Date().toISOString();
      const tx = db.transaction(() => {
        db.prepare(
          `INSERT INTO items (id, project_id, type, title, description, status, blocker_text, parent_id, branch_ref, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          project.id,
          type,
          input.title,
          input.description ?? '',
          status,
          input.blocker_text ?? null,
          input.parent_id ?? null,
          input.branch_ref ?? null,
          now,
          now,
        );
        for (const tag of input.tags ?? []) {
          db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag) VALUES (?, ?)').run(id, tag);
        }
        for (const sid of input.session_ids ?? []) {
          db.prepare('INSERT OR IGNORE INTO item_session_memberships (item_id, session_id) VALUES (?, ?)').run(id, sid);
        }
      });
      tx();
      appendAudit(db, {
        projectId: project.id,
        entityType: 'item',
        entityId: id,
        actor: 'user',
        field: 'create',
        newValue: input.title,
        triggerContext: { type, status },
      });
      return this.get(id)!;
    },

    update(id, input) {
      const before = getRow(id);
      if (!before) throw new ItemNotFoundError(id);
      const project = projects.get(before.project_id);
      if (!project) throw new ProjectNotFoundError(before.project_id);
      const policy = policyFor(registry, project.bundle_id);

      const next: ItemRow = {
        ...before,
        type: input.type ?? before.type,
        title: input.title ?? before.title,
        description: input.description ?? before.description,
        status: input.status ?? before.status,
        blocker_text:
          input.blocker_text === undefined ? before.blocker_text : input.blocker_text,
        parent_id: input.parent_id === undefined ? before.parent_id : input.parent_id,
        branch_ref: input.branch_ref === undefined ? before.branch_ref : input.branch_ref,
        updated_at: new Date().toISOString(),
      };
      if (!policy.types.includes(next.type)) {
        throw new ItemPolicyError(`item type "${next.type}" not allowed by bundle ${policy.bundle_id}`, 'type');
      }
      if (!policy.statuses.includes(next.status)) {
        throw new ItemPolicyError(`item status "${next.status}" not allowed by bundle ${policy.bundle_id}`, 'status');
      }
      if (next.parent_id !== null && next.parent_id !== before.parent_id) {
        const parent = getRow(next.parent_id);
        if (!parent || parent.project_id !== before.project_id) {
          throw new ItemNotFoundError(next.parent_id);
        }
        // Prevent simple cycles: walk up from the proposed parent.
        let walker: ItemRow | null = parent;
        const seen = new Set<string>();
        while (walker) {
          if (walker.id === id) throw new BlockerCycleError();
          if (seen.has(walker.id)) break;
          seen.add(walker.id);
          walker = walker.parent_id ? getRow(walker.parent_id) : null;
        }
      }

      db.prepare(
        `UPDATE items
           SET type = ?, title = ?, description = ?, status = ?, blocker_text = ?, parent_id = ?, branch_ref = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        next.type,
        next.title,
        next.description,
        next.status,
        next.blocker_text,
        next.parent_id,
        next.branch_ref,
        next.updated_at,
        id,
      );

      for (const [field, oldV, newV] of [
        ['type', before.type, next.type],
        ['title', before.title, next.title],
        ['description', before.description, next.description],
        ['status', before.status, next.status],
        ['blocker_text', before.blocker_text ?? '', next.blocker_text ?? ''],
        ['parent_id', before.parent_id ?? '', next.parent_id ?? ''],
        ['branch_ref', before.branch_ref ?? '', next.branch_ref ?? ''],
      ] as const) {
        if (oldV !== newV) {
          appendAudit(db, {
            projectId: before.project_id,
            entityType: 'item',
            entityId: id,
            actor: 'user',
            field,
            oldValue: String(oldV),
            newValue: String(newV),
          });
        }
      }

      return this.get(id)!;
    },

    delete(id) {
      const before = getRow(id);
      if (!before) return;
      db.prepare('DELETE FROM items WHERE id = ?').run(id);
      appendAudit(db, {
        projectId: before.project_id,
        entityType: 'item',
        entityId: id,
        actor: 'user',
        field: 'delete',
        oldValue: before.title,
      });
    },

    addTag(id, tag) {
      const before = getRow(id);
      if (!before) throw new ItemNotFoundError(id);
      const r = db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag) VALUES (?, ?)').run(id, tag);
      if (r.changes > 0) {
        touch(id);
        appendAudit(db, {
          projectId: before.project_id,
          entityType: 'item',
          entityId: id,
          actor: 'user',
          field: 'tag_add',
          newValue: tag,
        });
      }
    },

    removeTag(id, tag) {
      const before = getRow(id);
      if (!before) throw new ItemNotFoundError(id);
      const r = db.prepare('DELETE FROM item_tags WHERE item_id = ? AND tag = ?').run(id, tag);
      if (r.changes > 0) {
        touch(id);
        appendAudit(db, {
          projectId: before.project_id,
          entityType: 'item',
          entityId: id,
          actor: 'user',
          field: 'tag_remove',
          oldValue: tag,
        });
      }
    },

    addBlocker(id, blockedById) {
      if (id === blockedById) throw new BlockerCycleError();
      const before = getRow(id);
      if (!before) throw new ItemNotFoundError(id);
      const target = getRow(blockedById);
      if (!target || target.project_id !== before.project_id) throw new ItemNotFoundError(blockedById);
      const r = db
        .prepare('INSERT OR IGNORE INTO item_blockers (item_id, blocked_by_item_id) VALUES (?, ?)')
        .run(id, blockedById);
      if (r.changes > 0) {
        touch(id);
        appendAudit(db, {
          projectId: before.project_id,
          entityType: 'item',
          entityId: id,
          actor: 'user',
          field: 'blocker_add',
          newValue: blockedById,
        });
      }
    },

    removeBlocker(id, blockedById) {
      const before = getRow(id);
      if (!before) throw new ItemNotFoundError(id);
      const r = db
        .prepare('DELETE FROM item_blockers WHERE item_id = ? AND blocked_by_item_id = ?')
        .run(id, blockedById);
      if (r.changes > 0) {
        touch(id);
        appendAudit(db, {
          projectId: before.project_id,
          entityType: 'item',
          entityId: id,
          actor: 'user',
          field: 'blocker_remove',
          oldValue: blockedById,
        });
      }
    },

    addSessionMembership(id, sessionId) {
      const before = getRow(id);
      if (!before) throw new ItemNotFoundError(id);
      const r = db
        .prepare('INSERT OR IGNORE INTO item_session_memberships (item_id, session_id) VALUES (?, ?)')
        .run(id, sessionId);
      if (r.changes > 0) {
        appendAudit(db, {
          projectId: before.project_id,
          entityType: 'item',
          entityId: id,
          actor: 'user',
          field: 'session_add',
          newValue: sessionId,
        });
      }
    },

    removeSessionMembership(id, sessionId) {
      const before = getRow(id);
      if (!before) throw new ItemNotFoundError(id);
      const r = db
        .prepare('DELETE FROM item_session_memberships WHERE item_id = ? AND session_id = ?')
        .run(id, sessionId);
      if (r.changes > 0) {
        appendAudit(db, {
          projectId: before.project_id,
          entityType: 'item',
          entityId: id,
          actor: 'user',
          field: 'session_remove',
          oldValue: sessionId,
        });
      }
    },
  };
}
