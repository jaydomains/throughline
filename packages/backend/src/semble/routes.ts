import type { FastifyInstance } from 'fastify';
import type { ConfirmCodeRefsRequest } from '@throughline/shared';
import type { ProjectsService } from '../projects/service.js';
import {
  type SembleService,
} from './service.js';

// Phase 11 — Semble surfaces (SPEC §7.15; C-D17). Done-time code linking
// (search → confirm → item_code_refs, which lights up tier-3 drift) and plain-English
// code Q&A. Inert-but-present when Semble is unconfigured (SPEC §15).

function validRefs(body: unknown): ConfirmCodeRefsRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const refs = (body as { refs?: unknown }).refs;
  if (!Array.isArray(refs) || refs.length === 0) return null;
  const out: ConfirmCodeRefsRequest['refs'] = [];
  for (const r of refs) {
    if (typeof r !== 'object' || r === null) return null;
    const o = r as Record<string, unknown>;
    if (typeof o.path !== 'string' || o.path.length === 0) return null;
    const ls = Number(o.line_start);
    const le = Number(o.line_end);
    if (!Number.isFinite(ls) || !Number.isFinite(le)) return null;
    out.push({
      path: o.path,
      line_start: ls,
      line_end: le,
      summary: typeof o.summary === 'string' ? o.summary : null,
    });
  }
  return { refs: out };
}

export function registerSembleRoutes(
  app: FastifyInstance,
  projects: ProjectsService,
  service: SembleService,
): void {
  app.post<{ Params: { id: string; itemId: string } }>(
    '/api/projects/:id/items/:itemId/code-search',
    async (req, reply) => {
      if (!projects.get(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      return { result: await service.searchForItem(req.params.itemId) };
    },
  );

  app.get<{ Params: { id: string; itemId: string } }>(
    '/api/projects/:id/items/:itemId/code-refs',
    async (req, reply) => {
      if (!projects.get(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      return { refs: service.listRefs(req.params.itemId) };
    },
  );

  app.post<{ Params: { id: string; itemId: string }; Body: unknown }>(
    '/api/projects/:id/items/:itemId/code-refs',
    async (req, reply) => {
      if (!projects.get(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      const parsed = validRefs(req.body);
      if (!parsed) return reply.code(400).send({ error: 'refs_required' });
      const refs = service.confirmRefs(req.params.itemId, parsed);
      return reply.code(201).send({ refs });
    },
  );

  app.delete<{ Params: { id: string; itemId: string; refId: string } }>(
    '/api/projects/:id/items/:itemId/code-refs/:refId',
    async (req, reply) => {
      if (!projects.get(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      service.removeRef(req.params.itemId, req.params.refId);
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: string }; Body: { question?: string } }>(
    '/api/projects/:id/code-qa',
    async (req, reply) => {
      if (!projects.get(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      const question = req.body?.question;
      if (typeof question !== 'string' || question.trim().length === 0) {
        return reply.code(400).send({ error: 'question_required' });
      }
      return { result: await service.codeQa(req.params.id, question) };
    },
  );
}
