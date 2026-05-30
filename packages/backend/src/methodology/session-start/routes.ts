import type { FastifyInstance, FastifyReply } from 'fastify';
import { ProjectNotFoundError } from '@throughline/shared';
import type { ProjectsService } from '../../projects/service.js';
import {
  BundleUnresolvedError,
  InvalidModeError,
  type SessionStartEngine,
} from './engine.js';

// Phase 13 — session-start scaffolding surfaces (SPEC §7.18, §9, C-D9). Bundle-driven
// prompt assembly. Freeform-bound projects still get a minimum-spec prompt via the
// synthetic `default` mode (the UI surface stays uniform, mirroring the gates view).

function mapError(reply: FastifyReply, err: unknown): unknown {
  if (err instanceof ProjectNotFoundError || err instanceof BundleUnresolvedError) {
    return reply.code(404).send({ error: 'not_found', message: (err as Error).message });
  }
  if (err instanceof InvalidModeError) {
    return reply.code(400).send({ error: 'invalid_mode', message: err.message });
  }
  throw err;
}

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
      try {
        return engine.modes(req.params.id);
      } catch (err) {
        return mapError(reply, err);
      }
    },
  );

  app.post<{
    Params: { id: string };
    Body: { companion_mode?: string | null };
  }>('/api/projects/:id/session-start-prompt', async (req, reply) => {
    if (!projects.get(req.params.id)) {
      return reply.code(404).send({ error: 'project_not_found' });
    }
    try {
      return await engine.generate(req.params.id, req.body?.companion_mode ?? null);
    } catch (err) {
      return mapError(reply, err);
    }
  });
}
