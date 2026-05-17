import { nanoid } from 'nanoid';
import type {
  CodeQaResult,
  CodeSearchResponse,
  ConfirmCodeRefsRequest,
  ItemCodeRef,
  SembleHit,
} from '@throughline/shared';
import type { AnthropicClient } from '../ai/anthropic.js';
import { promptFingerprint } from '../ai/fingerprint.js';
import { usdEstimate } from '../ai/pricing.js';
import { appendAudit } from '../audit/log.js';
import { recordCost } from '../cost/telemetry.js';
import type { DB } from '../db/index.js';
import type { ItemsService } from '../items/service.js';
import type { ProjectsService } from '../projects/service.js';
import type { SembleClient } from './client.js';

// Phase 11 — Semble consumers (SPEC §7.15; C-D17, T-D27, T-D13).
//
// Three uses: (1) done-time auto-link items to code (search by title+description, user
// confirms, refs stored → tier-3 drift becomes live), (2) plain-English code Q&A
// (Semble hits summarised by Anthropic), (3) dump-zone enrichment (background search per
// proposed item, suggestions surfaced read-only in the review modal).
//
// Capability-gated end to end (SPEC §15): no Semble ⇒ candidates empty / `available:false`;
// no Anthropic key ⇒ Q&A returns hits as sources without a synthesised answer.

const QA_MODEL = 'claude-sonnet-4-6';
const QA_MAX_TOKENS = 700;
const QA_HIT_LIMIT = 8;

export class ItemNotFoundError extends Error {
  constructor(id: string) {
    super(`item ${id} not found`);
  }
}

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`project ${id} not found`);
  }
}

interface CodeRefRow {
  id: string;
  item_id: string;
  path: string;
  line_start: number;
  line_end: number;
  summary: string | null;
}

export interface SembleService {
  searchForItem(itemId: string): Promise<CodeSearchResponse>;
  listRefs(itemId: string): ItemCodeRef[];
  confirmRefs(itemId: string, req: ConfirmCodeRefsRequest): ItemCodeRef[];
  removeRef(itemId: string, refId: string): void;
  codeQa(projectId: string, question: string): Promise<CodeQaResult>;
  // Best-effort repo search used by dump-zone enrichment. Empty when Semble is absent.
  searchRepo(projectId: string, query: string, limit?: number): Promise<SembleHit[]>;
}

interface CreateOptions {
  db: DB;
  projects: ProjectsService;
  items: ItemsService;
  client: SembleClient;
  anthropic: AnthropicClient;
  resolveModel?: () => string;
}

function rowToRef(r: CodeRefRow): ItemCodeRef {
  return {
    id: r.id,
    item_id: r.item_id,
    path: r.path,
    line_start: r.line_start,
    line_end: r.line_end,
    summary: r.summary,
  };
}

export function createSembleService(opts: CreateOptions): SembleService {
  const { db, projects, items, client, anthropic, resolveModel } = opts;

  function repoPathForProject(projectId: string): string {
    const project = projects.get(projectId);
    if (!project) throw new ProjectNotFoundError(projectId);
    return project.repo_path;
  }

  return {
    async searchForItem(itemId) {
      const item = items.get(itemId);
      if (!item) throw new ItemNotFoundError(itemId);
      if (!(await client.available())) return { candidates: [], available: false };
      const repoPath = repoPathForProject(item.project_id);
      const query = `${item.title}\n${item.description}`.trim();
      const hits = await client.search({ repoPath, query, limit: QA_HIT_LIMIT });
      return {
        available: true,
        candidates: hits.map((h) => ({
          path: h.path,
          line_start: h.line_start,
          line_end: h.line_end,
          snippet: h.snippet,
          score: h.score,
        })),
      };
    },

    listRefs(itemId) {
      const rows = db
        .prepare(
          `SELECT id, item_id, path, line_start, line_end, summary
             FROM item_code_refs WHERE item_id = ? ORDER BY path, line_start`,
        )
        .all(itemId) as CodeRefRow[];
      return rows.map(rowToRef);
    },

    confirmRefs(itemId, req) {
      const item = items.get(itemId);
      if (!item) throw new ItemNotFoundError(itemId);
      const now = new Date().toISOString();
      const created: ItemCodeRef[] = [];
      const tx = db.transaction(() => {
        for (const ref of req.refs) {
          const id = nanoid();
          db.prepare(
            `INSERT INTO item_code_refs (id, item_id, path, line_start, line_end, summary)
               VALUES (?, ?, ?, ?, ?, ?)`,
          ).run(id, itemId, ref.path, ref.line_start, ref.line_end, ref.summary ?? null);
          created.push({
            id,
            item_id: itemId,
            path: ref.path,
            line_start: ref.line_start,
            line_end: ref.line_end,
            summary: ref.summary ?? null,
          });
        }
        appendAudit(db, {
          projectId: item.project_id,
          entityType: 'item',
          entityId: itemId,
          actor: 'user',
          field: 'code_ref',
          newValue: created.map((c) => `${c.path}:${c.line_start}-${c.line_end}`).join(', '),
          triggerContext: { source: 'semble', confirmed_at: now, count: created.length },
        });
      });
      tx();
      return created;
    },

    removeRef(itemId, refId) {
      const item = items.get(itemId);
      if (!item) throw new ItemNotFoundError(itemId);
      const row = db
        .prepare('SELECT id, item_id, path, line_start, line_end, summary FROM item_code_refs WHERE id = ? AND item_id = ?')
        .get(refId, itemId) as CodeRefRow | undefined;
      if (!row) return;
      db.prepare('DELETE FROM item_code_refs WHERE id = ?').run(refId);
      appendAudit(db, {
        projectId: item.project_id,
        entityType: 'item',
        entityId: itemId,
        actor: 'user',
        field: 'code_ref',
        oldValue: `${row.path}:${row.line_start}-${row.line_end}`,
      });
    },

    async searchRepo(projectId, query, limit) {
      if (!(await client.available())) return [];
      const repoPath = repoPathForProject(projectId);
      return client.search(
        limit === undefined ? { repoPath, query } : { repoPath, query, limit },
      );
    },

    async codeQa(projectId, question) {
      const q = question.trim();
      const sembleAvailable = await client.available();
      if (!sembleAvailable || q.length === 0) {
        return { answer: null, sources: [], semble_available: false, summarised: false };
      }
      const repoPath = repoPathForProject(projectId);
      const hits = await client.search({ repoPath, query: q, limit: QA_HIT_LIMIT });
      const sources = hits.map((h) => ({
        path: h.path,
        line_start: h.line_start,
        line_end: h.line_end,
        snippet: h.snippet,
      }));
      if (hits.length === 0 || !anthropic.available()) {
        return {
          answer: null,
          sources,
          semble_available: true,
          summarised: false,
        };
      }
      const context = hits
        .map(
          (h, i) =>
            `[${i + 1}] ${h.path}:${h.line_start}-${h.line_end}\n${h.snippet}`,
        )
        .join('\n\n');
      const system =
        'You answer questions about a codebase using only the provided code excerpts. ' +
        'Answer in plain English, concisely. Cite excerpts by their [n] index. ' +
        'If the excerpts do not contain the answer, say so.';
      const userContent = `Question: ${q}\n\nCode excerpts:\n${context}`;
      const model = resolveModel ? resolveModel() : QA_MODEL;
      try {
        const res = await anthropic.call({
          model,
          system,
          messages: [{ role: 'user', content: userContent }],
          max_tokens: QA_MAX_TOKENS,
        });
        if (res.input_tokens > 0 || res.output_tokens > 0) {
          recordCost(db, {
            projectId,
            feature: 'code_qa',
            model,
            inputTokens: res.input_tokens,
            outputTokens: res.output_tokens,
            usdEstimate: usdEstimate(model, res.input_tokens, res.output_tokens),
          });
        }
        appendAudit(db, {
          projectId,
          entityType: 'project',
          entityId: projectId,
          actor: 'ai',
          field: 'code_qa',
          newValue: `${hits.length} sources`,
          triggerContext: {
            model,
            prompt_fingerprint: promptFingerprint('code_qa', `${system}\n${userContent}`),
          },
        });
        return {
          answer: res.text,
          sources,
          semble_available: true,
          summarised: true,
        };
      } catch {
        // Anthropic call failed: still useful — return the located sources unsummarised.
        return { answer: null, sources, semble_available: true, summarised: false };
      }
    },
  };
}
