import type { BundleStructuralError } from './bundle.js';

// Phase E E5 — background-job health model (C-D26; SF5-01/02/04; T-D60 kinship).
// The honest, observable state of each long-running background loop (backup scheduler,
// reminder scheduler, GitHub poller). Pre-E5 these loops caught-and-logged with no state
// field, so a loop that started failing every tick looked identical to a healthy idle
// loop. C-D26 makes the failure a typed, queryable fact on the wire.

export interface BackgroundJobHealth {
  // Stable identifier for the loop (e.g. 'backup', 'reminders', 'github-poller').
  name: string;
  // ISO timestamp of the most recent tick (success or failure); null before the first run.
  last_run_at: string | null;
  // Message of the most recent failure; null when the last tick succeeded.
  last_error: string | null;
  // false ⇒ the most recent tick failed. The in-context health surface (C-D25, E6)
  // renders this distinctly from a healthy idle loop.
  healthy: boolean;
}

// Response of GET /api/background-jobs/health.
export interface BackgroundJobsHealthResponse {
  jobs: BackgroundJobHealth[];
}

// Phase E E6 — the C-D25 tri-state visibility vocabulary (LBD-2). One shared frontend
// component (`<HealthStatus>`) renders this state in-context beside each feature it
// concerns, rather than a consolidated "system health" panel.
//   'healthy'  — the capability is present and working.
//   'degraded' — the capability is bound/configured but currently failing (the
//                bound-but-broken case that SF2-02 made indistinguishable from freeform).
//   'absent'   — the capability is legitimately not in use (e.g. a freeform project with
//                no methodology gates) — working as intended, not a fault.
export type HealthState = 'healthy' | 'degraded' | 'absent';

// Per-project methodology bundle health (SF2-02 / SF2-06). Resolves the project's actual
// bundle through the C-D14/C-D19 precedence (external path → per-repo → install-shipped),
// so a broken *external or per-repo* bundle is surfaced here per-project — not only the
// install-cache bundles that GET /api/methodologies lists.
export interface MethodologyHealthResult {
  state: HealthState;
  bundle_id: string;
  // Present when state === 'degraded' (the bound bundle failed to load).
  errors?: BundleStructuralError[];
}
