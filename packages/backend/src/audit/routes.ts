import type { FastifyInstance } from 'fastify';
import type { AuditEntry } from '@throughline/shared';
import type { DB } from '../db/index.js';
import { isAuditTriggerType, triggerTypeSqlPredicate } from './trigger-type.js';

// SPEC §7.22 actor vocabulary (mirrors the `AuditActor` union in @throughline/shared).
// Kept as a runtime whitelist so an unknown `actor` filter is a 400, not a silent empty.
const AUDIT_ACTORS = [
  'user',
  'ai',
  'ai_auto_apply',
  'inbox_worker',
  'methodology_runtime',
  'bundle_loader',
  'system',
] as const;

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
      // F7-04 / SPEC §7.22 — searchable by time range, actor, or trigger type.
      since?: string;
      until?: string;
      actor?: string;
      trigger_type?: string;
      limit?: string;
    };
  }>('/api/audit', async (req, reply) => {
    const { entity_type, entity_id, project_id, since, until, actor, trigger_type } = req.query;
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
    // Time range — half-open-inclusive on the ISO `timestamp` column (idx_audit_timestamp).
    if (since) {
      filters.push('timestamp >= ?');
      params.push(since);
    }
    if (until) {
      filters.push('timestamp <= ?');
      params.push(until);
    }
    // Actor — validated against the known vocabulary so a typo is a 400, not a silent empty.
    if (actor) {
      if (!(AUDIT_ACTORS as readonly string[]).includes(actor)) {
        return reply.code(400).send({ error: `unknown actor: ${actor}` });
      }
      filters.push('actor = ?');
      params.push(actor);
    }
    // Trigger type — derived from trigger-context discriminators (no stored column); the
    // predicate uses a fixed server-side key whitelist, so no user input reaches the SQL.
    if (trigger_type) {
      if (!isAuditTriggerType(trigger_type)) {
        return reply.code(400).send({ error: `unknown trigger_type: ${trigger_type}` });
      }
      filters.push(triggerTypeSqlPredicate('trigger_context_json', trigger_type));
    }
    const limitRaw = Number.parseInt(req.query.limit ?? '50', 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT) : 50;
    const where = filters.length > 0 ? ` WHERE ${filters.join(' AND ')}` : '';
    const sql = `SELECT * FROM audit_log${where} ORDER BY timestamp DESC LIMIT ${limit}`;
    const rows = db.prepare(sql).all(...params) as AuditRow[];
    return { entries: rows.map(rowToEntry) };
  });
}
