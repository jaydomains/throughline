import type { ItemPolicy } from '@throughline/shared';
import { SOURCE_TYPES, type SourceType } from './derive-id.js';

// T-D53 — bootstrap import file shape + bundle-aware validation. The
// validator is stateless: it takes a JSON value (already parsed from the
// request body) plus the project's bound `ItemPolicy` and returns either a
// well-typed parsed result or a structured error list. The upsert layer
// (this slice's `service.ts`) operates against the parsed result.
//
// The file format groups rows by entity type so the producer (Phase 21) and
// the consumer (this phase) align on a shape that maps 1:1 to the three
// affected tables. Per-row fields are validated against existing entity
// schemas; bundle-aware validation applies only to items (type + status,
// per `ItemPolicy`).
//
// Errors carry a `path` (dotted location into the file structure) and a
// `message` (one line, human-readable). A single file with N errors yields
// N entries — the upsert is never invoked on a partial/failed parse.

export interface ItemRowInput {
  bootstrap_id: string;
  source_type: SourceType;
  title: string;
  type: string;
  status: string;
  description?: string;
  blocker_text?: string | null;
  branch_ref?: string | null;
  tags?: string[];
}

export interface SessionRowInput {
  bootstrap_id: string;
  source_type: SourceType;
  name: string;
  branch_ref?: string | null;
  context?: string | null;
}

export type LibraryEntryType = 'note' | 'prompt' | 'snippet' | 'imported_doc';
const LIBRARY_TYPES: readonly LibraryEntryType[] = ['note', 'prompt', 'snippet', 'imported_doc'];

export interface LibraryRowInput {
  bootstrap_id: string;
  source_type: SourceType;
  type: LibraryEntryType;
  title: string;
  body: string;
  tags: string[];
  summary?: string | null;
}

export interface ParsedBootstrapFile {
  version: 1;
  items: ItemRowInput[];
  sessions: SessionRowInput[];
  library_entries: LibraryRowInput[];
}

export interface BootstrapValidationError {
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; parsed: ParsedBootstrapFile }
  | { ok: false; errors: BootstrapValidationError[] };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === 'string');
}

function isSourceType(v: unknown): v is SourceType {
  return typeof v === 'string' && (SOURCE_TYPES as readonly string[]).includes(v);
}

function isLibraryType(v: unknown): v is LibraryEntryType {
  return typeof v === 'string' && (LIBRARY_TYPES as readonly string[]).includes(v);
}

function validateBootstrapIdPrefix(
  errors: BootstrapValidationError[],
  path: string,
  bootstrapId: string,
  sourceType: SourceType,
): void {
  // `bootstrap_id` carries `<source-type>:<stable-key>` for derived types and
  // `override:<slug>` when the source row carried an `@bootstrap-id:`
  // override. The override case decouples `source_type` from the prefix —
  // a row whose natural source is `decision` may still carry an override
  // with `bootstrap_id` starting `override:`. Accept either pattern.
  if (bootstrapId.startsWith('override:')) return;
  if (!bootstrapId.startsWith(`${sourceType}:`)) {
    errors.push({
      path,
      message: `bootstrap_id "${bootstrapId}" does not match source_type "${sourceType}" (expected "${sourceType}:..." or "override:...")`,
    });
  }
}

function validateItemRow(
  errors: BootstrapValidationError[],
  pathBase: string,
  row: unknown,
  policy: ItemPolicy,
): ItemRowInput | null {
  if (!isRecord(row)) {
    errors.push({ path: pathBase, message: 'expected an object' });
    return null;
  }
  const { bootstrap_id, source_type, title, type, status } = row;
  let valid = true;
  if (typeof bootstrap_id !== 'string' || bootstrap_id.length === 0) {
    errors.push({ path: `${pathBase}.bootstrap_id`, message: 'required, non-empty string' });
    valid = false;
  }
  if (!isSourceType(source_type)) {
    errors.push({
      path: `${pathBase}.source_type`,
      message: `must be one of: ${SOURCE_TYPES.join(', ')}`,
    });
    valid = false;
  }
  if (typeof title !== 'string' || title.length === 0) {
    errors.push({ path: `${pathBase}.title`, message: 'required, non-empty string' });
    valid = false;
  }
  if (typeof type !== 'string' || type.length === 0) {
    errors.push({ path: `${pathBase}.type`, message: 'required, non-empty string' });
    valid = false;
  }
  if (typeof status !== 'string' || status.length === 0) {
    errors.push({ path: `${pathBase}.status`, message: 'required, non-empty string' });
    valid = false;
  }
  if (!valid) return null;

  // Bundle-aware validation: item type must be declared by the bound bundle;
  // status must be in the per-type lifecycle.
  if (!policy.types.includes(type as string)) {
    errors.push({
      path: `${pathBase}.type`,
      message: `type "${type as string}" not declared by bundle ${policy.bundle_id} (allowed: ${policy.types.join(', ')})`,
    });
    return null;
  }
  const lifecycle = policy.statuses_by_type[type as string] ?? policy.statuses;
  if (!lifecycle.includes(status as string)) {
    errors.push({
      path: `${pathBase}.status`,
      message: `status "${status as string}" not allowed for type "${type as string}" by bundle ${policy.bundle_id} (allowed: ${lifecycle.join(', ')})`,
    });
    return null;
  }

  validateBootstrapIdPrefix(errors, `${pathBase}.bootstrap_id`, bootstrap_id as string, source_type as SourceType);

  // Optional fields — validated against entity-schema shapes.
  const description = 'description' in row ? row.description : undefined;
  if (description !== undefined && typeof description !== 'string') {
    errors.push({ path: `${pathBase}.description`, message: 'when present, must be a string' });
    return null;
  }
  const blocker_text = 'blocker_text' in row ? row.blocker_text : undefined;
  if (blocker_text !== undefined && blocker_text !== null && typeof blocker_text !== 'string') {
    errors.push({ path: `${pathBase}.blocker_text`, message: 'when present, must be a string or null' });
    return null;
  }
  const branch_ref = 'branch_ref' in row ? row.branch_ref : undefined;
  if (branch_ref !== undefined && branch_ref !== null && typeof branch_ref !== 'string') {
    errors.push({ path: `${pathBase}.branch_ref`, message: 'when present, must be a string or null' });
    return null;
  }
  const tags = 'tags' in row ? row.tags : undefined;
  if (tags !== undefined && !isStringArray(tags)) {
    errors.push({ path: `${pathBase}.tags`, message: 'when present, must be an array of strings' });
    return null;
  }

  return {
    bootstrap_id: bootstrap_id as string,
    source_type: source_type as SourceType,
    title: title as string,
    type: type as string,
    status: status as string,
    ...(description !== undefined ? { description: description as string } : {}),
    ...(blocker_text !== undefined ? { blocker_text: blocker_text as string | null } : {}),
    ...(branch_ref !== undefined ? { branch_ref: branch_ref as string | null } : {}),
    ...(tags !== undefined ? { tags: tags as string[] } : {}),
  };
}

function validateSessionRow(
  errors: BootstrapValidationError[],
  pathBase: string,
  row: unknown,
): SessionRowInput | null {
  if (!isRecord(row)) {
    errors.push({ path: pathBase, message: 'expected an object' });
    return null;
  }
  const { bootstrap_id, source_type, name } = row;
  let valid = true;
  if (typeof bootstrap_id !== 'string' || bootstrap_id.length === 0) {
    errors.push({ path: `${pathBase}.bootstrap_id`, message: 'required, non-empty string' });
    valid = false;
  }
  if (!isSourceType(source_type)) {
    errors.push({
      path: `${pathBase}.source_type`,
      message: `must be one of: ${SOURCE_TYPES.join(', ')}`,
    });
    valid = false;
  }
  if (typeof name !== 'string' || name.length === 0) {
    errors.push({ path: `${pathBase}.name`, message: 'required, non-empty string' });
    valid = false;
  }
  if (!valid) return null;

  validateBootstrapIdPrefix(errors, `${pathBase}.bootstrap_id`, bootstrap_id as string, source_type as SourceType);

  const branch_ref = 'branch_ref' in row ? row.branch_ref : undefined;
  if (branch_ref !== undefined && branch_ref !== null && typeof branch_ref !== 'string') {
    errors.push({ path: `${pathBase}.branch_ref`, message: 'when present, must be a string or null' });
    return null;
  }
  const context = 'context' in row ? row.context : undefined;
  if (context !== undefined && context !== null && typeof context !== 'string') {
    errors.push({ path: `${pathBase}.context`, message: 'when present, must be a string or null' });
    return null;
  }

  return {
    bootstrap_id: bootstrap_id as string,
    source_type: source_type as SourceType,
    name: name as string,
    ...(branch_ref !== undefined ? { branch_ref: branch_ref as string | null } : {}),
    ...(context !== undefined ? { context: context as string | null } : {}),
  };
}

function validateLibraryRow(
  errors: BootstrapValidationError[],
  pathBase: string,
  row: unknown,
): LibraryRowInput | null {
  if (!isRecord(row)) {
    errors.push({ path: pathBase, message: 'expected an object' });
    return null;
  }
  const { bootstrap_id, source_type, type, title, body, tags } = row;
  let valid = true;
  if (typeof bootstrap_id !== 'string' || bootstrap_id.length === 0) {
    errors.push({ path: `${pathBase}.bootstrap_id`, message: 'required, non-empty string' });
    valid = false;
  }
  if (!isSourceType(source_type)) {
    errors.push({
      path: `${pathBase}.source_type`,
      message: `must be one of: ${SOURCE_TYPES.join(', ')}`,
    });
    valid = false;
  }
  if (!isLibraryType(type)) {
    errors.push({
      path: `${pathBase}.type`,
      message: `must be one of: ${LIBRARY_TYPES.join(', ')}`,
    });
    valid = false;
  }
  if (typeof title !== 'string' || title.length === 0) {
    errors.push({ path: `${pathBase}.title`, message: 'required, non-empty string' });
    valid = false;
  }
  if (typeof body !== 'string') {
    errors.push({ path: `${pathBase}.body`, message: 'required, string (empty allowed)' });
    valid = false;
  }
  if (!isStringArray(tags)) {
    errors.push({ path: `${pathBase}.tags`, message: 'required, array of strings' });
    valid = false;
  }
  if (!valid) return null;

  validateBootstrapIdPrefix(errors, `${pathBase}.bootstrap_id`, bootstrap_id as string, source_type as SourceType);

  const summary = 'summary' in row ? row.summary : undefined;
  if (summary !== undefined && summary !== null && typeof summary !== 'string') {
    errors.push({ path: `${pathBase}.summary`, message: 'when present, must be a string or null' });
    return null;
  }

  return {
    bootstrap_id: bootstrap_id as string,
    source_type: source_type as SourceType,
    type: type as LibraryEntryType,
    title: title as string,
    body: body as string,
    tags: tags as string[],
    ...(summary !== undefined ? { summary: summary as string | null } : {}),
  };
}

interface SeenEntry {
  entityType: 'item' | 'session' | 'library';
  index: number;
}

function detectDuplicates(
  errors: BootstrapValidationError[],
  items: ItemRowInput[],
  sessions: SessionRowInput[],
  library: LibraryRowInput[],
): void {
  // T-D54: "Two rows resolving to the same `bootstrap_id` in a single import
  // file are rejected up-front with an error citing both source rows — the
  // parser never silently collapses duplicates." The check spans all three
  // sections because cross-entity collision is just as wrong as same-entity
  // collision (the underlying ID is global per project).
  const seen = new Map<string, SeenEntry>();
  function check(entityType: SeenEntry['entityType'], rows: { bootstrap_id: string }[], pathPrefix: string): void {
    rows.forEach((row, idx) => {
      const prior = seen.get(row.bootstrap_id);
      if (prior) {
        errors.push({
          path: `${pathPrefix}[${idx}].bootstrap_id`,
          message: `duplicate bootstrap_id "${row.bootstrap_id}" — also appears at ${prior.entityType} index ${prior.index}`,
        });
      } else {
        seen.set(row.bootstrap_id, { entityType, index: idx });
      }
    });
  }
  check('item', items, 'items');
  check('session', sessions, 'sessions');
  check('library', library, 'library_entries');
}

export function validateBootstrapFile(input: unknown, policy: ItemPolicy): ValidationResult {
  const errors: BootstrapValidationError[] = [];
  if (!isRecord(input)) {
    return { ok: false, errors: [{ path: '', message: 'top-level value must be an object' }] };
  }
  if (input.version !== 1) {
    return { ok: false, errors: [{ path: 'version', message: 'must be 1 (only the v1 shape is supported)' }] };
  }

  const itemsRaw = input.items ?? [];
  const sessionsRaw = input.sessions ?? [];
  const libraryRaw = input.library_entries ?? [];
  if (!Array.isArray(itemsRaw)) {
    return { ok: false, errors: [{ path: 'items', message: 'when present, must be an array' }] };
  }
  if (!Array.isArray(sessionsRaw)) {
    return { ok: false, errors: [{ path: 'sessions', message: 'when present, must be an array' }] };
  }
  if (!Array.isArray(libraryRaw)) {
    return {
      ok: false,
      errors: [{ path: 'library_entries', message: 'when present, must be an array' }],
    };
  }

  const items: ItemRowInput[] = [];
  itemsRaw.forEach((row, idx) => {
    const parsed = validateItemRow(errors, `items[${idx}]`, row, policy);
    if (parsed) items.push(parsed);
  });
  const sessions: SessionRowInput[] = [];
  sessionsRaw.forEach((row, idx) => {
    const parsed = validateSessionRow(errors, `sessions[${idx}]`, row);
    if (parsed) sessions.push(parsed);
  });
  const libraryEntries: LibraryRowInput[] = [];
  libraryRaw.forEach((row, idx) => {
    const parsed = validateLibraryRow(errors, `library_entries[${idx}]`, row);
    if (parsed) libraryEntries.push(parsed);
  });

  if (errors.length === 0) {
    detectDuplicates(errors, items, sessions, libraryEntries);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    parsed: { version: 1, items, sessions, library_entries: libraryEntries },
  };
}
