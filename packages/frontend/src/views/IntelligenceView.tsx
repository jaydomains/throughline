import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { RagQueryResult, RagSubstrate } from '@throughline/shared';
import { api } from '../api.js';

// Phase 14 — personal RAG surface (T-D25, C-D2; SPEC §7.18, §9). One query box; the
// router picks a substrate by keyword heuristic unless the user pins one. Answers carry
// citations; with no Anthropic key the surface degrades to retrieval-only. Later Phase-14
// slices add the other intelligence sub-surfaces alongside this panel.

const SUBSTRATES: Array<{ value: '' | RagSubstrate; label: string }> = [
  { value: '', label: 'Auto (router)' },
  { value: 'text', label: 'Text' },
  { value: 'code', label: 'Code' },
  { value: 'audit', label: 'Audit' },
];

export function IntelligenceView() {
  const { id } = useParams();
  const projectId = id ?? null;
  const [query, setQuery] = useState('');
  const [substrate, setSubstrate] = useState<'' | RagSubstrate>('');
  const [crossProject, setCrossProject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RagQueryResult | null>(null);
  const [reindexMsg, setReindexMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!projectId) return null;

  const run = async () => {
    if (query.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.ragQuery(projectId, {
        query,
        substrate: substrate === '' ? null : substrate,
        cross_project: crossProject,
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query failed');
    } finally {
      setBusy(false);
    }
  };

  const reindex = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.reindexText(projectId);
      setReindexMsg(`reembedded ${r.reembedded}/${r.total} (${r.embedder})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reindex failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="intelligence-view" data-testid="intelligence-view">
      <h1>Intelligence</h1>
      <p className="muted">
        Personal RAG across text, code, and audit substrates. The router chooses by
        keyword unless you pin a substrate.
      </p>
      <div className="rag-query">
        <textarea
          data-testid="rag-input"
          value={query}
          placeholder="Ask about this project…"
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
        />
        <div className="rag-controls">
          <select
            data-testid="rag-substrate"
            value={substrate}
            onChange={(e) => setSubstrate(e.target.value as '' | RagSubstrate)}
          >
            {SUBSTRATES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <label className="rag-cross">
            <input
              type="checkbox"
              data-testid="rag-cross"
              checked={crossProject}
              onChange={(e) => setCrossProject(e.target.checked)}
            />
            Cross-project
          </label>
          <button type="button" data-testid="rag-run" disabled={busy} onClick={run}>
            Ask
          </button>
          <button type="button" data-testid="rag-reindex" disabled={busy} onClick={reindex}>
            Reindex text
          </button>
        </div>
        {reindexMsg && (
          <p className="muted" data-testid="rag-reindex-msg">
            {reindexMsg}
          </p>
        )}
        {error && (
          <p className="rag-error" role="alert" data-testid="rag-error">
            {error}
          </p>
        )}
      </div>

      {result && (
        <div className="rag-result" data-testid="rag-result">
          <p className="muted">
            substrate <strong>{result.substrate}</strong> · routed by {result.routed_by}
            {result.cross_project ? ' · cross-project' : ''} ·{' '}
            {result.used_ai ? 'AI-synthesised' : 'retrieval-only'}
          </p>
          {result.answer ? (
            <p className="rag-answer" data-testid="rag-answer">
              {result.answer}
            </p>
          ) : (
            <p className="muted" data-testid="rag-answer-empty">
              No synthesised answer (no Anthropic key, or nothing retrieved) — sources
              below.
            </p>
          )}
          <ul className="rag-citations">
            {result.citations.map((c) => (
              <li key={`${c.substrate}:${c.ref}`} data-testid="rag-citation">
                <span className={`tag ${c.substrate}`}>{c.substrate}</span>{' '}
                <strong>{c.label}</strong>
                {c.snippet ? <div className="muted">{c.snippet}</div> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
