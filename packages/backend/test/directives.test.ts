import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ReminderPayload } from '@throughline/shared';
import { createProjectsService } from '../src/projects/service.js';
import { createItemsService } from '../src/items/service.js';
import { createLibraryService } from '../src/library/service.js';
import {
  CrossProjectDirectiveError,
  InvalidPayloadError,
  ParentNotFoundError,
  createDirectivesService,
} from '../src/directives/service.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantFreeform(methodologiesDir: string): void {
  const target = join(methodologiesDir, 'freeform');
  mkdirSync(target, { recursive: true });
  copyFileSync(FREEFORM_BUNDLE_PATH, join(target, 'bundle.md'));
}

const FIXED_NOW = new Date('2026-05-13T12:00:00.000Z');

async function setup(now: () => Date = () => FIXED_NOW) {
  const cfg = makeTmpConfig();
  plantFreeform(cfg.methodologiesDir);
  const backend = await makeBackend(cfg);
  const projects = createProjectsService(backend.db, backend.registry);
  const items = createItemsService(backend.db, projects, backend.registry);
  const library = createLibraryService(backend.db, projects);
  const directives = createDirectivesService(backend.db, projects, items, library, { now });
  const project = projects.create({ name: 'demo', repo_path: '/tmp/demo' });
  const altProject = projects.create({ name: 'alt', repo_path: '/tmp/alt' });
  const item = items.create({ project_id: project.id, title: 'Track item' });
  const note = library.create({ project_id: project.id, type: 'note', title: 'A note' });
  return { backend, projects, items, library, directives, project, altProject, item, note };
}

describe('directives service (Phase 6b — T-D12)', () => {
  it('creates a pin directive on an item and audits the create', async () => {
    const { backend, directives, project, item } = await setup();
    try {
      const d = directives.create({
        project_id: project.id,
        parent_type: 'item',
        parent_id: item.id,
        kind: 'pin',
      });
      expect(d.kind).toBe('pin');
      expect(d.next_fire_at).toBeNull();

      const audit = backend.db
        .prepare(
          `SELECT * FROM audit_log WHERE entity_type = 'directive' AND entity_id = ? ORDER BY timestamp ASC`,
        )
        .all(d.id) as Array<{ field: string }>;
      expect(audit.map((a) => a.field)).toEqual(['create']);
    } finally {
      await backend.cleanup();
    }
  });

  it('creates a pin directive on a library entry', async () => {
    const { backend, directives, project, note } = await setup();
    try {
      const d = directives.create({
        project_id: project.id,
        parent_type: 'library',
        parent_id: note.id,
        kind: 'pin',
      });
      expect(d.parent_type).toBe('library');
      expect(d.parent_id).toBe(note.id);
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects cross-project directives', async () => {
    const { backend, directives, altProject, item } = await setup();
    try {
      expect(() =>
        directives.create({
          project_id: altProject.id,
          parent_type: 'item',
          parent_id: item.id,
          kind: 'pin',
        }),
      ).toThrow(CrossProjectDirectiveError);
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects parent-not-found', async () => {
    const { backend, directives, project } = await setup();
    try {
      expect(() =>
        directives.create({
          project_id: project.id,
          parent_type: 'item',
          parent_id: 'nonexistent',
          kind: 'pin',
        }),
      ).toThrow(ParentNotFoundError);
    } finally {
      await backend.cleanup();
    }
  });

  it('creates an absolute reminder and stores next_fire_at', async () => {
    const { backend, directives, project, item } = await setup();
    try {
      const fireAt = '2026-05-13T13:00:00.000Z';
      const d = directives.create({
        project_id: project.id,
        parent_type: 'item',
        parent_id: item.id,
        kind: 'reminder',
        payload: { mode: 'absolute', fire_at: fireAt },
      });
      expect(d.next_fire_at).toBe(fireAt);
    } finally {
      await backend.cleanup();
    }
  });

  it('creates a relative reminder and resolves next_fire_at via the shared parser', async () => {
    const { backend, directives, project, item } = await setup();
    try {
      const d = directives.create({
        project_id: project.id,
        parent_type: 'item',
        parent_id: item.id,
        kind: 'reminder',
        payload: { mode: 'relative', relative_spec: 'in 3 days', fire_at: '' },
      });
      // FIXED_NOW + 3 days = 2026-05-16T12:00:00.000Z
      expect(d.next_fire_at).toBe('2026-05-16T12:00:00.000Z');
      const payload = d.payload as ReminderPayload;
      expect(payload.relative_spec).toBe('in 3 days');
      expect(payload.fire_at).toBe('2026-05-16T12:00:00.000Z');
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects an unrecognised relative_spec', async () => {
    const { backend, directives, project, item } = await setup();
    try {
      expect(() =>
        directives.create({
          project_id: project.id,
          parent_type: 'item',
          parent_id: item.id,
          kind: 'reminder',
          payload: { mode: 'relative', relative_spec: 'whenever I feel like it', fire_at: '' },
        }),
      ).toThrow(InvalidPayloadError);
    } finally {
      await backend.cleanup();
    }
  });

  it('update recomputes next_fire_at and audit-logs the payload change', async () => {
    const { backend, directives, project, item } = await setup();
    try {
      const d = directives.create({
        project_id: project.id,
        parent_type: 'item',
        parent_id: item.id,
        kind: 'reminder',
        payload: { mode: 'absolute', fire_at: '2026-05-13T13:00:00.000Z' },
      });
      const updated = directives.update(d.id, {
        payload: { mode: 'absolute', fire_at: '2026-05-13T15:30:00.000Z' },
      });
      expect(updated.next_fire_at).toBe('2026-05-13T15:30:00.000Z');
      const audits = backend.db
        .prepare(
          `SELECT field FROM audit_log WHERE entity_type = 'directive' AND entity_id = ? ORDER BY timestamp ASC`,
        )
        .all(d.id) as Array<{ field: string }>;
      expect(audits.map((a) => a.field)).toEqual(['create', 'payload']);
    } finally {
      await backend.cleanup();
    }
  });

  it('list filters by kind and parent', async () => {
    const { backend, directives, project, item, note } = await setup();
    try {
      directives.create({ project_id: project.id, parent_type: 'item', parent_id: item.id, kind: 'pin' });
      directives.create({ project_id: project.id, parent_type: 'item', parent_id: item.id, kind: 'include_prompt' });
      directives.create({ project_id: project.id, parent_type: 'library', parent_id: note.id, kind: 'pin' });

      const allPins = directives.list({ projectId: project.id, kind: 'pin' });
      expect(allPins).toHaveLength(2);

      const itemDirs = directives.listForParent('item', item.id);
      expect(itemDirs.map((d) => d.kind).sort()).toEqual(['include_prompt', 'pin']);
    } finally {
      await backend.cleanup();
    }
  });

  it('delete removes the directive and audits', async () => {
    const { backend, directives, project, item } = await setup();
    try {
      const d = directives.create({
        project_id: project.id,
        parent_type: 'item',
        parent_id: item.id,
        kind: 'pin',
      });
      directives.delete(d.id);
      expect(directives.get(d.id)).toBeNull();
      const audits = backend.db
        .prepare(
          `SELECT field FROM audit_log WHERE entity_type = 'directive' AND entity_id = ? ORDER BY timestamp ASC`,
        )
        .all(d.id) as Array<{ field: string }>;
      expect(audits.map((a) => a.field)).toEqual(['create', 'delete']);
    } finally {
      await backend.cleanup();
    }
  });

  it('listDueReminders returns only past-due reminders', async () => {
    const { backend, directives, project, item, note } = await setup();
    try {
      // Past due
      const past = directives.create({
        project_id: project.id,
        parent_type: 'item',
        parent_id: item.id,
        kind: 'reminder',
        payload: { mode: 'absolute', fire_at: '2026-05-13T11:00:00.000Z' },
      });
      // Future
      directives.create({
        project_id: project.id,
        parent_type: 'library',
        parent_id: note.id,
        kind: 'reminder',
        payload: { mode: 'absolute', fire_at: '2026-05-13T13:00:00.000Z' },
      });
      // Pin (not a reminder)
      directives.create({
        project_id: project.id,
        parent_type: 'item',
        parent_id: item.id,
        kind: 'pin',
      });
      const due = directives.listDueReminders(FIXED_NOW);
      expect(due.map((d) => d.id)).toEqual([past.id]);
    } finally {
      await backend.cleanup();
    }
  });

  it('markFired on one-shot clears next_fire_at and records last_fired_at', async () => {
    const { backend, directives, project, item } = await setup();
    try {
      const d = directives.create({
        project_id: project.id,
        parent_type: 'item',
        parent_id: item.id,
        kind: 'reminder',
        payload: { mode: 'absolute', fire_at: '2026-05-13T11:00:00.000Z' },
      });
      const fired = directives.markFired(d.id, FIXED_NOW);
      expect(fired.next_fire_at).toBeNull();
      expect(fired.last_fired_at).toBe(FIXED_NOW.toISOString());
      // Second tick returns nothing for this directive.
      expect(directives.listDueReminders(FIXED_NOW)).toEqual([]);
    } finally {
      await backend.cleanup();
    }
  });

  it('markFired on recurring advances next_fire_at by the recurrence interval', async () => {
    const { backend, directives, project, item } = await setup();
    try {
      const d = directives.create({
        project_id: project.id,
        parent_type: 'item',
        parent_id: item.id,
        kind: 'reminder',
        payload: {
          mode: 'absolute',
          fire_at: '2026-05-13T11:00:00.000Z',
          recurrence: { every: 1, unit: 'day' },
        },
      });
      const fired = directives.markFired(d.id, FIXED_NOW);
      // Advances from the previous next_fire_at, not from `now`, so the cadence stays
      // anchored to the original schedule.
      expect(fired.next_fire_at).toBe('2026-05-14T11:00:00.000Z');
      expect(fired.last_fired_at).toBe(FIXED_NOW.toISOString());
    } finally {
      await backend.cleanup();
    }
  });

  it('countByKind buckets directives per kind for header hint', async () => {
    const { backend, directives, project, item, note } = await setup();
    try {
      directives.create({ project_id: project.id, parent_type: 'item', parent_id: item.id, kind: 'pin' });
      directives.create({ project_id: project.id, parent_type: 'library', parent_id: note.id, kind: 'pin' });
      directives.create({
        project_id: project.id,
        parent_type: 'item',
        parent_id: item.id,
        kind: 'reminder',
        payload: { mode: 'absolute', fire_at: '2026-05-13T13:00:00.000Z' },
      });
      const counts = directives.countByKind(project.id);
      expect(counts).toEqual({ pin: 2, reminder: 1, include_prompt: 0 });
    } finally {
      await backend.cleanup();
    }
  });
});
