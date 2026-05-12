import type { FastifyInstance } from 'fastify';
import { BundleNotLoadedError, type ProjectsService } from './service.js';

export function registerProjectRoutes(app: FastifyInstance, projects: ProjectsService): void {
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
      if (body.github_owner !== undefined) input.github_owner = body.github_owner;
      if (body.github_repo !== undefined) input.github_repo = body.github_repo;
      if (body.settings !== undefined) input.settings = body.settings;
      const project = projects.create(input);
      return reply.code(201).send({ project });
    } catch (err) {
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
      github_owner?: string | null;
      github_repo?: string | null;
      state?: 'active' | 'archived';
      settings?: Record<string, unknown>;
    };
  }>('/api/projects/:id', async (req, reply) => {
    const existing = projects.get(req.params.id);
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    const project = projects.update(req.params.id, req.body ?? {});
    return { project };
  });

  app.delete<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    const existing = projects.get(req.params.id);
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    projects.delete(req.params.id);
    return reply.code(204).send();
  });
}
