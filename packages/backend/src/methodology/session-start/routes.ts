import type { FastifyInstance } from 'fastify';
import type { ProjectsService } from '../../projects/service.js';
import {
  type SessionStartEngine,
} from './engine.js';

// Phase 13 — session-start scaffolding surfaces (SPEC §7.18, §9, C-D9). Bundle-driven
// prompt assembly. Freeform-bound projects still get a minimum-spec prompt via the
// synthetic `default` mode (the UI surface stays uniform, mirroring the gates view).

export function registerSessionStartRoutes(
  app: FastifyInstance,
  projects: ProjectsService,
  engine: SessionStartEngine,
): void {
  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/session-start/modes',
    async (req, reply) => {
      if (!projects.get(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      return engine.modes(req.params.id);
    },
  );

  app.post<{
    Params: { id: string };
    Body: { companion_mode?: string | null };
  }>('/api/projects/:id/session-start-prompt', async (req, reply) => {
    if (!projects.get(req.params.id)) {
      return reply.code(404).send({ error: 'project_not_found' });
    }
    return await engine.generate(req.params.id, req.body?.companion_mode ?? null);
  });
}
