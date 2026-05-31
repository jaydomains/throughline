import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { createJobHealth, createJobHealthRegistry } from '../src/health/job-health.js';
import { registerJobHealthRoutes } from '../src/health/routes.js';

describe('background-job health model (E5 — C-D26)', () => {
  it('starts optimistic, then records success and failure (SF5-01/02/04)', () => {
    const h = createJobHealth('backup');
    // Optimistic until the first run: no failure observed, not yet run.
    expect(h.snapshot()).toEqual({
      name: 'backup',
      last_run_at: null,
      last_error: null,
      healthy: true,
    });

    h.recordSuccess(new Date('2026-05-31T10:00:00.000Z'));
    expect(h.snapshot()).toEqual({
      name: 'backup',
      last_run_at: '2026-05-31T10:00:00.000Z',
      last_error: null,
      healthy: true,
    });

    // A failing tick flips healthy:false and surfaces last_error — the state that was
    // entirely absent pre-E5 (catch-and-log only).
    h.recordFailure(new Date('2026-05-31T11:00:00.000Z'), new Error('disk full'));
    expect(h.snapshot()).toEqual({
      name: 'backup',
      last_run_at: '2026-05-31T11:00:00.000Z',
      last_error: 'disk full',
      healthy: false,
    });

    // A subsequent clean tick recovers.
    h.recordSuccess(new Date('2026-05-31T12:00:00.000Z'));
    expect(h.snapshot().healthy).toBe(true);
    expect(h.snapshot().last_error).toBeNull();
  });

  it('registry returns one record per loop, in registration order', () => {
    const reg = createJobHealthRegistry();
    const backup = reg.track('backup');
    reg.track('reminders');
    reg.track('github-poller');
    // Idempotent: tracking the same name returns the same instance.
    expect(reg.track('backup')).toBe(backup);
    backup.recordFailure(new Date('2026-05-31T11:00:00.000Z'), 'boom');
    const snap = reg.snapshot();
    expect(snap.map((j) => j.name)).toEqual(['backup', 'reminders', 'github-poller']);
    expect(snap[0]!.healthy).toBe(false);
    expect(snap[0]!.last_error).toBe('boom');
    expect(snap[1]!.healthy).toBe(true);
  });

  it('GET /api/background-jobs/health returns the registry snapshot', async () => {
    const reg = createJobHealthRegistry();
    reg.track('backup');
    reg.track('reminders').recordFailure(new Date('2026-05-31T11:00:00.000Z'), new Error('nope'));
    const app = Fastify();
    registerJobHealthRoutes(app, reg);
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/background-jobs/health' });
    await app.close();
    expect(res.statusCode).toBe(200);
    const body = res.json() as { jobs: Array<{ name: string; healthy: boolean; last_error: string | null }> };
    expect(body.jobs.map((j) => j.name)).toEqual(['backup', 'reminders']);
    const reminders = body.jobs.find((j) => j.name === 'reminders');
    expect(reminders?.healthy).toBe(false);
    expect(reminders?.last_error).toBe('nope');
  });
});
