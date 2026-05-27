import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { BootstrapReviewModal } from '../src/components/BootstrapReviewModal.js';
import { ModalStackProvider } from '../src/keyboard/modalStack.js';
import { mockApi, resetMockApi } from './fixtures/mockApi.js';

function renderModal(ui: React.ReactNode) {
  return render(<ModalStackProvider>{ui}</ModalStackProvider>);
}

describe('BootstrapReviewModal — Phase 20 Slice 4 (C-D20 surface 5)', () => {
  beforeEach(() => resetMockApi());

  it('renders nothing when open=false', () => {
    const { container } = renderModal(
      <BootstrapReviewModal
        open={false}
        projectId="p1"
        lastImport={null}
        lastImportFile={null}
        onClose={() => undefined}
      />,
    );
    // ModalStackProvider renders nothing of its own; the modal returns null.
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('loads stale rows from the GET endpoint on open and lists them', async () => {
    mockApi.listBootstrapConflicts.mockResolvedValueOnce({
      result: {
        project_id: 'p1',
        stale: [
          { entity_type: 'item', entity_id: 'i1', bootstrap_id: 'roadmap:phase-1', title: 'Item 1' },
          { entity_type: 'library', entity_id: 'l1', bootstrap_id: 'decision:T-D1', title: 'Decision 1' },
        ],
      },
    });
    renderModal(
      <BootstrapReviewModal
        open
        projectId="p1"
        lastImport={null}
        lastImportFile={null}
        onClose={() => undefined}
      />,
    );
    await waitFor(() => expect(screen.getByText(/Stale rows \(2\)/)).toBeTruthy());
    expect(screen.getByText('Item 1')).toBeTruthy();
    expect(screen.getByText('Decision 1')).toBeTruthy();
  });

  it('renders in-flight conflicts from lastImport with proposed-row lookups from lastImportFile', async () => {
    mockApi.listBootstrapConflicts.mockResolvedValueOnce({
      result: { project_id: 'p1', stale: [] },
    });
    renderModal(
      <BootstrapReviewModal
        open
        projectId="p1"
        lastImport={{
          project_id: 'p1',
          rows: [
            {
              bootstrap_id: 'roadmap:phase-1',
              entity_type: 'item',
              entity_id: 'i1',
              status: 'conflict',
              reason: 'user_edits_since_last_bootstrap',
            },
          ],
          counts: { new: 0, reimported: 0, conflict: 1, stale_flagged: 0 },
        }}
        lastImportFile={{
          version: 1,
          items: [
            {
              bootstrap_id: 'roadmap:phase-1',
              source_type: 'roadmap',
              title: 'P1',
              type: 'task',
              status: 'open',
            },
          ],
        }}
        onClose={() => undefined}
      />,
    );
    await waitFor(() => expect(screen.getByText(/Conflicts \(1\)/)).toBeTruthy());
    // Proposed row was found in lastImportFile so "Take theirs" is not disabled.
    const takeTheirs = screen.getAllByLabelText(/Take theirs/)[0]!;
    expect((takeTheirs as HTMLInputElement).disabled).toBe(false);
  });

  it('disables Take theirs when the proposed row is not available', async () => {
    mockApi.listBootstrapConflicts.mockResolvedValueOnce({
      result: { project_id: 'p1', stale: [] },
    });
    renderModal(
      <BootstrapReviewModal
        open
        projectId="p1"
        lastImport={{
          project_id: 'p1',
          rows: [
            {
              bootstrap_id: 'roadmap:phase-1',
              entity_type: 'item',
              entity_id: 'i1',
              status: 'conflict',
            },
          ],
          counts: { new: 0, reimported: 0, conflict: 1, stale_flagged: 0 },
        }}
        lastImportFile={null}
        onClose={() => undefined}
      />,
    );
    await waitFor(() => expect(screen.getByText(/Conflicts \(1\)/)).toBeTruthy());
    const takeTheirs = screen.getAllByLabelText(/Take theirs/)[0]!;
    expect((takeTheirs as HTMLInputElement).disabled).toBe(true);
  });

  it('applies resolutions through the resolve endpoint when the user clicks Apply', async () => {
    mockApi.listBootstrapConflicts.mockResolvedValueOnce({
      result: {
        project_id: 'p1',
        stale: [
          { entity_type: 'item', entity_id: 'i1', bootstrap_id: 'roadmap:phase-2', title: 'Stale item' },
        ],
      },
    });
    const onResolved = vi.fn();
    const onClose = vi.fn();
    renderModal(
      <BootstrapReviewModal
        open
        projectId="p1"
        lastImport={null}
        lastImportFile={null}
        onClose={onClose}
        onResolved={onResolved}
      />,
    );
    await waitFor(() => expect(screen.getByText(/Stale rows \(1\)/)).toBeTruthy());
    // Pick 'delete' on the stale row.
    fireEvent.click(screen.getByLabelText(/Delete/));
    fireEvent.click(screen.getByText(/Apply resolutions/));
    await waitFor(() => expect(mockApi.resolveBootstrap).toHaveBeenCalled());
    const [, body] = mockApi.resolveBootstrap.mock.calls[0]!;
    expect(body.stale).toEqual([
      {
        entity_type: 'item',
        entity_id: 'i1',
        bootstrap_id: 'roadmap:phase-2',
        action: 'delete',
      },
    ]);
    await waitFor(() => expect(onResolved).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('preserves user conflict selections across parent re-renders (initialized-flag guard)', async () => {
    // Regression for Gitar PR #56 finding: an unmemoized parent re-rendering
    // with new lastImport/lastImportFile object references used to re-fire
    // the init effect and wipe the user's per-row decisions. The fix guards
    // re-initialization with an `initialized` state flag.
    mockApi.listBootstrapConflicts.mockResolvedValueOnce({
      result: { project_id: 'p1', stale: [] },
    });
    function Wrapper({ pass }: { pass: number }) {
      return (
        <BootstrapReviewModal
          open
          projectId="p1"
          lastImport={{
            project_id: 'p1',
            rows: [
              { bootstrap_id: 'roadmap:phase-1', entity_type: 'item', entity_id: 'i1', status: 'conflict' },
            ],
            counts: { new: 0, reimported: 0, conflict: 1, stale_flagged: 0 },
          }}
          lastImportFile={{
            version: 1,
            items: [
              { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', title: `pass ${pass}`, type: 'task', status: 'open' },
            ],
          }}
          onClose={() => undefined}
        />
      );
    }
    // Use the `wrapper` option so the ModalStackProvider persists across
    // rerender calls (passing the provider into renderModal would be
    // replaced by rerender's new children).
    const { rerender } = render(<Wrapper pass={1} />, { wrapper: ModalStackProvider });
    await waitFor(() => expect(screen.getByText(/Conflicts \(1\)/)).toBeTruthy());
    // User picks "Keep mine" on the conflict row.
    fireEvent.click(screen.getAllByLabelText(/Keep mine/)[0]!);
    const radio = screen.getAllByLabelText(/Keep mine/)[0] as HTMLInputElement;
    expect(radio.checked).toBe(true);
    // Parent re-renders with new object references for lastImport / lastImportFile;
    // the modal should NOT re-fire the init effect and lose the user's selection.
    rerender(<Wrapper pass={2} />);
    // After the re-render the same radio is still checked.
    const radioAfter = screen.getAllByLabelText(/Keep mine/)[0] as HTMLInputElement;
    expect(radioAfter.checked).toBe(true);
    // listBootstrapConflicts was called exactly once across both renders.
    expect(mockApi.listBootstrapConflicts).toHaveBeenCalledTimes(1);
  });

  it('surfaces resolve errors without closing the modal', async () => {
    mockApi.listBootstrapConflicts.mockResolvedValueOnce({
      result: {
        project_id: 'p1',
        stale: [
          { entity_type: 'item', entity_id: 'i1', bootstrap_id: 'roadmap:phase-2', title: 'Stale item' },
        ],
      },
    });
    mockApi.resolveBootstrap.mockResolvedValueOnce({
      result: { applied: 0, noop: 0, errors: [{ entity_id: 'i1', message: 'entity_not_found' }] },
    });
    const onClose = vi.fn();
    renderModal(
      <BootstrapReviewModal
        open
        projectId="p1"
        lastImport={null}
        lastImportFile={null}
        onClose={onClose}
      />,
    );
    await waitFor(() => expect(screen.getByText(/Stale rows \(1\)/)).toBeTruthy());
    fireEvent.click(screen.getByLabelText(/Delete/));
    fireEvent.click(screen.getByText(/Apply resolutions/));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/entity_not_found/));
    // Modal stayed open because of the error.
    expect(onClose).not.toHaveBeenCalled();
  });
});
