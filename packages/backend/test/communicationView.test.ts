import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createItemsService } from '../src/items/service.js';
import { createProjectsService } from '../src/projects/service.js';
import {
  readCommunicationSettings,
  resolveCommunicationView,
} from '../src/methodology/communication-model/view.js';
import { startServer, type ServerHandle } from '../src/server.js';
import { makeBackend, makeTmpConfig } from './helpers.js';
import type { CommunicationModelView } from '@throughline/shared';

const TEST_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'test-bundle', 'bundle.md');
const FREEFORM_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plant(methodologiesDir: string, bundleId: 'test-bundle' | 'freeform'): void {
  const target = join(methodologiesDir, bundleId);
  mkdirSync(target, { recursive: true });
  copyFileSync(bundleId === 'test-bundle' ? TEST_BUNDLE_PATH : FREEFORM_PATH, join(target, 'bundle.md'));
}

async function setupWithTestBundle() {
  const cfg = makeTmpConfig();
  plant(cfg.methodologiesDir, 'test-bundle');
  const backend = await makeBackend(cfg);
  const projects = createProjectsService(backend.db, backend.registry);
  const items = createItemsService(backend.db, projects, backend.registry);
  const project = projects.create({
    name: 'cm',
    repo_path: '/tmp/cm-repo',
    bundle_id: 'test-bundle',
  });
  return { backend, projects, items, project };
}

describe('resolveCommunicationView — pure resolver (no FS, no validation)', () => {
  it('returns the bundle plus an empty resolved block when the project has no settings', () => {
    const view = resolveCommunicationView({
      bundle: {
        status: 'declared',
        edge_types: [
          {
            name: 'mediated',
            when: { kind: 'pair', a: 'tier-a', b: 'tier-a' },
            mechanism: { kind: 'via', module_id: 'router' },
            contract_source: 'tier-a-flows',
            invariant: 'violation',
          },
          {
            name: 'direct-call',
            when: { kind: 'pair', a: 'tier-a', b: 'tier-b' },
            mechanism: { kind: 'direct' },
            contract_source: null,
            invariant: null,
          },
        ],
        tier_routing: [],
        producer_ownership: null,
      },
      declared_tiers: ['tier-a', 'tier-b'],
      modules: { primary_unit_label: 'component', modules: [] },
      repo_path: '/tmp/repo',
      settings: undefined,
    });
    expect(view.bundle.edge_types).toHaveLength(2);
    // Only edge types whose §6 declaration includes `contract_source:` show up in resolved (confirmation 5).
    expect(Object.keys(view.resolved.contract_sources)).toEqual(['mediated']);
    expect(view.resolved.contract_sources['mediated']).toEqual({
      absolute_path: '',
      configured: false,
    });
    expect(view.resolved.module_tiers).toEqual({});
    expect(view.resolved.declared_tiers).toEqual(['tier-a', 'tier-b']);
  });

  it('resolves relative paths against the project repo_path and passes absolute paths through', () => {
    const view = resolveCommunicationView({
      bundle: {
        status: 'declared',
        edge_types: [
          {
            name: 'mediated',
            when: { kind: 'any' },
            mechanism: { kind: 'direct' },
            contract_source: 'mediated',
            invariant: null,
          },
          {
            name: 'absolute-cs',
            when: { kind: 'any' },
            mechanism: { kind: 'direct' },
            contract_source: 'absolute-cs',
            invariant: null,
          },
        ],
        tier_routing: [],
        producer_ownership: null,
      },
      declared_tiers: [],
      modules: { primary_unit_label: 'component', modules: [] },
      repo_path: '/tmp/cm-repo',
      settings: {
        contract_sources: {
          mediated: 'docs/contracts/router',
          'absolute-cs': '/var/data/contracts',
        },
      },
    });
    expect(view.resolved.contract_sources['mediated']).toEqual({
      absolute_path: '/tmp/cm-repo/docs/contracts/router',
      configured: true,
    });
    expect(view.resolved.contract_sources['absolute-cs']).toEqual({
      absolute_path: '/var/data/contracts',
      configured: true,
    });
  });

  it('reports module-tier validity: assigned-and-valid, assigned-but-not-in-tiers, unassigned', () => {
    const view = resolveCommunicationView({
      bundle: {
        status: 'declared',
        edge_types: [],
        tier_routing: [],
        producer_ownership: null,
      },
      declared_tiers: ['tier-a', 'tier-b'],
      modules: {
        primary_unit_label: 'component',
        modules: [
          { ref: 'mod-a', item_count: 1, phases: [], anchor_count: 0, marker_count: 0, tier: 'tier-1', drift_signal_count: 0 },
          { ref: 'mod-b', item_count: 1, phases: [], anchor_count: 0, marker_count: 0, tier: 'tier-1', drift_signal_count: 0 },
          { ref: 'mod-c', item_count: 1, phases: [], anchor_count: 0, marker_count: 0, tier: 'tier-1', drift_signal_count: 0 },
        ],
      },
      repo_path: '/tmp',
      settings: {
        module_tiers: { 'mod-a': 'tier-a', 'mod-b': 'tier-x' },
      },
    });
    expect(view.resolved.module_tiers['mod-a']).toEqual({ tier: 'tier-a', valid: true });
    expect(view.resolved.module_tiers['mod-b']).toEqual({ tier: 'tier-x', valid: false });
    expect(view.resolved.module_tiers['mod-c']).toEqual({ tier: null, valid: false });
  });
});

describe('readCommunicationSettings — settings_json reader', () => {
  it('returns undefined when the key is absent', () => {
    expect(readCommunicationSettings({})).toBeUndefined();
  });

  it('extracts both maps when present, ignoring non-string values', () => {
    const r = readCommunicationSettings({
      communication_model: {
        contract_sources: { a: 'p1', b: 2, c: 'p2' },
        module_tiers: { m1: 'tier-a' },
      },
      other_key: 'irrelevant',
    });
    expect(r).toEqual({
      contract_sources: { a: 'p1', c: 'p2' },
      module_tiers: { m1: 'tier-a' },
    });
  });

  it('returns undefined when the value is not a plain object', () => {
    expect(readCommunicationSettings({ communication_model: [] as unknown[] as unknown as Record<string, unknown> })).toBeUndefined();
    expect(readCommunicationSettings({ communication_model: 'whoops' as unknown as Record<string, unknown> })).toBeUndefined();
  });
});

describe('communication-model view — end-to-end with test-bundle', () => {
  it('test-bundle project surfaces the mediated edge type as configurable but unconfigured', async () => {
    const { backend, project, items } = await setupWithTestBundle();
    try {
      const loaded = backend.registry.resolveBundle('test-bundle', null);
      if (loaded.status !== 'loaded') throw new Error('test-bundle did not load');
      const view = resolveCommunicationView({
        bundle: loaded.bundle.communication_model,
        declared_tiers: loaded.bundle.project_layout.tiers,
        modules: items.modules(project.id),
        repo_path: project.repo_path,
        settings: undefined,
      });
      // 'mediated' has contract_source: 'tier-a-flows'; 'direct-call' has none. Only 'mediated' surfaces.
      expect(Object.keys(view.resolved.contract_sources)).toEqual(['mediated']);
      expect(view.resolved.contract_sources['mediated']?.configured).toBe(false);
      // No items yet → no modules to assign tiers to.
      expect(Object.keys(view.resolved.module_tiers)).toEqual([]);
      expect(view.resolved.declared_tiers).toEqual(['tier-a', 'tier-b']);
    } finally {
      await backend.cleanup();
    }
  });

  it('test-bundle project with items reports the discovered modules in resolved.module_tiers', async () => {
    const { backend, project, items } = await setupWithTestBundle();
    try {
      items.create({
        project_id: project.id,
        title: 't',
        type: 'task',
        methodology_context: { primary_unit_refs: ['router'] },
      });
      items.create({
        project_id: project.id,
        title: 'u',
        type: 'task',
        methodology_context: { primary_unit_refs: ['service-x'] },
      });
      const modules = items.modules(project.id);
      const loaded = backend.registry.resolveBundle('test-bundle', null);
      if (loaded.status !== 'loaded') throw new Error('bundle did not load');
      const view = resolveCommunicationView({
        bundle: loaded.bundle.communication_model,
        declared_tiers: loaded.bundle.project_layout.tiers,
        modules,
        repo_path: project.repo_path,
        settings: { module_tiers: { router: 'tier-a' } },
      });
      expect(view.resolved.module_tiers['router']).toEqual({ tier: 'tier-a', valid: true });
      expect(view.resolved.module_tiers['service-x']).toEqual({ tier: null, valid: false });
    } finally {
      await backend.cleanup();
    }
  });

  it('GET /api/projects/:id/communication-model returns the view (route-level)', async () => {
    const cfg = makeTmpConfig({ port: 0 });
    plant(cfg.methodologiesDir, 'test-bundle');
    const server: ServerHandle = await startServer(cfg, { serveFrontend: false });
    try {
      const created = await fetch(`${server.url}/api/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'route-cm', repo_path: '/tmp/route-cm', bundle_id: 'test-bundle' }),
      });
      expect(created.status).toBe(201);
      const { project } = (await created.json()) as { project: { id: string } };

      const res = await fetch(`${server.url}/api/projects/${project.id}/communication-model`);
      expect(res.status).toBe(200);
      const view = (await res.json()) as CommunicationModelView;
      expect(view.bundle.status).toBe('declared');
      expect(view.bundle.edge_types.map((e) => e.name)).toEqual(['mediated', 'direct-call']);
      expect(Object.keys(view.resolved.contract_sources)).toEqual(['mediated']);
      expect(view.resolved.declared_tiers).toEqual(['tier-a', 'tier-b']);
    } finally {
      await server.close();
      cfg.cleanup();
    }
  });

  it('PUT /api/projects/:id/communication-model replaces the settings block and round-trips', async () => {
    const cfg = makeTmpConfig({ port: 0 });
    plant(cfg.methodologiesDir, 'test-bundle');
    const server: ServerHandle = await startServer(cfg, { serveFrontend: false });
    try {
      const created = await fetch(`${server.url}/api/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'r2', repo_path: '/tmp/r2', bundle_id: 'test-bundle' }),
      });
      const { project } = (await created.json()) as { project: { id: string } };

      // Seed one item so the project has a module to assign.
      await fetch(`${server.url}/api/projects/${project.id}/items`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 't',
          type: 'task',
          methodology_context: { primary_unit_refs: ['router'] },
        }),
      });

      const put = await fetch(`${server.url}/api/projects/${project.id}/communication-model`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contract_sources: { mediated: 'docs/contracts/router' },
          module_tiers: { router: 'tier-a' },
        }),
      });
      expect(put.status).toBe(200);

      const after = await fetch(`${server.url}/api/projects/${project.id}/communication-model`);
      const view = (await after.json()) as CommunicationModelView;
      expect(view.contract_sources).toEqual({ mediated: 'docs/contracts/router' });
      expect(view.module_tiers).toEqual({ router: 'tier-a' });
      expect(view.resolved.contract_sources['mediated']).toEqual({
        absolute_path: '/tmp/r2/docs/contracts/router',
        configured: true,
      });
      expect(view.resolved.module_tiers['router']).toEqual({ tier: 'tier-a', valid: true });
    } finally {
      await server.close();
      cfg.cleanup();
    }
  });

  it('GET on an unknown project returns 404', async () => {
    const cfg = makeTmpConfig({ port: 0 });
    plant(cfg.methodologiesDir, 'test-bundle');
    const server: ServerHandle = await startServer(cfg, { serveFrontend: false });
    try {
      const res = await fetch(`${server.url}/api/projects/does-not-exist/communication-model`);
      expect(res.status).toBe(404);
    } finally {
      await server.close();
      cfg.cleanup();
    }
  });

  it('freeform project: bundle.status === "none" and resolved blocks are empty', async () => {
    const cfg = makeTmpConfig();
    plant(cfg.methodologiesDir, 'freeform');
    const backend = await makeBackend(cfg);
    try {
      const projects = createProjectsService(backend.db, backend.registry);
      const items = createItemsService(backend.db, projects, backend.registry);
      const project = projects.create({ name: 'ff', repo_path: '/tmp/ff' });
      const loaded = backend.registry.resolveBundle('freeform', null);
      if (loaded.status !== 'loaded') throw new Error('freeform did not load');
      const view = resolveCommunicationView({
        bundle: loaded.bundle.communication_model,
        declared_tiers: loaded.bundle.project_layout.tiers,
        modules: items.modules(project.id),
        repo_path: project.repo_path,
        settings: undefined,
      });
      expect(view.bundle.status).toBe('none');
      expect(view.resolved.contract_sources).toEqual({});
      expect(view.resolved.module_tiers).toEqual({});
      expect(view.resolved.declared_tiers).toEqual([]);
    } finally {
      await backend.cleanup();
    }
  });
});
