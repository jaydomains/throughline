// Phase 9 — discipline-drift engine (C-D7, T-D21, T-D42, SPEC §7.14).
// Discipline-drift signals share the `drift_signals` table with code-drift, distinguished
// by `stream='discipline'`. Categories are bundle-declared (validation-rules section);
// freeform declares none, so the stream is a verified no-op there.

export interface DisciplineDriftSignal {
  id: string;
  project_id: string;
  category: string;
  // Scoped to the citing item / its primary units when the finding resolves through a
  // bundle linkage (cross_reference → item_anchor_citations). Project-wide otherwise.
  item_id: string | null;
  primary_unit_ref: string | null;
  reason: string;
  created_at: string;
}

// One category's worth of open (non-dismissed) signals.
export interface DisciplineDriftCategoryGroup {
  category: string;
  signals: DisciplineDriftSignal[];
}

export interface DisciplineDriftResult {
  // Empty for freeform-bound projects (zero declared categories) — the section stays hidden.
  groups: DisciplineDriftCategoryGroup[];
}
