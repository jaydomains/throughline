import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ModalStackProvider } from '../src/keyboard/modalStack.js';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { DirectivesView } from '../src/views/DirectivesView.js';
import { LibraryView } from '../src/views/LibraryView.js';
import { Header } from '../src/components/Header.js';
import {
  mockApi,
  resetMockApi,
  seedDirective,
  seedItem,
  seedLibraryEntry,
} from './fixtures/mockApi.js';

beforeEach(() => {
  resetMockApi();
});

function renderDirectives(projectId = 'p1') {
  return render(
    <ModalStackProvider>
      <MemoryRouter initialEntries={[`/projects/${projectId}/directives`]}>
        <Routes>
          <Route path="/projects/:id/directives" element={<DirectivesView />} />
        </Routes>
      </MemoryRouter>
    </ModalStackProvider>,
  );
}

function renderLibrary(projectId = 'p1') {
  return render(
    <ModalStackProvider>
      <MemoryRouter initialEntries={[`/projects/${projectId}/library`]}>
        <Routes>
          <Route path="/projects/:id/library" element={<LibraryView />} />
        </Routes>
      </MemoryRouter>
    </ModalStackProvider>,
  );
}

describe('DirectivesView (Phase 6b — T-D12)', () => {
  it('renders three collapsible groups with per-group counts', async () => {
    seedItem({ id: 'i1', project_id: 'p1', title: 'Item one' });
    seedLibraryEntry({ id: 'e1', project_id: 'p1', type: 'note', title: 'Note one' });
    seedDirective({ id: 'd1', project_id: 'p1', parent_type: 'item', parent_id: 'i1', kind: 'pin' });
    seedDirective({
      id: 'd2',
      project_id: 'p1',
      parent_type: 'library',
      parent_id: 'e1',
      kind: 'reminder',
      payload: { mode: 'absolute', fire_at: '2030-01-01T10:00:00.000Z' },
      next_fire_at: '2030-01-01T10:00:00.000Z',
    });
    seedDirective({
      id: 'd3',
      project_id: 'p1',
      parent_type: 'item',
      parent_id: 'i1',
      kind: 'include_prompt',
    });
    renderDirectives();
    expect(await screen.findByTestId('directives-count-pin')).toHaveTextContent('(1)');
    expect(screen.getByTestId('directives-count-reminder')).toHaveTextContent('(1)');
    expect(screen.getByTestId('directives-count-include_prompt')).toHaveTextContent('(1)');
    // Edit affordance exists on each row.
    expect(screen.getByTestId('directive-edit-d1')).toBeInTheDocument();
  });

  it('sorts reminders by next_fire_at within their group', async () => {
    seedItem({ id: 'i1', project_id: 'p1', title: 'Item one' });
    seedDirective({
      id: 'd-far',
      project_id: 'p1',
      parent_type: 'item',
      parent_id: 'i1',
      kind: 'reminder',
      payload: { mode: 'absolute', fire_at: '2030-12-31T10:00:00.000Z' },
      next_fire_at: '2030-12-31T10:00:00.000Z',
    });
    seedDirective({
      id: 'd-near',
      project_id: 'p1',
      parent_type: 'item',
      parent_id: 'i1',
      kind: 'reminder',
      payload: { mode: 'absolute', fire_at: '2030-01-01T10:00:00.000Z' },
      next_fire_at: '2030-01-01T10:00:00.000Z',
    });
    renderDirectives();
    const group = await screen.findByTestId('directives-group-reminder');
    const rows = within(group).getAllByTestId(/^directive-row-/);
    expect(rows[0]).toHaveAttribute('data-testid', 'directive-row-d-near');
    expect(rows[1]).toHaveAttribute('data-testid', 'directive-row-d-far');
  });

  it('collapses a group on header click', async () => {
    seedItem({ id: 'i1', project_id: 'p1', title: 'Item one' });
    seedDirective({ id: 'd1', project_id: 'p1', parent_type: 'item', parent_id: 'i1', kind: 'pin' });
    const user = userEvent.setup();
    renderDirectives();
    await screen.findByTestId('directive-row-d1');
    const group = screen.getByTestId('directives-group-pin');
    await user.click(within(group).getByRole('button', { expanded: true }));
    await waitFor(() => {
      expect(screen.queryByTestId('directive-row-d1')).not.toBeInTheDocument();
    });
  });

  it('deletes a directive via the row action', async () => {
    seedItem({ id: 'i1', project_id: 'p1', title: 'Item one' });
    seedDirective({ id: 'd1', project_id: 'p1', parent_type: 'item', parent_id: 'i1', kind: 'pin' });
    const user = userEvent.setup();
    renderDirectives();
    await screen.findByTestId('directive-row-d1');
    await user.click(screen.getByTestId('directive-delete-d1'));
    await waitFor(() => {
      expect(screen.queryByTestId('directive-row-d1')).not.toBeInTheDocument();
    });
    expect(mockApi.deleteDirective).toHaveBeenCalledWith('p1', 'd1');
  });
});

describe('Library pin surfacing (Phase 6b — pin scope = library sidebar)', () => {
  it('renders pinned entries above unpinned ones with a divider', async () => {
    seedLibraryEntry({ id: 'e1', project_id: 'p1', type: 'note', title: 'Aaa first' });
    seedLibraryEntry({ id: 'e2', project_id: 'p1', type: 'note', title: 'Zzz pinned' });
    seedDirective({
      id: 'd1',
      project_id: 'p1',
      parent_type: 'library',
      parent_id: 'e2',
      kind: 'pin',
    });
    renderLibrary();
    // Wait until both library + directives have loaded so the divider can render.
    await screen.findByTestId('library-pinned-divider');
    const list = screen.getByTestId('library-entry-list');
    const rows = within(list).getAllByTestId(/^library-entry-row-/);
    // Order: divider stays first, then pinned entry, then unpinned entry.
    expect(rows[0]).toHaveAttribute('data-testid', 'library-entry-row-e2');
    expect(rows[1]).toHaveAttribute('data-testid', 'library-entry-row-e1');
  });

  it('adding a pin via the entry editor pushes the entry to the top', async () => {
    seedLibraryEntry({ id: 'e1', project_id: 'p1', type: 'note', title: 'Aaa first' });
    seedLibraryEntry({ id: 'e2', project_id: 'p1', type: 'note', title: 'Bbb second' });
    const user = userEvent.setup();
    renderLibrary();
    await user.click(await screen.findByTestId('library-entry-row-e2'));
    await user.click(screen.getByTestId('library-directive-add'));
    // Default kind is 'pin'; click save.
    await user.click(screen.getByTestId('directive-save'));
    await waitFor(() => {
      expect(screen.getByTestId('library-pinned-divider')).toBeInTheDocument();
    });
    const list = screen.getByTestId('library-entry-list');
    const rows = within(list).getAllByTestId(/^library-entry-row-/);
    expect(rows[0]).toHaveAttribute('data-testid', 'library-entry-row-e2');
  });
});

describe('DirectiveModal — reminder paths', () => {
  it('creates an absolute reminder from the library editor', async () => {
    seedLibraryEntry({ id: 'e1', project_id: 'p1', type: 'note', title: 'Note one' });
    const user = userEvent.setup();
    renderLibrary();
    await user.click(await screen.findByTestId('library-entry-row-e1'));
    await user.click(screen.getByTestId('library-directive-add'));

    await user.selectOptions(screen.getByTestId('directive-kind'), 'reminder');
    await user.clear(screen.getByTestId('directive-reminder-absolute'));
    await user.type(screen.getByTestId('directive-reminder-absolute'), '2030-01-01T10:00');
    await user.click(screen.getByTestId('directive-save'));

    await waitFor(() => {
      expect(mockApi.createDirective).toHaveBeenCalled();
    });
    const call = mockApi.createDirective.mock.calls[0]!;
    expect(call[0]).toBe('p1');
    expect(call[1].kind).toBe('reminder');
    expect((call[1].payload as { mode: string }).mode).toBe('absolute');
  });

  it('creates a relative reminder with recurrence', async () => {
    seedLibraryEntry({ id: 'e1', project_id: 'p1', type: 'note', title: 'Note one' });
    const user = userEvent.setup();
    renderLibrary();
    await user.click(await screen.findByTestId('library-entry-row-e1'));
    await user.click(screen.getByTestId('library-directive-add'));

    await user.selectOptions(screen.getByTestId('directive-kind'), 'reminder');
    await user.selectOptions(screen.getByTestId('directive-reminder-mode'), 'relative');
    await user.clear(screen.getByTestId('directive-reminder-relative'));
    await user.type(screen.getByTestId('directive-reminder-relative'), 'in 2 hours');
    await user.click(screen.getByTestId('directive-recurrence-on'));
    await user.click(screen.getByTestId('directive-save'));

    await waitFor(() => {
      expect(mockApi.createDirective).toHaveBeenCalled();
    });
    const payload = mockApi.createDirective.mock.calls[0]![1].payload as {
      mode: string;
      relative_spec: string;
      recurrence?: { every: number; unit: string };
    };
    expect(payload.mode).toBe('relative');
    expect(payload.relative_spec).toBe('in 2 hours');
    expect(payload.recurrence).toEqual({ every: 1, unit: 'day' });
  });
});

describe('Header directives hint', () => {
  it('shows the active count and links to the directives view', async () => {
    seedItem({ id: 'i1', project_id: 'p1', title: 'Item one' });
    seedDirective({ id: 'd1', project_id: 'p1', parent_type: 'item', parent_id: 'i1', kind: 'pin' });
    seedDirective({ id: 'd2', project_id: 'p1', parent_type: 'item', parent_id: 'i1', kind: 'include_prompt' });
    render(
      <MemoryRouter initialEntries={['/projects/p1']}>
        <Header
          projects={[
            {
              id: 'p1',
              name: 'demo',
              repo_path: '/tmp/demo',
              github_owner: null,
              github_repo: null,
              bundle_id: 'freeform',
              state: 'active',
              settings_json: {},
              created_at: '',
              updated_at: '',
              archived_at: null,
            },
          ]}
          bundles={[]}
          activeProjectId="p1"
          onOpenPalette={() => {}}
          sseConnected
        />
      </MemoryRouter>,
    );
    const hint = await screen.findByTestId('directives-hint');
    await waitFor(() => {
      expect(hint).toHaveTextContent('Directives (2)');
    });
    expect(hint).toHaveAttribute('href', '/projects/p1/directives');
  });
});
