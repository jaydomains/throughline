import { nanoid } from 'nanoid';
import type { CreateScratchpadJotInput, ScratchpadJot } from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';

// T-D20 — scratchpad is friction-free: no AI, no review modal, no routing. Append-only
// per the spec: jots accumulate, the UI shows recent ones, and the user can promote a jot
// to a real item via dump-zone (manual copy in v1). Project-scoped (nullable: jots can
// exist without an active project for cross-project capture).

interface JotRow {
  id: string;
  project_id: string | null;
  body: string;
  created_at: string;
}

function rowToJot(row: JotRow): ScratchpadJot {
  return {
    id: row.id,
    project_id: row.project_id,
    body: row.body,
    created_at: row.created_at,
  };
}

export interface ScratchpadService {
  list(projectId: string | null, limit?: number): ScratchpadJot[];
  create(input: CreateScratchpadJotInput): ScratchpadJot;
  delete(id: string): void;
}

export function createScratchpadService(db: DB): ScratchpadService {
  return {
    list(projectId, limit = 50) {
      const rows =
        projectId === null
          ? (db
              .prepare('SELECT * FROM scratchpad_jots ORDER BY created_at DESC LIMIT ?')
              .all(limit) as JotRow[])
          : (db
              .prepare(
                'SELECT * FROM scratchpad_jots WHERE project_id = ? OR project_id IS NULL ORDER BY created_at DESC LIMIT ?',
              )
              .all(projectId, limit) as JotRow[]);
      return rows.map(rowToJot);
    },
    create(input) {
      const id = nanoid();
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO scratchpad_jots (id, project_id, body, created_at) VALUES (?, ?, ?, ?)',
      ).run(id, input.project_id, input.body, now);
      // Scratchpad jots aren't full entities; they audit-log at create only so the user's
      // "what did I capture lately" surface in Phase 14 (periodic review) can see them.
      appendAudit(db, {
        projectId: input.project_id,
        entityType: 'project',
        entityId: input.project_id ?? 'global',
        actor: 'user',
        field: 'scratchpad_jot',
        newValue: input.body.slice(0, 80),
      });
      return {
        id,
        project_id: input.project_id,
        body: input.body,
        created_at: now,
      };
    },
    delete(id) {
      const row = db
        .prepare('SELECT * FROM scratchpad_jots WHERE id = ?')
        .get(id) as JotRow | undefined;
      if (!row) return;
      db.prepare('DELETE FROM scratchpad_jots WHERE id = ?').run(id);
      appendAudit(db, {
        projectId: row.project_id,
        entityType: 'project',
        entityId: row.project_id ?? 'global',
        actor: 'user',
        field: 'scratchpad_jot_delete',
        oldValue: row.body.slice(0, 80),
      });
    },
  };
}
