import type { FastifyInstance } from 'fastify';
import {
  RECONCILE_SOURCES,
  type ReconcileApplyRequest,
  type ReconcileSource,
} from '@throughline/shared';
import {
  type ReconcileService,
} from './service.js';
import type { ProjectsService } from '../projects/service.js';

interface ProposeBody {
  text?: string;
  source?: ReconcileSource;
  session_id?: string | null;
}

interface ApplyBody {
  run_id?: string;
  diff?: unknown;
  decisions?: Record<string, 'accept' | 'reject'>;
}

function isReconcileSource(s: unknown): s is ReconcileSource {
  return typeof s === 'string' && (RECONCILE_SOURCES as readonly string[]).includes(s);
}

export function registerReconcileRoutes(
  app: FastifyInstance,
  projects: ProjectsService,
  service: ReconcileService,
): void {
  function requireProject(id: string): boolean {
    return projects.get(id) !== null;
  }

  app.post<{ Params: { id: string }; Body: ProposeBody }>(
    '/api/projects/:id/reconcile/propose',
    async (req, reply) => {
      if (!requireProject(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      const body = req.body ?? {};
      if (typeof body.text !== 'string' || body.text.length === 0) {
        return reply.code(400).send({ error: 'text_required' });
      }
      if (!isReconcileSource(body.source)) {
        return reply.code(400).send({ error: 'invalid_source' });
      }
      const run = await service.propose({
        project_id: req.params.id,
        text: body.text,
        source: body.source,
        session_id: body.session_id ?? null,
      });
      return reply.code(201).send({ run });
    },
  );

  app.get<{ Params: { id: string; runId: string } }>(
    '/api/projects/:id/reconcile/runs/:runId',
    async (req, reply) => {
      const run = service.get(req.params.runId);
      if (!run || run.project_id !== req.params.id) {
        return reply.code(404).send({ error: 'not_found' });
      }
      return { run };
    },
  );

  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/api/projects/:id/reconcile/runs',
    async (req, reply) => {
      if (!requireProject(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      const limit = req.query.limit ? Math.max(1, Math.min(200, Number(req.query.limit))) : undefined;
      return { runs: service.listRecent(req.params.id, limit) };
    },
  );

  app.post<{ Params: { id: string }; Body: ApplyBody }>(
    '/api/projects/:id/reconcile/apply',
    async (req, reply) => {
      if (!requireProject(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      const body = req.body ?? {};
      if (typeof body.run_id !== 'string' || body.run_id.length === 0) {
        return reply.code(400).send({ error: 'run_id_required' });
      }
      if (typeof body.diff !== 'object' || body.diff === null) {
        return reply.code(400).send({ error: 'diff_required' });
      }
      const result = service.apply({
        run_id: body.run_id,
        diff: body.diff as ReconcileApplyRequest['diff'],
        ...(body.decisions ? { decisions: body.decisions } : {}),
      });
      return { result };
    },
  );

  app.delete<{ Params: { id: string; runId: string } }>(
    '/api/projects/:id/reconcile/runs/:runId',
    async (req, reply) => {
      const run = service.get(req.params.runId);
      if (!run || run.project_id !== req.params.id) {
        return reply.code(404).send({ error: 'not_found' });
      }
      service.discard(req.params.runId);
      return reply.code(204).send();
    },
  );
}
