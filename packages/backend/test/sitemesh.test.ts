import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseBundle } from '../src/methodology/bundle-parser/index.js';
import { createItemsService, ItemPolicyError } from '../src/items/service.js';
import { createProjectsService } from '../src/projects/service.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const SITEMESH_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'sitemesh', 'bundle.md');

function plantSitemesh(methodologiesDir: string): void {
  const target = join(methodologiesDir, 'sitemesh');
  mkdirSync(target, { recursive: true });
  copyFileSync(SITEMESH_BUNDLE_PATH, join(target, 'bundle.md'));
}

async function setup() {
  const cfg = makeTmpConfig();
  plantSitemesh(cfg.methodologiesDir);
  const backend = await makeBackend(cfg);
  const projects = createProjectsService(backend.db, backend.registry);
  const items = createItemsService(backend.db, projects, backend.registry);
  const project = projects.create({ name: 'sm', repo_path: '/tmp/sm', bundle_id: 'sitemesh' });
  return { backend, projects, items, project };
}

describe('SiteMesh bundle', () => {
  it('parses cleanly through the bundle loader (Phase 7 done-when)', () => {
    const md = readFileSync(SITEMESH_BUNDLE_PATH, 'utf8');
    const result = parseBundle('sitemesh', md);
    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    expect(result.bundle.identity.name).toBe('sitemesh');
    expect(result.bundle.project_layout.primary_unit?.name).toBe('module');
    // multi-gate per phase moment (T-D42): per-commit declares two independent gates
    expect(result.bundle.state_machine.gates_by_moment['per-commit']?.map((g) => g.id)).toEqual([
      'verify-structure.sh',
      'sitemesh-pre-commit',
    ]);
    expect(result.bundle.state_machine.item_types.map((t) => t.id)).toEqual(['todo', 'decision']);
  });

  it('derives two boards with per-type status lifecycles (§7.5, C-D12)', async () => {
    const { backend, items, project } = await setup();
    try {
      const policy = items.policy(project.id);
      expect(policy.types).toEqual(['todo', 'decision']);
      expect(policy.boards.map((b) => ({ id: b.id, label: b.label }))).toEqual([
        { id: 'todo', label: 'Todos' },
        { id: 'decision', label: 'Decisions' },
      ]);
      expect(policy.statuses_by_type['todo']).toEqual(['todo', 'in-progress', 'blocked', 'done']);
      expect(policy.statuses_by_type['decision']).toEqual(['open', 'locked', 'superseded']);
    } finally {
      await backend.cleanup();
    }
  });

  it('validates status against the item type lifecycle, not a shared pool', async () => {
    const { backend, items, project } = await setup();
    try {
      // a decision cannot take a todo-only status
      expect(() =>
        items.create({ project_id: project.id, title: 'd', type: 'decision', status: 'in-progress' }),
      ).toThrow(ItemPolicyError);
      const todo = items.create({ project_id: project.id, title: 't', type: 'todo' });
      expect(todo.status).toBe('todo');
      const decision = items.create({ project_id: project.id, title: 'd', type: 'decision' });
      expect(decision.status).toBe('open');
      expect(() => items.update(decision.id, { status: 'blocked' })).toThrow(ItemPolicyError);
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
        type: 'todo',
        methodology_context: { primary_unit_refs: ['auth'], anchor_citations: ['T-D39'] },
      });
      expect(item.methodology_context.primary_unit_refs).toEqual(['auth']);
      expect(item.methodology_context.anchor_citations).toEqual(['T-D39']);

      const updated = items.update(item.id, {
        methodology_context: { primary_unit_refs: ['auth', 'billing'], marker_refs: ['[UNRESOLVED-(b)]'] },
      });
      expect(updated.methodology_context.primary_unit_refs).toEqual(['auth', 'billing']);
      expect(updated.methodology_context.marker_refs).toEqual(['[UNRESOLVED-(b)]']);
      // anchor_citations untouched because not in the patch
      expect(updated.methodology_context.anchor_citations).toEqual(['T-D39']);

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
        type: 'todo',
        methodology_context: { primary_unit_refs: ['auth'], phase_refs: ['drafting'], anchor_citations: ['T-D39'] },
      });
      items.create({
        project_id: project.id,
        title: 'b',
        type: 'todo',
        methodology_context: { primary_unit_refs: ['auth'], phase_refs: ['code-ready'] },
      });
      items.create({
        project_id: project.id,
        title: 'c',
        type: 'decision',
        methodology_context: { primary_unit_refs: ['billing'], marker_refs: ['[RATIONALE NEEDED]'] },
      });

      const res = items.modules(project.id);
      expect(res.primary_unit_label).toBe('module');
      const auth = res.modules.find((m) => m.ref === 'auth')!;
      expect(auth.item_count).toBe(2);
      expect(auth.phases.sort()).toEqual(['code-ready', 'drafting']);
      expect(auth.anchor_count).toBe(1);
      expect(auth.tier).toBe('tier-1'); // 2 items => tier-1 (<=2)
      const billing = res.modules.find((m) => m.ref === 'billing')!;
      expect(billing.marker_count).toBe(1);
    } finally {
      await backend.cleanup();
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
