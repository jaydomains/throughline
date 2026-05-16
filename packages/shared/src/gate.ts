// Phase 8 — methodology gate runtime (C-D6, T-D42, T-D44, T-D36).
// A gate firing is one independent gate run at one phase moment. Failures surface as
// proposals, never repo blocks (T-D44).

import type { PhaseMoment } from './bundle.js';

export type GateFiringStatus = 'pass' | 'fail' | 'skipped' | 'error';

export interface GateFinding {
  message: string;
  // Optional location hint (file path / item id / anchor id) for the UI to deep-link.
  ref?: string;
}

export interface GateFindings {
  // The built-in check kind the GateSpec dispatched to (C-D15), or 'judgement'.
  check: string;
  summary: string;
  items: GateFinding[];
  // Populated only when an override was recorded against this firing (T-D44).
  override?: {
    reason: string;
    original_findings_ref: string;
    at: string;
  };
}

export interface GateFiring {
  id: string;
  project_id: string;
  moment: PhaseMoment;
  gate_id: string;
  status: GateFiringStatus;
  findings: GateFindings;
  created_at: string;
}

// One moment's worth of gate firings (latest firing per gate).
export interface GateMomentGroup {
  moment: PhaseMoment;
  firings: GateFiring[];
}

export interface GateFiringsResult {
  // Empty for freeform-bound projects (no declared gates) — the view stays hidden.
  groups: GateMomentGroup[];
}

export interface GateOverrideInput {
  reason: string;
}

export interface GateRunResult {
  firings: GateFiring[];
}
