import { nanoid } from 'nanoid';
import type {
  CreateDirectiveInput,
  Directive,
  DirectiveKind,
  DirectiveParentType,
  DirectivePayload,
  ReminderPayload,
  UpdateDirectiveInput,
} from '@throughline/shared';
import { ProjectNotFoundError } from '@throughline/shared';
import { DomainError, NotFoundError } from '@throughline/shared';
import {
  advanceRecurrence,
  computeNextFireAt,
  isDirectiveKind,
  isDirectiveParentType,
} from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';
import type { ItemsService } from '../items/service.js';
import type { LibraryService } from '../library/service.js';
import type { ProjectsService } from '../projects/service.js';

// Phase 6b — directives service (SPEC §7.10; T-D12, T-D32, T-D36).
// Three directive kinds in v1 (T-D12): pin, reminder, include_prompt. Reminder firing
// uses the OS notification capability layer (T-D32) via the scheduler; this service
// owns CRUD + the next_fire_at lifecycle.

export class DirectiveNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`directive ${id} not found`, 'directive_not_found');
  }
}

export class ParentNotFoundError extends NotFoundError {
  constructor(parentType: DirectiveParentType, parentId: string) {
    super(`${parentType} ${parentId} not found`, 'parent_not_found');
  }
}

export class CrossProjectDirectiveError extends DomainError {
  constructor(projectId: string, parentProjectId: string) {
    super(`cross-project directive refused: project ${projectId} ≠ parent project ${parentProjectId}`, { statusCode: 422, code: 'cross_project_directive' });
  }
}

export class InvalidPayloadError extends DomainError {
  constructor(message: string) {
    super(`invalid directive payload: ${message}`, { statusCode: 400, code: 'invalid_payload' });
  }
}

export class InvalidKindError extends DomainError {
  constructor(kind: string) {
    super(`invalid directive kind "${kind}"`, { statusCode: 400, code: 'invalid_kind' });
  }
}

export class InvalidParentTypeError extends DomainError {
  constructor(parentType: string) {
    super(`invalid directive parent_type "${parentType}"`, { statusCode: 400, code: 'invalid_parent_type' });
  }
}

interface DirectiveRow {
  id: string;
  project_id: string;
  parent_type: DirectiveParentType;
  parent_id: string;
  kind: DirectiveKind;
  payload_json: string;
  next_fire_at: string | null;
  last_fired_at: string | null;
  created_at: string;
}

function rowToDirective(row: DirectiveRow): Directive {
  return {
    id: row.id,
    project_id: row.project_id,
    parent_type: row.parent_type,
    parent_id: row.parent_id,
    kind: row.kind,
    payload: JSON.parse(row.payload_json) as DirectivePayload,
    next_fire_at: row.next_fire_at,
    last_fired_at: row.last_fired_at,
    created_at: row.created_at,
  };
}

export interface ListDirectivesFilter {
  projectId: string;
  parentType?: DirectiveParentType;
  parentId?: string;
  kind?: DirectiveKind;
}

export interface DirectivesService {
  get(id: string): Directive | null;
  list(filter: ListDirectivesFilter): Directive[];
  listForParent(parentType: DirectiveParentType, parentId: string): Directive[];
  create(input: CreateDirectiveInput): Directive;
  update(id: string, input: UpdateDirectiveInput): Directive;
  delete(id: string): void;
  listDueReminders(now: Date): Directive[];
  markFired(id: string, now: Date): Directive;
  countByKind(projectId: string): Record<DirectiveKind, number>;
}

export interface CreateDirectivesServiceOptions {
  // Test seam — defaults to `() => new Date()`; tests pass a deterministic clock so
  // computeNextFireAt is reproducible.
  now?: () => Date;
}

export function createDirectivesService(
  db: DB,
  projects: ProjectsService,
  items: ItemsService,
  library: LibraryService,
  options: CreateDirectivesServiceOptions = {},
): DirectivesService {
  const clock = options.now ?? (() => new Date());

  function getRow(id: string): DirectiveRow | null {
    const row = db.prepare('SELECT * FROM directives WHERE id = ?').get(id) as
      | DirectiveRow
      | undefined;
    return row ?? null;
  }

  function resolveParent(
    parentType: DirectiveParentType,
    parentId: string,
  ): { project_id: string } | null {
    if (parentType === 'item') {
      const item = items.get(parentId);
      return item ? { project_id: item.project_id } : null;
    }
    const entry = library.get(parentId);
    return entry ? { project_id: entry.project_id } : null;
  }

  function validatePayload(kind: DirectiveKind, payload: DirectivePayload): void {
    if (kind === 'pin' || kind === 'include_prompt') return;
    const r = payload as ReminderPayload;
    if (r.mode !== 'absolute' && r.mode !== 'relative') {
      throw new InvalidPayloadError('reminder.mode must be "absolute" or "relative"');
    }
    if (r.mode === 'absolute') {
      if (typeof r.fire_at !== 'string' || r.fire_at.length === 0) {
        throw new InvalidPayloadError('reminder absolute mode requires fire_at ISO timestamp');
      }
      const t = new Date(r.fire_at);
      if (Number.isNaN(t.getTime())) {
        throw new InvalidPayloadError('reminder.fire_at is not a valid timestamp');
      }
    } else {
      if (typeof r.relative_spec !== 'string' || r.relative_spec.length === 0) {
        throw new InvalidPayloadError('reminder relative mode requires relative_spec');
      }
      const resolved = computeNextFireAt('reminder', r, clock());
      if (resolved === null) {
        throw new InvalidPayloadError(
          `relative_spec "${r.relative_spec}" not recognised (try "in 3 days" or "tomorrow 14:00")`,
        );
      }
    }
    if (r.recurrence !== undefined) {
      if (
        !Number.isFinite(r.recurrence.every) ||
        r.recurrence.every <= 0 ||
        !['minute', 'hour', 'day', 'week'].includes(r.recurrence.unit)
      ) {
        throw new InvalidPayloadError('reminder.recurrence requires every >= 1 and a valid unit');
      }
    }
  }

  // Normalises the payload so we store the resolved fire_at on reminders even when the
  // user originally supplied a relative spec. Keeps the relative_spec for display.
  function normalisePayload(kind: DirectiveKind, payload: DirectivePayload): DirectivePayload {
    if (kind !== 'reminder') return payload;
    const r = payload as ReminderPayload;
    const next = computeNextFireAt('reminder', r, clock());
    if (r.mode === 'relative' && next !== null) {
      return { ...r, fire_at: next };
    }
    if (r.mode === 'absolute' && next !== null) {
      return { ...r, fire_at: next };
    }
    return r;
  }

  return {
    get(id) {
      const row = getRow(id);
      return row ? rowToDirective(row) : null;
    },

    list({ projectId, parentType, parentId, kind }) {
      const params: string[] = [projectId];
      const where: string[] = ['project_id = ?'];
      if (parentType) {
        where.push('parent_type = ?');
        params.push(parentType);
      }
      if (parentId) {
        where.push('parent_id = ?');
        params.push(parentId);
      }
      if (kind) {
        where.push('kind = ?');
        params.push(kind);
      }
      const rows = db
        .prepare(
          `SELECT * FROM directives WHERE ${where.join(' AND ')} ORDER BY created_at ASC`,
        )
        .all(...params) as DirectiveRow[];
      return rows.map(rowToDirective);
    },

    listForParent(parentType, parentId) {
      const rows = db
        .prepare(
          `SELECT * FROM directives WHERE parent_type = ? AND parent_id = ? ORDER BY created_at ASC`,
        )
        .all(parentType, parentId) as DirectiveRow[];
      return rows.map(rowToDirective);
    },

    create(input) {
      const project = projects.get(input.project_id);
      if (!project) throw new ProjectNotFoundError(input.project_id);
      if (!isDirectiveKind(input.kind)) throw new InvalidKindError(input.kind);
      if (!isDirectiveParentType(input.parent_type)) {
        throw new InvalidParentTypeError(input.parent_type);
      }
      const parent = resolveParent(input.parent_type, input.parent_id);
      if (!parent) throw new ParentNotFoundError(input.parent_type, input.parent_id);
      if (parent.project_id !== project.id) {
        throw new CrossProjectDirectiveError(project.id, parent.project_id);
      }
      const payload = input.payload ?? ({} as DirectivePayload);
      validatePayload(input.kind, payload);
      const stored = normalisePayload(input.kind, payload);
      const nextFireAt = computeNextFireAt(input.kind, stored, clock());

      const id = nanoid();
      const now = clock().toISOString();
      db.prepare(
        `INSERT INTO directives
          (id, project_id, parent_type, parent_id, kind, payload_json, next_fire_at, last_fired_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      ).run(
        id,
        project.id,
        input.parent_type,
        input.parent_id,
        input.kind,
        JSON.stringify(stored),
        nextFireAt,
        now,
      );
      appendAudit(db, {
        projectId: project.id,
        entityType: 'directive',
        entityId: id,
        actor: 'user',
        field: 'create',
        newValue: input.kind,
        triggerContext: {
          parent_type: input.parent_type,
          parent_id: input.parent_id,
          ...(nextFireAt !== null ? { next_fire_at: nextFireAt } : {}),
        },
      });
      return {
        id,
        project_id: project.id,
        parent_type: input.parent_type,
        parent_id: input.parent_id,
        kind: input.kind,
        payload: stored,
        next_fire_at: nextFireAt,
        last_fired_at: null,
        created_at: now,
      };
    },

    update(id, input) {
      const existing = getRow(id);
      if (!existing) throw new DirectiveNotFoundError(id);
      if (input.payload === undefined) {
        return rowToDirective(existing);
      }
      validatePayload(existing.kind, input.payload);
      const stored = normalisePayload(existing.kind, input.payload);
      const nextFireAt = computeNextFireAt(existing.kind, stored, clock());
      db.prepare(
        `UPDATE directives SET payload_json = ?, next_fire_at = ? WHERE id = ?`,
      ).run(JSON.stringify(stored), nextFireAt, id);
      appendAudit(db, {
        projectId: existing.project_id,
        entityType: 'directive',
        entityId: id,
        actor: 'user',
        field: 'payload',
        oldValue: existing.payload_json,
        newValue: JSON.stringify(stored),
        triggerContext: nextFireAt !== null ? { next_fire_at: nextFireAt } : {},
      });
      return {
        id,
        project_id: existing.project_id,
        parent_type: existing.parent_type,
        parent_id: existing.parent_id,
        kind: existing.kind,
        payload: stored,
        next_fire_at: nextFireAt,
        last_fired_at: existing.last_fired_at,
        created_at: existing.created_at,
      };
    },

    delete(id) {
      const existing = getRow(id);
      if (!existing) return;
      db.prepare('DELETE FROM directives WHERE id = ?').run(id);
      appendAudit(db, {
        projectId: existing.project_id,
        entityType: 'directive',
        entityId: id,
        actor: 'user',
        field: 'delete',
        oldValue: existing.kind,
        triggerContext: {
          parent_type: existing.parent_type,
          parent_id: existing.parent_id,
        },
      });
    },

    listDueReminders(now) {
      const cutoff = now.toISOString();
      const rows = db
        .prepare(
          `SELECT * FROM directives
            WHERE kind = 'reminder' AND next_fire_at IS NOT NULL AND next_fire_at <= ?
            ORDER BY next_fire_at ASC`,
        )
        .all(cutoff) as DirectiveRow[];
      return rows.map(rowToDirective);
    },

    markFired(id, now) {
      const existing = getRow(id);
      if (!existing) throw new DirectiveNotFoundError(id);
      if (existing.kind !== 'reminder') {
        throw new InvalidPayloadError(`markFired called on non-reminder directive (kind=${existing.kind})`);
      }
      const payload = JSON.parse(existing.payload_json) as ReminderPayload;
      const firedAt = now.toISOString();
      // Recurring: advance from the directive's previous next_fire_at if present (keeps
      // the cadence anchored to the original schedule even if the scheduler runs late);
      // fall back to `now` if next_fire_at was already null somehow.
      let nextFireAt: string | null = null;
      if (payload.recurrence) {
        const base = existing.next_fire_at ? new Date(existing.next_fire_at) : now;
        nextFireAt = advanceRecurrence(base, payload.recurrence).toISOString();
      }
      db.prepare(
        `UPDATE directives SET last_fired_at = ?, next_fire_at = ? WHERE id = ?`,
      ).run(firedAt, nextFireAt, id);
      appendAudit(db, {
        projectId: existing.project_id,
        entityType: 'directive',
        entityId: id,
        actor: 'system',
        field: 'fired',
        newValue: firedAt,
        triggerContext: nextFireAt !== null ? { next_fire_at: nextFireAt } : {},
      });
      return {
        id: existing.id,
        project_id: existing.project_id,
        parent_type: existing.parent_type,
        parent_id: existing.parent_id,
        kind: existing.kind,
        payload,
        next_fire_at: nextFireAt,
        last_fired_at: firedAt,
        created_at: existing.created_at,
      };
    },

    countByKind(projectId) {
      const rows = db
        .prepare(
          `SELECT kind, COUNT(*) AS n FROM directives WHERE project_id = ? GROUP BY kind`,
        )
        .all(projectId) as Array<{ kind: DirectiveKind; n: number }>;
      const out: Record<DirectiveKind, number> = { pin: 0, reminder: 0, include_prompt: 0 };
      for (const r of rows) out[r.kind] = r.n;
      return out;
    },
  };
}
