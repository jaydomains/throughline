import { nanoid } from 'nanoid';
import { realpathSync } from 'node:fs';
import { isAbsolute, normalize } from 'node:path';
import type { CreateProjectInput, Project, UpdateProjectInput } from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';
import type { MethodologyRegistry } from '../methodology/loader.js';

const DEFAULT_BUNDLE_ID = 'freeform'; // T-D47

export class InvalidBundlePathError extends Error {
  constructor(public bundlePath: string) {
    super(`invalid bundle_path "${bundlePath}"`);
  }
}

export class InvalidRepoPathError extends Error {
  constructor(public repoPath: string) {
    super(`invalid repo_path "${repoPath}"`);
  }
}

export class DuplicateRepoPathError extends Error {
  constructor(public repoPath: string, public existingProjectId: string) {
    super(`repo_path "${repoPath}" is already bound to project "${existingProjectId}"`);
  }
}

// C-D14 — `bundle_path` is an arbitrary string from the API body that the loader
// feeds to readFileSync. Constrain it to a normalized absolute path with no
// parent-directory traversal so an authenticated caller cannot point the loader
// at relative or `..`-escaped locations. Returns the canonical path to persist.
function validateBundlePath(bundlePath: string | null | undefined): string | null {
  if (bundlePath === null || bundlePath === undefined) return null;
  if (typeof bundlePath !== 'string' || bundlePath.trim().length === 0) {
    throw new InvalidBundlePathError(String(bundlePath));
  }
  // Check the raw input for `..` before normalizing — normalize() collapses
  // traversal (e.g. `/a/b/../../etc` → `/etc`), which would otherwise smuggle a
  // traversal-derived path past the check.
  if (!isAbsolute(bundlePath) || bundlePath.split(/[/\\]/).includes('..')) {
    throw new InvalidBundlePathError(bundlePath);
  }
  return normalize(bundlePath);
}

// C-D19 surface 8 — every project create/update normalises `repo_path` to a
// canonical absolute, symlink-resolved form so two creates against equivalent
// paths (different symlink chains, redundant separators, etc.) land on the
// same persisted value and collide on the uniqueness check.
//
// Realpath fallback: if the path does not yet exist on disk, fall back to
// `normalize()`. Callers may legitimately bind a project before its repo is
// materialised (e.g. tests, scripted setup); we cannot demand existence.
function validateRepoPath(repoPath: string): string {
  if (typeof repoPath !== 'string' || repoPath.trim().length === 0) {
    throw new InvalidRepoPathError(String(repoPath));
  }
  if (!isAbsolute(repoPath) || repoPath.split(/[/\\]/).includes('..')) {
    throw new InvalidRepoPathError(repoPath);
  }
  try {
    return realpathSync.native(repoPath);
  } catch {
    return normalize(repoPath);
  }
}

function findProjectByRepoPath(db: DB, repoPath: string): string | null {
  const row = db
    .prepare('SELECT id FROM projects WHERE repo_path = ? LIMIT 1')
    .get(repoPath) as { id: string } | undefined;
  return row?.id ?? null;
}

interface ProjectRow {
  id: string;
  name: string;
  repo_path: string;
  github_owner: string | null;
  github_repo: string | null;
  bundle_id: string;
  bundle_path: string | null;
  state: 'active' | 'archived';
  settings_json: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    repo_path: row.repo_path,
    github_owner: row.github_owner,
    github_repo: row.github_repo,
    bundle_id: row.bundle_id,
    bundle_path: row.bundle_path,
    state: row.state,
    settings_json: JSON.parse(row.settings_json) as Record<string, unknown>,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

export class BundleNotLoadedError extends Error {
  constructor(public bundleId: string) {
    super(`bundle "${bundleId}" is not loaded`);
  }
}

export interface ProjectsService {
  list(opts?: { includeArchived?: boolean }): Project[];
  get(id: string): Project | null;
  create(input: CreateProjectInput): Project;
  update(id: string, input: UpdateProjectInput): Project;
  delete(id: string): void;
}

export function createProjectsService(db: DB, registry: MethodologyRegistry): ProjectsService {
  return {
    list({ includeArchived = false } = {}) {
      const sql = includeArchived
        ? 'SELECT * FROM projects ORDER BY created_at ASC'
        : "SELECT * FROM projects WHERE state = 'active' ORDER BY created_at ASC";
      const rows = db.prepare(sql).all() as ProjectRow[];
      return rows.map(rowToProject);
    },

    get(id) {
      const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
      return row ? rowToProject(row) : null;
    },

    create(input) {
      const bundleId = input.bundle_id ?? DEFAULT_BUNDLE_ID;
      const bundlePath = validateBundlePath(input.bundle_path);
      const repoPath = validateRepoPath(input.repo_path);
      const existing = findProjectByRepoPath(db, repoPath);
      if (existing) {
        throw new DuplicateRepoPathError(repoPath, existing);
      }
      if (!registry.hasBundle(bundleId, bundlePath, repoPath)) {
        throw new BundleNotLoadedError(bundleId);
      }
      const now = new Date().toISOString();
      const id = nanoid();
      db.prepare(
        `INSERT INTO projects
          (id, name, repo_path, github_owner, github_repo, bundle_id, bundle_path, state, settings_json, created_at, updated_at, archived_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, NULL)`,
      ).run(
        id,
        input.name,
        repoPath,
        input.github_owner ?? null,
        input.github_repo ?? null,
        bundleId,
        bundlePath,
        JSON.stringify(input.settings ?? {}),
        now,
        now,
      );
      registry.registerProjectBundle(id, bundleId, bundlePath, repoPath);
      appendAudit(db, {
        projectId: id,
        entityType: 'project',
        entityId: id,
        actor: 'user',
        field: 'create',
        newValue: input.name,
        triggerContext: { bundle_id: bundleId, bundle_path: bundlePath, repo_path: repoPath },
      });
      return this.get(id)!;
    },

    update(id, input) {
      const before = this.get(id);
      if (!before) throw new Error(`project ${id} not found`);

      const nextBundleId = input.bundle_id ?? before.bundle_id;
      const nextBundlePath =
        input.bundle_path === undefined ? before.bundle_path : validateBundlePath(input.bundle_path);
      const nextRepoPath =
        input.repo_path === undefined ? before.repo_path : validateRepoPath(input.repo_path);
      if (nextRepoPath !== before.repo_path) {
        const existing = findProjectByRepoPath(db, nextRepoPath);
        if (existing && existing !== id) {
          throw new DuplicateRepoPathError(nextRepoPath, existing);
        }
      }
      const bundleChanged =
        nextBundleId !== before.bundle_id || nextBundlePath !== before.bundle_path;
      const repoPathChanged = nextRepoPath !== before.repo_path;
      // Watcher must re-bind when arm 2 inputs shift even if the bundle id/path
      // didn't: a moved repo_path means a different `<repo_path>/.throughline/bundle.md`.
      const bindingChanged = bundleChanged || (nextBundlePath === null && repoPathChanged);
      if (bundleChanged && !registry.hasBundle(nextBundleId, nextBundlePath, nextRepoPath)) {
        throw new BundleNotLoadedError(nextBundleId);
      }

      const next: Project = {
        ...before,
        name: input.name ?? before.name,
        repo_path: nextRepoPath,
        bundle_id: nextBundleId,
        bundle_path: nextBundlePath,
        github_owner: input.github_owner === undefined ? before.github_owner : input.github_owner,
        github_repo: input.github_repo === undefined ? before.github_repo : input.github_repo,
        state: input.state ?? before.state,
        settings_json: input.settings ?? before.settings_json,
        updated_at: new Date().toISOString(),
      };
      next.archived_at = next.state === 'archived' ? before.archived_at ?? next.updated_at : null;

      db.prepare(
        `UPDATE projects
           SET name = ?, repo_path = ?, bundle_id = ?, bundle_path = ?, github_owner = ?, github_repo = ?, state = ?, settings_json = ?, updated_at = ?, archived_at = ?
         WHERE id = ?`,
      ).run(
        next.name,
        next.repo_path,
        next.bundle_id,
        next.bundle_path,
        next.github_owner,
        next.github_repo,
        next.state,
        JSON.stringify(next.settings_json),
        next.updated_at,
        next.archived_at,
        id,
      );

      if (bindingChanged) {
        registry.unregisterProjectBundle(id);
        registry.registerProjectBundle(id, next.bundle_id, next.bundle_path, next.repo_path);
      }

      for (const [field, oldV, newV] of [
        ['name', before.name, next.name],
        ['repo_path', before.repo_path, next.repo_path],
        ['bundle_id', before.bundle_id, next.bundle_id],
        ['bundle_path', before.bundle_path ?? '', next.bundle_path ?? ''],
        ['github_owner', before.github_owner ?? '', next.github_owner ?? ''],
        ['github_repo', before.github_repo ?? '', next.github_repo ?? ''],
        ['state', before.state, next.state],
      ] as const) {
        if (oldV !== newV) {
          appendAudit(db, {
            projectId: id,
            entityType: 'project',
            entityId: id,
            actor: 'user',
            field,
            oldValue: String(oldV),
            newValue: String(newV),
          });
        }
      }

      return this.get(id)!;
    },

    delete(id) {
      const before = this.get(id);
      if (!before) return;
      // FK ON DELETE CASCADE handles per-project entity tables (C-D5).
      db.prepare('DELETE FROM projects WHERE id = ?').run(id);
      registry.unregisterProjectBundle(id);
      appendAudit(db, {
        projectId: null,
        entityType: 'project',
        entityId: id,
        actor: 'user',
        field: 'delete',
        oldValue: before.name,
      });
    },
  };
}
