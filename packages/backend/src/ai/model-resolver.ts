// Phase 16 (DoD) — per-feature model-override consumption.
//
// SPEC §9 / CODE_SPEC §14 define a per-feature default model; §7.25 / CODE_SPEC §19
// expose a global "default model" selector plus per-feature overrides in the settings
// panel. Phases 4–15 wired the panel (keys persist) but every AI callsite still used
// its hardcoded §14 default. This module is the single resolution point those callsites
// now route through, so a settings change takes effect without a backend restart
// (the resolver reads settings per call).
//
// Precedence (Phase-16 decision; recorded as a Drift Flag — §19-vs-§14 is an
// implementation-shape choice, not a SPEC change):
//   1. `model_override_<feature>` set            → that model.
//   2. else, if the feature's §14 default is the Sonnet tier, the global
//      `default_model` selector applies (it can push Sonnet-tier features up to
//      Opus or down to Haiku).
//   3. else (features Haiku-by-design for cost — dedup, tag_suggestion,
//      session_start) stay pinned to their §14 default; the global selector does
//      not silently make a cost-conscious feature more expensive.

export type ModelAlias = 'haiku' | 'sonnet' | 'opus';

const ALIAS_TO_ID: Record<ModelAlias, string> = {
  haiku: 'claude-haiku-4-5',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-7',
};

const SONNET_TIER = ALIAS_TO_ID.sonnet;

export type SettingsGet = (key: string) => unknown;
export type ModelResolver = (feature: string, codeSpecDefault: string) => string;

function aliasToId(value: unknown): string | null {
  return typeof value === 'string' && value in ALIAS_TO_ID
    ? ALIAS_TO_ID[value as ModelAlias]
    : null;
}

export function createModelResolver(get: SettingsGet): ModelResolver {
  return (feature, codeSpecDefault) => {
    const override = aliasToId(get(`model_override_${feature}`));
    if (override) return override;
    if (codeSpecDefault === SONNET_TIER) {
      const globalDefault = aliasToId(get('default_model'));
      if (globalDefault) return globalDefault;
    }
    return codeSpecDefault;
  };
}
