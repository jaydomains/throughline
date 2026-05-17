import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type {
  ChatContextType,
  ChatMessage,
  DoNextResult,
  PeriodicReviewResult,
  RagQueryResult,
  RagSubstrate,
  StakeholderViewResult,
} from '@throughline/shared';
import { api } from '../api.js';

// Phase 14 — intelligence surface (T-D22, T-D25, C-D2; SPEC §7.18, §9). RAG query box
// (heuristic router unless pinned), an end-of-session retro action, and a periodic-review
// hygiene panel (no-AI buckets; AI synthesis only on the user-initiated synthesise).

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
  const [retroSession, setRetroSession] = useState('');
  const [retroAttach, setRetroAttach] = useState(false);
  const [retroAppend, setRetroAppend] = useState(false);
  const [retroMsg, setRetroMsg] = useState<string | null>(null);
  const [review, setReview] = useState<PeriodicReviewResult | null>(null);
  const [reviewSynthesis, setReviewSynthesis] = useState<string | null>(null);
  const [doNext, setDoNext] = useState<DoNextResult | null>(null);
  const [stakeItem, setStakeItem] = useState('');
  const [stake, setStake] = useState<StakeholderViewResult | null>(null);
  const [chatCtxType, setChatCtxType] = useState<ChatContextType>('session');
  const [chatCtxId, setChatCtxId] = useState('');
  const [chatMsg, setChatMsg] = useState('');
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!projectId) return;
    api
      .getPeriodicReview(projectId)
      .then(setReview)
      .catch(() => setReview(null));
    api
      .getDoNext(projectId)
      .then(setDoNext)
      .catch(() => setDoNext(null));
  }, [projectId]);

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

  const runRetro = async () => {
    if (retroSession.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.sessionRetro(projectId, {
        session_id: retroSession.trim(),
        attach_to_items: retroAttach,
        append_to_session_start: retroAppend,
      });
      setRetroMsg(
        `Saved retro note ${r.library_entry_id} (${r.used_ai ? 'AI' : 'structured'})` +
          (r.attached_item_ids.length ? `, attached to ${r.attached_item_ids.length} item(s)` : '') +
          (r.appended_to_session_start ? ', appended to session-start.md' : ''),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Retro failed');
    } finally {
      setBusy(false);
    }
  };

  const synthReview = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.synthesizePeriodicReview(projectId);
      setReviewSynthesis(
        r.answer ?? 'No synthesised review (no Anthropic key) — buckets above stand on their own.',
      );
      setReview(await api.getPeriodicReview(projectId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Synthesis failed');
    } finally {
      setBusy(false);
    }
  };

  const loadStakeholder = async () => {
    if (stakeItem.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      setStake(await api.getStakeholderView(projectId, stakeItem.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stakeholder render failed');
    } finally {
      setBusy(false);
    }
  };

  const loadChat = async () => {
    if (chatCtxId.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      const h = await api.getChatHistory(projectId, chatCtxType, chatCtxId.trim());
      setChatLog(h.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chat load failed');
    } finally {
      setBusy(false);
    }
  };

  const sendChat = async () => {
    if (chatMsg.trim() === '' || chatCtxId.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.sendChat(projectId, {
        context_type: chatCtxType,
        context_id: chatCtxId.trim(),
        message: chatMsg.trim(),
      });
      setChatLog((log) => [...log, r.user_message, r.assistant_message]);
      setChatMsg('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chat send failed');
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

      <hr />
      <h2>End-of-session retro</h2>
      <p className="muted">User-initiated. Summarises the session window, saves a library note.</p>
      <div className="retro-form">
        <input
          data-testid="retro-session"
          placeholder="session id"
          value={retroSession}
          onChange={(e) => setRetroSession(e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            data-testid="retro-attach"
            checked={retroAttach}
            onChange={(e) => setRetroAttach(e.target.checked)}
          />
          Attach to items
        </label>
        <label>
          <input
            type="checkbox"
            data-testid="retro-append"
            checked={retroAppend}
            onChange={(e) => setRetroAppend(e.target.checked)}
          />
          Append to session-start.md
        </label>
        <button type="button" data-testid="retro-run" disabled={busy} onClick={runRetro}>
          Generate retro
        </button>
        {retroMsg && (
          <p className="muted" data-testid="retro-msg">
            {retroMsg}
          </p>
        )}
      </div>

      <hr />
      <h2>
        Periodic review{' '}
        {review && (
          <span className="header-pill" data-testid="review-due">
            {review.due ? 'due' : 'not due'} · every {review.interval_days}d
          </span>
        )}
      </h2>
      {review && (
        <div className="periodic-review" data-testid="periodic-review">
          <ul className="hygiene-buckets">
            {review.buckets.map((b) => (
              <li key={b.category} data-testid={`bucket-${b.category}`}>
                <strong>{b.label}</strong>: {b.count}
                {b.entries.length > 0 && (
                  <ul className="muted">
                    {b.entries.slice(0, 5).map((e) => (
                      <li key={e.ref}>{e.detail}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            data-testid="review-synth"
            disabled={busy}
            onClick={synthReview}
          >
            Synthesise review
          </button>
          {reviewSynthesis && (
            <p className="rag-answer" data-testid="review-synthesis">
              {reviewSynthesis}
            </p>
          )}
        </div>
      )}

      <hr />
      <h2>Do next</h2>
      {doNext && (
        <div className="do-next" data-testid="do-next">
          {doNext.unblock_impact.if_you_unblock.length > 0 ? (
            <p className="muted" data-testid="unblock-impact">
              If you unblock these {doNext.unblock_impact.if_you_unblock.length}, ~
              {doNext.unblock_impact.items_freed} items become unblocked.
            </p>
          ) : (
            <p className="muted">No high-impact unblocks right now.</p>
          )}
          <ol className="do-next-list">
            {doNext.do_next.map((it) => (
              <li key={it.id} data-testid={`do-next-${it.id}`}>
                <strong>{it.title}</strong> — frees {it.downstream_unblocked}
              </li>
            ))}
          </ol>
          {doNext.sequence.some((x) => x.gate_deprioritised) && (
            <p className="muted" data-testid="gate-deprioritised">
              Some items are deprioritised pending methodology-gate clearance.
            </p>
          )}
        </div>
      )}

      <hr />
      <h2>Stakeholder view</h2>
      <p className="muted">Plain-language re-render of one item (cached; refreshes on edit).</p>
      <div className="stakeholder">
        <input
          data-testid="stake-item"
          placeholder="item id"
          value={stakeItem}
          onChange={(e) => setStakeItem(e.target.value)}
        />
        <button type="button" data-testid="stake-run" disabled={busy} onClick={loadStakeholder}>
          Render
        </button>
        {stake && (
          <div className="stakeholder-result" data-testid="stake-result">
            <p className="rag-answer">{stake.rendered}</p>
            <p className="muted">
              {stake.used_ai ? 'AI-rendered' : 'plain restatement'}
              {stake.cached ? ' · cached' : ''}
            </p>
          </div>
        )}
      </div>

      <hr />
      <h2>Chat</h2>
      <p className="muted">
        Per-list (session) or dump-zone chat. History is persisted per context; proposed
        changes route through the review modal.
      </p>
      <div className="chat-panel" data-testid="chat-panel">
        <div className="chat-controls">
          <select
            data-testid="chat-ctx-type"
            value={chatCtxType}
            onChange={(e) => setChatCtxType(e.target.value as ChatContextType)}
          >
            <option value="session">session (per-list)</option>
            <option value="dump_zone">dump_zone</option>
          </select>
          <input
            data-testid="chat-ctx-id"
            placeholder={chatCtxType === 'session' ? 'session id' : 'context id'}
            value={chatCtxId}
            onChange={(e) => setChatCtxId(e.target.value)}
          />
          <button type="button" data-testid="chat-load" disabled={busy} onClick={loadChat}>
            Load history
          </button>
        </div>
        <ul className="chat-log" data-testid="chat-log">
          {chatLog.map((m) => (
            <li key={m.id} className={`chat-${m.role}`}>
              <strong>{m.role}:</strong> {m.content}
            </li>
          ))}
        </ul>
        <textarea
          data-testid="chat-input"
          rows={2}
          value={chatMsg}
          placeholder="Ask about this list…"
          onChange={(e) => setChatMsg(e.target.value)}
        />
        <button type="button" data-testid="chat-send" disabled={busy} onClick={sendChat}>
          Send
        </button>
      </div>
    </section>
  );
}
