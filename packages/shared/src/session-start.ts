// Phase 13 — session-start scaffolding wire types (C-D9; cites T-D12, T-D45 kin;
// SPEC §7.18, §9; CODE_SPEC §11).
//
// The pipeline resolves a companion mode (bundle-declared enum + default; the modes ↔
// review-patterns relationship is the explicit Phase-13 spec gap — proceeded per ROADMAP,
// surfaced in the handover, not silently resolved), gathers project-state context,
// classifies decision/anchor relevance via Anthropic Haiku, renders the bundle's
// per-mode template, and returns a copy-pasteable prompt string.

// A companion mode the active bundle declares. Freeform/none bundles expose a single
// synthetic `default` mode so the surface is uniform.
export interface SessionStartMode {
  id: string;
  name: string;
}

export interface SessionStartModesResult {
  modes: SessionStartMode[];
  // The mode used when the caller supplies none — the bundle's first-declared mode, or
  // `default` for a freeform/none bundle.
  default_mode: string;
}

export interface GenerateSessionStartRequest {
  // Omitted ⇒ the bundle's first-declared mode (or `default` for freeform).
  companion_mode?: string | null;
}

export type RelevanceTier = 'high' | 'medium' | 'low';

// Per-decision/anchor relevance the classifier assigned. `high` ⇒ full text rendered,
// `medium` ⇒ citation only, `low` ⇒ dropped. Surfaced so the UI can show what the
// assembly kept vs. dropped without re-running the classifier.
export interface RelevanceClassification {
  ref: string;
  tier: RelevanceTier;
}

export interface SessionStartPromptResult {
  mode: string;
  modes: SessionStartMode[];
  prompt: string;
  classifications: RelevanceClassification[];
  // True when this prompt was served from the last assembly's audit-row cache without a
  // fresh Haiku call — the assembled-context input fingerprint was unchanged (C-D9
  // "re-render-without-AI"). False ⇒ a fresh classification ran.
  cached: boolean;
  // Whether the relevance classifier ran against a configured Anthropic key. False ⇒ the
  // capability-gated degrade path (every ref treated as `medium`); no AI cost recorded.
  classifier_used_ai: boolean;
}
