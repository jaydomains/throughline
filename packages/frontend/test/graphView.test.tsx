import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ModalStackProvider } from '../src/keyboard/modalStack.js';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { GraphView } from '../src/views/GraphView.js';
import { resetMockApi, seedItem } from './fixtures/mockApi.js';

function renderGraph() {
  return render(
    <ModalStackProvider>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/projects/p1/graph']}>
        <Routes>
          <Route path="/projects/:id/graph" element={<GraphView />} />
        </Routes>
      </MemoryRouter>
    </ModalStackProvider>,
  );
}

beforeEach(() => resetMockApi());

describe('GraphView', () => {
  it('shows the empty state when the project has no items', async () => {
    renderGraph();
    expect(await screen.findByTestId('graph-empty')).toBeInTheDocument();
    expect(screen.getByText('No items to graph')).toBeInTheDocument();
  });

  it('renders a node per item and edges for parent / blocker links', async () => {
    seedItem({ id: 'root', project_id: 'p1', title: 'Root task' });
    seedItem({ id: 'child', project_id: 'p1', title: 'Child', parent_id: 'root' });
    seedItem({ id: 'blocked', project_id: 'p1', title: 'Blocked', blockers: ['root'] });
    renderGraph();

    expect(await screen.findByTestId('graph-node-root')).toBeInTheDocument();
    expect(screen.getByTestId('graph-node-child')).toBeInTheDocument();
    expect(screen.getByTestId('graph-node-blocked')).toBeInTheDocument();

    const parentEdge = screen.getByTestId('graph-edge-parent:root->child');
    expect(parentEdge).toHaveAttribute('data-kind', 'parent');
    const blockedEdge = screen.getByTestId('graph-edge-blocked:root->blocked');
    expect(blockedEdge).toHaveAttribute('data-kind', 'blocked');
    expect(blockedEdge.getAttribute('class')).toContain('blocked');
  });

  it('renders a mention edge as a third edge kind', async () => {
    seedItem({ id: 'src', project_id: 'p1', title: 'Source' });
    seedItem({ id: 'tgt', project_id: 'p1', title: 'Target', mentions: ['src'] });
    renderGraph();

    const mentionEdge = await screen.findByTestId('graph-edge-mentions:tgt->src');
    expect(mentionEdge).toHaveAttribute('data-kind', 'mentions');
    expect(mentionEdge.getAttribute('class')).toContain('mentions');
    expect(screen.getByText('mentions')).toBeInTheDocument(); // legend entry
  });

  it('does not render edges to items outside the project set', async () => {
    seedItem({ id: 'lonely', project_id: 'p1', title: 'Lonely', parent_id: 'gone' });
    renderGraph();
    await screen.findByTestId('graph-node-lonely');
    expect(screen.queryByTestId(/graph-edge-/)).toBeNull();
  });

  it('Show chains highlights the root blocker and surfaces its count', async () => {
    seedItem({ id: 'root', project_id: 'p1', title: 'Root blocker' });
    seedItem({ id: 'mid', project_id: 'p1', title: 'Mid', blockers: ['root'] });
    seedItem({ id: 'leaf', project_id: 'p1', title: 'Leaf', blockers: ['mid'] });
    seedItem({ id: 'side', project_id: 'p1', title: 'Unrelated' });
    const user = userEvent.setup();
    renderGraph();

    await screen.findByTestId('graph-node-root');
    expect(screen.queryByTestId('graph-rootblocker-count')).toBeNull();

    await user.click(screen.getByTestId('graph-toggle-chains'));

    expect(screen.getByTestId('graph-rootblocker-count')).toHaveTextContent(
      '1 root blocker',
    );
    expect(screen.getByTestId('graph-node-root').getAttribute('class')).toContain(
      'root-blocker',
    );
    // The unrelated node is dimmed out of the chain.
    expect(screen.getByTestId('graph-node-side').getAttribute('class')).toContain(
      'dim',
    );
    // A chain edge is accented.
    expect(
      screen.getByTestId('graph-edge-blocked:root->mid').getAttribute('class'),
    ).toContain('chain');
  });

  it('clicking a node opens the item detail panel', async () => {
    seedItem({ id: 'n1', project_id: 'p1', title: 'Inspect me' });
    const user = userEvent.setup();
    renderGraph();

    await user.click(await screen.findByTestId('graph-node-n1'));
    await waitFor(() =>
      expect(screen.getByTestId('item-detail-panel')).toBeInTheDocument(),
    );
  });
});
