import type { FastifyInstance, FastifyReply } from 'fastify';
import type { RagQueryRequest } from '@throughline/shared';
import type { ProjectsService } from '../projects/service.js';
import { ProjectNotFoundError, type RagService } from './rag.js';

// Phase 14 — RAG surfaces (SPEC §7.18, §9; T-D25, C-D2; CODE_SPEC §15).

function mapError(reply: FastifyReply, err: unknown): unknown {
  if (err instanceof ProjectNotFoundError) {
    return reply.code(404).send({ error: 'not_found', message: err.message });
  }
  throw err;
}

export function registerIntelligenceRoutes(
  app: FastifyInstance,
  projects: ProjectsService,
  rag: RagService,
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
        return await rag.query(req.params.id, body);
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
        return await rag.reindex(req.params.id);
      } catch (err) {
        return mapError(reply, err);
      }
    },
  );
}
