import type { FastifyInstance } from 'fastify';
import type { ProjectsService } from '../../projects/service.js';
import type { DriftService } from '../../drift/service.js';
import type { DisciplineDriftEngine, DisciplineDriftTrigger } from './discipline/engine.js';

// Phase 9 — discipline-drift surface (C-D7, SPEC §7.14). Read the category-grouped open
// signals; trigger an explicit user re-scan (the second C-D7 trigger). Both no-op-empty
// for freeform-bound projects (zero declared categories).

const ALL_TRIGGERS: ReadonlySet<DisciplineDriftTrigger> = new Set([
  'file-change',
  'pre-write',
  'manual',
]);

export interface DisciplineDriftRoutesDeps {
  projects: ProjectsService;
  drift: DriftService;
  engine: DisciplineDriftEngine;
}

export function registerDisciplineDriftRoutes(
  app: FastifyInstance,
  deps: DisciplineDriftRoutesDeps,
): void {
  const { projects, drift, engine } = deps;

  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/discipline-drift',
    async (req, reply) => {
      if (!projects.get(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      return drift.disciplineGroups(req.params.id);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/projects/:id/discipline-drift/rescan',
    async (req, reply) => {
      if (!projects.get(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      engine.runScan(req.params.id, ALL_TRIGGERS);
      return drift.disciplineGroups(req.params.id);
    },
  );
}
