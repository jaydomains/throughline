import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Item } from '@throughline/shared';
import { api } from '../api.js';
import { useItems } from '../hooks/useItems.js';
import { useDriftInbox } from '../hooks/useDriftInbox.js';
import { useDirectives } from '../hooks/useDirectives.js';
import { useStaleThreshold, isStale } from '../hooks/useStaleThreshold.js';

// Promoted out of stubs.tsx (UI redesign Slice 3): the across-everything
// daily landing. Driven entirely by existing hooks — no new state. Sections
// that need data Throughline does not yet model (CC push timeline, the
// methodology phase card) are intentionally omitted rather than faked.

function isBlocked(it: Item): boolean {
  return (
    /block/i.test(it.status) ||
    (it.blockers?.length ?? 0) > 0 ||
    Boolean(it.blocker_text && it.blocker_text.trim())
  );
}

function isInProgress(it: Item): boolean {
  return /progress|doing|active/i.test(it.status) && !isBlocked(it);
}

export function HomeView() {
  const { id: projectId } = useParams();
  const { items } = useItems({ projectId: projectId ?? null });
  const { inbox } = useDriftInbox(projectId ?? null);
  const { directives } = useDirectives(projectId ?? null);
  const staleDays = useStaleThreshold();

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{
    scan_id: string;
    proposal_id: string;
    match_count: number;
  } | null>(null);

  const { inProgress, blocked } = useMemo(() => {
    const ip: Item[] = [];
    const bl: Item[] = [];
    for (const it of items) {
      if (isBlocked(it)) bl.push(it);
      else if (isInProgress(it)) ip.push(it);
    }
    return { inProgress: ip, blocked: bl };
  }, [items]);

  async function runScan() {
    if (!projectId) return;
    setScanning(true);
    setScanError(null);
    setScanResult(null);
    try {
      const r = await api.scanCodeTodos(projectId);
      setScanResult(r.result);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  const stats = [
    { label: 'In progress', value: inProgress.length },
    { label: 'Blocked', value: blocked.length },
    { label: 'Drift signals', value: inbox.total_count },
    { label: 'Directives', value: directives.length },
  ];

  return (
    <div className="home" data-testid="view-home">
      <div className="home-hero">
        <div className="home-hero-meta">
          <div className="eyebrow">Project</div>
          <h1 className="h1" data-testid="home-title">
            Across everything
          </h1>
          <div className="muted">
            {items.length} item{items.length === 1 ? '' : 's'} · {inbox.total_count} drift signal
            {inbox.total_count === 1 ? '' : 's'} · {directives.length} directive
            {directives.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="home-hero-actions">
          <button
            type="button"
            className="btn"
            onClick={() => void runScan()}
            disabled={scanning || !projectId}
            data-testid="code-todo-scan"
          >
            {scanning ? 'Scanning…' : 'Scan repo for TODOs'}
          </button>
          {projectId && (
            <Link className="btn primary" to={`/projects/${projectId}/capture`}>
              + Capture
            </Link>
          )}
        </div>
      </div>

      {scanError && (
        <p className="form-error" role="alert">
          {scanError}
        </p>
      )}
      {scanResult && (
        <p className="form-hint" data-testid="code-todo-result">
          Found {scanResult.match_count} match{scanResult.match_count === 1 ? '' : 'es'}; proposal
          saved as <code>{scanResult.proposal_id.slice(0, 8)}</code>. Open a session to apply.
        </p>
      )}

      <div className="home-stats">
        {stats.map((s) => (
          <div className="stat" key={s.label} data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, '-')}`}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="home-grid">
        <div>
          <div className="section-divider">
            <span className="num mono">01</span>
            <h2 className="h2">In progress</h2>
          </div>
          <div className="card" style={{ padding: 0 }}>
            {inProgress.length === 0 && (
              <div className="home-empty muted">Nothing in progress.</div>
            )}
            {inProgress.map((it) => (
              <div className="home-row" key={it.id} data-testid={`inprogress-${it.id}`}>
                <span className="mono faint id">{it.id.slice(0, 7)}</span>
                <span className="home-row-title">
                  {it.title}
                  {isStale(it.updated_at, staleDays) && (
                    <span className="pill warn" title="Stale">
                      ⚑ stale
                    </span>
                  )}
                </span>
                <span className="pill ghost mono">{it.type}</span>
              </div>
            ))}
          </div>

          <div className="section-divider">
            <span className="num mono">02</span>
            <h2 className="h2">Blocked</h2>
          </div>
          <div className="card" style={{ padding: 0 }}>
            {blocked.length === 0 && <div className="home-empty muted">Nothing blocked.</div>}
            {blocked.map((it) => (
              <div className="home-row" key={it.id} data-testid={`blocked-${it.id}`}>
                <span className="mono faint id">{it.id.slice(0, 7)}</span>
                <span className="home-row-title">
                  {it.title}
                  {it.blocker_text && (
                    <span className="muted home-blocker">{it.blocker_text}</span>
                  )}
                </span>
                {isStale(it.updated_at, staleDays) && (
                  <span className="pill warn">⚑ stale</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="section-divider">
            <span className="num mono">03</span>
            <h2 className="h2">Drift</h2>
          </div>
          {inbox.total_count === 0 ? (
            <div className="card muted">Inbox clear — no open drift signals.</div>
          ) : (
            <div className="drift-list">
              <Link
                to={projectId ? `/projects/${projectId}/drift-inbox` : '#'}
                className="drift-row"
                data-testid="home-drift-code"
              >
                <span className="tier t1">code</span>
                <span className="reason">Code drift signals</span>
                <span className="ref mono">{inbox.code_count}</span>
              </Link>
              <Link
                to={projectId ? `/projects/${projectId}/drift-inbox` : '#'}
                className="drift-row"
                data-testid="home-drift-discipline"
              >
                <span className="tier disc">disc</span>
                <span className="reason">Discipline drift signals</span>
                <span className="ref mono">{inbox.discipline_count}</span>
              </Link>
            </div>
          )}

          {directives.length > 0 && (
            <div className="review-nudge card">
              <h3 className="h3">Periodic review</h3>
              <p className="muted">
                {directives.length} active directive{directives.length === 1 ? '' : 's'} in play.
              </p>
              {projectId && (
                <Link className="btn" to={`/projects/${projectId}/directives`}>
                  Review directives
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
