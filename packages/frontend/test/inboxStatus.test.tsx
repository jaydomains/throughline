import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { InboxStatus } from '../src/components/InboxStatus.js';
import { mockApi, resetMockApi, seedInbox } from './fixtures/mockApi.js';

beforeEach(() => resetMockApi());

describe('InboxStatus', () => {
  it('renders the toggle and opens the popover with queued / processed / failed counts', async () => {
    seedInbox({ id: 'q1', state: 'queued', original_path: '/inbox/p1__a.md' });
    seedInbox({ id: 'p1', state: 'processed', original_path: '/inbox/done.md' });
    seedInbox({ id: 'f1', state: 'failed', original_path: '/inbox/bad.md', error_text: 'empty_file' });
    const user = userEvent.setup();
    render(<InboxStatus />);
    await waitFor(() => expect(mockApi.getInboxQueue).toHaveBeenCalled());
    await user.click(screen.getByTestId('inbox-toggle'));
    expect(await screen.findByText('Queued: 1')).toBeInTheDocument();
    expect(screen.getByText('Processed: 1')).toBeInTheDocument();
    expect(screen.getByText('Failed: 1')).toBeInTheDocument();
  });

  it('Scan now triggers a backend scan + refresh', async () => {
    const user = userEvent.setup();
    render(<InboxStatus />);
    await waitFor(() => expect(mockApi.getInboxQueue).toHaveBeenCalled());
    await user.click(screen.getByTestId('inbox-toggle'));
    await user.click(screen.getByTestId('inbox-scan'));
    await waitFor(() => expect(mockApi.scanInbox).toHaveBeenCalled());
  });
});
