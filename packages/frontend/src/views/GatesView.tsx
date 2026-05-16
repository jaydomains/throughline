import { useCallback, useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import type { DisciplineDriftResult, GateFiring, GateFiringsResult } from '@throughline/shared';
import { api, type MethodologySummary } from '../api.js';
import { findBundle } from '../hooks/useMethodologies.js';

// Phase 8 — methodology-gates view (SPEC §7.11/§7.12, C-D6). Gate failures surface as
// proposals; never repo blocks (T-D44). Hidden for freeform-bound projects (no gates).

const TRIGGERABLE: ReadonlySet<string> = new Set(['pre-write', 'pr-open']);

function statusClass(s: GateFiring['status']): string {
  return `gate-status gate-status-${s}`;
}

export function GatesView({
  bundles,
  projectBundleId,
}: {
  bundles: MethodologySummary[];
  projectBundleId: string;
}) {
  const { id } = useParams<{ id: string }>();
  const bundle = findBundle(bundles, projectBundleId);
  const hidden = bundle && (bundle.status !== 'loaded' || bundle.has_gates !== true);

  const [result, setResult] = useState<GateFiringsResult | null>(null);
  const [drift, setDrift] = useState<DisciplineDriftResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rescanning, setRescanning] = useState(false);

  const refresh = useCallback(() => {
    if (!id) return;
    api
      .listGateFirings(id)
      .then(setResult)
      .catch(() => setError('Failed to load gate firings.'));
    api
      .getDisciplineDrift(id)
      .then(setDrift)
      .catch(() => setError('Failed to load discipline drift.'));
  }, [id]);

  const rescanDrift = async () => {
    if (!id) return;
    setRescanning(true);
    setError(null);
    try {
      setDrift(await api.rescanDisciplineDrift(id));
    } catch {
      setError('Discipline-drift re-scan failed.');
    } finally {
      setRescanning(false);
    }
  };

  useEffect(() => {
    if (hidden || !id) return;
    refresh();
  }, [hidden, id, refresh]);

  if (hidden) return <Navigate to=".." relative="path" replace />;

  const runMoment = async (moment: string) => {
    if (!id) return;
    setBusy(moment);
    setError(null);
    try {
      await api.runGateMoment(id, moment);
      refresh();
    } catch {
      setError(`Failed to run ${moment} gates.`);
    } finally {
      setBusy(null);
    }
  };

  const override = async (firing: GateFiring) => {
    if (!id) return;
    const reason = window.prompt(`Override "${firing.gate_id}" — reason (audit-logged):`);
    if (!reason || reason.trim().length === 0) return;
    try {
      await api.overrideGateFiring(id, firing.id, reason.trim());
      refresh();
    } catch {
      setError('Override failed.');
    }
  };

  const groups = result?.groups ?? [];

  return (
    <div className="view-gates" data-testid="view-gates">
      <h1>Methodology gates</h1>
      <p className="muted">
        Bundle-declared gates per phase moment. Failures are proposals — Throughline never
        blocks the repo (T-D44). Override with reason or fix and retry.
      </p>
      <div className="gates-actions">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => runMoment('pre-write')}
          data-testid="run-pre-write"
        >
          Run pre-write checks
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {groups.length === 0 && (
        <p className="muted" data-testid="gates-empty">
          No gate firings yet. Trigger a moment (or commit in the repo) to populate this view.
        </p>
      )}
      {groups.map((group) => (
        <section
          key={group.moment}
          className="gate-moment"
          data-testid={`gate-moment-${group.moment}`}
        >
          <div className="gate-moment-head">
            <h2>{group.moment}</h2>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => runMoment(group.moment)}
              data-testid={`retry-${group.moment}`}
            >
              {TRIGGERABLE.has(group.moment) ? 'Run' : 'Fix and retry'}
            </button>
          </div>
          {group.firings.length === 0 && (
            <p className="muted">No firings recorded for this moment yet.</p>
          )}
          {group.firings.map((f) => (
            <div
              key={f.id}
              className="gate-firing"
              data-testid={`gate-firing-${f.gate_id}`}
            >
              <div className="gate-firing-head">
                <span className={statusClass(f.status)} data-testid={`gate-status-${f.gate_id}`}>
                  {f.findings.override ? 'overridden' : f.status}
                </span>
                <strong>{f.gate_id}</strong>
                <span className="muted">{f.findings.check}</span>
              </div>
              <p className="gate-summary">{f.findings.summary}</p>
              {f.findings.items.length > 0 && (
                <ul className="gate-findings">
                  {f.findings.items.map((it, i) => (
                    <li key={i}>
                      {it.message}
                      {it.ref ? <span className="muted"> — {it.ref}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
              {f.findings.override ? (
                <p className="muted gate-override">
                  Overridden: {f.findings.override.reason}
                </p>
              ) : (
                (f.status === 'fail' || f.status === 'error') && (
                  <button
                    type="button"
                    className="gate-override-btn"
                    onClick={() => override(f)}
                    data-testid={`override-${f.gate_id}`}
                  >
                    Override with reason
                  </button>
                )
              )}
            </div>
          ))}
        </section>
      ))}

      <section className="discipline-drift" data-testid="discipline-drift">
        <div className="gate-moment-head">
          <h2>Discipline drift</h2>
          <button
            type="button"
            disabled={rescanning}
            onClick={() => void rescanDrift()}
            data-testid="discipline-drift-rescan"
          >
            {rescanning ? 'Re-scanning…' : 'Re-scan'}
          </button>
        </div>
        <p className="muted">
          Bundle-declared discipline-drift categories (SPEC §7.14). Signals are advisory —
          they badge primary units and affected items but never block the repo (T-D44).
        </p>
        {(!drift || drift.groups.length === 0) && (
          <p className="muted" data-testid="discipline-drift-empty">
            No discipline drift detected.
          </p>
        )}
        {drift?.groups.map((g) => (
          <div
            key={g.category}
            className="drift-category"
            data-testid={`drift-category-${g.category}`}
          >
            <h3>
              {g.category} <span className="muted">({g.signals.length})</span>
            </h3>
            <ul className="gate-findings">
              {g.signals.map((s) => (
                <li key={s.id} data-testid={`drift-signal-${s.id}`}>
                  {s.reason}
                  {s.item_id ? <span className="muted"> — item {s.item_id}</span> : null}
                  {s.primary_unit_ref ? (
                    <span className="muted"> — unit {s.primary_unit_ref}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
