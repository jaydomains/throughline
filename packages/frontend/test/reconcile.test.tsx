import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModalStackProvider } from '../src/keyboard/modalStack.js';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { ReconcileComposer } from '../src/components/ReconcileComposer.js';
import { ReconcileModal } from '../src/components/ReconcileModal.js';
import { mockApi, resetMockApi, seedItem } from './fixtures/mockApi.js';
import type { ReconcileRun } from '@throughline/shared';

beforeEach(() => resetMockApi());

function renderComposer() {
  return render(
    <ModalStackProvider>
      <ReconcileComposer projectId="p1" sessionId="s1" />
    </ModalStackProvider>,
  );
}

const mockRun: ReconcileRun = {
  id: 'rc1',
  project_id: 'p1',
  session_id: 's1',
  source: 'manual',
  status: 'pending',
  raw_text: '',
  created_at: '',
  resolved_at: null,
  diff: {
    source: 'manual',
    extractor: 'heuristic',
    session_id: 's1',
    extractor_note: null,
    rows: [
      {
        category: 'completed',
        row_id: 'r1',
        item_id: 'i1',
        current_status: 'open',
        next_status: 'done',
        current_title: 'Wire up login',
        evidence: 'login is done',
      },
      {
        category: 'new',
        row_id: 'r2',
        type: 'task',
        status: 'open',
        title: 'Audit Stripe webhook',
        description: '',
        tags: [],
        evidence: 'audit stripe webhook',
      },
      {
        category: 'contradicted',
        row_id: 'r3',
        item_id: 'i2',
        current_title: 'Crop avatars',
        reason: 'broken under safari',
        evidence: 'crop avatars is broken',
      },
      {
        category: 'no_change',
        row_id: 'r4',
        item_id: 'i3',
        current_title: 'Spike on caching',
        evidence: 'spike was mentioned',
      },
    ],
  },
};

describe('ReconcileModal (SPEC §7.7, T-D35)', () => {
  it('renders sections for each category present in the diff', async () => {
    render(
      <ModalStackProvider>
        <ReconcileModal
          open
          run={mockRun}
          projectId="p1"
          onClose={() => undefined}
          onApplied={() => undefined}
        />
      </ModalStackProvider>,
    );
    expect(screen.getByTestId('reconcile-section-completed')).toBeInTheDocument();
    expect(screen.getByTestId('reconcile-section-new')).toBeInTheDocument();
    expect(screen.getByTestId('reconcile-section-contradicted')).toBeInTheDocument();
    expect(screen.getByTestId('reconcile-section-no_change')).toBeInTheDocument();
    // edited and blocker sections are not in the fixture and should be absent.
    expect(screen.queryByTestId('reconcile-section-edited')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reconcile-section-blocker')).not.toBeInTheDocument();
  });

  it('contradicted rows display the spawns-drift-signal hint', () => {
    render(
      <ModalStackProvider>
        <ReconcileModal
          open
          run={mockRun}
          projectId="p1"
          onClose={() => undefined}
          onApplied={() => undefined}
        />
      </ModalStackProvider>,
    );
    expect(screen.getByTestId('reconcile-row-r3-drift-hint')).toBeInTheDocument();
  });

  it('unchecking a row routes a reject decision into the apply payload', async () => {
    const user = userEvent.setup();
    const onApplied = vi.fn();
    render(
      <ModalStackProvider>
        <ReconcileModal
          open
          run={mockRun}
          projectId="p1"
          onClose={() => undefined}
          onApplied={onApplied}
        />
      </ModalStackProvider>,
    );
    const checkboxes = screen.getAllByLabelText('Accept this row');
    await user.click(checkboxes[1]!); // reject the "new" row
    await user.click(screen.getByTestId('reconcile-apply'));
    await waitFor(() => expect(mockApi.applyReconcile).toHaveBeenCalled());
    const args = mockApi.applyReconcile.mock.calls[0]![1];
    const rejected = Object.entries(args.decisions ?? {})
      .filter(([, d]) => d === 'reject')
      .map(([id]) => id);
    expect(rejected).toContain('r2');
    expect(onApplied).toHaveBeenCalled();
  });

  it('editing the next title on a "new" row carries through to apply', async () => {
    const user = userEvent.setup();
    render(
      <ModalStackProvider>
        <ReconcileModal
          open
          run={mockRun}
          projectId="p1"
          onClose={() => undefined}
          onApplied={() => undefined}
        />
      </ModalStackProvider>,
    );
    const titleInput = screen.getByTestId('reconcile-row-r2-title') as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, 'Audit Stripe webhook (v2)');
    await user.click(screen.getByTestId('reconcile-apply'));
    await waitFor(() => expect(mockApi.applyReconcile).toHaveBeenCalled());
    const args = mockApi.applyReconcile.mock.calls[0]![1];
    const newRow = args.diff.rows.find((r) => r.row_id === 'r2');
    expect(newRow?.category).toBe('new');
    if (newRow?.category === 'new') {
      expect(newRow.title).toBe('Audit Stripe webhook (v2)');
    }
  });
});

describe('ReconcileComposer end-to-end', () => {
  it('opens, proposes, and surfaces the review modal with category sections', async () => {
    const user = userEvent.setup();
    seedItem({ id: 'i1', project_id: 'p1', title: 'Wire up login' });
    renderComposer();
    await user.click(screen.getByTestId('reconcile-open'));
    expect(await screen.findByTestId('reconcile-composer-modal')).toBeInTheDocument();
    await user.type(
      screen.getByTestId('reconcile-textarea'),
      'Wire up login is done.\n\nNew task: audit stripe webhook',
    );
    await user.click(screen.getByTestId('reconcile-submit'));
    await waitFor(() => expect(mockApi.proposeReconcile).toHaveBeenCalled());
    expect(await screen.findByTestId('reconcile-modal')).toBeInTheDocument();
    expect(screen.getByTestId('reconcile-section-completed')).toBeInTheDocument();
    expect(screen.getByTestId('reconcile-section-new')).toBeInTheDocument();
  });

  it('cancelling the review modal discards the pending run', async () => {
    const user = userEvent.setup();
    seedItem({ id: 'i1', project_id: 'p1', title: 'Wire up login' });
    renderComposer();
    await user.click(screen.getByTestId('reconcile-open'));
    await user.type(screen.getByTestId('reconcile-textarea'), 'Wire up login is done.');
    await user.click(screen.getByTestId('reconcile-submit'));
    await screen.findByTestId('reconcile-modal');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(mockApi.discardReconcileRun).toHaveBeenCalled());
  });
});
