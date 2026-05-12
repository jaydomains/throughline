import { nanoid } from 'nanoid';
import type { AuditActor, AuditEntityType } from '@throughline/shared';
import type { DB } from '../db/index.js';

export interface AppendAuditInput {
  projectId: string | null;
  entityType: AuditEntityType;
  entityId: string;
  actor: AuditActor;
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
  triggerContext?: Record<string, unknown>;
}

// T-D24: never write API keys or full prompt content. Callers pass already-redacted context.
export function appendAudit(db: DB, input: AppendAuditInput): string {
  const id = nanoid();
  db.prepare(
    `INSERT INTO audit_log
      (id, timestamp, project_id, entity_type, entity_id, actor, field, old_value, new_value, trigger_context_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    new Date().toISOString(),
    input.projectId,
    input.entityType,
    input.entityId,
    input.actor,
    input.field,
    input.oldValue ?? null,
    input.newValue ?? null,
    JSON.stringify(input.triggerContext ?? {}),
  );
  return id;
}
