import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ModalStackProvider } from '../src/keyboard/modalStack.js';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { useItems } from '../src/hooks/useItems.js';
import { useSessions } from '../src/hooks/useSessions.js';
import { TreeView } from '../src/views/TreeView.js';
import { SessionsIndex } from '../src/views/SessionsIndex.js';
import { mockApi, resetMockApi, seedItem, seedSession } from './fixtures/mockApi.js';

beforeEach(() => {
  resetMockApi();
});

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

// SF6-01 / SF6-02 regression locks. Before Phase C, a failed list fetch was caught
// inside the hook and the consumer rendered an empty list — a load failure was
// indistinguishable from "no data". These assert the error now reaches both the hook's
// `error` slot and the rendered view.
describe('useItems — SF6-01 (item-load errors must not read as empty)', () => {
  it('surfaces the fetch error in the hook state instead of swallowing it', async () => {
    mockApi.listItems.mockRejectedValueOnce(new Error('items boom'));
    const { result } = renderHook(() => useItems({ projectId: 'p1' }));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toContain('items boom');
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('renders an inline load error in TreeView rather than a silent empty tree', async () => {
    mockApi.listItems.mockRejectedValueOnce(new Error('items boom'));
    render(
      <ModalStackProvider>
        <MemoryRouter future={ROUTER_FUTURE} initialEntries={['/projects/p1']}>
          <Routes>
            <Route path="/projects/:id" element={<TreeView />} />
          </Routes>
        </MemoryRouter>
      </ModalStackProvider>,
    );
    const banner = await screen.findByTestId('load-error-items');
    expect(banner).toHaveTextContent(/items boom/);
  });
});

describe('useSessions — SF6-02 (session-load errors must not read as empty)', () => {
  it('surfaces the fetch error in the hook state instead of swallowing it', async () => {
    mockApi.listSessions.mockRejectedValueOnce(new Error('sessions boom'));
    const { result } = renderHook(() => useSessions('p1'));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toContain('sessions boom');
    expect(result.current.sessions).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('renders an inline load error in SessionsIndex and suppresses the empty-state copy', async () => {
    mockApi.listSessions.mockRejectedValueOnce(new Error('sessions boom'));
    render(
      <MemoryRouter future={ROUTER_FUTURE} initialEntries={['/projects/p1/sessions']}>
        <Routes>
          <Route path="/projects/:id/sessions" element={<SessionsIndex />} />
        </Routes>
      </MemoryRouter>,
    );
    const banner = await screen.findByTestId('load-error-sessions');
    expect(banner).toHaveTextContent(/sessions boom/);
    // The "No sessions yet" empty-state must not masquerade as success on a failure.
    expect(screen.queryByText(/No sessions yet/)).toBeNull();
  });
});

describe('useItems / useSessions — success path still resolves cleanly', () => {
  it('returns data with a null error when the fetch succeeds', async () => {
    seedItem({ id: 'a', project_id: 'p1', title: 'first', status: 'open' });
    seedSession({ id: 's1', project_id: 'p1', name: 'wave 1' });
    const items = renderHook(() => useItems({ projectId: 'p1' }));
    const sessions = renderHook(() => useSessions('p1'));
    await waitFor(() => expect(items.result.current.items).toHaveLength(1));
    await waitFor(() => expect(sessions.result.current.sessions).toHaveLength(1));
    expect(items.result.current.error).toBeNull();
    expect(sessions.result.current.error).toBeNull();
  });
});
