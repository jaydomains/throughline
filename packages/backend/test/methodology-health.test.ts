import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createProjectsService } from '../src/projects/service.js';
import { registerMethodologyRoutes } from '../src/routes/methodologies.js';
import { makeBackend, makeTmpConfig } from './helpers.js';
import type { MethodologyHealthResult } from '@throughline/shared';

const TEST_BUNDLE = join(__dirname, '..', '..', '..', 'methodologies', 'test-bundle', 'bundle.md');
const FREEFORM = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plant(methodologiesDir: string, id: string, src: string): void {
  mkdirSync(join(methodologiesDir, id), { recursive: true });
  copyFileSync(src, join(methodologiesDir, id, 'bundle.md'));
}

async function setup() {
  const cfg = makeTmpConfig();
  plant(cfg.methodologiesDir, 'test-bundle', TEST_BUNDLE);
  plant(cfg.methodologiesDir, 'freeform', FREEFORM);
  const backend = await makeBackend(cfg);
  const projects = createProjectsService(backend.db, backend.registry);
  const app = Fastify();
  registerMethodologyRoutes(app, backend.registry, projects);
  await app.ready();
  return { backend, projects, app, cleanup: async () => { await app.close(); await backend.cleanup(); } };
}

async function health(app: Awaited<ReturnType<typeof setup>>['app'], projectId: string) {
  const res = await app.inject({ method: 'GET', url: `/api/projects/${projectId}/methodology-health` });
  return { status: res.statusCode, body: res.json() as MethodologyHealthResult };
}

describe('GET /api/projects/:id/methodology-health (E6 — SF2-02 / SF2-06, C-D25)', () => {
  it("reports 'healthy' for a project bound to a loaded methodology bundle", async () => {
    const s = await setup();
    try {
      const p = s.projects.create({ name: 'm', repo_path: '/tmp/m', bundle_id: 'test-bundle' });
      const { status, body } = await health(s.app, p.id);
      expect(status).toBe(200);
      expect(body.state).toBe('healthy');
      expect(body.bundle_id).toBe('test-bundle');
    } finally {
      await s.cleanup();
    }
  });

  it("reports 'absent' for a freeform project (loaded, no gates/primary unit) — legit, not a fault", async () => {
    const s = await setup();
    try {
      const p = s.projects.create({ name: 'f', repo_path: '/tmp/f', bundle_id: 'freeform' });
      const { body } = await health(s.app, p.id);
      expect(body.state).toBe('absent');
    } finally {
      await s.cleanup();
    }
  });

  it("reports 'degraded' for a bound-but-broken bundle — the SF2-02 distinction the gate runtime erased", async () => {
    const s = await setup();
    try {
      // Bind a project to a valid bundle (create-time validation requires a loaded
      // bundle), THEN break the bundle.md and reload — the real SF2-02 scenario: a
      // previously-good binding goes bad. Pre-E6 the gate runtime emitted [] firings for
      // this exactly as for a freeform project, so a broken binding looked like a legit
      // no-methodology project. It must now read 'degraded' with the load errors.
      const p = s.projects.create({ name: 'b', repo_path: '/tmp/b', bundle_id: 'test-bundle' });
      expect((await health(s.app, p.id)).body.state).toBe('healthy');

      writeFileSync(
        join(s.backend.config.methodologiesDir, 'test-bundle', 'bundle.md'),
        'this is not a valid bundle — no identity, no sections\n',
      );
      s.backend.registry.reload('test-bundle');

      const { body } = await health(s.app, p.id);
      expect(body.state).toBe('degraded');
      expect(body.bundle_id).toBe('test-bundle');
      expect(body.errors?.length ?? 0).toBeGreaterThan(0);
    } finally {
      await s.cleanup();
    }
  });

  it('404s for an unknown project', async () => {
    const s = await setup();
    try {
      const res = await s.app.inject({
        method: 'GET',
        url: '/api/projects/nope/methodology-health',
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await s.cleanup();
    }
  });
});
