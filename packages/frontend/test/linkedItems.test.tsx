import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
      <MemoryRouter initialEntries={['/projects/p1/graph']}>
        <Routes>
          <Route path="/projects/:id/graph" element={<GraphView />} />
        </Routes>
      </MemoryRouter>
    </ModalStackProvider>,
  );
}

beforeEach(() => resetMockApi());

describe('ItemDetailPanel — Linked items (SPEC §7.17)', () => {
  it('renders the four relation groups and cycles on click', async () => {
    seedItem({ id: 'parent', project_id: 'p1', title: 'The parent' });
    seedItem({ id: 'target', project_id: 'p1', title: 'Mentioned target' });
    seedItem({
      id: 'src',
      project_id: 'p1',
      title: 'Source item',
      parent_id: 'parent',
      mentions: ['target'],
    });
    seedItem({ id: 'kid', project_id: 'p1', title: 'A child', parent_id: 'src' });
    seedItem({
      id: 'other',
      project_id: 'p1',
      title: 'Other mentions src',
      mentions: ['src'],
    });

    const user = userEvent.setup();
    renderGraph();

    await user.click(await screen.findByTestId('graph-node-src'));
    await waitFor(() =>
      expect(screen.getByTestId('item-detail-panel')).toBeInTheDocument(),
    );

    expect(
      within(screen.getByTestId('linked-Parents')).getByText('The parent'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('linked-Children')).getByText('A child'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('linked-Mentioning this')).getByText('Other mentions src'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('linked-Mentioned by this')).getByText('Mentioned target'),
    ).toBeInTheDocument();

    // Clicking a linked item cycles the panel to it (title input updates).
    await user.click(screen.getByTestId('linked-item-target'));
    await waitFor(() =>
      expect(screen.getByDisplayValue('Mentioned target')).toBeInTheDocument(),
    );
  });

  it('shows an em-dash for empty relation groups', async () => {
    seedItem({ id: 'lone', project_id: 'p1', title: 'Lone item' });
    const user = userEvent.setup();
    renderGraph();

    await user.click(await screen.findByTestId('graph-node-lone'));
    await waitFor(() =>
      expect(screen.getByTestId('item-detail-panel')).toBeInTheDocument(),
    );
    for (const label of ['Parents', 'Children', 'Mentioning this', 'Mentioned by this']) {
      expect(within(screen.getByTestId(`linked-${label}`)).getByText('—')).toBeInTheDocument();
    }
  });
});
