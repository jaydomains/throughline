import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Item, ItemPolicy } from '@throughline/shared';
import { ModalStackProvider } from '../src/keyboard/modalStack.js';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { PrBadges } from '../src/components/PrBadges.js';
import { Board } from '../src/components/Board.js';
import { ItemDetailPanel } from '../src/components/ItemDetailPanel.js';
import { LibraryView } from '../src/views/LibraryView.js';
import { mockApi, resetMockApi, seedLibraryEntry } from './fixtures/mockApi.js';

beforeEach(() => {
  resetMockApi();
});

const POLICY: ItemPolicy = {
  bundle_id: 'freeform',
  types: ['task'],
  statuses: ['open', 'done'],
  statuses_by_type: { task: ['open', 'done'] },
  boards: [{ id: 'b', label: 'Tasks', type: 'task', statuses: ['open'] }],
};

function makeItem(id: string, title: string): Item {
  return {
    id,
    project_id: 'p1',
    type: 'task',
    title,
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
  };
}

// ---------------------------------------------------------------------------
// SF6-09 — PrBadges distinguishes fetch-fail and a failing poller from a genuine
// healthy-empty "none tracked".
// ---------------------------------------------------------------------------
describe('PrBadges — SF6-09 honest degradation (T-D60)', () => {
  it('a healthy, configured project with no PRs renders "none tracked"', async () => {
    mockApi.getProjectPrs.mockResolvedValueOnce({
      configured: true,
      prs: [],
      poll_healthy: true,
      poll_error: null,
    });
    render(<PrBadges projectId="p1" />);
    expect(await screen.findByText('none tracked')).toBeInTheDocument();
    expect(screen.queryByTestId('pr-badges-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pr-badges-stale')).not.toBeInTheDocument();
  });

  it('a fetch failure renders a distinct error, NOT "none tracked"', async () => {
    mockApi.getProjectPrs.mockRejectedValueOnce(new Error('network down'));
    render(<PrBadges projectId="p1" />);
    expect(await screen.findByTestId('pr-badges-error')).toBeInTheDocument();
    expect(screen.queryByText('none tracked')).not.toBeInTheDocument();
  });

  it('a failing background poller surfaces a "data may be stale" warning alongside the cached list', async () => {
    mockApi.getProjectPrs.mockResolvedValueOnce({
      configured: true,
      prs: [],
      poll_healthy: false,
      poll_error: 'github 500',
    });
    render(<PrBadges projectId="p1" />);
    const stale = await screen.findByTestId('pr-badges-stale');
    expect(stale).toBeInTheDocument();
    expect(stale).toHaveAttribute('title', 'github 500');
  });

  it('an unconfigured, reachable project renders nothing', async () => {
    mockApi.getProjectPrs.mockResolvedValueOnce({
      configured: false,
      prs: [],
      poll_healthy: true,
      poll_error: null,
    });
    const { container } = render(<PrBadges projectId="p1" />);
    await waitFor(() => expect(mockApi.getProjectPrs).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="pr-badges"]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// S8-04 — Board inline-create surfaces a failed createItem instead of swallowing it.
// ---------------------------------------------------------------------------
describe('Board — S8-04 inline-create error surfacing', () => {
  it('shows an inline error when createItem rejects', async () => {
    mockApi.createItem.mockRejectedValueOnce(new Error('status not allowed by policy'));
    const user = userEvent.setup();
    render(
      <Board
        projectId="p1"
        sessionId="s1"
        board={POLICY.boards[0]!}
        policy={POLICY}
        items={[]}
        staleDays={14}
        selectedId={null}
        onSelect={() => {}}
        onRefresh={() => {}}
      />,
    );
    const input = screen.getByLabelText('New task in open');
    await user.type(input, 'a new task{Enter}');
    const err = await screen.findByTestId('column-create-error-b-open');
    expect(err).toHaveTextContent('status not allowed by policy');
  });
});

// ---------------------------------------------------------------------------
// S8-01 — ItemDetailPanel: a slow refresh for a previous item must not overwrite the
// current item's data after a sibling-cycle swaps the itemId.
// ---------------------------------------------------------------------------
describe('ItemDetailPanel — S8-01 stale-refresh guard', () => {
  it('a late getItem for the previous item does not overwrite the current item', async () => {
    const resolvers = new Map<string, () => void>();
    mockApi.getItem.mockImplementation(
      (_pid: string, itemId: string) =>
        new Promise((resolve) => {
          resolvers.set(itemId, () => resolve({ item: makeItem(itemId, `Item ${itemId}`) }));
        }),
    );

    const props = {
      projectId: 'p1',
      policy: POLICY,
      staleDays: 14,
      siblings: ['A', 'B'],
      onCycle: () => {},
      onClose: () => {},
      onChanged: () => {},
    };
    const { rerender } = render(
      <ModalStackProvider>
        <ItemDetailPanel {...props} itemId="A" />
      </ModalStackProvider>,
    );
    await waitFor(() => expect(resolvers.has('A')).toBe(true));

    // Cycle to sibling B before A's fetch resolves.
    rerender(
      <ModalStackProvider>
        <ItemDetailPanel {...props} itemId="B" />
      </ModalStackProvider>,
    );
    await waitFor(() => expect(resolvers.has('B')).toBe(true));

    // B resolves first (the current item), then A resolves late (the superseded one).
    await act(async () => {
      resolvers.get('B')!();
    });
    await act(async () => {
      resolvers.get('A')!();
    });

    const title = (await screen.findByLabelText('Item title')) as HTMLInputElement;
    await waitFor(() => expect(title.value).toBe('Item B'));
    expect(title.value).not.toBe('Item A');
  });
});

// ---------------------------------------------------------------------------
// S8-02 — LibraryView: a stale in-flight search result is dropped, not rendered over the
// latest query's result.
// ---------------------------------------------------------------------------
function renderLibrary(projectId = 'p1') {
  return render(
    <ModalStackProvider>
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={[`/projects/${projectId}/library`]}
      >
        <Routes>
          <Route path="/projects/:id/library" element={<LibraryView />} />
        </Routes>
      </MemoryRouter>
    </ModalStackProvider>,
  );
}

describe('LibraryView — S8-02 stale-search guard', () => {
  it('drops a late result from a superseded query', async () => {
    const resolvers = new Map<string, () => void>();
    mockApi.searchLibrary.mockImplementation(
      (_pid: string, body: { query: string }) =>
        new Promise((resolve) => {
          resolvers.set(body.query, () =>
            resolve({
              result: {
                via: 'fts',
                truncated: false,
                entries: [
                  seedShape(`hit-${body.query}`, `RESULT ${body.query.toUpperCase()}`),
                ],
              },
            }),
          );
        }),
    );

    renderLibrary();
    const input = await screen.findByTestId('library-search-input');

    fireEvent.change(input, { target: { value: 'old' } });
    await waitFor(() => expect(resolvers.has('old')).toBe(true));

    fireEvent.change(input, { target: { value: 'new' } });
    await waitFor(() => expect(resolvers.has('new')).toBe(true));

    // Latest query resolves first, then the stale one resolves late.
    await act(async () => {
      resolvers.get('new')!();
    });
    await act(async () => {
      resolvers.get('old')!();
    });

    expect(await screen.findByText('RESULT NEW')).toBeInTheDocument();
    expect(screen.queryByText('RESULT OLD')).not.toBeInTheDocument();
  });
});

// A minimal LibraryEntry-shaped object for search results rendered in the sidebar list.
function seedShape(id: string, title: string) {
  return {
    id,
    project_id: 'p1',
    type: 'note' as const,
    title,
    body: '',
    tags: [],
    summary: null,
    source_path: null,
    source_hash: null,
    source_tracked: false,
    ingested_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

// ---------------------------------------------------------------------------
// S8-03 — the copy toast clears its timer on unmount (no setState-after-unmount) and a
// fresh copy replaces the prior toast rather than leaking overlapping timers.
// ---------------------------------------------------------------------------
describe('LibraryView — S8-03 toast timer lifecycle', () => {
  it('shows a copy toast and unmounts cleanly without a console error', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    seedLibraryEntry({ id: 'sn1', project_id: 'p1', type: 'snippet', title: 'Snippet', body: 'code' });
    const user = userEvent.setup();
    const { unmount } = renderLibrary();

    await user.click(await screen.findByText('Snippet'));
    await user.click(await screen.findByTestId('library-snippet-copy'));
    // A toast is shown (either "Copied …" or the jsdom "Copy failed" path — both route
    // through the single timer-managed showToast).
    await screen.findByTestId('library-toast');

    unmount();
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
