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
