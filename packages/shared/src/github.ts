// Phase 10 — GitHub integration & code-drift detection (C-D16; SPEC §7.13/7.14/7.16;
// T-D6/7/18/21/33/34). Shared contracts for PR-state surfacing, manual item-to-PR
// linking, the drift inbox (both streams), code-drift tier badges, and orphaned rules.

// PR lifecycle states Throughline tracks (SPEC §7.13 "events tracked"). `reverted` is a
// derived state: a merged PR that a later revert PR/commit undoes (drives tier-2).
export type PrState = 'open' | 'approved' | 'merged' | 'reverted' | 'closed';

export interface PrSnapshot {
  repo: string; // "owner/repo"
  pr_number: number;
  title: string;
  state: PrState;
  url: string;
  head_ref: string; // branch name
  base_ref: string;
  head_sha: string;
  base_sha: string;
  merged_at: string | null;
  // Most recent lifecycle activity timestamp GitHub reported (opened / reviewed /
  // merged), surfaced as the per-session "activity timestamp" (SPEC §7.13).
  activity_at: string;
  last_polled_at: string;
}

// Per-session / per-project PR badge payload (SPEC §7.13 surface).
export interface PrBadge {
  pr_number: number;
  repo: string;
  state: PrState;
  url: string;
  title: string;
  activity_at: string;
}

export interface ProjectPrsResult {
  // Empty when the project has no github_owner/github_repo configured or no PAT is set
  // (graceful degradation, SPEC §10).
  configured: boolean;
  prs: PrBadge[];
  // SF6-09 / T-D60 — the PR list is served from the poller's cache, so an empty `prs` on a
  // configured project is ambiguous: genuinely no PRs, or the background poller failing and
  // the cache stale/empty. Surface the github-poller's health (C-D26) on the wire so the UI
  // can tell "none tracked" apart from "polling is broken — this data may be stale".
  poll_healthy: boolean;
  // The poller's last error message when unhealthy; null when healthy or not yet run.
  poll_error: string | null;
}

// Manual item-to-PR linking (T-D34).
export interface PrLinkCandidate {
  pr_number: number;
  repo: string;
  title: string;
  url: string;
  // True when this candidate came from auto-detecting the item's / session's active git
  // branch (step 1 of T-D34); false for an explicit override pick.
  auto_detected: boolean;
}

export interface PrLinkDetectResult {
  // null when no branch resolves or the branch has no open PR — the UI then offers
  // override (paste a number) or skip (T-D34 step 3).
  candidate: PrLinkCandidate | null;
  branch: string | null;
}

export interface ItemPrAssociation {
  item_id: string;
  pr_number: number;
  repo: string;
  auto_detected_at: string | null;
}

// Code-drift tiers (T-D21; SPEC §7.14). Strong tiers (1-3) badge the item directly;
// tier-4 routes to the drift inbox instead of badging.
export type CodeDriftTier = 'tier-1' | 'tier-2' | 'tier-3' | 'tier-4';

export interface CodeDriftSignal {
  id: string;
  project_id: string;
  tier: CodeDriftTier;
  item_id: string | null;
  reason: string;
  created_at: string;
}

// Drift inbox (T-D21). One code path across both streams; the `stream` discriminator
// makes per-stream filtering trivial (C-D7 rationale, extended in C-D16).
export type DriftStream = 'code' | 'discipline';

export interface DriftInboxSignal {
  id: string;
  project_id: string;
  stream: DriftStream;
  category: string; // code: tier-1..tier-4; discipline: bundle category name
  item_id: string | null;
  reason: string;
  created_at: string;
}

export interface DriftInboxResult {
  // Inbox holds the weak signals (tier-4) plus any discipline signals; strong code tiers
  // 1-3 badge items directly and are excluded here (SPEC §7.14).
  signals: DriftInboxSignal[];
  // Header counter spans BOTH streams (C-D16 / CHECKLIST §Phase 10).
  total_count: number;
  code_count: number;
  discipline_count: number;
}

// Drift re-verify (SPEC §7.14): AI returns one of three verdicts.
export type DriftReverifyVerdict = 'still-done' | 'unclear' | 'regressed';

export interface DriftReverifyResult {
  signal_id: string;
  verdict: DriftReverifyVerdict;
  detail: string;
  // null on the heuristic fallback path (no Anthropic key) — mirrors reconcile/extractor.
  model: string | null;
}

// Confidence-thresholded auto-reconcile on PR merge (T-D6/T-D18). Logged to the audit
// log from day 1 to support §13 threshold calibration.
export type AutoReconcileConfidence = 'high' | 'medium' | 'low';

export interface AutoReconcileOutcome {
  pr_number: number;
  repo: string;
  confidence: AutoReconcileConfidence;
  // 'auto-applied' (high) | 'pending-approval' (medium) | 'modal' (low).
  disposition: 'auto-applied' | 'pending-approval' | 'modal';
  reconcile_run_id: string;
  // Present only for high-confidence auto-apply (T-D6 24h undo window).
  undo_token?: string;
  undo_expires_at?: string;
}

// Orphaned verifier rules (T-D33). Surfaces in the settings panel and (Phase 14)
// periodic-review hygiene list.
export interface OrphanedRule {
  id: string;
  project_id: string;
  rule_path: string;
  original_item_id: string;
  created_at: string;
  dismissed_at: string | null;
}

export interface OrphanedRulesResult {
  rules: OrphanedRule[];
}

export interface OrphanCleanupDraftResult {
  // The constructed cleanup PR's URL (user reviews + merges; rule clears on next poll).
  pr_url: string;
  pr_number: number;
}

// Recommended Semgrep GitHub Actions workflow presence check (SPEC §7.16). Fires once
// at first GitHub-integration use if the expected workflow file is absent.
export interface WorkflowTemplateWarning {
  present: boolean;
  expected_path: string;
}
