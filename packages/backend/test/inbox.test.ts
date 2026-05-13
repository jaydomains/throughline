import { describe, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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
import type { AnthropicClient } from '../src/ai/anthropic.js';
import { createInboxWorker } from '../src/inbox/worker.js';
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

function ensureInboxDirs(cfg: { inboxDir: string; archiveDir: string; failuresDir: string }): void {
  mkdirSync(cfg.inboxDir, { recursive: true });
  mkdirSync(cfg.archiveDir, { recursive: true });
  mkdirSync(cfg.failuresDir, { recursive: true });
}

async function setup() {
  const cfg = makeTmpConfig();
  plantFreeform(cfg.methodologiesDir);
  ensureInboxDirs(cfg);
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
  const project = projects.create({ name: 'demo', repo_path: '/tmp/demo' });
  const worker = createInboxWorker({
    db: backend.db,
    projects,
    dumpZone,
    archiveDir: cfg.archiveDir,
    failuresDir: cfg.failuresDir,
    getLastActiveProjectId: () => project.id,
  });
  return { backend, cfg, project, worker, dumpZone };
}

describe('inbox worker', () => {
  it('routes a project-prefixed file, archives it on success, and stores a proposal', async () => {
    const { backend, cfg, project, worker, dumpZone } = await setup();
    try {
      const filename = `${project.id}__capture.md`;
      const filePath = join(cfg.inboxDir, filename);
      writeFileSync(filePath, 'a task\n\nanother task', 'utf8');
      worker.enqueue(filePath);
      await worker.drain();

      // proposal stored
      const proposals = dumpZone.listRecent(project.id);
      expect(proposals).toHaveLength(1);
      expect(proposals[0]!.payload.items.length).toBeGreaterThan(0);

      // original removed from inbox
      expect(existsSync(filePath)).toBe(false);

      // archive subdir created with the file
      const dayDirs = readdirSync(cfg.archiveDir);
      expect(dayDirs.length).toBeGreaterThan(0);
      const archived = join(cfg.archiveDir, dayDirs[0]!, filename);
      expect(existsSync(archived)).toBe(true);

      // queue row marked processed
      const queue = worker.listQueue();
      expect(queue[0]!.state).toBe('processed');

      // audit-log carries inbox_worker actor
      const audit = backend.db
        .prepare("SELECT field FROM audit_log WHERE actor = 'inbox_worker'")
        .all() as Array<{ field: string }>;
      expect(audit.some((r) => r.field === 'inbox_processed')).toBe(true);
    } finally {
      await backend.cleanup();
    }
  });

  it('quarantines an empty file with a sibling .error.json', async () => {
    const { backend, cfg, project, worker } = await setup();
    try {
      const filename = `${project.id}__blank.md`;
      const filePath = join(cfg.inboxDir, filename);
      writeFileSync(filePath, '   \n\n', 'utf8');
      worker.enqueue(filePath);
      await worker.drain();

      expect(existsSync(filePath)).toBe(false);
      const quarantined = join(cfg.failuresDir, filename);
      expect(existsSync(quarantined)).toBe(true);
      const errorPath = quarantined + '.error.json';
      expect(existsSync(errorPath)).toBe(true);
      const err = JSON.parse(readFileSync(errorPath, 'utf8')) as { error: string };
      expect(err.error).toBe('empty_file');

      const queue = worker.listQueue();
      expect(queue[0]!.state).toBe('failed');
    } finally {
      await backend.cleanup();
    }
  });

  it('quarantines when no project prefix matches and last-active is missing', async () => {
    const cfg = makeTmpConfig();
    plantFreeform(cfg.methodologiesDir);
    ensureInboxDirs(cfg);
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
    const worker = createInboxWorker({
      db: backend.db,
      projects,
      dumpZone,
      archiveDir: cfg.archiveDir,
      failuresDir: cfg.failuresDir,
      getLastActiveProjectId: () => null,
    });
    try {
      const filePath = join(cfg.inboxDir, 'orphan.md');
      writeFileSync(filePath, 'some content', 'utf8');
      worker.enqueue(filePath);
      await worker.drain();

      const queue = worker.listQueue();
      expect(queue[0]!.state).toBe('failed');
      expect(queue[0]!.error_text).toBe('no_project_routing');
    } finally {
      await backend.cleanup();
    }
  });

  it('idempotent enqueue: same queued path does not double-up', async () => {
    const { backend, cfg, project, worker } = await setup();
    try {
      const filename = `${project.id}__one.md`;
      const filePath = join(cfg.inboxDir, filename);
      writeFileSync(filePath, 'A', 'utf8');
      const id1 = worker.enqueue(filePath);
      const id2 = worker.enqueue(filePath);
      expect(id2).toBe(id1);
    } finally {
      await backend.cleanup();
    }
  });
});
