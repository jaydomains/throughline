// Cost meter (T-D29, CODE_SPEC §11/§14). Aggregates cost_telemetry rows. The header
// pill is visible at all times; the settings panel surfaces the same numbers plus the
// configurable daily threshold (default: no threshold — ROADMAP §13, CODE_SPEC Q#9).

export type CostScope = 'project' | 'global';

export interface CostFeatureBreakdown {
  feature: string;
  input_tokens: number;
  output_tokens: number;
  usd_estimate: number;
  call_count: number;
}

export interface CostWindow {
  usd_estimate: number;
  input_tokens: number;
  output_tokens: number;
  call_count: number;
  by_feature: CostFeatureBreakdown[];
}

export interface CostSummary {
  scope: CostScope;
  // null when scope is 'global' (cross-project rollup).
  project_id: string | null;
  day: CostWindow;
  week: CostWindow;
  month: CostWindow;
  // Configured daily ceiling in USD, or null when no threshold is set (the default).
  daily_threshold_usd: number | null;
  // True only when a threshold is set and today's spend exceeds it.
  daily_threshold_exceeded: boolean;
}
