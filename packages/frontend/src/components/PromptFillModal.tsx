import { useEffect, useMemo, useState } from 'react';
import type { LibraryEntry } from '@throughline/shared';
import { extractPromptVariables } from '@throughline/shared';
import { api } from '../api.js';
import { useModalRegistration } from '../keyboard/modalStack.js';

interface Props {
  open: boolean;
  onClose: () => void;
  entry: LibraryEntry | null; // null until the user opens it on a specific prompt
}

// Phase 6a — `{{var_name}}` placeholder fill flow (§13 adopted default).
// Variables are extracted via the shared helper so the backend's render path and the
// frontend's input generation cannot drift on which token shape counts as a variable.
export function PromptFillModal({ open, onClose, entry }: Props) {
  useModalRegistration('prompt-fill', open, onClose);

  const variables = useMemo(
    () => (entry ? extractPromptVariables(entry.body) : []),
    [entry],
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [rendered, setRendered] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && entry) {
      const seeded: Record<string, string> = {};
      for (const v of variables) seeded[v] = '';
      setValues(seeded);
      // No variables → the body is the rendered output; render immediately so Copy works.
      setRendered(variables.length === 0 ? entry.body : null);
      setMissing([]);
      setCopyState('idle');
      setError(null);
      setSubmitting(false);
    }
  }, [open, entry, variables]);

  if (!open || !entry) return null;

  async function onRender() {
    if (!entry) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await api.fillPrompt(entry.project_id, entry.id, { values });
      setRendered(r.result.rendered);
      setMissing(r.result.missing_vars);
      setCopyState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function onCopy() {
    if (rendered === null) return;
    try {
      await navigator.clipboard.writeText(rendered);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-label={`Fill prompt: ${entry.title}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal prompt-fill-modal" data-testid="prompt-fill-modal">
        <h2 style={{ marginTop: 0 }}>Fill prompt — {entry.title}</h2>
        {variables.length === 0 ? (
          <p className="form-hint">
            This prompt has no <code>{`{{var_name}}`}</code> placeholders. Use the body as-is.
          </p>
        ) : (
          variables.map((v) => (
            <label key={v} className="form-row">
              <span>{v}</span>
              <input
                type="text"
                value={values[v] ?? ''}
                data-testid={`prompt-var-${v}`}
                onChange={(e) => setValues({ ...values, [v]: e.target.value })}
              />
            </label>
          ))
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {rendered !== null && (
          <section className="prompt-fill-preview" data-testid="prompt-fill-preview">
            <h3 style={{ margin: '8px 0 4px' }}>Rendered</h3>
            <pre>{rendered}</pre>
            {missing.length > 0 && (
              <p className="form-hint">
                Missing values for: <code>{missing.join(', ')}</code> — they rendered as empty
                strings.
              </p>
            )}
          </section>
        )}
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
          {variables.length > 0 && (
            <button
              type="button"
              onClick={() => void onRender()}
              disabled={submitting}
              data-testid="prompt-fill-render"
            >
              {submitting ? 'Rendering…' : 'Render'}
            </button>
          )}
          <button
            type="button"
            className="primary"
            disabled={rendered === null && variables.length > 0}
            onClick={() => {
              if (rendered === null) {
                void (async () => {
                  await onRender();
                })();
              } else {
                void onCopy();
              }
            }}
            data-testid="prompt-fill-copy"
          >
            {rendered === null && variables.length > 0
              ? 'Render & copy'
              : copyState === 'copied'
                ? 'Copied!'
                : copyState === 'error'
                  ? 'Copy failed'
                  : 'Copy to clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
