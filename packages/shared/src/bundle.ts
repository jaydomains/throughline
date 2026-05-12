// Typed output of the bundle parser (C-D4). One field per H2 section in the canonical order.
// Bundle authors who declare a section "none" produce an empty/None-shaped value here, not a
// missing field — see methodologies/freeform/bundle.md for the reference.

export type BundleSectionStatus = 'declared' | 'none';

export interface BundleIdentity {
  name: string;
  version: string;
  authority_precedence: string[];
}

export interface PrimaryUnitSpec {
  name: string;
  tier_rules: string;
  doc_set: string[];
  templates_by_doc_type: Record<string, string>;
}

export interface ProjectLayout {
  primary_unit: PrimaryUnitSpec | null;
  runtime_artefact_dirs: string[];
}

export interface AnchorSystem {
  status: BundleSectionStatus;
  format_regex?: string;
  namespace?: string;
  body_sections?: string[];
  status_vocabulary?: string[];
  heading_tags?: string[];
  state_transitions?: string[];
  banned_content_in_bodies?: string[];
}

export interface MarkerSystem {
  status: BundleSectionStatus;
  formats?: string[];
  categories?: string[];
  gating_behaviour_by_category?: Record<string, string>;
}

export interface GateSpec {
  id: string;
  kind: 'mechanical' | 'judgement';
  description: string;
}

export type PhaseMoment = 'pre-write' | 'per-commit' | 'plan-mode' | 'post-commit' | 'pr-open';

export interface StateMachine {
  status: BundleSectionStatus;
  phases: string[];
  transitions: Array<{ from: string; to: string }>;
  gates_by_moment: Partial<Record<PhaseMoment, GateSpec[]>>;
}

export interface CommunicationModel {
  status: BundleSectionStatus;
  edge_types?: string[];
  routing_rules?: string[];
  producer_ownership_rules?: string[];
}

export interface GatingModel {
  status: BundleSectionStatus;
  tier_rules?: string[];
  feature_rules?: string[];
  permission_rules?: string[];
}

export interface ChecklistSpec {
  id: string;
  name: string;
  steps: Array<{ id: string; kind: 'mechanical' | 'judgement'; description: string }>;
}

export interface CompanionMode {
  id: string;
  name: string;
  description: string;
}

export interface ReviewPatterns {
  status: BundleSectionStatus;
  checklists: ChecklistSpec[];
  companion_modes: CompanionMode[];
}

export interface Templates {
  status: BundleSectionStatus;
  handover?: string;
  decision?: string;
  research_artefact?: string;
  execution_plan?: string;
  fixed_doc_outlines?: Record<string, string>;
  session_start_by_mode?: Record<string, string>;
}

export interface DisciplineDriftCategory {
  name: string;
  trigger: 'file-change' | 'pre-write' | 'manual';
  check_kind: 'banned_string' | 'structural' | 'cross_reference' | 'regex';
  details: string;
}

export interface ValidationRules {
  status: BundleSectionStatus;
  banned_string_sweeps: string[];
  implementation_discipline_rules: string[];
  cross_reference_resolution_rules: string[];
  structural_validation_rules: string[];
  discipline_drift_categories: DisciplineDriftCategory[];
}

export interface AuthorityHierarchy {
  source_ranking: string[];
  drift_policy: string;
}

export interface LoadedBundle {
  bundle_id: string; // directory name under methodologies/
  identity: BundleIdentity;
  project_layout: ProjectLayout;
  anchor_system: AnchorSystem;
  marker_system: MarkerSystem;
  state_machine: StateMachine;
  communication_model: CommunicationModel;
  gating_model: GatingModel;
  review_patterns: ReviewPatterns;
  templates: Templates;
  validation_rules: ValidationRules;
  authority_hierarchy: AuthorityHierarchy;
}

export interface BundleStructuralError {
  bundle_id: string;
  section?: string;
  message: string;
}

export type BundleLoadResult =
  | { status: 'loaded'; bundle: LoadedBundle }
  | { status: 'error'; bundle_id: string; errors: BundleStructuralError[] };
