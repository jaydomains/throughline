import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createProjectsService } from '../src/projects/service.js';
import { createItemsService } from '../src/items/service.js';
import { createLibraryService } from '../src/library/service.js';
import { createDirectivesService } from '../src/directives/service.js';
import { createReminderScheduler } from '../src/directives/scheduler.js';
import { createNoopNotifier } from '../src/notifier/index.js';
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
  const notifier = createNoopNotifier();
  const scheduler = createReminderScheduler({
    db: backend.db,
    service: directives,
    notifier,
    items,
    library,
    now,
  });
  const project = projects.create({ name: 'demo', repo_path: '/tmp/demo' });
  const item = items.create({ project_id: project.id, title: 'Track item' });
  return { backend, directives, notifier, scheduler, project, item };
}

describe('reminder scheduler (Phase 6b — T-D32 capability layer)', () => {
  it('tick fires a past-due reminder via the notifier and marks it fired', async () => {
    const { backend, directives, notifier, scheduler, project, item } = await setup();
    try {
      const d = directives.create({
        project_id: project.id,
        parent_type: 'item',
        parent_id: item.id,
        kind: 'reminder',
        payload: { mode: 'absolute', fire_at: '2026-05-13T11:00:00.000Z', note: 'wake up' },
      });
      await scheduler.tick();
      expect(notifier.calls).toHaveLength(1);
      expect(notifier.calls[0]!.title).toContain('Track item');
      expect(notifier.calls[0]!.body).toBe('wake up');
      const refreshed = directives.get(d.id);
      expect(refreshed?.last_fired_at).toBe(FIXED_NOW.toISOString());
      expect(refreshed?.next_fire_at).toBeNull();
    } finally {
      await backend.cleanup();
    }
  });

  it('one-shot reminder does not refire on the next tick', async () => {
    const { backend, directives, notifier, scheduler, project, item } = await setup();
    try {
      directives.create({
        project_id: project.id,
        parent_type: 'item',
        parent_id: item.id,
        kind: 'reminder',
        payload: { mode: 'absolute', fire_at: '2026-05-13T11:00:00.000Z' },
      });
      await scheduler.tick();
      await scheduler.tick();
      expect(notifier.calls).toHaveLength(1);
    } finally {
      await backend.cleanup();
    }
  });

  it('recurring reminder re-arms and fires again on a later tick', async () => {
    let nowValue = FIXED_NOW;
    const { backend, directives, notifier, scheduler, project, item } = await setup(() => nowValue);
    try {
      directives.create({
        project_id: project.id,
        parent_type: 'item',
        parent_id: item.id,
        kind: 'reminder',
        payload: {
          mode: 'absolute',
          fire_at: '2026-05-13T11:00:00.000Z',
          recurrence: { every: 1, unit: 'hour' },
        },
      });
      await scheduler.tick();
      expect(notifier.calls).toHaveLength(1);
      // Advance the clock 90 minutes — the next_fire_at (advanced to 12:00) is now past.
      nowValue = new Date('2026-05-13T13:30:00.000Z');
      await scheduler.tick();
      expect(notifier.calls).toHaveLength(2);
    } finally {
      await backend.cleanup();
    }
  });

  it('pin and include_prompt directives are never picked up by the scheduler', async () => {
    const { backend, directives, notifier, scheduler, project, item } = await setup();
    try {
      directives.create({ project_id: project.id, parent_type: 'item', parent_id: item.id, kind: 'pin' });
      directives.create({
        project_id: project.id,
        parent_type: 'item',
        parent_id: item.id,
        kind: 'include_prompt',
      });
      await scheduler.tick();
      expect(notifier.calls).toHaveLength(0);
    } finally {
      await backend.cleanup();
    }
  });
});
