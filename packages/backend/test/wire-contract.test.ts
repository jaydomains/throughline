import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import type {
  ItemsResponse,
  ItemResponse,
  PolicyResponse,
  SessionsResponse,
  SessionResponse,
  MethodologiesResponse,
} from '@throughline/shared';
import { createProjectsService } from '../src/projects/service.js';
import { createItemsService } from '../src/items/service.js';
import { createSessionsService } from '../src/sessions/service.js';
import { registerItemRoutes } from '../src/items/routes.js';
import { registerSessionRoutes } from '../src/sessions/routes.js';
import { registerMethodologyRoutes } from '../src/routes/methodologies.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

// Wire-contract test (T-D59, closes audit-1 I1 Gap 2). The backend route handlers are
// annotated against the @throughline/shared response envelopes, so `tsc` already proves
// the *declared* shapes match. This test proves the *runtime* payloads do too: it injects
// each core read endpoint, parses the JSON, assigns it to the shared response type (a
// compile-time assignability check on real wire bytes), and asserts the structural shape.
// If a handler ever drifts from its shared contract, this fails instead of the frontend
// silently casting a wrong payload with `as T`.

const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

async function setup() {
  const cfg = makeTmpConfig();
  const target = join(cfg.methodologiesDir, 'freeform');
  mkdirSync(target, { recursive: true });
  copyFileSync(FREEFORM_BUNDLE_PATH, join(target, 'bundle.md'));
  const backend = await makeBackend(cfg);
  const repoPath = join(cfg.dataDir, 'repo');
  mkdirSync(repoPath, { recursive: true });
  const projects = createProjectsService(backend.db, backend.registry);
  const items = createItemsService(backend.db, projects, backend.registry);
  const sessions = createSessionsService(backend.db, projects);

  const app = Fastify();
  registerMethodologyRoutes(app, backend.registry, projects);
  registerItemRoutes(app, projects, items);
  registerSessionRoutes(app, projects, sessions);
  await app.ready();

  const project = projects.create({ name: 'p1', repo_path: repoPath });
  const session = sessions.create({ project_id: project.id, name: 'wave 1' });
  const item = items.create({ project_id: project.id, title: 'first' });

  return {
    app,
    projectId: project.id,
    sessionId: session.id,
    itemId: item.id,
    cleanup: async () => {
      await app.close();
      await backend.cleanup();
    },
  };
}

async function getJson(app: FastifyInstance, url: string): Promise<unknown> {
  const res = await app.inject({ method: 'GET', url });
  expect(res.statusCode).toBe(200);
  return res.json();
}

describe('wire contract — backend responses match @throughline/shared envelopes (T-D59)', () => {
  it('GET /api/methodologies → MethodologiesResponse', async () => {
    const s = await setup();
    try {
      const body = (await getJson(s.app, '/api/methodologies')) as MethodologiesResponse;
      expect(Array.isArray(body.methodologies)).toBe(true);
      for (const m of body.methodologies) {
        expect(m.status === 'loaded' || m.status === 'error').toBe(true);
        expect(typeof m.bundle_id).toBe('string');
      }
    } finally {
      await s.cleanup();
    }
  });

  it('GET /api/projects/:id/items → ItemsResponse', async () => {
    const s = await setup();
    try {
      const body = (await getJson(s.app, `/api/projects/${s.projectId}/items`)) as ItemsResponse;
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items[0]?.id).toBe(s.itemId);
      expect(typeof body.items[0]?.title).toBe('string');
    } finally {
      await s.cleanup();
    }
  });

  it('GET /api/projects/:id/items/:itemId → ItemResponse', async () => {
    const s = await setup();
    try {
      const body = (await getJson(
        s.app,
        `/api/projects/${s.projectId}/items/${s.itemId}`,
      )) as ItemResponse;
      expect(body.item.id).toBe(s.itemId);
      expect(body.item.project_id).toBe(s.projectId);
    } finally {
      await s.cleanup();
    }
  });

  it('GET /api/projects/:id/policy → PolicyResponse', async () => {
    const s = await setup();
    try {
      const body = (await getJson(s.app, `/api/projects/${s.projectId}/policy`)) as PolicyResponse;
      expect(Array.isArray(body.policy.statuses)).toBe(true);
      expect(Array.isArray(body.policy.boards)).toBe(true);
    } finally {
      await s.cleanup();
    }
  });

  it('GET /api/projects/:id/sessions → SessionsResponse', async () => {
    const s = await setup();
    try {
      const body = (await getJson(
        s.app,
        `/api/projects/${s.projectId}/sessions`,
      )) as SessionsResponse;
      expect(Array.isArray(body.sessions)).toBe(true);
      expect(body.sessions[0]?.id).toBe(s.sessionId);
    } finally {
      await s.cleanup();
    }
  });

  it('GET /api/projects/:id/sessions/:sessionId → SessionResponse', async () => {
    const s = await setup();
    try {
      const body = (await getJson(
        s.app,
        `/api/projects/${s.projectId}/sessions/${s.sessionId}`,
      )) as SessionResponse;
      expect(body.session.id).toBe(s.sessionId);
      expect(body.session.name).toBe('wave 1');
    } finally {
      await s.cleanup();
    }
  });
});
