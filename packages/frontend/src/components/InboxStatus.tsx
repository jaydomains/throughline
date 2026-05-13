import { useCallback, useEffect, useState } from 'react';
import type { InboxQueueEntry, InboxStatusSummary } from '@throughline/shared';
import { api } from '../api.js';

// Header pill + popover for the Claude Code inbox (T-D16, T-D37). Polls every 10s when open
// so users see new files arriving without a manual refresh. Closed-state polling avoids the
// noise — the backend already archives/quarantines autonomously.

const POLL_MS = 10_000;

export function InboxStatus() {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<InboxStatusSummary>({
    queued: 0,
    processed_recent: 0,
    failed_recent: 0,
  });
  const [entries, setEntries] = useState<InboxQueueEntry[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await api.getInboxQueue(50);
      setSummary(r.summary);
      setEntries(r.entries);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [open, refresh]);

  async function scan() {
    setScanning(true);
    try {
      await api.scanInbox();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  const total = summary.queued + summary.failed_recent;

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="header-pill"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="Claude Code inbox"
        data-testid="inbox-toggle"
      >
        <span className={`dot ${summary.failed_recent > 0 ? 'danger' : summary.queued > 0 ? '' : 'ok'}`} />
        inbox{total > 0 ? ` (${total})` : ''}
      </button>
      {open && (
        <div className="inbox-popover" role="region" aria-label="Inbox status">
          <div className="inbox-summary">
            <span>Queued: {summary.queued}</span>
            <span>Processed: {summary.processed_recent}</span>
            <span>Failed: {summary.failed_recent}</span>
          </div>
          <div className="form-actions">
            <button
              type="button"
              onClick={() => void scan()}
              disabled={scanning}
              data-testid="inbox-scan"
            >
              {scanning ? 'Scanning…' : 'Scan now'}
            </button>
            <button type="button" onClick={() => void refresh()}>
              Refresh
            </button>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <ul className="inbox-entries" data-testid="inbox-entries">
            {entries.length === 0 && <li className="form-hint">No inbox entries yet.</li>}
            {entries.slice(0, 10).map((e) => (
              <li key={e.id}>
                <span className={`badge state-${e.state}`}>{e.state}</span>
                <span className="path" title={e.original_path}>
                  {e.original_path.split('/').slice(-1)[0]}
                </span>
                {e.error_text && <span className="form-error">{e.error_text.slice(0, 60)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
