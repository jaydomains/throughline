import type { FastifyInstance } from 'fastify';
import {
  BootstrapNoBundleBoundError,
  BootstrapProjectNotFoundError,
  BootstrapValidationFailedError,
  type BootstrapImportService,
} from './service.js';
import type { ProjectsService } from '../projects/service.js';

// C-D20 surface 2 — `POST /api/projects/:id/import` endpoint. Accepts the
// bootstrap import file as a JSON body (shape per T-D53), validates it
// against the project's bound methodology bundle, runs the upsert in a
// single SQLite transaction, and returns the per-row classification.
//
// Response shape: `{ result: { project_id, rows, counts } }` where rows are
// per-row { bootstrap_id, entity_type, entity_id, status, reason? } and
// counts are { new, reimported, conflict, stale_flagged }. The Slice 4
// review-UI consumes this shape directly; the GET /import/conflicts
// endpoint (Slice 4) returns the conflict + stale subset on demand.

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
}
