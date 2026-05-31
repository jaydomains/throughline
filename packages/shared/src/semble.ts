// Phase 11 — Semble code-intelligence integration (SPEC §7.15; T-D27, T-D13; CODE_SPEC C-D17).
// Per-query execFile invocation, keyless, capability-gated. These shapes cross the wire
// between the backend Semble client/service and the frontend code-link, code-Q&A, and
// dump-zone-enrichment surfaces.

// Capability state of the Semble code-intelligence backend, disclosed on the wire per
// T-D60 (refuse-rather-than-fallback). The distinction the bare booleans could not express:
//   'available'   — the binary resolves and runs; results are authoritative.
//   'unavailable' — not configured (the command does not resolve); the surface is inert.
//   'degraded'    — installed but not responding (crash, timeout, abnormal exit during
//                   the probe or the search itself). A degraded search is NEVER rendered
//                   as a healthy 'available' search that happened to find nothing.
export type SembleStatus = 'available' | 'unavailable' | 'degraded';

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
  candidates: CodeSearchCandidate[];
  // The disclosed capability state (T-D60). `available` is retained as the
  // healthy-only convenience flag and is true iff `status === 'available'`; clients
  // distinguish a 'degraded' crash from an 'unavailable' absence via `status`.
  status: SembleStatus;
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
  // The disclosed Semble capability state (T-D60). `semble_available` is the
  // healthy-only convenience flag (true iff `status === 'available'`); a 'degraded'
  // crash is distinguished from an 'unavailable' absence via `status`.
  status: SembleStatus;
  semble_available: boolean;
  // false ⇒ no Anthropic key; sources returned without a synthesised answer.
  summarised: boolean;
}
