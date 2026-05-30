import { appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SessionRetroRequest, SessionRetroResult } from '@throughline/shared';
import { ProjectNotFoundError, SessionNotFoundError } from '@throughline/shared';
import type { AnthropicClient } from '../ai/anthropic.js';
import { promptFingerprint } from '../ai/fingerprint.js';
import { usdEstimate } from '../ai/pricing.js';
import { appendAudit } from '../audit/log.js';
import { recordCost } from '../cost/telemetry.js';
import type { DB } from '../db/index.js';
import type { ItemsService } from '../items/service.js';
import type { LibraryService } from '../library/service.js';
import type { ProjectsService } from '../projects/service.js';
import type { SessionsService } from '../sessions/service.js';

// SPEC §7.18 end-of-session retro. User-initiated only (§13 adopted). Window = since the
// last retro for this session (audit entity_type='session' field='retro') else the
// session's created_at. Assembles the session's items, the audit entries in the window
// (incl. methodology-context updates: gate firings, marker/phase changes), and a
// reference to Claude Code transcripts pushed in the window; AI (Sonnet, §14) writes the
// one-page summary. Capability-gated: no Anthropic key ⇒ a deterministic structured
// summary is saved instead (used_ai=false), same degrade discipline as the rest of the
// intelligence layer. Saved as a library note; optionally attached to discussed items
// and appended to <repo>/session-start.md for the next session.

const RETRO_MODEL = 'claude-sonnet-4-6';
const RETRO_MAX_TOKENS = 900;

export interface RetroService {
  generate(projectId: string, req: SessionRetroRequest): Promise<SessionRetroResult>;
}

interface CreateOptions {
  db: DB;
  projects: ProjectsService;
  sessions: SessionsService;
  items: ItemsService;
  library: LibraryService;
  anthropic: AnthropicClient;
  resolveModel?: () => string;
}

export function createRetroService(opts: CreateOptions): RetroService {
  const { db, projects, sessions, items, library, anthropic, resolveModel } = opts;

  function windowStart(projectId: string, sessionId: string, fallback: string): string {
    const row = db
      .prepare(
        `SELECT timestamp FROM audit_log
           WHERE entity_type = 'session' AND entity_id = ? AND field = 'retro'
             AND project_id = ?
           ORDER BY timestamp DESC LIMIT 1`,
      )
      .get(sessionId, projectId) as { timestamp: string } | undefined;
    return row?.timestamp ?? fallback;
  }

  return {
    async generate(projectId, req) {
      const project = projects.get(projectId);
      if (!project) throw new ProjectNotFoundError(projectId);
      const session = sessions.get(req.session_id);
      if (!session || session.project_id !== projectId) {
        throw new SessionNotFoundError(req.session_id);
      }

      const since = windowStart(projectId, session.id, session.created_at);
      const sessionItems = items.list({ project_id: projectId, session_id: session.id });

      const auditRows = db
        .prepare(
          `SELECT timestamp, entity_type, entity_id, actor, field, old_value, new_value
             FROM audit_log
            WHERE project_id = ? AND timestamp >= ?
            ORDER BY timestamp ASC LIMIT 300`,
        )
        .all(projectId, since) as Array<{
        timestamp: string;
        entity_type: string;
        entity_id: string;
        actor: string;
        field: string;
        old_value: string | null;
        new_value: string | null;
      }>;
      const methodologyEvents = auditRows.filter(
        (r) =>
          r.entity_type === 'gate_firing' ||
          r.entity_type === 'checklist_step' ||
          /marker|phase|anchor|primary_unit/.test(r.field),
      );
      // Claude Code transcripts pushed in the window (T-D16 inbox). Bodies live in the
      // archive dir; v1 references the processed items by path+count — full-body
      // inclusion deferred (handover Drift Flag).
      const transcripts = db
        .prepare(
          `SELECT original_path, received_at FROM cc_inbox_queue
            WHERE state = 'processed' AND received_at >= ? ORDER BY received_at ASC LIMIT 50`,
        )
        .all(since) as Array<{ original_path: string; received_at: string }>;

      const structured =
        `# Session retro — ${session.name}\n\n` +
        `Window: since ${since}\n\n` +
        `## Items in this session (${sessionItems.length})\n` +
        (sessionItems.length
          ? sessionItems
              .map((it) => `- [${it.status}] ${it.title}${it.title ? '' : ''}`)
              .join('\n')
          : '_none_') +
        `\n\n## Activity (${auditRows.length} audit entries)\n` +
        (auditRows.length
          ? auditRows
              .slice(-40)
              .map(
                (r) =>
                  `- ${r.timestamp} · ${r.actor} · ${r.entity_type}.${r.field}` +
                  (r.new_value ? ` → ${r.new_value}` : ''),
              )
              .join('\n')
          : '_none_') +
        `\n\n## Methodology-context updates (${methodologyEvents.length})\n` +
        (methodologyEvents.length
          ? methodologyEvents
              .map((r) => `- ${r.entity_type}.${r.field}: ${r.old_value ?? '∅'} → ${r.new_value ?? '∅'}`)
              .join('\n')
          : '_none_') +
        `\n\n## Claude Code transcripts in window (${transcripts.length})\n` +
        (transcripts.length
          ? transcripts.map((t) => `- ${t.received_at} · ${t.original_path}`).join('\n')
          : '_none_');

      let summary = structured;
      let usedAi = false;
      const model = resolveModel ? resolveModel() : RETRO_MODEL;
      if (anthropic.available()) {
        const system =
          'You write a concise one-page end-of-session retrospective for a software ' +
          'project. Use only the supplied material. Cover: what moved, decisions/' +
          'methodology changes, open risks, and a short "next session" list.';
        try {
          const res = await anthropic.call({
            model,
            system,
            messages: [{ role: 'user', content: structured }],
            max_tokens: RETRO_MAX_TOKENS,
          });
          if (res.text.trim() !== '') {
            summary = res.text;
            usedAi = true;
          }
          if (res.input_tokens > 0 || res.output_tokens > 0) {
            recordCost(db, {
              projectId,
              feature: 'session_retro',
              model,
              inputTokens: res.input_tokens,
              outputTokens: res.output_tokens,
              usdEstimate: usdEstimate(model, res.input_tokens, res.output_tokens),
            });
          }
        } catch {
          /* AI failure ⇒ keep the deterministic structured summary */
        }
      }

      const entry = library.create({
        project_id: projectId,
        type: 'note',
        title: `Session retro — ${session.name} — ${new Date().toISOString().slice(0, 10)}`,
        body: summary,
      });

      const attachedItemIds: string[] = [];
      if (req.attach_to_items) {
        for (const it of sessionItems) {
          library.attach(entry.id, it.id);
          attachedItemIds.push(it.id);
        }
      }

      let appended = false;
      if (req.append_to_session_start && existsSync(project.repo_path)) {
        try {
          appendFileSync(
            join(project.repo_path, 'session-start.md'),
            `\n\n<!-- retro ${new Date().toISOString()} (${session.name}) -->\n${summary}\n`,
          );
          appended = true;
        } catch {
          appended = false;
        }
      }

      appendAudit(db, {
        projectId,
        entityType: 'session',
        entityId: session.id,
        actor: usedAi ? 'ai' : 'user',
        field: 'retro',
        newValue: entry.id,
        triggerContext: {
          library_entry_id: entry.id,
          used_ai: usedAi,
          window_start: since,
          attached_item_ids: attachedItemIds,
          appended_to_session_start: appended,
          ...(usedAi
            ? { model, prompt_fingerprint: promptFingerprint('session_retro', structured) }
            : {}),
        },
      });

      return {
        library_entry_id: entry.id,
        summary,
        used_ai: usedAi,
        attached_item_ids: attachedItemIds,
        appended_to_session_start: appended,
      };
    },
  };
}
