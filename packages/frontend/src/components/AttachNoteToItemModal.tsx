import { useEffect, useMemo, useState } from 'react';
import type { LibraryEntry } from '@throughline/shared';
import { api } from '../api.js';
import { useModalRegistration } from '../keyboard/modalStack.js';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  itemId: string;
  currentAttached: LibraryEntry[];
  onChanged: () => void;
}

// Reverse of AttachItemModal — opened from the item detail panel to pick one or more
// existing library notes to attach to this item. T-D9: only library entries of type
// 'note' are eligible, enforced both here (filter) and server-side (AttachNotANoteError).
export function AttachNoteToItemModal({
  open,
  onClose,
  projectId,
  itemId,
  currentAttached,
  onChanged,
}: Props) {
  useModalRegistration('attach-note-to-item', open, onClose);

  const [notes, setNotes] = useState<LibraryEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const r = await api.listLibrary(projectId, { type: 'note' });
        setNotes(r.entries);
        setSelected(new Set(currentAttached.map((n) => n.id)));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [open, projectId, currentAttached]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (f.length === 0) return notes;
    return notes.filter((n) => n.title.toLowerCase().includes(f));
  }, [notes, filter]);

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
      const before = new Set(currentAttached.map((n) => n.id));
      const toAttach = Array.from(selected).filter((id) => !before.has(id));
      const toDetach = currentAttached.map((n) => n.id).filter((id) => !selected.has(id));
      for (const noteId of toAttach) {
        await api.attachLibraryNote(projectId, noteId, itemId);
      }
      for (const noteId of toDetach) {
        await api.detachLibraryNote(projectId, noteId, itemId);
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
      aria-label="Attach note to item"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal attach-item-modal" data-testid="attach-note-to-item-modal">
        <h2 style={{ marginTop: 0 }}>Attach note to item</h2>
        <label className="form-row">
          <span>Filter</span>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filter notes by title…"
            data-testid="attach-note-filter"
          />
        </label>
        <ul className="attach-item-list" data-testid="attach-note-list">
          {filtered.length === 0 && <li className="muted">No notes match.</li>}
          {filtered.map((n) => (
            <li key={n.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(n.id)}
                  onChange={() => toggle(n.id)}
                  data-testid={`attach-note-row-${n.id}`}
                />{' '}
                <strong>{n.title}</strong>
                {n.tags.length > 0 && <span className="meta"> {n.tags.join(', ')}</span>}
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
            data-testid="attach-note-apply"
          >
            {submitting ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
