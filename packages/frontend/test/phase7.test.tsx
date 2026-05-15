import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ItemPolicy } from '@throughline/shared';
import { ModalStackProvider } from '../src/keyboard/modalStack.js';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { SessionView } from '../src/views/SessionView.js';
import { ModulesView } from '../src/views/stubs.js';
import { mockApi, resetMockApi, seedSession, seedItem } from './fixtures/mockApi.js';
import type { MethodologySummary } from '../src/api.js';

const SITEMESH_POLICY: ItemPolicy = {
  bundle_id: 'sitemesh',
  types: ['todo', 'decision'],
  statuses: ['todo', 'in-progress', 'blocked', 'done', 'open', 'locked', 'superseded'],
  statuses_by_type: {
    todo: ['todo', 'in-progress', 'blocked', 'done'],
    decision: ['open', 'locked', 'superseded'],
  },
  boards: [
    { id: 'todo', label: 'Todos', type: 'todo', statuses: ['todo', 'in-progress', 'blocked', 'done'] },
    { id: 'decision', label: 'Decisions', type: 'decision', statuses: ['open', 'locked', 'superseded'] },
  ],
};

const sitemeshSummary: MethodologySummary = {
  status: 'loaded',
  bundle_id: 'sitemesh',
  identity: { name: 'sitemesh', version: '1.0.0', authority_precedence: [] },
  has_primary_unit: true,
  has_gates: true,
};

beforeEach(() => {
  resetMockApi();
});

describe('Phase 7 — SiteMesh-bound UI', () => {
  it('renders separate Todos and Decisions boards with per-type columns (§7.5)', async () => {
    mockApi.getPolicy.mockResolvedValue({ policy: SITEMESH_POLICY });
    seedSession({ id: 's1', project_id: 'p1', name: 'slice 1' });
    seedItem({ id: 'a', project_id: 'p1', session_ids: ['s1'], title: 'do it', type: 'todo', status: 'in-progress' });
    seedItem({ id: 'b', project_id: 'p1', session_ids: ['s1'], title: 'pick db', type: 'decision', status: 'locked' });

    render(
      <ModalStackProvider>
        <MemoryRouter initialEntries={['/projects/p1/sessions/s1']}>
          <Routes>
            <Route path="/projects/:id/sessions/:sessionId" element={<SessionView />} />
          </Routes>
        </MemoryRouter>
      </ModalStackProvider>,
    );

    expect(await screen.findByTestId('board-todo')).toBeInTheDocument();
    expect(screen.getByTestId('board-decision')).toBeInTheDocument();
    // per-type columns: todo lifecycle vs decision lifecycle
    expect(screen.getByTestId('column-todo-in-progress')).toBeInTheDocument();
    expect(screen.getByTestId('column-decision-locked')).toBeInTheDocument();
    // decision board must NOT carry todo-only columns
    expect(screen.queryByTestId('column-decision-in-progress')).not.toBeInTheDocument();
    expect(screen.getByText('do it')).toBeInTheDocument();
    expect(screen.getByText('pick db')).toBeInTheDocument();
  });

  it('Modules view renders a primary-unit-grouped table with tier + counts (§7.11)', async () => {
    mockApi.getModules.mockResolvedValue({
      primary_unit_label: 'module',
      modules: [
        { ref: 'auth', item_count: 2, phases: ['drafting'], anchor_count: 3, marker_count: 1, tier: 'tier-1' },
        { ref: 'billing', item_count: 6, phases: [], anchor_count: 0, marker_count: 0, tier: 'tier-3' },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/projects/p1/modules']}>
        <Routes>
          <Route
            path="/projects/:id/modules"
            element={<ModulesView bundles={[sitemeshSummary]} projectBundleId="sitemesh" />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('modules-table')).toBeInTheDocument();
    expect(screen.getByTestId('module-row-auth')).toBeInTheDocument();
    expect(screen.getByTestId('module-tier-auth')).toHaveTextContent('tier-1');
    expect(screen.getByTestId('module-tier-billing')).toHaveTextContent('tier-3');
  });
});
