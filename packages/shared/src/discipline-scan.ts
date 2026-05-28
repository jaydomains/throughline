// Phase 22 — discipline-drift scan-on-demand for bootstrapped projects (T-D57,
// SPEC §7.14 "Scan-on-demand for bootstrapped projects"). Tracks the three
// per-project scan states so the bootstrap-day-one drift inbox stays quiet
// until the user invokes the first scan deliberately.
//
// Storage shape (per spec-author Q1 at chain-open 2026-05-28): two flat
// scalars in `projects.settings_json`, matching the `periodic_review_interval_days`
// precedent in the same JSON blob. The typed accessor (`readDisciplineScan`)
// gives language-level type safety over the flat storage.
//
// State semantics:
//   • absent — non-bootstrap project; never went through the bootstrap import
//     pipeline. Treated identically to `complete` by gating logic so existing
//     on-bind discipline-scan behaviour is preserved (T-D57: "Non-bootstrapped
//     projects keep current behaviour").
//   • pre-scan — bootstrap import pipeline has set this on first ingest. The
//     drift inbox stays quiet for this project until the user invokes a scan.
//   • running — manual rescan is in flight. Periodic-review skips this project
//     to avoid surfacing partial in-flight results. Self-recovers via the
//     try/finally in the rescan endpoint.
//   • complete — first user-invoked scan has finished. `last_run_at` records
//     when. Periodic-review behaves identically to non-bootstrap projects from
//     this state onward.

export const DISCIPLINE_SCAN_STATES = ['pre-scan', 'running', 'complete'] as const;

export type DisciplineScanState = (typeof DISCIPLINE_SCAN_STATES)[number];

// Flat-scalar slot in `projects.settings_json` (Q1: enum + nullable timestamp).
export interface DisciplineScanSettings {
  discipline_scan_state?: DisciplineScanState;
  discipline_scan_last_run_at?: string | null;
}

// Periodic-review gating condition — the single shared check both suppression
// sites in periodic-review use. Written as "suppress when pre-scan or running"
// (not "surface only when complete") so absent state maps to complete-implicit,
// preserving non-bootstrap project behaviour exactly. See periodic-review.ts.
export function shouldSuppressDisciplineSignals(state: DisciplineScanState | undefined): boolean {
  return state === 'pre-scan' || state === 'running';
}

// Typed read over the flat JSON storage. Returns the state + timestamp pair
// extracted from an opaque `settings_json` record. Both fields are optional —
// non-bootstrap projects return `{ state: undefined, last_run_at: null }`.
export function readDisciplineScan(
  settings: Record<string, unknown> | null | undefined,
): { state: DisciplineScanState | undefined; last_run_at: string | null } {
  if (!settings || typeof settings !== 'object') return { state: undefined, last_run_at: null };
  const rawState = (settings as Record<string, unknown>).discipline_scan_state;
  const rawTs = (settings as Record<string, unknown>).discipline_scan_last_run_at;
  const state =
    typeof rawState === 'string' && (DISCIPLINE_SCAN_STATES as readonly string[]).includes(rawState)
      ? (rawState as DisciplineScanState)
      : undefined;
  const last_run_at = typeof rawTs === 'string' ? rawTs : null;
  return { state, last_run_at };
}

// Response payload from `POST /api/projects/:id/discipline-drift/rescan`
// after Phase 22. Extends the existing `DisciplineDriftResult` shape with the
// post-transition state so the frontend gets immediate visual feedback without
// a separate `GET /api/projects/:id` fetch (slice 2 consumes this).
export interface DisciplineDriftRescanResult {
  groups: Array<{
    category: string;
    signals: Array<{
      id: string;
      project_id: string;
      category: string;
      item_id: string | null;
      primary_unit_ref: string | null;
      reason: string;
      created_at: string;
    }>;
  }>;
  discipline_scan_state: DisciplineScanState;
  discipline_scan_last_run_at: string | null;
}
