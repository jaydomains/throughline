import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AuditEntry,
  CodeSearchCandidate,
  Directive,
  Item,
  ItemCodeRef,
  ItemPolicy,
  LibraryEntry,
  ReminderPayload,
} from '@throughline/shared';
import { api } from '../api.js';
import { isStale } from '../hooks/useStaleThreshold.js';
import { useModalRegistration } from '../keyboard/modalStack.js';
import { useHotkey } from '../keyboard/useHotkey.js';
import { AttachNoteToItemModal } from './AttachNoteToItemModal.js';
import { DirectiveModal } from './DirectiveModal.js';

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
  const [attachedNotes, setAttachedNotes] = useState<LibraryEntry[]>([]);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editingDesc, setEditingDesc] = useState<string | null>(null);
  const [editingBlockerText, setEditingBlockerText] = useState<string | null>(null);
  const [editingBranchRef, setEditingBranchRef] = useState<string | null>(null);
  const [prLinkMsg, setPrLinkMsg] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [blockerDraft, setBlockerDraft] = useState('');
  const [attachNoteOpen, setAttachNoteOpen] = useState(false);
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [directiveModal, setDirectiveModal] = useState<{ existing: Directive | null } | null>(
    null,
  );
  // Phase 11 — Semble done-time code linking (SPEC §7.15; C-D17).
  const [codeRefs, setCodeRefs] = useState<ItemCodeRef[]>([]);
  const [codeCandidates, setCodeCandidates] = useState<CodeSearchCandidate[] | null>(null);
  const [codeSelected, setCodeSelected] = useState<Set<number>>(new Set());
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);

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
    try {
      const n = await api.listAttachedNotes(projectId, itemId);
      setAttachedNotes(n.notes);
    } catch {
      setAttachedNotes([]);
    }
    try {
      const d = await api.listDirectivesForItem(projectId, itemId);
      setDirectives(d.directives);
    } catch {
      setDirectives([]);
    }
    try {
      const c = await api.listItemCodeRefs(projectId, itemId);
      setCodeRefs(c.refs);
    } catch {
      setCodeRefs([]);
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
    const lifecycle = policy.statuses_by_type[item.type] ?? policy.statuses;
    const idx = lifecycle.indexOf(item.status);
    const next = lifecycle[(idx + 1) % lifecycle.length];
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

  async function findCodeLinks() {
    setCodeBusy(true);
    setCodeMsg(null);
    try {
      const { result } = await api.codeSearchItem(projectId, itemId);
      if (!result.available) {
        setCodeCandidates([]);
        setCodeMsg('Semble is not configured — code search is unavailable.');
      } else {
        setCodeCandidates(result.candidates);
        setCodeSelected(new Set());
        if (result.candidates.length === 0) setCodeMsg('No code matches found.');
      }
    } catch {
      setCodeMsg('Code search failed.');
    } finally {
      setCodeBusy(false);
    }
  }

  async function confirmCodeLinks() {
    if (!codeCandidates) return;
    const picks = [...codeSelected].map((i) => codeCandidates[i]!).filter(Boolean);
    if (picks.length === 0) return;
    setCodeBusy(true);
    try {
      await api.confirmItemCodeRefs(projectId, itemId, {
        refs: picks.map((c) => ({
          path: c.path,
          line_start: c.line_start,
          line_end: c.line_end,
          summary: c.snippet ? c.snippet.slice(0, 200) : null,
        })),
      });
      setCodeCandidates(null);
      setCodeSelected(new Set());
      await refresh();
      onChanged();
    } catch {
      setCodeMsg('Saving code references failed.');
    } finally {
      setCodeBusy(false);
    }
  }

  async function removeCodeRef(refId: string) {
    await api.removeItemCodeRef(projectId, itemId, refId);
    await refresh();
    onChanged();
  }

  const persistContext = useCallback(
    async (dim: keyof Item['methodology_context'], refs: string[]) => {
      if (!item) return;
      await api.updateItem(projectId, item.id, { methodology_context: { [dim]: refs } });
      await refresh();
      onChanged();
    },
    [item, projectId, refresh, onChanged],
  );

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
        {item.methodology_drift && (
          <span
            className="drift-badge"
            title="Methodology drift on an associated primary unit (SPEC §7.14)"
            aria-label="Methodology drift"
            data-testid="detail-methodology-drift"
          >
            ⚠
          </span>
        )}
        {item.code_drift_tier && (
          <span
            className={`code-drift-badge ${item.code_drift_tier}`}
            title={`Code drift (${item.code_drift_tier}) — SPEC §7.14`}
            aria-label={`Code drift ${item.code_drift_tier}`}
            data-testid="detail-code-drift"
          >
            ▲
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

      <section className="detail-section" data-testid="item-pr-link">
        <h3>PR association (T-D34)</h3>
        <p className="muted">
          Auto-detect from the active branch, override, or skip. Items without a PR
          association lose code-drift tier-2 coverage but keep tiers 1/3/4.
        </p>
        {prLinkMsg && (
          <p className="muted" data-testid="pr-link-msg">
            {prLinkMsg}
          </p>
        )}
        <div className="pr-link-actions">
          <button
            type="button"
            data-testid="pr-link-detect"
            onClick={async () => {
              setPrLinkMsg('Detecting…');
              try {
                const r = await api.detectPrLink(projectId, item.id);
                if (!r.candidate) {
                  setPrLinkMsg(
                    r.branch
                      ? `No open PR for branch ${r.branch} — skip or paste a number.`
                      : 'No branch resolved — skip or paste a PR number.',
                  );
                  return;
                }
                await api.setPrLink(projectId, item.id, r.candidate.pr_number, true);
                setPrLinkMsg(`Linked to ${r.candidate.repo}#${r.candidate.pr_number}.`);
                onChanged();
              } catch {
                setPrLinkMsg('Detection failed (GitHub not configured?).');
              }
            }}
          >
            Auto-detect &amp; link
          </button>
          <button
            type="button"
            data-testid="pr-link-clear"
            onClick={async () => {
              try {
                await api.clearPrLink(projectId, item.id);
                setPrLinkMsg('Association cleared.');
                onChanged();
              } catch {
                setPrLinkMsg('Clear failed.');
              }
            }}
          >
            Clear
          </button>
        </div>
      </section>

      <section className="detail-section" data-testid="item-methodology-context">
        <h3>Methodology context</h3>
        <p className="muted">
          Primary unit / phase / anchor citations / marker refs (SPEC §7.4). Comma-separated;
          bundle-defined identifiers. Empty for bundles that declare none.
        </p>
        <MethodologyContextField
          label="Primary unit(s)"
          dim="primary_unit_refs"
          value={item.methodology_context.primary_unit_refs}
          onSave={persistContext}
        />
        <MethodologyContextField
          label="Phase(s)"
          dim="phase_refs"
          value={item.methodology_context.phase_refs}
          onSave={persistContext}
        />
        <MethodologyContextField
          label="Anchor citations"
          dim="anchor_citations"
          value={item.methodology_context.anchor_citations}
          onSave={persistContext}
        />
        <MethodologyContextField
          label="Marker refs"
          dim="marker_refs"
          value={item.methodology_context.marker_refs}
          onSave={persistContext}
        />
      </section>

      <section className="detail-section" data-testid="item-attached-notes">
        <h3>Attached notes (T-D9)</h3>
        {attachedNotes.length === 0 && (
          <p className="muted">No notes attached.</p>
        )}
        {attachedNotes.length > 0 && (
          <ul className="attached-notes-list">
            {attachedNotes.map((n) => (
              <li key={n.id} data-testid={`attached-note-${n.id}`}>
                <strong>{n.title}</strong>
                {n.tags.length > 0 && (
                  <span className="meta"> {n.tags.join(', ')}</span>
                )}
                <button
                  type="button"
                  aria-label={`Detach note ${n.title}`}
                  onClick={async () => {
                    await api.detachLibraryNote(projectId, n.id, itemId);
                    await refresh();
                  }}
                  data-testid={`detach-note-${n.id}`}
                >
                  Detach
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => setAttachNoteOpen(true)}
          data-testid="attach-note-button"
        >
          Attach note…
        </button>
      </section>

      <section className="detail-section" data-testid="detail-directives">
        <h3>Directives ({directives.length})</h3>
        {directives.length === 0 && (
          <p className="muted">No directives — add a pin, reminder, or include-in-prompt.</p>
        )}
        {directives.length > 0 && (
          <ul className="detail-directives-list">
            {directives.map((d) => (
              <li key={d.id} data-testid={`detail-directive-${d.id}`}>
                <span className="meta">{d.kind}</span>
                {d.kind === 'reminder' && d.next_fire_at !== null && (
                  <span> · {new Date(d.next_fire_at).toLocaleString()}</span>
                )}
                {d.kind === 'reminder' && (d.payload as ReminderPayload).recurrence && (
                  <span>
                    {' '}
                    · every {(d.payload as ReminderPayload).recurrence!.every}{' '}
                    {(d.payload as ReminderPayload).recurrence!.unit}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setDirectiveModal({ existing: d })}
                  data-testid={`detail-directive-edit-${d.id}`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await api.deleteDirective(projectId, d.id);
                    await refresh();
                  }}
                  data-testid={`detail-directive-delete-${d.id}`}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => setDirectiveModal({ existing: null })}
          data-testid="detail-directive-add"
        >
          Add directive…
        </button>
      </section>

      <section className="detail-section" data-testid="item-code-refs">
        <h3>Code references (Semble · §7.15)</h3>
        {codeRefs.length === 0 && (
          <p className="muted">No code references linked.</p>
        )}
        {codeRefs.length > 0 && (
          <ul className="code-ref-list">
            {codeRefs.map((r) => (
              <li key={r.id}>
                <code>
                  {r.path}:{r.line_start}-{r.line_end}
                </code>
                {r.summary && <span className="muted"> — {r.summary}</span>}{' '}
                <button type="button" onClick={() => void removeCodeRef(r.id)}>
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={() => void findCodeLinks()} disabled={codeBusy}>
          {codeBusy ? 'Searching…' : 'Find code links'}
        </button>
        {codeMsg && <p className="muted">{codeMsg}</p>}
        {codeCandidates && codeCandidates.length > 0 && (
          <div className="code-ref-candidates">
            <p className="muted">Select matches to link, then confirm:</p>
            <ul>
              {codeCandidates.map((c, i) => (
                <li key={`${c.path}:${c.line_start}:${i}`}>
                  <label>
                    <input
                      type="checkbox"
                      checked={codeSelected.has(i)}
                      onChange={(e) => {
                        setCodeSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(i);
                          else next.delete(i);
                          return next;
                        });
                      }}
                    />{' '}
                    <code>
                      {c.path}:{c.line_start}-{c.line_end}
                    </code>
                    {c.snippet && <span className="muted"> — {c.snippet.slice(0, 80)}</span>}
                  </label>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void confirmCodeLinks()}
              disabled={codeBusy || codeSelected.size === 0}
            >
              Confirm {codeSelected.size} link{codeSelected.size === 1 ? '' : 's'}
            </button>
          </div>
        )}
        <p className="muted">Verifier rules · PR/git context: Phase 10.</p>
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

      <AttachNoteToItemModal
        open={attachNoteOpen}
        onClose={() => setAttachNoteOpen(false)}
        projectId={projectId}
        itemId={itemId}
        currentAttached={attachedNotes}
        onChanged={() => void refresh()}
      />
      {directiveModal && item && (
        <DirectiveModal
          open={directiveModal !== null}
          onClose={() => setDirectiveModal(null)}
          onSaved={() => {
            void refresh();
            onChanged();
          }}
          projectId={projectId}
          parentType="item"
          parentId={itemId}
          parentTitle={item.title}
          existing={directiveModal.existing}
        />
      )}
    </aside>
  );
}

function MethodologyContextField({
  label,
  dim,
  value,
  onSave,
}: {
  label: string;
  dim: keyof Item['methodology_context'];
  value: string[];
  onSave: (dim: keyof Item['methodology_context'], refs: string[]) => Promise<void>;
}) {
  const joined = value.join(', ');
  const [draft, setDraft] = useState<string | null>(null);
  // Drop any in-progress draft when the external value changes (post-refresh, or the panel
  // reused for a different item) so the field never shows another item's stale draft.
  useEffect(() => {
    setDraft(null);
  }, [joined]);
  return (
    <label className="block">
      <span className="muted">{label}</span>
      <input
        aria-label={label}
        value={draft ?? joined}
        placeholder="comma-separated…"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={async () => {
          if (draft === null) return;
          const next = draft
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          setDraft(null);
          if (next.join(',') !== value.join(',')) await onSave(dim, next);
        }}
      />
    </label>
  );
}
