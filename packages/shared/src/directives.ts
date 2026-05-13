// Phase 6b — directives layer (SPEC §7.10; T-D12, T-D32, T-D36).
// Three directive types in v1 per T-D12: `pin`, `reminder`, `include_prompt`. Parent is
// either an item or a library entry. Reminders fire via the backend's OS notification
// capability layer (T-D32). The frontend modal and backend service share the payload
// shapes + relative-spec parser defined here so the two implementations cannot drift on
// which grammar counts as a valid reminder.

export const DIRECTIVE_KINDS = ['pin', 'reminder', 'include_prompt'] as const;
export type DirectiveKind = (typeof DIRECTIVE_KINDS)[number];

export function isDirectiveKind(value: unknown): value is DirectiveKind {
  return typeof value === 'string' && (DIRECTIVE_KINDS as readonly string[]).includes(value);
}

export const DIRECTIVE_PARENT_TYPES = ['item', 'library'] as const;
export type DirectiveParentType = (typeof DIRECTIVE_PARENT_TYPES)[number];

export function isDirectiveParentType(value: unknown): value is DirectiveParentType {
  return (
    typeof value === 'string' && (DIRECTIVE_PARENT_TYPES as readonly string[]).includes(value)
  );
}

// `pin` carries no scheduling state; its presence is the whole semantic.
export type PinPayload = Record<string, never>;

// `reminder` covers absolute timestamps and relative specs. `fire_at` is the resolved
// ISO timestamp that next_fire_at is derived from; `relative_spec` is retained so the UI
// can display the original phrasing. Recurrence is optional; recurring reminders re-arm
// after each fire (§13 adopted default — persist until directive removed).
export type ReminderUnit = 'minute' | 'hour' | 'day' | 'week';
export const REMINDER_UNITS: readonly ReminderUnit[] = ['minute', 'hour', 'day', 'week'];

export interface ReminderRecurrence {
  every: number;
  unit: ReminderUnit;
}

export interface ReminderPayload {
  mode: 'absolute' | 'relative';
  fire_at: string;
  relative_spec?: string;
  recurrence?: ReminderRecurrence;
  note?: string;
}

// `include_prompt` defers the actual body assembly to the parent (item title+body, or
// library entry body). The optional note is editorial guidance for Phase 13's session-
// start prompt assembly.
export interface IncludePromptPayload {
  note?: string;
}

export type DirectivePayload = PinPayload | ReminderPayload | IncludePromptPayload;

export interface Directive {
  id: string;
  project_id: string;
  parent_type: DirectiveParentType;
  parent_id: string;
  kind: DirectiveKind;
  payload: DirectivePayload;
  next_fire_at: string | null;
  last_fired_at: string | null;
  created_at: string;
}

export interface CreateDirectiveInput {
  project_id: string;
  parent_type: DirectiveParentType;
  parent_id: string;
  kind: DirectiveKind;
  payload?: DirectivePayload;
}

export interface UpdateDirectiveInput {
  payload?: DirectivePayload;
}

// Relative-spec grammar (Phase 6b v1):
//   `in <N> <unit>`     where unit ∈ {minute,hour,day,week} (singular or plural)
//   `tomorrow`          fires at 09:00 the next day
//   `tomorrow HH:MM`    fires at the given time the next day (24h)
// Unrecognised input returns null; the caller surfaces a form-level error rather than
// guessing. Future phases can extend this without churn because both backend and frontend
// share this helper.
const RELATIVE_IN_RE = /^\s*in\s+(\d+)\s+(minute|minutes|hour|hours|day|days|week|weeks)\s*$/i;
const TOMORROW_RE = /^\s*tomorrow(?:\s+(\d{1,2}):(\d{2}))?\s*$/i;

export function parseRelativeReminder(spec: string, now: Date): Date | null {
  const inMatch = RELATIVE_IN_RE.exec(spec);
  if (inMatch) {
    const n = Number(inMatch[1]);
    const unit = (inMatch[2] ?? '').toLowerCase();
    if (!Number.isFinite(n) || n <= 0) return null;
    const d = new Date(now.getTime());
    if (unit.startsWith('minute')) d.setMinutes(d.getMinutes() + n);
    else if (unit.startsWith('hour')) d.setHours(d.getHours() + n);
    else if (unit.startsWith('day')) d.setDate(d.getDate() + n);
    else if (unit.startsWith('week')) d.setDate(d.getDate() + n * 7);
    else return null;
    return d;
  }
  const tomorrowMatch = TOMORROW_RE.exec(spec);
  if (tomorrowMatch) {
    const hh = tomorrowMatch[1] !== undefined ? Number(tomorrowMatch[1]) : 9;
    const mm = tomorrowMatch[2] !== undefined ? Number(tomorrowMatch[2]) : 0;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    const d = new Date(now.getTime());
    d.setDate(d.getDate() + 1);
    d.setHours(hh, mm, 0, 0);
    return d;
  }
  return null;
}

// Adds the recurrence interval to the timestamp. Returns ISO string for direct write
// into directives.next_fire_at. Used by the scheduler after firing a recurring reminder.
export function advanceRecurrence(from: Date, recurrence: ReminderRecurrence): Date {
  const d = new Date(from.getTime());
  const n = Math.max(1, Math.floor(recurrence.every));
  switch (recurrence.unit) {
    case 'minute':
      d.setMinutes(d.getMinutes() + n);
      break;
    case 'hour':
      d.setHours(d.getHours() + n);
      break;
    case 'day':
      d.setDate(d.getDate() + n);
      break;
    case 'week':
      d.setDate(d.getDate() + n * 7);
      break;
  }
  return d;
}

// Centralised `next_fire_at` computation. Pin and include_prompt have no firing semantics
// — they return null. Reminders resolve absolute or relative to a concrete fire_at and
// return that. The caller passes `now` so this is deterministic in tests.
export function computeNextFireAt(
  kind: DirectiveKind,
  payload: DirectivePayload,
  now: Date,
): string | null {
  if (kind !== 'reminder') return null;
  const r = payload as ReminderPayload;
  if (r.mode === 'absolute') {
    if (typeof r.fire_at !== 'string' || r.fire_at.length === 0) return null;
    const d = new Date(r.fire_at);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }
  if (r.mode === 'relative') {
    const spec = r.relative_spec;
    if (typeof spec !== 'string' || spec.length === 0) return null;
    const resolved = parseRelativeReminder(spec, now);
    return resolved ? resolved.toISOString() : null;
  }
  return null;
}

// Convenience: which directives surface as "active" in the badge / header count.
// One-shot reminders that have already fired (next_fire_at=NULL, kind=reminder) are
// still active from the user's perspective — the directive row persists — but they no
// longer have a future firing.
export function isReminderArmed(d: Directive): boolean {
  return d.kind === 'reminder' && d.next_fire_at !== null;
}
