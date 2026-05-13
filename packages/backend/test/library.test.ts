import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createProjectsService } from '../src/projects/service.js';
import { createItemsService } from '../src/items/service.js';
import {
  AttachNotANoteError,
  CrossProjectAttachError,
  LibraryEntryNotFoundError,
  LibraryEntryTypeError,
  NotAPromptError,
  createLibraryService,
} from '../src/library/service.js';
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
  const library = createLibraryService(backend.db, projects);
  const project = projects.create({ name: 'demo', repo_path: '/tmp/demo' });
  return { backend, projects, items, library, project };
}

describe('library service (Phase 6a — full surface)', () => {
  it('creates entries of each of the four types', async () => {
    const { backend, library, project } = await setup();
    try {
      const types = ['note', 'prompt', 'snippet', 'imported_doc'] as const;
      const ids = types.map((t) =>
        library.create({ project_id: project.id, type: t, title: `t-${t}`, body: 'b' }).id,
      );
      expect(ids).toHaveLength(4);
      const listed = library.list({ projectId: project.id });
      expect(listed.map((e) => e.type).sort()).toEqual([...types].sort());
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects an invalid type at create time', async () => {
    const { backend, library, project } = await setup();
    try {
      expect(() =>
        library.create({
          project_id: project.id,
          // @ts-expect-error — invalid type by construction
          type: 'bogus',
          title: 't',
        }),
      ).toThrow(LibraryEntryTypeError);
    } finally {
      await backend.cleanup();
    }
  });

  it('filters list by type', async () => {
    const { backend, library, project } = await setup();
    try {
      library.create({ project_id: project.id, type: 'note', title: 'n' });
      library.create({ project_id: project.id, type: 'prompt', title: 'p' });
      const notes = library.list({ projectId: project.id, type: 'note' });
      expect(notes).toHaveLength(1);
      expect(notes[0]?.type).toBe('note');
    } finally {
      await backend.cleanup();
    }
  });

  it('returns global-scope list across projects when projectId is null', async () => {
    const { backend, projects, library, project } = await setup();
    try {
      const p2 = projects.create({ name: 'other', repo_path: '/tmp/other' });
      library.create({ project_id: project.id, type: 'note', title: 'A' });
      library.create({ project_id: p2.id, type: 'note', title: 'B' });
      const all = library.list({ projectId: null });
      expect(all.map((e) => e.title).sort()).toEqual(['A', 'B']);
    } finally {
      await backend.cleanup();
    }
  });

  it('update mutates fields and audit-logs each change', async () => {
    const { backend, library, project } = await setup();
    try {
      const entry = library.create({ project_id: project.id, type: 'note', title: 'orig' });
      library.update(entry.id, { title: 'next', body: 'newbody', tags: ['inbox'] });
      const audit = backend.db
        .prepare("SELECT field, new_value FROM audit_log WHERE entity_type = 'library' AND entity_id = ?")
        .all(entry.id) as Array<{ field: string; new_value: string | null }>;
      const fields = audit.map((r) => r.field).sort();
      expect(fields).toContain('title');
      expect(fields).toContain('body');
      expect(fields).toContain('tags');
      const after = library.get(entry.id)!;
      expect(after.title).toBe('next');
      expect(after.tags).toEqual(['inbox']);
    } finally {
      await backend.cleanup();
    }
  });

  it('delete removes the entry and cascades attached-note links', async () => {
    const { backend, library, items, project } = await setup();
    try {
      const entry = library.create({ project_id: project.id, type: 'note', title: 'n' });
      const item = items.create({ project_id: project.id, title: 'i' });
      library.attach(entry.id, item.id);
      expect(library.listAttachedItems(entry.id)).toHaveLength(1);
      library.delete(entry.id);
      expect(library.get(entry.id)).toBeNull();
      // No more attachment rows for this entry.
      const remaining = backend.db
        .prepare('SELECT 1 FROM item_attached_notes WHERE library_entry_id = ?')
        .all(entry.id);
      expect(remaining).toHaveLength(0);
    } finally {
      await backend.cleanup();
    }
  });

  it('attach a note to an item happy path + audit row', async () => {
    const { backend, library, items, project } = await setup();
    try {
      const entry = library.create({ project_id: project.id, type: 'note', title: 'n' });
      const item = items.create({ project_id: project.id, title: 'i' });
      library.attach(entry.id, item.id);
      expect(library.listAttachedItems(entry.id).map((i) => i.id)).toEqual([item.id]);
      const audit = backend.db
        .prepare(
          "SELECT field FROM audit_log WHERE entity_type = 'library' AND entity_id = ? AND field = 'attach'",
        )
        .all(entry.id);
      expect(audit).toHaveLength(1);
    } finally {
      await backend.cleanup();
    }
  });

  it('attach is idempotent on duplicates', async () => {
    const { backend, library, items, project } = await setup();
    try {
      const entry = library.create({ project_id: project.id, type: 'note', title: 'n' });
      const item = items.create({ project_id: project.id, title: 'i' });
      library.attach(entry.id, item.id);
      library.attach(entry.id, item.id);
      expect(library.listAttachedItems(entry.id)).toHaveLength(1);
    } finally {
      await backend.cleanup();
    }
  });

  it('attach rejects when the entry is not a note (T-D9)', async () => {
    const { backend, library, items, project } = await setup();
    try {
      const entry = library.create({ project_id: project.id, type: 'prompt', title: 'p' });
      const item = items.create({ project_id: project.id, title: 'i' });
      expect(() => library.attach(entry.id, item.id)).toThrow(AttachNotANoteError);
    } finally {
      await backend.cleanup();
    }
  });

  it('attach rejects cross-project pairs (validate-then-transact)', async () => {
    const { backend, projects, library, items, project } = await setup();
    try {
      const other = projects.create({ name: 'other', repo_path: '/tmp/other' });
      const entry = library.create({ project_id: project.id, type: 'note', title: 'n' });
      const item = items.create({ project_id: other.id, title: 'foreign' });
      expect(() => library.attach(entry.id, item.id)).toThrow(CrossProjectAttachError);
    } finally {
      await backend.cleanup();
    }
  });

  it('detach is idempotent on missing attachment', async () => {
    const { backend, library, items, project } = await setup();
    try {
      const entry = library.create({ project_id: project.id, type: 'note', title: 'n' });
      const item = items.create({ project_id: project.id, title: 'i' });
      // No attach beforehand — detach should not throw.
      expect(() => library.detach(entry.id, item.id)).not.toThrow();
    } finally {
      await backend.cleanup();
    }
  });

  it('listAttachedNotes returns notes for an item', async () => {
    const { backend, library, items, project } = await setup();
    try {
      const n1 = library.create({ project_id: project.id, type: 'note', title: 'n1' });
      const n2 = library.create({ project_id: project.id, type: 'note', title: 'n2' });
      const item = items.create({ project_id: project.id, title: 'i' });
      library.attach(n1.id, item.id);
      library.attach(n2.id, item.id);
      const notes = library.listAttachedNotes(item.id);
      expect(notes.map((n) => n.title).sort()).toEqual(['n1', 'n2']);
    } finally {
      await backend.cleanup();
    }
  });

  it('FTS search returns matches scoped per project', async () => {
    const { backend, projects, library, project } = await setup();
    try {
      const other = projects.create({ name: 'other', repo_path: '/tmp/other' });
      library.create({ project_id: project.id, type: 'note', title: 'paginated index', body: 'thoughts on paging' });
      library.create({ project_id: project.id, type: 'note', title: 'unrelated', body: 'nothing here' });
      library.create({ project_id: other.id, type: 'note', title: 'paging notes', body: 'in another project' });

      const projectScope = library.search(
        { query: 'paging', scope: 'project' },
        project.id,
      );
      expect(projectScope.entries.map((e) => e.title)).toEqual(['paginated index']);
      expect(projectScope.via).toBe('fts');

      const globalScope = library.search({ query: 'paging', scope: 'global' }, project.id);
      expect(globalScope.entries.map((e) => e.title).sort()).toEqual([
        'paginated index',
        'paging notes',
      ]);
    } finally {
      await backend.cleanup();
    }
  });

  it('FTS search finds matches in body and tags', async () => {
    const { backend, library, project } = await setup();
    try {
      library.create({
        project_id: project.id,
        type: 'note',
        title: 'A',
        body: 'mentions widget once',
        tags: ['inbox'],
      });
      library.create({
        project_id: project.id,
        type: 'snippet',
        title: 'B',
        body: 'nothing relevant',
        tags: ['widget'],
      });
      const byBody = library.search({ query: 'widget', scope: 'project' }, project.id);
      // FTS matches in body and tags both.
      expect(byBody.entries.map((e) => e.title).sort()).toEqual(['A', 'B']);
    } finally {
      await backend.cleanup();
    }
  });

  it('semantic-search returns the stub envelope', async () => {
    const { backend, library, project } = await setup();
    try {
      const result = library.semanticSearch({ query: 'anything', scope: 'project' }, project.id);
      expect(result.via).toBe('semantic-stub');
      expect(result.entries).toEqual([]);
    } finally {
      await backend.cleanup();
    }
  });

  it('prompt-fill substitutes placeholders and reports missing variables', async () => {
    const { backend, library, project } = await setup();
    try {
      const entry = library.create({
        project_id: project.id,
        type: 'prompt',
        title: 'greet',
        body: 'Hello {{name}}, welcome to {{place}}.',
      });
      const result = library.fillPrompt(entry.id, { values: { name: 'Ada' } });
      expect(result.rendered).toBe('Hello Ada, welcome to .');
      expect(result.missing_vars).toEqual(['place']);
    } finally {
      await backend.cleanup();
    }
  });

  it('prompt-fill rejects non-prompt entries', async () => {
    const { backend, library, project } = await setup();
    try {
      const note = library.create({ project_id: project.id, type: 'note', title: 'n' });
      expect(() => library.fillPrompt(note.id, { values: {} })).toThrow(NotAPromptError);
    } finally {
      await backend.cleanup();
    }
  });

  it('get / update of a missing entry throws not-found', async () => {
    const { backend, library } = await setup();
    try {
      expect(library.get('nonexistent')).toBeNull();
      expect(() => library.update('nonexistent', { title: 'x' })).toThrow(LibraryEntryNotFoundError);
    } finally {
      await backend.cleanup();
    }
  });
});
