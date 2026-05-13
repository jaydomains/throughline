import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { Scratchpad } from '../src/components/Scratchpad.js';
import { mockApi, resetMockApi } from './fixtures/mockApi.js';

beforeEach(() => resetMockApi());

describe('Scratchpad (T-D20)', () => {
  it('opens the panel, saves a jot, and clears the textarea', async () => {
    const user = userEvent.setup();
    render(<Scratchpad activeProjectId="p1" />);
    await user.click(screen.getByTestId('scratchpad-toggle'));
    await user.type(screen.getByTestId('scratchpad-input'), 'remember the milk');
    await user.click(screen.getByTestId('scratchpad-save'));
    await waitFor(() => expect(mockApi.createScratchpadJot).toHaveBeenCalledWith('p1', 'remember the milk'));
    expect((screen.getByTestId('scratchpad-input') as HTMLTextAreaElement).value).toBe('');
  });

  it('disables save until activeProjectId is set', async () => {
    const user = userEvent.setup();
    render(<Scratchpad activeProjectId={null} />);
    await user.click(screen.getByTestId('scratchpad-toggle'));
    expect((screen.getByTestId('scratchpad-input') as HTMLTextAreaElement).disabled).toBe(true);
  });

  it('Cmd+Enter saves without clicking', async () => {
    const user = userEvent.setup();
    render(<Scratchpad activeProjectId="p1" />);
    await user.click(screen.getByTestId('scratchpad-toggle'));
    const input = screen.getByTestId('scratchpad-input');
    await user.type(input, 'a thought');
    await user.keyboard('{Meta>}{Enter}{/Meta}');
    await waitFor(() => expect(mockApi.createScratchpadJot).toHaveBeenCalled());
  });

  it('does not call AI extraction (no review modal)', async () => {
    const user = userEvent.setup();
    render(<Scratchpad activeProjectId="p1" />);
    await user.click(screen.getByTestId('scratchpad-toggle'));
    await user.type(screen.getByTestId('scratchpad-input'), 'thought');
    await user.click(screen.getByTestId('scratchpad-save'));
    await waitFor(() => expect(mockApi.createScratchpadJot).toHaveBeenCalled());
    expect(mockApi.proposeDumpZone).not.toHaveBeenCalled();
    expect(mockApi.applyDumpZone).not.toHaveBeenCalled();
  });
});
