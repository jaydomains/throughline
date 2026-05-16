// Phase 11 — Semble code-intelligence integration (SPEC §7.15; T-D27, T-D13; CODE_SPEC C-D17).
// Per-query execFile invocation, keyless, capability-gated. These shapes cross the wire
// between the backend Semble client/service and the frontend code-link, code-Q&A, and
// dump-zone-enrichment surfaces.

// One hit returned by a Semble code search. line_start/line_end bound the matched chunk;
// score is Semble's own relevance number when it emits one (null tolerated).
export interface SembleHit {
  path: string;
  line_start: number;
  line_end: number;
  snippet: string;
  score: number | null;
}

// A done-time / enrichment link candidate (a hit not yet confirmed onto an item).
export interface CodeSearchCandidate {
  path: string;
  line_start: number;
  line_end: number;
  snippet: string;
  score: number | null;
}

// A confirmed code reference stored on an item (item_code_refs row).
export interface ItemCodeRef {
  id: string;
  item_id: string;
  path: string;
  line_start: number;
  line_end: number;
  summary: string | null;
}

export interface CodeSearchResponse {
  // null when Semble is not configured/available (graceful degradation, SPEC §15).
  candidates: CodeSearchCandidate[];
  available: boolean;
}

export interface ConfirmCodeRefsRequest {
  refs: Array<{
    path: string;
    line_start: number;
    line_end: number;
    summary?: string | null;
  }>;
}

export interface CodeQaSource {
  path: string;
  line_start: number;
  line_end: number;
  snippet: string;
}

export interface CodeQaResult {
  // Plain-English answer. null when no Anthropic key (hits still returned as sources).
  answer: string | null;
  sources: CodeQaSource[];
  // false ⇒ Semble not configured; the surface shows the disabled state (SPEC §15).
  semble_available: boolean;
  // false ⇒ no Anthropic key; sources returned without a synthesised answer.
  summarised: boolean;
}
