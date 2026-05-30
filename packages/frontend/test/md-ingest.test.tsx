import { describe, it, expect, beforeEach, vi } from 'vitest';
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
  seedLibraryEntry,
  seedMdFolder,
  seedMdScan,
} from './fixtures/mockApi.js';

beforeEach(() => {
  resetMockApi();
});

function renderLibrary(projectId = 'p1') {
  return render(
    <ModalStackProvider>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/projects/${projectId}/library`]}>
        <Routes>
          <Route path="/projects/:id/library" element={<LibraryView />} />
        </Routes>
      </MemoryRouter>
    </ModalStackProvider>,
  );
}

describe('MdFolderManager (Phase 6c)', () => {
  it('lists opted-in folders, scans, and ingests selected docs into the library', async () => {
    seedMdFolder({ id: 'f1', project_id: 'p1', rel_path: 'docs' });
    seedMdScan('f1', {
      folder_id: 'f1',
      truncated: false,
      candidates: [
        { rel_path: 'docs/a.md', size: 10, status: 'new', entry_id: null },
        { rel_path: 'docs/b.md', size: 20, status: 'unchanged', entry_id: 'old' },
      ],
    });
    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByTestId('md-folder-toggle'));
    expect(await screen.findByTestId('md-folder-f1')).toBeInTheDocument();

    await user.click(screen.getByTestId('md-folder-scan-f1'));
    // 'new' pre-selected, 'unchanged' not.
    const newCheck = (await screen.findByTestId(
      'md-candidate-check-docs/a.md',
    )) as HTMLInputElement;
    const unchangedCheck = screen.getByTestId(
      'md-candidate-check-docs/b.md',
    ) as HTMLInputElement;
    expect(newCheck.checked).toBe(true);
    expect(unchangedCheck.checked).toBe(false);

    await user.click(screen.getByTestId('md-ingest-btn'));

    await waitFor(() =>
      expect(mockApi.ingestMd).toHaveBeenCalledWith('p1', 'f1', ['docs/a.md']),
    );
    // Refresh pulled the newly-created imported-doc entry into the sidebar.
    expect(await screen.findByText('a.md')).toBeInTheDocument();
  });

  it('rejects an out-of-repo folder add with an error message', async () => {
    mockApi.addMdFolder.mockRejectedValueOnce(new Error('folder_outside_repo'));
    const user = userEvent.setup();
    renderLibrary();
    await user.click(await screen.findByTestId('md-folder-toggle'));
    await user.type(screen.getByTestId('md-folder-path-input'), '../escape');
    await user.click(screen.getByTestId('md-folder-add-btn'));
    expect(await screen.findByTestId('md-folder-error')).toBeInTheDocument();
  });

  it('imported-doc entry exposes track-source toggle and re-ingest', async () => {
    seedLibraryEntry({
      id: 'd1',
      project_id: 'p1',
      type: 'imported_doc',
      title: 'guide.md',
      body: '# Guide',
      summary: 'A guide.',
      source_path: 'docs/guide.md',
      source_tracked: false,
      source_hash: 'h1',
      ingested_at: '2026-05-15T00:00:00.000Z',
    });
    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByText('guide.md'));
    expect(await screen.findByTestId('library-editor-source')).toBeInTheDocument();

    const toggle = screen.getByTestId('library-source-track-toggle') as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    await user.click(toggle);
    await waitFor(() =>
      expect(mockApi.setMdTracked).toHaveBeenCalledWith('p1', 'd1', true),
    );

    await user.click(screen.getByTestId('library-source-reingest'));
    await waitFor(() => expect(mockApi.reingestMd).toHaveBeenCalledWith('p1', 'd1'));
  });
});
