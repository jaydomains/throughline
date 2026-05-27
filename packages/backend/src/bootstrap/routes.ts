import type { FastifyInstance } from 'fastify';
import {
  BootstrapNoBundleBoundError,
  BootstrapProjectNotFoundError,
  BootstrapValidationFailedError,
  type BootstrapImportService,
  type ConflictResolution,
  type StaleResolution,
} from './service.js';
import type { ProjectsService } from '../projects/service.js';

// C-D20 surface 2 — `POST /api/projects/:id/import` (Slice 3) — accepts the
// bootstrap import file as a JSON body (shape per T-D53), validates it
// against the project's bound methodology bundle, runs the upsert in a
// single SQLite transaction, and returns the per-row classification.
//
// C-D20 surface 5 (Slice 4) — `GET /api/projects/:id/import/conflicts`
// returns the currently-stale rows (the persistent surface; the modal
// surfaces these alongside in-flight conflicts from a just-completed
// import). `POST /api/projects/:id/import/resolve` applies per-row
// resolutions: keep_mine / take_theirs for conflicts; keep / delete for
// stale (archive is deferred — no archive surface in v1).

interface ResolveBody {
  conflicts?: ConflictResolution[];
  stale?: StaleResolution[];
}

export function registerBootstrapRoutes(
  app: FastifyInstance,
  projects: ProjectsService,
  service: BootstrapImportService,
): void {
  app.post<{ Params: { id: string }; Body: unknown }>(
    '/api/projects/:id/import',
    async (req, reply) => {
      if (projects.get(req.params.id) === null) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      try {
        const result = service.importBootstrap(req.params.id, req.body);
        return { result };
      } catch (err) {
        if (err instanceof BootstrapProjectNotFoundError) {
          return reply.code(404).send({ error: 'project_not_found' });
        }
        if (err instanceof BootstrapNoBundleBoundError) {
          return reply.code(400).send({ error: 'no_bundle_bound' });
        }
        if (err instanceof BootstrapValidationFailedError) {
          return reply.code(400).send({ error: 'validation_failed', errors: err.errors });
        }
        throw err;
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/import/conflicts',
    async (req, reply) => {
      if (projects.get(req.params.id) === null) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      try {
        return { result: service.listConflicts(req.params.id) };
      } catch (err) {
        if (err instanceof BootstrapProjectNotFoundError) {
          return reply.code(404).send({ error: 'project_not_found' });
        }
        throw err;
      }
    },
  );

  app.post<{ Params: { id: string }; Body: ResolveBody }>(
    '/api/projects/:id/import/resolve',
    async (req, reply) => {
      if (projects.get(req.params.id) === null) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      const conflicts = Array.isArray(req.body?.conflicts) ? req.body!.conflicts : [];
      const stale = Array.isArray(req.body?.stale) ? req.body!.stale : [];
      try {
        const result = service.resolveConflicts(req.params.id, conflicts, stale);
        return { result };
      } catch (err) {
        if (err instanceof BootstrapProjectNotFoundError) {
          return reply.code(404).send({ error: 'project_not_found' });
        }
        if (err instanceof BootstrapNoBundleBoundError) {
          return reply.code(400).send({ error: 'no_bundle_bound' });
        }
        throw err;
      }
    },
  );
}
