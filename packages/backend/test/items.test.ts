import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createItemsService, ItemPolicyError, BlockerCycleError } from '../src/items/service.js';
import { createProjectsService } from '../src/projects/service.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantFreeform(methodologiesDir: string): void {
  const target = join(methodologiesDir, 'freeform');
  mkdirSync(target, { recursive: true });
  copyFileSync(FREEFORM_BUNDLE_PATH, join(target, 'bundle.md'));
}

async function setup() {
  const cfg = makeTmpConfig();
  plantFreeform(cfg.methodologiesDir);
  const backend = await makeBackend(cfg);
  const projects = createProjectsService(backend.db, backend.registry);
  const items = createItemsService(backend.db, projects, backend.registry);
  const project = projects.create({ name: 'demo', repo_path: '/tmp/demo' });
  return { backend, projects, items, project };
}

describe('items service', () => {
  it('S5-04: a throw mid-update rolls the whole update back — no half-written item', async () => {
    const { backend, items, project } = await setup();
    try {
      const item = items.create({ project_id: project.id, title: 'original', description: 'orig' });
      // Fault-inject a failure on the audit insert that runs INSIDE the update transaction
      // (after the scalar UPDATE). With the writes wrapped in one transaction (S5-04), the
      // UPDATE must roll back; pre-fix it would have committed, leaving the title changed
      // but the audit/mentions/context writes incomplete.
      const db = backend.db;
      const realPrepare = db.prepare.bind(db);
      let armed = false;
      db.prepare = ((sql: string) => {
        if (armed && sql.includes('audit_log')) throw new Error('disk full mid-update');
        return realPrepare(sql);
      }) as typeof db.prepare;
      armed = true;
      expect(() => items.update(item.id, { title: 'changed' })).toThrow('disk full');
      armed = false;
      db.prepare = realPrepare;

      // The scalar UPDATE shared the transaction with the audit insert that threw, so it
      // rolled back: the item is unchanged.
      expect(items.get(item.id)!.title).toBe('original');
    } finally {
      await backend.cleanup();
    }
  });

  it('returns freeform policy with task type and open/done statuses', async () => {
    const { backend, items, project } = await setup();
    try {
      const policy = items.policy(project.id);
      expect(policy.types).toEqual(['task']);
      expect(policy.statuses).toEqual(['open', 'done']);
      expect(policy.statuses_by_type).toEqual({ task: ['open', 'done'] });
      expect(policy.boards).toEqual([
        { id: 'tasks', label: 'Tasks', type: 'task', statuses: ['open', 'done'] },
      ]);
    } finally {
      await backend.cleanup();
    }
  });

  it('creates an item with bundle defaults and audit-logs the create', async () => {
    const { backend, items, project } = await setup();
    try {
      const item = items.create({ project_id: project.id, title: 'first task' });
      expect(item.type).toBe('task');
      expect(item.status).toBe('open');
      const audit = backend.db
        .prepare("SELECT field FROM audit_log WHERE entity_type = 'item' AND entity_id = ?")
        .all(item.id) as Array<{ field: string }>;
      expect(audit.some((r) => r.field === 'create')).toBe(true);
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects unknown type or status', async () => {
    const { backend, items, project } = await setup();
    try {
      expect(() => items.create({ project_id: project.id, title: 't', type: 'decision' })).toThrow(
        ItemPolicyError,
      );
      const item = items.create({ project_id: project.id, title: 't' });
      expect(() => items.update(item.id, { status: 'in-progress' })).toThrow(ItemPolicyError);
    } finally {
      await backend.cleanup();
    }
  });

  it('audit-logs status transitions on update', async () => {
    const { backend, items, project } = await setup();
    try {
      const item = items.create({ project_id: project.id, title: 't' });
      items.update(item.id, { status: 'done' });
      const audit = backend.db
        .prepare("SELECT field, new_value FROM audit_log WHERE entity_type = 'item' AND entity_id = ?")
        .all(item.id) as Array<{ field: string; new_value: string }>;
      expect(audit.some((r) => r.field === 'status' && r.new_value === 'done')).toBe(true);
    } finally {
      await backend.cleanup();
    }
  });

  it('adds + removes tags with audit entries and touches updated_at', async () => {
    const { backend, items, project } = await setup();
    try {
      const item = items.create({ project_id: project.id, title: 't' });
      items.addTag(item.id, 'urgent');
      const tagged = items.get(item.id)!;
      expect(tagged.tags).toEqual(['urgent']);
      items.removeTag(item.id, 'urgent');
      const untagged = items.get(item.id)!;
      expect(untagged.tags).toEqual([]);
      const audit = backend.db
        .prepare("SELECT field FROM audit_log WHERE entity_type = 'item' AND entity_id = ?")
        .all(item.id) as Array<{ field: string }>;
      expect(audit.some((r) => r.field === 'tag_add')).toBe(true);
      expect(audit.some((r) => r.field === 'tag_remove')).toBe(true);
    } finally {
      await backend.cleanup();
    }
  });

  it('adds structured blockers and rejects self-blocking', async () => {
    const { backend, items, project } = await setup();
    try {
      const a = items.create({ project_id: project.id, title: 'A' });
      const b = items.create({ project_id: project.id, title: 'B' });
      items.addBlocker(a.id, b.id);
      expect(items.get(a.id)!.blockers).toEqual([b.id]);
      expect(() => items.addBlocker(a.id, a.id)).toThrow(BlockerCycleError);
      items.removeBlocker(a.id, b.id);
      expect(items.get(a.id)!.blockers).toEqual([]);
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects a transitive blocker cycle via BFS walk', async () => {
    const { backend, items, project } = await setup();
    try {
      const a = items.create({ project_id: project.id, title: 'A' });
      const b = items.create({ project_id: project.id, title: 'B' });
      const c = items.create({ project_id: project.id, title: 'C' });
      items.addBlocker(a.id, b.id); // A blocked by B
      items.addBlocker(b.id, c.id); // B blocked by C
      // Closing the chain — C blocked by A — would form a cycle A->B->C->A.
      expect(() => items.addBlocker(c.id, a.id)).toThrow(BlockerCycleError);
    } finally {
      await backend.cleanup();
    }
  });

  it('honours free-text blocker description and structured blockers together (T-D8)', async () => {
    const { backend, items, project } = await setup();
    try {
      const a = items.create({ project_id: project.id, title: 'A', blocker_text: 'waiting on legal' });
      const b = items.create({ project_id: project.id, title: 'B' });
      items.addBlocker(a.id, b.id);
      const reloaded = items.get(a.id)!;
      expect(reloaded.blocker_text).toBe('waiting on legal');
      expect(reloaded.blockers).toEqual([b.id]);
    } finally {
      await backend.cleanup();
    }
  });

  it('enforces parent in same project and rejects parent cycle', async () => {
    const { backend, items, project } = await setup();
    try {
      const a = items.create({ project_id: project.id, title: 'A' });
      const b = items.create({ project_id: project.id, title: 'B', parent_id: a.id });
      expect(items.get(b.id)!.parent_id).toBe(a.id);
      expect(() => items.update(a.id, { parent_id: b.id })).toThrow(BlockerCycleError);
    } finally {
      await backend.cleanup();
    }
  });

  it('lists items filtered by session membership', async () => {
    const { backend, items, project } = await setup();
    try {
      const a = items.create({ project_id: project.id, title: 'A' });
      const b = items.create({ project_id: project.id, title: 'B' });
      backend.db
        .prepare(
          "INSERT INTO sessions (id, project_id, name, settings_json, created_at, updated_at) VALUES ('s1', ?, 'work', '{}', ?, ?)",
        )
        .run(project.id, new Date().toISOString(), new Date().toISOString());
      items.addSessionMembership(a.id, 's1');
      const session = items.list({ project_id: project.id, session_id: 's1' });
      expect(session.map((i) => i.id)).toEqual([a.id]);
      const all = items.list({ project_id: project.id });
      expect(all.map((i) => i.id).sort()).toEqual([a.id, b.id].sort());
    } finally {
      await backend.cleanup();
    }
  });

  it('cascade-deletes tags and memberships on item delete', async () => {
    const { backend, items, project } = await setup();
    try {
      const item = items.create({ project_id: project.id, title: 't' });
      items.addTag(item.id, 'x');
      items.delete(item.id);
      expect(items.get(item.id)).toBeNull();
      const tagRows = backend.db.prepare('SELECT * FROM item_tags WHERE item_id = ?').all(item.id);
      expect(tagRows).toHaveLength(0);
    } finally {
      await backend.cleanup();
    }
  });
});
