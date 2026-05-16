import { nanoid } from 'nanoid';
import type { CreateProjectInput, Project, UpdateProjectInput } from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';
import type { MethodologyRegistry } from '../methodology/loader.js';

const DEFAULT_BUNDLE_ID = 'freeform'; // T-D47

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
      const bundlePath = input.bundle_path ?? null;
      if (!registry.hasBundle(bundleId, bundlePath)) {
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
        input.repo_path,
        input.github_owner ?? null,
        input.github_repo ?? null,
        bundleId,
        bundlePath,
        JSON.stringify(input.settings ?? {}),
        now,
        now,
      );
      registry.registerProjectBundle(id, bundleId, bundlePath);
      appendAudit(db, {
        projectId: id,
        entityType: 'project',
        entityId: id,
        actor: 'user',
        field: 'create',
        newValue: input.name,
        triggerContext: { bundle_id: bundleId, bundle_path: bundlePath, repo_path: input.repo_path },
      });
      return this.get(id)!;
    },

    update(id, input) {
      const before = this.get(id);
      if (!before) throw new Error(`project ${id} not found`);

      const nextBundlePath =
        input.bundle_path === undefined ? before.bundle_path : input.bundle_path;
      const bundlePathChanged = nextBundlePath !== before.bundle_path;
      if (bundlePathChanged && !registry.hasBundle(before.bundle_id, nextBundlePath)) {
        throw new BundleNotLoadedError(before.bundle_id);
      }

      const next: Project = {
        ...before,
        name: input.name ?? before.name,
        repo_path: input.repo_path ?? before.repo_path,
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
           SET name = ?, repo_path = ?, bundle_path = ?, github_owner = ?, github_repo = ?, state = ?, settings_json = ?, updated_at = ?, archived_at = ?
         WHERE id = ?`,
      ).run(
        next.name,
        next.repo_path,
        next.bundle_path,
        next.github_owner,
        next.github_repo,
        next.state,
        JSON.stringify(next.settings_json),
        next.updated_at,
        next.archived_at,
        id,
      );

      if (bundlePathChanged) {
        registry.unregisterProjectBundle(id);
        registry.registerProjectBundle(id, next.bundle_id, next.bundle_path);
      }

      for (const [field, oldV, newV] of [
        ['name', before.name, next.name],
        ['repo_path', before.repo_path, next.repo_path],
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
