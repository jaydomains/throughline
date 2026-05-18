import { describe, it, expect } from 'vitest';
import type { Item } from '@throughline/shared';
import {
  analyseChains,
  buildGraph,
  computeLayout,
} from '../src/views/graph/layout.js';

function item(p: Partial<Item> & { id: string }): Item {
  return {
    project_id: 'p1',
    type: 'task',
    title: p.id,
    description: '',
    status: 'open',
    blocker_text: null,
    parent_id: null,
    branch_ref: null,
    tags: [],
    blockers: [],
    mentions: [],
    session_ids: [],
    methodology_context: {
      primary_unit_refs: [],
      phase_refs: [],
      anchor_citations: [],
      marker_refs: [],
    },
    methodology_drift: false,
    code_drift_tier: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...p,
  };
}

describe('buildGraph', () => {
  it('produces no edges for isolated items', () => {
    const g = buildGraph([item({ id: 'a' }), item({ id: 'b' })]);
    expect(g.nodes).toHaveLength(2);
    expect(g.edges).toHaveLength(0);
  });

  it('emits a parent edge from parent_id and a blocked edge from blockers', () => {
    const g = buildGraph([
      item({ id: 'root' }),
      item({ id: 'child', parent_id: 'root' }),
      item({ id: 'blocked', blockers: ['root'] }),
    ]);
    const kinds = g.edges.map((e) => `${e.kind}:${e.from}->${e.to}`).sort();
    expect(kinds).toEqual(['blocked:root->blocked', 'parent:root->child']);
  });

  it('ignores parent_id / blockers pointing outside the item set', () => {
    const g = buildGraph([item({ id: 'a', parent_id: 'gone', blockers: ['ghost'] })]);
    expect(g.edges).toHaveLength(0);
  });

  it('layers children below parents (longest-path)', () => {
    const g = buildGraph([
      item({ id: 'a' }),
      item({ id: 'b', parent_id: 'a' }),
      item({ id: 'c', parent_id: 'b' }),
    ]);
    const layer = Object.fromEntries(g.nodes.map((n) => [n.id, n.layer]));
    expect(layer.a).toBe(0);
    expect(layer.b).toBe(1);
    expect(layer.c).toBe(2);
    expect(g.layerCount).toBe(3);
  });

  it('does not hang on a blocker cycle', () => {
    const g = buildGraph([
      item({ id: 'x', blockers: ['y'] }),
      item({ id: 'y', blockers: ['x'] }),
    ]);
    expect(g.nodes).toHaveLength(2);
    expect(g.edges).toHaveLength(2);
  });

  it('is order-independent (stable by created_at then id)', () => {
    const a = item({ id: 'a', created_at: '2026-01-02T00:00:00.000Z' });
    const b = item({ id: 'b', created_at: '2026-01-01T00:00:00.000Z' });
    const g1 = buildGraph([a, b]);
    const g2 = buildGraph([b, a]);
    expect(g1.nodes.map((n) => n.id)).toEqual(g2.nodes.map((n) => n.id));
    expect(g1.nodes.map((n) => n.id)).toEqual(['b', 'a']);
  });
});

describe('analyseChains', () => {
  it('finds the root blocker and the full dependency path', () => {
    // root blocks mid; mid blocks leaf.
    const g = buildGraph([
      item({ id: 'root' }),
      item({ id: 'mid', blockers: ['root'] }),
      item({ id: 'leaf', blockers: ['mid'] }),
      item({ id: 'unrelated' }),
    ]);
    const c = analyseChains(g);
    expect([...c.rootBlockerIds]).toEqual(['root']);
    expect([...c.chainNodeIds].sort()).toEqual(['leaf', 'mid', 'root']);
    expect(c.chainNodeIds.has('unrelated')).toBe(false);
    expect(c.chainEdgeIds.size).toBe(2);
  });

  it('treats parent-child edges as outside the blocker chain', () => {
    const g = buildGraph([
      item({ id: 'p' }),
      item({ id: 'ch', parent_id: 'p' }),
    ]);
    const c = analyseChains(g);
    expect(c.rootBlockerIds.size).toBe(0);
    expect(c.chainNodeIds.size).toBe(0);
  });

  it('a blocker that is itself blocked is not a root blocker', () => {
    const g = buildGraph([
      item({ id: 'top' }),
      item({ id: 'a', blockers: ['top'] }),
      item({ id: 'b', blockers: ['a'] }),
    ]);
    const c = analyseChains(g);
    expect([...c.rootBlockerIds]).toEqual(['top']);
  });
});

describe('computeLayout', () => {
  it('places deeper layers at greater y and centres rows', () => {
    const g = buildGraph([
      item({ id: 'a' }),
      item({ id: 'b', parent_id: 'a' }),
      item({ id: 'c', parent_id: 'a' }),
    ]);
    const l = computeLayout(g);
    const a = l.byId.get('a')!;
    const b = l.byId.get('b')!;
    const c = l.byId.get('c')!;
    expect(a.y).toBeLessThan(b.y);
    expect(b.y).toBe(c.y);
    expect(b.x).not.toBe(c.x);
    // single node layer (a) is centred over the two-wide layer
    expect(a.x).toBeGreaterThan(Math.min(b.x, c.x));
    expect(l.width).toBeGreaterThan(0);
    expect(l.height).toBeGreaterThan(0);
  });
});
