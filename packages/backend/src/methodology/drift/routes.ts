import type { FastifyInstance } from 'fastify';
import { readDisciplineScan, type DisciplineDriftRescanResult } from '@throughline/shared';
import type { ProjectsService } from '../../projects/service.js';
import type { DriftService } from '../../drift/service.js';
import type { DisciplineDriftEngine, DisciplineDriftTrigger } from './discipline/engine.js';

// Phase 9 — discipline-drift surface (C-D7, SPEC §7.14). Read the category-grouped open
// signals; trigger an explicit user re-scan (the second C-D7 trigger). Both no-op-empty
// for freeform-bound projects (zero declared categories).
//
// Phase 22 / T-D57 — the rescan endpoint additionally drives the per-project
// `discipline_scan_state` lifecycle: `running` before the scan, `complete` +
// `discipline_scan_last_run_at = now` after. The try/finally guarantees the
// state machine self-heals even if `engine.runScan` throws — a stranded
// `running` state would permanently suppress periodic-review for the project.

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
      const projectId = req.params.id;
      if (!projects.get(projectId)) return reply.code(404).send({ error: 'project_not_found' });
      projects.updateSettings(projectId, { discipline_scan_state: 'running' });
      try {
        engine.runScan(projectId, ALL_TRIGGERS);
      } finally {
        projects.updateSettings(projectId, {
          discipline_scan_state: 'complete',
          discipline_scan_last_run_at: new Date().toISOString(),
        });
      }
      const groups = drift.disciplineGroups(projectId).groups;
      const project = projects.get(projectId);
      const { state, last_run_at } = readDisciplineScan(project?.settings_json);
      return {
        groups,
        discipline_scan_state: state ?? 'complete',
        discipline_scan_last_run_at: last_run_at,
      } satisfies DisciplineDriftRescanResult;
    },
  );
}
