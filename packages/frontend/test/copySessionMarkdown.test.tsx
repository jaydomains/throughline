import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Item, Session } from '@throughline/shared';
import { CopySessionMarkdown } from '../src/components/CopySessionMarkdown.js';
import { sessionToMarkdown } from '../src/lib/sessionMarkdown.js';

const session: Session = {
  id: 's1',
  project_id: 'p1',
  name: 'Phase 7 work',
  branch_ref: null,
  context: 'Capture surfaces.',
  settings_json: {},
  created_at: '2026-06-07T00:00:00Z',
  updated_at: '2026-06-07T00:00:00Z',
};

const items: Item[] = [
  {
    id: 'a',
    project_id: 'p1',
    type: 'task',
    title: 'Wire scratchpad',
    description: 'Scratch to item.',
    status: 'open',
    blocker_text: null,
    parent_id: null,
    branch_ref: null,
    tags: ['capture'],
    blockers: [],
    mentions: [],
    session_ids: ['s1'],
    methodology_context: { primary_unit_refs: [], phase_refs: [], anchor_citations: [], marker_refs: [] },
    methodology_drift: false,
    code_drift_tier: null,
    created_at: '2026-06-07T00:00:00Z',
    updated_at: '2026-06-07T00:00:00Z',
  },
];

describe('CopySessionMarkdown (SPEC §7.20 fast-path)', () => {
  it('copies the serialised session markdown to the clipboard and confirms', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    render(<CopySessionMarkdown session={session} items={items} />);
    const btn = screen.getByTestId('copy-session-markdown');
    expect(btn.textContent).toBe('Copy as markdown');

    await user.click(btn);

    expect(writeText).toHaveBeenCalledWith(sessionToMarkdown({ name: session.name, context: session.context }, items));
    expect(screen.getByTestId('copy-session-markdown').textContent).toBe('Copied!');
  });

  it('surfaces a retry label when the clipboard write fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));

    render(<CopySessionMarkdown session={session} items={items} />);
    await user.click(screen.getByTestId('copy-session-markdown'));

    expect(screen.getByTestId('copy-session-markdown').textContent).toBe('Copy failed — retry');
  });
});
