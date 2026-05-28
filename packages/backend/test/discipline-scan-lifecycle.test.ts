import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AnthropicClient } from '../src/ai/anthropic.js';
import type { GitHubApi } from '../src/github/api.js';
import { createProjectsService } from '../src/projects/service.js';
import { createItemsService } from '../src/items/service.js';
import { createSessionsService } from '../src/sessions/service.js';
import { createLibraryService } from '../src/library/service.js';
import { createDriftService } from '../src/drift/service.js';
import { createDisciplineDriftEngine } from '../src/methodology/drift/discipline/engine.js';
import { createOrphanRulesService } from '../src/github/orphan-rules.js';
import { createSettingsService } from '../src/settings/service.js';
import { createPeriodicReviewService } from '../src/intelligence/periodic-review.js';
import { createBootstrapImportService } from '../src/bootstrap/service.js';
import { readDisciplineScan } from '@throughline/shared';
import { registerDisciplineDriftRoutes } from '../src/methodology/drift/routes.js';
import Fastify from 'fastify';
import { makeBackend, makeTmpConfig } from './helpers.js';

// Phase 22 — T-D57 — discipline-drift scan-on-demand lifecycle (SPEC §7.14).
//
// Covers the four backend touch-points landed in this slice:
//   • bootstrap importBootstrap sets `pre-scan` on first ingest (idempotent)
//   • POST /api/projects/:id/discipline-drift/rescan drives running → complete
//     + last_run_at via try/finally (self-heals on scan failure)
//   • periodic-review gate suppresses BOTH discipline-drift sites for projects
//     in pre-scan or running, via one shared condition check
//   • non-bootstrap projects (state absent) retain on-bind behaviour entirely

const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');
const TEST_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'test-bundle', 'bundle.md');

function plantBundle(methodologiesDir: string, id: string, srcPath: string): void {
  const target = join(methodologiesDir, id);
  mkdirSync(target, { recursive: true });
  copyFileSync(srcPath, join(target, 'bundle.md'));
}

function offAnthropic(): AnthropicClient {
  return { available: () => false, call: async () => { throw new Error('off'); } };
}

async function setup() {
  const cfg = makeTmpConfig();
  plantBundle(cfg.methodologiesDir, 'freeform', FREEFORM_BUNDLE_PATH);
  plantBundle(cfg.methodologiesDir, 'test-bundle', TEST_BUNDLE_PATH);
  const backend = await makeBackend(cfg);
  const repoPath = join(cfg.dataDir, 'repo');
  mkdirSync(repoPath, { recursive: true });
  const projects = createProjectsService(backend.db, backend.registry);
  const items = createItemsService(backend.db, projects, backend.registry);
  const sessions = createSessionsService(backend.db, projects);
  const library = createLibraryService(backend.db, projects);
  const drift = createDriftService(backend.db);
  const orphanRules = createOrphanRulesService({
    db: backend.db,
    projects,
    api: {} as unknown as GitHubApi,
  });
  const settings = createSettingsService(backend.db);
  const engine = createDisciplineDriftEngine({
    db: backend.db,
    projects,
    registry: backend.registry,
    drift,
    watch: false,
  });
  const periodicReview = createPeriodicReviewService({
    db: backend.db,
    projects,
    registry: backend.registry,
    drift,
    orphanRules,
    items,
    sessions,
    settings,
    anthropic: offAnthropic(),
  });
  const bootstrap = createBootstrapImportService({
    db: backend.db,
    projects,
    items,
    sessions,
    library,
    registry: backend.registry,
  });
  const project = projects.create({ name: 'p1', repo_path: repoPath });
  return {
    backend, projects, items, sessions, library, drift, engine, periodicReview,
    bootstrap, project, repoPath, cleanup: () => backend.cleanup(),
  };
}

describe('Phase 22 — bootstrap ingest sets discipline_scan_state on first import (T-D57 Q2)', () => {
  it('writes pre-scan on first successful bootstrap import for the project', async () => {
    const s = await setup();
    try {
      // Project starts with no discipline_scan_state set.
      const before = readDisciplineScan(s.projects.get(s.project.id)?.settings_json);
      expect(before.state).toBeUndefined();

      s.bootstrap.importBootstrap(s.project.id, { version: 1, items: [] });

      const after = readDisciplineScan(s.projects.get(s.project.id)?.settings_json);
      expect(after.state).toBe('pre-scan');
      expect(after.last_run_at).toBeNull();
    } finally {
      await s.cleanup();
    }
  });

  it('is idempotent — re-import does NOT overwrite an existing pre-scan state', async () => {
    const s = await setup();
    try {
      s.bootstrap.importBootstrap(s.project.id, { version: 1, items: [] });
      // Mutate the state externally to prove idempotency (re-import would NOT
      // re-flip a project that already ran a manual scan to complete).
      s.projects.updateSettings(s.project.id, {
        discipline_scan_state: 'complete',
        discipline_scan_last_run_at: '2026-05-28T10:00:00.000Z',
      });

      s.bootstrap.importBootstrap(s.project.id, { version: 1, items: [] });

      const after = readDisciplineScan(s.projects.get(s.project.id)?.settings_json);
      expect(after.state).toBe('complete');
      expect(after.last_run_at).toBe('2026-05-28T10:00:00.000Z');
    } finally {
      await s.cleanup();
    }
  });

  it('preserves sibling settings_json fields when writing pre-scan (updateSettings merges, does not replace)', async () => {
    const s = await setup();
    try {
      s.projects.updateSettings(s.project.id, { periodic_review_interval_days: 7 });
      s.bootstrap.importBootstrap(s.project.id, { version: 1, items: [] });

      const project = s.projects.get(s.project.id);
      expect(project?.settings_json.periodic_review_interval_days).toBe(7);
      expect(project?.settings_json.discipline_scan_state).toBe('pre-scan');
    } finally {
      await s.cleanup();
    }
  });

  it('does not write a state on validation failure (failed import leaves no residue)', async () => {
    const s = await setup();
    try {
      // Invalid payload — duplicate bootstrap_id triggers validation failure.
      expect(() =>
        s.bootstrap.importBootstrap(s.project.id, {
          version: 1,
          items: [
            { bootstrap_id: 'dup', source_type: 'roadmap', title: 'A', type: 'task', status: 'open' },
            { bootstrap_id: 'dup', source_type: 'roadmap', title: 'B', type: 'task', status: 'open' },
          ],
        }),
      ).toThrow();

      const after = readDisciplineScan(s.projects.get(s.project.id)?.settings_json);
      expect(after.state).toBeUndefined();
    } finally {
      await s.cleanup();
    }
  });
});

describe('Phase 22 — rescan endpoint drives running → complete (T-D57 Q1 + try/finally)', () => {
  async function withApp<T>(s: Awaited<ReturnType<typeof setup>>, fn: (app: ReturnType<typeof Fastify>) => Promise<T>): Promise<T> {
    const app = Fastify();
    registerDisciplineDriftRoutes(app, {
      projects: s.projects,
      drift: s.drift,
      engine: s.engine,
    });
    try {
      await app.ready();
      return await fn(app);
    } finally {
      await app.close();
    }
  }

  it('transitions pre-scan → running → complete with last_run_at populated', async () => {
    const s = await setup();
    try {
      s.bootstrap.importBootstrap(s.project.id, { version: 1, items: [] });
      expect(readDisciplineScan(s.projects.get(s.project.id)?.settings_json).state).toBe('pre-scan');

      await withApp(s, async (app) => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/projects/${s.project.id}/discipline-drift/rescan`,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as {
          groups: unknown[];
          discipline_scan_state: string;
          discipline_scan_last_run_at: string | null;
        };
        expect(body.discipline_scan_state).toBe('complete');
        expect(body.discipline_scan_last_run_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(Array.isArray(body.groups)).toBe(true);
      });

      const after = readDisciplineScan(s.projects.get(s.project.id)?.settings_json);
      expect(after.state).toBe('complete');
      expect(after.last_run_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    } finally {
      await s.cleanup();
    }
  });

  it('re-rescanning from complete refreshes last_run_at with a fresh timestamp', async () => {
    const s = await setup();
    try {
      s.bootstrap.importBootstrap(s.project.id, { version: 1, items: [] });

      await withApp(s, async (app) => {
        await app.inject({ method: 'POST', url: `/api/projects/${s.project.id}/discipline-drift/rescan` });
      });
      const first = readDisciplineScan(s.projects.get(s.project.id)?.settings_json).last_run_at;
      expect(first).not.toBeNull();

      // 2ms gap is enough for the ISO-8601 millisecond field to advance.
      await new Promise((r) => setTimeout(r, 5));

      await withApp(s, async (app) => {
        await app.inject({ method: 'POST', url: `/api/projects/${s.project.id}/discipline-drift/rescan` });
      });
      const second = readDisciplineScan(s.projects.get(s.project.id)?.settings_json).last_run_at;
      expect(second).not.toBeNull();
      expect(second!).not.toBe(first!);
      expect(new Date(second!).getTime()).toBeGreaterThan(new Date(first!).getTime());
    } finally {
      await s.cleanup();
    }
  });

  it('try/finally self-heals: a scan-engine throw still transitions out of running', async () => {
    const s = await setup();
    try {
      s.bootstrap.importBootstrap(s.project.id, { version: 1, items: [] });

      const thrower = {
        runScan: () => {
          throw new Error('simulated scanner crash');
        },
      };

      const app = Fastify();
      registerDisciplineDriftRoutes(app, {
        projects: s.projects,
        drift: s.drift,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        engine: thrower as any,
      });
      try {
        await app.ready();
        const res = await app.inject({
          method: 'POST',
          url: `/api/projects/${s.project.id}/discipline-drift/rescan`,
        });
        // The throw propagates up as a 500; the state machine must have
        // already self-healed in the finally block before the throw escapes.
        expect(res.statusCode).toBe(500);
      } finally {
        await app.close();
      }

      const after = readDisciplineScan(s.projects.get(s.project.id)?.settings_json);
      // A stranded `running` state would permanently suppress periodic-review
      // for this project. The finally block guarantees recovery.
      expect(after.state).toBe('complete');
      expect(after.last_run_at).not.toBeNull();
    } finally {
      await s.cleanup();
    }
  });

  it('returns 404 without touching state when the project does not exist', async () => {
    const s = await setup();
    try {
      await withApp(s, async (app) => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/projects/does-not-exist/discipline-drift/rescan`,
        });
        expect(res.statusCode).toBe(404);
      });
      // The real project's state is untouched.
      const real = readDisciplineScan(s.projects.get(s.project.id)?.settings_json);
      expect(real.state).toBeUndefined();
    } finally {
      await s.cleanup();
    }
  });
});

describe('Phase 22 — periodic-review gate suppresses both discipline-drift sites (T-D57 Q3)', () => {
  it('non-bootstrap projects must still surface discipline signals (absent state ≡ complete-implicit)', async () => {
    // This is the load-bearing test: the gate condition is written as
    // "suppress when pre-scan or running" — NOT "surface only when complete".
    // If the gate were ever inverted, every existing non-bootstrap project
    // would silently stop surfacing discipline signals. Guard the inversion.
    const s = await setup();
    try {
      // Skip bootstrap entirely so discipline_scan_state stays absent.
      s.drift.createDisciplineSignal({
        projectId: s.project.id,
        category: 'anchor-missing',
        itemId: null,
        primaryUnitRef: null,
        reason: 'no anchor (non-bootstrap project)',
      });

      const result = s.periodicReview.review(s.project.id);
      const discBucket = result.buckets.find((b) => b.category === 'discipline-drift');
      expect(
        discBucket?.count,
        'non-bootstrap projects must still surface discipline signals — gate must be "suppress when pre-scan or running", NOT "surface only when complete"',
      ).toBe(1);
    } finally {
      await s.cleanup();
    }
  });

  it('suppresses discipline-drift signals when project is in pre-scan', async () => {
    const s = await setup();
    try {
      s.drift.createDisciplineSignal({
        projectId: s.project.id,
        category: 'anchor-missing',
        itemId: null,
        primaryUnitRef: null,
        reason: 'pre-scan suppressed',
      });
      s.projects.updateSettings(s.project.id, { discipline_scan_state: 'pre-scan' });

      const result = s.periodicReview.review(s.project.id);
      const disc = result.buckets.find((b) => b.category === 'discipline-drift');
      expect(disc?.count).toBe(0);
    } finally {
      await s.cleanup();
    }
  });

  it('suppresses discipline-drift signals when project is in running (mid-scan)', async () => {
    const s = await setup();
    try {
      s.drift.createDisciplineSignal({
        projectId: s.project.id,
        category: 'anchor-missing',
        itemId: null,
        primaryUnitRef: null,
        reason: 'running suppressed',
      });
      s.projects.updateSettings(s.project.id, { discipline_scan_state: 'running' });

      const result = s.periodicReview.review(s.project.id);
      const disc = result.buckets.find((b) => b.category === 'discipline-drift');
      expect(disc?.count).toBe(0);
    } finally {
      await s.cleanup();
    }
  });

  it('surfaces discipline-drift signals once the project reaches complete', async () => {
    const s = await setup();
    try {
      s.drift.createDisciplineSignal({
        projectId: s.project.id,
        category: 'anchor-missing',
        itemId: null,
        primaryUnitRef: null,
        reason: 'complete shows',
      });
      s.projects.updateSettings(s.project.id, {
        discipline_scan_state: 'complete',
        discipline_scan_last_run_at: new Date().toISOString(),
      });

      const result = s.periodicReview.review(s.project.id);
      const disc = result.buckets.find((b) => b.category === 'discipline-drift');
      expect(disc?.count).toBe(1);
    } finally {
      await s.cleanup();
    }
  });

  it('also suppresses the bundle-declared hygiene categories block under one shared gate', async () => {
    // Phase 22 execution note 2: the periodic-review gate has two suppression
    // sites — drift.listOpenDisciplineSignals AND the bundle-declared hygiene
    // categories block. They wire to ONE shared condition so partial day-one
    // noise cannot leak through one site while being suppressed at the other.
    // The test-bundle declares discipline-drift categories; freeform does not.
    const s = await setup();
    try {
      mkdirSync(s.repoPath, { recursive: true });
      const tbProject = s.projects.create({
        name: 'tb',
        repo_path: join(s.repoPath, '..', 'tb-repo'),
        bundle_id: 'test-bundle',
      });
      // pre-scan → both sites suppressed.
      s.projects.updateSettings(tbProject.id, { discipline_scan_state: 'pre-scan' });
      const pre = s.periodicReview.review(tbProject.id);
      expect(pre.buckets.find((b) => b.category === 'bundle-hygiene')).toBeUndefined();

      // complete → bundle-hygiene block re-surfaces.
      s.projects.updateSettings(tbProject.id, {
        discipline_scan_state: 'complete',
        discipline_scan_last_run_at: new Date().toISOString(),
      });
      const post = s.periodicReview.review(tbProject.id);
      expect(post.buckets.find((b) => b.category === 'bundle-hygiene')).toBeDefined();
    } finally {
      await s.cleanup();
    }
  });
});
