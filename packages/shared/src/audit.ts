export type AuditEntityType =
  | 'item'
  | 'session'
  | 'library'
  | 'project'
  | 'bundle_binding'
  | 'gate_firing'
  | 'checklist_step'
  | 'settings';

export type AuditActor =
  | 'user'
  | 'ai'
  | 'ai_auto_apply'
  | 'inbox_worker'
  | 'methodology_runtime'
  | 'bundle_loader'
  | 'system';

export interface AuditEntry {
  id: string;
  timestamp: string;
  project_id: string | null;
  entity_type: AuditEntityType;
  entity_id: string;
  actor: AuditActor;
  field: string;
  old_value: string | null;
  new_value: string | null;
  trigger_context: Record<string, unknown>;
}
