import type { FastifyInstance } from 'fastify';
import type { PhaseMoment } from '@throughline/shared';
import { appendAudit } from '../../audit/log.js';
import type { DB } from '../../db/index.js';
import type { ProjectsService } from '../../projects/service.js';
import type { GateRuntime } from './runtime.js';
import { installGateHooks } from './hook-installer.js';

const MOMENTS: ReadonlySet<string> = new Set([
  'plan-mode',
  'pre-write',
  'per-commit',
  'post-commit',
  'pr-open',
]);

export interface GateRoutesDeps {
  db: DB;
  projects: ProjectsService;
  runtime: GateRuntime;
  runtimeFilePath: string;
  queueDir: string;
}

export function registerGateRoutes(app: FastifyInstance, deps: GateRoutesDeps): void {
  const { db, projects, runtime, runtimeFilePath, queueDir } = deps;

  // Local-loopback gate-trigger channel (SPEC §7.12). Claude Code sends plan-mode /
  // pre-write (best-effort); git hooks send per-commit / post-commit. The server already
  // binds 127.0.0.1 only (T-D31), so the channel is loopback by construction.
  app.post<{
    Body: { moment?: string; project_id?: string; repo_path?: string; head_sha?: string };
  }>('/api/gate-trigger', async (req, reply) => {
    const body = req.body ?? {};
    if (!body.moment || !MOMENTS.has(body.moment)) {
      return reply.code(400).send({ error: 'invalid_moment' });
    }
    const input: Parameters<GateRuntime['dispatch']>[1] = {};
    if (body.project_id) input.projectId = body.project_id;
    if (body.repo_path) input.repoPath = body.repo_path;
    if (body.head_sha) input.headSha = body.head_sha;
    const { firings } = await runtime.dispatch(body.moment as PhaseMoment, input);
    return { ok: true, fired: firings.length };
  });

  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/gate-firings',
    async (req, reply) => {
      if (!projects.get(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      return runtime.listFirings(req.params.id);
    },
  );

  // Fix-and-retry / explicit UI trigger ("Run pre-write checks on this slice", SPEC §7.12).
  app.post<{ Params: { id: string; moment: string } }>(
    '/api/projects/:id/gates/:moment/run',
    async (req, reply) => {
      if (!projects.get(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      if (!MOMENTS.has(req.params.moment)) {
        return reply.code(400).send({ error: 'invalid_moment' });
      }
      const result = await runtime.runMoment(req.params.id, req.params.moment as PhaseMoment);
      return result;
    },
  );

  app.post<{ Params: { id: string; firingId: string }; Body: { reason?: string } }>(
    '/api/projects/:id/gate-firings/:firingId/override',
    async (req, reply) => {
      if (!projects.get(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      const reason = (req.body ?? {}).reason;
      if (typeof reason !== 'string' || reason.trim().length === 0) {
        return reply.code(400).send({ error: 'reason_required' });
      }
      const firing = runtime.override(req.params.id, req.params.firingId, reason.trim());
      if (!firing) return reply.code(404).send({ error: 'firing_not_found' });
      return { firing };
    },
  );

  // Consented, idempotent hook installation (SPEC §7.12). Failure is recorded and
  // non-fatal — only the git-side per-commit/post-commit triggers are unavailable until
  // it succeeds (carve-out under §5 / T-D37).
  app.post<{ Params: { id: string } }>(
    '/api/projects/:id/gates/install-hooks',
    async (req, reply) => {
      const project = projects.get(req.params.id);
      if (!project) return reply.code(404).send({ error: 'project_not_found' });
      const result = installGateHooks({
        repoPath: project.repo_path,
        runtimeFilePath,
        queueDir,
      });
      appendAudit(db, {
        projectId: project.id,
        entityType: 'project',
        entityId: project.id,
        actor: 'user',
        field: 'gate_hooks_install',
        newValue: result.installed ? 'installed' : 'failed',
        triggerContext: { hooks_dir: result.hooksDir ?? null, reason: result.reason ?? null },
      });
      return reply.code(result.installed ? 200 : 422).send(result);
    },
  );
}
