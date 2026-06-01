import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { SpecAssistPanel } from '../src/views/LibraryView.js';
import { mockApi, resetMockApi } from './fixtures/mockApi.js';

describe('E20b — project-spec LLM-assist (user-mediated draft → accept/reject)', () => {
  beforeEach(() => resetMockApi());

  it('drafts a revision and applies it only on Accept (never auto-edits)', async () => {
    const onAccept = vi.fn();
    render(<SpecAssistPanel projectId="p1" onAccept={onAccept} />);

    fireEvent.click(screen.getByTestId('spec-assist-draft'));
    await waitFor(() => expect(screen.getByTestId('spec-assist-preview')).toBeTruthy());
    // The draft is only previewed — nothing applied yet.
    expect(onAccept).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('spec-assist-accept'));
    expect(onAccept).toHaveBeenCalledWith('# Project Spec\n\nMock revised spec.');
    // Preview clears after accepting.
    expect(screen.queryByTestId('spec-assist-preview')).toBeNull();
  });

  it('Reject discards the draft without applying it', async () => {
    const onAccept = vi.fn();
    render(<SpecAssistPanel projectId="p1" onAccept={onAccept} />);
    fireEvent.click(screen.getByTestId('spec-assist-draft'));
    await waitFor(() => expect(screen.getByTestId('spec-assist-preview')).toBeTruthy());
    fireEvent.click(screen.getByTestId('spec-assist-reject'));
    expect(onAccept).not.toHaveBeenCalled();
    expect(screen.queryByTestId('spec-assist-preview')).toBeNull();
  });

  it('discloses an unavailable AI honestly — no draft, no fabrication (T-D60)', async () => {
    mockApi.draftProjectSpec.mockResolvedValueOnce({
      result: { draft: null, used_ai: false, status: 'unavailable' },
    });
    const onAccept = vi.fn();
    render(<SpecAssistPanel projectId="p1" onAccept={onAccept} />);
    fireEvent.click(screen.getByTestId('spec-assist-draft'));
    await waitFor(() => expect(screen.getByTestId('spec-assist-error')).toBeTruthy());
    expect(screen.getByTestId('spec-assist-error').textContent).toMatch(/not configured/i);
    expect(screen.queryByTestId('spec-assist-preview')).toBeNull();
    expect(onAccept).not.toHaveBeenCalled();
  });
});
