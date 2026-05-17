import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AnthropicClient } from '../src/ai/anthropic.js';
import type { SembleService } from '../src/semble/service.js';
import { createProjectsService } from '../src/projects/service.js';
import { createItemsService } from '../src/items/service.js';
import { createLibraryService } from '../src/library/service.js';
import { createTextEmbedder } from '../src/intelligence/embeddings.js';
import { createRagService, routeQuery, ProjectNotFoundError } from '../src/intelligence/rag.js';
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

async function setup(anthropic: AnthropicClient = offAnthropic(), semble?: SembleService) {
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
    semble: semble ?? stubSemble({ answer: null, sources: [], semble_available: false, summarised: false }),
    anthropic,
    embedder: createTextEmbedder(),
  });
  const project = projects.create({ name: 'p1', repo_path: '/tmp/p1' });
  return { backend, projects, items, library, rag, project, cleanup: () => backend.cleanup() };
}

function costRows(db: import('../src/db/index.js').DB, feature: string): number {
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
      expect(first.embedder).toBe('fallback');
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
