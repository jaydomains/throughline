import { useState } from 'react';
import type {
  ReconcileApplyResult,
  ReconcileRun,
  ReconcileSource,
} from '@throughline/shared';
import { RECONCILE_SOURCES } from '@throughline/shared';
import { api } from '../api.js';
import { useModalRegistration } from '../keyboard/modalStack.js';
import { ReconcileModal } from './ReconcileModal.js';

// Reconcile composer — Phase 5 entry surface. Sits next to the dump zone on a session view.
// Per SPEC §7.7 the input is free-form (transcript, PR description, session note) and runs
// through the reconcile engine to produce a six-category diff against the session's existing
// items. Distinct from the dump zone, which only creates new items / library entries (no
// match-against-existing logic).
//
// Two-surface design (dump zone vs reconcile composer) is intentional in Phase 5: a paste
// containing only new items belongs in the dump zone, a paste containing updates to existing
// items belongs in reconcile. Flagged in the Phase 5 handover as an open UX question — a
// future phase may consolidate or auto-route.

const SOURCE_LABEL: Record<ReconcileSource, string> = {
  'claude-code-transcript': 'Claude Code transcript',
  'pr-description': 'PR description',
  'session-note': 'Session note',
  manual: 'Manual paste',
};

export interface ReconcileComposerProps {
  projectId: string;
  sessionId: string | null;
  onApplied?: (result: ReconcileApplyResult) => void;
}

export function ReconcileComposer({ projectId, sessionId, onApplied }: ReconcileComposerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [source, setSource] = useState<ReconcileSource>('claude-code-transcript');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<ReconcileRun | null>(null);

  useModalRegistration('reconcile-composer', open, () => setOpen(false));

  async function propose() {
    const value = text.trim();
    if (value.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await api.proposeReconcile(projectId, {
        text: value,
        source,
        session_id: sessionId,
      });
      setRun(r.run);
      setOpen(false);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="reconcile-composer" data-testid="reconcile-composer">
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="reconcile-open"
      >
        Reconcile from input
      </button>

      {open && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-label="Reconcile composer"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="modal reconcile-composer-modal" data-testid="reconcile-composer-modal">
            <h2 style={{ marginTop: 0 }}>Reconcile against this session</h2>
            <p className="form-hint">
              Paste a Claude Code transcript, PR description, or session note. The engine matches
              against existing items and produces a six-category diff for review.
            </p>
            <div className="form-row">
              <label htmlFor="reconcile-source-select">Source</label>
              <select
                id="reconcile-source-select"
                value={source}
                onChange={(e) => setSource(e.target.value as ReconcileSource)}
                data-testid="reconcile-source"
              >
                {RECONCILE_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              aria-label="Reconcile input"
              placeholder="Paste reconcile input here."
              value={text}
              onChange={(e) => setText(e.target.value)}
              data-testid="reconcile-textarea"
              rows={10}
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button type="button" onClick={() => setOpen(false)} disabled={submitting}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => void propose()}
                disabled={submitting || text.trim().length === 0}
                data-testid="reconcile-submit"
              >
                {submitting ? 'Reconciling…' : 'Reconcile'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ReconcileModal
        open={run !== null}
        run={run}
        projectId={projectId}
        onClose={() => setRun(null)}
        onApplied={(result) => {
          setRun(null);
          onApplied?.(result);
        }}
      />
    </div>
  );
}
