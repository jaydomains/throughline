import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type {
  CodeQaResult,
  LibraryEntry,
  LibraryEntryType,
  LibrarySearchVia,
} from '@throughline/shared';
import { LIBRARY_ENTRY_TYPES } from '@throughline/shared';
import { api } from '../api.js';
import { useItemPolicy } from '../hooks/useItemPolicy.js';
import { useSessions } from '../hooks/useSessions.js';
import { useDirectives, directivesFor, isPinned } from '../hooks/useDirectives.js';
import type { Directive } from '@throughline/shared';
import { DumpZone } from '../components/DumpZone.js';
import { TagChipsEditor } from '../components/TagChipsEditor.js';
import { PromptFillModal } from '../components/PromptFillModal.js';
import { AttachItemModal } from '../components/AttachItemModal.js';
import { DirectiveModal } from '../components/DirectiveModal.js';
import { DirectiveBadge } from '../components/DirectiveBadge.js';
import { MdFolderManager } from '../components/MdFolderManager.js';
import { LoadError } from '../components/LoadError.js';

const TYPE_LABEL: Record<LibraryEntryType, string> = {
  note: 'Notes',
  prompt: 'Prompts',
  snippet: 'Snippets',
  imported_doc: 'Imported docs',
  project_spec: 'Project spec',
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
  const [loadError, setLoadError] = useState<Error | null>(null);
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
  const [directiveTarget, setDirectiveTarget] = useState<{
    entry: LibraryEntry;
    existing: Directive | null;
  } | null>(null);
  const {
    byParent: directivesByParent,
    refresh: refreshDirectives,
  } = useDirectives(projectId ?? null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    const opts: { type?: LibraryEntryType; scope?: 'project' | 'global' } = { scope };
    if (typeFilter !== 'all') opts.type = typeFilter;
    // SF6 — was a bare `await` whose rejection escaped to the error boundary, blanking
    // the whole Library view instead of showing an inline error.
    try {
      const r = await api.listLibrary(projectId, opts);
      setEntries(r.entries);
      setLoadError(null);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e : new Error(String(e)));
    }
  }, [projectId, typeFilter, scope]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Debounced FTS search. Empty query → fall back to per-type list.
  const debounceRef = useRef<number | null>(null);
  // S8-02 — clearing the debounce timer cancels a *pending* request, but a request already
  // in flight when the query changes still resolves and used to overwrite the current result
  // with stale matches. A sequence counter, bumped on every effect run (keystroke / filter
  // change), lets each resolved search drop its result unless it is still the latest.
  const searchSeq = useRef(0);
  useEffect(() => {
    if (!projectId) return;
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    const seq = ++searchSeq.current;
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
        .then((r) => {
          if (searchSeq.current !== seq) return;
          setSearchResult({
            via: r.result.via,
            entries: r.result.entries,
            truncated: r.result.truncated,
          });
        })
        .catch(() => {
          if (searchSeq.current !== seq) return;
          setSearchResult(null);
        });
    }, 200);
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, [projectId, searchQuery, typeFilter, scope]);

  // S8-03 — the copy toast schedules a `setTimeout(setCopyToast(null))`. Previously the timer
  // was never cleared, so a copy immediately before unmount fired `setState` on an unmounted
  // component (and rapid copies leaked overlapping timers). Hold the live timer in a ref;
  // `showToast` clears any prior timer before scheduling, and an unmount effect clears the last.
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setCopyToast(msg);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setCopyToast(null), 1500);
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const allVisibleEntries = searchResult ? searchResult.entries : entries;
  // Phase 6b — pinned entries sticky to the top of the sidebar list (pin scope for
  // Phase 6 = session board + library sidebar). Filters and search apply first, then
  // partition: pinned first, unpinned next, preserving relative order from the backend.
  const pinnedEntries = useMemo(
    () => allVisibleEntries.filter((e) => isPinned(directivesFor(directivesByParent, 'library', e.id))),
    [allVisibleEntries, directivesByParent],
  );
  const unpinnedEntries = useMemo(
    () => allVisibleEntries.filter((e) => !isPinned(directivesFor(directivesByParent, 'library', e.id))),
    [allVisibleEntries, directivesByParent],
  );
  // Memoise so downstream `useMemo`s (e.g., `selected`) don't invalidate on every
  // render. Spread-into-new-array would otherwise return a fresh reference each call.
  const visibleEntries = useMemo(
    () => [...pinnedEntries, ...unpinnedEntries],
    [pinnedEntries, unpinnedEntries],
  );
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
      showToast(`Copied ${entry.title}`);
    } catch {
      showToast('Copy failed');
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

  async function onSetTracked(entry: LibraryEntry, tracked: boolean) {
    await api.setMdTracked(entry.project_id, entry.id, tracked);
    await refresh();
  }

  async function onReingest(entry: LibraryEntry) {
    await api.reingestMd(entry.project_id, entry.id);
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
      <LoadError error={loadError} what="library" />
      <DumpZone
        projectId={projectId}
        target="library"
        policy={policy}
        sessions={sessions}
        onApplied={() => void refresh()}
      />
      <MdFolderManager projectId={projectId} onIngested={() => void refresh()} />
      <CodeQaPanel projectId={projectId} />
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
            {pinnedEntries.length > 0 && (
              <li
                className="pinned-divider"
                data-testid="library-pinned-divider"
                aria-hidden="true"
              >
                📌 pinned
              </li>
            )}
            {pinnedEntries.map((e) => (
              <li
                key={e.id}
                className={`${selectedId === e.id ? 'selected ' : ''}pinned-entry`}
                onClick={() => setSelectedId(e.id)}
                data-testid={`library-entry-row-${e.id}`}
              >
                <strong>{e.title}</strong>
                <DirectiveBadge directives={directivesFor(directivesByParent, 'library', e.id)} />
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
            {unpinnedEntries.map((e) => (
              <li
                key={e.id}
                className={selectedId === e.id ? 'selected' : ''}
                onClick={() => setSelectedId(e.id)}
                data-testid={`library-entry-row-${e.id}`}
              >
                <strong>{e.title}</strong>
                <DirectiveBadge directives={directivesFor(directivesByParent, 'library', e.id)} />
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
              directives={directivesFor(directivesByParent, 'library', selected.id)}
              onPatch={(p) => void onPatchEntry(selected, p)}
              onSetTracked={(t) => void onSetTracked(selected, t)}
              onReingest={() => void onReingest(selected)}
              onDelete={() => void onDeleteEntry(selected)}
              onCopySnippet={() => void onCopySnippet(selected)}
              onUsePrompt={() => setPromptFillFor(selected)}
              onAttach={() => setAttachFor(selected)}
              onAddDirective={() => setDirectiveTarget({ entry: selected, existing: null })}
              onEditDirective={(d) =>
                setDirectiveTarget({ entry: selected, existing: d })
              }
              onDeleteDirective={async (d) => {
                await api.deleteDirective(selected.project_id, d.id);
                await refreshDirectives();
              }}
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
      {directiveTarget && (
        <DirectiveModal
          open={directiveTarget !== null}
          onClose={() => setDirectiveTarget(null)}
          onSaved={() => void refreshDirectives()}
          projectId={directiveTarget.entry.project_id}
          parentType="library"
          parentId={directiveTarget.entry.id}
          parentTitle={directiveTarget.entry.title}
          existing={directiveTarget.existing}
        />
      )}
    </div>
  );
}

// Phase 11 — plain-English code Q&A (SPEC §7.15; C-D17). Semble locates relevant code;
// Anthropic summarises it. Degrades in place: no Semble ⇒ disabled message; no key ⇒
// source links without a synthesised answer.
function CodeQaPanel({ projectId }: { projectId: string }) {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CodeQaResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    const q = question.trim();
    if (q.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.codeQa(projectId, q);
      setResult(r.result);
    } catch {
      setError('Code Q&A failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="code-qa-panel" data-testid="code-qa-panel">
      <h2>Ask the code</h2>
      <div className="code-qa-input">
        <input
          type="search"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void ask();
          }}
          placeholder="where is upload validation handled?"
          data-testid="code-qa-input"
        />
        <button type="button" onClick={() => void ask()} disabled={busy}>
          {busy ? 'Asking…' : 'Ask'}
        </button>
      </div>
      {error && <p className="muted">{error}</p>}
      {result && result.status === 'unavailable' && (
        <p className="muted">Semble is not configured — code Q&amp;A is unavailable.</p>
      )}
      {result && result.status === 'degraded' && (
        <p className="muted">
          Semble is installed but not responding — code Q&amp;A is unavailable right now.
        </p>
      )}
      {result && result.status === 'available' && result.sources.length === 0 && (
        <p className="muted">No relevant code found.</p>
      )}
      {result && result.answer && (
        <p className="code-qa-answer" data-testid="code-qa-answer">
          {result.answer}
        </p>
      )}
      {result && result.status === 'available' && !result.summarised && result.sources.length > 0 && (
        <p className="muted">
          Anthropic key not configured — showing located sources without a summary.
        </p>
      )}
      {result && result.sources.length > 0 && (
        <ul className="code-qa-sources" data-testid="code-qa-sources">
          {result.sources.map((s, i) => (
            <li key={`${s.path}:${s.line_start}:${i}`}>
              <code>
                {s.path}:{s.line_start}-{s.line_end}
              </code>
              {s.snippet && <span className="muted"> — {s.snippet.slice(0, 100)}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface EditorProps {
  entry: LibraryEntry;
  attachedItems: { id: string; title: string; type: string; status: string }[];
  directives: Directive[];
  onPatch: (patch: { title?: string; body?: string; tags?: string[] }) => void;
  onSetTracked: (tracked: boolean) => void;
  onReingest: () => void;
  onDelete: () => void;
  onCopySnippet: () => void;
  onUsePrompt: () => void;
  onAttach: () => void;
  onAddDirective: () => void;
  onEditDirective: (d: Directive) => void;
  onDeleteDirective: (d: Directive) => void;
}

// E20b — user-mediated LLM-assist for the project_spec entry. Drafts a revision (draft-only;
// the backend never writes), shows it for review, and on Accept hands it to the editor's
// standard save path. AI-unavailable / failed states are disclosed, never a fake draft (T-D60).
export function SpecAssistPanel({
  projectId,
  onAccept,
}: {
  projectId: string;
  onAccept: (draft: string) => void;
}) {
  const [instruction, setInstruction] = useState('');
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    setDraft(null);
    try {
      const r = await api.draftProjectSpec(projectId, instruction);
      if (r.result.status === 'ok' && r.result.draft !== null) {
        setDraft(r.result.draft);
      } else if (r.result.status === 'unavailable') {
        setError('AI is not configured — set an Anthropic API key in settings to draft revisions.');
      } else {
        setError('The draft request failed — try again.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The draft request failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="spec-assist" data-testid="spec-assist">
      <h3>Revise with AI</h3>
      <p className="form-hint">
        AI drafts a revision for you to review — nothing is saved until you accept.
      </p>
      <input
        type="text"
        placeholder="What should change? (optional — leave blank to improve overall)"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        data-testid="spec-assist-instruction"
      />
      <button type="button" onClick={() => void generate()} disabled={busy} data-testid="spec-assist-draft">
        {busy ? 'Drafting…' : 'Draft revision'}
      </button>
      {error && (
        <p className="error" role="alert" data-testid="spec-assist-error">
          {error}
        </p>
      )}
      {draft !== null && (
        <div className="spec-assist-preview" data-testid="spec-assist-preview">
          <textarea readOnly value={draft} rows={10} aria-label="Proposed spec draft" />
          <div className="spec-assist-actions">
            <button
              type="button"
              onClick={() => {
                onAccept(draft);
                setDraft(null);
              }}
              data-testid="spec-assist-accept"
            >
              Accept
            </button>
            <button type="button" onClick={() => setDraft(null)} data-testid="spec-assist-reject">
              Reject
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function EntryEditor({
  entry,
  attachedItems,
  directives,
  onPatch,
  onSetTracked,
  onReingest,
  onDelete,
  onCopySnippet,
  onUsePrompt,
  onAttach,
  onAddDirective,
  onEditDirective,
  onDeleteDirective,
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
      {entry.type === 'imported_doc' && entry.source_path && (
        <section className="library-editor-source" data-testid="library-editor-source">
          <h3>Source</h3>
          <p>
            <code>{entry.source_path}</code>
            {entry.ingested_at && (
              <span className="meta">
                {' '}
                · ingested {new Date(entry.ingested_at).toLocaleString()}
              </span>
            )}
          </p>
          <label>
            <input
              type="checkbox"
              checked={entry.source_tracked}
              onChange={(e) => onSetTracked(e.target.checked)}
              data-testid="library-source-track-toggle"
            />
            Track source (re-ingest on file change)
          </label>
          <button
            type="button"
            onClick={onReingest}
            data-testid="library-source-reingest"
          >
            Re-ingest now
          </button>
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
      {entry.type === 'project_spec' && (
        <SpecAssistPanel
          projectId={entry.project_id}
          onAccept={(draft) => {
            // User-mediated: the AI never writes — the user clicked Accept. Load the draft
            // into the editor and persist it via the standard library update path.
            setBody(draft);
            onPatch({ body: draft });
          }}
        />
      )}
      <section className="library-directives" data-testid="library-directives">
        <h3>Directives ({directives.length})</h3>
        {directives.length === 0 && (
          <p className="muted">No directives — add a pin, reminder, or include-in-prompt.</p>
        )}
        {directives.length > 0 && (
          <ul className="library-directives-list">
            {directives.map((d) => (
              <li key={d.id} data-testid={`library-directive-${d.id}`}>
                <span className="meta">{d.kind}</span>
                {d.kind === 'reminder' && d.next_fire_at !== null && (
                  <span> · {new Date(d.next_fire_at).toLocaleString()}</span>
                )}
                <button
                  type="button"
                  onClick={() => onEditDirective(d)}
                  data-testid={`library-directive-edit-${d.id}`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteDirective(d)}
                  data-testid={`library-directive-delete-${d.id}`}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onAddDirective}
          data-testid="library-directive-add"
        >
          Add directive…
        </button>
      </section>
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
