import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProjectsService } from '../src/projects/service.js';
import { createItemsService } from '../src/items/service.js';
import { createLibraryService } from '../src/library/service.js';
import { createDumpZoneService } from '../src/dump-zone/service.js';
import {
  createAnthropicExtractor,
  createHeuristicExtractor,
  createRoutingExtractor,
} from '../src/dump-zone/extractor.js';
import { createCodeTodoService } from '../src/code-todo/service.js';
import { scanRepo } from '../src/code-todo/scanner.js';
import type { AnthropicClient } from '../src/ai/anthropic.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantFreeform(methodologiesDir: string): void {
  const target = join(methodologiesDir, 'freeform');
  mkdirSync(target, { recursive: true });
  copyFileSync(FREEFORM_BUNDLE_PATH, join(target, 'bundle.md'));
}

function unavailableClient(): AnthropicClient {
  return {
    available: () => false,
    call: async () => {
      throw new Error('not configured');
    },
  };
}

function plantRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), 'throughline-repo-'));
  writeFileSync(join(repo, 'a.ts'), 'function x() {\n  // TODO: fix this\n  return 1;\n}\n', 'utf8');
  writeFileSync(
    join(repo, 'b.ts'),
    '// FIXME: leak\nconst y = 2;\n// XXX: nasty hack\n// unrelated comment\n',
    'utf8',
  );
  mkdirSync(join(repo, 'node_modules'));
  writeFileSync(join(repo, 'node_modules', 'ignored.ts'), '// TODO: skip me\n', 'utf8');
  return repo;
}

describe('code-todo scanner', () => {
  it('walks the repo, skips node_modules, picks up TODO/FIXME/XXX with file:line', () => {
    const repo = plantRepo();
    const result = scanRepo(repo);
    const paths = new Set(result.matches.map((m) => m.path));
    expect(paths.has('a.ts')).toBe(true);
    expect(paths.has('b.ts')).toBe(true);
    // node_modules ignored
    expect(result.matches.find((m) => m.path.includes('node_modules'))).toBeUndefined();
    expect(result.matches.filter((m) => m.pattern === 'TODO:')).toHaveLength(1);
    expect(result.matches.filter((m) => m.pattern === 'FIXME:')).toHaveLength(1);
    expect(result.matches.filter((m) => m.pattern === 'XXX:')).toHaveLength(1);
  });

  it('skips symlinks rather than following them (no infinite recursion on ancestor links)', () => {
    const repo = plantRepo();
    // Create a directory symlink pointing back at the repo root. A naive walk that follows
    // this link will recurse forever; the scanner must skip symbolic entries.
    symlinkSync(repo, join(repo, 'self-link'), 'dir');
    // Also a file-targeted symlink: should be skipped (we don't follow files into the
    // symlink target either, since the source-of-truth path is what matters for matches).
    symlinkSync(join(repo, 'a.ts'), join(repo, 'a-alias.ts'));
    const result = scanRepo(repo);
    // Only the original a.ts contributes a TODO; the alias is skipped.
    expect(result.matches.filter((m) => m.pattern === 'TODO:')).toHaveLength(1);
    expect(result.matches.find((m) => m.path === 'a-alias.ts')).toBeUndefined();
    // Self-link did not cause runaway recursion: result returned in finite time.
    expect(result.matches.find((m) => m.path.startsWith('self-link'))).toBeUndefined();
  });
});

describe('code-todo service', () => {
  it('scan() creates a dump-zone proposal containing one item per match', async () => {
    const cfg = makeTmpConfig();
    plantFreeform(cfg.methodologiesDir);
    const backend = await makeBackend(cfg);
    const projects = createProjectsService(backend.db, backend.registry);
    const items = createItemsService(backend.db, projects, backend.registry);
    const library = createLibraryService(backend.db, projects);
    const extractor = createRoutingExtractor({
      anthropic: createAnthropicExtractor({ client: unavailableClient() }),
      heuristic: createHeuristicExtractor(),
      client: unavailableClient(),
    });
    const dumpZone = createDumpZoneService({
      db: backend.db,
      projects,
      registry: backend.registry,
      items,
      library,
      extractor,
    });
    const codeTodo = createCodeTodoService({ db: backend.db, projects, dumpZone });
    const repo = plantRepo();
    const project = projects.create({ name: 'demo', repo_path: repo });

    try {
      const result = await codeTodo.scan({ project_id: project.id });
      expect(result.match_count).toBe(3);
      const proposal = dumpZone.get(result.proposal_id);
      expect(proposal).toBeTruthy();
      expect(proposal!.payload.items.length).toBe(3);
      // proposal source flagged 'code_todo'
      expect(proposal!.source).toBe('code_todo');

      // code_todo_scans row written
      const scans = backend.db
        .prepare('SELECT * FROM code_todo_scans WHERE project_id = ?')
        .all(project.id) as Array<{ match_count: number; patterns_json: string }>;
      expect(scans).toHaveLength(1);
      expect(scans[0]!.match_count).toBe(3);
      const patterns = JSON.parse(scans[0]!.patterns_json) as string[];
      expect(patterns).toEqual(['TODO:', 'FIXME:', 'XXX:']);
    } finally {
      await backend.cleanup();
    }
  });
});
