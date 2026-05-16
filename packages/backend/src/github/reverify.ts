import type { DriftReverifyResult, DriftReverifyVerdict } from '@throughline/shared';
import type { AnthropicClient } from '../ai/anthropic.js';
import { appendAudit } from '../audit/log.js';
import { promptFingerprint } from '../ai/fingerprint.js';
import { usdEstimate } from '../ai/pricing.js';
import { recordCost } from '../cost/telemetry.js';
import type { DB } from '../db/index.js';

// Phase 10 (SPEC §7.14 "Drift re-verify") — every drift signal carries a manual
// re-verify-via-AI action; the AI returns one of three verdicts. Anthropic-backed when a
// key is configured (model claude-sonnet-4-6 per CODE_SPEC §14), heuristic 'unclear'
// fallback otherwise (degrade-gracefully, SPEC §10) — same routing idiom as reconcile.

const MODEL = 'claude-sonnet-4-6';

const SYSTEM = `You re-verify whether a previously-"done" software task still looks done.
You are given the item (title + description) and the drift signal that flagged it.
Reply with STRICT JSON only: {"verdict":"still-done"|"unclear"|"regressed","detail":"<one sentence>"}.
"still-done" = the signal looks like noise / the work still holds.
"regressed" = the signal credibly indicates the work broke or was undone.
"unclear" = not enough information to decide.`;

function parseVerdict(text: string): { verdict: DriftReverifyVerdict; detail: string } | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  try {
    const j = JSON.parse(cleaned) as { verdict?: string; detail?: string };
    if (j.verdict === 'still-done' || j.verdict === 'unclear' || j.verdict === 'regressed') {
      return { verdict: j.verdict, detail: typeof j.detail === 'string' ? j.detail : '' };
    }
  } catch {
    /* fall through */
  }
  return null;
}

export interface DriftReverifyService {
  reverify(projectId: string, signalId: string): Promise<DriftReverifyResult>;
}

export class SignalNotFoundError extends Error {
  constructor(id: string) {
    super(`drift signal ${id} not found`);
  }
}

export function createDriftReverifyService(
  db: DB,
  client: AnthropicClient,
): DriftReverifyService {
  return {
    async reverify(projectId, signalId) {
      const sig = db
        .prepare(
          `SELECT id, project_id, item_id, reason FROM drift_signals
            WHERE id = ? AND project_id = ?`,
        )
        .get(signalId, projectId) as
        | { id: string; project_id: string; item_id: string | null; reason: string }
        | undefined;
      if (!sig) throw new SignalNotFoundError(signalId);
      const item = sig.item_id
        ? (db
            .prepare('SELECT title, description FROM items WHERE id = ?')
            .get(sig.item_id) as { title: string; description: string } | undefined)
        : undefined;

      if (!client.available()) {
        const result: DriftReverifyResult = {
          signal_id: signalId,
          verdict: 'unclear',
          detail: 'No Anthropic key configured — configure one to enable AI re-verify.',
          model: null,
        };
        audit(result);
        return result;
      }

      const user = [
        `Item: ${item?.title ?? '(no associated item)'}`,
        item?.description ? `Description: ${item.description}` : '',
        `Drift signal: ${sig.reason}`,
      ]
        .filter(Boolean)
        .join('\n');
      try {
        const res = await client.call({
          model: MODEL,
          system: SYSTEM,
          messages: [{ role: 'user', content: user }],
          max_tokens: 256,
        });
        const parsed = parseVerdict(res.text) ?? {
          verdict: 'unclear' as const,
          detail: 'AI returned an unparseable verdict.',
        };
        if (res.input_tokens > 0 || res.output_tokens > 0) {
          recordCost(db, {
            projectId,
            feature: 'drift_reverify',
            model: MODEL,
            inputTokens: res.input_tokens,
            outputTokens: res.output_tokens,
            usdEstimate: usdEstimate(MODEL, res.input_tokens, res.output_tokens),
          });
        }
        const result: DriftReverifyResult = {
          signal_id: signalId,
          verdict: parsed.verdict,
          detail: parsed.detail,
          model: MODEL,
        };
        audit(result, SYSTEM + '\n\n' + user);
        return result;
      } catch (err) {
        const result: DriftReverifyResult = {
          signal_id: signalId,
          verdict: 'unclear',
          detail: `AI re-verify failed: ${err instanceof Error ? err.message : 'unknown'}`,
          model: MODEL,
        };
        audit(result);
        return result;
      }

      function audit(result: DriftReverifyResult, prompt?: string): void {
        appendAudit(db, {
          projectId,
          entityType: 'project',
          entityId: projectId,
          actor: result.model ? 'ai' : 'system',
          field: 'drift_reverify',
          newValue: result.verdict,
          triggerContext: {
            signal_id: signalId,
            ...(result.model ? { model: result.model } : {}),
            ...(prompt ? { prompt_fingerprint: promptFingerprint('drift_reverify', prompt) } : {}),
          },
        });
      }
    },
  };
}
