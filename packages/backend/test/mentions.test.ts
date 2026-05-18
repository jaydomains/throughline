import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createItemsService } from '../src/items/service.js';
import { createProjectsService } from '../src/projects/service.js';
import { parseMentionRefs } from '../src/items/mentions.js';
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

// A syntactically valid but non-resolving 21-char nanoid-class token.
const GHOST = 'AAAAAAAAAAAAAAAAAAAAA';

describe('parseMentionRefs', () => {
  it('extracts @item:<id> tokens, deduped, first-seen order', () => {
    const a = 'V1StGXR8_Z5jdHi6B-myT';
    const b = 'abcdefghijklmnopqrstu';
    expect(parseMentionRefs(`see @item:${a} and @item:${b} and again @item:${a}`)).toEqual([a, b]);
  });

  it('ignores text with no token and bare ids', () => {
    expect(parseMentionRefs('no refs here')).toEqual([]);
    expect(parseMentionRefs(`bare ${GHOST} is not a mention`)).toEqual([]);
  });

  it('does not match a token whose id runs longer than 21 id-class chars', () => {
    expect(parseMentionRefs(`@item:${GHOST}EXTRA`)).toEqual([]);
  });
});

describe('item mentions capture', () => {
  it('derives mentions from description on create', async () => {
    const { backend, items, project } = await setup();
    try {
      const target = items.create({ project_id: project.id, title: 'target' });
      const src = items.create({
        project_id: project.id,
        title: 'src',
        description: `depends on @item:${target.id} for context`,
      });
      expect(src.mentions).toEqual([target.id]);
      expect(items.get(src.id)!.mentions).toEqual([target.id]);
    } finally {
      await backend.cleanup();
    }
  });

  it('drops self-reference and unresolved ids silently', async () => {
    const { backend, items, project } = await setup();
    try {
      const src = items.create({ project_id: project.id, title: 'src' });
      const updated = items.update(src.id, {
        description: `self @item:${src.id} and ghost @item:${GHOST}`,
      });
      expect(updated.mentions).toEqual([]);
    } finally {
      await backend.cleanup();
    }
  });

  it('ignores a ref to an item in another project', async () => {
    const { backend, items, projects, project } = await setup();
    try {
      const other = projects.create({ name: 'other', repo_path: '/tmp/other' });
      const foreign = items.create({ project_id: other.id, title: 'foreign' });
      const src = items.create({
        project_id: project.id,
        title: 'src',
        description: `cross @item:${foreign.id}`,
      });
      expect(src.mentions).toEqual([]);
    } finally {
      await backend.cleanup();
    }
  });

  it('re-derives on update and audit-logs only when the set changes', async () => {
    const { backend, items, project } = await setup();
    try {
      const t1 = items.create({ project_id: project.id, title: 't1' });
      const t2 = items.create({ project_id: project.id, title: 't2' });
      const src = items.create({
        project_id: project.id,
        title: 'src',
        description: `@item:${t1.id}`,
      });
      expect(src.mentions).toEqual([t1.id]);

      // Description edit that doesn't change the mention set → no audit row.
      items.update(src.id, { description: `still @item:${t1.id} only, reworded` });
      let audit = backend.db
        .prepare("SELECT field FROM audit_log WHERE entity_type = 'item' AND entity_id = ? AND field = 'mentions'")
        .all(src.id) as Array<{ field: string }>;
      expect(audit).toHaveLength(0);

      // Now the set changes → one mentions audit row.
      const after = items.update(src.id, { description: `@item:${t1.id} and @item:${t2.id}` });
      expect(after.mentions.sort()).toEqual([t1.id, t2.id].sort());
      audit = backend.db
        .prepare("SELECT field FROM audit_log WHERE entity_type = 'item' AND entity_id = ? AND field = 'mentions'")
        .all(src.id) as Array<{ field: string }>;
      expect(audit).toHaveLength(1);
    } finally {
      await backend.cleanup();
    }
  });

  it('links() returns parents, children, mentioned and mentioning', async () => {
    const { backend, items, project } = await setup();
    try {
      const parent = items.create({ project_id: project.id, title: 'parent' });
      const target = items.create({ project_id: project.id, title: 'target' });
      const src = items.create({
        project_id: project.id,
        title: 'src',
        parent_id: parent.id,
        description: `uses @item:${target.id}`,
      });
      const child = items.create({
        project_id: project.id,
        title: 'child',
        parent_id: src.id,
      });
      const other = items.create({
        project_id: project.id,
        title: 'other',
        description: `also @item:${src.id}`,
      });

      const links = items.links(src.id)!;
      expect(links.parents.map((l) => l.id)).toEqual([parent.id]);
      expect(links.children.map((l) => l.id)).toEqual([child.id]);
      expect(links.mentioned.map((l) => l.id)).toEqual([target.id]);
      expect(links.mentioning.map((l) => l.id)).toEqual([other.id]);
      expect(links.mentioned[0]).toMatchObject({ title: 'target', type: 'task', status: 'open' });
    } finally {
      await backend.cleanup();
    }
  });

  it('links() returns null for an unknown item and empty arrays when isolated', async () => {
    const { backend, items, project } = await setup();
    try {
      expect(items.links('does-not-exist')).toBeNull();
      const lone = items.create({ project_id: project.id, title: 'lone' });
      expect(items.links(lone.id)).toEqual({
        parents: [],
        children: [],
        mentioned: [],
        mentioning: [],
      });
    } finally {
      await backend.cleanup();
    }
  });

  it('cascades mention rows when a mentioned item is deleted', async () => {
    const { backend, items, project } = await setup();
    try {
      const target = items.create({ project_id: project.id, title: 'target' });
      const src = items.create({
        project_id: project.id,
        title: 'src',
        description: `@item:${target.id}`,
      });
      expect(src.mentions).toEqual([target.id]);
      items.delete(target.id);
      expect(items.get(src.id)!.mentions).toEqual([]);
      const rows = backend.db
        .prepare('SELECT * FROM item_mentions WHERE item_id = ?')
        .all(src.id) as unknown[];
      expect(rows).toHaveLength(0);
    } finally {
      await backend.cleanup();
    }
  });
});
