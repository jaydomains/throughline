import { describe, it, expect } from 'vitest';
import type { Item } from '@throughline/shared';
import { sessionToMarkdown } from '../src/lib/sessionMarkdown.js';

function makeItem(over: Partial<Item> & Pick<Item, 'id' | 'title'>): Item {
  return {
    project_id: 'p1',
    type: 'task',
    description: '',
    status: 'open',
    blocker_text: null,
    parent_id: null,
    branch_ref: null,
    tags: [],
    blockers: [],
    mentions: [],
    session_ids: ['s1'],
    methodology_context: {
      primary_unit_refs: [],
      phase_refs: [],
      anchor_citations: [],
      marker_refs: [],
    },
    methodology_drift: false,
    code_drift_tier: null,
    created_at: '2026-06-07T00:00:00Z',
    updated_at: '2026-06-07T00:00:00Z',
    ...over,
  };
}

describe('sessionToMarkdown (SPEC §7.20 fast-path)', () => {
  it('renders a header, item count, and context', () => {
    const md = sessionToMarkdown(
      { name: 'Phase 7 work', context: 'Wiring the capture surfaces.' },
      [makeItem({ id: 'a', title: 'Wire scratchpad' })],
    );
    expect(md).toContain('# Phase 7 work');
    expect(md).toContain('_Throughline session export — 1 item._');
    expect(md).toContain('Wiring the capture surfaces.');
  });

  it('pluralises the item count and falls back on an empty name', () => {
    const md = sessionToMarkdown({ name: '   ', context: null }, [
      makeItem({ id: 'a', title: 'A' }),
      makeItem({ id: 'b', title: 'B' }),
    ]);
    expect(md).toContain('# Untitled session');
    expect(md).toContain('— 2 items._');
  });

  it('handles an empty session', () => {
    const md = sessionToMarkdown({ name: 'Empty', context: null }, []);
    expect(md).toContain('# Empty');
    expect(md).toContain('_No items in this session._');
    expect(md).not.toContain('##');
  });

  it('groups items by type with a per-group count and title-cased heading', () => {
    const md = sessionToMarkdown({ name: 'S', context: null }, [
      makeItem({ id: 'a', title: 'T1', type: 'task' }),
      makeItem({ id: 'b', title: 'T2', type: 'task' }),
      makeItem({ id: 'c', title: 'B1', type: 'bug_report' }),
    ]);
    expect(md).toContain('## Task (2)');
    expect(md).toContain('## Bug Report (1)');
  });

  it('renders status, description, tags, and branch per item', () => {
    const md = sessionToMarkdown({ name: 'S', context: null }, [
      makeItem({
        id: 'a',
        title: 'Build export',
        status: 'in_progress',
        description: 'Copy a session as markdown.',
        tags: ['export', 'spec'],
        branch_ref: 'claude/c1',
      }),
    ]);
    expect(md).toContain('- **Build export** — `in_progress`');
    expect(md).toContain('  Copy a session as markdown.');
    expect(md).toContain('  - Tags: `export`, `spec`');
    expect(md).toContain('  - Branch: `claude/c1`');
  });

  it('resolves structured blocker ids to titles, falling back to the id', () => {
    const md = sessionToMarkdown({ name: 'S', context: null }, [
      makeItem({ id: 'blk', title: 'Backend ready' }),
      makeItem({ id: 'a', title: 'Wire UI', blockers: ['blk', 'ghost'], blocker_text: 'waiting on API' }),
    ]);
    expect(md).toContain('  - Blocked: waiting on API');
    expect(md).toContain('  - Blocked by: Backend ready, ghost');
  });
});
