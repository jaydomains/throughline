import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseBundle } from '../src/methodology/bundle-parser/index.js';
import { createItemsService, ItemPolicyError } from '../src/items/service.js';
import {
  BundleNotLoadedError,
  createProjectsService,
  InvalidBundlePathError,
} from '../src/projects/service.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const TEST_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'test-bundle', 'bundle.md');

function plantTestBundle(methodologiesDir: string): void {
  const target = join(methodologiesDir, 'test-bundle');
  mkdirSync(target, { recursive: true });
  copyFileSync(TEST_BUNDLE_PATH, join(target, 'bundle.md'));
}

async function setup() {
  const cfg = makeTmpConfig();
  plantTestBundle(cfg.methodologiesDir);
  const backend = await makeBackend(cfg);
  const projects = createProjectsService(backend.db, backend.registry);
  const items = createItemsService(backend.db, projects, backend.registry);
  const project = projects.create({ name: 'tb', repo_path: '/tmp/tb', bundle_id: 'test-bundle' });
  return { backend, projects, items, project };
}

describe('test-bundle fixture', () => {
  it('parses cleanly through the bundle loader', () => {
    const md = readFileSync(TEST_BUNDLE_PATH, 'utf8');
    const result = parseBundle('test-bundle', md);
    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    expect(result.bundle.identity.name).toBe('test-bundle');
    expect(result.bundle.project_layout.primary_unit?.name).toBe('component');
    // multi-gate per phase moment (T-D42): per-commit declares two independent gates
    expect(result.bundle.state_machine.gates_by_moment['per-commit']?.map((g) => g.id)).toEqual([
      'structure-check',
      'banned-string-sweep',
    ]);
    expect(result.bundle.state_machine.item_types.map((t) => t.id)).toEqual(['task', 'note']);
  });

  it('derives two boards with per-type status lifecycles (§7.5, C-D12)', async () => {
    const { backend, items, project } = await setup();
    try {
      const policy = items.policy(project.id);
      expect(policy.types).toEqual(['task', 'note']);
      expect(policy.boards.map((b) => ({ id: b.id, label: b.label }))).toEqual([
        { id: 'task', label: 'Tasks' },
        { id: 'note', label: 'Notes' },
      ]);
      expect(policy.statuses_by_type['task']).toEqual(['open', 'doing', 'blocked', 'done']);
      expect(policy.statuses_by_type['note']).toEqual(['draft', 'published']);
    } finally {
      await backend.cleanup();
    }
  });

  it('validates status against the item type lifecycle, not a shared pool', async () => {
    const { backend, items, project } = await setup();
    try {
      // a note cannot take a task-only status
      expect(() =>
        items.create({ project_id: project.id, title: 'n', type: 'note', status: 'doing' }),
      ).toThrow(ItemPolicyError);
      const task = items.create({ project_id: project.id, title: 't', type: 'task' });
      expect(task.status).toBe('open');
      const note = items.create({ project_id: project.id, title: 'n', type: 'note' });
      expect(note.status).toBe('draft');
      expect(() => items.update(note.id, { status: 'blocked' })).toThrow(ItemPolicyError);
    } finally {
      await backend.cleanup();
    }
  });

  it('F4-04 (verified-closed, C-D12 amended E17): a non-adjacent status jump is allowed — membership is enforced, transition adjacency is NOT', async () => {
    const { backend, items, project } = await setup();
    try {
      // task lifecycle: open, doing, blocked, done; declared transitions are
      // open->doing->blocked->doing->done->open. `open -> done` is a *member* status but NOT
      // a declared adjacent edge. Per the amended C-D12, create/update validate membership
      // only — so the direct jump must succeed (reconcile/auto-reconcile/dump-zone-apply rely
      // on this). Adjacency enforcement would wrongly reject it.
      const task = items.create({ project_id: project.id, title: 't', type: 'task' });
      expect(task.status).toBe('open');
      const jumped = items.update(task.id, { status: 'done' });
      expect(jumped.status).toBe('done'); // non-adjacent open->done accepted (membership-only)
      // A status outside the type's lifecycle is still rejected (membership IS enforced).
      expect(() => items.update(task.id, { status: 'archived' })).toThrow(ItemPolicyError);
    } finally {
      await backend.cleanup();
    }
  });

  it('round-trips methodology-context refs and audits context changes', async () => {
    const { backend, items, project } = await setup();
    try {
      const item = items.create({
        project_id: project.id,
        title: 't',
        type: 'task',
        methodology_context: { primary_unit_refs: ['alpha'], anchor_citations: ['A-D1'] },
      });
      expect(item.methodology_context.primary_unit_refs).toEqual(['alpha']);
      expect(item.methodology_context.anchor_citations).toEqual(['A-D1']);

      const updated = items.update(item.id, {
        methodology_context: { primary_unit_refs: ['alpha', 'beta'], marker_refs: ['[PENDING]'] },
      });
      // join loads refs ORDER BY column, so the round-trip is alphabetical
      expect(updated.methodology_context.primary_unit_refs).toEqual(['alpha', 'beta']);
      expect(updated.methodology_context.marker_refs).toEqual(['[PENDING]']);
      // anchor_citations untouched because not in the patch
      expect(updated.methodology_context.anchor_citations).toEqual(['A-D1']);

      const audit = backend.db
        .prepare("SELECT field FROM audit_log WHERE entity_type = 'item' AND entity_id = ?")
        .all(item.id) as Array<{ field: string }>;
      expect(audit.some((r) => r.field === 'primary_unit_refs')).toBe(true);
    } finally {
      await backend.cleanup();
    }
  });

  it('modules endpoint groups by primary unit with tier + counts (§7.11, C-D13)', async () => {
    const { backend, items, project } = await setup();
    try {
      items.create({
        project_id: project.id,
        title: 'a',
        type: 'task',
        methodology_context: { primary_unit_refs: ['parser'], phase_refs: ['active'], anchor_citations: ['A-D1'] },
      });
      items.create({
        project_id: project.id,
        title: 'b',
        type: 'task',
        methodology_context: { primary_unit_refs: ['parser'], phase_refs: ['review'] },
      });
      items.create({
        project_id: project.id,
        title: 'c',
        type: 'note',
        methodology_context: { primary_unit_refs: ['loader'], marker_refs: ['[REVIEW]'] },
      });

      const res = items.modules(project.id);
      expect(res.primary_unit_label).toBe('component');
      const parser = res.modules.find((m) => m.ref === 'parser')!;
      expect(parser.item_count).toBe(2);
      expect(parser.phases.sort()).toEqual(['active', 'review']);
      expect(parser.anchor_count).toBe(1);
      expect(parser.tier).toBe('tier-1'); // 2 items => tier-1 (<=2)
      const loader = res.modules.find((m) => m.ref === 'loader')!;
      expect(loader.marker_count).toBe(1);
    } finally {
      await backend.cleanup();
    }
  });

  it('resolves a bundle from an external bundle_path (C-D14)', async () => {
    const cfg = makeTmpConfig();
    const extDir = mkdtempSync(join(tmpdir(), 'throughline-extbundle-'));
    copyFileSync(TEST_BUNDLE_PATH, join(extDir, 'bundle.md'));
    const backend = await makeBackend(cfg); // methodologiesDir is empty here
    try {
      const projects = createProjectsService(backend.db, backend.registry);
      const items = createItemsService(backend.db, projects, backend.registry);
      const project = projects.create({
        name: 'ext',
        repo_path: '/tmp/ext',
        bundle_id: 'test-bundle',
        bundle_path: extDir,
      });
      expect(project.bundle_path).toBe(extDir);
      const policy = items.policy(project.id);
      expect(policy.types).toEqual(['task', 'note']);
      const note = items.create({ project_id: project.id, title: 'n', type: 'note' });
      expect(note.status).toBe('draft');
    } finally {
      await backend.cleanup();
      rmSync(extDir, { recursive: true, force: true });
    }
  });

  it('freeform projects report no primary unit from the modules endpoint', async () => {
    const cfg = makeTmpConfig();
    const ffPath = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');
    mkdirSync(join(cfg.methodologiesDir, 'freeform'), { recursive: true });
    copyFileSync(ffPath, join(cfg.methodologiesDir, 'freeform', 'bundle.md'));
    const backend = await makeBackend(cfg);
    try {
      const projects = createProjectsService(backend.db, backend.registry);
      const items = createItemsService(backend.db, projects, backend.registry);
      const project = projects.create({ name: 'ff', repo_path: '/tmp/ff' });
      const res = items.modules(project.id);
      expect(res.primary_unit_label).toBeNull();
      expect(res.modules).toEqual([]);
    } finally {
      await backend.cleanup();
    }
  });
});

describe('bundle_path hardening (C-D14)', () => {
  it('rejects a relative bundle_path', async () => {
    const cfg = makeTmpConfig();
    const backend = await makeBackend(cfg);
    try {
      const projects = createProjectsService(backend.db, backend.registry);
      expect(() =>
        projects.create({
          name: 'rel',
          repo_path: '/tmp/rel',
          bundle_id: 'test-bundle',
          bundle_path: 'relative/dir',
        }),
      ).toThrow(InvalidBundlePathError);
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects an absolute bundle_path containing parent traversal', async () => {
    const cfg = makeTmpConfig();
    const backend = await makeBackend(cfg);
    try {
      const projects = createProjectsService(backend.db, backend.registry);
      expect(() =>
        projects.create({
          name: 'trav',
          repo_path: '/tmp/trav',
          bundle_id: 'test-bundle',
          bundle_path: '/var/data/../../etc',
        }),
      ).toThrow(InvalidBundlePathError);
    } finally {
      await backend.cleanup();
    }
  });

  it('surfaces an unreadable external bundle dir as a load error, not a throw', async () => {
    const cfg = makeTmpConfig();
    const backend = await makeBackend(cfg);
    try {
      const projects = createProjectsService(backend.db, backend.registry);
      const emptyDir = mkdtempSync(join(tmpdir(), 'throughline-nobundle-'));
      try {
        // Absolute, no traversal — passes validation; the dir has no bundle.md,
        // so loadExternalFile must return an error result (ENOENT) without throwing.
        expect(() =>
          projects.create({
            name: 'nb',
            repo_path: '/tmp/nb',
            bundle_id: 'test-bundle',
            bundle_path: emptyDir,
          }),
        ).toThrow(BundleNotLoadedError);
      } finally {
        rmSync(emptyDir, { recursive: true, force: true });
      }
    } finally {
      await backend.cleanup();
    }
  });
});
