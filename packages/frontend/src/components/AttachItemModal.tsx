import { useEffect, useMemo, useState } from 'react';
import type { AttachedItemSummary, Item } from '@throughline/shared';
import { api } from '../api.js';
import { useModalRegistration } from '../keyboard/modalStack.js';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  entryId: string;
  entryTitle: string;
  onChanged: () => void;
}

// Attach a library note to one or more items in the same project (T-D9).
// Loads the project's items + the entry's current attachments, lets the user diff against
// them, then applies the diff via individual attach/detach calls. Cross-project attach is
// rejected server-side; the modal pre-filters to the active project so the UI never even
// surfaces an item from another project.
export function AttachItemModal({
  open,
  onClose,
  projectId,
  entryId,
  entryTitle,
  onChanged,
}: Props) {
  useModalRegistration('attach-item', open, onClose);

  const [items, setItems] = useState<Item[]>([]);
  const [attached, setAttached] = useState<AttachedItemSummary[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const [it, at] = await Promise.all([
          api.listItems(projectId),
          api.listAttachedItems(projectId, entryId),
        ]);
        setItems(it.items);
        setAttached(at.items);
        setSelected(new Set(at.items.map((i) => i.id)));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [open, projectId, entryId]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (f.length === 0) return items;
    return items.filter((i) => i.title.toLowerCase().includes(f));
  }, [items, filter]);

  if (!open) return null;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function onApply() {
    setSubmitting(true);
    setError(null);
    try {
      const before = new Set(attached.map((i) => i.id));
      const toAttach = Array.from(selected).filter((id) => !before.has(id));
      const toDetach = attached.map((i) => i.id).filter((id) => !selected.has(id));
      for (const id of toAttach) {
        await api.attachLibraryNote(projectId, entryId, id);
      }
      for (const id of toDetach) {
        await api.detachLibraryNote(projectId, entryId, id);
      }
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-label={`Attach note: ${entryTitle}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal attach-item-modal" data-testid="attach-item-modal">
        <h2 style={{ marginTop: 0 }}>Attach note — {entryTitle}</h2>
        <label className="form-row">
          <span>Filter</span>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filter items by title…"
            data-testid="attach-item-filter"
          />
        </label>
        <ul className="attach-item-list" data-testid="attach-item-list">
          {filtered.length === 0 && <li className="muted">No items match.</li>}
          {filtered.map((i) => (
            <li key={i.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(i.id)}
                  onChange={() => toggle(i.id)}
                  data-testid={`attach-item-row-${i.id}`}
                />{' '}
                <strong>{i.title}</strong>{' '}
                <span className="meta">
                  {i.type} · {i.status}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => void onApply()}
            disabled={submitting}
            data-testid="attach-item-apply"
          >
            {submitting ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
