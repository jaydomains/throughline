import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type {
  LibraryEntry,
  LibraryEntryType,
  LibrarySearchVia,
} from '@throughline/shared';
import { LIBRARY_ENTRY_TYPES } from '@throughline/shared';
import { api } from '../api.js';
import { useItemPolicy } from '../hooks/useItemPolicy.js';
import { useSessions } from '../hooks/useSessions.js';
import { DumpZone } from '../components/DumpZone.js';
import { TagChipsEditor } from '../components/TagChipsEditor.js';
import { PromptFillModal } from '../components/PromptFillModal.js';
import { AttachItemModal } from '../components/AttachItemModal.js';

const TYPE_LABEL: Record<LibraryEntryType, string> = {
  note: 'Notes',
  prompt: 'Prompts',
  snippet: 'Snippets',
  imported_doc: 'Imported docs',
};

type TypeFilter = 'all' | LibraryEntryType;

interface SearchState {
  via: LibrarySearchVia;
  entries: LibraryEntry[];
  truncated: boolean;
}

export function LibraryView() {
  const { id: projectId } = useParams();
  const { policy } = useItemPolicy(projectId ?? null);
  const { sessions } = useSessions(projectId ?? null);

  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [scope, setScope] = useState<'project' | 'global'>('project');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SearchState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attachedItems, setAttachedItems] = useState<
    { id: string; title: string; type: string; status: string }[]
  >([]);
  const [promptFillFor, setPromptFillFor] = useState<LibraryEntry | null>(null);
  const [attachFor, setAttachFor] = useState<LibraryEntry | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    const opts: { type?: LibraryEntryType; scope?: 'project' | 'global' } = { scope };
    if (typeFilter !== 'all') opts.type = typeFilter;
    const r = await api.listLibrary(projectId, opts);
    setEntries(r.entries);
  }, [projectId, typeFilter, scope]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Debounced FTS search. Empty query → fall back to per-type list.
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!projectId) return;
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    const q = searchQuery.trim();
    if (q.length === 0) {
      setSearchResult(null);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      const body: {
        query: string;
        scope: 'project' | 'global';
        type?: LibraryEntryType;
      } = { query: q, scope };
      if (typeFilter !== 'all') body.type = typeFilter;
      api
        .searchLibrary(projectId, body)
        .then((r) =>
          setSearchResult({
            via: r.result.via,
            entries: r.result.entries,
            truncated: r.result.truncated,
          }),
        )
        .catch(() => setSearchResult(null));
    }, 200);
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, [projectId, searchQuery, typeFilter, scope]);

  const visibleEntries = searchResult ? searchResult.entries : entries;
  const selected = useMemo(
    () => visibleEntries.find((e) => e.id === selectedId) ?? null,
    [visibleEntries, selectedId],
  );

  useEffect(() => {
    if (selected && selected.type === 'note') {
      api
        .listAttachedItems(selected.project_id, selected.id)
        .then((r) => setAttachedItems(r.items))
        .catch(() => setAttachedItems([]));
    } else {
      setAttachedItems([]);
    }
  }, [selected]);

  if (!projectId || !policy) {
    return (
      <div className="view-stub" data-testid="view-library">
        <h1>Library</h1>
        <p>Loading…</p>
      </div>
    );
  }

  async function onCopySnippet(entry: LibraryEntry) {
    try {
      await navigator.clipboard.writeText(entry.body);
      setCopyToast(`Copied ${entry.title}`);
      window.setTimeout(() => setCopyToast(null), 1500);
    } catch {
      setCopyToast('Copy failed');
      window.setTimeout(() => setCopyToast(null), 1500);
    }
  }

  async function onDeleteEntry(entry: LibraryEntry) {
    await api.deleteLibraryEntry(entry.project_id, entry.id);
    if (selectedId === entry.id) setSelectedId(null);
    await refresh();
  }

  async function onPatchEntry(
    entry: LibraryEntry,
    patch: { title?: string; body?: string; tags?: string[] },
  ) {
    await api.updateLibraryEntry(entry.project_id, entry.id, patch);
    await refresh();
  }

  return (
    <div className="library-view" data-testid="view-library">
      <header className="library-header">
        <h1>Library</h1>
        {copyToast && (
          <span className="library-toast" role="status" data-testid="library-toast">
            {copyToast}
          </span>
        )}
      </header>
      <DumpZone
        projectId={projectId}
        target="library"
        policy={policy}
        sessions={sessions}
        onApplied={() => void refresh()}
      />
      <div className="library-body">
        <aside className="library-sidebar" data-testid="library-sidebar">
          <div className="library-filters">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              data-testid="library-type-filter"
            >
              <option value="all">All types</option>
              {LIBRARY_ENTRY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <label className="library-scope">
              <input
                type="checkbox"
                checked={scope === 'global'}
                onChange={(e) => setScope(e.target.checked ? 'global' : 'project')}
                data-testid="library-scope-toggle"
              />
              Cross-project
            </label>
          </div>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="search title / body / tags…"
            data-testid="library-search-input"
          />
          {searchResult && (
            <p className="form-hint">
              {searchResult.entries.length} result
              {searchResult.entries.length === 1 ? '' : 's'} via {searchResult.via}
              {searchResult.truncated ? ' (truncated)' : ''}
            </p>
          )}
          <ul className="library-entry-list" data-testid="library-entry-list">
            {visibleEntries.length === 0 && (
              <li className="muted">No entries.</li>
            )}
            {visibleEntries.map((e) => (
              <li
                key={e.id}
                className={selectedId === e.id ? 'selected' : ''}
                onClick={() => setSelectedId(e.id)}
                data-testid={`library-entry-row-${e.id}`}
              >
                <strong>{e.title}</strong>
                <span className="meta">{e.type}</span>
                {e.tags.length > 0 && (
                  <div className="tags-inline">
                    {e.tags.map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </aside>
        <main className="library-detail" data-testid="library-detail">
          {!selected && (
            <p className="form-hint">Select an entry on the left to view or edit.</p>
          )}
          {selected && (
            <EntryEditor
              entry={selected}
              attachedItems={attachedItems}
              onPatch={(p) => void onPatchEntry(selected, p)}
              onDelete={() => void onDeleteEntry(selected)}
              onCopySnippet={() => void onCopySnippet(selected)}
              onUsePrompt={() => setPromptFillFor(selected)}
              onAttach={() => setAttachFor(selected)}
            />
          )}
        </main>
      </div>
      <PromptFillModal
        open={promptFillFor !== null}
        entry={promptFillFor}
        onClose={() => setPromptFillFor(null)}
      />
      {attachFor && (
        <AttachItemModal
          open={attachFor !== null}
          onClose={() => setAttachFor(null)}
          projectId={attachFor.project_id}
          entryId={attachFor.id}
          entryTitle={attachFor.title}
          onChanged={() => {
            if (selected && selected.id === attachFor.id) {
              api
                .listAttachedItems(selected.project_id, selected.id)
                .then((r) => setAttachedItems(r.items))
                .catch(() => {});
            }
          }}
        />
      )}
    </div>
  );
}

interface EditorProps {
  entry: LibraryEntry;
  attachedItems: { id: string; title: string; type: string; status: string }[];
  onPatch: (patch: { title?: string; body?: string; tags?: string[] }) => void;
  onDelete: () => void;
  onCopySnippet: () => void;
  onUsePrompt: () => void;
  onAttach: () => void;
}

function EntryEditor({
  entry,
  attachedItems,
  onPatch,
  onDelete,
  onCopySnippet,
  onUsePrompt,
  onAttach,
}: EditorProps) {
  const [title, setTitle] = useState(entry.title);
  const [body, setBody] = useState(entry.body);

  useEffect(() => {
    setTitle(entry.title);
    setBody(entry.body);
  }, [entry.id]);

  const readonly = entry.type === 'imported_doc';

  return (
    <div className="library-editor" data-testid="library-editor">
      <div className="library-editor-header">
        <input
          type="text"
          aria-label="Entry title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title !== entry.title && title.trim().length > 0) onPatch({ title });
          }}
          data-testid="library-editor-title"
        />
        <span className="meta">{entry.type}</span>
        <div className="library-editor-actions">
          {entry.type === 'snippet' && (
            <button type="button" onClick={onCopySnippet} data-testid="library-snippet-copy">
              Copy
            </button>
          )}
          {entry.type === 'prompt' && (
            <button type="button" onClick={onUsePrompt} data-testid="library-prompt-use">
              Use prompt
            </button>
          )}
          {entry.type === 'note' && (
            <button type="button" onClick={onAttach} data-testid="library-note-attach">
              Attach to item…
            </button>
          )}
          <button type="button" onClick={onDelete} data-testid="library-editor-delete">
            Delete
          </button>
        </div>
      </div>
      {entry.summary && (
        <section className="library-editor-summary">
          <h3>Summary</h3>
          <p>{entry.summary}</p>
        </section>
      )}
      <TagChipsEditor
        tags={entry.tags}
        onChange={(tags) => onPatch({ tags })}
        testId="library-editor-tags"
      />
      <textarea
        aria-label="Entry body"
        readOnly={readonly}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => {
          if (body !== entry.body && !readonly) onPatch({ body });
        }}
        rows={16}
        data-testid="library-editor-body"
      />
      {entry.type === 'note' && (
        <section className="library-attached-items" data-testid="library-attached-items">
          <h3>Attached items ({attachedItems.length})</h3>
          {attachedItems.length === 0 && (
            <p className="muted">No items attached. Use "Attach to item…" above.</p>
          )}
          {attachedItems.length > 0 && (
            <ul>
              {attachedItems.map((i) => (
                <li key={i.id}>
                  <strong>{i.title}</strong>{' '}
                  <span className="meta">
                    {i.type} · {i.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
