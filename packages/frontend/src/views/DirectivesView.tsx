import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  Directive,
  DirectiveKind,
  Item,
  LibraryEntry,
  ReminderPayload,
} from '@throughline/shared';
import { api } from '../api.js';
import { DirectiveModal } from '../components/DirectiveModal.js';

// Phase 6b — Directives view (SPEC §7.10). Three collapsible groups, count per group:
//   • Pinned (unordered)
//   • Reminders (sorted by next firing; null next_fire_at — already-fired one-shots —
//     sort last so the active queue surfaces first)
//   • Include-in-prompt (unordered)

const GROUP_TITLE: Record<DirectiveKind, string> = {
  pin: 'Pinned',
  reminder: 'Reminders',
  include_prompt: 'Include in session prompt',
};

const GROUP_ORDER: DirectiveKind[] = ['pin', 'reminder', 'include_prompt'];

function sortDirectives(group: DirectiveKind, ds: Directive[]): Directive[] {
  if (group !== 'reminder') return ds;
  return [...ds].sort((a, b) => {
    // Already-fired one-shots (next_fire_at=null) sort to the bottom.
    if (a.next_fire_at === null && b.next_fire_at === null) return 0;
    if (a.next_fire_at === null) return 1;
    if (b.next_fire_at === null) return -1;
    return a.next_fire_at.localeCompare(b.next_fire_at);
  });
}

function summariseReminder(d: Directive): string {
  const payload = d.payload as ReminderPayload;
  if (d.next_fire_at === null) {
    return d.last_fired_at ? `fired ${new Date(d.last_fired_at).toLocaleString()}` : 'inactive';
  }
  const when = new Date(d.next_fire_at).toLocaleString();
  if (payload.recurrence) {
    return `next ${when} · every ${payload.recurrence.every} ${payload.recurrence.unit}`;
  }
  if (payload.mode === 'relative' && payload.relative_spec) {
    return `${payload.relative_spec} → ${when}`;
  }
  return `at ${when}`;
}

function summarise(d: Directive): string {
  if (d.kind === 'reminder') return summariseReminder(d);
  if (d.kind === 'include_prompt') {
    const n = (d.payload as { note?: string }).note;
    return n ? n : 'flag this for the session-start prompt';
  }
  return 'pinned in parent view';
}

export function DirectivesView() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [items, setItems] = useState<Map<string, Item>>(new Map());
  const [entries, setEntries] = useState<Map<string, LibraryEntry>>(new Map());
  const [collapsed, setCollapsed] = useState<Record<DirectiveKind, boolean>>({
    pin: false,
    reminder: false,
    include_prompt: false,
  });
  const [editing, setEditing] = useState<Directive | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    try {
      const [{ directives: ds }, { items: is }, { entries: es }] = await Promise.all([
        api.listDirectives(projectId),
        api.listItems(projectId, {}),
        api.listLibrary(projectId, { scope: 'project' }),
      ]);
      setDirectives(ds);
      setItems(new Map(is.map((i) => [i.id, i])));
      setEntries(new Map(es.map((e) => [e.id, e])));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const grouped = useMemo(() => {
    const out: Record<DirectiveKind, Directive[]> = { pin: [], reminder: [], include_prompt: [] };
    for (const d of directives) out[d.kind].push(d);
    for (const k of GROUP_ORDER) out[k] = sortDirectives(k, out[k]);
    return out;
  }, [directives]);

  function parentTitle(d: Directive): string {
    if (d.parent_type === 'item') return items.get(d.parent_id)?.title ?? '(missing item)';
    return entries.get(d.parent_id)?.title ?? '(missing entry)';
  }

  function navigateToParent(d: Directive) {
    if (!projectId) return;
    if (d.parent_type === 'item') {
      navigate(`/projects/${projectId}/tree?item=${d.parent_id}`);
    } else {
      navigate(`/projects/${projectId}/library?entry=${d.parent_id}`);
    }
  }

  async function deleteDirective(d: Directive) {
    if (!projectId) return;
    await api.deleteDirective(projectId, d.id);
    await refresh();
  }

  return (
    <div className="view-stub directives-view" data-testid="view-directives">
      <h1>Directives</h1>
      <p className="form-hint">
        Three directive types (T-D12): <strong>pin</strong> sticks an item or library entry to
        the top of its parent view; <strong>reminder</strong> fires an OS notification at the
        scheduled time (T-D32); <strong>include in session prompt</strong> flags an item or
        entry so Phase 13's session-start prompt auto-prepends it.
      </p>

      {loadError && (
        <p className="form-error" role="alert" data-testid="directives-load-error">
          {loadError}
        </p>
      )}

      {GROUP_ORDER.map((kind) => {
        const list = grouped[kind];
        const isCollapsed = collapsed[kind];
        return (
          <section
            key={kind}
            className="directives-group"
            data-testid={`directives-group-${kind}`}
          >
            <header
              className="directives-group-header"
              onClick={() => setCollapsed((c) => ({ ...c, [kind]: !c[kind] }))}
              role="button"
              tabIndex={0}
              aria-expanded={!isCollapsed}
            >
              <span className="directives-group-toggle">{isCollapsed ? '▸' : '▾'}</span>
              <h2>{GROUP_TITLE[kind]}</h2>
              <span
                className="directives-group-count"
                data-testid={`directives-count-${kind}`}
              >
                ({list.length})
              </span>
            </header>
            {!isCollapsed && (
              <ul className="directives-group-list">
                {list.map((d) => (
                  <li key={d.id} className="directives-row" data-testid={`directive-row-${d.id}`}>
                    <button
                      type="button"
                      className="directives-row-parent"
                      onClick={() => navigateToParent(d)}
                    >
                      <span className="directives-row-parent-type">{d.parent_type}</span>
                      <span className="directives-row-parent-title">{parentTitle(d)}</span>
                    </button>
                    <span className="directives-row-summary">{summarise(d)}</span>
                    <span className="directives-row-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(d);
                          setModalOpen(true);
                        }}
                        data-testid={`directive-edit-${d.id}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteDirective(d)}
                        data-testid={`directive-delete-${d.id}`}
                      >
                        Delete
                      </button>
                    </span>
                  </li>
                ))}
                {list.length === 0 && (
                  <li className="muted">No {GROUP_TITLE[kind].toLowerCase()} directives.</li>
                )}
              </ul>
            )}
          </section>
        );
      })}

      {projectId && editing && (
        <DirectiveModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            void refresh();
          }}
          projectId={projectId}
          parentType={editing.parent_type}
          parentId={editing.parent_id}
          parentTitle={parentTitle(editing)}
          existing={editing}
        />
      )}
    </div>
  );
}
