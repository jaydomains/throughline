import { nanoid } from 'nanoid';
import type { CreateSessionInput, Session, UpdateSessionInput } from '@throughline/shared';
import { SessionNotFoundError, ProjectNotFoundError } from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';
import type { ProjectsService } from '../projects/service.js';

interface SessionRow {
  id: string;
  project_id: string;
  name: string;
  branch_ref: string | null;
  context: string | null;
  settings_json: string;
  created_at: string;
  updated_at: string;
}

export interface SessionsService {
  list(projectId: string): Session[];
  get(id: string): Session | null;
  create(input: CreateSessionInput): Session;
  update(id: string, input: UpdateSessionInput): Session;
  delete(id: string): void;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    branch_ref: row.branch_ref,
    context: row.context,
    settings_json: JSON.parse(row.settings_json) as Record<string, unknown>,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createSessionsService(db: DB, projects: ProjectsService): SessionsService {
  function getRow(id: string): SessionRow | null {
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
    return row ?? null;
  }
  return {
    list(projectId) {
      const rows = db
        .prepare('SELECT * FROM sessions WHERE project_id = ? ORDER BY created_at ASC')
        .all(projectId) as SessionRow[];
      return rows.map(rowToSession);
    },

    get(id) {
      const row = getRow(id);
      return row ? rowToSession(row) : null;
    },

    create(input) {
      const project = projects.get(input.project_id);
      if (!project) throw new ProjectNotFoundError(input.project_id);
      const id = nanoid();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO sessions (id, project_id, name, branch_ref, context, settings_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        project.id,
        input.name,
        input.branch_ref ?? null,
        input.context ?? null,
        JSON.stringify(input.settings ?? {}),
        now,
        now,
      );
      appendAudit(db, {
        projectId: project.id,
        entityType: 'session',
        entityId: id,
        actor: 'user',
        field: 'create',
        newValue: input.name,
      });
      return this.get(id)!;
    },

    update(id, input) {
      const before = getRow(id);
      if (!before) throw new SessionNotFoundError(id);

      const next: SessionRow = {
        ...before,
        name: input.name ?? before.name,
        branch_ref: input.branch_ref === undefined ? before.branch_ref : input.branch_ref,
        context: input.context === undefined ? before.context : input.context,
        settings_json: input.settings === undefined ? before.settings_json : JSON.stringify(input.settings),
        updated_at: new Date().toISOString(),
      };

      db.prepare(
        `UPDATE sessions SET name = ?, branch_ref = ?, context = ?, settings_json = ?, updated_at = ? WHERE id = ?`,
      ).run(next.name, next.branch_ref, next.context, next.settings_json, next.updated_at, id);

      for (const [field, oldV, newV] of [
        ['name', before.name, next.name],
        ['branch_ref', before.branch_ref ?? '', next.branch_ref ?? ''],
        ['context', before.context ?? '', next.context ?? ''],
      ] as const) {
        if (oldV !== newV) {
          appendAudit(db, {
            projectId: before.project_id,
            entityType: 'session',
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
      db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
      appendAudit(db, {
        projectId: before.project_id,
        entityType: 'session',
        entityId: id,
        actor: 'user',
        field: 'delete',
        oldValue: before.name,
      });
    },
  };
}
