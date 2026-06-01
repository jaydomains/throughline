import type {
  RagCitation,
  RagQueryRequest,
  RagQueryResult,
  RagReindexResult,
  RagSubstrate,
} from '@throughline/shared';
import { ProjectNotFoundError } from '@throughline/shared';
import type { AnthropicClient } from '../ai/anthropic.js';
import { promptFingerprint } from '../ai/fingerprint.js';
import { usdEstimate } from '../ai/pricing.js';
import { appendAudit } from '../audit/log.js';
import { recordCost } from '../cost/telemetry.js';
import type { DB } from '../db/index.js';
import type { ItemsService } from '../items/service.js';
import type { LibraryService } from '../library/service.js';
import type { ProjectsService } from '../projects/service.js';
import type { SembleService } from '../semble/service.js';
import type { TextEmbedder } from './embeddings.js';
import { createTextIndex, type TextIndex } from './text-index.js';

// T-D25 — personal RAG: three substrates, one router. Router is keyword-heuristic first
// with a user-overridable per-query substrate toggle; AI query-intent classification is
// deferred (§13 adopted). Project-scoped by default; explicit cross_project broadens
// text/audit. Every answer carries citations; capability-gated synthesis (no Anthropic
// key ⇒ retrieval-only, no cost).

const TEXT_MODEL = 'claude-sonnet-4-6';
const AUDIT_MODEL = 'claude-sonnet-4-6';
const TEXT_K = 6;
const AUDIT_LIMIT = 20;
const SYNTH_MAX_TOKENS = 700;

// Bare "where" is too greedy ("summarise where this stands" is a text query); require a
// locus phrase. The rest are unambiguous code-locus terms (T-D25 example: "where is X").
const CODE_RE =
  /\b(where(?:'s| is| are| does| do)|which file|which function|implemented|implementation|defined|definition|function|class|module|method|in the code|code for)\b/;
const AUDIT_RE =
  /\b(when|who|history|changed|audit|transition|transitioned|fired|merged|reverted|override|last\s+time)\b/;

export function routeQuery(query: string): RagSubstrate {
  const q = query.toLowerCase();
  // Code intent wins over audit when both match ("where was X changed" is a code-locus
  // question first); text is the default per T-D25.
  if (CODE_RE.test(q)) return 'code';
  if (AUDIT_RE.test(q)) return 'audit';
  return 'text';
}

export interface RagService {
  query(projectId: string, req: RagQueryRequest): Promise<RagQueryResult>;
  reindex(projectId: string): Promise<RagReindexResult>;
  // E19: the shared text substrate, exposed so the library service's per-entry semantic
  // search reuses this one index (the index already covers `library` entities). Injected
  // lazily into the library service to avoid a construction cycle (the index needs the
  // library service, so the library service can only resolve it after composition).
  textIndex: TextIndex;
}

interface CreateOptions {
  db: DB;
  projects: ProjectsService;
  items: ItemsService;
  library: LibraryService;
  semble: SembleService;
  anthropic: AnthropicClient;
  embedder: TextEmbedder;
  resolveModel?: (feature: string, codeSpecDefault: string) => string;
}

export function createRagService(opts: CreateOptions): RagService {
  const { db, projects, semble, anthropic, embedder, resolveModel } = opts;
  const textIndex: TextIndex = createTextIndex({
    db,
    projects,
    items: opts.items,
    library: opts.library,
    embedder,
  });

  async function synthesise(
    feature: string,
    model: string,
    projectId: string,
    question: string,
    context: string,
  ): Promise<{ answer: string; used_ai: true } | { answer: null; used_ai: false }> {
    if (!anthropic.available()) return { answer: null, used_ai: false };
    const system =
      'You answer questions using only the provided excerpts. Answer in plain English, ' +
      'concisely. Cite excerpts by their [n] index. If the excerpts do not contain the ' +
      'answer, say so plainly.';
    const userContent = `Question: ${question}\n\nExcerpts:\n${context}`;
    try {
      const res = await anthropic.call({
        model,
        system,
        messages: [{ role: 'user', content: userContent }],
        max_tokens: SYNTH_MAX_TOKENS,
      });
      if (res.input_tokens > 0 || res.output_tokens > 0) {
        recordCost(db, {
          projectId,
          feature,
          model,
          inputTokens: res.input_tokens,
          outputTokens: res.output_tokens,
          usdEstimate: usdEstimate(model, res.input_tokens, res.output_tokens),
        });
      }
      // T-D24 — model + salted fingerprint of the AI input, never its body.
      appendAudit(db, {
        projectId,
        entityType: 'project',
        entityId: projectId,
        actor: 'ai',
        field: feature,
        newValue: model,
        triggerContext: {
          model,
          feature,
          prompt_fingerprint: promptFingerprint(feature, userContent),
        },
      });
      return { answer: res.text, used_ai: true };
    } catch {
      return { answer: null, used_ai: false };
    }
  }

  async function textQuery(
    projectId: string,
    req: RagQueryRequest,
    cross: boolean,
  ): Promise<Omit<RagQueryResult, 'substrate' | 'routed_by' | 'cross_project'>> {
    const scope = cross ? null : projectId;
    const { hits, embedder } = await textIndex.search(scope, req.query, TEXT_K);
    const citations: RagCitation[] = hits.map((h) => ({
      substrate: 'text',
      ref: `${h.entity_type}:${h.entity_id}`,
      label: h.label,
      snippet: h.snippet,
    }));
    // No hits covers both a genuine empty (embedder 'transformers'/'fallback') and a
    // refused retrieval (embedder 'unavailable'); the embedder field carries the truth so
    // an embed-failure is never indistinguishable from "nothing matched" (T-D60, SF3-02).
    if (hits.length === 0) return { answer: null, citations, used_ai: false, embedder };
    const context = hits
      .map((h, i) => `[${i + 1}] ${h.label}\n${h.snippet}`)
      .join('\n\n');
    const s = await synthesise(
      'rag_text',
      resolveModel ? resolveModel('rag_text', TEXT_MODEL) : TEXT_MODEL,
      projectId,
      req.query,
      context,
    );
    return { answer: s.answer, citations, used_ai: s.used_ai, embedder };
  }

  async function codeQuery(
    projectId: string,
    req: RagQueryRequest,
  ): Promise<Omit<RagQueryResult, 'substrate' | 'routed_by' | 'cross_project'>> {
    // Code substrate is per-project (Semble owns the repo index); cross_project does not
    // apply. codeQa records its own 'code_qa' cost + fingerprint (Phase 11).
    const r = await semble.codeQa(projectId, req.query);
    const citations: RagCitation[] = r.sources.map((s) => ({
      substrate: 'code',
      ref: `${s.path}:${s.line_start}-${s.line_end}`,
      label: `${s.path}:${s.line_start}-${s.line_end}`,
      snippet: s.snippet,
    }));
    // Code substrate is served by Semble, not the text embedder — embedder is N/A here.
    return { answer: r.answer, citations, used_ai: r.summarised, embedder: null };
  }

  async function auditQuery(
    projectId: string,
    req: RagQueryRequest,
    cross: boolean,
  ): Promise<Omit<RagQueryResult, 'substrate' | 'routed_by' | 'cross_project'>> {
    const tokens = req.query
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter((t) => t.length > 2 && !AUDIT_RE.test(t));
    const filters: string[] = [];
    const params: unknown[] = [];
    if (!cross) {
      filters.push('project_id = ?');
      params.push(projectId);
    }
    if (tokens.length > 0) {
      const ors = tokens
        .map(() => '(lower(field) LIKE ? OR lower(new_value) LIKE ? OR entity_type LIKE ?)')
        .join(' OR ');
      filters.push(`(${ors})`);
      for (const t of tokens) params.push(`%${t}%`, `%${t}%`, `%${t}%`);
    }
    const where = filters.length > 0 ? ` WHERE ${filters.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT id, timestamp, entity_type, entity_id, actor, field, old_value, new_value
           FROM audit_log${where} ORDER BY timestamp DESC LIMIT ${AUDIT_LIMIT}`,
      )
      .all(...params) as Array<{
      id: string;
      timestamp: string;
      entity_type: string;
      entity_id: string;
      actor: string;
      field: string;
      old_value: string | null;
      new_value: string | null;
    }>;
    const citations: RagCitation[] = rows.map((r) => ({
      substrate: 'audit',
      ref: r.id,
      label: `${r.timestamp} · ${r.actor} · ${r.entity_type}.${r.field}`,
      snippet:
        r.old_value || r.new_value
          ? `${r.old_value ?? '∅'} → ${r.new_value ?? '∅'}`
          : '(no value delta)',
    }));
    // Audit substrate is a structured query, not an embedding search — embedder is N/A.
    if (rows.length === 0) return { answer: null, citations, used_ai: false, embedder: null };
    const context = citations
      .map((c, i) => `[${i + 1}] ${c.label}\n${c.snippet}`)
      .join('\n\n');
    const s = await synthesise(
      'rag_audit',
      resolveModel ? resolveModel('rag_audit', AUDIT_MODEL) : AUDIT_MODEL,
      projectId,
      req.query,
      context,
    );
    return { answer: s.answer, citations, used_ai: s.used_ai, embedder: null };
  }

  return {
    textIndex,
    async reindex(projectId) {
      if (!projects.get(projectId)) throw new ProjectNotFoundError(projectId);
      const r = await textIndex.ensureFresh(projectId, { force: true });
      return { reembedded: r.reembedded, total: r.total, embedder: embedder.kind };
    },

    async query(projectId, req) {
      if (!projects.get(projectId)) throw new ProjectNotFoundError(projectId);
      const cross = req.cross_project === true;
      const substrate: RagSubstrate = req.substrate ?? routeQuery(req.query);
      const routed_by = req.substrate ? 'override' : 'heuristic';

      let partial: Omit<RagQueryResult, 'substrate' | 'routed_by' | 'cross_project'>;
      if (substrate === 'code') partial = await codeQuery(projectId, req);
      else if (substrate === 'audit') partial = await auditQuery(projectId, req, cross);
      else partial = await textQuery(projectId, req, cross);

      return {
        substrate,
        routed_by,
        cross_project: cross,
        ...partial,
      };
    },
  };
}
