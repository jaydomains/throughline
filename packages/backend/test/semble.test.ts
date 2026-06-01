import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AnthropicClient } from '../src/ai/anthropic.js';
import { createProjectsService } from '../src/projects/service.js';
import { createItemsService } from '../src/items/service.js';
import { createDriftService } from '../src/drift/service.js';
import { runTier3 } from '../src/github/tiers.js';
import type { GhPull } from '../src/github/api.js';
import { createSembleClient, type SembleExec } from '../src/semble/client.js';
import { createSembleService } from '../src/semble/service.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantFreeform(methodologiesDir: string): void {
  const target = join(methodologiesDir, 'freeform');
  mkdirSync(target, { recursive: true });
  copyFileSync(FREEFORM_BUNDLE_PATH, join(target, 'bundle.md'));
}

function unavailableAnthropic(): AnthropicClient {
  return {
    available: () => false,
    call: async () => {
      throw new Error('not configured');
    },
  };
}

function stubAnthropic(answer: string): AnthropicClient {
  return {
    available: () => true,
    call: async () => ({
      text: answer,
      input_tokens: 12,
      output_tokens: 8,
      stop_reason: 'end_turn',
    }),
  };
}

async function setup() {
  const cfg = makeTmpConfig();
  plantFreeform(cfg.methodologiesDir);
  const backend = await makeBackend(cfg);
  const projects = createProjectsService(backend.db, backend.registry);
  const items = createItemsService(backend.db, projects, backend.registry);
  const drift = createDriftService(backend.db);
  const project = projects.create({ name: 'demo', repo_path: '/tmp/demo-repo' });
  return { backend, projects, items, drift, project };
}

function fakePull(n: number): GhPull {
  return {
    number: n,
    title: `pr ${n}`,
    body: null,
    html_url: `https://example.test/pr/${n}`,
    state: 'open',
    merged_at: null,
    updated_at: '2026-05-16T00:00:00Z',
    created_at: '2026-05-16T00:00:00Z',
    head: { ref: 'feat', sha: 'h'.repeat(7) },
    base: { ref: 'main', sha: 'b'.repeat(7) },
  };
}

describe('semble client', () => {
  it('probe() is unavailable when the command does not resolve (ENOENT)', async () => {
    const exec: SembleExec = async () => {
      const err = new Error('spawn semble ENOENT') as Error & { code?: string };
      err.code = 'ENOENT';
      throw err;
    };
    const client = createSembleClient({ command: 'semble', execImpl: exec });
    expect(await client.probe()).toBe('unavailable');
  });

  it('probe() is available when --version runs (keyless: even a non-zero exit means present)', async () => {
    const ok: SembleExec = async () => ({ stdout: 'semble 1.0.0', stderr: '' });
    expect(await createSembleClient({ command: 'semble', execImpl: ok }).probe()).toBe('available');

    const nonZero: SembleExec = async () => {
      const err = new Error('exit 2') as Error & { code?: number };
      err.code = 2;
      throw err;
    };
    expect(await createSembleClient({ command: 'semble', execImpl: nonZero }).probe()).toBe(
      'available',
    );
  });

  it('probe() is degraded when the binary is present but times out / fails abnormally (SF4-01)', async () => {
    // execFile timeout: the child is killed, the rejection carries killed:true and a
    // non-numeric code — present-but-not-responding, not absent and not healthy.
    const timeout: SembleExec = async () => {
      const err = new Error('killed: timeout') as Error & { killed?: boolean; signal?: string };
      err.killed = true;
      err.signal = 'SIGTERM';
      throw err;
    };
    expect(await createSembleClient({ command: 'semble', execImpl: timeout }).probe()).toBe(
      'degraded',
    );
  });

  it('search() passes the assumed argv and parses a JSON hits array', async () => {
    let seenArgs: string[] = [];
    const exec: SembleExec = async (_cmd, args) => {
      seenArgs = args;
      return {
        stdout: JSON.stringify([
          { path: 'src/a.ts', line_start: 10, line_end: 20, snippet: 'fn a()', score: 0.9 },
        ]),
        stderr: '',
      };
    };
    const client = createSembleClient({ command: 'semble', execImpl: exec });
    const out = await client.search({ repoPath: '/repo', query: 'upload validation', limit: 5 });
    expect(seenArgs).toEqual([
      'search',
      '--json',
      '--path',
      '/repo',
      '--limit',
      '5',
      '--',
      'upload validation',
    ]);
    expect(out).toEqual({
      status: 'ok',
      hits: [{ path: 'src/a.ts', line_start: 10, line_end: 20, snippet: 'fn a()', score: 0.9 }],
    });
  });

  it('search() tolerates object-wrapped output, JSON-lines, and garbage (all honest ok)', async () => {
    const wrapped: SembleExec = async () => ({
      stdout: JSON.stringify({ results: [{ file: 'x.ts', line: 3, text: 'hi' }] }),
      stderr: '',
    });
    expect(
      await createSembleClient({ command: 'c', execImpl: wrapped }).search({
        repoPath: '/r',
        query: 'q',
      }),
    ).toEqual({
      status: 'ok',
      hits: [{ path: 'x.ts', line_start: 3, line_end: 3, snippet: 'hi', score: null }],
    });

    const lines: SembleExec = async () => ({
      stdout: '{"path":"a"}\nnot json\n{"path":"b","line_start":2}',
      stderr: '',
    });
    const got = await createSembleClient({ command: 'c', execImpl: lines }).search({
      repoPath: '/r',
      query: 'q',
    });
    expect(got.status).toBe('ok');
    expect(got.status === 'ok' && got.hits.map((h) => h.path)).toEqual(['a', 'b']);

    // Unparseable stdout from a command that *ran* is an honest empty, not a degradation.
    const garbage: SembleExec = async () => ({ stdout: 'totally not json', stderr: '' });
    expect(
      await createSembleClient({ command: 'c', execImpl: garbage }).search({
        repoPath: '/r',
        query: 'q',
      }),
    ).toEqual({ status: 'ok', hits: [] });
  });

  it('search() discloses degraded (not empty) when the exec fails (SF4-01)', async () => {
    const enoent: SembleExec = async () => {
      const e = new Error('ENOENT') as Error & { code?: string };
      e.code = 'ENOENT';
      throw e;
    };
    expect(
      await createSembleClient({ command: 'semble', execImpl: enoent }).search({
        repoPath: '/r',
        query: 'q',
      }),
    ).toEqual({ status: 'degraded' });

    const crash: SembleExec = async () => {
      throw new Error('semble crashed mid-search');
    };
    expect(
      await createSembleClient({ command: 'semble', execImpl: crash }).search({
        repoPath: '/r',
        query: 'q',
      }),
    ).toEqual({ status: 'degraded' });
  });

  it('search() returns an honest empty (not degraded) for an empty query', async () => {
    const exec: SembleExec = async () => ({ stdout: '[]', stderr: '' });
    expect(
      await createSembleClient({ command: 'c', execImpl: exec }).search({
        repoPath: '/r',
        query: '   ',
      }),
    ).toEqual({ status: 'ok', hits: [] });
  });
});

describe('semble service — done-time linking', () => {
  it('searchForItem reports unavailable when Semble is not configured', async () => {
    const { backend, projects, items, drift, project } = await setup();
    try {
      const enoent: SembleExec = async () => {
        const e = new Error('ENOENT') as Error & { code?: string };
        e.code = 'ENOENT';
        throw e;
      };
      const semble = createSembleService({
        db: backend.db,
        projects,
        items,
        client: createSembleClient({ command: 'semble', execImpl: enoent }),
        anthropic: unavailableAnthropic(),
      });
      const item = items.create({ project_id: project.id, title: 'add upload validation' });
      const res = await semble.searchForItem(item.id);
      expect(res).toEqual({ candidates: [], available: false, status: 'unavailable' });
      void drift;
    } finally {
      await backend.cleanup();
    }
  });

  it('searchForItem discloses degraded — a present-but-broken search is NOT a healthy empty (SF4-01)', async () => {
    const { backend, projects, items, project } = await setup();
    try {
      // The binary is present (--version succeeds → probe 'available') but the search
      // itself crashes. Pre-fix this surfaced as { available: true, candidates: [] } —
      // "search worked, nothing here". It must now disclose 'degraded'.
      const brokenSearch: SembleExec = async (_c, args) => {
        if (args[0] === '--version') return { stdout: 'semble 1', stderr: '' };
        throw new Error('semble search crashed');
      };
      const semble = createSembleService({
        db: backend.db,
        projects,
        items,
        client: createSembleClient({ command: 'semble', execImpl: brokenSearch }),
        anthropic: unavailableAnthropic(),
      });
      const item = items.create({ project_id: project.id, title: 'add upload validation' });
      const res = await semble.searchForItem(item.id);
      expect(res).toEqual({ candidates: [], available: false, status: 'degraded' });
    } finally {
      await backend.cleanup();
    }
  });

  it('confirm → item_code_refs row + audit; list; remove; tier-3 then fires', async () => {
    const { backend, projects, items, drift, project } = await setup();
    try {
      const exec: SembleExec = async (_c, args) =>
        args[0] === '--version'
          ? { stdout: 'semble 1', stderr: '' }
          : {
              stdout: JSON.stringify([
                { path: 'src/upload.ts', line_start: 5, line_end: 9, snippet: 'validate()' },
              ]),
              stderr: '',
            };
      const semble = createSembleService({
        db: backend.db,
        projects,
        items,
        client: createSembleClient({ command: 'semble', execImpl: exec }),
        anthropic: unavailableAnthropic(),
      });
      // F6-01: tier-3 badges only DONE items, so this item must be done for the badge to
      // fire below (it previously asserted a badge on a non-done item — the F6-01 bug).
      const item = items.create({ project_id: project.id, title: 'upload validation', status: 'done' });

      const search = await semble.searchForItem(item.id);
      expect(search.available).toBe(true);
      expect(search.candidates[0]?.path).toBe('src/upload.ts');

      // Tier-3 is dormant with no refs.
      runTier3(backend.db, drift, project.id, fakePull(1), ['src/upload.ts'], ['done']);
      expect(
        backend.db
          .prepare("SELECT COUNT(*) AS n FROM drift_signals WHERE category = 'tier-3'")
          .get(),
      ).toEqual({ n: 0 });

      const confirmed = semble.confirmRefs(item.id, {
        refs: [{ path: 'src/upload.ts', line_start: 5, line_end: 9, summary: 'validate' }],
      });
      expect(confirmed).toHaveLength(1);
      expect(semble.listRefs(item.id)).toHaveLength(1);

      const audit = backend.db
        .prepare(
          "SELECT trigger_context_json FROM audit_log WHERE entity_id = ? AND field = 'code_ref' AND new_value IS NOT NULL",
        )
        .get(item.id) as { trigger_context_json: string };
      expect(JSON.parse(audit.trigger_context_json).source).toBe('semble');

      // Now tier-3 fires: a PR touching the referenced file badges the (done) item.
      runTier3(backend.db, drift, project.id, fakePull(2), ['src/upload.ts'], ['done']);
      const sig = backend.db
        .prepare(
          "SELECT item_id FROM drift_signals WHERE category = 'tier-3' AND item_id = ?",
        )
        .get(item.id) as { item_id: string } | undefined;
      expect(sig?.item_id).toBe(item.id);

      semble.removeRef(item.id, confirmed[0]!.id);
      expect(semble.listRefs(item.id)).toHaveLength(0);
    } finally {
      await backend.cleanup();
    }
  });
});

describe('semble service — code Q&A', () => {
  const searchExec: SembleExec = async (_c, args) =>
    args[0] === '--version'
      ? { stdout: 'semble 1', stderr: '' }
      : {
          stdout: JSON.stringify([
            { path: 'src/auth.ts', line_start: 1, line_end: 4, snippet: 'login()' },
          ]),
          stderr: '',
        };

  it('returns sources without an answer when Anthropic is unconfigured', async () => {
    const { backend, projects, items, project } = await setup();
    try {
      const semble = createSembleService({
        db: backend.db,
        projects,
        items,
        client: createSembleClient({ command: 'semble', execImpl: searchExec }),
        anthropic: unavailableAnthropic(),
      });
      const res = await semble.codeQa(project.id, 'where is login handled?');
      expect(res.status).toBe('available');
      expect(res.semble_available).toBe(true);
      expect(res.summarised).toBe(false);
      expect(res.answer).toBeNull();
      expect(res.sources[0]?.path).toBe('src/auth.ts');
    } finally {
      await backend.cleanup();
    }
  });

  it('summarises with Anthropic, records cost telemetry and an ai audit entry', async () => {
    const { backend, projects, items, project } = await setup();
    try {
      const semble = createSembleService({
        db: backend.db,
        projects,
        items,
        client: createSembleClient({ command: 'semble', execImpl: searchExec }),
        anthropic: stubAnthropic('Login is handled in src/auth.ts [1].'),
      });
      const res = await semble.codeQa(project.id, 'where is login handled?');
      expect(res.summarised).toBe(true);
      expect(res.answer).toContain('src/auth.ts');

      const cost = backend.db
        .prepare("SELECT feature FROM cost_telemetry WHERE feature = 'code_qa'")
        .all();
      expect(cost).toHaveLength(1);
      const audit = backend.db
        .prepare("SELECT actor FROM audit_log WHERE field = 'code_qa'")
        .get() as { actor: string };
      expect(audit.actor).toBe('ai');
    } finally {
      await backend.cleanup();
    }
  });

  it('reports semble_available false when the binary is absent', async () => {
    const { backend, projects, items, project } = await setup();
    try {
      const enoent: SembleExec = async () => {
        const e = new Error('ENOENT') as Error & { code?: string };
        e.code = 'ENOENT';
        throw e;
      };
      const semble = createSembleService({
        db: backend.db,
        projects,
        items,
        client: createSembleClient({ command: 'semble', execImpl: enoent }),
        anthropic: stubAnthropic('unused'),
      });
      const res = await semble.codeQa(project.id, 'anything');
      expect(res).toEqual({
        answer: null,
        sources: [],
        status: 'unavailable',
        semble_available: false,
        summarised: false,
      });
    } finally {
      await backend.cleanup();
    }
  });

  it('codeQa discloses degraded — a present-but-broken search is NOT a healthy empty (SF4-01)', async () => {
    const { backend, projects, items, project } = await setup();
    try {
      const brokenSearch: SembleExec = async (_c, args) => {
        if (args[0] === '--version') return { stdout: 'semble 1', stderr: '' };
        throw new Error('semble search crashed');
      };
      const semble = createSembleService({
        db: backend.db,
        projects,
        items,
        client: createSembleClient({ command: 'semble', execImpl: brokenSearch }),
        anthropic: stubAnthropic('unused'),
      });
      const res = await semble.codeQa(project.id, 'where is login handled?');
      expect(res).toEqual({
        answer: null,
        sources: [],
        status: 'degraded',
        semble_available: false,
        summarised: false,
      });
    } finally {
      await backend.cleanup();
    }
  });
});
