import type { FastifyInstance } from 'fastify';
import type {
  ChatProposeRequest,
  ChatSendRequest,
  RagQueryRequest,
  SessionRetroRequest,
} from '@throughline/shared';
import type { ProjectsService } from '../projects/service.js';
import type { RagService } from './rag.js';
import type { RetroService } from './retro.js';
import type { PeriodicReviewService } from './periodic-review.js';
import type { SequencingService } from './sequencing.js';
import type { StakeholderService } from './stakeholder.js';
import type { ChatService } from './chat.js';

// Phase 14 — intelligence surfaces (SPEC §7.18, §9; T-D22, T-D25, C-D2; CODE_SPEC §15).

interface IntelligenceServices {
  rag: RagService;
  retro: RetroService;
  periodicReview: PeriodicReviewService;
  sequencing: SequencingService;
  stakeholder: StakeholderService;
  chat: ChatService;
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
      return await svc.rag.query(req.params.id, body);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/projects/:id/intelligence/reindex',
    async (req, reply) => {
      if (!projects.get(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      return await svc.rag.reindex(req.params.id);
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
      return await svc.retro.generate(req.params.id, body);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/intelligence/periodic-review',
    async (req, reply) => {
      if (!projects.get(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      return svc.periodicReview.review(req.params.id);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/projects/:id/intelligence/periodic-review/synthesize',
    async (req, reply) => {
      if (!projects.get(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      return await svc.periodicReview.synthesize(req.params.id);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/intelligence/do-next',
    async (req, reply) => {
      if (!projects.get(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      return svc.sequencing.doNext(req.params.id);
    },
  );

  app.get<{ Params: { id: string; itemId: string } }>(
    '/api/projects/:id/intelligence/items/:itemId/stakeholder',
    async (req, reply) => {
      if (!projects.get(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      return await svc.stakeholder.render(req.params.id, req.params.itemId);
    },
  );

  app.get<{
    Params: { id: string };
    Querystring: { context_type?: string; context_id?: string };
  }>('/api/projects/:id/intelligence/chat', async (req, reply) => {
    if (!projects.get(req.params.id)) {
      return reply.code(404).send({ error: 'project_not_found' });
    }
    const ct = req.query.context_type ?? '';
    const ci = req.query.context_id ?? '';
    if (ct === '' || ci === '') {
      return reply.code(400).send({ error: 'context_required' });
    }
    return svc.chat.history(req.params.id, ct, ci);
  });

  app.post<{ Params: { id: string }; Body: ChatSendRequest }>(
    '/api/projects/:id/intelligence/chat',
    async (req, reply) => {
      if (!projects.get(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      const b = req.body;
      if (!b || typeof b.message !== 'string' || b.message.trim() === '' || !b.context_id) {
        return reply.code(400).send({ error: 'message_and_context_required' });
      }
      return await svc.chat.send(req.params.id, b);
    },
  );

  app.post<{ Params: { id: string }; Body: ChatProposeRequest }>(
    '/api/projects/:id/intelligence/chat/propose',
    async (req, reply) => {
      if (!projects.get(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      const b = req.body;
      if (!b || typeof b.text !== 'string' || b.text.trim() === '') {
        return reply.code(400).send({ error: 'text_required' });
      }
      // `target` is untrusted HTTP input that reaches a DB insert via
      // dumpZone.propose — guard it at the boundary (TS types don't bind clients).
      if (b.target !== 'session' && b.target !== 'library') {
        return reply.code(400).send({ error: 'invalid_target' });
      }
      return await svc.chat.propose(req.params.id, b);
    },
  );
}
