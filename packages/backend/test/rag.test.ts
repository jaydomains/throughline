import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { DB } from '../src/db/index.js';
import type { AnthropicClient } from '../src/ai/anthropic.js';
import type { SembleService } from '../src/semble/service.js';
import { createProjectsService } from '../src/projects/service.js';
import { createItemsService } from '../src/items/service.js';
import { createLibraryService } from '../src/library/service.js';
import { createTextEmbedder, type TextEmbedder } from '../src/intelligence/embeddings.js';
import { ProjectNotFoundError } from '@throughline/shared';
import { createRagService, routeQuery } from '../src/intelligence/rag.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const FREEFORM = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantFreeform(dir: string): void {
  const target = join(dir, 'freeform');
  mkdirSync(target, { recursive: true });
  copyFileSync(FREEFORM, join(target, 'bundle.md'));
}

function stubAnthropic(answer: string): AnthropicClient {
  return {
    available: () => true,
    call: async () => ({ text: answer, input_tokens: 30, output_tokens: 10, stop_reason: 'end_turn' }),
  };
}
function offAnthropic(): AnthropicClient {
  return { available: () => false, call: async () => { throw new Error('off'); } };
}

// The RAG service only calls semble.codeQa; a thin stub keeps the test offline.
function stubSemble(result: Awaited<ReturnType<SembleService['codeQa']>>): SembleService {
  return { codeQa: async () => result } as unknown as SembleService;
}

// A text embedder whose embed() throws at runtime — stands in for the resolved-but-broken
// real extractor (S4-03). It reports kind 'transformers' so the test proves a *runtime*
// failure of a present capability is refused (surfaced 'unavailable'), not silently
// swapped for the SHA1 fallback (T-D60).
function throwingEmbedder(): TextEmbedder {
  return {
    kind: 'transformers',
    dim: 384,
    embed: async () => {
      throw new Error('runtime extractor failure');
    },
  };
}

// Succeeds on the freshness-sweep embed (call 1) but fails only on the query embed (call 2)
// — pins the SF3-02 *query-embed* branch, which the freshness-throw test (throwingEmbedder)
// never reaches because its throw is caught at the ensureFresh boundary. `mode` selects how
// the query embed fails: a runtime throw (catch branch) or an empty result (the !qv branch).
function queryFailingEmbedder(mode: 'throw' | 'novector'): TextEmbedder {
  let calls = 0;
  return {
    kind: 'fallback',
    dim: 4,
    embed: async (texts) => {
      calls += 1;
      if (calls === 1) return texts.map(() => [1, 0, 0, 0]); // freshness sweep succeeds
      if (mode === 'throw') throw new Error('query embed failed');
      return []; // produced no query vector
    },
  };
}

async function setup(
  anthropic: AnthropicClient = offAnthropic(),
  semble?: SembleService,
  embedder?: TextEmbedder,
) {
  const cfg = makeTmpConfig();
  plantFreeform(cfg.methodologiesDir);
  const backend = await makeBackend(cfg);
  const projects = createProjectsService(backend.db, backend.registry);
  const items = createItemsService(backend.db, projects, backend.registry, {});
  const library = createLibraryService(backend.db, projects);
  const rag = createRagService({
    db: backend.db,
    projects,
    items,
    library,
    semble:
      semble ??
      stubSemble({
        answer: null,
        sources: [],
        status: 'unavailable',
        semble_available: false,
        summarised: false,
      }),
    anthropic,
    embedder: embedder ?? createTextEmbedder(),
  });
  const project = projects.create({ name: 'p1', repo_path: '/tmp/p1' });
  return { backend, projects, items, library, rag, project, cleanup: () => backend.cleanup() };
}

function costRows(db: DB, feature: string): number {
  return (db.prepare(`SELECT COUNT(*) n FROM cost_telemetry WHERE feature = ?`).get(feature) as { n: number }).n;
}

describe('Phase 14 — RAG router (T-D25)', () => {
  it('keyword heuristics route code / audit / text', () => {
    expect(routeQuery('where is the upload validator implemented')).toBe('code');
    expect(routeQuery('when did the auth item change status')).toBe('audit');
    expect(routeQuery('summarise where this project stands')).toBe('text');
  });

  it('an explicit substrate overrides the heuristic and is reported as such', async () => {
    const s = await setup();
    try {
      const r = await s.rag.query(s.project.id, { query: 'where is X', substrate: 'text' });
      expect(r.substrate).toBe('text');
      expect(r.routed_by).toBe('override');
      const h = await s.rag.query(s.project.id, { query: 'where is X' });
      expect(h.substrate).toBe('code');
      expect(h.routed_by).toBe('heuristic');
    } finally {
      await s.cleanup();
    }
  });

  it('unknown project rejects', async () => {
    const s = await setup();
    try {
      await expect(s.rag.query('nope', { query: 'x' })).rejects.toBeInstanceOf(ProjectNotFoundError);
    } finally {
      await s.cleanup();
    }
  });
});

describe('Phase 14 — text substrate (C-D2)', () => {
  it('retrieves over items + library and synthesises with citations + cost when AI is on', async () => {
    const s = await setup(stubAnthropic('The widget pipeline is the focus [1].'));
    try {
      const it = s.items.create({
        project_id: s.project.id,
        title: 'wire the widget pipeline',
        description: 'connect the widget ingest to the renderer',
        status: 'open',
      });
      s.library.create({
        project_id: s.project.id,
        type: 'note',
        title: 'unrelated grocery list',
        body: 'milk eggs bread',
      });
      const r = await s.rag.query(s.project.id, { query: 'widget pipeline', substrate: 'text' });
      expect(r.used_ai).toBe(true);
      expect(r.answer).toContain('widget pipeline');
      expect(r.citations[0]!.ref).toBe(`item:${it.id}`);
      expect(r.citations.every((c) => c.substrate === 'text')).toBe(true);
      expect(costRows(s.backend.db, 'rag_text')).toBe(1);
    } finally {
      await s.cleanup();
    }
  });

  it('degrades to retrieval-only with no cost when Anthropic is absent', async () => {
    const s = await setup(offAnthropic());
    try {
      s.items.create({ project_id: s.project.id, title: 'alpha task', description: 'do alpha', status: 'open' });
      const r = await s.rag.query(s.project.id, { query: 'alpha', substrate: 'text' });
      expect(r.answer).toBeNull();
      expect(r.used_ai).toBe(false);
      expect(r.citations.length).toBeGreaterThan(0);
      expect(costRows(s.backend.db, 'rag_text')).toBe(0);
    } finally {
      await s.cleanup();
    }
  });

  it('reindex is incremental: stale on first pass, fresh (0) on the next', async () => {
    const s = await setup();
    try {
      s.items.create({ project_id: s.project.id, title: 'a', description: 'b', status: 'open' });
      const first = await s.rag.reindex(s.project.id);
      expect(first.reembedded).toBe(1);
      // Embedder-agnostic: the deterministic offline embedder ('fallback') runs
      // when @huggingface/transformers is absent; the real ONNX embedder
      // ('transformers') runs when the optional dep resolves. Phase 16 (DoD)
      // closed the Phase-14/15 open question — assert the incremental-reindex
      // contract, not which embedder backend this environment happened to load.
      expect(['fallback', 'transformers']).toContain(first.embedder);
      const second = await s.rag.reindex(s.project.id);
      expect(second.reembedded).toBe(0);
      expect(second.total).toBe(1);
    } finally {
      await s.cleanup();
    }
  });

  it('is project-scoped by default and broadens under cross_project', async () => {
    const s = await setup();
    try {
      const p2 = s.projects.create({ name: 'p2', repo_path: '/tmp/p2' });
      s.items.create({ project_id: s.project.id, title: 'shared keyword here', description: '', status: 'open' });
      s.items.create({ project_id: p2.id, title: 'shared keyword elsewhere', description: '', status: 'open' });
      const scoped = await s.rag.query(s.project.id, { query: 'shared keyword', substrate: 'text' });
      expect(scoped.cross_project).toBe(false);
      expect(scoped.citations.length).toBe(1);
      const cross = await s.rag.query(s.project.id, {
        query: 'shared keyword',
        substrate: 'text',
        cross_project: true,
      });
      expect(cross.cross_project).toBe(true);
      expect(cross.citations.length).toBe(2);
    } finally {
      await s.cleanup();
    }
  });
});

describe('Phase 14 — audit & code substrates (T-D25)', () => {
  it('audit substrate returns structured citations scoped to the project', async () => {
    const s = await setup(offAnthropic());
    try {
      // items.create writes an audit row for the new item.
      s.items.create({ project_id: s.project.id, title: 'tracked', description: '', status: 'open' });
      const r = await s.rag.query(s.project.id, { query: 'when was tracked created', substrate: 'audit' });
      expect(r.substrate).toBe('audit');
      expect(r.citations.length).toBeGreaterThan(0);
      expect(r.citations.every((c) => c.substrate === 'audit')).toBe(true);
    } finally {
      await s.cleanup();
    }
  });

  it('code substrate maps Semble sources to code citations', async () => {
    const s = await setup(
      offAnthropic(),
      stubSemble({
        answer: 'It lives in server.ts [1].',
        sources: [{ path: 'src/server.ts', line_start: 10, line_end: 20, snippet: 'startServer()' }],
        status: 'available',
        semble_available: true,
        summarised: true,
      }),
    );
    try {
      const r = await s.rag.query(s.project.id, { query: 'where is the server started' });
      expect(r.substrate).toBe('code');
      expect(r.routed_by).toBe('heuristic');
      expect(r.citations[0]).toMatchObject({
        substrate: 'code',
        ref: 'src/server.ts:10-20',
      });
      expect(r.used_ai).toBe(true);
    } finally {
      await s.cleanup();
    }
  });
});

describe('E1 — embedder honesty on the wire (T-D60: SF3-01, SF3-02, S4-03)', () => {
  it('discloses the embedder backend on a text result (SF3-01: not indistinguishable from real)', async () => {
    const s = await setup();
    try {
      s.items.create({
        project_id: s.project.id,
        title: 'wire the widget pipeline',
        description: 'connect the widget ingest to the renderer',
        status: 'open',
      });
      const r = await s.rag.query(s.project.id, { query: 'widget pipeline', substrate: 'text' });
      expect(r.citations.length).toBeGreaterThan(0);
      // The result carries the embedder used, so keyword-class fallback hits are never
      // passed off as authoritative model retrieval. It is a disclosed working backend,
      // never 'unavailable' on a successful retrieval.
      expect(['transformers', 'fallback']).toContain(r.embedder);
    } finally {
      await s.cleanup();
    }
  });

  it('a genuine empty discloses a working embedder, distinct from a refusal (SF3-02)', async () => {
    // No indexed content: an honest empty served by a working embedder — NOT 'unavailable'.
    const s = await setup();
    try {
      const r = await s.rag.query(s.project.id, { query: 'nothing indexed yet', substrate: 'text' });
      expect(r.citations.length).toBe(0);
      expect(r.answer).toBeNull();
      expect(['transformers', 'fallback']).toContain(r.embedder);
      expect(r.embedder).not.toBe('unavailable');
    } finally {
      await s.cleanup();
    }
  });

  it('an embed-failure in the freshness sweep surfaces as unavailable, never a crash (S4-03)', async () => {
    // A resolved-but-broken extractor: the freshness sweep embeds the stale item and throws.
    // The query must not crash (S4-03) and must not read as "nothing matched" (SF3-02).
    const s = await setup(offAnthropic(), undefined, throwingEmbedder());
    try {
      s.items.create({ project_id: s.project.id, title: 'alpha', description: 'do alpha', status: 'open' });
      const r = await s.rag.query(s.project.id, { query: 'alpha', substrate: 'text' });
      expect(r.embedder).toBe('unavailable');
      expect(r.citations.length).toBe(0);
      expect(r.answer).toBeNull();
      expect(r.used_ai).toBe(false);
    } finally {
      await s.cleanup();
    }
  });

  it('a query-embed throw (sweep ok) surfaces as unavailable (SF3-02 query-embed branch)', async () => {
    // The freshness sweep succeeds; only the query embed throws — exercises the query-embed
    // catch, which the sweep-throw test above never reaches.
    const s = await setup(offAnthropic(), undefined, queryFailingEmbedder('throw'));
    try {
      s.items.create({ project_id: s.project.id, title: 'alpha', description: 'do alpha', status: 'open' });
      const r = await s.rag.query(s.project.id, { query: 'alpha', substrate: 'text' });
      expect(r.embedder).toBe('unavailable');
      expect(r.citations.length).toBe(0);
      expect(r.answer).toBeNull();
    } finally {
      await s.cleanup();
    }
  });

  it('a query embed that yields no vector surfaces as unavailable (SF3-02 !qv branch)', async () => {
    const s = await setup(offAnthropic(), undefined, queryFailingEmbedder('novector'));
    try {
      s.items.create({ project_id: s.project.id, title: 'alpha', description: 'do alpha', status: 'open' });
      const r = await s.rag.query(s.project.id, { query: 'alpha', substrate: 'text' });
      expect(r.embedder).toBe('unavailable');
      expect(r.citations.length).toBe(0);
    } finally {
      await s.cleanup();
    }
  });

  it('an infra/DB failure in the sweep propagates, not masked as unavailable (T-D60/T-D58)', async () => {
    // A non-embedder throw inside the freshness sweep (here a service/DB read) must NOT be
    // swallowed into embedder:'unavailable' — that would mask a real error (and a T-D58
    // DomainError's canonical status) behind a healthy-looking degraded state.
    const s = await setup();
    try {
      s.items.create({ project_id: s.project.id, title: 'alpha', description: 'do alpha', status: 'open' });
      const boom = new Error('db unavailable');
      (s.items as unknown as { list: () => never }).list = () => {
        throw boom;
      };
      await expect(
        s.rag.query(s.project.id, { query: 'alpha', substrate: 'text' }),
      ).rejects.toThrow('db unavailable');
    } finally {
      await s.cleanup();
    }
  });

  it('code and audit substrates report embedder null (no text embedding)', async () => {
    const s = await setup(
      offAnthropic(),
      stubSemble({
        answer: 'It lives in server.ts [1].',
        sources: [{ path: 'src/server.ts', line_start: 1, line_end: 2, snippet: 'x' }],
        status: 'available',
        semble_available: true,
        summarised: true,
      }),
    );
    try {
      s.items.create({ project_id: s.project.id, title: 'tracked', description: '', status: 'open' });
      const code = await s.rag.query(s.project.id, { query: 'where is the server started' });
      expect(code.substrate).toBe('code');
      expect(code.embedder).toBeNull();
      const audit = await s.rag.query(s.project.id, { query: 'when was tracked created', substrate: 'audit' });
      expect(audit.substrate).toBe('audit');
      expect(audit.embedder).toBeNull();
    } finally {
      await s.cleanup();
    }
  });
});
