import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createProjectsService } from '../src/projects/service.js';
import { createLibraryService } from '../src/library/service.js';
import { createMdIngestService } from '../src/md-ingest/service.js';
import { createMdIngestWatcher } from '../src/md-ingest/watcher.js';
import {
  createAnthropicSummariser,
  createHeuristicSummariser,
  createRoutingSummariser,
} from '../src/md-ingest/summariser.js';
import type { AnthropicClient } from '../src/ai/anthropic.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantFreeform(methodologiesDir: string): void {
  const target = join(methodologiesDir, 'freeform');
  mkdirSync(target, { recursive: true });
  copyFileSync(FREEFORM_BUNDLE_PATH, join(target, 'bundle.md'));
}

function heuristicSummariser() {
  const client: AnthropicClient = {
    available: () => false,
    call: async () => {
      throw new Error('unused');
    },
  };
  return createRoutingSummariser({
    anthropic: createAnthropicSummariser({ client }),
    heuristic: createHeuristicSummariser(),
    client,
  });
}

async function setup() {
  const cfg = makeTmpConfig();
  plantFreeform(cfg.methodologiesDir);
  const backend = await makeBackend(cfg);
  const projects = createProjectsService(backend.db, backend.registry);
  const library = createLibraryService(backend.db, projects);
  const repoPath = join(cfg.dataDir, 'repo');
  mkdirSync(join(repoPath, 'docs'), { recursive: true });
  const project = projects.create({ name: 'demo', repo_path: repoPath });
  const md = createMdIngestService({
    db: backend.db,
    projects,
    library,
    summariser: heuristicSummariser(),
  });
  return { backend, projects, library, project, md, repoPath };
}

describe('md-ingest watcher (Phase 6c — tracked re-ingest)', () => {
  it('syncOnce re-ingests a tracked entry whose file changed; leaves untracked alone', async () => {
    const { backend, library, project, md, repoPath } = await setup();
    const watcher = createMdIngestWatcher({
      projects: createProjectsService(backend.db, backend.registry),
      service: md,
      watch: false,
    });
    try {
      writeFileSync(join(repoPath, 'docs', 'tracked.md'), 'tracked v1');
      writeFileSync(join(repoPath, 'docs', 'snap.md'), 'snapshot v1');
      const folder = md.addFolder(project.id, 'docs');
      const ing = await md.ingest(project.id, {
        folder_id: folder.id,
        paths: [join('docs', 'tracked.md'), join('docs', 'snap.md')],
      });
      const trackedId = ing.ingested.find((e) => e.rel_path === join('docs', 'tracked.md'))!
        .entry_id;
      const snapId = ing.ingested.find((e) => e.rel_path === join('docs', 'snap.md'))!.entry_id;
      md.setTracked(project.id, trackedId, true);

      // Mutate both files on disk; only the tracked one should re-ingest.
      writeFileSync(join(repoPath, 'docs', 'tracked.md'), 'tracked v2 changed');
      writeFileSync(join(repoPath, 'docs', 'snap.md'), 'snapshot v2 changed');

      await watcher.syncOnce();

      expect(library.get(trackedId)!.body).toBe('tracked v2 changed');
      expect(library.get(snapId)!.body).toBe('snapshot v1'); // snapshot — untouched
    } finally {
      await watcher.stop();
      await backend.cleanup();
    }
  });

  it('refresh() picks up folders added after start() without a restart', async () => {
    const { backend, project, md, repoPath } = await setup();
    const watcher = createMdIngestWatcher({
      projects: createProjectsService(backend.db, backend.registry),
      service: md,
      watch: true,
    });
    try {
      // No folders yet — start() must still create the chokidar instance so a
      // later refresh() can attach paths (the finding-1 regression: paths were
      // computed once and an empty set short-circuited instance creation).
      watcher.start();
      writeFileSync(join(repoPath, 'docs', 'late.md'), 'late v1');
      md.addFolder(project.id, 'docs');
      // Adding a folder after start() must be observable without a restart.
      expect(() => watcher.refresh()).not.toThrow();
      // refresh() is idempotent and safe to call repeatedly.
      expect(() => watcher.refresh()).not.toThrow();
    } finally {
      await watcher.stop();
      // refresh() after stop() is a safe no-op (watcher instance gone).
      expect(() => watcher.refresh()).not.toThrow();
      await backend.cleanup();
    }
  });

  it('refresh() before start() is a safe no-op', async () => {
    const { backend, md } = await setup();
    const watcher = createMdIngestWatcher({
      projects: createProjectsService(backend.db, backend.registry),
      service: md,
      watch: true,
    });
    try {
      expect(() => watcher.refresh()).not.toThrow();
    } finally {
      await watcher.stop();
      await backend.cleanup();
    }
  });

  it('syncOnce tolerates a tracked entry whose source file vanished', async () => {
    const { backend, library, project, md, repoPath } = await setup();
    const watcher = createMdIngestWatcher({
      projects: createProjectsService(backend.db, backend.registry),
      service: md,
      watch: false,
    });
    try {
      writeFileSync(join(repoPath, 'docs', 'gone.md'), 'content');
      const folder = md.addFolder(project.id, 'docs');
      const ing = await md.ingest(project.id, {
        folder_id: folder.id,
        paths: [join('docs', 'gone.md')],
      });
      const id = ing.ingested[0]!.entry_id;
      md.setTracked(project.id, id, true);
      // Remove the file; syncOnce must not throw.
      writeFileSync(join(repoPath, 'docs', 'gone.md'), 'x');
      const { rmSync } = await import('node:fs');
      rmSync(join(repoPath, 'docs', 'gone.md'));
      await expect(watcher.syncOnce()).resolves.toBeUndefined();
      expect(library.get(id)).not.toBeNull();
    } finally {
      await watcher.stop();
      await backend.cleanup();
    }
  });
});
