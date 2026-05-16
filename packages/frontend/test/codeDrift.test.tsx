import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Item } from '@throughline/shared';
import { ItemRow } from '../src/components/ItemRow.js';
import { DriftInbox } from '../src/views/DriftInbox.js';
import { mockApi, resetMockApi } from './fixtures/mockApi.js';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

function makeItem(over: Partial<Item>): Item {
  return {
    id: 'i1',
    project_id: 'p1',
    type: 'task',
    title: 'an item',
    description: '',
    status: 'done',
    blocker_text: null,
    parent_id: null,
    branch_ref: null,
    tags: [],
    blockers: [],
    session_ids: [],
    methodology_context: {
      primary_unit_refs: [],
      phase_refs: [],
      anchor_citations: [],
      marker_refs: [],
    },
    methodology_drift: false,
    code_drift_tier: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-05-16T00:00:00.000Z',
    ...over,
  };
}

beforeEach(() => resetMockApi());

describe('Phase 10 — code-drift item badge (SPEC §7.14)', () => {
  it('renders the tier badge only when the item carries a strong code-drift tier', () => {
    const { rerender } = render(
      <ul>
        <ItemRow
          projectId="p1"
          item={makeItem({ code_drift_tier: 'tier-1' })}
          staleDays={9999}
          selected={false}
          siblings={['i1']}
          onSelect={() => {}}
          onChanged={() => {}}
        />
      </ul>,
    );
    expect(screen.getByTestId('item-code-drift-i1')).toBeInTheDocument();
    rerender(
      <ul>
        <ItemRow
          projectId="p1"
          item={makeItem({ code_drift_tier: null })}
          staleDays={9999}
          selected={false}
          siblings={['i1']}
          onSelect={() => {}}
          onChanged={() => {}}
        />
      </ul>,
    );
    expect(screen.queryByTestId('item-code-drift-i1')).not.toBeInTheDocument();
  });
});

describe('Phase 10 — drift inbox (T-D21)', () => {
  it('lists weak signals with re-verify / reopen / dismiss actions and a both-stream count', async () => {
    mockApi.getDriftInbox.mockResolvedValue({
      signals: [
        {
          id: 's1',
          project_id: 'p1',
          stream: 'code',
          category: 'tier-4',
          item_id: 'i1',
          reason: 'looks like a duplicate of a done item',
          created_at: '2026-05-16T00:00:00.000Z',
        },
        {
          id: 's2',
          project_id: 'p1',
          stream: 'discipline',
          category: 'banned',
          item_id: null,
          reason: 'banned string',
          created_at: '2026-05-16T00:00:00.000Z',
        },
      ],
      total_count: 2,
      code_count: 1,
      discipline_count: 1,
    });
    render(
      <MemoryRouter initialEntries={['/projects/p1/drift-inbox']}>
        <Routes>
          <Route path="/projects/:id/drift-inbox" element={<DriftInbox />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('drift-inbox-total')).toHaveTextContent('2'));
    expect(screen.getByTestId('drift-signal-s1')).toBeInTheDocument();
    expect(screen.getByTestId('drift-signal-s2')).toBeInTheDocument();
    expect(screen.getAllByText('Re-verify (AI)')).toHaveLength(2);
  });
});
