import { useEffect, useState } from 'react';
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

  const load = (refresh: boolean) => {
    const p = refresh ? api.refreshProjectPrs(projectId) : api.getProjectPrs(projectId);
    p.then((r) => {
      setConfigured(r.configured);
      setPrs(r.prs);
    }).catch(() => setPrs([]));
  };

  useEffect(() => {
    // Re-fetch only when the project changes; `load` is a stable per-render closure
    // and is intentionally excluded to avoid a fetch loop.
    load(false);
  }, [projectId]);

  if (!configured) return null;

  return (
    <div className="pr-badges" data-testid="pr-badges">
      <span className="muted">PRs:</span>
      {prs.length === 0 ? (
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
      <button type="button" onClick={() => load(true)} data-testid="pr-badges-refresh">
        ↻
      </button>
    </div>
  );
}
