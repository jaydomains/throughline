import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModalStackProvider } from '../src/keyboard/modalStack.js';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { DumpZone } from '../src/components/DumpZone.js';
import { mockApi, resetMockApi } from './fixtures/mockApi.js';
import type { ItemPolicy, Session } from '@throughline/shared';

beforeEach(() => resetMockApi());

const freeformPolicy: ItemPolicy = {
  bundle_id: 'freeform',
  types: ['task'],
  statuses: ['open', 'done'],
  boards: [{ id: 'tasks', label: 'Tasks', type: 'task' }],
};

const sessions: Session[] = [
  {
    id: 's1',
    project_id: 'p1',
    name: 'wave 1',
    branch_ref: null,
    context: null,
    settings_json: {},
    created_at: '',
    updated_at: '',
  },
  {
    id: 's2',
    project_id: 'p1',
    name: 'inbox',
    branch_ref: null,
    context: null,
    settings_json: {},
    created_at: '',
    updated_at: '',
  },
];

function renderDumpZone(props: Partial<React.ComponentProps<typeof DumpZone>> = {}) {
  return render(
    <ModalStackProvider>
      <DumpZone
        projectId="p1"
        target="session"
        policy={freeformPolicy}
        sessions={sessions}
        defaultSessionId="s1"
        {...props}
      />
    </ModalStackProvider>,
  );
}

describe('DumpZone + review modal (T-D5, §7.6)', () => {
  it('proposes on submit and opens the review modal with the returned items', async () => {
    const user = userEvent.setup();
    renderDumpZone();
    await user.type(screen.getByTestId('dump-zone-textarea'), 'first task\n\nsecond task');
    await user.click(screen.getByTestId('dump-zone-submit'));
    await waitFor(() => expect(mockApi.proposeDumpZone).toHaveBeenCalled());
    expect(await screen.findByTestId('dump-zone-review-modal')).toBeInTheDocument();
    expect(screen.getByTestId('dump-zone-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('dump-zone-row-1')).toBeInTheDocument();
  });

  it('lets the user cross-route an item to a different session before apply', async () => {
    const user = userEvent.setup();
    renderDumpZone();
    await user.type(screen.getByTestId('dump-zone-textarea'), 'A\n\nB');
    await user.click(screen.getByTestId('dump-zone-submit'));
    await screen.findByTestId('dump-zone-review-modal');
    // Re-route the first row to s2.
    const sessionSelect = screen.getByTestId('dump-zone-row-0-session') as HTMLSelectElement;
    await user.selectOptions(sessionSelect, 's2');
    await user.click(screen.getByTestId('dump-zone-apply'));
    await waitFor(() => expect(mockApi.applyDumpZone).toHaveBeenCalled());
    const call = mockApi.applyDumpZone.mock.calls[0]!;
    const applyArgs = call[1];
    expect(applyArgs.payload.items[0]!.target_session_id).toBe('s2');
  });

  it('discards a row by unchecking "Keep" and the apply payload omits it', async () => {
    const user = userEvent.setup();
    renderDumpZone();
    await user.type(screen.getByTestId('dump-zone-textarea'), 'A\n\nB\n\nC');
    await user.click(screen.getByTestId('dump-zone-submit'));
    await screen.findByTestId('dump-zone-review-modal');
    const checkboxes = screen.getAllByLabelText('Keep this item');
    await user.click(checkboxes[1]!);
    await user.click(screen.getByTestId('dump-zone-apply'));
    await waitFor(() => expect(mockApi.applyDumpZone).toHaveBeenCalled());
    const applyArgs = mockApi.applyDumpZone.mock.calls[0]![1];
    const discardedIds = Object.entries(applyArgs.decisions ?? {})
      .filter(([, decision]) => decision === 'discard')
      .map(([id]) => id);
    expect(discardedIds).toHaveLength(1);
  });

  it('cancel discards the pending proposal', async () => {
    const user = userEvent.setup();
    renderDumpZone();
    await user.type(screen.getByTestId('dump-zone-textarea'), 'A');
    await user.click(screen.getByTestId('dump-zone-submit'));
    await screen.findByTestId('dump-zone-review-modal');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(mockApi.discardProposal).toHaveBeenCalled());
  });

  it('library target shows library rows instead of session rows', async () => {
    const user = userEvent.setup();
    renderDumpZone({ target: 'library' });
    await user.type(screen.getByTestId('dump-zone-textarea'), 'note about X');
    await user.click(screen.getByTestId('dump-zone-submit'));
    await screen.findByTestId('dump-zone-review-modal');
    expect(screen.getByTestId('dump-zone-library-rows')).toBeInTheDocument();
    expect(screen.queryByTestId('dump-zone-session-rows')).not.toBeInTheDocument();
  });
});
