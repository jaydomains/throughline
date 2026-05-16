import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createProjectsService } from '../src/projects/service.js';
import { createItemsService } from '../src/items/service.js';
import { createDriftService } from '../src/drift/service.js';
import { createDisciplineDriftEngine } from '../src/methodology/drift/discipline/engine.js';
import { createGateRuntime } from '../src/methodology/gates/runtime.js';
import { createAnthropicJudgementGate } from '../src/methodology/gates/judgement.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const TEST_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'test-bundle', 'bundle.md');
const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantBundle(methodologiesDir: string, id: string, srcPath: string): void {
  const target = join(methodologiesDir, id);
  mkdirSync(target, { recursive: true });
  copyFileSync(srcPath, join(target, 'bundle.md'));
}

function makeRepo(dir: string, opts: { banned?: boolean; missingNotes?: boolean } = {}): string {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SPEC.md'), opts.banned ? '# Spec\nTODO: finish this\n' : '# Spec\nclean\n');
  if (!opts.missingNotes) writeFileSync(join(dir, 'NOTES.md'), '# Notes\nA-D1\nstatus: active\n');
  mkdirSync(join(dir, 'docs', '_meta'), { recursive: true });
  mkdirSync(join(dir, 'docs', 'handovers'), { recursive: true });
  return dir;
}

const judgement = createAnthropicJudgementGate({
  client: {
    available: () => false,
    call: async () => ({ text: '', input_tokens: 0, output_tokens: 0, stop_reason: null }),
  },
});

async function setup(repoOpts: { banned?: boolean; missingNotes?: boolean } = {}) {
  const cfg = makeTmpConfig();
  plantBundle(cfg.methodologiesDir, 'test-bundle', TEST_BUNDLE_PATH);
  plantBundle(cfg.methodologiesDir, 'freeform', FREEFORM_BUNDLE_PATH);
  const backend = await makeBackend(cfg);
  const repoPath = makeRepo(join(cfg.dataDir, 'repo'), repoOpts);
  const projects = createProjectsService(backend.db, backend.registry);
  const drift = createDriftService(backend.db);
  const engine = createDisciplineDriftEngine({
    db: backend.db,
    projects,
    registry: backend.registry,
    drift,
    watch: false,
  });
  const runtime = createGateRuntime({
    db: backend.db,
    projects,
    registry: backend.registry,
    judgement,
    onMoment: (projectId, moment) => {
      if (moment === 'pre-write') engine.runScan(projectId, new Set(['pre-write']));
    },
  });
  const items = createItemsService(backend.db, projects, backend.registry);
  const project = projects.create({ name: 'tb', repo_path: repoPath, bundle_id: 'test-bundle' });
  return { backend, cfg, projects, drift, engine, runtime, items, project, repoPath };
}

describe('Phase 9 — discipline-drift engine (C-D7)', () => {
  it('instantiates scanners from the bundle validation-rules section and file-change fires them', async () => {
    const { backend, cfg, engine, drift, project } = await setup({ banned: true });
    try {
      engine.runScan(project.id, new Set(['file-change']));
      const groups = drift.disciplineGroups(project.id).groups;
      const banned = groups.find((g) => g.category === 'banned-strings');
      expect(banned).toBeDefined();
      expect(banned!.signals.length).toBeGreaterThan(0);
      expect(banned!.signals[0]!.reason).toContain('TODO');
      // banned_string has no file→unit linkage — project-scoped (item/unit null).
      expect(banned!.signals[0]!.item_id).toBeNull();
      expect(banned!.signals[0]!.primary_unit_ref).toBeNull();
      // Only file-change categories ran; the pre-write structural one did not.
      expect(groups.find((g) => g.category === 'structural-conformance')).toBeUndefined();
    } finally {
      await backend.cleanup();
      cfg.cleanup();
    }
  });

  it('pre-write moment also fires the write-time scanners via the gate dispatch', async () => {
    const { backend, cfg, runtime, drift, project } = await setup({ missingNotes: true });
    try {
      await runtime.runMoment(project.id, 'pre-write');
      const structural = drift
        .disciplineGroups(project.id)
        .groups.find((g) => g.category === 'structural-conformance');
      expect(structural).toBeDefined();
      expect(structural!.signals.some((s) => s.reason.includes('missing required file'))).toBe(true);
    } finally {
      await backend.cleanup();
      cfg.cleanup();
    }
  });

  it('cross_reference signals scope to the citing item and its primary units', async () => {
    const { backend, cfg, engine, drift, items, project } = await setup();
    try {
      const item = items.create({
        project_id: project.id,
        title: 'cites a dangling anchor',
        methodology_context: { anchor_citations: ['A-D9'], primary_unit_refs: ['auth'] },
      });
      engine.runScan(project.id, new Set(['manual']));
      const group = drift
        .disciplineGroups(project.id)
        .groups.find((g) => g.category === 'anchor-resolution');
      expect(group).toBeDefined();
      const signal = group!.signals.find((s) => s.item_id === item.id);
      expect(signal).toBeDefined();
      expect(signal!.reason).toContain('A-D9');

      // Item inherits the indicator (directly + via its primary unit).
      expect(items.get(item.id)!.methodology_drift).toBe(true);
      expect(drift.itemIdsWithDisciplineDrift(project.id).has(item.id)).toBe(true);
      // Modules badge counts the unit the citing item belongs to.
      expect(items.modules(project.id).modules.find((m) => m.ref === 'auth')!.drift_signal_count)
        .toBeGreaterThan(0);
    } finally {
      await backend.cleanup();
      cfg.cleanup();
    }
  });

  it('is idempotent and dismisses signals that no longer reproduce', async () => {
    const { backend, cfg, engine, drift, project, repoPath } = await setup({ banned: true });
    try {
      engine.runScan(project.id, new Set(['file-change']));
      const first = drift.listOpenDisciplineSignals(project.id, 'banned-strings');
      expect(first.length).toBeGreaterThan(0);

      // Re-scan over identical state: no churn (same open set, no duplicates).
      engine.runScan(project.id, new Set(['file-change']));
      const second = drift.listOpenDisciplineSignals(project.id, 'banned-strings');
      expect(second.map((s) => s.id).sort()).toEqual(first.map((s) => s.id).sort());

      // Fix the file: the signal stops reproducing and is dismissed.
      writeFileSync(join(repoPath, 'SPEC.md'), '# Spec\nclean\n');
      engine.runScan(project.id, new Set(['file-change']));
      expect(drift.listOpenDisciplineSignals(project.id, 'banned-strings')).toHaveLength(0);
    } finally {
      await backend.cleanup();
      cfg.cleanup();
    }
  });

  it('freeform-bound projects are a verified no-op', async () => {
    const { backend, cfg, projects, engine, drift } = await setup();
    try {
      const ff = projects.create({
        name: 'ff',
        repo_path: makeRepo(join(cfg.dataDir, 'ff-repo'), { banned: true }),
        bundle_id: 'freeform',
      });
      engine.runScan(ff.id, new Set(['file-change', 'pre-write', 'manual']));
      expect(drift.disciplineGroups(ff.id).groups).toHaveLength(0);
      expect(drift.listOpenDisciplineSignals(ff.id)).toHaveLength(0);
    } finally {
      await backend.cleanup();
      cfg.cleanup();
    }
  });

  it('bundle re-load tears down signals for categories the new bundle no longer declares', async () => {
    const { backend, cfg, engine, drift, project } = await setup({ banned: true });
    try {
      engine.runScan(project.id, new Set(['file-change']));
      expect(drift.listOpenDisciplineSignals(project.id, 'banned-strings').length).toBeGreaterThan(0);

      // Swap the project's bundle to one that declares no drift categories, then reload.
      backend.db
        .prepare("UPDATE projects SET bundle_id = 'freeform' WHERE id = ?")
        .run(project.id);
      engine.reloadForBundle('freeform', [project.id]);

      expect(drift.listOpenDisciplineSignals(project.id)).toHaveLength(0);
    } finally {
      await backend.cleanup();
      cfg.cleanup();
    }
  });
});
