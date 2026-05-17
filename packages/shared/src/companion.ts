// Phase 12 — Companion review runtime (C-D8, T-D45, T-D10; SPEC §7.18/§9).
// The methodology bundle's review-patterns section declares one or more checklists, each
// with mechanical (Throughline executes) and judgement (human or AI-via-Anthropic call)
// steps. A ChecklistRun instantiates a ChecklistSpec; steps drive a small state machine
// and every transition is audit-logged. These shapes cross the wire between the backend
// companion engine and the methodology-gates UI surface.

export type ChecklistRunState = 'running' | 'completed';

export type ChecklistStepState =
  | 'pending'
  | 'in-progress'
  | 'passed'
  | 'failed'
  | 'skipped';

export type ChecklistStepKind = 'mechanical' | 'judgement';

// One finding line for a resolved step (mechanical check output or judgement rationale).
export interface ChecklistFinding {
  message: string;
  ref?: string;
}

export interface ChecklistStepFindings {
  // Built-in mechanical check kind (C-D15), 'judgement', or '' while pending.
  check: string;
  summary: string;
  items: ChecklistFinding[];
  // The most recent AI judgement proposal for a judgement step. Advisory only — the
  // user reviews and commits it via resolve-judgement (C-D8 path b); it does not
  // auto-resolve the step.
  ai_proposal?: {
    decision: 'pass' | 'fail';
    rationale: string;
    model: string;
    at: string;
  };
  // Populated only when a failed mechanical step was overridden (T-D44 kin).
  override?: {
    reason: string;
    at: string;
  };
}

// kind, description and ordinal are re-derived from the bundle's ChecklistSpec at load
// time (the bundle is the source of truth) — the persisted step row stays minimal per
// CODE_SPEC §3 schema sketch (run_id, step_id, state, findings_json, transitioned_at).
export interface ChecklistRunStep {
  run_id: string;
  step_id: string;
  kind: ChecklistStepKind;
  description: string;
  ordinal: number;
  state: ChecklistStepState;
  findings: ChecklistStepFindings;
  transitioned_at: string;
}

export interface ChecklistRun {
  id: string;
  project_id: string;
  checklist_id: string;
  companion_mode: string | null;
  state: ChecklistRunState;
  summary_entry_id: string | null;
  started_at: string;
  completed_at: string | null;
  steps: ChecklistRunStep[];
}

// companion_mode and summary_entry_id are not persisted columns (CODE_SPEC §3 schema sketch keeps the
// checklist tables minimal); they are recovered from the run's audit trail, which is the
// canonical companion-review record (T-D45 — output is queryable via the audit substrate).

// A checklist the active bundle declares, offered for a new run. companion_modes is the
// bundle's declared mode list (checklist + mode is a parameter pair at run-start; the
// modes ↔ review-patterns relationship is a Phase-13 spec gap, deferred per ROADMAP).
export interface AvailableChecklist {
  id: string;
  name: string;
  steps: Array<{ id: string; kind: ChecklistStepKind; description: string }>;
}

export interface CompanionChecklistsResult {
  checklists: AvailableChecklist[];
  companion_modes: Array<{ id: string; name: string }>;
}

export interface StartChecklistRunRequest {
  checklist_id: string;
  companion_mode?: string | null;
}

export interface ResolveJudgementStepRequest {
  decision: 'pass' | 'fail' | 'skip';
  rationale: string;
}

export interface OverrideStepRequest {
  reason: string;
}

export interface CompleteRunRequest {
  // When provided, a markdown library note (T-D10) is created and attached to item_ids.
  summary?: string;
  item_ids?: string[];
}
