// Items per SPEC §7.4 and T-D1 / T-D8 / T-D38.
// Type and status come from the project's bundle (freeform: type='task', statuses=['open','done']).

// Methodology-context references (SPEC §7.4, T-D39). Bundle-defined identifiers; empty for
// bundles that declare no primary unit / anchors / markers (freeform).
export interface MethodologyContext {
  primary_unit_refs: string[];
  phase_refs: string[];
  anchor_citations: string[];
  marker_refs: string[];
}

export interface Item {
  id: string;
  project_id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  blocker_text: string | null;
  parent_id: string | null;
  branch_ref: string | null;
  tags: string[];
  blockers: string[]; // structured blocker references — item ids that block this one (T-D8)
  session_ids: string[];
  methodology_context: MethodologyContext;
  created_at: string;
  updated_at: string;
}

export interface CreateItemInput {
  project_id: string;
  type?: string; // defaults to the bundle's first declared type
  title: string;
  description?: string;
  status?: string; // defaults to the type's first declared status
  blocker_text?: string;
  parent_id?: string | null;
  branch_ref?: string | null;
  tags?: string[];
  session_ids?: string[];
  methodology_context?: Partial<MethodologyContext>;
}

export interface UpdateItemInput {
  type?: string;
  title?: string;
  description?: string;
  status?: string;
  blocker_text?: string | null;
  parent_id?: string | null;
  branch_ref?: string | null;
  methodology_context?: Partial<MethodologyContext>;
}

export interface Board {
  id: string;
  label: string;
  type: string;
  // Board-scoped status lifecycle — the columns this board renders, in order (C-D12).
  statuses: string[];
}

// Modules view (SPEC §7.11, C-D13). A "module" is the SiteMesh name for the bundle's
// primary unit; the runtime groups items by their primary-unit refs and reports per-unit
// counts, phase indicators, and a bundle-rule tier classification.
export interface ModuleSummary {
  ref: string;
  item_count: number;
  phases: string[];
  anchor_count: number;
  marker_count: number;
  tier: string;
}

export interface ModulesResult {
  // null when the project's bundle declares no primary unit (freeform) — view is hidden.
  primary_unit_label: string | null;
  modules: ModuleSummary[];
}

export interface ItemPolicy {
  bundle_id: string;
  types: string[];
  // Union of every type's statuses, in declaration order, de-duplicated. Kept for generic
  // consumers (reconcile, dump-zone, tree-by-status) that are not item-type aware.
  statuses: string[];
  // Per-type status lifecycle (C-D12). Validation and board columns use this.
  statuses_by_type: Record<string, string[]>;
  boards: Board[];
}
