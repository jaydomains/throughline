import type { RelevanceTier } from '@throughline/shared';
import type { AnthropicClient } from '../../ai/anthropic.js';

// C-D9 step 3 — relevance classification. Anthropic Haiku (SPEC §9: "Session-start prompt
// assembly: Haiku") scores each candidate decision/anchor for the slice; the engine renders
// `high` in full, `medium` as a citation, and drops `low`. Capability-gated exactly like
// the companion judge (companion/judgement.ts): no configured key ⇒ every ref degrades to
// `medium` (citation-only), no network call, no AI cost. Model is a hardcoded default
// parameter, swappable per call site, no settings/env read.

export interface RelevanceCandidate {
  // Stable identifier echoed back in the result (decision item id, or anchor id).
  ref: string;
  // The text the classifier judges (decision title+body, or anchor id + cited context).
  text: string;
}

export interface RelevanceResult {
  tiers: Record<string, RelevanceTier>;
  telemetry: {
    model: string | null;
    input_tokens: number;
    output_tokens: number;
    prompt: string | null;
  };
}

export interface RelevanceClassifier {
  available(): boolean;
  classify(slice: string, candidates: RelevanceCandidate[]): Promise<RelevanceResult>;
}

export interface AnthropicRelevanceClassifierOptions {
  client: AnthropicClient;
  model?: string;
  resolveModel?: () => string;
}

const SYSTEM =
  'You score how relevant each candidate decision/anchor is to an upcoming work slice. ' +
  'Reply with a single JSON object mapping each candidate ref to one of "high", ' +
  '"medium", or "low". high = directly governs the slice; medium = related context; ' +
  'low = unrelated. Output only the JSON object.';

function allMedium(candidates: RelevanceCandidate[]): Record<string, RelevanceTier> {
  const tiers: Record<string, RelevanceTier> = {};
  for (const c of candidates) tiers[c.ref] = 'medium';
  return tiers;
}

export function createAnthropicRelevanceClassifier({
  client,
  model: defaultModel = 'claude-haiku-4-5',
  resolveModel,
}: AnthropicRelevanceClassifierOptions): RelevanceClassifier {
  return {
    available: () => client.available(),
    async classify(slice, candidates) {
      // Nothing to classify, or no key ⇒ degrade to citation-only (medium) with no call.
      if (candidates.length === 0 || !client.available()) {
        return {
          tiers: allMedium(candidates),
          telemetry: { model: null, input_tokens: 0, output_tokens: 0, prompt: null },
        };
      }
      const model = resolveModel ? resolveModel() : defaultModel;
      const prompt =
        `Slice context:\n${slice}\n\nCandidates:\n` +
        candidates.map((c) => `[${c.ref}] ${c.text}`).join('\n');
      try {
        const res = await client.call({
          model,
          system: SYSTEM,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 800,
        });
        const tiers = allMedium(candidates);
        try {
          const parsed = JSON.parse(res.text) as Record<string, unknown>;
          for (const c of candidates) {
            const v = parsed[c.ref];
            if (v === 'high' || v === 'medium' || v === 'low') tiers[c.ref] = v;
          }
        } catch {
          /* unparseable ⇒ keep the safe all-medium default; the prompt still renders */
        }
        return {
          tiers,
          telemetry: {
            model,
            input_tokens: res.input_tokens,
            output_tokens: res.output_tokens,
            prompt,
          },
        };
      } catch {
        // A failed call must not fail prompt assembly — degrade, no cost.
        return {
          tiers: allMedium(candidates),
          telemetry: { model: null, input_tokens: 0, output_tokens: 0, prompt: null },
        };
      }
    },
  };
}
