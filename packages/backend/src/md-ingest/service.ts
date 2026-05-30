import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { nanoid } from 'nanoid';
import type {
  LibraryEntry,
  MdIngestFolder,
  MdIngestRequest,
  MdIngestResult,
  MdIngestedEntrySummary,
  MdScanCandidate,
  MdScanResult,
} from '@throughline/shared';
import { ProjectNotFoundError } from '@throughline/shared';
import { DomainError, NotFoundError } from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import { promptFingerprint } from '../ai/fingerprint.js';
import { usdEstimate } from '../ai/pricing.js';
import { recordCost } from '../cost/telemetry.js';
import type { DB } from '../db/index.js';
import type { LibraryService } from '../library/service.js';
import type { ProjectsService } from '../projects/service.js';
import type { MdSummariser } from './summariser.js';

// Phase 6c — repo `.md` ingestion service (SPEC §7.9; T-D11, T-D24, T-D29, T-D36).
//
// Folder opt-in (T-D11): the user registers directories *inside the project's repo_path*.
// C-D10: every path is confined to the repo_path subtree by lexical containment + a
// no-symlink walk, so the REST surface can never be coerced into reading arbitrary
// filesystem locations. Paths are stored relative to repo_path.
//
// Ingest produces `imported_doc` library entries via the library service (so FTS + audit
// stay uniform). The AI summary/tags telemetry flows through cost_telemetry (T-D29) and a
// prompt fingerprint into the audit trigger context (T-D24) — same shape as dump-zone.
//
// Re-ingest is snapshot-by-default; a per-entry `source_tracked` toggle (§13 adopted
// default) makes the entry mirror the file. Tracked re-ingest re-summarises (C-D11): the
// cost is user-chosen because tracking is an explicit opt-in, and it degrades to the
// heuristic summary when no API key is configured.

const SCAN_MAX_CANDIDATES = 500;
const MAX_FILE_BYTES = 2_000_000;
const MD_EXTS = new Set(['.md', '.markdown']);
const IGNORED_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.cache',
  '.venv',
  'venv',
  '__pycache__',
  'target',
]);

export class FolderNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`md-ingest folder ${id} not found`, 'folder_not_found');
  }
}

export class FolderOutsideRepoError extends DomainError {
  constructor(relPath: string) {
    super(`folder "${relPath}" resolves outside the project's repo_path (C-D10)`, { statusCode: 400, code: 'folder_outside_repo' });
  }
}

export class FolderMissingError extends DomainError {
  constructor(relPath: string) {
    super(`folder "${relPath}" does not exist on disk`, { statusCode: 400, code: 'folder_missing' });
  }
}

export class NotAnImportedDocError extends DomainError {
  constructor(entryId: string, type: string) {
    super(`library entry ${entryId} is type "${type}", not an ingested imported_doc`, { statusCode: 400, code: 'not_an_imported_doc' });
  }
}

export class EntryNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`library entry ${id} not found`, 'entry_not_found');
  }
}

export class SourceFileMissingError extends DomainError {
  constructor(path: string) {
    super(`source file "${path}" no longer exists on disk`, { statusCode: 409, code: 'source_file_missing' });
  }
}

interface FolderRow {
  id: string;
  project_id: string;
  rel_path: string;
  created_at: string;
}

function rowToFolder(row: FolderRow): MdIngestFolder {
  return {
    id: row.id,
    project_id: row.project_id,
    rel_path: row.rel_path,
    created_at: row.created_at,
  };
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

// Lexical containment: `child` must equal `root` or sit strictly under it. Combined with
// the no-symlink walk this keeps every resolved path inside the repo_path subtree without
// relying on realpath (repo_path itself is often a symlinked tmpdir under test).
function isInside(root: string, child: string): boolean {
  const r = resolve(root);
  const c = resolve(child);
  return c === r || c.startsWith(r + sep);
}

// C-D10 threat model relies on a no-symlink path. Scan's directory walk already skips
// symlinks; ingest takes user-supplied req.paths, so it must re-assert the guarantee at
// read time (TOCTOU: a symlink could be swapped in between scan and ingest). Returns true
// if any path component strictly under `baseAbs` (including the target itself) is a
// symlink — lstat, not stat, so the link itself is observed rather than its target.
function hasSymlinkComponent(baseAbs: string, targetAbs: string): boolean {
  const rel = relative(baseAbs, targetAbs);
  if (rel.length === 0) return false;
  const parts = rel.split(sep).filter((p) => p.length > 0 && p !== '.');
  let cur = baseAbs;
  for (const part of parts) {
    cur = join(cur, part);
    try {
      if (lstatSync(cur).isSymbolicLink()) return true;
    } catch {
      // Unreadable component — treat as unsafe so the caller skips it.
      return true;
    }
  }
  return false;
}

// Normalises a user-supplied rel_path and confines it to repo_path. Returns the absolute
// path; throws FolderOutsideRepoError on absolute input or `..` escape.
function confine(repoPath: string, relPath: string): string {
  const cleaned = relPath.trim().replace(/^[/\\]+/, '');
  if (isAbsolute(relPath) || normalize(cleaned).split(sep).includes('..')) {
    throw new FolderOutsideRepoError(relPath);
  }
  const abs = resolve(repoPath, cleaned);
  if (!isInside(repoPath, abs)) throw new FolderOutsideRepoError(relPath);
  return abs;
}

export interface MdIngestService {
  listFolders(projectId: string): MdIngestFolder[];
  addFolder(projectId: string, relPath: string): MdIngestFolder;
  removeFolder(projectId: string, folderId: string): void;
  scan(projectId: string, folderId: string): MdScanResult;
  ingest(projectId: string, req: MdIngestRequest): Promise<MdIngestResult>;
  setTracked(projectId: string, entryId: string, tracked: boolean): LibraryEntry;
  reingestEntry(
    projectId: string,
    entryId: string,
    actor: 'user' | 'system',
  ): Promise<{ entry: LibraryEntry; changed: boolean }>;
  listTrackedEntries(projectId: string): LibraryEntry[];
}

interface CreateOptions {
  db: DB;
  projects: ProjectsService;
  library: LibraryService;
  summariser: MdSummariser;
}

export function createMdIngestService(opts: CreateOptions): MdIngestService {
  const { db, projects, library, summariser } = opts;

  function getFolderRow(id: string): FolderRow | null {
    const row = db.prepare('SELECT * FROM md_ingest_folders WHERE id = ?').get(id) as
      | FolderRow
      | undefined;
    return row ?? null;
  }

  function requireProject(projectId: string) {
    const project = projects.get(projectId);
    if (!project) throw new ProjectNotFoundError(projectId);
    return project;
  }

  // One imported-doc entry per (project, source_path). Returns the existing entry for
  // scan-classification and re-ingest-vs-create routing.
  function findEntryBySource(projectId: string, relPath: string): LibraryEntry | null {
    const row = db
      .prepare(
        `SELECT id FROM library_entries
           WHERE project_id = ? AND type = 'imported_doc' AND source_path = ?`,
      )
      .get(projectId, relPath) as { id: string } | undefined;
    return row ? library.get(row.id) : null;
  }

  function walkMdFiles(rootAbs: string, repoPath: string): string[] {
    const out: string[] = [];
    function walk(dir: string): void {
      if (out.length >= SCAN_MAX_CANDIDATES) return;
      let entries: Dirent[];
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const dirent of entries) {
        if (out.length >= SCAN_MAX_CANDIDATES) return;
        if (dirent.isSymbolicLink()) continue; // no-symlink walk (C-D10)
        const full = join(dir, dirent.name);
        if (dirent.isDirectory()) {
          if (IGNORED_DIR_NAMES.has(dirent.name)) continue;
          walk(full);
          continue;
        }
        if (!dirent.isFile()) continue;
        const lower = dirent.name.toLowerCase();
        const dot = lower.lastIndexOf('.');
        if (dot < 0 || !MD_EXTS.has(lower.slice(dot))) continue;
        if (!isInside(repoPath, full)) continue;
        out.push(full);
      }
    }
    walk(rootAbs);
    return out;
  }

  return {
    listFolders(projectId) {
      requireProject(projectId);
      const rows = db
        .prepare('SELECT * FROM md_ingest_folders WHERE project_id = ? ORDER BY created_at ASC')
        .all(projectId) as FolderRow[];
      return rows.map(rowToFolder);
    },

    addFolder(projectId, relPath) {
      const project = requireProject(projectId);
      const abs = confine(project.repo_path, relPath);
      const normalisedRel = relative(resolve(project.repo_path), abs) || '.';
      if (!existsSync(abs) || !statSync(abs).isDirectory()) {
        throw new FolderMissingError(normalisedRel);
      }
      const existing = db
        .prepare('SELECT * FROM md_ingest_folders WHERE project_id = ? AND rel_path = ?')
        .get(projectId, normalisedRel) as FolderRow | undefined;
      if (existing) return rowToFolder(existing); // idempotent
      const id = nanoid();
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO md_ingest_folders (id, project_id, rel_path, created_at) VALUES (?, ?, ?, ?)',
      ).run(id, projectId, normalisedRel, now);
      appendAudit(db, {
        projectId,
        entityType: 'project',
        entityId: projectId,
        actor: 'user',
        field: 'md_ingest_folder_add',
        newValue: normalisedRel,
        triggerContext: { folder_id: id },
      });
      return rowToFolder(getFolderRow(id)!);
    },

    removeFolder(projectId, folderId) {
      requireProject(projectId);
      const row = getFolderRow(folderId);
      if (!row || row.project_id !== projectId) throw new FolderNotFoundError(folderId);
      db.prepare('DELETE FROM md_ingest_folders WHERE id = ?').run(folderId);
      appendAudit(db, {
        projectId,
        entityType: 'project',
        entityId: projectId,
        actor: 'user',
        field: 'md_ingest_folder_remove',
        oldValue: row.rel_path,
        triggerContext: { folder_id: folderId },
      });
    },

    scan(projectId, folderId) {
      const project = requireProject(projectId);
      const row = getFolderRow(folderId);
      if (!row || row.project_id !== projectId) throw new FolderNotFoundError(folderId);
      const abs = confine(project.repo_path, row.rel_path);
      if (!existsSync(abs)) throw new FolderMissingError(row.rel_path);
      const repoAbs = resolve(project.repo_path);
      const files = walkMdFiles(abs, project.repo_path);
      const candidates: MdScanCandidate[] = [];
      for (const full of files) {
        const relPath = relative(repoAbs, full);
        let content: string;
        let size: number;
        try {
          size = statSync(full).size;
          if (size > MAX_FILE_BYTES) continue;
          content = readFileSync(full, 'utf8');
        } catch {
          continue;
        }
        const existing = findEntryBySource(projectId, relPath);
        let status: MdScanCandidate['status'];
        if (!existing) status = 'new';
        else if (existing.source_hash === hashContent(content)) status = 'unchanged';
        else status = 'changed';
        candidates.push({
          rel_path: relPath,
          size,
          status,
          entry_id: existing ? existing.id : null,
        });
      }
      candidates.sort((a, b) => a.rel_path.localeCompare(b.rel_path));
      return {
        folder_id: folderId,
        candidates,
        truncated: files.length >= SCAN_MAX_CANDIDATES,
      };
    },

    async ingest(projectId, req) {
      const project = requireProject(projectId);
      const folder = getFolderRow(req.folder_id);
      if (!folder || folder.project_id !== projectId) {
        throw new FolderNotFoundError(req.folder_id);
      }
      const folderAbs = confine(project.repo_path, folder.rel_path);
      const repoAbs = resolve(project.repo_path);
      const ingested: MdIngestedEntrySummary[] = [];
      const skipped: string[] = [];

      for (const relPath of req.paths) {
        let abs: string;
        try {
          abs = confine(project.repo_path, relPath);
        } catch {
          skipped.push(relPath);
          continue;
        }
        // Selected paths must live under the scanned folder, not just somewhere in repo,
        // and must be reachable without traversing a symlink (C-D10 — guards the
        // scan→ingest TOCTOU window).
        if (
          !isInside(folderAbs, abs) ||
          !existsSync(abs) ||
          hasSymlinkComponent(folderAbs, abs)
        ) {
          skipped.push(relPath);
          continue;
        }
        let content: string;
        try {
          if (statSync(abs).size > MAX_FILE_BYTES) {
            skipped.push(relPath);
            continue;
          }
          content = readFileSync(abs, 'utf8');
        } catch {
          skipped.push(relPath);
          continue;
        }
        const hash = hashContent(content);
        const now = new Date().toISOString();
        const result = await summariser.summarise({ rel_path: relPath, content });
        const existing = findEntryBySource(projectId, relPath);

        let entryId: string;
        let status: MdIngestedEntrySummary['status'];
        if (existing) {
          library.update(existing.id, {
            body: content,
            summary: result.summary,
            tags: result.tags,
            source_hash: hash,
            ingested_at: now,
          });
          entryId = existing.id;
          status = 'reingested';
        } else {
          const title = relPath.split(/[\\/]/).pop() ?? relPath;
          const created = library.create({
            project_id: projectId,
            type: 'imported_doc',
            title,
            body: content,
            tags: result.tags,
            summary: result.summary,
            source_path: relPath,
            source_tracked: false,
            source_hash: hash,
            ingested_at: now,
          });
          entryId = created.id;
          status = 'created';
        }

        const triggerContext: Record<string, unknown> = {
          folder_id: req.folder_id,
          source_path: relPath,
          status,
          repo_path_rooted: repoAbs.length > 0,
        };
        if (result.telemetry.model) triggerContext.model = result.telemetry.model;
        if (result.telemetry.prompt) {
          triggerContext.prompt_fingerprint = promptFingerprint(
            'md_ingest_summary',
            result.telemetry.prompt,
          );
        }
        appendAudit(db, {
          projectId,
          entityType: 'library',
          entityId: entryId,
          actor: result.telemetry.model ? 'ai' : 'system',
          field: 'md_ingest',
          newValue: relPath,
          triggerContext,
        });
        if (
          result.telemetry.model &&
          (result.telemetry.input_tokens > 0 || result.telemetry.output_tokens > 0)
        ) {
          recordCost(db, {
            projectId,
            feature: 'md_ingest_summary',
            model: result.telemetry.model,
            inputTokens: result.telemetry.input_tokens,
            outputTokens: result.telemetry.output_tokens,
            usdEstimate: usdEstimate(
              result.telemetry.model,
              result.telemetry.input_tokens,
              result.telemetry.output_tokens,
            ),
          });
        }
        ingested.push({ entry_id: entryId, rel_path: relPath, status });
      }
      return { ingested, skipped };
    },

    setTracked(projectId, entryId, tracked) {
      requireProject(projectId);
      const entry = library.get(entryId);
      if (!entry || entry.project_id !== projectId) throw new EntryNotFoundError(entryId);
      if (entry.type !== 'imported_doc' || entry.source_path === null) {
        throw new NotAnImportedDocError(entryId, entry.type);
      }
      return library.update(entryId, { source_tracked: tracked });
    },

    async reingestEntry(projectId, entryId, actor) {
      const project = requireProject(projectId);
      const entry = library.get(entryId);
      if (!entry || entry.project_id !== projectId) throw new EntryNotFoundError(entryId);
      if (entry.type !== 'imported_doc' || entry.source_path === null) {
        throw new NotAnImportedDocError(entryId, entry.type);
      }
      const abs = confine(project.repo_path, entry.source_path);
      if (!existsSync(abs)) throw new SourceFileMissingError(entry.source_path);
      const content = readFileSync(abs, 'utf8');
      const hash = hashContent(content);
      if (hash === entry.source_hash) {
        return { entry, changed: false };
      }
      const now = new Date().toISOString();
      const result = await summariser.summarise({
        rel_path: entry.source_path,
        content,
      });
      const updated = library.update(entryId, {
        body: content,
        summary: result.summary,
        tags: result.tags,
        source_hash: hash,
        ingested_at: now,
      });
      const triggerContext: Record<string, unknown> = {
        source_path: entry.source_path,
        trigger: actor === 'system' ? 'watch' : 'manual',
      };
      if (result.telemetry.model) triggerContext.model = result.telemetry.model;
      if (result.telemetry.prompt) {
        triggerContext.prompt_fingerprint = promptFingerprint(
          'md_ingest_summary',
          result.telemetry.prompt,
        );
      }
      appendAudit(db, {
        projectId,
        entityType: 'library',
        entityId: entryId,
        actor: actor === 'system' ? 'system' : result.telemetry.model ? 'ai' : 'user',
        field: 'md_reingest',
        newValue: entry.source_path,
        triggerContext,
      });
      if (
        result.telemetry.model &&
        (result.telemetry.input_tokens > 0 || result.telemetry.output_tokens > 0)
      ) {
        recordCost(db, {
          projectId,
          feature: 'md_ingest_summary',
          model: result.telemetry.model,
          inputTokens: result.telemetry.input_tokens,
          outputTokens: result.telemetry.output_tokens,
          usdEstimate: usdEstimate(
            result.telemetry.model,
            result.telemetry.input_tokens,
            result.telemetry.output_tokens,
          ),
        });
      }
      return { entry: updated, changed: true };
    },

    listTrackedEntries(projectId) {
      requireProject(projectId);
      const rows = db
        .prepare(
          `SELECT id FROM library_entries
             WHERE project_id = ? AND type = 'imported_doc'
               AND source_tracked = 1 AND source_path IS NOT NULL`,
        )
        .all(projectId) as Array<{ id: string }>;
      return rows
        .map((r) => library.get(r.id))
        .filter((e): e is LibraryEntry => e !== null);
    },
  };
}
