// Model price table in USD per million tokens. Sourced from public Anthropic pricing.
// Values are deliberately approximate — cost telemetry is a budgeting aid, not an invoice.
// Phase 14 may revisit this table; the cost meter (Phase 15) reads from cost_telemetry rows.

interface ModelPrice {
  input_per_million: number;
  output_per_million: number;
}

const PRICES: Record<string, ModelPrice> = {
  'claude-sonnet-4-6': { input_per_million: 3, output_per_million: 15 },
  'claude-haiku-4-5': { input_per_million: 0.8, output_per_million: 4 },
  'claude-opus-4-7': { input_per_million: 15, output_per_million: 75 },
};

const FALLBACK: ModelPrice = { input_per_million: 3, output_per_million: 15 };

export function usdEstimate(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES[model] ?? FALLBACK;
  return (inputTokens * p.input_per_million + outputTokens * p.output_per_million) / 1_000_000;
}
