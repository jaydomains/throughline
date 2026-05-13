import { useState } from 'react';
import type { Board as BoardSpec, Item, ItemPolicy } from '@throughline/shared';
import { api } from '../api.js';
import { ItemRow } from './ItemRow.js';

interface BoardProps {
  projectId: string;
  sessionId: string;
  board: BoardSpec;
  policy: ItemPolicy;
  items: Item[];
  // Phase 6b — item ids with a pin directive; rendered sticky at the top of their column.
  pinnedIds?: ReadonlySet<string>;
  staleDays: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRefresh: () => void;
}

export function Board({
  projectId,
  sessionId,
  board,
  policy,
  items,
  pinnedIds,
  staleDays,
  selectedId,
  onSelect,
  onRefresh,
}: BoardProps) {
  return (
    <section className="board" aria-label={`Board: ${board.label}`} data-testid={`board-${board.id}`}>
      <h2 className="board-heading">{board.label}</h2>
      <div className="board-columns">
        {policy.statuses.map((status) => {
          const columnItems = items.filter((i) => i.status === status);
          return (
            <BoardColumn
              key={status}
              projectId={projectId}
              sessionId={sessionId}
              board={board}
              status={status}
              items={columnItems}
              {...(pinnedIds !== undefined ? { pinnedIds } : {})}
              staleDays={staleDays}
              selectedId={selectedId}
              orderedIds={items.map((i) => i.id)}
              onSelect={onSelect}
              onRefresh={onRefresh}
            />
          );
        })}
      </div>
    </section>
  );
}

interface BoardColumnProps {
  projectId: string;
  sessionId: string;
  board: BoardSpec;
  status: string;
  items: Item[];
  pinnedIds?: ReadonlySet<string>;
  staleDays: number;
  selectedId: string | null;
  orderedIds: string[];
  onSelect: (id: string | null) => void;
  onRefresh: () => void;
}

function BoardColumn({
  projectId,
  sessionId,
  board,
  status,
  items,
  pinnedIds,
  staleDays,
  selectedId,
  orderedIds,
  onSelect,
  onRefresh,
}: BoardColumnProps) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (draft.trim().length === 0) return;
    setBusy(true);
    try {
      await api.createItem(projectId, {
        title: draft.trim(),
        type: board.type,
        status,
        session_ids: [sessionId],
      });
      setDraft('');
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  const pinned = pinnedIds ? items.filter((i) => pinnedIds.has(i.id)) : [];
  const unpinned = pinnedIds ? items.filter((i) => !pinnedIds.has(i.id)) : items;

  return (
    <div className="board-column" data-testid={`column-${board.id}-${status}`}>
      <h3>{status}</h3>
      {pinned.length > 0 && (
        <>
          <div className="pinned-divider" data-testid={`pinned-${board.id}-${status}`}>
            📌 pinned
          </div>
          <ul className="item-list pinned-list">
            {pinned.map((item) => (
              <ItemRow
                key={item.id}
                projectId={projectId}
                item={item}
                staleDays={staleDays}
                selected={selectedId === item.id}
                siblings={orderedIds}
                onSelect={() => onSelect(item.id)}
                onChanged={onRefresh}
              />
            ))}
          </ul>
        </>
      )}
      <ul className="item-list">
        {unpinned.map((item) => (
          <ItemRow
            key={item.id}
            projectId={projectId}
            item={item}
            staleDays={staleDays}
            selected={selectedId === item.id}
            siblings={orderedIds}
            onSelect={() => onSelect(item.id)}
            onChanged={onRefresh}
          />
        ))}
        {items.length === 0 && <li className="empty">—</li>}
      </ul>
      <form
        className="item-inline-create"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <input
          aria-label={`New ${board.type} in ${status}`}
          placeholder={`+ new ${board.type}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setDraft('');
          }}
        />
      </form>
    </div>
  );
}
