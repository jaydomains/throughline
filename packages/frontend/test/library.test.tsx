import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ModalStackProvider } from '../src/keyboard/modalStack.js';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { LibraryView } from '../src/views/LibraryView.js';
import {
  mockApi,
  resetMockApi,
  seedAttachment,
  seedItem,
  seedLibraryEntry,
} from './fixtures/mockApi.js';

beforeEach(() => {
  resetMockApi();
});

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

describe('LibraryView', () => {
  it('renders entries from the API grouped under the entry list', async () => {
    seedLibraryEntry({ id: 'e1', project_id: 'p1', type: 'note', title: 'Note A' });
    seedLibraryEntry({ id: 'e2', project_id: 'p1', type: 'prompt', title: 'Prompt B' });
    seedLibraryEntry({ id: 'e3', project_id: 'p1', type: 'snippet', title: 'Snippet C' });
    renderLibrary();
    expect(await screen.findByText('Note A')).toBeInTheDocument();
    expect(screen.getByText('Prompt B')).toBeInTheDocument();
    expect(screen.getByText('Snippet C')).toBeInTheDocument();
  });

  it('type filter narrows the visible entries', async () => {
    seedLibraryEntry({ id: 'e1', project_id: 'p1', type: 'note', title: 'Note A' });
    seedLibraryEntry({ id: 'e2', project_id: 'p1', type: 'prompt', title: 'Prompt B' });
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('Note A');
    await user.selectOptions(screen.getByTestId('library-type-filter'), 'prompt');
    await waitFor(() => {
      expect(screen.queryByText('Note A')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Prompt B')).toBeInTheDocument();
  });

  it('search input debounces and routes to the FTS endpoint', async () => {
    seedLibraryEntry({ id: 'e1', project_id: 'p1', type: 'note', title: 'apple', body: 'red fruit' });
    seedLibraryEntry({ id: 'e2', project_id: 'p1', type: 'note', title: 'banana', body: 'yellow' });
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('apple');
    await user.type(screen.getByTestId('library-search-input'), 'banana');
    await waitFor(
      () => {
        expect(mockApi.searchLibrary).toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
    await waitFor(() => {
      expect(screen.queryByText('apple')).not.toBeInTheDocument();
    });
    expect(screen.getByText('banana')).toBeInTheDocument();
  });

  it('cross-project toggle issues a global-scope search', async () => {
    seedLibraryEntry({ id: 'e1', project_id: 'p1', type: 'note', title: 'local' });
    seedLibraryEntry({ id: 'e2', project_id: 'p2', type: 'note', title: 'foreign' });
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('local');
    await user.click(screen.getByTestId('library-scope-toggle'));
    await waitFor(() => {
      expect(screen.getByText('foreign')).toBeInTheDocument();
    });
  });

  it('renders the prompt fill modal and copies the rendered output', async () => {
    seedLibraryEntry({
      id: 'p1e',
      project_id: 'p1',
      type: 'prompt',
      title: 'greet',
      body: 'Hello {{name}}!',
    });
    const user = userEvent.setup();
    // user-event v14's setup() installs a clipboard polyfill on navigator. Spy on its
    // writeText so we can assert the call.
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined);
    renderLibrary();
    await user.click(await screen.findByTestId('library-entry-row-p1e'));
    await user.click(screen.getByTestId('library-prompt-use'));
    const nameInput = await screen.findByTestId('prompt-var-name');
    await user.type(nameInput, 'Ada');
    await user.click(screen.getByTestId('prompt-fill-render'));
    await screen.findByTestId('prompt-fill-preview');
    await user.click(screen.getByTestId('prompt-fill-copy'));
    expect(writeText).toHaveBeenCalledWith('Hello Ada!');
  });

  it('"Render & copy" completes both actions in a single click (composite-action contract)', async () => {
    seedLibraryEntry({
      id: 'p2e',
      project_id: 'p1',
      type: 'prompt',
      title: 'greet-2',
      body: 'Hello {{name}}!',
    });
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined);
    renderLibrary();
    await user.click(await screen.findByTestId('library-entry-row-p2e'));
    await user.click(screen.getByTestId('library-prompt-use'));
    const nameInput = await screen.findByTestId('prompt-var-name');
    await user.type(nameInput, 'Grace');
    // The label is "Render & copy" — one click must do both. No prior click on
    // prompt-fill-render. Confirms the renderAndCopy closure uses the awaited result
    // directly rather than reading stale `rendered` state.
    expect(screen.getByTestId('prompt-fill-copy').textContent).toContain('Render & copy');
    await user.click(screen.getByTestId('prompt-fill-copy'));
    expect(writeText).toHaveBeenCalledWith('Hello Grace!');
    expect(mockApi.fillPrompt).toHaveBeenCalled();
  });

  it('snippet quick-copy writes the body to clipboard', async () => {
    seedLibraryEntry({
      id: 'snip',
      project_id: 'p1',
      type: 'snippet',
      title: 'snip-1',
      body: 'pnpm test',
    });
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined);
    renderLibrary();
    await user.click(await screen.findByTestId('library-entry-row-snip'));
    await user.click(screen.getByTestId('library-snippet-copy'));
    expect(writeText).toHaveBeenCalledWith('pnpm test');
  });

  it('attach modal applies attach/detach diffs through the API', async () => {
    seedLibraryEntry({ id: 'n1', project_id: 'p1', type: 'note', title: 'my note' });
    seedItem({ id: 'i1', project_id: 'p1', title: 'first item' });
    seedItem({ id: 'i2', project_id: 'p1', title: 'second item' });
    const user = userEvent.setup();
    renderLibrary();
    await user.click(await screen.findByTestId('library-entry-row-n1'));
    await user.click(screen.getByTestId('library-note-attach'));
    await screen.findByTestId('attach-item-modal');
    await user.click(screen.getByTestId('attach-item-row-i1'));
    await user.click(screen.getByTestId('attach-item-apply'));
    expect(mockApi.attachLibraryNote).toHaveBeenCalledWith('p1', 'n1', 'i1');
  });

  it('editing the title PATCHes the entry', async () => {
    seedLibraryEntry({ id: 'e1', project_id: 'p1', type: 'note', title: 'original' });
    const user = userEvent.setup();
    renderLibrary();
    await user.click(await screen.findByTestId('library-entry-row-e1'));
    const title = screen.getByTestId('library-editor-title');
    await user.clear(title);
    await user.type(title, 'updated');
    title.blur();
    await waitFor(() => {
      expect(mockApi.updateLibraryEntry).toHaveBeenCalledWith('p1', 'e1', { title: 'updated' });
    });
  });

  it('attached items section renders for selected notes', async () => {
    seedLibraryEntry({ id: 'n1', project_id: 'p1', type: 'note', title: 'note' });
    seedItem({ id: 'i1', project_id: 'p1', title: 'linked item' });
    seedAttachment('i1', 'n1');
    const user = userEvent.setup();
    renderLibrary();
    await user.click(await screen.findByTestId('library-entry-row-n1'));
    await screen.findByTestId('library-attached-items');
    expect(screen.getByText('linked item')).toBeInTheDocument();
  });
});
