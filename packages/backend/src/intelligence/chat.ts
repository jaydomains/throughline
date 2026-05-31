import { nanoid } from 'nanoid';
import type {
  AiCallStatus,
  ChatHistoryResult,
  ChatMessage,
  ChatProposeRequest,
  ChatSendRequest,
  ChatSendResult,
  DumpZoneProposal,
} from '@throughline/shared';
import { ProjectNotFoundError } from '@throughline/shared';
import type { AnthropicClient } from '../ai/anthropic.js';
import { promptFingerprint } from '../ai/fingerprint.js';
import { usdEstimate } from '../ai/pricing.js';
import { appendAudit } from '../audit/log.js';
import { recordCost } from '../cost/telemetry.js';
import type { DB } from '../db/index.js';
import type { DumpZoneService } from '../dump-zone/service.js';
import type { ItemsService } from '../items/service.js';
import type { MethodologyRegistry } from '../methodology/loader.js';
import type { ProjectsService } from '../projects/service.js';

// SPEC §7.19 chat mode + T-D23 (history persisted per context). Per-list chat (context
// 'session') feeds the session's items + methodology context into the model; dump-zone
// chat ('dump_zone') is the paste/refine surface. History is stored per
// (context_type, context_id) in chat_history. Proposed changes never auto-mutate state —
// they route through the existing dump-zone review modal via dumpZone.propose (source
// 'paste': a chat refinement is functionally a paste into review; avoids widening the
// Phase-4 ProposalSource union). Sonnet per CODE_SPEC §14; capability-gated (no key ⇒
// the user turn is still persisted and a stub assistant reply stored, no cost).

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 800;
const HISTORY_LIMIT = 40;

const NO_KEY_REPLY =
  'AI is not configured — your message is saved. Set an Anthropic API key in settings.json to get a reply.';
const FAILED_REPLY =
  'The AI call failed — your message is saved. Try again; if it persists, check the backend logs or your Anthropic key.';

export interface ChatService {
  history(
    projectId: string,
    contextType: string,
    contextId: string,
  ): ChatHistoryResult;
  send(projectId: string, req: ChatSendRequest): Promise<ChatSendResult>;
  propose(projectId: string, req: ChatProposeRequest): Promise<DumpZoneProposal>;
}

interface CreateOptions {
  db: DB;
  projects: ProjectsService;
  items: ItemsService;
  registry: MethodologyRegistry;
  dumpZone: DumpZoneService;
  anthropic: AnthropicClient;
  resolveModel?: () => string;
}

export function createChatService(opts: CreateOptions): ChatService {
  const { db, projects, items, registry, dumpZone, anthropic, resolveModel } = opts;

  function rows(projectId: string, ct: string, ci: string): ChatMessage[] {
    return (
      db
        .prepare(
          `SELECT id, role, content, created_at FROM chat_history
             WHERE project_id = ? AND context_type = ? AND context_id = ?
             ORDER BY created_at ASC, rowid ASC`,
        )
        .all(projectId, ct, ci) as Array<{
        id: string;
        role: string;
        content: string;
        created_at: string;
      }>
    ).map((r) => ({
      id: r.id,
      role: r.role === 'assistant' ? 'assistant' : 'user',
      content: r.content,
      created_at: r.created_at,
    }));
  }

  function persist(
    projectId: string,
    ct: string,
    ci: string,
    role: 'user' | 'assistant',
    content: string,
  ): ChatMessage {
    const msg: ChatMessage = {
      id: nanoid(),
      role,
      content,
      created_at: new Date().toISOString(),
    };
    db.prepare(
      `INSERT INTO chat_history (id, project_id, context_type, context_id, role, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(msg.id, projectId, ct, ci, role, content, msg.created_at);
    return msg;
  }

  // Compact methodology + session-items digest for a per-list chat turn (SPEC §7.19:
  // "reads the session's items as context plus methodology context").
  function sessionContext(projectId: string, sessionId: string): string {
    const its = items.list({ project_id: projectId, session_id: sessionId });
    const p = projects.get(projectId);
    const loaded = p ? registry.resolveBundle(p.bundle_id, p.bundle_path, p.repo_path) : null;
    const bundleName =
      loaded && loaded.status === 'loaded' ? loaded.bundle.identity.name : 'freeform';
    const anchors = new Set<string>();
    const markers = new Set<string>();
    const units = new Set<string>();
    for (const it of its) {
      for (const a of it.methodology_context.anchor_citations) anchors.add(a);
      for (const m of it.methodology_context.marker_refs) markers.add(m);
      for (const u of it.methodology_context.primary_unit_refs) units.add(u);
    }
    return (
      `Methodology: ${bundleName}\n` +
      `Primary units: ${[...units].join(', ') || 'none'}\n` +
      `Anchors: ${[...anchors].join(', ') || 'none'}\n` +
      `Markers: ${[...markers].join(', ') || 'none'}\n` +
      `Session items (${its.length}):\n` +
      (its.length
        ? its.map((it) => `- [${it.status}] ${it.title}`).join('\n')
        : '_none_')
    );
  }

  return {
    history(projectId, contextType, contextId) {
      if (!projects.get(projectId)) throw new ProjectNotFoundError(projectId);
      return {
        context_type: contextType === 'dump_zone' ? 'dump_zone' : 'session',
        context_id: contextId,
        messages: rows(projectId, contextType, contextId),
      };
    },

    async send(projectId, req) {
      if (!projects.get(projectId)) throw new ProjectNotFoundError(projectId);
      const ct = req.context_type === 'dump_zone' ? 'dump_zone' : 'session';
      const ci = req.context_id;

      const prior = rows(projectId, ct, ci).slice(-HISTORY_LIMIT);
      const userMsg = persist(projectId, ct, ci, 'user', req.message);

      // Default to the honest no-key state; a configured key downgrades to 'failed' (and
      // the failed-call reply) until a usable reply upgrades it to 'ok'. This is what keeps
      // a failed call from masquerading as "no key configured" (T-D60, SF3-03).
      let reply = NO_KEY_REPLY;
      let usedAi = false;
      let aiStatus: AiCallStatus = 'unavailable';
      if (anthropic.available()) {
        aiStatus = 'failed';
        reply = FAILED_REPLY;
        const model = resolveModel ? resolveModel() : MODEL;
        const system =
          ct === 'session'
            ? 'You are a focused project assistant for one work list. Use the supplied ' +
              'session items + methodology context. Be concise. When you propose changes, ' +
              'say so explicitly — they are applied only via the review modal.\n\n' +
              sessionContext(projectId, ci)
            : 'You are a drafting assistant. Help the user refine pasted content. The ' +
              'result is applied only through the review modal.';
        const messages = [
          ...prior.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user' as const, content: req.message },
        ];
        try {
          const res = await anthropic.call({
            model,
            system,
            messages,
            max_tokens: MAX_TOKENS,
          });
          if (res.text.trim() !== '') {
            reply = res.text;
            usedAi = true;
            aiStatus = 'ok';
          }
          // An empty reply leaves aiStatus 'failed' + the failed-call reply: the call was
          // made (cost/audit below still fire) but produced nothing usable — honestly
          // distinct from the no-key stub.
          if (res.input_tokens > 0 || res.output_tokens > 0) {
            recordCost(db, {
              projectId,
              feature: 'chat',
              model,
              inputTokens: res.input_tokens,
              outputTokens: res.output_tokens,
              usdEstimate: usdEstimate(model, res.input_tokens, res.output_tokens),
            });
          }
          // T-D24 — model + salted fingerprint, never the message body.
          appendAudit(db, {
            projectId,
            entityType: 'project',
            entityId: projectId,
            actor: 'ai',
            field: 'chat',
            newValue: `${ct}:${ci}`,
            triggerContext: {
              model,
              context_type: ct,
              prompt_fingerprint: promptFingerprint('chat', req.message),
            },
          });
        } catch {
          /* AI failure ⇒ keep the failed-call reply, used_ai false, ai_status 'failed' */
        }
      }

      const assistantMsg = persist(projectId, ct, ci, 'assistant', reply);
      return {
        user_message: userMsg,
        assistant_message: assistantMsg,
        used_ai: usedAi,
        ai_status: aiStatus,
      };
    },

    async propose(projectId, req) {
      if (!projects.get(projectId)) throw new ProjectNotFoundError(projectId);
      // Routes through the standard review modal — no auto-mutation (SPEC §7.19).
      return dumpZone.propose({
        project_id: projectId,
        text: req.text,
        target: req.target,
        source: 'paste',
        session_id: req.session_id ?? null,
      });
    },
  };
}
