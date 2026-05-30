import type { FastifyInstance } from 'fastify';
import {
  type BootstrapImportService,
  type ConflictResolution,
  type StaleResolution,
} from './service.js';
import {
  renderBootstrapPrompt,
  type BootstrapRenderDeps,
} from './render.js';
import { readBootstrapState, type BootstrapWorkerWithState } from './worker.js';
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
//
// C-D21 surface 2 — `POST /api/projects/:id/bootstrap/render` (Phase 21
// Slice 1) — renders the generic prompt template (T-D55) against the
// project's resolved bundle, prepends the fixed parameter block (bundle file
// path, canonical repo root, declared output path), writes
// `<repo_path>/.throughline/bootstrap-prompt.md`, maintains the
// Throughline-managed `.throughline/.gitignore`, and returns a
// copy-pasteable invocation command for the user's Claude Code session.

interface ResolveBody {
  conflicts?: ConflictResolution[];
  stale?: StaleResolution[];
}

export function registerBootstrapRoutes(
  app: FastifyInstance,
  projects: ProjectsService,
  service: BootstrapImportService,
  render: BootstrapRenderDeps,
  // C-D21 surface 4 — `GET /bootstrap/state` consumes the worker's last-
  // ingest map. Optional so existing tests can omit it (state endpoint
  // returns null `lastIngest` when worker absent — fs-derived fields still
  // populate).
  worker?: BootstrapWorkerWithState,
): void {
  app.post<{ Params: { id: string }; Body: unknown }>(
    '/api/projects/:id/import',
    async (req, reply) => {
      if (projects.get(req.params.id) === null) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      const result = service.importBootstrap(req.params.id, req.body);
      return { result };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/import/conflicts',
    async (req, reply) => {
      if (projects.get(req.params.id) === null) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      return { result: service.listConflicts(req.params.id) };
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
      const result = service.resolveConflicts(req.params.id, conflicts, stale);
      return { result };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/bootstrap/state',
    async (req, reply) => {
      const project = projects.get(req.params.id);
      if (!project) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      if (!project.repo_path) {
        // Project hasn't bound a repo yet (T-D51): bootstrap surface is
        // entirely fs-derived from <repo_path>/.throughline/, so there's
        // nothing to read. Slice 4 surfaces this state as "bind a repo to
        // enable bootstrap" rather than throwing.
        return {
          result: {
            throughlineDir: 'absent' as const,
            promptRendered: false,
            pendingOutput: false,
            lastIngest: null,
            archiveCount: 0,
            quarantineCount: 0,
            promptPath: null,
            outputPath: null,
          },
        };
      }
      const lastIngest = worker?.getLastIngest(req.params.id) ?? null;
      return { result: readBootstrapState(project.repo_path, lastIngest) };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/projects/:id/bootstrap/render',
    async (req) => {
      const result = renderBootstrapPrompt(req.params.id, render);
      return { result };
    },
  );
}
