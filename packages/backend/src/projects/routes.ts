import type { FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Project, ThroughlineStatus } from '@throughline/shared';
import {
  type ProjectsService,
} from './service.js';
import {
  readProjectConfig,
} from '../init/config-reader.js';
import type { SettingsService } from '../settings/service.js';

// C-D19 surface 6 — clone-and-go config presence summary, computed at request
// time. Cheap filesystem stat + parse attempt; safe to call on every list /
// get response.
export function computeThroughlineStatus(repoPath: string): ThroughlineStatus {
  if (!existsSync(join(repoPath, '.throughline'))) return 'absent';
  try {
    const cfg = readProjectConfig(repoPath);
    return cfg === null ? 'partial' : 'complete';
  } catch {
    // project.json present but unreadable / malformed / mismatched.
    return 'partial';
  }
}

function withStatus(project: Project): Project {
  return { ...project, throughline_status: computeThroughlineStatus(project.repo_path) };
}

export function registerProjectRoutes(
  app: FastifyInstance,
  projects: ProjectsService,
  settings: SettingsService,
): void {
  app.get('/api/projects', async (req) => {
    const includeArchived =
      (req.query as { include_archived?: string } | undefined)?.include_archived === 'true';
    return { projects: projects.list({ includeArchived }).map(withStatus) };
  });

  app.get<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    const project = projects.get(req.params.id);
    if (!project) return reply.code(404).send({ error: 'not_found' });
    return { project: withStatus(project) };
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
    return reply.code(201).send({ project: withStatus(project) });
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
      reinit_throughline?: boolean;
    };
  }>('/api/projects/:id', async (req, reply) => {
    const existing = projects.get(req.params.id);
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    const project = projects.update(req.params.id, req.body ?? {});
    return { project: withStatus(project) };
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
