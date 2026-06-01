// Audit trigger-type classification (SPEC §7.22: the audit log is "searchable by
// time range, actor, or trigger type"). Trigger type is not a stored column — it is
// derived from the documented trigger-context discriminators: "PR number for GitHub
// triggers, model and prompt fingerprint for AI triggers, gate identifier for
// methodology triggers" (SPEC §7.22). A row that carries none of these is `manual`.
//
// The key map below is the single source of truth for BOTH the JS derivation (used in
// tests / any in-process consumer) and the SQL predicate the /api/audit filter builds,
// so the two can never drift.

export type AuditTriggerType = 'github' | 'ai' | 'methodology' | 'manual';

export const AUDIT_TRIGGER_TYPES: readonly AuditTriggerType[] = [
  'github',
  'ai',
  'methodology',
  'manual',
] as const;

// Discriminator keys per trigger type, in precedence order. A row is classified to the
// first type (github → ai → methodology) whose keys it carries; otherwise `manual`.
// Precedence makes the classification a partition (every row is exactly one type), so a
// filter by one type never double-counts a row that happens to carry overlapping keys.
const TRIGGER_KEYS: Record<Exclude<AuditTriggerType, 'manual'>, readonly string[]> = {
  github: ['pr_number', 'repo'],
  ai: ['model', 'prompt_fingerprint'],
  methodology: ['gate_id', 'moment', 'checklist_id'],
};

const ORDERED: readonly Exclude<AuditTriggerType, 'manual'>[] = ['github', 'ai', 'methodology'];

export function isAuditTriggerType(value: string): value is AuditTriggerType {
  return (AUDIT_TRIGGER_TYPES as readonly string[]).includes(value);
}

/** Derive a row's trigger type from its parsed trigger_context. Precedence-ordered. */
export function deriveTriggerType(ctx: Record<string, unknown>): AuditTriggerType {
  for (const type of ORDERED) {
    if (TRIGGER_KEYS[type].some((key) => ctx[key] !== undefined && ctx[key] !== null)) {
      return type;
    }
  }
  return 'manual';
}

// SQL fragment: `json_extract(trigger_context_json,'$.<key>') IS NOT NULL` OR-joined.
function hasAnyKeySql(column: string, keys: readonly string[]): string {
  return `(${keys.map((k) => `json_extract(${column}, '$.${k}') IS NOT NULL`).join(' OR ')})`;
}

/**
 * Build a WHERE-clause predicate selecting rows whose derived trigger type equals
 * `type`, matching `deriveTriggerType` precedence exactly. The key set is a fixed
 * server-side whitelist (no user input reaches the SQL string), so this is injection-safe.
 */
export function triggerTypeSqlPredicate(column: string, type: AuditTriggerType): string {
  const has = (t: Exclude<AuditTriggerType, 'manual'>) => hasAnyKeySql(column, TRIGGER_KEYS[t]);
  switch (type) {
    case 'github':
      return has('github');
    case 'ai':
      return `(NOT ${has('github')} AND ${has('ai')})`;
    case 'methodology':
      return `(NOT ${has('github')} AND NOT ${has('ai')} AND ${has('methodology')})`;
    case 'manual':
      return `(NOT ${has('github')} AND NOT ${has('ai')} AND NOT ${has('methodology')})`;
  }
}
