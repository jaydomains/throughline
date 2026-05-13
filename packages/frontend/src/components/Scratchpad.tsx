import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScratchpadJot } from '@throughline/shared';
import { api } from '../api.js';

// T-D20 — scratchpad is friction-free. No AI, no review, no routing. Project-scoped: the
// header passes the active project id; jots without an active project are not supported
// from the UI in v1 (the backend accepts null project_id but the header gates capture).

interface ScratchpadProps {
  activeProjectId: string | null;
}

export function Scratchpad({ activeProjectId }: ScratchpadProps) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [jots, setJots] = useState<ScratchpadJot[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const reload = useCallback(() => {
    if (!activeProjectId) {
      setJots([]);
      return;
    }
    api
      .listScratchpadJots(activeProjectId, 20)
      .then((r) => setJots(r.jots))
      .catch(() => {});
  }, [activeProjectId]);

  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  // Close on outside-click. The textarea inside should not close the panel.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => textareaRef.current?.focus());
    }
  }, [open]);

  async function save() {
    const trimmed = body.trim();
    if (!trimmed || !activeProjectId || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.createScratchpadJot(activeProjectId, trimmed);
      setBody('');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(jotId: string) {
    if (!activeProjectId) return;
    try {
      await api.deleteScratchpadJot(activeProjectId, jotId);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void save();
    }
  }

  const canSave = activeProjectId !== null && body.trim().length > 0 && !saving;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="scratchpad-trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-testid="scratchpad-toggle"
      >
        Scratchpad{jots.length > 0 && <span className="badge"> ({jots.length})</span>}
      </button>
      {open && (
        <div className="scratchpad-panel" role="region" aria-label="Scratchpad">
          {!activeProjectId && (
            <div className="form-hint">Open a project to capture jots.</div>
          )}
          <textarea
            ref={textareaRef}
            aria-label="Scratchpad input"
            placeholder="Type a thought; ⌘+Enter to save."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={!activeProjectId}
            data-testid="scratchpad-input"
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="primary"
              onClick={() => void save()}
              disabled={!canSave}
              data-testid="scratchpad-save"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          <ul className="scratchpad-jots" data-testid="scratchpad-jot-list">
            {jots.map((j) => (
              <li key={j.id}>
                <span className="jot-body">{j.body}</span>
                <button
                  type="button"
                  className="link"
                  onClick={() => void remove(j.id)}
                  aria-label={`Delete jot from ${j.created_at}`}
                >
                  ×
                </button>
              </li>
            ))}
            {jots.length === 0 && <li className="form-hint">No jots yet.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
