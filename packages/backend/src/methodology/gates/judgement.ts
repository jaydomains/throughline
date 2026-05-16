import type { GateFindings, GateFiringStatus } from '@throughline/shared';
import type { AnthropicClient } from '../../ai/anthropic.js';

// C-D6 — judgement gates call Anthropic with the gate's spec-declared intent plus the
// project's current state. Model selection mirrors the existing AI factories
// (dump-zone extractor, reconcile engine, md-ingest summariser): a hardcoded default
// parameter, no settings/env read, swappable per call site.

export interface JudgementContext {
  gateId: string;
  description: string;
  projectName: string;
  // Compact project-state digest the runtime assembles (open items, cited anchors, …).
  stateDigest: string;
}

export interface JudgementResult {
  status: GateFiringStatus;
  findings: GateFindings;
  telemetry: { model: string | null; input_tokens: number; output_tokens: number; prompt: string | null };
}

export interface JudgementGate {
  evaluate(ctx: JudgementContext): Promise<JudgementResult>;
}

export interface AnthropicJudgementOptions {
  client: AnthropicClient;
  model?: string;
}

const SYSTEM =
  'You are a methodology gate. Given a gate intent and a project-state digest, decide ' +
  'whether the project currently satisfies the gate. Reply with a single JSON object: ' +
  '{"status":"pass"|"fail","summary":string,"items":[{"message":string}]}. Do not block; ' +
  'this is advisory.';

export function createAnthropicJudgementGate({
  client,
  model = 'claude-sonnet-4-6',
}: AnthropicJudgementOptions): JudgementGate {
  return {
    async evaluate(ctx) {
      if (!client.available()) {
        return {
          status: 'skipped',
          findings: {
            check: 'judgement',
            summary: 'Anthropic not configured; judgement skipped',
            items: [],
          },
          telemetry: { model: null, input_tokens: 0, output_tokens: 0, prompt: null },
        };
      }
      const prompt =
        `Gate: ${ctx.gateId}\nIntent: ${ctx.description}\n` +
        `Project: ${ctx.projectName}\n\nProject state:\n${ctx.stateDigest}`;
      try {
        const res = await client.call({
          model,
          system: SYSTEM,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 700,
        });
        let status: GateFiringStatus = 'error';
        let summary = 'unparseable judgement response';
        let items: GateFindings['items'] = [];
        try {
          const parsed = JSON.parse(res.text) as {
            status?: string;
            summary?: string;
            items?: Array<{ message?: string }>;
          };
          if (parsed.status === 'pass' || parsed.status === 'fail') status = parsed.status;
          summary = parsed.summary ?? summary;
          items = (parsed.items ?? [])
            .map((i) => ({ message: String(i.message ?? '') }))
            .filter((i) => i.message.length > 0);
        } catch {
          /* leave status='error' — never blocks (T-D44) */
        }
        return {
          status,
          findings: { check: 'judgement', summary, items },
          telemetry: {
            model,
            input_tokens: res.input_tokens,
            output_tokens: res.output_tokens,
            prompt,
          },
        };
      } catch (e) {
        return {
          status: 'error',
          findings: {
            check: 'judgement',
            summary: `judgement call failed: ${e instanceof Error ? e.message : String(e)}`,
            items: [],
          },
          telemetry: { model, input_tokens: 0, output_tokens: 0, prompt: null },
        };
      }
    },
  };
}
