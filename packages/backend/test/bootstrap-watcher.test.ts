import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createBootstrapWatcherRegistry,
  type BootstrapWatcherRegistry,
  type BootstrapWorker,
} from '../src/bootstrap/watcher.js';
import type { Project } from '@throughline/shared';
import type { ProjectsService } from '../src/projects/service.js';

// C-D21 surface 3 — chokidar watcher on
// `<repo_path>/.throughline/bootstrap-output.json` per project. Tests use a
// stub BootstrapWorker (slice 3 lands the real one) and exercise the four
// lifecycle entry points: register, unregister, stop, startupScan, plus the
// file-pre-ready race coverage and the abandonment-leak acceptance.

interface RecordedEnqueue {
  projectId: string;
  filePath: string;
}

function createStubWorker(): BootstrapWorker & { enqueued: RecordedEnqueue[]; drains: number } {
  const enqueued: RecordedEnqueue[] = [];
  let drains = 0;
  const worker = {
    enqueued,
    get drains() {
      return drains;
    },
    enqueue(projectId: string, filePath: string) {
      enqueued.push({ projectId, filePath });
    },
    async drain() {
      drains += 1;
    },
  };
  return worker;
}

function stubProjectsList(projects: Project[]): ProjectsService {
  // Only `list` is exercised by startupScan; other methods are not used by
  // the watcher and would obscure the test surface if forced.
  return {
    list: () => projects,
  } as unknown as ProjectsService;
}

function makeProject(overrides: Partial<Project> & { id: string; repo_path: string | null }): Project {
  return {
    id: overrides.id,
    name: overrides.name ?? `project-${overrides.id}`,
    repo_path: overrides.repo_path,
    bundle_id: overrides.bundle_id ?? 'freeform',
    bundle_path: overrides.bundle_path ?? null,
    github_owner: overrides.github_owner ?? null,
    github_repo: overrides.github_repo ?? null,
    state: overrides.state ?? 'active',
    created_at: overrides.created_at ?? '2026-05-28T00:00:00.000Z',
    archived_at: overrides.archived_at ?? null,
  } as Project;
}

let tmpRoot: string;
let registries: BootstrapWatcherRegistry[] = [];

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'bootstrap-watcher-'));
  registries = [];
});

afterEach(async () => {
  // Close every registry created during the test, then remove the temp tree.
  for (const reg of registries) {
    try {
      await reg.stop();
    } catch {
      // already stopped
    }
  }
  rmSync(tmpRoot, { recursive: true, force: true });
});

function track(reg: BootstrapWatcherRegistry): BootstrapWatcherRegistry {
  registries.push(reg);
  return reg;
}

function makeRepo(name: string): { repoPath: string; throughlineDir: string; outputPath: string } {
  const repoPath = join(tmpRoot, name);
  const throughlineDir = join(repoPath, '.throughline');
  mkdirSync(throughlineDir, { recursive: true });
  return { repoPath, throughlineDir, outputPath: join(throughlineDir, 'bootstrap-output.json') };
}

describe('bootstrap watcher registry — lifecycle without chokidar', () => {
  it('register is idempotent: second register for same project is a no-op', () => {
    const worker = createStubWorker();
    const reg = track(createBootstrapWatcherRegistry({ worker, watch: false }));
    const { repoPath } = makeRepo('a');

    reg.register('proj-1', repoPath);
    reg.register('proj-1', repoPath);

    // No existing output file → no enqueues from either call.
    expect(worker.enqueued).toEqual([]);
  });

  it('register with no existing bootstrap-output.json does not enqueue', () => {
    const worker = createStubWorker();
    const reg = track(createBootstrapWatcherRegistry({ worker, watch: false }));
    const { repoPath } = makeRepo('b');

    reg.register('proj-2', repoPath);

    expect(worker.enqueued).toEqual([]);
  });

  it('register with existing bootstrap-output.json enqueues it synchronously (file-pre-ready race)', () => {
    const worker = createStubWorker();
    const reg = track(createBootstrapWatcherRegistry({ worker, watch: false }));
    const { repoPath, outputPath } = makeRepo('c');
    writeFileSync(outputPath, '{"version":1}', 'utf8');

    reg.register('proj-3', repoPath);

    // Enqueue happens before any chokidar event could fire — the registry
    // checks existence synchronously inside register().
    expect(worker.enqueued).toEqual([{ projectId: 'proj-3', filePath: outputPath }]);
  });

  it('unregister for an unknown project is a no-op (no throw)', async () => {
    const worker = createStubWorker();
    const reg = track(createBootstrapWatcherRegistry({ worker, watch: false }));

    await expect(reg.unregister('never-registered')).resolves.toBeUndefined();
  });

  it('unregister followed by re-register treats the project as fresh (no leaked stale enqueue)', async () => {
    const worker = createStubWorker();
    const reg = track(createBootstrapWatcherRegistry({ worker, watch: false }));
    const { repoPath, outputPath } = makeRepo('d');

    reg.register('proj-4', repoPath);
    await reg.unregister('proj-4');

    // Plant a bootstrap-output.json AFTER the project's first register-then-
    // unregister cycle. Re-register should pick it up as if for the first
    // time (idempotent guard is on the entries map, not a stale enqueue
    // suppression flag).
    writeFileSync(outputPath, '{"version":1}', 'utf8');
    reg.register('proj-4', repoPath);

    expect(worker.enqueued).toEqual([{ projectId: 'proj-4', filePath: outputPath }]);
  });

  it('stop is idempotent: a second call returns the same settled promise', async () => {
    const worker = createStubWorker();
    const reg = track(createBootstrapWatcherRegistry({ worker, watch: false }));

    const first = reg.stop();
    const second = reg.stop();
    expect(second).toBe(first);
    await expect(first).resolves.toBeUndefined();
  });

  it('register after stop is a no-op (no leaked watcher entry)', async () => {
    // Gitar PR #60 edge case: between stop()'s entries iteration and its
    // trailing entries.clear(), a late register() could insert an entry
    // whose chokidar instance would never be closed. Guarded by the
    // `stopping` flag — late registrations drop on the floor.
    const worker = createStubWorker();
    const reg = track(createBootstrapWatcherRegistry({ worker, watch: false }));
    const { repoPath, outputPath } = makeRepo('late');
    writeFileSync(outputPath, '{"version":1}', 'utf8');

    await reg.stop();
    reg.register('proj-late', repoPath);

    // No enqueue for the late-registered project's existing file.
    expect(worker.enqueued).toEqual([]);
  });

  it('startupScan registers each project with a repo_path; skips those without', async () => {
    const worker = createStubWorker();
    const reg = track(createBootstrapWatcherRegistry({ worker, watch: false }));
    const { repoPath: repoA, outputPath: outA } = makeRepo('e');
    const { repoPath: repoB } = makeRepo('f');
    writeFileSync(outA, '{"version":1}', 'utf8');

    const projects = stubProjectsList([
      makeProject({ id: 'proj-A', repo_path: repoA }),
      makeProject({ id: 'proj-no-repo', repo_path: null }),
      makeProject({ id: 'proj-B', repo_path: repoB }),
    ]);

    await reg.startupScan(projects);

    // proj-A had an existing output → enqueued. proj-no-repo skipped (no
    // repo_path). proj-B had no output → registered but no enqueue.
    expect(worker.enqueued).toEqual([{ projectId: 'proj-A', filePath: outA }]);
    // startupScan awaits one drain after registering all projects.
    expect(worker.drains).toBeGreaterThanOrEqual(1);
  });

  it('startupScan over an empty project set still resolves cleanly', async () => {
    const worker = createStubWorker();
    const reg = track(createBootstrapWatcherRegistry({ worker, watch: false }));

    await expect(reg.startupScan(stubProjectsList([]))).resolves.toBeUndefined();
    expect(worker.enqueued).toEqual([]);
  });
});

describe('bootstrap watcher registry — chokidar smoke', () => {
  // Chokidar event-delivery itself is a third-party library concern and is
  // unreliable to assert against in containerised CI environments (inotify
  // behaviour varies across layered filesystems). The existing methodology
  // loader and md-ingest watcher tests follow the same convention: smoke
  // tests that chokidar attaches without throwing and that stop() closes
  // cleanly; event-driven behaviour is verified end-to-end in the
  // verification section of the Phase 21 plan.

  it('register with watch:true attaches a chokidar instance without throwing; stop closes cleanly', async () => {
    const worker = createStubWorker();
    const reg = track(createBootstrapWatcherRegistry({ worker, watch: true }));
    const { repoPath } = makeRepo('g');

    expect(() => reg.register('proj-g', repoPath)).not.toThrow();
    await expect(reg.stop()).resolves.toBeUndefined();
  });

  it('unregister with watch:true closes the chokidar instance and is awaitable', async () => {
    const worker = createStubWorker();
    const reg = track(createBootstrapWatcherRegistry({ worker, watch: true }));
    const { repoPath } = makeRepo('h');

    reg.register('proj-h', repoPath);
    await expect(reg.unregister('proj-h')).resolves.toBeUndefined();

    // Re-register after unregister is allowed and creates a fresh instance.
    expect(() => reg.register('proj-h', repoPath)).not.toThrow();
  });
});
