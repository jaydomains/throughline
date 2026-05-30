import { describe, expect, it, vi } from 'vitest';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createProjectsService } from '../src/projects/service.js';
import { createDriftService } from '../src/drift/service.js';
import { createDisciplineDriftEngine } from '../src/methodology/drift/discipline/engine.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

// SF2-01 regression. The engine reconciles a category's open signals against the current
// scan findings: anything not reproduced is dismissed as "no longer reproduces". Before
// the fix, a scanner that threw was swallowed to an empty finding set — indistinguishable
// from a clean repo — so a transient read error silently dismissed every real open signal
// for that category. The fix makes runDisciplineScan return a tagged result; an error
// result preserves the category's signals. This test drives both branches through the
// real engine with a controlled scan result.

vi.mock('../src/methodology/drift/discipline/scanners.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, runDisciplineScan: vi.fn() };
});

import { runDisciplineScan } from '../src/methodology/drift/discipline/scanners.js';
const mockScan = vi.mocked(runDisciplineScan);

const TEST_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'test-bundle', 'bundle.md');
const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantBundle(methodologiesDir: string, id: string, srcPath: string): void {
  const target = join(methodologiesDir, id);
  mkdirSync(target, { recursive: true });
  copyFileSync(srcPath, join(target, 'bundle.md'));
}

async function setup() {
  const cfg = makeTmpConfig();
  plantBundle(cfg.methodologiesDir, 'test-bundle', TEST_BUNDLE_PATH);
  plantBundle(cfg.methodologiesDir, 'freeform', FREEFORM_BUNDLE_PATH);
  const backend = await makeBackend(cfg);
  const repoPath = join(cfg.dataDir, 'repo');
  mkdirSync(repoPath, { recursive: true });
  writeFileSync(join(repoPath, 'SPEC.md'), '# Spec\nclean\n');
  writeFileSync(join(repoPath, 'NOTES.md'), '# Notes\nA-D1\nstatus: active\n');
  const projects = createProjectsService(backend.db, backend.registry);
  const drift = createDriftService(backend.db);
  const engine = createDisciplineDriftEngine({
    db: backend.db,
    projects,
    registry: backend.registry,
    drift,
    watch: false,
  });
  const project = projects.create({ name: 'tb', repo_path: repoPath, bundle_id: 'test-bundle' });
  return { backend, cfg, drift, engine, project };
}

const FINDING = { message: 'banned token', ref: 'SPEC.md', itemId: null, primaryUnitRef: null };

// First scan seeds one real signal on the banned-strings category; other categories clean.
function seedOneSignal(): void {
  mockScan.mockImplementation((_db, _pid, _repo, _bundle, category) =>
    category.name === 'banned-strings'
      ? { ok: true as const, findings: [FINDING] }
      : { ok: true as const, findings: [] },
  );
}

describe('SF2-01 — a scanner error must not dismiss the category’s open signals', () => {
  it('preserves open signals when the scanner errors (vs reconciling them away)', async () => {
    const { backend, cfg, drift, engine, project } = await setup();
    try {
      seedOneSignal();
      engine.runScan(project.id, new Set(['file-change']));
      const before = drift.listOpenDisciplineSignals(project.id, 'banned-strings');
      expect(before.length).toBe(1);

      // Now the banned-strings scanner throws (returned as an error result).
      mockScan.mockImplementation((_db, _pid, _repo, _bundle, category) =>
        category.name === 'banned-strings'
          ? { ok: false as const, error: new Error('EIO: transient read failure') }
          : { ok: true as const, findings: [] },
      );
      engine.runScan(project.id, new Set(['file-change']));

      const after = drift.listOpenDisciplineSignals(project.id, 'banned-strings');
      expect(after.length).toBe(1);
      expect(after[0]!.id).toBe(before[0]!.id);
    } finally {
      await backend.cleanup();
      cfg.cleanup();
    }
  });

  it('still dismisses on a genuine clean (empty success) scan — the distinction is the point', async () => {
    const { backend, cfg, drift, engine, project } = await setup();
    try {
      seedOneSignal();
      engine.runScan(project.id, new Set(['file-change']));
      expect(drift.listOpenDisciplineSignals(project.id, 'banned-strings').length).toBe(1);

      // A successful scan that reproduces nothing authoritatively reconciles the signal away.
      mockScan.mockImplementation(() => ({ ok: true as const, findings: [] }));
      engine.runScan(project.id, new Set(['file-change']));

      expect(drift.listOpenDisciplineSignals(project.id, 'banned-strings').length).toBe(0);
    } finally {
      await backend.cleanup();
      cfg.cleanup();
    }
  });
});
