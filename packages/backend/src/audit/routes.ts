import type { FastifyInstance } from 'fastify';
import type { AuditEntry } from '@throughline/shared';
import type { DB } from '../db/index.js';

interface AuditRow {
  id: string;
  timestamp: string;
  project_id: string | null;
  entity_type: string;
  entity_id: string;
  actor: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  trigger_context_json: string;
}

function rowToEntry(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    project_id: row.project_id,
    entity_type: row.entity_type as AuditEntry['entity_type'],
    entity_id: row.entity_id,
    actor: row.actor as AuditEntry['actor'],
    field: row.field,
    old_value: row.old_value,
    new_value: row.new_value,
    trigger_context: JSON.parse(row.trigger_context_json) as Record<string, unknown>,
  };
}

const MAX_LIMIT = 200;

export function registerAuditRoutes(app: FastifyInstance, db: DB): void {
  app.get<{
    Querystring: {
      entity_type?: string;
      entity_id?: string;
      project_id?: string;
      limit?: string;
    };
  }>('/api/audit', async (req) => {
    const { entity_type, entity_id, project_id } = req.query;
    const filters: string[] = [];
    const params: unknown[] = [];
    if (entity_type) {
      filters.push('entity_type = ?');
      params.push(entity_type);
    }
    if (entity_id) {
      filters.push('entity_id = ?');
      params.push(entity_id);
    }
    if (project_id) {
      filters.push('project_id = ?');
      params.push(project_id);
    }
    const limitRaw = Number.parseInt(req.query.limit ?? '50', 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT) : 50;
    const where = filters.length > 0 ? ` WHERE ${filters.join(' AND ')}` : '';
    const sql = `SELECT * FROM audit_log${where} ORDER BY timestamp DESC LIMIT ${limit}`;
    const rows = db.prepare(sql).all(...params) as AuditRow[];
    return { entries: rows.map(rowToEntry) };
  });
}
