import type { FastifyInstance } from 'fastify';
import type { SessionsService } from './service.js';
import { ProjectNotFoundError } from '@throughline/shared';
import type { ProjectsService } from '../projects/service.js';

export function registerSessionRoutes(
  app: FastifyInstance,
  projects: ProjectsService,
  sessions: SessionsService,
): void {
  function requireProject(id: string): boolean {
    return projects.get(id) !== null;
  }

  app.get<{ Params: { id: string } }>('/api/projects/:id/sessions', async (req, reply) => {
    if (!requireProject(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
    return { sessions: sessions.list(req.params.id) };
  });

  app.get<{ Params: { id: string; sessionId: string } }>(
    '/api/projects/:id/sessions/:sessionId',
    async (req, reply) => {
      const session = sessions.get(req.params.sessionId);
      if (!session || session.project_id !== req.params.id)
        return reply.code(404).send({ error: 'not_found' });
      return { session };
    },
  );

  app.post<{
    Params: { id: string };
    Body: {
      name?: string;
      branch_ref?: string | null;
      context?: string | null;
      settings?: Record<string, unknown>;
    };
  }>('/api/projects/:id/sessions', async (req, reply) => {
    if (!requireProject(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
    const body = req.body ?? {};
    if (typeof body.name !== 'string' || body.name.length === 0)
      return reply.code(400).send({ error: 'name_required' });
    try {
      const input: Parameters<SessionsService['create']>[0] = {
        project_id: req.params.id,
        name: body.name,
      };
      if (body.branch_ref !== undefined) input.branch_ref = body.branch_ref;
      if (body.context !== undefined) input.context = body.context;
      if (body.settings !== undefined) input.settings = body.settings;
      const session = sessions.create(input);
      return reply.code(201).send({ session });
    } catch (err) {
      if (err instanceof ProjectNotFoundError) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      throw err;
    }
  });

  app.patch<{
    Params: { id: string; sessionId: string };
    Body: {
      name?: string;
      branch_ref?: string | null;
      context?: string | null;
      settings?: Record<string, unknown>;
    };
  }>('/api/projects/:id/sessions/:sessionId', async (req, reply) => {
    const existing = sessions.get(req.params.sessionId);
    if (!existing || existing.project_id !== req.params.id)
      return reply.code(404).send({ error: 'not_found' });
    const session = sessions.update(req.params.sessionId, req.body ?? {});
    return { session };
  });

  app.delete<{ Params: { id: string; sessionId: string } }>(
    '/api/projects/:id/sessions/:sessionId',
    async (req, reply) => {
      const existing = sessions.get(req.params.sessionId);
      if (!existing || existing.project_id !== req.params.id)
        return reply.code(404).send({ error: 'not_found' });
      sessions.delete(req.params.sessionId);
      return reply.code(204).send();
    },
  );
}
