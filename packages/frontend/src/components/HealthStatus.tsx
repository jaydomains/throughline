import type { HealthState } from '@throughline/shared';

// C-D25 (E6, LBD-2) — the single shared system-state visibility component. Renders a
// capability's tri-state health (healthy / degraded / absent) in-context, beside the
// feature it concerns — deliberately NOT a consolidated "system health" panel. The three
// states map to the LBD-2 vocabulary: a degraded capability (bound-but-broken) reads
// distinctly from an absent one (legitimately not in use), the distinction the silent
// failures (SF2-02, SF5-01/02/04) erased.
//
// Presentational only: the caller fetches the state (via useResource / a polled hook,
// C-D24) and passes the resolved `state`. `detail` carries the degraded reason
// (e.g. a parse error or a job's last_error) so the surface is honest about *why*.

const LABEL: Record<HealthState, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  absent: 'Not configured',
};

export function HealthStatus({
  state,
  label,
  detail,
  testid,
}: {
  state: HealthState;
  // What this health concerns, e.g. "Methodology bundle" or a job name.
  label: string;
  // Optional degraded/extra detail (the honest "why" — error message, etc.).
  detail?: string | null;
  testid?: string;
}) {
  return (
    <p
      className={`health-status health-${state}`}
      role={state === 'degraded' ? 'alert' : undefined}
      data-testid={testid ?? `health-${label}`}
      data-state={state}
    >
      <span className="health-label">{label}:</span> <span className="health-state">{LABEL[state]}</span>
      {detail ? <span className="health-detail"> — {detail}</span> : null}
    </p>
  );
}
