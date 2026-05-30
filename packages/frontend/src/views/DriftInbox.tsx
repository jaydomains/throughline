import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { DriftReverifyResult } from '@throughline/shared';
import { api } from '../api.js';
import { useDriftInbox } from '../hooks/useDriftInbox.js';
import { LoadError } from '../components/LoadError.js';

// Phase 10 (T-D21; SPEC §7.14) — the drift inbox holds WEAK signals (code tier-4 +
// discipline) with explicit reasoning text. Every signal carries re-verify-via-AI,
// manual reopen, and dismiss actions (CHECKLIST §Phase 10).

export function DriftInbox() {
  const { id } = useParams();
  const projectId = id ?? null;
  const { inbox, refresh, error: loadError } = useDriftInbox(projectId);
  const [verdicts, setVerdicts] = useState<Record<string, DriftReverifyResult>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<Error | null>(null);

  if (!projectId) return null;

  const act = async (fn: () => Promise<unknown>, key: string) => {
    setBusy(key);
    setActionError(null);
    try {
      await fn();
      await refresh();
    } catch (e: unknown) {
      // SF6 — the action helper previously had no catch, so a failed re-verify /
      // reopen / dismiss surfaced as an unhandled rejection and the row looked inert.
      setActionError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="drift-inbox" data-testid="drift-inbox">
      <h1>
        Drift inbox{' '}
        <span className="header-pill" data-testid="drift-inbox-total">
          {inbox.total_count}
        </span>
      </h1>
      <p className="muted">
        code {inbox.code_count} · discipline {inbox.discipline_count} — weak signals only;
        strong code-drift tiers badge items directly.
      </p>
      <LoadError error={loadError} what="drift inbox" />
      <LoadError error={actionError} what="drift action" />
      {inbox.signals.length === 0 ? (
        <p className="muted">No open drift signals.</p>
      ) : (
        <ul className="drift-list">
          {inbox.signals.map((s) => (
            <li key={s.id} className="drift-row" data-testid={`drift-signal-${s.id}`}>
              <span className={`tag ${s.stream}`}>
                {s.stream}/{s.category}
              </span>
              <span className="reason">{s.reason}</span>
              {verdicts[s.id] && (
                <span className="reverify-verdict" data-testid={`verdict-${s.id}`}>
                  {verdicts[s.id]!.verdict}: {verdicts[s.id]!.detail}
                </span>
              )}
              <span className="drift-actions">
                <button
                  type="button"
                  disabled={busy === s.id}
                  onClick={() =>
                    act(async () => {
                      const v = await api.reverifyDriftSignal(projectId, s.id);
                      setVerdicts((m) => ({ ...m, [s.id]: v }));
                    }, s.id)
                  }
                >
                  Re-verify (AI)
                </button>
                <button
                  type="button"
                  disabled={busy === s.id}
                  onClick={() => act(() => api.reopenDriftSignal(projectId, s.id), s.id)}
                >
                  Reopen
                </button>
                <button
                  type="button"
                  disabled={busy === s.id}
                  onClick={() => act(() => api.dismissDriftSignal(projectId, s.id), s.id)}
                >
                  Dismiss
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
