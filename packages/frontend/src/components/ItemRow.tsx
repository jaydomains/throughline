import type { Item } from '@throughline/shared';
import { isStale } from '../hooks/useStaleThreshold.js';

interface ItemRowProps {
  projectId: string;
  item: Item;
  staleDays: number;
  selected: boolean;
  siblings: string[];
  onSelect: () => void;
  onChanged: () => void;
}

export function ItemRow({ item, staleDays, selected, onSelect }: ItemRowProps) {
  const stale = isStale(item.updated_at, staleDays);
  return (
    <li
      className={`item-row${selected ? ' selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-selected={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      data-testid={`item-row-${item.id}`}
    >
      {stale && (
        <span className="stale" title={`Not updated in ${staleDays}+ days (T-D46)`} aria-label="Stale">
          ⚑
        </span>
      )}
      <span className="title">{item.title}</span>
      {item.tags.length > 0 && (
        <span className="tags">
          {item.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </span>
      )}
      {(item.blocker_text || item.blockers.length > 0) && (
        <span className="blocker-chip" title="Has blockers">
          ⛔
        </span>
      )}
    </li>
  );
}
