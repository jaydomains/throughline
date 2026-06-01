import { ProjectNotFoundError } from '@throughline/shared';
import type { FastifyInstance } from 'fastify';
import type { AnthropicClient } from '../ai/anthropic.js';
import { promptFingerprint } from '../ai/fingerprint.js';
import { usdEstimate } from '../ai/pricing.js';
import { recordCost } from '../cost/telemetry.js';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';
import type { ProjectsService } from '../projects/service.js';
import type { LibraryService } from './service.js';

// E20b — LLM-assisted project-spec revision (SPEC §7; the F4-01 `project_spec` authoring
// surface). User-mediated suggest/draft/accept-reject: this service only DRAFTS a revision;
// it NEVER writes. The user reviews the draft in the modal and either accepts (the write
// goes through the standard library update) or rejects (the draft is discarded). This is the
// first AI-assist "draft → review → accept" pattern in the codebase; future LLM-assist
// features (e.g. doc revision) should follow this shape: a draft-only endpoint + a
// user-mediated accept/reject UI, with the actual write on the existing edit path.
//
// T-D60: when the embedder/AI is unavailable or the call fails, the result discloses that
// (`used_ai:false`, `status`) and returns NO draft — never a fabricated one. T-D24: the AI
// call is audited by prompt fingerprint, never the spec body; T-D29 cost is recorded.

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2048;
// Bound the free-text instruction so a pasted wall of text can't drive unexpected token
// cost (the spec body itself is already bounded by its 8000-char read in E20a's session-start).
const MAX_INSTRUCTION_CHARS = 2000;

export type SpecDraftStatus = 'ok' | 'unavailable' | 'failed';

export interface SpecDraftResult {
  draft: string | null;
  used_ai: boolean;
  status: SpecDraftStatus;
}

export interface SpecAssistService {
  // Produce a revised project-spec draft from the current spec + the user's instruction.
  // Read-only: it does not persist anything.
  draft(projectId: string, instruction: string): Promise<SpecDraftResult>;
}

export function createSpecAssistService(opts: {
  db: DB;
  projects: ProjectsService;
  library: LibraryService;
  anthropic: AnthropicClient;
  resolveModel?: () => string;
}): SpecAssistService {
  const { db, projects, library, anthropic, resolveModel } = opts;
  return {
    async draft(projectId, instruction) {
      if (!projects.get(projectId)) throw new ProjectNotFoundError(projectId);
      const existing = library.list({ projectId, type: 'project_spec' })[0] ?? null;
      const current = existing ? `${existing.title}\n\n${existing.body}`.trim() : '';

      if (!anthropic.available()) {
        // Honest unavailable — no draft, no fabrication (T-D60).
        return { draft: null, used_ai: false, status: 'unavailable' };
      }
      const model = resolveModel ? resolveModel() : MODEL;
      const system =
        'You revise a software project specification. Return ONLY the revised spec as ' +
        'GitHub-flavored markdown — no preamble, no commentary, no code fences. Preserve the ' +
        'author’s intent and any decisions already recorded; improve clarity, structure, and ' +
        'completeness. If there is no current spec, draft one from the instruction.';
      const instr = instruction.trim().slice(0, MAX_INSTRUCTION_CHARS);
      const user =
        `Current project spec:\n${current || '(none yet)'}\n\n` +
        `Revision instruction:\n${instr || 'Improve and expand the spec.'}`;
      try {
        const res = await anthropic.call({
          model,
          system,
          messages: [{ role: 'user', content: user }],
          max_tokens: MAX_TOKENS,
        });
        recordCost(db, {
          projectId,
          feature: 'project_spec_assist',
          model,
          inputTokens: res.input_tokens,
          outputTokens: res.output_tokens,
          usdEstimate: usdEstimate(model, res.input_tokens, res.output_tokens),
        });
        // T-D24: record that a draft was generated — fingerprint only, never the spec body;
        // `applied:false` marks this as a proposal, not a write (the accept path audits the
        // actual library update separately).
        appendAudit(db, {
          projectId,
          entityType: 'library',
          entityId: existing?.id ?? 'project_spec',
          actor: 'ai',
          field: 'project_spec_draft',
          triggerContext: {
            model,
            prompt_fingerprint: promptFingerprint('project_spec_assist', `${system}\n${user}`),
            applied: false,
          },
        });
        const text = res.text.trim();
        // An empty model response is a failed draft, not a healthy empty (T-D60).
        return text
          ? { draft: text, used_ai: true, status: 'ok' }
          : { draft: null, used_ai: false, status: 'failed' };
      } catch {
        return { draft: null, used_ai: false, status: 'failed' };
      }
    },
  };
}

// POST /api/projects/:id/library/project-spec/draft — returns a draft revision for review;
// it does not persist. The frontend shows the draft and either accepts it (writing via the
// existing library update) or discards it.
export function registerSpecAssistRoutes(app: FastifyInstance, specAssist: SpecAssistService): void {
  app.post<{ Params: { id: string }; Body: { instruction?: string } }>(
    '/api/projects/:id/library/project-spec/draft',
    async (req) => {
      const instruction = typeof req.body?.instruction === 'string' ? req.body.instruction : '';
      return { result: await specAssist.draft(req.params.id, instruction) };
    },
  );
}
