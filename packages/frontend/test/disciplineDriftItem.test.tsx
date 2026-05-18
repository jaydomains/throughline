import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Item } from '@throughline/shared';
import { ItemRow } from '../src/components/ItemRow.js';

function makeItem(over: Partial<Item>): Item {
  return {
    id: 'i1',
    project_id: 'p1',
    type: 'task',
    title: 'an item',
    description: '',
    status: 'open',
    blocker_text: null,
    parent_id: null,
    branch_ref: null,
    tags: [],
    blockers: [],
    mentions: [],
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

function renderRow(item: Item) {
  return render(
    <ul>
      <ItemRow
        projectId="p1"
        item={item}
        staleDays={9999}
        selected={false}
        siblings={[item.id]}
        onSelect={() => {}}
        onChanged={() => {}}
      />
    </ul>,
  );
}

describe('Phase 9 — item methodology-drift indicator (C-D7, §7.14)', () => {
  it('shows the indicator only when the item inherits discipline drift', () => {
    renderRow(makeItem({ methodology_drift: true }));
    expect(screen.getByTestId('item-drift-i1')).toBeInTheDocument();
  });

  it('hides the indicator when the item has no associated drift', () => {
    renderRow(makeItem({ methodology_drift: false }));
    expect(screen.queryByTestId('item-drift-i1')).not.toBeInTheDocument();
  });
});
