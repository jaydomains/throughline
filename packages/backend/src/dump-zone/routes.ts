import type { FastifyInstance } from 'fastify';
import type { ProposalSource, ProposalTarget } from '@throughline/shared';
import {
  ProjectNotFoundError,
  ProposalNotFoundError,
  ProposalStateError,
  type DumpZoneService,
} from './service.js';
import type { ProjectsService } from '../projects/service.js';

const ALLOWED_SOURCES: ProposalSource[] = ['paste', 'voice', 'inbox', 'code_todo'];

interface ProposeBody {
  text?: string;
  target?: ProposalTarget;
  source?: ProposalSource;
  session_id?: string | null;
}

interface ApplyBody {
  proposal_id?: string;
  payload?: unknown;
  decisions?: Record<string, 'keep' | 'discard'>;
}

export function registerDumpZoneRoutes(
  app: FastifyInstance,
  projects: ProjectsService,
  service: DumpZoneService,
): void {
  function requireProject(id: string): boolean {
    return projects.get(id) !== null;
  }

  app.post<{ Params: { id: string }; Body: ProposeBody }>(
    '/api/projects/:id/dump-zone/propose',
    async (req, reply) => {
      if (!requireProject(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      const body = req.body ?? {};
      if (typeof body.text !== 'string' || body.text.length === 0) {
        return reply.code(400).send({ error: 'text_required' });
      }
      if (body.target !== 'session' && body.target !== 'library') {
        return reply.code(400).send({ error: 'invalid_target' });
      }
      const source = body.source ?? 'paste';
      if (!ALLOWED_SOURCES.includes(source)) {
        return reply.code(400).send({ error: 'invalid_source' });
      }
      try {
        const proposal = await service.propose({
          project_id: req.params.id,
          text: body.text,
          target: body.target,
          source,
          session_id: body.session_id ?? null,
        });
        return reply.code(201).send({ proposal });
      } catch (err) {
        if (err instanceof ProjectNotFoundError) return reply.code(404).send({ error: 'project_not_found' });
        throw err;
      }
    },
  );

  app.get<{ Params: { id: string; proposalId: string } }>(
    '/api/projects/:id/dump-zone/proposals/:proposalId',
    async (req, reply) => {
      const proposal = service.get(req.params.proposalId);
      if (!proposal || proposal.project_id !== req.params.id) {
        return reply.code(404).send({ error: 'not_found' });
      }
      return { proposal };
    },
  );

  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/api/projects/:id/dump-zone/proposals',
    async (req, reply) => {
      if (!requireProject(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      const limit = req.query.limit ? Math.max(1, Math.min(200, Number(req.query.limit))) : undefined;
      return { proposals: service.listRecent(req.params.id, limit) };
    },
  );

  app.post<{ Params: { id: string }; Body: ApplyBody }>(
    '/api/projects/:id/dump-zone/apply',
    async (req, reply) => {
      if (!requireProject(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      const body = req.body ?? {};
      if (typeof body.proposal_id !== 'string' || body.proposal_id.length === 0) {
        return reply.code(400).send({ error: 'proposal_id_required' });
      }
      if (typeof body.payload !== 'object' || body.payload === null) {
        return reply.code(400).send({ error: 'payload_required' });
      }
      try {
        const result = service.apply({
          proposal_id: body.proposal_id,
          payload: body.payload as Parameters<DumpZoneService['apply']>[0]['payload'],
          ...(body.decisions ? { decisions: body.decisions } : {}),
        });
        return { result };
      } catch (err) {
        if (err instanceof ProposalNotFoundError) return reply.code(404).send({ error: 'not_found' });
        if (err instanceof ProposalStateError)
          return reply.code(409).send({ error: 'proposal_not_pending', message: err.message });
        if (err instanceof ProjectNotFoundError) return reply.code(404).send({ error: 'project_not_found' });
        throw err;
      }
    },
  );

  app.delete<{ Params: { id: string; proposalId: string } }>(
    '/api/projects/:id/dump-zone/proposals/:proposalId',
    async (req, reply) => {
      const proposal = service.get(req.params.proposalId);
      if (!proposal || proposal.project_id !== req.params.id) {
        return reply.code(404).send({ error: 'not_found' });
      }
      service.discard(req.params.proposalId);
      return reply.code(204).send();
    },
  );
}
