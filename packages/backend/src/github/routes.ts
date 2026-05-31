import type { FastifyInstance } from 'fastify';
import type { ProjectPrsResult } from '@throughline/shared';
import type { ProjectsService } from '../projects/service.js';
import type { JobHealth } from '../health/job-health.js';
import type { DriftService } from '../drift/service.js';
import type { GitHubApi } from './api.js';
import type { GithubStateCache } from './state-cache.js';
import type { GitHubPoller } from './poller.js';
import type { PrLinkingService } from './pr-linking.js';
import type { OrphanRulesService } from './orphan-rules.js';
import type { AutoReconcileService } from './auto-reconcile.js';
import { UndoError } from './auto-reconcile.js';
import type { DriftReverifyService } from './reverify.js';

// Phase 10 surface (C-D16; SPEC §7.13/7.14/7.16). All project-scoped; everything degrades
// to an empty/!configured response when github_owner/github_repo or the PAT is absent.

export interface GitHubRoutesDeps {
  projects: ProjectsService;
  api: GitHubApi;
  cache: GithubStateCache;
  poller: GitHubPoller;
  drift: DriftService;
  prLinking: PrLinkingService;
  orphanRules: OrphanRulesService;
  autoReconcile: AutoReconcileService;
  reverify: DriftReverifyService;
  // SF6-09 — the github-poller's health tracker (C-D26), so the PR-list response can disclose
  // when the cache it serves is stale because the background poller is failing.
  pollerHealth: JobHealth;
}

export function registerGitHubRoutes(app: FastifyInstance, deps: GitHubRoutesDeps): void {
  const { projects, cache, poller, drift, prLinking, orphanRules, autoReconcile, reverify, pollerHealth } =
    deps;

  function project(id: string) {
    return projects.get(id);
  }
  function configured(id: string): boolean {
    const p = project(id);
    return !!p && !!p.github_owner && !!p.github_repo;
  }

  // SF6-09 — read the github-poller's health (C-D26) for the PR-list response. When the
  // project is unconfigured there is nothing to poll, so health is reported as healthy/null.
  //
  // The signal is deliberately per-*loop*, not per-project: C-D26 models one `JobHealth`
  // per background loop, and there is a single `github-poller` tick that polls every
  // configured project sequentially (poller.ts — `for (const project of projects.list())`,
  // each `pollProject` recording success/failure on this one tracker). So a failing poll
  // flips the shared signal for all configured projects — which is the honest fact: a broken
  // loop leaves *every* project's cached PR data stale, and the last error is representative
  // of the loop's state. Per-project health would misreport a healthy project whose data is
  // equally stale because the shared loop is down.
  function pollHealthFields(isConfigured: boolean): { poll_healthy: boolean; poll_error: string | null } {
    if (!isConfigured) return { poll_healthy: true, poll_error: null };
    const h = pollerHealth.snapshot();
    return { poll_healthy: h.healthy, poll_error: h.last_error };
  }

  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/github/prs',
    async (req, reply) => {
      const p = project(req.params.id);
      if (!p) return reply.code(404).send({ error: 'project_not_found' });
      if (!p.github_owner || !p.github_repo) {
        return { configured: false, prs: [], ...pollHealthFields(false) } satisfies ProjectPrsResult;
      }
      const repo = `${p.github_owner}/${p.github_repo}`;
      return {
        configured: true,
        prs: cache.listSnapshots(repo).map((s) => ({
          pr_number: s.pr_number,
          repo: s.repo,
          state: s.state,
          url: s.url,
          title: s.title,
          activity_at: s.activity_at,
        })),
        ...pollHealthFields(true),
      } satisfies ProjectPrsResult;
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/projects/:id/github/refresh',
    async (req, reply) => {
      if (!project(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      const prs = await poller.pollProject(req.params.id);
      const isConfigured = configured(req.params.id);
      return { configured: isConfigured, prs, ...pollHealthFields(isConfigured) } satisfies ProjectPrsResult;
    },
  );

  // --- Manual item-to-PR linking (T-D34) ---

  app.get<{ Params: { id: string; itemId: string } }>(
    '/api/projects/:id/items/:itemId/pr-link/detect',
    async (req, reply) => {
      if (!project(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      return await prLinking.detect(req.params.itemId);
    },
  );

  app.post<{
    Params: { id: string; itemId: string };
    Body: { pr_number?: number; auto_detected?: boolean };
  }>('/api/projects/:id/items/:itemId/pr-link', async (req, reply) => {
    if (!project(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
    const prNumber = req.body?.pr_number;
    if (typeof prNumber !== 'number' || !Number.isInteger(prNumber) || prNumber <= 0) {
      return reply.code(400).send({ error: 'pr_number_required' });
    }
    return prLinking.set(req.params.itemId, prNumber, req.body?.auto_detected === true);
  });

  app.delete<{ Params: { id: string; itemId: string } }>(
    '/api/projects/:id/items/:itemId/pr-link',
    async (req, reply) => {
      if (!project(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      prLinking.unset(req.params.itemId);
      return reply.code(204).send();
    },
  );

  // --- Drift inbox + per-signal actions (T-D21; SPEC §7.14) ---

  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/drift/inbox',
    async (req, reply) => {
      if (!project(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      return drift.inbox(req.params.id);
    },
  );

  app.post<{ Params: { id: string; sid: string }; Body: { reason?: string } }>(
    '/api/projects/:id/drift/signals/:sid/dismiss',
    async (req, reply) => {
      if (!project(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      drift.dismissSignal(req.params.sid, req.body?.reason?.slice(0, 280) || 'user dismissed');
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string; sid: string } }>(
    '/api/projects/:id/drift/signals/:sid/reopen',
    async (req, reply) => {
      if (!project(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      drift.reopenSignal(req.params.sid);
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string; sid: string } }>(
    '/api/projects/:id/drift/signals/:sid/reverify',
    async (req, reply) => {
      if (!project(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      return await reverify.reverify(req.params.id, req.params.sid);
    },
  );

  // --- Orphaned verifier rules (T-D33) ---

  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/orphan-rules',
    async (req, reply) => {
      if (!project(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      return { rules: orphanRules.list(req.params.id) };
    },
  );

  app.post<{ Params: { id: string; rid: string } }>(
    '/api/projects/:id/orphan-rules/:rid/dismiss',
    async (req, reply) => {
      if (!project(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      orphanRules.dismiss(req.params.rid);
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string; rid: string } }>(
    '/api/projects/:id/orphan-rules/:rid/cleanup-pr',
    async (req, reply) => {
      if (!project(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      return await orphanRules.draftCleanupPr(req.params.rid);
    },
  );

  // --- Auto-reconcile (T-D6/T-D18) ---

  app.post<{ Params: { id: string }; Body: { token?: string } }>(
    '/api/projects/:id/github/auto-reconcile/undo',
    async (req, reply) => {
      if (!project(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      if (!req.body?.token) return reply.code(400).send({ error: 'token_required' });
      try {
        autoReconcile.undo(req.body.token);
        return { ok: true };
      } catch (e) {
        if (e instanceof UndoError) return reply.code(409).send({ error: 'undo_unavailable' });
        throw e;
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { run_id?: string } }>(
    '/api/projects/:id/github/auto-reconcile/approve',
    async (req, reply) => {
      if (!project(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      if (!req.body?.run_id) return reply.code(400).send({ error: 'run_id_required' });
      try {
        autoReconcile.approve(req.params.id, req.body.run_id);
        return { ok: true };
      } catch (e) {
        if (e instanceof UndoError) return reply.code(404).send({ error: 'run_not_found' });
        throw e;
      }
    },
  );
}
