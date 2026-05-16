import { nanoid } from 'nanoid';
import type {
  AttachedItemSummary,
  CreateLibraryEntryInput,
  LibraryEntry,
  LibraryEntryType,
  LibrarySearchRequest,
  LibrarySearchResult,
  PromptFillRequest,
  PromptFillResult,
  UpdateLibraryEntryInput,
} from '@throughline/shared';
import { LIBRARY_ENTRY_TYPES, isLibraryEntryType, renderPromptBody } from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';
import type { ProjectsService } from '../projects/service.js';

// Phase 6a — full library content surface (T-D9, T-D10, T-D36).
// Four content types are first-class. Notes attach to items many-to-many; the attach
// check enforces both same-project and type='note' per T-D9. Prompts render `{{var_name}}`
// placeholders via the shared helper. FTS5 backs full-text search; semantic search is
// stubbed here so the route exists today and Phase 11 (Semble for code-related queries) /
// Phase 14 (local embeddings for text queries) can fill it without route churn.

interface LibraryRow {
  id: string;
  project_id: string;
  type: LibraryEntryType;
  title: string;
  body: string;
  tags_json: string;
  summary: string | null;
  source_path: string | null;
  source_tracked: number;
  source_hash: string | null;
  ingested_at: string | null;
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
    summary: row.summary,
    source_path: row.source_path,
    source_tracked: row.source_tracked === 1,
    source_hash: row.source_hash,
    ingested_at: row.ingested_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`project ${id} not found`);
  }
}

export class LibraryEntryNotFoundError extends Error {
  constructor(id: string) {
    super(`library entry ${id} not found`);
  }
}

export class LibraryEntryTypeError extends Error {
  constructor(type: string) {
    super(`library entry type "${type}" not allowed`);
  }
}

export class AttachNotANoteError extends Error {
  constructor(entryId: string, type: string) {
    super(`library entry ${entryId} is type "${type}", only notes (T-D9) can attach to items`);
  }
}

export class CrossProjectAttachError extends Error {
  constructor(entryProjectId: string, itemProjectId: string) {
    super(`cross-project attach refused: entry project ${entryProjectId} ≠ item project ${itemProjectId}`);
  }
}

export class NotAPromptError extends Error {
  constructor(entryId: string, type: string) {
    super(`prompt-fill called on library entry ${entryId} of type "${type}"`);
  }
}

export class ItemNotFoundError extends Error {
  constructor(id: string) {
    super(`item ${id} not found`);
  }
}

export interface ListLibraryFilter {
  projectId: string | null; // null → global (cross-project)
  type?: LibraryEntryType;
}

export interface LibraryService {
  list(filter: ListLibraryFilter): LibraryEntry[];
  get(id: string): LibraryEntry | null;
  create(input: CreateLibraryEntryInput): LibraryEntry;
  update(id: string, input: UpdateLibraryEntryInput): LibraryEntry;
  delete(id: string): void;
  attach(entryId: string, itemId: string): void;
  detach(entryId: string, itemId: string): void;
  listAttachedItems(entryId: string): AttachedItemSummary[];
  listAttachedNotes(itemId: string): LibraryEntry[];
  search(request: LibrarySearchRequest, projectScope: string): LibrarySearchResult;
  semanticSearch(request: LibrarySearchRequest, projectScope: string): LibrarySearchResult;
  fillPrompt(entryId: string, request: PromptFillRequest): PromptFillResult;
}

export function createLibraryService(db: DB, projects: ProjectsService): LibraryService {
  function getRow(id: string): LibraryRow | null {
    const row = db.prepare('SELECT * FROM library_entries WHERE id = ?').get(id) as
      | LibraryRow
      | undefined;
    return row ?? null;
  }
  return {
    list({ projectId, type }) {
      const params: string[] = [];
      const where: string[] = [];
      if (projectId !== null) {
        where.push('project_id = ?');
        params.push(projectId);
      }
      if (type) {
        where.push('type = ?');
        params.push(type);
      }
      const sql =
        'SELECT * FROM library_entries' +
        (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
        ' ORDER BY updated_at DESC';
      const rows = db.prepare(sql).all(...params) as LibraryRow[];
      return rows.map(rowToEntry);
    },

    get(id) {
      const row = getRow(id);
      return row ? rowToEntry(row) : null;
    },

    create(input) {
      const project = projects.get(input.project_id);
      if (!project) throw new ProjectNotFoundError(input.project_id);
      if (!isLibraryEntryType(input.type)) throw new LibraryEntryTypeError(input.type);
      const id = nanoid();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO library_entries
           (id, project_id, type, title, body, tags_json, summary,
            source_path, source_tracked, source_hash, ingested_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        project.id,
        input.type,
        input.title,
        input.body ?? '',
        JSON.stringify(input.tags ?? []),
        input.summary ?? null,
        input.source_path ?? null,
        input.source_tracked ? 1 : 0,
        input.source_hash ?? null,
        input.ingested_at ?? null,
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

    update(id, input) {
      const before = getRow(id);
      if (!before) throw new LibraryEntryNotFoundError(id);
      const next: LibraryRow = {
        ...before,
        title: input.title ?? before.title,
        body: input.body ?? before.body,
        tags_json:
          input.tags === undefined ? before.tags_json : JSON.stringify(input.tags),
        summary: input.summary === undefined ? before.summary : input.summary,
        source_tracked:
          input.source_tracked === undefined
            ? before.source_tracked
            : input.source_tracked
              ? 1
              : 0,
        source_hash:
          input.source_hash === undefined ? before.source_hash : input.source_hash,
        ingested_at:
          input.ingested_at === undefined ? before.ingested_at : input.ingested_at,
        updated_at: new Date().toISOString(),
      };
      db.prepare(
        `UPDATE library_entries
           SET title = ?, body = ?, tags_json = ?, summary = ?,
               source_tracked = ?, source_hash = ?, ingested_at = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        next.title,
        next.body,
        next.tags_json,
        next.summary,
        next.source_tracked,
        next.source_hash,
        next.ingested_at,
        next.updated_at,
        id,
      );

      const fields: Array<{ field: string; oldVal: string | null; newVal: string | null }> = [];
      if (input.title !== undefined && input.title !== before.title) {
        fields.push({ field: 'title', oldVal: before.title, newVal: input.title });
      }
      if (input.body !== undefined && input.body !== before.body) {
        fields.push({ field: 'body', oldVal: null, newVal: null });
      }
      if (input.tags !== undefined && JSON.stringify(input.tags) !== before.tags_json) {
        fields.push({ field: 'tags', oldVal: before.tags_json, newVal: JSON.stringify(input.tags) });
      }
      if (input.summary !== undefined && input.summary !== before.summary) {
        fields.push({ field: 'summary', oldVal: before.summary, newVal: input.summary });
      }
      if (
        input.source_tracked !== undefined &&
        (input.source_tracked ? 1 : 0) !== before.source_tracked
      ) {
        fields.push({
          field: 'source_tracked',
          oldVal: String(before.source_tracked === 1),
          newVal: String(input.source_tracked),
        });
      }
      for (const f of fields) {
        appendAudit(db, {
          projectId: before.project_id,
          entityType: 'library',
          entityId: id,
          actor: 'user',
          field: f.field,
          oldValue: f.oldVal,
          newValue: f.newVal,
        });
      }
      return rowToEntry(getRow(id)!);
    },

    delete(id) {
      const row = getRow(id);
      if (!row) throw new LibraryEntryNotFoundError(id);
      const tx = db.transaction(() => {
        db.prepare('DELETE FROM item_attached_notes WHERE library_entry_id = ?').run(id);
        db.prepare('DELETE FROM library_entries WHERE id = ?').run(id);
        appendAudit(db, {
          projectId: row.project_id,
          entityType: 'library',
          entityId: id,
          actor: 'user',
          field: 'delete',
          oldValue: row.title,
        });
      });
      tx();
    },

    attach(entryId, itemId) {
      const entry = getRow(entryId);
      if (!entry) throw new LibraryEntryNotFoundError(entryId);
      if (entry.type !== 'note') throw new AttachNotANoteError(entryId, entry.type);
      const itemRow = db
        .prepare('SELECT project_id FROM items WHERE id = ?')
        .get(itemId) as { project_id: string } | undefined;
      if (!itemRow) throw new ItemNotFoundError(itemId);
      if (itemRow.project_id !== entry.project_id) {
        throw new CrossProjectAttachError(entry.project_id, itemRow.project_id);
      }
      const existing = db
        .prepare(
          'SELECT 1 AS one FROM item_attached_notes WHERE item_id = ? AND library_entry_id = ?',
        )
        .get(itemId, entryId) as { one: number } | undefined;
      if (existing) return; // idempotent
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO item_attached_notes (item_id, library_entry_id, attached_at) VALUES (?, ?, ?)',
      ).run(itemId, entryId, now);
      appendAudit(db, {
        projectId: entry.project_id,
        entityType: 'library',
        entityId: entryId,
        actor: 'user',
        field: 'attach',
        newValue: itemId,
      });
    },

    detach(entryId, itemId) {
      const entry = getRow(entryId);
      if (!entry) return; // idempotent on missing entry
      const result = db
        .prepare('DELETE FROM item_attached_notes WHERE item_id = ? AND library_entry_id = ?')
        .run(itemId, entryId);
      if (result.changes === 0) return; // idempotent on missing attachment
      appendAudit(db, {
        projectId: entry.project_id,
        entityType: 'library',
        entityId: entryId,
        actor: 'user',
        field: 'detach',
        oldValue: itemId,
      });
    },

    listAttachedItems(entryId) {
      const entry = getRow(entryId);
      if (!entry) throw new LibraryEntryNotFoundError(entryId);
      const rows = db
        .prepare(
          `SELECT i.id AS id, i.title AS title, i.type AS type, i.status AS status
             FROM item_attached_notes a
             INNER JOIN items i ON i.id = a.item_id
             WHERE a.library_entry_id = ?
             ORDER BY a.attached_at DESC`,
        )
        .all(entryId) as AttachedItemSummary[];
      return rows;
    },

    listAttachedNotes(itemId) {
      const rows = db
        .prepare(
          `SELECT l.*
             FROM item_attached_notes a
             INNER JOIN library_entries l ON l.id = a.library_entry_id
             WHERE a.item_id = ?
             ORDER BY a.attached_at DESC`,
        )
        .all(itemId) as LibraryRow[];
      return rows.map(rowToEntry);
    },

    search(request, projectScope) {
      const limit = Math.min(Math.max(request.limit ?? 50, 1), 200);
      const trimmed = request.query.trim();
      if (trimmed.length === 0) {
        return { entries: [], via: 'fts', truncated: false };
      }
      // FTS5 MATCH wants a query string. Escape double-quotes and wrap each whitespace-
      // split token in quotes so user input like ' inbox ' or 'a*b' doesn't trip syntax.
      const tokens = trimmed
        .split(/\s+/)
        .filter((t) => t.length > 0)
        .map((t) => `"${t.replace(/"/g, '""')}"`);
      if (tokens.length === 0) {
        return { entries: [], via: 'fts', truncated: false };
      }
      const matchExpr = tokens.join(' ');
      const filters: string[] = [];
      const params: Array<string | number> = [matchExpr];
      if (request.scope === 'project') {
        filters.push('l.project_id = ?');
        params.push(projectScope);
      }
      if (request.type) {
        if (!isLibraryEntryType(request.type)) throw new LibraryEntryTypeError(request.type);
        filters.push('l.type = ?');
        params.push(request.type);
      }
      const where = filters.length ? ` AND ${filters.join(' AND ')}` : '';
      // FTS5's MATCH operator requires the literal table name, not an alias, on the
      // left side of the operator — `f MATCH ?` errors with "no such column: f".
      const sql = `
        SELECT l.*
          FROM library_entries_fts
          INNER JOIN library_entries l ON l.rowid = library_entries_fts.rowid
         WHERE library_entries_fts MATCH ?${where}
         ORDER BY rank
         LIMIT ?
      `;
      params.push(limit + 1);
      const rows = db.prepare(sql).all(...params) as LibraryRow[];
      const truncated = rows.length > limit;
      const entries = (truncated ? rows.slice(0, limit) : rows).map(rowToEntry);
      return { entries, via: 'fts', truncated };
    },

    semanticSearch(_request, _projectScope) {
      // Text semantic substrate stub — lands Phase 14 (local embeddings via C-D2). The
      // code substrate (Semble, C-D17) is served by the dedicated `POST .../code-qa`
      // endpoint, not folded into library-entry results: Semble returns code chunks, not
      // LibraryEntry rows, so shoehorning them into LibrarySearchResult would misrepresent
      // the shape. The route stays so the frontend cross-substrate router binds today.
      return { entries: [], via: 'semantic-stub', truncated: false };
    },

    fillPrompt(entryId, request) {
      const entry = getRow(entryId);
      if (!entry) throw new LibraryEntryNotFoundError(entryId);
      if (entry.type !== 'prompt') throw new NotAPromptError(entryId, entry.type);
      return renderPromptBody(entry.body, request.values);
    },
  };
}

export { LIBRARY_ENTRY_TYPES };
