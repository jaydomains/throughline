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
      {item.methodology_drift && (
        <span
          className="drift-badge"
          title="Methodology drift on an associated primary unit (SPEC §7.14)"
          aria-label="Methodology drift"
          data-testid={`item-drift-${item.id}`}
        >
          ⚠
        </span>
      )}
      {item.code_drift_tier && (
        <span
          className={`code-drift-badge ${item.code_drift_tier}`}
          title={`Code drift (${item.code_drift_tier}): tier-1 red / tier-2 orange / tier-3 yellow (SPEC §7.14)`}
          aria-label={`Code drift ${item.code_drift_tier}`}
          data-testid={`item-code-drift-${item.id}`}
        >
          ▲
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
