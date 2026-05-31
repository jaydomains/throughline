import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createProjectsService } from '../src/projects/service.js';
import { createItemsService } from '../src/items/service.js';
import { createLibraryService } from '../src/library/service.js';
import { createDirectivesService } from '../src/directives/service.js';
import { createReminderScheduler } from '../src/directives/scheduler.js';
import { createRecordingNotifier, createUnavailableNotifier } from '../src/notifier/index.js';
import { createJobHealth } from '../src/health/job-health.js';
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
  const notifier = createRecordingNotifier();
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

  it('notifier failure leaves the directive armed for the next tick (no silent loss)', async () => {
    // Gitar review fix — if the notifier surfaces an error, the scheduler must not
    // mark the directive fired. Otherwise a transient permission-denied / daemon-down
    // drops the reminder entirely.
    const cfg = makeTmpConfig();
    plantFreeform(cfg.methodologiesDir);
    const backend = await makeBackend(cfg);
    try {
      const projects = createProjectsService(backend.db, backend.registry);
      const items = createItemsService(backend.db, projects, backend.registry);
      const library = createLibraryService(backend.db, projects);
      const directives = createDirectivesService(backend.db, projects, items, library, {
        now: () => FIXED_NOW,
      });
      const project = projects.create({ name: 'demo', repo_path: '/tmp/demo' });
      const item = items.create({ project_id: project.id, title: 'Track item' });
      let attempts = 0;
      const flaky = {
        kind: 'os' as const,
        async notify() {
          attempts += 1;
          throw new Error('daemon_offline');
        },
      };
      const errors: string[] = [];
      const scheduler = createReminderScheduler({
        db: backend.db,
        service: directives,
        notifier: flaky,
        items,
        library,
        now: () => FIXED_NOW,
        logger: {
          info: () => {},
          warn: () => {},
          error: (m) => errors.push(m),
        },
      });
      const d = directives.create({
        project_id: project.id,
        parent_type: 'item',
        parent_id: item.id,
        kind: 'reminder',
        payload: { mode: 'absolute', fire_at: '2026-05-13T11:00:00.000Z' },
      });
      await scheduler.tick();
      await scheduler.tick();
      expect(attempts).toBe(2);
      expect(errors.length).toBeGreaterThan(0);
      const refreshed = directives.get(d.id);
      expect(refreshed?.last_fired_at).toBeNull();
      expect(refreshed?.next_fire_at).toBe('2026-05-13T11:00:00.000Z');
    } finally {
      await backend.cleanup();
    }
  });

  it('an unavailable notifier does NOT consume the reminder — left armed, not marked fired (SF5-03)', async () => {
    // The capability-absent path: no OS backend. Pre-E4 the no-op fallback resolved as if
    // delivered, so markFired ran and the reminder was silently lost. It must now stay armed.
    const cfg = makeTmpConfig();
    plantFreeform(cfg.methodologiesDir);
    const backend = await makeBackend(cfg);
    try {
      const projects = createProjectsService(backend.db, backend.registry);
      const items = createItemsService(backend.db, projects, backend.registry);
      const library = createLibraryService(backend.db, projects);
      const directives = createDirectivesService(backend.db, projects, items, library, {
        now: () => FIXED_NOW,
      });
      const project = projects.create({ name: 'demo', repo_path: '/tmp/demo' });
      const item = items.create({ project_id: project.id, title: 'Track item' });
      const warnings: string[] = [];
      const scheduler = createReminderScheduler({
        db: backend.db,
        service: directives,
        notifier: createUnavailableNotifier(),
        items,
        library,
        now: () => FIXED_NOW,
        logger: { info: () => {}, warn: (m) => warnings.push(m), error: () => {} },
      });
      const d = directives.create({
        project_id: project.id,
        parent_type: 'item',
        parent_id: item.id,
        kind: 'reminder',
        payload: { mode: 'absolute', fire_at: '2026-05-13T11:00:00.000Z' },
      });
      await scheduler.tick();
      expect(warnings.some((m) => m.includes('unavailable'))).toBe(true);
      const refreshed = directives.get(d.id);
      expect(refreshed?.last_fired_at).toBeNull();
      expect(refreshed?.next_fire_at).toBe('2026-05-13T11:00:00.000Z');
    } finally {
      await backend.cleanup();
    }
  });

  it('records loop health: a thrown fire degrades the loop, a graceful non-delivery does not (E5/C-D26)', async () => {
    const cfg = makeTmpConfig();
    plantFreeform(cfg.methodologiesDir);
    const backend = await makeBackend(cfg);
    try {
      const projects = createProjectsService(backend.db, backend.registry);
      const items = createItemsService(backend.db, projects, backend.registry);
      const library = createLibraryService(backend.db, projects);
      const directives = createDirectivesService(backend.db, projects, items, library, {
        now: () => FIXED_NOW,
      });
      const project = projects.create({ name: 'demo', repo_path: '/tmp/demo' });
      const item = items.create({ project_id: project.id, title: 'Track item' });
      directives.create({
        project_id: project.id,
        parent_type: 'item',
        parent_id: item.id,
        kind: 'reminder',
        payload: { mode: 'absolute', fire_at: '2026-05-13T11:00:00.000Z' },
      });

      // A graceful non-delivery (notifier 'unavailable') is the notifier's capability
      // state (E4), not a scheduler-loop fault — the loop stays healthy.
      const okHealth = createJobHealth('reminders');
      const okScheduler = createReminderScheduler({
        db: backend.db,
        service: directives,
        notifier: createUnavailableNotifier(),
        items,
        library,
        now: () => FIXED_NOW,
        health: okHealth,
        logger: { info: () => {}, warn: () => {}, error: () => {} },
      });
      await okScheduler.tick();
      expect(okHealth.snapshot().healthy).toBe(true);
      expect(okHealth.snapshot().last_run_at).toBe(FIXED_NOW.toISOString());

      // A notifier that THROWS is an unexpected loop failure → degrade the loop's health.
      const badHealth = createJobHealth('reminders');
      const badScheduler = createReminderScheduler({
        db: backend.db,
        service: directives,
        notifier: { kind: 'os' as const, notify: async () => { throw new Error('boom'); } },
        items,
        library,
        now: () => FIXED_NOW,
        health: badHealth,
        logger: { info: () => {}, warn: () => {}, error: () => {} },
      });
      await badScheduler.tick();
      expect(badHealth.snapshot().healthy).toBe(false);
      expect(badHealth.snapshot().last_error).toContain('boom');
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
