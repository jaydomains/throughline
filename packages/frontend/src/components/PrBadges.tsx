import { useEffect, useRef, useState } from 'react';
import type { PrBadge } from '@throughline/shared';
import { api } from '../api.js';

// Phase 10 (SPEC §7.13) — per-session PR badges: 🟡 needs review / 🟢 approved /
// ✓ merged, plus the activity timestamp and a link to the PR. Polling-only (T-D7); the
// backend poller keeps the cache warm — this just renders it, with a manual refresh.

const STATE_GLYPH: Record<string, string> = {
  open: '🟡',
  approved: '🟢',
  merged: '✓',
  reverted: '↩',
  closed: '⊘',
};

export function PrBadges({ projectId }: { projectId: string }) {
  const [prs, setPrs] = useState<PrBadge[]>([]);
  const [configured, setConfigured] = useState(true);
  // SF6-09 / T-D60 — distinguish three failures that previously all rendered as the healthy
  // "none tracked": (a) the fetch itself rejected (`fetchError`), and (b) the project is
  // configured but the background poller is failing so the cached list may be stale
  // (`pollHealthy`, surfaced from C-D26 on the wire). A degraded capability must read
  // distinctly from an honest absence.
  const [fetchError, setFetchError] = useState(false);
  const [pollHealthy, setPollHealthy] = useState(true);
  const [pollError, setPollError] = useState<string | null>(null);

  // Same stale-request guard as S8-01/S8-02: if projectId changes (or a manual refresh is
  // superseded) while a request is in flight, drop the late response so it can't paint the
  // previous project's PRs over the current one.
  const prsSeq = useRef(0);
  const load = (refresh: boolean) => {
    const seq = ++prsSeq.current;
    const p = refresh ? api.refreshProjectPrs(projectId) : api.getProjectPrs(projectId);
    p.then((r) => {
      if (prsSeq.current !== seq) return;
      setConfigured(r.configured);
      setPrs(r.prs);
      setPollHealthy(r.poll_healthy);
      setPollError(r.poll_error);
      setFetchError(false);
    }).catch(() => {
      if (prsSeq.current !== seq) return;
      setFetchError(true);
    });
  };

  useEffect(() => {
    // Re-fetch only when the project changes; `load` is a stable per-render closure
    // and is intentionally excluded to avoid a fetch loop.
    load(false);
  }, [projectId]);

  // A clean, unconfigured project genuinely has no PR surface — render nothing. But if the
  // fetch failed we don't actually know it's unconfigured, so fall through and show the error.
  if (!configured && !fetchError) return null;

  return (
    <div className="pr-badges" data-testid="pr-badges">
      <span className="muted">PRs:</span>
      {fetchError ? (
        <span className="error" role="alert" data-testid="pr-badges-error">
          PR status unavailable — couldn't reach the server.
        </span>
      ) : prs.length === 0 ? (
        <span className="muted">none tracked</span>
      ) : (
        prs.map((pr) => (
          <a
            key={`${pr.repo}#${pr.pr_number}`}
            className={`pr-badge ${pr.state}`}
            href={pr.url}
            target="_blank"
            rel="noreferrer"
            title={`${pr.title} — ${pr.state} — ${pr.activity_at}`}
            data-testid={`pr-badge-${pr.pr_number}`}
          >
            {STATE_GLYPH[pr.state] ?? '•'} #{pr.pr_number}
          </a>
        ))
      )}
      {!fetchError && !pollHealthy && (
        <span
          className="pr-badges-stale"
          role="alert"
          data-testid="pr-badges-stale"
          title={pollError ?? 'GitHub polling is failing'}
        >
          ⚠ polling failing — data may be stale
        </span>
      )}
      <button type="button" onClick={() => load(true)} data-testid="pr-badges-refresh">
        ↻
      </button>
    </div>
  );
}
