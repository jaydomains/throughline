import { nanoid } from 'nanoid';
import type {
  CreateLibraryEntryInput,
  LibraryEntry,
  LibraryEntryType,
} from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';
import type { ProjectsService } from '../projects/service.js';

// Phase 4 — minimal library surface so the library dump zone has somewhere to write. Phase 6
// expands this with attach-to-item (T-D9), four content types fully exercised (T-D10),
// directives, semantic + full-text search, repo .md ingestion. Keeping the v4 surface to
// create + list + get matches the convention from Phase 3 where item primitives landed
// before the full panel UI.

const ALLOWED_TYPES: readonly LibraryEntryType[] = ['note', 'prompt', 'snippet', 'imported_doc'] as const;

interface LibraryRow {
  id: string;
  project_id: string;
  type: LibraryEntryType;
  title: string;
  body: string;
  tags_json: string;
  created_at: string;
  updated_at: string;
}

function rowToEntry(row: LibraryRow): LibraryEntry {
  return {
    id: row.id,
    project_id: row.project_id,
    type: row.type,
    title: row.title,
    body: row.body,
    tags: (JSON.parse(row.tags_json) as string[]) ?? [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`project ${id} not found`);
  }
}

export class LibraryEntryTypeError extends Error {
  constructor(type: string) {
    super(`library entry type "${type}" not allowed`);
  }
}

export interface LibraryService {
  list(projectId: string): LibraryEntry[];
  get(id: string): LibraryEntry | null;
  create(input: CreateLibraryEntryInput): LibraryEntry;
}

export function createLibraryService(db: DB, projects: ProjectsService): LibraryService {
  function getRow(id: string): LibraryRow | null {
    const row = db.prepare('SELECT * FROM library_entries WHERE id = ?').get(id) as
      | LibraryRow
      | undefined;
    return row ?? null;
  }
  return {
    list(projectId) {
      const rows = db
        .prepare('SELECT * FROM library_entries WHERE project_id = ? ORDER BY created_at DESC')
        .all(projectId) as LibraryRow[];
      return rows.map(rowToEntry);
    },
    get(id) {
      const row = getRow(id);
      return row ? rowToEntry(row) : null;
    },
    create(input) {
      const project = projects.get(input.project_id);
      if (!project) throw new ProjectNotFoundError(input.project_id);
      if (!ALLOWED_TYPES.includes(input.type)) throw new LibraryEntryTypeError(input.type);
      const id = nanoid();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO library_entries (id, project_id, type, title, body, tags_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        project.id,
        input.type,
        input.title,
        input.body ?? '',
        JSON.stringify(input.tags ?? []),
        now,
        now,
      );
      appendAudit(db, {
        projectId: project.id,
        entityType: 'library',
        entityId: id,
        actor: 'user',
        field: 'create',
        newValue: input.title,
        triggerContext: { type: input.type },
      });
      return rowToEntry(getRow(id)!);
    },
  };
}
