import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuditEntry, Item, ItemPolicy } from '@throughline/shared';
import { api } from '../api.js';
import { isStale } from '../hooks/useStaleThreshold.js';
import { useModalRegistration } from '../keyboard/modalStack.js';
import { useHotkey } from '../keyboard/useHotkey.js';

interface Props {
  projectId: string;
  itemId: string;
  policy: ItemPolicy;
  staleDays: number;
  siblings: string[];
  onCycle: (nextId: string) => void;
  onClose: () => void;
  onChanged: () => void;
}

export function ItemDetailPanel({
  projectId,
  itemId,
  policy,
  staleDays,
  siblings,
  onCycle,
  onClose,
  onChanged,
}: Props) {
  const [item, setItem] = useState<Item | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editingDesc, setEditingDesc] = useState<string | null>(null);
  const [editingBlockerText, setEditingBlockerText] = useState<string | null>(null);
  const [editingBranchRef, setEditingBranchRef] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [blockerDraft, setBlockerDraft] = useState('');

  const refresh = useCallback(async () => {
    try {
      const r = await api.getItem(projectId, itemId);
      setItem(r.item);
    } catch {
      setItem(null);
    }
    try {
      const a = await api.listAudit({ entity_type: 'item', entity_id: itemId, limit: 50 });
      setAuditEntries(a.entries);
    } catch {
      setAuditEntries([]);
    }
  }, [projectId, itemId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Push onto modal stack so Esc closes us. The modalStack contract is LIFO Esc-first.
  useModalRegistration(`item-detail-${itemId}`, true, onClose);

  // Arrow-key navigation: ←/→ (or ↑/↓) cycles through the parent list while the panel
  // stays open. Per Phase 2 keyboard primitives — consumers register here now (T-D24
  // consumers; SPEC §7.17 detail panel arrow-key spec).
  const cycle = useCallback(
    (direction: 1 | -1) => {
      if (siblings.length === 0) return;
      const idx = siblings.indexOf(itemId);
      if (idx === -1) {
        onCycle(siblings[0]!);
        return;
      }
      const next = idx + direction;
      if (next < 0 || next >= siblings.length) return;
      onCycle(siblings[next]!);
    },
    [siblings, itemId, onCycle],
  );

  useHotkey('arrowdown', (e) => {
    e.preventDefault();
    cycle(1);
  });
  useHotkey('arrowup', (e) => {
    e.preventDefault();
    cycle(-1);
  });

  const stale = useMemo(() => (item ? isStale(item.updated_at, staleDays) : false), [item, staleDays]);

  async function saveField(field: 'title' | 'description', value: string) {
    if (!item) return;
    if (field === 'title' && value.length === 0) return;
    await api.updateItem(projectId, item.id, { [field]: value });
    await refresh();
    onChanged();
  }

  async function cycleStatus() {
    if (!item) return;
    const idx = policy.statuses.indexOf(item.status);
    const next = policy.statuses[(idx + 1) % policy.statuses.length];
    if (!next || next === item.status) return;
    await api.updateItem(projectId, item.id, { status: next });
    await refresh();
    onChanged();
  }

  async function addTag() {
    if (!item || tagDraft.trim().length === 0) return;
    await api.addItemTag(projectId, item.id, tagDraft.trim());
    setTagDraft('');
    await refresh();
    onChanged();
  }

  async function removeTag(tag: string) {
    if (!item) return;
    await api.removeItemTag(projectId, item.id, tag);
    await refresh();
    onChanged();
  }

  async function persistBlockerText(value: string) {
    if (!item) return;
    if ((item.blocker_text ?? '') === value) return;
    await api.updateItem(projectId, item.id, { blocker_text: value.length === 0 ? null : value });
    await refresh();
    onChanged();
  }

  async function addBlockerRef() {
    if (!item || blockerDraft.trim().length === 0) return;
    try {
      await api.addItemBlocker(projectId, item.id, blockerDraft.trim());
      setBlockerDraft('');
      await refresh();
      onChanged();
    } catch {
      // surface as inline error in future; for v1 leave silent so the panel doesn't crash.
    }
  }

  async function removeBlockerRef(blockerId: string) {
    if (!item) return;
    await api.removeItemBlocker(projectId, item.id, blockerId);
    await refresh();
    onChanged();
  }

  async function persistBranchRef(value: string) {
    if (!item) return;
    if ((item.branch_ref ?? '') === value) return;
    await api.updateItem(projectId, item.id, { branch_ref: value.length === 0 ? null : value });
    await refresh();
    onChanged();
  }

  if (!item) {
    return (
      <aside className="detail-panel open" role="dialog" aria-label="Item detail">
        <header>
          <button type="button" onClick={onClose} aria-label="Close detail panel">
            ✕
          </button>
        </header>
        <p className="muted">Loading…</p>
      </aside>
    );
  }

  return (
    <aside className="detail-panel open" role="dialog" aria-label="Item detail" data-testid="item-detail-panel">
      <header>
        {stale && (
          <span className="stale" title={`Not updated in ${staleDays}+ days (T-D46)`}>
            ⚑
          </span>
        )}
        <input
          className="title-edit"
          aria-label="Item title"
          value={editingTitle ?? item.title}
          onChange={(e) => setEditingTitle(e.target.value)}
          onBlur={async () => {
            if (editingTitle !== null && editingTitle !== item.title) {
              await saveField('title', editingTitle);
            }
            setEditingTitle(null);
          }}
        />
        <button type="button" className="status-pill" onClick={() => void cycleStatus()} title="Cycle status">
          {item.status}
        </button>
        <button type="button" onClick={onClose} aria-label="Close detail panel">
          ✕
        </button>
      </header>

      <section className="detail-section">
        <h3>Description</h3>
        <textarea
          aria-label="Description"
          value={editingDesc ?? item.description}
          onChange={(e) => setEditingDesc(e.target.value)}
          onBlur={async () => {
            if (editingDesc !== null && editingDesc !== item.description) {
              await saveField('description', editingDesc);
            }
            setEditingDesc(null);
          }}
        />
      </section>

      <section className="detail-section">
        <h3>Tags</h3>
        <div className="tag-list">
          {item.tags.map((t) => (
            <span key={t} className="tag removable">
              {t}{' '}
              <button type="button" aria-label={`Remove tag ${t}`} onClick={() => void removeTag(t)}>
                ×
              </button>
            </span>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void addTag();
          }}
        >
          <input
            aria-label="New tag"
            placeholder="add tag…"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
          />
        </form>
      </section>

      <section className="detail-section">
        <h3>Blockers (T-D8)</h3>
        <label className="block">
          <span className="muted">Free-text</span>
          <input
            aria-label="Free-text blocker description"
            value={editingBlockerText ?? item.blocker_text ?? ''}
            onChange={(e) => setEditingBlockerText(e.target.value)}
            onBlur={async () => {
              if (editingBlockerText !== null) {
                await persistBlockerText(editingBlockerText);
              }
              setEditingBlockerText(null);
            }}
          />
        </label>
        <div className="blocker-refs">
          <span className="muted">Blocked by:</span>
          {item.blockers.length === 0 && <span className="muted"> none</span>}
          {item.blockers.map((b) => (
            <span key={b} className="tag removable">
              {b}{' '}
              <button type="button" aria-label={`Remove blocker ${b}`} onClick={() => void removeBlockerRef(b)}>
                ×
              </button>
            </span>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void addBlockerRef();
            }}
          >
            <input
              aria-label="Add blocker by item id"
              placeholder="blocker item id…"
              value={blockerDraft}
              onChange={(e) => setBlockerDraft(e.target.value)}
            />
          </form>
        </div>
      </section>

      <section className="detail-section">
        <h3>Branch ref (T-D38)</h3>
        <input
          aria-label="Branch reference"
          value={editingBranchRef ?? item.branch_ref ?? ''}
          onChange={(e) => setEditingBranchRef(e.target.value)}
          onBlur={async () => {
            if (editingBranchRef !== null) {
              await persistBranchRef(editingBranchRef);
            }
            setEditingBranchRef(null);
          }}
        />
      </section>

      <section className="detail-section">
        <h3>Methodology context</h3>
        <p className="muted">
          Primary unit, phase, anchors, markers — populated when the project's bundle declares them
          (Phase 7).
        </p>
      </section>

      <section className="detail-section">
        <h3>Code refs · verifier rules · directives · git context</h3>
        <p className="muted">
          Code refs land in Phase 11 (Semble); verifier rules in Phase 10; directives in Phase 6;
          PR/git context in Phase 10.
        </p>
      </section>

      <section className="detail-section">
        <h3>Activity log</h3>
        <ol className="activity-log">
          {auditEntries.map((e) => (
            <li key={e.id}>
              <time>{new Date(e.timestamp).toLocaleString()}</time>{' '}
              <span className="actor">{e.actor}</span>{' '}
              <span className="field">{e.field}</span>
              {e.new_value !== null && <span className="new"> → {e.new_value}</span>}
            </li>
          ))}
          {auditEntries.length === 0 && <li className="muted">No history.</li>}
        </ol>
      </section>

      <section className="detail-section">
        <h3>Linked items</h3>
        <p className="muted">
          parent: {item.parent_id ?? '—'} · sessions: {item.session_ids.join(', ') || '—'}
        </p>
      </section>
    </aside>
  );
}
