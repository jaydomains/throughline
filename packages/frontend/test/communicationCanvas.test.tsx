import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ModalStackProvider } from '../src/keyboard/modalStack.js';
import type { CommunicationGraph } from '@throughline/shared';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { GraphView } from '../src/views/GraphView.js';
import {
  computeCommunicationLayout,
  DEFAULT_COMM_LAYOUT,
} from '../src/views/graph/communicationLayout.js';
import { computeCommItemsKey, edgeId } from '../src/views/graph/commUtils.js';
import { mockApi, resetMockApi, seedItem } from './fixtures/mockApi.js';
import type { Item } from '@throughline/shared';

function renderGraph() {
  return render(
    <ModalStackProvider>
      <MemoryRouter initialEntries={['/projects/p1/graph']}>
        <Routes>
          <Route path="/projects/:id/graph" element={<GraphView />} />
        </Routes>
      </MemoryRouter>
    </ModalStackProvider>,
  );
}

beforeEach(() => resetMockApi());

describe('communicationLayout — pure swimlane placement', () => {
  it('places modules in lane order: declared tiers first, then unassigned', () => {
    const graph: CommunicationGraph = {
      modules: [
        { ref: 'svc', tier: 'tier-b', item_count: 1 },
        { ref: 'router', tier: 'tier-a', item_count: 1 },
        { ref: 'orphan', tier: null, item_count: 1 },
      ],
      edges: [],
      producer_owns_shape: false,
    };
    const layout = computeCommunicationLayout(graph, ['tier-a', 'tier-b']);
    expect(layout.lanes.map((l) => l.tier)).toEqual(['tier-a', 'tier-b', 'unassigned']);
    expect(layout.modulesById.get('router')?.y).toBeLessThan(
      layout.modulesById.get('svc')?.y ?? Infinity,
    );
    expect(layout.modulesById.get('svc')?.y).toBeLessThan(
      layout.modulesById.get('orphan')?.y ?? Infinity,
    );
  });

  it('skips the unassigned lane when no module is unassigned', () => {
    const graph: CommunicationGraph = {
      modules: [{ ref: 'a', tier: 'tier-a', item_count: 1 }],
      edges: [],
      producer_owns_shape: false,
    };
    const layout = computeCommunicationLayout(graph, ['tier-a', 'tier-b']);
    expect(layout.lanes.map((l) => l.tier)).toEqual(['tier-a', 'tier-b']);
  });

  it('sorts modules within a lane by ref', () => {
    const graph: CommunicationGraph = {
      modules: [
        { ref: 'z', tier: 'tier-a', item_count: 1 },
        { ref: 'a', tier: 'tier-a', item_count: 1 },
        { ref: 'm', tier: 'tier-a', item_count: 1 },
      ],
      edges: [],
      producer_owns_shape: false,
    };
    const layout = computeCommunicationLayout(graph, ['tier-a']);
    // Within the tier-a lane, modules are placed left-to-right by ref.
    const xs = ['a', 'm', 'z'].map((r) => layout.modulesById.get(r)!.x);
    expect(xs).toEqual([...xs].sort((p, q) => p - q));
  });

  it('routes a mediated edge through its mediator when the mediator is in the graph', () => {
    const graph: CommunicationGraph = {
      modules: [
        { ref: 'a', tier: 'tier-a', item_count: 1 },
        { ref: 'router', tier: 'tier-a', item_count: 1 },
        { ref: 'b', tier: 'tier-a', item_count: 1 },
      ],
      edges: [
        {
          edge_type: 'mediated',
          endpoints: ['a', 'b'],
          mechanism: { kind: 'via', module_id: 'router' },
          contract_source: null,
          invariant: null,
          mechanism_overridden_by_tier: null,
        },
      ],
      producer_owns_shape: false,
    };
    const layout = computeCommunicationLayout(graph, ['tier-a']);
    expect(layout.edges[0]?.via?.ref).toBe('router');
    expect(layout.edges[0]?.via_label).toBeNull();
  });

  it('falls back to a via_label badge when the mediator is not in the graph', () => {
    const graph: CommunicationGraph = {
      modules: [
        { ref: 'a', tier: 'tier-a', item_count: 1 },
        { ref: 'b', tier: 'tier-a', item_count: 1 },
      ],
      edges: [
        {
          edge_type: 'mediated',
          endpoints: ['a', 'b'],
          mechanism: { kind: 'via', module_id: 'external-router' },
          contract_source: null,
          invariant: null,
          mechanism_overridden_by_tier: null,
        },
      ],
      producer_owns_shape: false,
    };
    const layout = computeCommunicationLayout(graph, ['tier-a']);
    expect(layout.edges[0]?.via).toBeNull();
    expect(layout.edges[0]?.via_label).toBe('external-router');
  });

  it('grows the canvas height proportional to lane count', () => {
    const graph: CommunicationGraph = {
      modules: [
        { ref: 'a', tier: 'tier-a', item_count: 1 },
        { ref: 'b', tier: 'tier-b', item_count: 1 },
      ],
      edges: [],
      producer_owns_shape: false,
    };
    const layout = computeCommunicationLayout(graph, ['tier-a', 'tier-b']);
    expect(layout.height).toBeGreaterThan(DEFAULT_COMM_LAYOUT.laneHeight);
  });
});

describe('commUtils — shared helpers (Slice 4 fix-round 1)', () => {
  it('edgeId returns the same id for identical (edge_type, endpoints)', () => {
    const id1 = edgeId({
      edge_type: 'mediated',
      endpoints: ['a', 'b'],
      mechanism: { kind: 'direct' },
      contract_source: null,
      invariant: null,
      mechanism_overridden_by_tier: null,
    });
    const id2 = edgeId({
      edge_type: 'mediated',
      endpoints: ['a', 'b'],
      mechanism: { kind: 'via', module_id: 'router' },
      contract_source: 'flows',
      invariant: 'violation',
      mechanism_overridden_by_tier: 'tier-b',
    });
    // Identity is keyed only on edge_type + endpoints, by design.
    expect(id1).toBe(id2);
  });

  function mkItem(id: string, refs: string[]): Item {
    return {
      id,
      project_id: 'p1',
      type: 'task',
      title: id,
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
        primary_unit_refs: refs,
        phase_refs: [],
        anchor_citations: [],
        marker_refs: [],
      },
      methodology_drift: false,
      code_drift_tier: null,
      created_at: '',
      updated_at: '',
    };
  }

  it('computeCommItemsKey produces deterministic output regardless of item order', () => {
    const a = computeCommItemsKey([mkItem('1', ['x']), mkItem('2', ['y'])]);
    const b = computeCommItemsKey([mkItem('2', ['y']), mkItem('1', ['x'])]);
    expect(a).toBe(b);
  });

  it('computeCommItemsKey changes when a new ref appears in the item set', () => {
    const before = computeCommItemsKey([mkItem('1', ['x'])]);
    const after = computeCommItemsKey([mkItem('1', ['x']), mkItem('2', ['y'])]);
    expect(before).not.toBe(after);
  });

  it('computeCommItemsKey changes when item_count for an existing ref changes', () => {
    const before = computeCommItemsKey([mkItem('1', ['x'])]);
    const after = computeCommItemsKey([mkItem('1', ['x']), mkItem('2', ['x'])]);
    // Both reference 'x' → ref set unchanged but count went 1→2; key must differ.
    expect(before).not.toBe(after);
  });

  it('computeCommItemsKey is stable under non-module-affecting item edits (T-D50 coupled-freshness)', () => {
    // Title, status, description, tag edits don't move modules or change counts —
    // so the key shouldn't change, so the comm graph shouldn't refetch.
    const baseline = computeCommItemsKey([mkItem('1', ['router'])]);
    const renamed: Item = { ...mkItem('1', ['router']), title: 'different title' };
    const restatused: Item = { ...mkItem('1', ['router']), status: 'done' };
    const retagged: Item = { ...mkItem('1', ['router']), tags: ['x', 'y'] };
    expect(computeCommItemsKey([renamed])).toBe(baseline);
    expect(computeCommItemsKey([restatused])).toBe(baseline);
    expect(computeCommItemsKey([retagged])).toBe(baseline);
  });

  it('computeCommItemsKey returns an empty string when no items carry primary_unit_refs', () => {
    expect(computeCommItemsKey([])).toBe('');
    expect(computeCommItemsKey([mkItem('1', [])])).toBe('');
  });
});

// Helper to override the mock's communication-graph + view responses for a test.
function mockComm(graph: CommunicationGraph, declared_tiers: string[]) {
  mockApi.getCommunicationGraph.mockImplementation(async () => graph);
  mockApi.getCommunicationModel.mockImplementation(async () => ({
    bundle: {
      status: 'declared',
      edge_types: [],
      tier_routing: [],
      producer_ownership: null,
    },
    contract_sources: {},
    module_tiers: {},
    resolved: {
      contract_sources: {},
      module_tiers: {},
      declared_tiers,
    },
  }));
}

describe('GraphView — communication-model fourth layer', () => {
  it('hides the toggle entirely when the bundle declares no communication model (freeform short-circuit)', async () => {
    // Default mocks return an empty graph + empty declared_tiers. The toggle
    // should not render at all.
    renderGraph();
    await screen.findByTestId('graph-toggle-chains');
    expect(screen.queryByTestId('graph-toggle-comm')).toBeNull();
  });

  it('shows the toggle when the bundle declares tiers, even if there are no modules yet', async () => {
    mockComm({ modules: [], edges: [], producer_owns_shape: false }, ['tier-a']);
    renderGraph();
    expect(await screen.findByTestId('graph-toggle-comm')).toBeInTheDocument();
  });

  it('swaps the canvas to the communication-model graph when toggled, and shows the module-empty hint when there are no modules', async () => {
    mockComm({ modules: [], edges: [], producer_owns_shape: false }, ['tier-a']);
    const user = userEvent.setup();
    renderGraph();
    await user.click(await screen.findByTestId('graph-toggle-comm'));
    expect(await screen.findByTestId('comm-empty')).toBeInTheDocument();
    // The item-graph empty-state shouldn't be showing in comm mode.
    expect(screen.queryByTestId('graph-empty')).toBeNull();
  });

  it('renders modules + edges in comm mode and opens the ModulePanel on click', async () => {
    mockComm(
      {
        modules: [
          { ref: 'router', tier: 'tier-a', item_count: 2 },
          { ref: 'svc', tier: 'tier-b', item_count: 1 },
        ],
        edges: [
          {
            edge_type: 'direct-call',
            endpoints: ['router', 'svc'],
            mechanism: { kind: 'direct' },
            contract_source: null,
            invariant: null,
            mechanism_overridden_by_tier: 'tier-b',
          },
        ],
        producer_owns_shape: true,
      },
      ['tier-a', 'tier-b'],
    );
    // Seed an item too so the toolbar is fully populated (matches what the
    // backend would return after items are created).
    seedItem({ id: 'i1', project_id: 'p1', title: 'i1' });
    const user = userEvent.setup();
    renderGraph();
    await user.click(await screen.findByTestId('graph-toggle-comm'));

    await screen.findByTestId('comm-graph-canvas');
    expect(screen.getByTestId('comm-module-router')).toBeInTheDocument();
    expect(screen.getByTestId('comm-module-svc')).toBeInTheDocument();
    const edge = screen.getByTestId('comm-edge-direct-call:router->svc');
    expect(edge.getAttribute('class') ?? edge.firstElementChild?.getAttribute('class') ?? '').toContain('routed');

    await user.click(screen.getByTestId('comm-module-router'));
    await waitFor(() => expect(screen.getByTestId('module-panel')).toBeInTheDocument());
    expect(screen.getByTestId('module-panel-tier').textContent).toBe('tier-a');
    expect(screen.getByTestId('module-panel-edges')).toBeInTheDocument();
  });

  it('renders mediated edges as two arrows through the mediator module', async () => {
    mockComm(
      {
        modules: [
          { ref: 'a', tier: 'tier-a', item_count: 1 },
          { ref: 'router', tier: 'tier-a', item_count: 1 },
          { ref: 'b', tier: 'tier-a', item_count: 1 },
        ],
        edges: [
          {
            edge_type: 'mediated',
            endpoints: ['a', 'b'],
            mechanism: { kind: 'via', module_id: 'router' },
            contract_source: 'flows',
            invariant: 'violation',
            mechanism_overridden_by_tier: null,
          },
        ],
        producer_owns_shape: false,
      },
      ['tier-a'],
    );
    const user = userEvent.setup();
    renderGraph();
    await user.click(await screen.findByTestId('graph-toggle-comm'));
    const edge = await screen.findByTestId('comm-edge-mediated:a->b');
    expect(edge.getAttribute('data-mediated')).toBe('true');
    // Two child <path> elements — one a→router, one router→b.
    expect(edge.querySelectorAll('path').length).toBe(2);
  });

  it('disables the Show chains toggle while comm mode is active so the two views stay mutually exclusive', async () => {
    mockComm({ modules: [], edges: [], producer_owns_shape: false }, ['tier-a']);
    const user = userEvent.setup();
    renderGraph();
    const chains = await screen.findByTestId('graph-toggle-chains');
    expect(chains).not.toBeDisabled();
    await user.click(await screen.findByTestId('graph-toggle-comm'));
    expect(chains).toBeDisabled();
  });
});
