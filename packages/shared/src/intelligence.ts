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
