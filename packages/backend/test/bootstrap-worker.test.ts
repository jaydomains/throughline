import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBootstrapWorker,
  readBootstrapState,
  type BootstrapWorkerOptions,
} from '../src/bootstrap/worker.js';
import {
  BootstrapValidationFailedError,
  BootstrapNoBundleBoundError,
  BootstrapProjectNotFoundError,
  type BootstrapImportResult,
  type BootstrapImportService,
} from '../src/bootstrap/service.js';

// C-D21 surface 4 — archive on success, quarantine on failure. Worker
// calls BootstrapImportService.importBootstrap directly (no HTTP self-call,
// inbox precedent). Tests use a stub BootstrapImportService to drive every
// branch (success / validation_failed / no_bundle_bound / project_not_found /
// unexpected throw / parse fail / read fail / file vanished).

interface StubImportService {
  service: BootstrapImportService;
  calls: Array<{ projectId: string; input: unknown }>;
  setHandler(handler: (projectId: string, input: unknown) => BootstrapImportResult): void;
}

function stubImportService(): StubImportService {
  const calls: Array<{ projectId: string; input: unknown }> = [];
  let handler: (projectId: string, input: unknown) => BootstrapImportResult = (projectId) => ({
    project_id: projectId,
    rows: [],
    counts: { new: 0, reimported: 0, conflict: 0, stale_flagged: 0 },
  });
  const service: BootstrapImportService = {
    importBootstrap(projectId, input) {
      calls.push({ projectId, input });
      return handler(projectId, input);
    },
    listConflicts() {
      throw new Error('unused');
    },
    resolveConflicts() {
      throw new Error('unused');
    },
  };
  return {
    service,
    calls,
    setHandler(h) {
      handler = h;
    },
  };
}

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'bootstrap-worker-'));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

function makeRepo(name: string, content: string | null = null): {
  repoPath: string;
  throughlineDir: string;
  outputPath: string;
  archiveDir: string;
  quarantineDir: string;
} {
  const repoPath = join(tmpRoot, name);
  const throughlineDir = join(repoPath, '.throughline');
  mkdirSync(throughlineDir, { recursive: true });
  const outputPath = join(throughlineDir, 'bootstrap-output.json');
  if (content !== null) writeFileSync(outputPath, content, 'utf8');
  return {
    repoPath,
    throughlineDir,
    outputPath,
    archiveDir: join(throughlineDir, 'bootstrap-archive'),
    quarantineDir: join(throughlineDir, 'bootstrap-quarantine'),
  };
}

function silentLogger(): NonNullable<BootstrapWorkerOptions['logger']> {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

describe('bootstrap worker — archive on success', () => {
  it('moves a successfully-ingested file into bootstrap-archive/ with an ISO timestamp prefix', async () => {
    const importer = stubImportService();
    importer.setHandler((projectId) => ({
      project_id: projectId,
      rows: [],
      counts: { new: 3, reimported: 1, conflict: 0, stale_flagged: 0 },
    }));
    const worker = createBootstrapWorker({ importService: importer.service, logger: silentLogger() });
    const { outputPath, archiveDir, throughlineDir } = makeRepo('a', '{"version":1}');

    worker.enqueue('proj-a', outputPath);
    await worker.drain();

    // Original file is gone.
    expect(existsSync(outputPath)).toBe(false);
    // Archive dir was lazy-created and contains exactly one ingested file.
    expect(existsSync(archiveDir)).toBe(true);
    const entries = readdirSync(archiveDir);
    expect(entries).toHaveLength(1);
    // ISO timestamp prefix + a uniqueness suffix (nanoid, S1-01), then the filename.
    expect(entries[0]).toMatch(/^[\w-]+-bootstrap-output\.json$/);
    // Importer was called with the parsed JSON.
    expect(importer.calls).toEqual([{ projectId: 'proj-a', input: { version: 1 } }]);
    // last-ingest cache populated.
    const last = worker.getLastIngest('proj-a');
    expect(last).not.toBeNull();
    expect(last!.counts).toEqual({ new: 3, reimported: 1, conflict: 0, stale_flagged: 0 });
    // No quarantine subdir created on success.
    expect(existsSync(join(throughlineDir, 'bootstrap-quarantine'))).toBe(false);
  });

  it('archive subdir is lazy-created only on first successful ingest', async () => {
    const importer = stubImportService();
    const worker = createBootstrapWorker({ importService: importer.service, logger: silentLogger() });
    const { throughlineDir, outputPath } = makeRepo('b');

    expect(existsSync(join(throughlineDir, 'bootstrap-archive'))).toBe(false);

    writeFileSync(outputPath, '{"version":1}', 'utf8');
    worker.enqueue('proj-b', outputPath);
    await worker.drain();

    expect(existsSync(join(throughlineDir, 'bootstrap-archive'))).toBe(true);
  });
});

describe('bootstrap worker — quarantine on failure', () => {
  it('parse-failed file moves to bootstrap-quarantine/ with a sibling .error.json', async () => {
    const importer = stubImportService();
    const worker = createBootstrapWorker({ importService: importer.service, logger: silentLogger() });
    const { outputPath, quarantineDir } = makeRepo('c', '{not valid json');

    worker.enqueue('proj-c', outputPath);
    await worker.drain();

    expect(existsSync(outputPath)).toBe(false);
    expect(existsSync(quarantineDir)).toBe(true);

    const files = readdirSync(quarantineDir);
    expect(files).toHaveLength(2);
    const jsonFile = files.find((f) => f.endsWith('-bootstrap-output.json'))!;
    const errorFile = files.find((f) => f.endsWith('-bootstrap-output.error.json'))!;
    expect(jsonFile).toBeDefined();
    expect(errorFile).toBeDefined();

    const errorPayload = JSON.parse(readFileSync(join(quarantineDir, errorFile), 'utf8'));
    expect(errorPayload.error).toBe('parse_failed');
    expect(errorPayload.project_id).toBe('proj-c');
    expect(errorPayload.received_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // Importer was NOT called since parsing failed before reaching it.
    expect(importer.calls).toEqual([]);
    // last-ingest cache not touched.
    expect(worker.getLastIngest('proj-c')).toBeNull();
  });

  it('validation_failed throws are quarantined with the validator errors in the .error.json', async () => {
    const importer = stubImportService();
    importer.setHandler(() => {
      throw new BootstrapValidationFailedError([
        { path: 'items[0].type', message: 'unknown type "foo"' },
      ]);
    });
    const worker = createBootstrapWorker({ importService: importer.service, logger: silentLogger() });
    const { outputPath, quarantineDir } = makeRepo('d', '{"version":1}');

    worker.enqueue('proj-d', outputPath);
    await worker.drain();

    const files = readdirSync(quarantineDir);
    const errorFile = files.find((f) => f.endsWith('.error.json'))!;
    const errorPayload = JSON.parse(readFileSync(join(quarantineDir, errorFile), 'utf8'));

    expect(errorPayload.error).toBe('validation_failed');
    expect(errorPayload.errors).toEqual([{ path: 'items[0].type', message: 'unknown type "foo"' }]);
    expect(errorPayload.project_id).toBe('proj-d');
  });

  it('no_bundle_bound throws (project lost binding mid-flight) land in quarantine with a clear message', async () => {
    const importer = stubImportService();
    importer.setHandler(() => {
      throw new BootstrapNoBundleBoundError('proj-e');
    });
    const worker = createBootstrapWorker({ importService: importer.service, logger: silentLogger() });
    const { outputPath, quarantineDir } = makeRepo('e', '{"version":1}');

    worker.enqueue('proj-e', outputPath);
    await worker.drain();

    const files = readdirSync(quarantineDir);
    const errorFile = files.find((f) => f.endsWith('.error.json'))!;
    const errorPayload = JSON.parse(readFileSync(join(quarantineDir, errorFile), 'utf8'));

    expect(errorPayload.error).toBe('no_bundle_bound');
    expect(errorPayload.message).toContain('proj-e');
  });

  it('project_not_found throws (project deleted mid-flight) land in quarantine with a clear message', async () => {
    const importer = stubImportService();
    importer.setHandler(() => {
      throw new BootstrapProjectNotFoundError('proj-gone');
    });
    const worker = createBootstrapWorker({ importService: importer.service, logger: silentLogger() });
    const { outputPath, quarantineDir } = makeRepo('f', '{"version":1}');

    worker.enqueue('proj-gone', outputPath);
    await worker.drain();

    const files = readdirSync(quarantineDir);
    const errorFile = files.find((f) => f.endsWith('.error.json'))!;
    const errorPayload = JSON.parse(readFileSync(join(quarantineDir, errorFile), 'utf8'));

    expect(errorPayload.error).toBe('project_not_found');
  });

  it('unexpected throws land in quarantine with the generic `ingest_failed` envelope', async () => {
    const importer = stubImportService();
    importer.setHandler(() => {
      throw new Error('database is locked');
    });
    const worker = createBootstrapWorker({ importService: importer.service, logger: silentLogger() });
    const { outputPath, quarantineDir } = makeRepo('g', '{"version":1}');

    worker.enqueue('proj-g', outputPath);
    await worker.drain();

    const files = readdirSync(quarantineDir);
    const errorFile = files.find((f) => f.endsWith('.error.json'))!;
    const errorPayload = JSON.parse(readFileSync(join(quarantineDir, errorFile), 'utf8'));

    expect(errorPayload.error).toBe('ingest_failed');
    expect(errorPayload.message).toBe('database is locked');
  });
});

describe('bootstrap worker — edge cases', () => {
  it('tolerates a file that vanished between enqueue and drain (no quarantine, no throw)', async () => {
    const importer = stubImportService();
    const worker = createBootstrapWorker({ importService: importer.service, logger: silentLogger() });
    const { outputPath, quarantineDir, archiveDir } = makeRepo('h', '{"version":1}');

    worker.enqueue('proj-h', outputPath);
    // Simulate the user wiping `.throughline/` between watcher event and
    // drain (rapid manual cleanup).
    rmSync(outputPath, { force: true });
    await worker.drain();

    expect(existsSync(archiveDir)).toBe(false);
    expect(existsSync(quarantineDir)).toBe(false);
    expect(importer.calls).toEqual([]);
  });

  it('enqueue is idempotent: duplicate paths are not re-processed', async () => {
    const importer = stubImportService();
    const worker = createBootstrapWorker({ importService: importer.service, logger: silentLogger() });
    const { outputPath } = makeRepo('i', '{"version":1}');

    worker.enqueue('proj-i', outputPath);
    worker.enqueue('proj-i', outputPath);
    worker.enqueue('proj-i', outputPath);
    await worker.drain();

    expect(importer.calls).toHaveLength(1);
  });

  it('S1-01: two quarantines within the same clock tick get distinct filenames (no collision)', async () => {
    const importer = stubImportService();
    const worker = createBootstrapWorker({ importService: importer.service, logger: silentLogger() });
    const { outputPath, quarantineDir } = makeRepo('collide', '{not valid json');

    // Freeze the clock so both quarantines share the same ISO timestamp. Pre-S1-01 the
    // filename was timestamp-only, so the second quarantine clobbered the first; the
    // nanoid suffix now keeps them distinct.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-31T12:00:00.000Z'));
    try {
      worker.enqueue('proj-collide', outputPath);
      await worker.drain();
      writeFileSync(outputPath, '{also not valid', 'utf8');
      worker.enqueue('proj-collide', outputPath);
      await worker.drain();
    } finally {
      vi.useRealTimers();
    }

    const markers = readdirSync(quarantineDir).filter((f) =>
      f.endsWith('-bootstrap-output.error.json'),
    );
    expect(markers).toHaveLength(2);
  });

  it('drains multiple distinct projects sequentially in enqueue order', async () => {
    const importer = stubImportService();
    const order: string[] = [];
    importer.setHandler((projectId) => {
      order.push(projectId);
      return {
        project_id: projectId,
        rows: [],
        counts: { new: 0, reimported: 0, conflict: 0, stale_flagged: 0 },
      };
    });
    const worker = createBootstrapWorker({ importService: importer.service, logger: silentLogger() });

    const a = makeRepo('drain-a', '{"version":1}');
    const b = makeRepo('drain-b', '{"version":1}');
    const c = makeRepo('drain-c', '{"version":1}');

    worker.enqueue('proj-a', a.outputPath);
    worker.enqueue('proj-b', b.outputPath);
    worker.enqueue('proj-c', c.outputPath);
    await worker.drain();

    expect(order).toEqual(['proj-a', 'proj-b', 'proj-c']);
  });
});

describe('readBootstrapState', () => {
  it('returns absent when .throughline/ does not exist', () => {
    const repoPath = join(tmpRoot, 'no-throughline');
    mkdirSync(repoPath, { recursive: true });

    const state = readBootstrapState(repoPath, null);
    expect(state.throughlineDir).toBe('absent');
    expect(state.promptRendered).toBe(false);
    expect(state.pendingOutput).toBe(false);
    expect(state.lastIngest).toBeNull();
    expect(state.archiveCount).toBe(0);
    expect(state.quarantineCount).toBe(0);
  });

  it('reports promptRendered when bootstrap-prompt.md exists', () => {
    const { repoPath, throughlineDir } = makeRepo('rendered');
    writeFileSync(join(throughlineDir, 'bootstrap-prompt.md'), '---\nbundle_path: x\n---', 'utf8');

    const state = readBootstrapState(repoPath, null);
    expect(state.throughlineDir).toBe('present');
    expect(state.promptRendered).toBe(true);
    expect(state.promptPath).toMatch(/bootstrap-prompt\.md$/);
  });

  it('reports pendingOutput when bootstrap-output.json is still un-processed on disk', () => {
    const { repoPath } = makeRepo('pending', '{"version":1}');

    const state = readBootstrapState(repoPath, null);
    expect(state.pendingOutput).toBe(true);
  });

  it('counts archive by the .json payload and quarantine by the .error.json marker — so a copy-failure quarantine is counted (SF1-03)', () => {
    const { repoPath, archiveDir, quarantineDir } = makeRepo('counts');
    mkdirSync(archiveDir, { recursive: true });
    mkdirSync(quarantineDir, { recursive: true });
    // Archive: two successful archives (payload only, no .error.json).
    writeFileSync(join(archiveDir, '2026-05-28T10-00-00Z-a1-bootstrap-output.json'), '{}');
    writeFileSync(join(archiveDir, '2026-05-28T10-05-00Z-a2-bootstrap-output.json'), '{}');
    // Quarantine #1 — copy succeeded: both the payload copy and the .error.json marker.
    writeFileSync(join(quarantineDir, '2026-05-28T10-10-00Z-q1-bootstrap-output.json'), '{}');
    writeFileSync(join(quarantineDir, '2026-05-28T10-10-00Z-q1-bootstrap-output.error.json'), '{}');
    // Quarantine #2 — copy FAILED: only the .error.json marker (the SF1-03 case). Pre-E7,
    // counting the .json payload missed this entirely and quarantineCount under-reported.
    writeFileSync(join(quarantineDir, '2026-05-28T10-20-00Z-q2-bootstrap-output.error.json'), '{}');

    const state = readBootstrapState(repoPath, null);
    expect(state.archiveCount).toBe(2);
    // Two quarantines (one copy-ok, one copy-failed) — both counted via their .error.json
    // marker. The copy-ok payload .json is not double-counted.
    expect(state.quarantineCount).toBe(2);
  });

  it('quarantine copy-failure leaves only the .error.json yet is still counted (SF1-03 / SF1-01 residual)', () => {
    const { repoPath, quarantineDir } = makeRepo('copyfail');
    mkdirSync(quarantineDir, { recursive: true });
    // Exactly the copy-failure on-disk state: an .error.json marker, no payload copy.
    writeFileSync(join(quarantineDir, '2026-05-28T11-00-00Z-z9-bootstrap-output.error.json'), '{}');
    const state = readBootstrapState(repoPath, null);
    expect(state.quarantineCount).toBe(1);
  });

  it('passes through the supplied lastIngest', () => {
    const { repoPath } = makeRepo('last');
    const ingest = {
      at: '2026-05-28T10:00:00.000Z',
      counts: { new: 5, reimported: 2, conflict: 1, stale_flagged: 0 },
    };
    const state = readBootstrapState(repoPath, ingest);
    expect(state.lastIngest).toEqual(ingest);
  });
});
