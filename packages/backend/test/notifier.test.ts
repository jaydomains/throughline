import { describe, expect, it } from 'vitest';
import { createNoopNotifier, createOsNotifier } from '../src/notifier/index.js';

describe('notifier capability layer (Phase 6b — T-D32)', () => {
  it('noop notifier records calls and exposes reset', async () => {
    const n = createNoopNotifier();
    await n.notify({ title: 't', body: 'b' });
    await n.notify({ title: 't2', body: 'b2', url: '/somewhere' });
    expect(n.calls.map((c) => c.title)).toEqual(['t', 't2']);
    expect(n.calls[1]?.url).toBe('/somewhere');
    n.reset();
    expect(n.calls).toEqual([]);
  });

  it('createOsNotifier returns a working notifier even when node-notifier is absent (degrade-gracefully)', async () => {
    // Force the probe to return null; createOsNotifier should hand back a working
    // fallback rather than throwing. This is the SPEC §15 contract.
    const warnings: string[] = [];
    const notifier = createOsNotifier({
      factory: () => null,
      logger: { info: () => {}, warn: (m) => warnings.push(m) },
    });
    await expect(notifier.notify({ title: 't', body: 'b' })).resolves.toBeUndefined();
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('createOsNotifier uses the injected backend when probe returns one', async () => {
    const calls: Array<{ title: string }> = [];
    const notifier = createOsNotifier({
      factory: () => ({
        async notify(n) {
          calls.push({ title: n.title });
        },
      }),
    });
    await notifier.notify({ title: 'hi', body: 'b' });
    expect(calls).toEqual([{ title: 'hi' }]);
  });
});
