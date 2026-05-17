import type { AnthropicClient } from '../../ai/anthropic.js';

// C-D8 / T-D45 — a judgement step can be made by the user directly, or handed to
// AI-via-Anthropic (default Sonnet per SPEC §9). The AI path returns a *proposed*
// structured judgement that the user reviews before committing (C-D8 path b); it never
// auto-resolves the step. Model selection mirrors the gate-judgement factory: a hardcoded
// default parameter, swappable per call site, no settings/env read.

export interface CompanionJudgeContext {
  checklistId: string;
  stepId: string;
  description: string;
  projectName: string;
  // Compact project-state digest the engine assembles.
  stateDigest: string;
}

export interface CompanionJudgeResult {
  decision: 'pass' | 'fail';
  rationale: string;
  telemetry: {
    model: string | null;
    input_tokens: number;
    output_tokens: number;
    prompt: string | null;
  };
}

export interface CompanionJudge {
  available(): boolean;
  judge(ctx: CompanionJudgeContext): Promise<CompanionJudgeResult>;
}

export interface AnthropicCompanionJudgeOptions {
  client: AnthropicClient;
  model?: string;
  resolveModel?: () => string;
}

const SYSTEM =
  'You are a methodology review companion. Given a checklist step intent and a ' +
  'project-state digest, decide whether the step passes. Reply with a single JSON ' +
  'object: {"decision":"pass"|"fail","rationale":string}. This is advisory; a human ' +
  'reviews your judgement before it is committed.';

export function createAnthropicCompanionJudge({
  client,
  model: defaultModel = 'claude-sonnet-4-6',
  resolveModel,
}: AnthropicCompanionJudgeOptions): CompanionJudge {
  return {
    available: () => client.available(),
    async judge(ctx) {
      const model = resolveModel ? resolveModel() : defaultModel;
      const prompt =
        `Checklist: ${ctx.checklistId}\nStep: ${ctx.stepId}\n` +
        `Intent: ${ctx.description}\nProject: ${ctx.projectName}\n\n` +
        `Project state:\n${ctx.stateDigest}`;
      if (!client.available()) {
        return {
          decision: 'fail',
          rationale: 'Anthropic not configured; AI judgement unavailable.',
          telemetry: { model: null, input_tokens: 0, output_tokens: 0, prompt: null },
        };
      }
      try {
        const res = await client.call({
          model,
          system: SYSTEM,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 600,
        });
        let decision: 'pass' | 'fail' = 'fail';
        let rationale = 'Unparseable AI judgement response.';
        try {
          const parsed = JSON.parse(res.text) as {
            decision?: string;
            rationale?: string;
          };
          if (parsed.decision === 'pass' || parsed.decision === 'fail') {
            decision = parsed.decision;
          }
          if (typeof parsed.rationale === 'string' && parsed.rationale.length > 0) {
            rationale = parsed.rationale;
          }
        } catch {
          /* leave decision='fail' with the unparseable rationale; user reviews it */
        }
        return {
          decision,
          rationale,
          telemetry: {
            model,
            input_tokens: res.input_tokens,
            output_tokens: res.output_tokens,
            prompt,
          },
        };
      } catch (e) {
        return {
          decision: 'fail',
          rationale: `AI judgement call failed: ${e instanceof Error ? e.message : String(e)}`,
          telemetry: { model, input_tokens: 0, output_tokens: 0, prompt: null },
        };
      }
    },
  };
}
