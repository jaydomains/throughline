import type { FastifyInstance } from 'fastify';
import {
  BundleNotLoadedError,
  DuplicateRepoPathError,
  InvalidBundlePathError,
  InvalidRepoPathError,
  type ProjectsService,
} from './service.js';
import type { SettingsService } from '../settings/service.js';

export function registerProjectRoutes(
  app: FastifyInstance,
  projects: ProjectsService,
  settings: SettingsService,
): void {
  app.get('/api/projects', async (req) => {
    const includeArchived =
      (req.query as { include_archived?: string } | undefined)?.include_archived === 'true';
    return { projects: projects.list({ includeArchived }) };
  });

  app.get<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    const project = projects.get(req.params.id);
    if (!project) return reply.code(404).send({ error: 'not_found' });
    return { project };
  });

  app.post<{
    Body: {
      name?: string;
      repo_path?: string;
      bundle_id?: string;
      bundle_path?: string | null;
      github_owner?: string;
      github_repo?: string;
      settings?: Record<string, unknown>;
    };
  }>('/api/projects', async (req, reply) => {
    const body = req.body ?? {};
    if (typeof body.name !== 'string' || body.name.length === 0) {
      return reply.code(400).send({ error: 'name_required' });
    }
    if (typeof body.repo_path !== 'string' || body.repo_path.length === 0) {
      return reply.code(400).send({ error: 'repo_path_required' });
    }
    try {
      const input: Parameters<typeof projects.create>[0] = {
        name: body.name,
        repo_path: body.repo_path,
      };
      if (body.bundle_id !== undefined) input.bundle_id = body.bundle_id;
      if (body.bundle_path !== undefined) input.bundle_path = body.bundle_path;
      if (body.github_owner !== undefined) input.github_owner = body.github_owner;
      if (body.github_repo !== undefined) input.github_repo = body.github_repo;
      if (body.settings !== undefined) input.settings = body.settings;
      const project = projects.create(input);
      return reply.code(201).send({ project });
    } catch (err) {
      if (err instanceof InvalidBundlePathError) {
        return reply.code(400).send({ error: 'invalid_bundle_path' });
      }
      if (err instanceof InvalidRepoPathError) {
        return reply.code(400).send({ error: 'invalid_repo_path' });
      }
      if (err instanceof DuplicateRepoPathError) {
        return reply
          .code(409)
          .send({ error: 'duplicate_repo_path', repo_path: err.repoPath, project_id: err.existingProjectId });
      }
      if (err instanceof BundleNotLoadedError) {
        return reply.code(400).send({ error: 'bundle_not_loaded', bundle_id: err.bundleId });
      }
      throw err;
    }
  });

  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      repo_path?: string;
      bundle_id?: string;
      bundle_path?: string | null;
      github_owner?: string | null;
      github_repo?: string | null;
      state?: 'active' | 'archived';
      settings?: Record<string, unknown>;
    };
  }>('/api/projects/:id', async (req, reply) => {
    const existing = projects.get(req.params.id);
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    try {
      const project = projects.update(req.params.id, req.body ?? {});
      return { project };
    } catch (err) {
      if (err instanceof InvalidBundlePathError) {
        return reply.code(400).send({ error: 'invalid_bundle_path' });
      }
      if (err instanceof InvalidRepoPathError) {
        return reply.code(400).send({ error: 'invalid_repo_path' });
      }
      if (err instanceof DuplicateRepoPathError) {
        return reply
          .code(409)
          .send({ error: 'duplicate_repo_path', repo_path: err.repoPath, project_id: err.existingProjectId });
      }
      if (err instanceof BundleNotLoadedError) {
        return reply.code(400).send({ error: 'bundle_not_loaded', bundle_id: err.bundleId });
      }
      throw err;
    }
  });

  app.delete<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    const existing = projects.get(req.params.id);
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    projects.delete(req.params.id);
    return reply.code(204).send();
  });

  // Phase 2: records the user's last-active project so the UI can default
  // the project switcher on next session. The active-project concept is URL
  // state in the browser; this endpoint persists the hint only.
  app.post<{ Params: { id: string } }>('/api/projects/:id/switch', async (req, reply) => {
    const existing = projects.get(req.params.id);
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    settings.set('last_active_project_id', req.params.id);
    return { ok: true as const };
  });
}
