import type { FastifyInstance, FastifyReply } from 'fastify';
import type { RagQueryRequest, SessionRetroRequest } from '@throughline/shared';
import type { ProjectsService } from '../projects/service.js';
import { ProjectNotFoundError, type RagService } from './rag.js';
import {
  ProjectNotFoundError as RetroProjectNotFoundError,
  SessionNotFoundError,
  type RetroService,
} from './retro.js';
import {
  ProjectNotFoundError as ReviewProjectNotFoundError,
  type PeriodicReviewService,
} from './periodic-review.js';

// Phase 14 — intelligence surfaces (SPEC §7.18, §9; T-D22, T-D25, C-D2; CODE_SPEC §15).

function mapError(reply: FastifyReply, err: unknown): unknown {
  if (
    err instanceof ProjectNotFoundError ||
    err instanceof RetroProjectNotFoundError ||
    err instanceof ReviewProjectNotFoundError
  ) {
    return reply.code(404).send({ error: 'not_found', message: (err as Error).message });
  }
  if (err instanceof SessionNotFoundError) {
    return reply.code(404).send({ error: 'session_not_found', message: err.message });
  }
  throw err;
}

interface IntelligenceServices {
  rag: RagService;
  retro: RetroService;
  periodicReview: PeriodicReviewService;
}

export function registerIntelligenceRoutes(
  app: FastifyInstance,
  projects: ProjectsService,
  svc: IntelligenceServices,
): void {
  app.post<{ Params: { id: string }; Body: RagQueryRequest }>(
    '/api/projects/:id/intelligence/rag',
    async (req, reply) => {
      if (!projects.get(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      const body = req.body ?? ({ query: '' } as RagQueryRequest);
      if (typeof body.query !== 'string' || body.query.trim() === '') {
        return reply.code(400).send({ error: 'empty_query' });
      }
      try {
        return await svc.rag.query(req.params.id, body);
      } catch (err) {
        return mapError(reply, err);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/projects/:id/intelligence/reindex',
    async (req, reply) => {
      if (!projects.get(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      try {
        return await svc.rag.reindex(req.params.id);
      } catch (err) {
        return mapError(reply, err);
      }
    },
  );

  app.post<{ Params: { id: string }; Body: SessionRetroRequest }>(
    '/api/projects/:id/intelligence/retro',
    async (req, reply) => {
      if (!projects.get(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      const body = req.body;
      if (!body || typeof body.session_id !== 'string' || body.session_id === '') {
        return reply.code(400).send({ error: 'session_required' });
      }
      try {
        return await svc.retro.generate(req.params.id, body);
      } catch (err) {
        return mapError(reply, err);
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/intelligence/periodic-review',
    async (req, reply) => {
      if (!projects.get(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      try {
        return svc.periodicReview.review(req.params.id);
      } catch (err) {
        return mapError(reply, err);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/projects/:id/intelligence/periodic-review/synthesize',
    async (req, reply) => {
      if (!projects.get(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      try {
        return await svc.periodicReview.synthesize(req.params.id);
      } catch (err) {
        return mapError(reply, err);
      }
    },
  );
}
