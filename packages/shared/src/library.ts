// Phase 6a — library content surface (SPEC §7.8; T-D9, T-D10, T-D36).
// Four content types are first-class (T-D10): note, prompt, snippet, imported_doc.
// Notes attach to items many-to-many (T-D9); prompts use `{{var_name}}` placeholders
// (§13 adopted default). Whiteboards remain deferred to v1.1.

export const LIBRARY_ENTRY_TYPES = ['note', 'prompt', 'snippet', 'imported_doc'] as const;
export type LibraryEntryType = (typeof LIBRARY_ENTRY_TYPES)[number];

export function isLibraryEntryType(value: unknown): value is LibraryEntryType {
  return typeof value === 'string' && (LIBRARY_ENTRY_TYPES as readonly string[]).includes(value);
}

export interface LibraryEntry {
  id: string;
  project_id: string;
  type: LibraryEntryType;
  title: string;
  body: string;
  tags: string[];
  // Phase 6c populates this for imported docs; Phase 6a renders it read-only when set.
  summary: string | null;
  // Phase 6c — imported-doc source tracking (T-D11, §7.9). Populated only for
  // `imported_doc` entries that came from repo `.md` ingestion; NULL/false otherwise.
  source_path: string | null; // rel_path under the project's repo_path
  source_tracked: boolean; // snapshot (false) by default; true = mirror file on change
  source_hash: string | null; // sha256 of file content at last ingest
  ingested_at: string | null; // last ingest timestamp (initial import or re-ingest)
  created_at: string;
  updated_at: string;
}

export interface CreateLibraryEntryInput {
  project_id: string;
  type: LibraryEntryType;
  title: string;
  body?: string;
  tags?: string[];
  summary?: string | null;
  // Phase 6c — set by the md-ingest service when creating imported-doc entries.
  source_path?: string | null;
  source_tracked?: boolean;
  source_hash?: string | null;
  ingested_at?: string | null;
}

// PATCH for partial updates with optional fields in the body — Throughline REST convention.
// Phase 6a is the first consumer; future phases follow the pattern.
export interface UpdateLibraryEntryInput {
  title?: string;
  body?: string;
  tags?: string[];
  summary?: string | null;
  // Phase 6c — track-source toggle + re-ingest writes these on imported docs.
  source_tracked?: boolean;
  source_hash?: string | null;
  ingested_at?: string | null;
}

// Light shape for the attach modal + reverse lookup ("which items does this note attach to?").
export interface AttachedItemSummary {
  id: string;
  title: string;
  type: string;
  status: string;
}

export type LibrarySearchScope = 'project' | 'global';
export type LibrarySearchVia = 'fts' | 'semantic-stub';

export interface LibrarySearchRequest {
  query: string;
  type?: LibraryEntryType;
  scope: LibrarySearchScope;
  limit?: number;
}

export interface LibrarySearchResult {
  entries: LibraryEntry[];
  via: LibrarySearchVia;
  truncated: boolean;
}

export interface PromptFillRequest {
  values: Record<string, string>;
}

export interface PromptFillResult {
  rendered: string;
  missing_vars: string[];
}

// Extracts the unique `{{var_name}}` tokens from a prompt body. Used by both the backend
// service (validation, rendering) and the frontend (modal field generation) so the two
// implementations cannot drift on which token shape counts as a variable.
const PROMPT_VAR_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export function extractPromptVariables(body: string): string[] {
  const seen = new Set<string>();
  for (const match of body.matchAll(PROMPT_VAR_RE)) {
    const name = match[1];
    if (name) seen.add(name);
  }
  return Array.from(seen);
}

export function renderPromptBody(
  body: string,
  values: Record<string, string>,
): PromptFillResult {
  const missing = new Set<string>();
  const rendered = body.replace(PROMPT_VAR_RE, (_match, name: string) => {
    const value = values[name];
    if (typeof value !== 'string') {
      missing.add(name);
      return '';
    }
    return value;
  });
  return { rendered, missing_vars: Array.from(missing) };
}
