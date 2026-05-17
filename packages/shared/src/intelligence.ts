// Phase 14 — RAG & intelligence layer wire types (T-D25, C-D2; SPEC §7.18, §9;
// CODE_SPEC §15).
//
// Personal RAG has three substrates (text via local embeddings, code via Semble, audit
// history via structured queries) behind one router. The router uses keyword heuristics
// with a user-overridable per-query substrate toggle; AI classification of query intent
// is deferred (T-D25, §13 adopted). Queries are project-scoped by default with an
// explicit cross-project toggle.

export type RagSubstrate = 'text' | 'code' | 'audit';

export interface RagQueryRequest {
  query: string;
  // Explicit substrate override. Omitted/null ⇒ the keyword-heuristic router picks.
  substrate?: RagSubstrate | null;
  // Default false ⇒ scoped to the active project; true broadens text/audit globally.
  cross_project?: boolean;
}

// A source the answer rests on. `ref` is the stable id (item/library entry id, audit
// row id, or `path:lineStart-lineEnd` for code) so the UI can deep-link.
export interface RagCitation {
  substrate: RagSubstrate;
  ref: string;
  label: string;
  snippet?: string;
}

export interface RagQueryResult {
  substrate: RagSubstrate;
  // 'override' ⇒ the caller pinned the substrate; 'heuristic' ⇒ the keyword router chose.
  routed_by: 'override' | 'heuristic';
  // null ⇒ no synthesis ran (no Anthropic key, or nothing retrieved) — citations still
  // returned so the surface degrades to retrieval-only (capability-gated, SPEC §15).
  answer: string | null;
  citations: RagCitation[];
  used_ai: boolean;
  cross_project: boolean;
}

export interface RagReindexResult {
  // Number of text-substrate entities (re)embedded on this call; 0 ⇒ index already fresh.
  reembedded: number;
  total: number;
  embedder: 'transformers' | 'fallback';
}

// End-of-session retro (SPEC §7.18; §13 adopted: user-initiated only). Generates a
// one-page summary from the session window, saves it as a library note, and optionally
// attaches it to discussed items / appends it to the repo's session-start.md.
export interface SessionRetroRequest {
  session_id: string;
  attach_to_items?: boolean;
  append_to_session_start?: boolean;
}

export interface SessionRetroResult {
  library_entry_id: string;
  summary: string;
  // false ⇒ no Anthropic key; a deterministic structured summary was saved instead.
  used_ai: boolean;
  attached_item_ids: string[];
  appended_to_session_start: boolean;
}

// Periodic review (T-D22). Hygiene queries run on audit/state data with NO AI; AI
// synthesis fires only when the user opens the synthesise action. Default interval 2
// weeks; configurable (project settings_json override → global setting → default).
export interface HygieneBucket {
  category: string;
  label: string;
  count: number;
  entries: Array<{ ref: string; detail: string }>;
}

export interface PeriodicReviewResult {
  interval_days: number;
  last_reviewed_at: string | null;
  due: boolean;
  buckets: HygieneBucket[];
}

export interface PeriodicReviewSynthesis {
  answer: string | null;
  used_ai: boolean;
}

// Dependency-aware sequencing / "Do next" (SPEC §7.18). Topological sort across open
// items weighted by blocker-chain depth + downstream-unblocked count; items in primary
// units with a failing methodology gate are deprioritised.
export interface DoNextItem {
  id: string;
  title: string;
  // No open blockers ⇒ actionable now.
  ready: boolean;
  blocker_chain_depth: number;
  downstream_unblocked: number;
  gate_deprioritised: boolean;
  primary_unit_refs: string[];
}

export interface DoNextResult {
  // Full open-item set in weighted topological order.
  sequence: DoNextItem[];
  // The actionable head of the sequence (ready, not gate-deprioritised), highest impact
  // first — what to do next.
  do_next: DoNextItem[];
  // "If you unblock these N, M items become unblocked."
  unblock_impact: { if_you_unblock: string[]; items_freed: number };
}

// Stakeholder view (T-D17, §13 adopted: cache invalidates on item edit). Plain-language
// AI re-render of one item; cached against the item's content fingerprint.
export interface StakeholderViewResult {
  item_id: string;
  rendered: string;
  // false ⇒ no Anthropic key; a plain structured restatement is returned instead.
  used_ai: boolean;
  // true ⇒ served from the fingerprint-keyed cache (no fresh AI call / cost).
  cached: boolean;
}
