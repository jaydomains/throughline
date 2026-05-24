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
  // T-D49 — architectural-tier vocabulary referenced by the communication model's
  // `when:` clauses and `### Tier routing:` sub-sections. Distinct from a primary
  // unit's item-count `tier_rules` (C-D13). Empty for bundles that declare no
  // tiers (freeform).
  tiers: string[];
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

// C-D12 — a bundle's State machine section may declare one or more item types, each with its
// own board label and status lifecycle. Bundles that declare none (freeform) leave this empty
// and the runtime infers a single board (see backend items/policy.ts).
export interface ItemTypeSpec {
  id: string;
  board_label: string;
  statuses: string[];
  transitions: Array<{ from: string; to: string }>;
}

export interface StateMachine {
  status: BundleSectionStatus;
  phases: string[];
  transitions: Array<{ from: string; to: string }>;
  gates_by_moment: Partial<Record<PhaseMoment, GateSpec[]>>;
  item_types: ItemTypeSpec[];
}

// T-D49 — §6 Communication model grammar.
//
// Bundles declare edge TYPES (rules) — concrete edge INSTANCES are derived from
// the project's modules + items, not the bundle. An edge type has a tier-pair
// `when` clause and a `direct` / `via <module-id>` mechanism. `contract_source`
// declares THAT this edge type has a contract source; per-project settings
// declare WHERE the contract files live (C-D14 split). `invariant: violation`
// flags an edge type whose instantiation is an architectural violation —
// parsed-and-carried in Phase 18; enforcement is a later phase (T-D50).
export type TierPair = { kind: 'any' } | { kind: 'pair'; a: string; b: string };

export type Mechanism = { kind: 'direct' } | { kind: 'via'; module_id: string };

export interface CommunicationEdgeType {
  name: string;
  when: TierPair;
  mechanism: Mechanism;
  contract_source: string | null;
  invariant: 'violation' | null;
}

// Tier-level routing override: any module of `tier` routes via the declared
// mechanism, applied after edge-type `when:` expansion. Lets a methodology say
// e.g. "this tier always routes directly, regardless of partner tier."
export interface TierRoutingRule {
  tier: string;
  mechanism: Mechanism;
  note: string | null;
}

export interface ProducerOwnership {
  rule: 'producer-owns-shape';
  notes: string | null;
}

export interface CommunicationModel {
  status: BundleSectionStatus;
  edge_types: CommunicationEdgeType[];
  tier_routing: TierRoutingRule[];
  producer_ownership: ProducerOwnership | null;
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
