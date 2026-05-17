import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { ModalStackProvider } from '../src/keyboard/modalStack.js';
import { ProjectsView } from '../src/views/stubs.js';
import { mockApi, resetMockApi } from './fixtures/mockApi.js';

function mount(onChanged = vi.fn()) {
  return render(
    <MemoryRouter>
      <ModalStackProvider>
        <ProjectsView projects={[]} bundles={[]} onCreated={() => {}} onChanged={onChanged} />
      </ModalStackProvider>
    </MemoryRouter>,
  );
}

describe('Phase 16 (DoD) — project archive / unarchive / delete (SPEC §11)', () => {
  beforeEach(() => resetMockApi());

  it('archives then unarchives a project, keeping the app list in sync', async () => {
    const onChanged = vi.fn();
    mount(onChanged);
    await waitFor(() => expect(screen.getByTestId('project-card-p1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('project-archive-p1'));
    await waitFor(() =>
      expect(mockApi.updateProject).toHaveBeenCalledWith('p1', { state: 'archived' }),
    );
    await waitFor(() => expect(screen.getByTestId('project-archived-p1')).toBeInTheDocument());
    expect(onChanged).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('project-unarchive-p1'));
    await waitFor(() =>
      expect(mockApi.updateProject).toHaveBeenCalledWith('p1', { state: 'active' }),
    );
    await waitFor(() => expect(screen.queryByTestId('project-archived-p1')).toBeNull());
  });

  it('deletes a project only after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    mount();
    await waitFor(() => expect(screen.getByTestId('project-card-p1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('project-delete-p1'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(mockApi.deleteProject).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByTestId('project-delete-p1'));
    await waitFor(() => expect(mockApi.deleteProject).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(screen.queryByTestId('project-card-p1')).toBeNull());
    confirmSpy.mockRestore();
  });
});
