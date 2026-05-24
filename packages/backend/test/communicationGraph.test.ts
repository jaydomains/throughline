import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type {
  CommunicationGraph,
  CommunicationModel,
  ModulesResult,
} from '@throughline/shared';
import { deriveCommunicationGraph } from '../src/methodology/communication-model/graph.js';
import { startServer, type ServerHandle } from '../src/server.js';
import { makeTmpConfig } from './helpers.js';

const TEST_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'test-bundle', 'bundle.md');
const FREEFORM_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plant(methodologiesDir: string, bundleId: 'test-bundle' | 'freeform'): void {
  const target = join(methodologiesDir, bundleId);
  mkdirSync(target, { recursive: true });
  copyFileSync(bundleId === 'test-bundle' ? TEST_BUNDLE_PATH : FREEFORM_PATH, join(target, 'bundle.md'));
}

// Minimal bundle and modules-result helpers so the pure-function tests stay
// independent of the test-bundle fixture's specifics.
function mkBundle(overrides: Partial<CommunicationModel> = {}): CommunicationModel {
  return {
    status: 'declared',
    edge_types: [],
    tier_routing: [],
    producer_ownership: null,
    ...overrides,
  };
}

function mkModules(refs: string[]): ModulesResult {
  return {
    primary_unit_label: 'component',
    modules: refs.map((ref) => ({
      ref,
      item_count: 1,
      phases: [],
      anchor_count: 0,
      marker_count: 0,
      tier: 'tier-1',
      drift_signal_count: 0,
    })),
  };
}

function mkTiers(assignments: Record<string, { tier: string | null; valid: boolean }>) {
  return assignments;
}

describe('deriveCommunicationGraph — rule-level expansion', () => {
  it('returns an empty graph when the bundle declares no edge types', () => {
    const g = deriveCommunicationGraph({
      bundle: mkBundle(),
      modules: mkModules(['a', 'b']),
      module_tiers: mkTiers({ a: { tier: 'tier-a', valid: true }, b: { tier: 'tier-a', valid: true } }),
    });
    expect(g.edges).toEqual([]);
    expect(g.modules.map((m) => m.ref)).toEqual(['a', 'b']);
    expect(g.producer_owns_shape).toBe(false);
  });

  it('expands an `any`-when edge type over every unordered pair, excluding self-loops', () => {
    const g = deriveCommunicationGraph({
      bundle: mkBundle({
        edge_types: [
          {
            name: 'broadcast',
            when: { kind: 'any' },
            mechanism: { kind: 'direct' },
            contract_source: null,
            invariant: null,
          },
        ],
      }),
      modules: mkModules(['a', 'b', 'c']),
      module_tiers: mkTiers({}),
    });
    // 3 modules → 3 unordered pairs (a-b, a-c, b-c). No self-loops.
    expect(g.edges).toHaveLength(3);
    expect(g.edges.map((e) => e.endpoints)).toEqual([
      ['a', 'b'],
      ['a', 'c'],
      ['b', 'c'],
    ]);
  });

  it('filters pairs by tier when the edge type carries a tier-pair when:', () => {
    const g = deriveCommunicationGraph({
      bundle: mkBundle({
        edge_types: [
          {
            name: 'cross-tier',
            when: { kind: 'pair', a: 'tier-a', b: 'tier-b' },
            mechanism: { kind: 'direct' },
            contract_source: null,
            invariant: null,
          },
        ],
      }),
      modules: mkModules(['x', 'y', 'z']),
      module_tiers: mkTiers({
        x: { tier: 'tier-a', valid: true },
        y: { tier: 'tier-b', valid: true },
        z: { tier: 'tier-b', valid: true },
      }),
    });
    // x-y and x-z match (tier-a <-> tier-b); y-z does not (tier-b <-> tier-b).
    expect(g.edges.map((e) => e.endpoints)).toEqual([
      ['x', 'y'],
      ['x', 'z'],
    ]);
  });

  it('matches same-tier pairs when when: is symmetric (tier-a <-> tier-a)', () => {
    const g = deriveCommunicationGraph({
      bundle: mkBundle({
        edge_types: [
          {
            name: 'intra-a',
            when: { kind: 'pair', a: 'tier-a', b: 'tier-a' },
            mechanism: { kind: 'via', module_id: 'router' },
            contract_source: 'intra-a',
            invariant: 'violation',
          },
        ],
      }),
      modules: mkModules(['a1', 'a2', 'b1']),
      module_tiers: mkTiers({
        a1: { tier: 'tier-a', valid: true },
        a2: { tier: 'tier-a', valid: true },
        b1: { tier: 'tier-b', valid: true },
      }),
    });
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0]?.endpoints).toEqual(['a1', 'a2']);
    expect(g.edges[0]?.mechanism).toEqual({ kind: 'via', module_id: 'router' });
    expect(g.edges[0]?.invariant).toBe('violation');
    expect(g.edges[0]?.contract_source).toBe('intra-a');
  });

  it('excludes modules with null/invalid tier from tier-pair matches but includes them for `any`', () => {
    const g = deriveCommunicationGraph({
      bundle: mkBundle({
        edge_types: [
          {
            name: 'cross',
            when: { kind: 'pair', a: 'tier-a', b: 'tier-b' },
            mechanism: { kind: 'direct' },
            contract_source: null,
            invariant: null,
          },
          {
            name: 'wild',
            when: { kind: 'any' },
            mechanism: { kind: 'direct' },
            contract_source: null,
            invariant: null,
          },
        ],
      }),
      modules: mkModules(['m1', 'm2']),
      module_tiers: mkTiers({
        m1: { tier: 'tier-a', valid: true },
        m2: { tier: null, valid: false }, // unassigned
      }),
    });
    const byType = (t: string) => g.edges.filter((e) => e.edge_type === t);
    expect(byType('cross')).toEqual([]);
    expect(byType('wild')).toHaveLength(1);
  });

  it('treats invalid tier assignments (tier not in §2) as unassigned', () => {
    const g = deriveCommunicationGraph({
      bundle: mkBundle({
        edge_types: [
          {
            name: 'cross',
            when: { kind: 'pair', a: 'tier-a', b: 'tier-b' },
            mechanism: { kind: 'direct' },
            contract_source: null,
            invariant: null,
          },
        ],
      }),
      modules: mkModules(['m']),
      // Assignment present but invalid → resolver still surfaces tier=null per
      // its `valid && tier` guard in derive, so no edges match a tier-pair when:.
      module_tiers: mkTiers({ m: { tier: 'tier-x', valid: false } }),
    });
    expect(g.modules[0]?.tier).toBeNull();
  });

  it('applies a tier-routing override when one endpoint matches', () => {
    const g = deriveCommunicationGraph({
      bundle: mkBundle({
        edge_types: [
          {
            name: 'cross',
            when: { kind: 'pair', a: 'tier-a', b: 'tier-b' },
            mechanism: { kind: 'via', module_id: 'mediator' },
            contract_source: null,
            invariant: null,
          },
        ],
        // tier-b always direct, regardless of the edge-type's `via mediator` default.
        tier_routing: [{ tier: 'tier-b', mechanism: { kind: 'direct' }, note: null }],
      }),
      modules: mkModules(['p', 'q']),
      module_tiers: mkTiers({
        p: { tier: 'tier-a', valid: true },
        q: { tier: 'tier-b', valid: true },
      }),
    });
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0]?.mechanism).toEqual({ kind: 'direct' });
    expect(g.edges[0]?.mechanism_overridden_by_tier).toBe('tier-b');
  });

  it('resolves a tier-routing conflict deterministically (lexicographic precedence)', () => {
    const g = deriveCommunicationGraph({
      bundle: mkBundle({
        edge_types: [
          {
            name: 'cross',
            when: { kind: 'pair', a: 'tier-alpha', b: 'tier-beta' },
            mechanism: { kind: 'via', module_id: 'default-via' },
            contract_source: null,
            invariant: null,
          },
        ],
        tier_routing: [
          { tier: 'tier-alpha', mechanism: { kind: 'via', module_id: 'alpha-via' }, note: null },
          { tier: 'tier-beta', mechanism: { kind: 'direct' }, note: null },
        ],
      }),
      modules: mkModules(['p', 'q']),
      module_tiers: mkTiers({
        p: { tier: 'tier-alpha', valid: true },
        q: { tier: 'tier-beta', valid: true },
      }),
    });
    // 'tier-alpha' < 'tier-beta' lexicographically → alpha's rule wins.
    expect(g.edges[0]?.mechanism).toEqual({ kind: 'via', module_id: 'alpha-via' });
    expect(g.edges[0]?.mechanism_overridden_by_tier).toBe('tier-alpha');
  });

  it('sets producer_owns_shape from the bundle declaration', () => {
    expect(
      deriveCommunicationGraph({
        bundle: mkBundle({ producer_ownership: { rule: 'producer-owns-shape', notes: null } }),
        modules: mkModules([]),
        module_tiers: mkTiers({}),
      }).producer_owns_shape,
    ).toBe(true);
    expect(
      deriveCommunicationGraph({
        bundle: mkBundle({ producer_ownership: null }),
        modules: mkModules([]),
        module_tiers: mkTiers({}),
      }).producer_owns_shape,
    ).toBe(false);
  });

  it('emits modules sorted by ref so edge enumeration is deterministic across runs', () => {
    const g = deriveCommunicationGraph({
      bundle: mkBundle({
        edge_types: [
          {
            name: 'wild',
            when: { kind: 'any' },
            mechanism: { kind: 'direct' },
            contract_source: null,
            invariant: null,
          },
        ],
      }),
      modules: mkModules(['z', 'a', 'm']),
      module_tiers: mkTiers({}),
    });
    expect(g.modules.map((m) => m.ref)).toEqual(['a', 'm', 'z']);
    expect(g.edges.map((e) => e.endpoints)).toEqual([
      ['a', 'm'],
      ['a', 'z'],
      ['m', 'z'],
    ]);
  });
});

describe('GET /api/projects/:id/communication-model/graph — route', () => {
  it('returns the rule-expanded graph over test-bundle with seeded items + tier assignments', async () => {
    const cfg = makeTmpConfig({ port: 0 });
    plant(cfg.methodologiesDir, 'test-bundle');
    const server: ServerHandle = await startServer(cfg, { serveFrontend: false });
    try {
      // Seed a project with two items so we get two modules: 'router' (tier-a) and
      // 'svc' (tier-b). The test-bundle declares two edge types: mediated
      // (tier-a <-> tier-a) and direct-call (tier-a <-> tier-b), plus a tier-b
      // routing override (direct).
      const created = await fetch(`${server.url}/api/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'g', repo_path: '/tmp/g', bundle_id: 'test-bundle' }),
      });
      const { project } = (await created.json()) as { project: { id: string } };

      for (const ref of ['router', 'svc']) {
        await fetch(`${server.url}/api/projects/${project.id}/items`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: ref,
            type: 'task',
            methodology_context: { primary_unit_refs: [ref] },
          }),
        });
      }

      await fetch(`${server.url}/api/projects/${project.id}/communication-model`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contract_sources: {},
          module_tiers: { router: 'tier-a', svc: 'tier-b' },
        }),
      });

      const res = await fetch(`${server.url}/api/projects/${project.id}/communication-model/graph`);
      expect(res.status).toBe(200);
      const graph = (await res.json()) as CommunicationGraph;

      expect(graph.modules.map((m) => m.ref)).toEqual(['router', 'svc']);
      // direct-call (tier-a <-> tier-b) fires once on router/svc.
      // mediated (tier-a <-> tier-a) fires zero times (no tier-a pair).
      const directCall = graph.edges.find((e) => e.edge_type === 'direct-call');
      expect(directCall).toBeDefined();
      expect(directCall?.endpoints).toEqual(['router', 'svc']);
      // tier-b's routing override applies: even though `direct-call` is already
      // direct, the override still credits tier-b for setting the mechanism.
      expect(directCall?.mechanism).toEqual({ kind: 'direct' });
      expect(directCall?.mechanism_overridden_by_tier).toBe('tier-b');

      expect(graph.edges.find((e) => e.edge_type === 'mediated')).toBeUndefined();
      // test-bundle declares producer-owns-shape.
      expect(graph.producer_owns_shape).toBe(true);
    } finally {
      await server.close();
      cfg.cleanup();
    }
  });

  it('freeform project: returns an empty graph (no edges, no modules)', async () => {
    const cfg = makeTmpConfig({ port: 0 });
    plant(cfg.methodologiesDir, 'freeform');
    const server: ServerHandle = await startServer(cfg, { serveFrontend: false });
    try {
      const created = await fetch(`${server.url}/api/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'ff', repo_path: '/tmp/ff' }),
      });
      const { project } = (await created.json()) as { project: { id: string } };

      const res = await fetch(`${server.url}/api/projects/${project.id}/communication-model/graph`);
      expect(res.status).toBe(200);
      const graph = (await res.json()) as CommunicationGraph;
      expect(graph.modules).toEqual([]);
      expect(graph.edges).toEqual([]);
      expect(graph.producer_owns_shape).toBe(false);
    } finally {
      await server.close();
      cfg.cleanup();
    }
  });

  it('GET on an unknown project returns 404', async () => {
    const cfg = makeTmpConfig({ port: 0 });
    plant(cfg.methodologiesDir, 'freeform');
    const server: ServerHandle = await startServer(cfg, { serveFrontend: false });
    try {
      const res = await fetch(`${server.url}/api/projects/does-not-exist/communication-model/graph`);
      expect(res.status).toBe(404);
    } finally {
      await server.close();
      cfg.cleanup();
    }
  });
});

