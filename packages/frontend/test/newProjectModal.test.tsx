import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ModalStackProvider } from '../src/keyboard/modalStack.js';
import type { Project } from '@throughline/shared';
import type { MethodologySummary } from '../src/api.js';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { NewProjectModal } from '../src/components/NewProjectModal.js';
import { mockApi, resetMockApi } from './fixtures/mockApi.js';

beforeEach(() => {
  resetMockApi();
});

const freeform: MethodologySummary = {
  status: 'loaded',
  bundle_id: 'freeform',
  identity: { name: 'freeform', version: '1.0.0', authority_precedence: [] },
  has_primary_unit: false,
  has_gates: false,
};

const rich: MethodologySummary = {
  status: 'loaded',
  bundle_id: 'rich',
  identity: { name: 'rich', version: '1.0.0', authority_precedence: [] },
  has_primary_unit: true,
  has_gates: true,
};

function renderModal(props: {
  open: boolean;
  onClose?: () => void;
  onCreated?: (p: Project) => void;
  bundles?: MethodologySummary[];
}) {
  const onClose = props.onClose ?? vi.fn();
  const onCreated = props.onCreated ?? vi.fn();
  const bundles = props.bundles ?? [freeform, rich];
  const utils = render(
    <MemoryRouter>
      <ModalStackProvider>
        <NewProjectModal
          open={props.open}
          onClose={onClose}
          onCreated={onCreated}
          bundles={bundles}
        />
      </ModalStackProvider>
    </MemoryRouter>,
  );
  return { ...utils, onClose, onCreated };
}

describe('NewProjectModal', () => {
  it('renders nothing when closed', () => {
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('defaults the bundle select to freeform when present', () => {
    renderModal({ open: true });
    const select = screen.getByTestId('new-project-bundle') as HTMLSelectElement;
    expect(select.value).toBe('freeform');
    expect(screen.getByText('freeform (1.0.0)')).toBeInTheDocument();
    expect(screen.getByText('rich (1.0.0)')).toBeInTheDocument();
  });

  it('falls back to the first loaded bundle when freeform is absent', () => {
    renderModal({ open: true, bundles: [rich] });
    const select = screen.getByTestId('new-project-bundle') as HTMLSelectElement;
    expect(select.value).toBe('rich');
  });

  it('disables submit until name and repo path are filled', async () => {
    const user = userEvent.setup();
    renderModal({ open: true });
    const submit = screen.getByTestId('new-project-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    await user.type(screen.getByTestId('new-project-name'), 'Alpha');
    expect(submit.disabled).toBe(true);
    await user.type(screen.getByTestId('new-project-repo'), '/tmp/alpha');
    expect(submit.disabled).toBe(false);
  });

  it('submits the form and fires onCreated with the new project', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    renderModal({ open: true, onCreated });
    await user.type(screen.getByTestId('new-project-name'), 'Alpha');
    await user.type(screen.getByTestId('new-project-repo'), '/tmp/alpha');
    await user.click(screen.getByTestId('new-project-submit'));
    await waitFor(() => expect(mockApi.createProject).toHaveBeenCalledTimes(1));
    expect(mockApi.createProject).toHaveBeenCalledWith({
      name: 'Alpha',
      repo_path: '/tmp/alpha',
      bundle_id: 'freeform',
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(onCreated.mock.calls[0]?.[0]).toMatchObject({ name: 'Alpha', repo_path: '/tmp/alpha' });
  });

  it('renders an inline error and keeps the modal open when the API rejects', async () => {
    const user = userEvent.setup();
    mockApi.createProject.mockRejectedValueOnce(new Error('POST /api/projects failed: 400 bundle_not_loaded'));
    const onCreated = vi.fn();
    const onClose = vi.fn();
    renderModal({ open: true, onCreated, onClose });
    await user.type(screen.getByTestId('new-project-name'), 'Alpha');
    await user.type(screen.getByTestId('new-project-repo'), '/tmp/alpha');
    await user.click(screen.getByTestId('new-project-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('new-project-error')).toHaveTextContent('bundle_not_loaded'),
    );
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when Esc is pressed via the modal stack', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ open: true, onClose });
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is clicked but not the modal body', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ open: true, onClose });
    // Click on the modal body should not close.
    await user.click(screen.getByRole('heading', { name: 'New project' }));
    expect(onClose).not.toHaveBeenCalled();
    // Click on the backdrop should close. userEvent.click triggers mousedown.
    const backdrop = screen.getByRole('dialog');
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
