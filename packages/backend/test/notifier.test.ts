import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import {
  createOsNotifier,
  createRecordingNotifier,
  createUnavailableNotifier,
  type Notifier,
} from '../src/notifier/index.js';
import { registerNotifierRoutes } from '../src/notifier/routes.js';
import type { SettingsService } from '../src/settings/service.js';

describe('notifier capability layer (Phase 6b — T-D32; E4 — T-D60 honesty)', () => {
  it('recording notifier records calls, reports delivered, and exposes reset', async () => {
    const n = createRecordingNotifier();
    expect(n.kind).toBe('os');
    expect(await n.notify({ title: 't', body: 'b' })).toEqual({ outcome: 'delivered' });
    await n.notify({ title: 't2', body: 'b2', url: '/somewhere' });
    expect(n.calls.map((c) => c.title)).toEqual(['t', 't2']);
    expect(n.calls[1]?.url).toBe('/somewhere');
    n.reset();
    expect(n.calls).toEqual([]);
  });

  it('unavailable notifier reports unavailable, never delivered (SF5-03)', async () => {
    const n = createUnavailableNotifier();
    expect(n.kind).toBe('unavailable');
    expect(await n.notify({ title: 't', body: 'b' })).toEqual({ outcome: 'unavailable' });
  });

  it('createOsNotifier degrades to an honest unavailable notifier when node-notifier is absent', async () => {
    // Force the probe to return null. Pre-E4 this returned a no-op that resolved as if
    // delivered (SF5-03); it now returns the honest 'unavailable' capability state.
    const warnings: string[] = [];
    const notifier = createOsNotifier({
      factory: () => null,
      logger: { info: () => {}, warn: (m) => warnings.push(m) },
    });
    expect(notifier.kind).toBe('unavailable');
    expect(await notifier.notify({ title: 't', body: 'b' })).toEqual({ outcome: 'unavailable' });
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('createOsNotifier delivers via the probed backend', async () => {
    const calls: Array<{ title: string }> = [];
    const notifier = createOsNotifier({
      factory: () => ({
        async notify(n) {
          calls.push({ title: n.title });
        },
      }),
    });
    expect(notifier.kind).toBe('os');
    expect(await notifier.notify({ title: 'hi', body: 'b' })).toEqual({ outcome: 'delivered' });
    expect(calls).toEqual([{ title: 'hi' }]);
  });

  it('createOsNotifier discloses a backend failure as failed (not delivered, not thrown)', async () => {
    // A backend that surfaces an error via its callback/promise must report 'failed' so
    // the scheduler leaves the directive armed for retry rather than marking it fired on
    // a silent failure. E4 changes the mechanism from a throw to a disclosed outcome.
    const notifier = createOsNotifier({
      factory: () => ({
        async notify() {
          throw new Error('permission_denied');
        },
      }),
    });
    expect(await notifier.notify({ title: 't', body: 'b' })).toEqual({
      outcome: 'failed',
      error: 'permission_denied',
    });
  });
});

describe('POST /api/notifications/test — honest outcome reporting (E4 — SF5-03)', () => {
  function stubSettings(): { set: ReturnType<typeof vi.fn> } & SettingsService {
    const set = vi.fn();
    return { set } as unknown as { set: ReturnType<typeof vi.fn> } & SettingsService;
  }

  async function inject(notifier: Notifier, settings: SettingsService) {
    const app = Fastify();
    registerNotifierRoutes(app, notifier, settings);
    await app.ready();
    const res = await app.inject({ method: 'POST', url: '/api/notifications/test' });
    await app.close();
    return { status: res.statusCode, body: res.json() as { outcome: string; message?: string } };
  }

  it('reports delivered and enables the setting only on a real delivery', async () => {
    const settings = stubSettings();
    const { status, body } = await inject(createRecordingNotifier(), settings);
    expect(status).toBe(200);
    expect(body.outcome).toBe('delivered');
    expect(settings.set).toHaveBeenCalledWith('os_notifications_enabled', true);
  });

  it('reports unavailable and does NOT enable the setting when no backend exists (SF5-03)', async () => {
    const settings = stubSettings();
    const { body } = await inject(createUnavailableNotifier(), settings);
    expect(body.outcome).toBe('unavailable');
    expect(body.message).toBeTruthy();
    expect(settings.set).not.toHaveBeenCalled();
  });

  it('reports failed and does NOT enable the setting when delivery fails', async () => {
    const settings = stubSettings();
    const failing = createOsNotifier({
      factory: () => ({
        async notify() {
          throw new Error('daemon_offline');
        },
      }),
    });
    const { body } = await inject(failing, settings);
    expect(body.outcome).toBe('failed');
    expect(body.message).toContain('daemon_offline');
    expect(settings.set).not.toHaveBeenCalled();
  });
});
