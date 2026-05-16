import type { FastifyInstance } from 'fastify';
import type { ProjectsService } from '../../projects/service.js';
import {
  ChecklistNotFoundError,
  ProjectNotFoundError,
  RunCompletedError,
  RunNotFoundError,
  StepKindError,
  StepNotFoundError,
  type CompanionEngine,
} from './engine.js';

// Phase 12 — companion review surfaces (SPEC §7.18, C-D8, T-D45). Bundle-declared review
// checklists run as a structured workflow. Empty-but-present for freeform-bound projects
// (no declared checklists) — the UI hides the surface, mirroring the gates view.

function mapError(reply: import('fastify').FastifyReply, err: unknown): unknown {
  if (
    err instanceof ProjectNotFoundError ||
    err instanceof RunNotFoundError ||
    err instanceof StepNotFoundError ||
    err instanceof ChecklistNotFoundError
  ) {
    return reply.code(404).send({ error: 'not_found', message: (err as Error).message });
  }
  if (err instanceof StepKindError || err instanceof RunCompletedError) {
    return reply.code(400).send({ error: 'invalid_request', message: (err as Error).message });
  }
  throw err;
}

export function registerCompanionRoutes(
  app: FastifyInstance,
  projects: ProjectsService,
  engine: CompanionEngine,
): void {
  // Cross-project guard: a run id from project A must not be mutated via project B's
  // path. Returns true when the run belongs to the path's project; otherwise replies 404
  // (same not-found shape used for an unknown run) and returns false. Mirrors the Phase-5
  // cross-project apply guard.
  function ownsRun(
    reply: import('fastify').FastifyReply,
    runId: string,
    projectId: string,
  ): boolean {
    if (engine.runProjectId(runId) === projectId) return true;
    void reply.code(404).send({ error: 'not_found' });
    return false;
  }

  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/companion/checklists',
    async (req, reply) => {
      if (!projects.get(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      return engine.listChecklists(req.params.id);
    },
  );

  app.get<{ Params: { id: string } }>('/api/projects/:id/companion/runs', async (req, reply) => {
    if (!projects.get(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
    return { runs: engine.listRuns(req.params.id) };
  });

  app.post<{
    Params: { id: string };
    Body: { checklist_id?: string; companion_mode?: string | null };
  }>('/api/projects/:id/companion/runs', async (req, reply) => {
    const checklistId = req.body?.checklist_id;
    if (typeof checklistId !== 'string' || checklistId.length === 0) {
      return reply.code(400).send({ error: 'checklist_id_required' });
    }
    try {
      return { run: engine.startRun(req.params.id, checklistId, req.body?.companion_mode ?? null) };
    } catch (err) {
      return mapError(reply, err);
    }
  });

  app.get<{ Params: { id: string; runId: string } }>(
    '/api/projects/:id/companion/runs/:runId',
    async (req, reply) => {
      const run = engine.getRun(req.params.runId);
      if (!run || run.project_id !== req.params.id) {
        return reply.code(404).send({ error: 'not_found' });
      }
      return { run };
    },
  );

  app.post<{ Params: { id: string; runId: string; stepId: string } }>(
    '/api/projects/:id/companion/runs/:runId/steps/:stepId/mechanical',
    async (req, reply) => {
      if (!ownsRun(reply, req.params.runId, req.params.id)) return;
      try {
        return { run: await engine.runMechanicalStep(req.params.runId, req.params.stepId) };
      } catch (err) {
        return mapError(reply, err);
      }
    },
  );

  app.post<{ Params: { id: string; runId: string; stepId: string } }>(
    '/api/projects/:id/companion/runs/:runId/steps/:stepId/ai-judge',
    async (req, reply) => {
      if (!ownsRun(reply, req.params.runId, req.params.id)) return;
      try {
        return { run: await engine.aiJudgeStep(req.params.runId, req.params.stepId) };
      } catch (err) {
        return mapError(reply, err);
      }
    },
  );

  app.post<{
    Params: { id: string; runId: string; stepId: string };
    Body: { decision?: string; rationale?: string };
  }>(
    '/api/projects/:id/companion/runs/:runId/steps/:stepId/judgement',
    async (req, reply) => {
      if (!ownsRun(reply, req.params.runId, req.params.id)) return;
      const decision = req.body?.decision;
      if (decision !== 'pass' && decision !== 'fail' && decision !== 'skip') {
        return reply.code(400).send({ error: 'invalid_decision' });
      }
      const rationale = typeof req.body?.rationale === 'string' ? req.body.rationale : '';
      try {
        return {
          run: engine.resolveJudgementStep(req.params.runId, req.params.stepId, {
            decision,
            rationale,
          }),
        };
      } catch (err) {
        return mapError(reply, err);
      }
    },
  );

  app.post<{
    Params: { id: string; runId: string; stepId: string };
    Body: { reason?: string };
  }>(
    '/api/projects/:id/companion/runs/:runId/steps/:stepId/override',
    async (req, reply) => {
      if (!ownsRun(reply, req.params.runId, req.params.id)) return;
      const reason = req.body?.reason;
      if (typeof reason !== 'string' || reason.trim().length === 0) {
        return reply.code(400).send({ error: 'reason_required' });
      }
      try {
        return {
          run: engine.overrideStep(req.params.runId, req.params.stepId, reason.trim()),
        };
      } catch (err) {
        return mapError(reply, err);
      }
    },
  );

  app.post<{
    Params: { id: string; runId: string };
    Body: { summary?: string; item_ids?: string[] };
  }>('/api/projects/:id/companion/runs/:runId/complete', async (req, reply) => {
    if (!ownsRun(reply, req.params.runId, req.params.id)) return;
    try {
      const completeInput: { summary?: string; itemIds?: string[] } = {
        itemIds: Array.isArray(req.body?.item_ids) ? req.body!.item_ids : [],
      };
      if (typeof req.body?.summary === 'string') completeInput.summary = req.body.summary;
      return { run: engine.completeRun(req.params.runId, completeInput) };
    } catch (err) {
      return mapError(reply, err);
    }
  });
}
