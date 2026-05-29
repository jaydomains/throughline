import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ModalStackProvider } from '../src/keyboard/modalStack.js';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { SessionView } from '../src/views/SessionView.js';
import { SessionsIndex } from '../src/views/SessionsIndex.js';
import { mockApi, resetMockApi, seedSession, seedItem } from './fixtures/mockApi.js';

beforeEach(() => {
  resetMockApi();
});

function renderInRoute(initial: string, element: React.ReactNode) {
  return render(
    <ModalStackProvider>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[initial]}>
        <Routes>
          <Route path="/projects/:id/sessions/:sessionId" element={element} />
          <Route path="/projects/:id/sessions" element={<SessionsIndex />} />
        </Routes>
      </MemoryRouter>
    </ModalStackProvider>,
  );
}

describe('SessionView (freeform bundle)', () => {
  it('renders a single Tasks board with open + done columns derived from the bundle policy', async () => {
    seedSession({ id: 's1', project_id: 'p1', name: 'wave 1' });
    seedItem({ id: 'a', project_id: 'p1', session_ids: ['s1'], title: 'first', status: 'open' });
    seedItem({ id: 'b', project_id: 'p1', session_ids: ['s1'], title: 'shipped', status: 'done' });
    renderInRoute('/projects/p1/sessions/s1', <SessionView />);
    await screen.findByText('wave 1');
    expect(await screen.findByTestId('board-tasks')).toBeInTheDocument();
    expect(screen.getByTestId('column-tasks-open')).toBeInTheDocument();
    expect(screen.getByTestId('column-tasks-done')).toBeInTheDocument();
    expect(screen.getByTestId('item-row-a')).toBeInTheDocument();
    expect(screen.getByTestId('item-row-b')).toBeInTheDocument();
  });

  it('inline-creates a task via the open column and lands it in the board', async () => {
    seedSession({ id: 's1', project_id: 'p1', name: 'wave 1' });
    const user = userEvent.setup();
    renderInRoute('/projects/p1/sessions/s1', <SessionView />);
    await screen.findByText('wave 1');
    const input = await screen.findByLabelText('New task in open');
    await user.type(input, 'fresh task{Enter}');
    await waitFor(() => expect(mockApi.createItem).toHaveBeenCalled());
    await screen.findByText('fresh task');
  });

  it('opens the detail panel on item click and cycles via arrow keys', async () => {
    seedSession({ id: 's1', project_id: 'p1', name: 'wave 1' });
    seedItem({ id: 'a', project_id: 'p1', session_ids: ['s1'], title: 'first', status: 'open' });
    seedItem({ id: 'b', project_id: 'p1', session_ids: ['s1'], title: 'second', status: 'open' });
    const user = userEvent.setup();
    renderInRoute('/projects/p1/sessions/s1', <SessionView />);
    await screen.findByTestId('item-row-a');
    await user.click(screen.getByTestId('item-row-a'));
    expect(await screen.findByTestId('item-detail-panel')).toBeInTheDocument();
    expect(screen.getByDisplayValue('first')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(screen.getByDisplayValue('second')).toBeInTheDocument());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('item-detail-panel')).toBeNull());
  });

  it('renders a stale yellow flag on a row whose updated_at is past the threshold', async () => {
    seedSession({ id: 's1', project_id: 'p1', name: 'wave 1' });
    const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    seedItem({
      id: 'a',
      project_id: 'p1',
      session_ids: ['s1'],
      title: 'stale one',
      status: 'open',
      updated_at: longAgo,
    });
    renderInRoute('/projects/p1/sessions/s1', <SessionView />);
    const row = await screen.findByTestId('item-row-a');
    expect(row.querySelector('.stale')).not.toBeNull();
  });
});

describe('SessionsIndex', () => {
  it('creates a session and navigates to its route', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/projects/p1/sessions']}>
        <Routes>
          <Route path="/projects/:id/sessions" element={<SessionsIndex />} />
          <Route path="/projects/:id/sessions/:sessionId" element={<div>session-target</div>} />
        </Routes>
      </MemoryRouter>,
    );
    const input = await screen.findByLabelText('New session name');
    await user.type(input, 'wave 1');
    await user.click(screen.getByRole('button', { name: /Create session/ }));
    await screen.findByText('session-target');
    expect(mockApi.createSession).toHaveBeenCalledWith('p1', { name: 'wave 1' });
    // refresh() is awaited before navigation — the sessions list is reloaded, not
    // left stale by a fire-and-forget call that races the route change.
    expect(mockApi.listSessions).toHaveBeenCalledWith('p1');
  });
});
