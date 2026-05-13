import type { FastifyInstance } from 'fastify';
import type { ScratchpadService } from './service.js';
import type { ProjectsService } from '../projects/service.js';

interface JotBody {
  body?: string;
}

export function registerScratchpadRoutes(
  app: FastifyInstance,
  projects: ProjectsService,
  service: ScratchpadService,
): void {
  // Project-scoped — jots created here carry the project_id. The global list endpoint isn't
  // wired in v1; cross-project rollups land in Phase 14 (periodic review).
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/api/projects/:id/scratchpad/jots',
    async (req, reply) => {
      if (!projects.get(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      const limit = req.query.limit ? Math.max(1, Math.min(200, Number(req.query.limit))) : undefined;
      return { jots: service.list(req.params.id, limit) };
    },
  );

  app.post<{ Params: { id: string }; Body: JotBody }>(
    '/api/projects/:id/scratchpad/jots',
    async (req, reply) => {
      if (!projects.get(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      const body = req.body?.body;
      if (typeof body !== 'string' || body.trim().length === 0) {
        return reply.code(400).send({ error: 'body_required' });
      }
      const jot = service.create({ project_id: req.params.id, body });
      return reply.code(201).send({ jot });
    },
  );

  app.delete<{ Params: { id: string; jotId: string } }>(
    '/api/projects/:id/scratchpad/jots/:jotId',
    async (_req, reply) => {
      // No 404 check — delete is idempotent; the service no-ops on a missing row.
      service.delete(_req.params.jotId);
      return reply.code(204).send();
    },
  );
}
