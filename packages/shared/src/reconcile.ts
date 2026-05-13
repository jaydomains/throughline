// Phase 5 — reconcile engine (SPEC §7.7; T-D5, T-D21, T-D35).
//
// Reconcile turns a piece of free-form input (Claude Code transcript, PR description, session
// note, manual paste) into a structured diff against an existing list of items. The diff has
// six categories per T-D35; the user reviews the whole diff and applies it.
//
// Contradicted rows do NOT auto-revert state — they spawn a code-drift signal (T-D21):
// tier-2 if the item has a PR association, tier-3 otherwise. Drift surfacing UI lives in
// Phase 10; Phase 5 only writes the signal.

// Enumerated taxonomy — keep this canonical so the source values don't drift into ad-hoc
// strings before SPEC formalises them. SPEC §7.7 examples: "Claude Code transcript, PR
// description, session note"; 'manual' covers the paste-anything entry surface.
export type ReconcileSource =
  | 'claude-code-transcript'
  | 'pr-description'
  | 'session-note'
  | 'manual';

export const RECONCILE_SOURCES: readonly ReconcileSource[] = [
  'claude-code-transcript',
  'pr-description',
  'session-note',
  'manual',
] as const;

export type ReconcileCategory =
  | 'completed'
  | 'new'
  | 'edited'
  | 'blocker'
  | 'contradicted'
  | 'no_change';

export type ReconcileExtractorKind = 'anthropic' | 'heuristic';

export type ReconcileRunStatus = 'pending' | 'applied' | 'discarded';

// Discriminated row union. Every row carries a stable `row_id` so the modal can track
// selection state and the apply request can address rows by id.

export interface ReconcileRowCompleted {
  category: 'completed';
  row_id: string;
  item_id: string;
  current_status: string;
  next_status: string; // bundle-defined "done"-equivalent at extraction time
  current_title: string;
  evidence: string;
}

export interface ReconcileRowNew {
  category: 'new';
  row_id: string;
  type: string; // bundle-allowed item type
  status: string; // bundle-allowed item status
  title: string;
  description: string;
  tags: string[];
  evidence: string;
}

export interface ReconcileRowEdited {
  category: 'edited';
  row_id: string;
  item_id: string;
  current_title: string;
  current_description: string;
  next_title: string;
  next_description: string;
  evidence: string;
}

export interface ReconcileRowBlocker {
  category: 'blocker';
  row_id: string;
  item_id: string;
  current_blocker_text: string | null;
  next_blocker_text: string | null;
  evidence: string;
}

export interface ReconcileRowContradicted {
  category: 'contradicted';
  row_id: string;
  item_id: string;
  current_title: string;
  reason: string;
  evidence: string;
}

export interface ReconcileRowNoChange {
  category: 'no_change';
  row_id: string;
  item_id: string;
  current_title: string;
  evidence: string;
}

export type ReconcileRow =
  | ReconcileRowCompleted
  | ReconcileRowNew
  | ReconcileRowEdited
  | ReconcileRowBlocker
  | ReconcileRowContradicted
  | ReconcileRowNoChange;

export interface ReconcileDiff {
  source: ReconcileSource;
  extractor: ReconcileExtractorKind;
  session_id: string | null;
  rows: ReconcileRow[];
  extractor_note: string | null;
}

export interface ReconcileRun {
  id: string;
  project_id: string;
  session_id: string | null;
  source: ReconcileSource;
  status: ReconcileRunStatus;
  diff: ReconcileDiff;
  raw_text: string;
  created_at: string;
  resolved_at: string | null;
}

export interface ReconcileProposeRequest {
  text: string;
  source: ReconcileSource;
  session_id?: string | null;
}

// Per-row decisions: 'accept' applies the mutation; 'reject' skips it (and skips the drift
// signal for contradicted rows). Defaults to accept when a row id is absent from the map.
export type ReconcileRowDecision = 'accept' | 'reject';

export interface ReconcileApplyRequest {
  run_id: string;
  // Server re-validates the (possibly user-edited) diff against bundle policy before
  // mutating items, mirroring the dump-zone re-validation contract.
  diff: ReconcileDiff;
  decisions?: Record<string, ReconcileRowDecision>;
}

export interface ReconcileApplyResult {
  completed_item_ids: string[];
  new_item_ids: string[];
  edited_item_ids: string[];
  blocker_item_ids: string[];
  no_change_item_ids: string[];
  drift_signal_ids: string[]; // contradicted rows that were accepted
  rejected_row_ids: string[];
}
