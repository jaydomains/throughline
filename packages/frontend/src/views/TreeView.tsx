import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Item, ItemPolicy } from '@throughline/shared';
import { useItemPolicy } from '../hooks/useItemPolicy.js';
import { useItems } from '../hooks/useItems.js';
import { useStaleThreshold, isStale } from '../hooks/useStaleThreshold.js';
import { ItemDetailPanel } from '../components/ItemDetailPanel.js';

type GroupBy = 'status' | 'tag' | 'parent';

export function TreeView() {
  const { id } = useParams();
  const projectId = id ?? null;
  const { policy } = useItemPolicy(projectId);
  const { items, refresh } = useItems({ projectId });
  const staleDays = useStaleThreshold();
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const groups = useMemo(() => groupItems(items, groupBy, policy), [items, groupBy, policy]);
  const orderedIds = items.map((i) => i.id);

  if (!projectId) return null;

  return (
    <div className="tree-view" data-testid="tree-view">
      <header className="tree-header">
        <h1>Tree</h1>
        <label>
          group by:{' '}
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
            <option value="status">status</option>
            <option value="tag">tag</option>
            <option value="parent">parent</option>
          </select>
        </label>
      </header>
      {groups.map(([group, members]) => (
        <details key={group} open>
          <summary>
            {group} <span className="muted">({members.length})</span>
          </summary>
          <ul className="tree-list">
            {members.map((item) => (
              <li
                key={item.id}
                className={`item-row${selectedId === item.id ? ' selected' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(item.id)}
                data-testid={`tree-row-${item.id}`}
              >
                {isStale(item.updated_at, staleDays) && (
                  <span className="stale" title={`Stale (>${staleDays}d)`}>
                    ⚑
                  </span>
                )}
                <span className="title">{item.title}</span>
                <span className="muted"> {item.status}</span>
              </li>
            ))}
          </ul>
        </details>
      ))}

      {selectedId && policy && (
        <ItemDetailPanel
          projectId={projectId}
          itemId={selectedId}
          policy={policy}
          staleDays={staleDays}
          siblings={orderedIds}
          onCycle={setSelectedId}
          onClose={() => setSelectedId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function groupItems(items: Item[], groupBy: GroupBy, policy: ItemPolicy | null): Array<[string, Item[]]> {
  const map = new Map<string, Item[]>();
  function push(key: string, item: Item) {
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  for (const item of items) {
    if (groupBy === 'status') push(item.status, item);
    else if (groupBy === 'parent') push(item.parent_id ?? '(root)', item);
    else if (groupBy === 'tag') {
      if (item.tags.length === 0) push('(untagged)', item);
      else for (const t of item.tags) push(t, item);
    }
  }
  const order = groupBy === 'status' && policy ? policy.statuses : Array.from(map.keys()).sort();
  const seen = new Set<string>();
  const out: Array<[string, Item[]]> = [];
  for (const key of order) {
    if (map.has(key)) {
      out.push([key, map.get(key)!]);
      seen.add(key);
    }
  }
  for (const [key, arr] of map.entries()) {
    if (!seen.has(key)) out.push([key, arr]);
  }
  return out;
}
