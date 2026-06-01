import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createProjectsService } from '../src/projects/service.js';
import { createGithubStateCache } from '../src/github/state-cache.js';
import { createJobHealth } from '../src/health/job-health.js';
import { registerGitHubRoutes } from '../src/github/routes.js';
import { makeBackend, makeTmpConfig } from './helpers.js';
import type { ProjectPrsResult } from '@throughline/shared';

const FREEFORM = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantFreeform(methodologiesDir: string): void {
  const target = join(methodologiesDir, 'freeform');
  mkdirSync(target, { recursive: true });
  copyFileSync(FREEFORM, join(target, 'bundle.md'));
}

async function setup() {
  const cfg = makeTmpConfig();
  plantFreeform(cfg.methodologiesDir);
  const backend = await makeBackend(cfg);
  const projects = createProjectsService(backend.db, backend.registry);
  const cache = createGithubStateCache(backend.db);
  // The same JobHealth instance the github-poller writes to (C-D26) — here we drive it
  // directly to model a healthy / failing background loop without running a real poll.
  const pollerHealth = createJobHealth('github-poller');
  const app = Fastify();
  // Only `projects`, `cache`, and `pollerHealth` are touched by the /github/prs route;
  // the rest of the deps are wired by other routes and never invoked here.
  const stub = {} as never;
  registerGitHubRoutes(app, {
    projects,
    api: stub,
    cache,
    poller: stub,
    drift: stub,
    prLinking: stub,
    orphanRules: stub,
    autoReconcile: stub,
    reverify: stub,
    pollerHealth,
  });
  await app.ready();
  return {
    backend,
    projects,
    cache,
    pollerHealth,
    app,
    cleanup: async () => {
      await app.close();
      await backend.cleanup();
    },
  };
}

async function getPrs(app: Awaited<ReturnType<typeof setup>>['app'], projectId: string) {
  const res = await app.inject({ method: 'GET', url: `/api/projects/${projectId}/github/prs` });
  return { status: res.statusCode, body: res.json() as ProjectPrsResult };
}

describe('GET /api/projects/:id/github/prs — SF6-09 poll-health disclosure (T-D60 / C-D26)', () => {
  it('a configured project with a healthy poller and no PRs reports poll_healthy:true (honest empty)', async () => {
    const s = await setup();
    try {
      const p = s.projects.create({
        name: 'gh',
        repo_path: '/tmp/gh',
        github_owner: 'o',
        github_repo: 'r',
      });
      const { status, body } = await getPrs(s.app, p.id);
      expect(status).toBe(200);
      expect(body.configured).toBe(true);
      expect(body.prs).toEqual([]);
      // The crux of SF6-09: an empty list on a *healthy* poller is a genuine absence.
      expect(body.poll_healthy).toBe(true);
      expect(body.poll_error).toBeNull();
    } finally {
      await s.cleanup();
    }
  });

  it('a failing background poller is disclosed on the wire so an empty list reads as stale, not "none"', async () => {
    const s = await setup();
    try {
      const p = s.projects.create({
        name: 'gh',
        repo_path: '/tmp/gh',
        github_owner: 'o',
        github_repo: 'r',
      });
      // The poller's last tick threw — pre-SF6-09 the route still returned a clean
      // {configured:true, prs:[]} that the UI rendered as "none tracked".
      s.pollerHealth.recordFailure(new Date(), new Error('github 500'));

      const { body } = await getPrs(s.app, p.id);
      expect(body.configured).toBe(true);
      expect(body.poll_healthy).toBe(false);
      expect(body.poll_error).toContain('github 500');

      // A subsequent clean tick recovers the disclosed health.
      s.pollerHealth.recordSuccess(new Date());
      const recovered = await getPrs(s.app, p.id);
      expect(recovered.body.poll_healthy).toBe(true);
      expect(recovered.body.poll_error).toBeNull();
    } finally {
      await s.cleanup();
    }
  });

  it('an unconfigured project reports configured:false with healthy poll (nothing to poll)', async () => {
    const s = await setup();
    try {
      const p = s.projects.create({ name: 'plain', repo_path: '/tmp/plain' });
      // Even with the shared poller marked unhealthy, an unconfigured project has no GitHub
      // surface, so it must not borrow another project's failure signal.
      s.pollerHealth.recordFailure(new Date(), new Error('unrelated'));
      const { body } = await getPrs(s.app, p.id);
      expect(body.configured).toBe(false);
      expect(body.prs).toEqual([]);
      expect(body.poll_healthy).toBe(true);
      expect(body.poll_error).toBeNull();
    } finally {
      await s.cleanup();
    }
  });

  it('404s for an unknown project', async () => {
    const s = await setup();
    try {
      const res = await s.app.inject({ method: 'GET', url: '/api/projects/nope/github/prs' });
      expect(res.statusCode).toBe(404);
    } finally {
      await s.cleanup();
    }
  });
});
