import { describe, expect, it, vi } from 'vitest';
import { createSSEHub } from '../src/routes/events.js';

describe('SSE hub (UI redesign Slice 4)', () => {
  it('fans a broadcast out to every registered client', () => {
    const hub = createSSEHub();
    const a = vi.fn();
    const b = vi.fn();
    hub._add(a);
    hub._add(b);

    hub.broadcast('settings-changed', { theme_direction: 'C' });

    expect(a).toHaveBeenCalledWith('settings-changed', { theme_direction: 'C' });
    expect(b).toHaveBeenCalledWith('settings-changed', { theme_direction: 'C' });
    expect(hub.clientCount()).toBe(2);
  });

  it('stops delivering after a client unregisters', () => {
    const hub = createSSEHub();
    const a = vi.fn();
    const unregister = hub._add(a);

    unregister();
    hub.broadcast('settings-changed', {});

    expect(a).not.toHaveBeenCalled();
    expect(hub.clientCount()).toBe(0);
  });

  it('closeAll ends every live connection and empties the registry (S7-02)', () => {
    const hub = createSSEHub();
    const closeA = vi.fn();
    const closeB = vi.fn();
    hub._add(vi.fn(), closeA);
    hub._add(vi.fn(), closeB);
    expect(hub.clientCount()).toBe(2);

    hub.closeAll();

    // Each connection's teardown ran (ends the hijacked socket — app.close() can't, S7-02)
    // and the registry is empty.
    expect(closeA).toHaveBeenCalledTimes(1);
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(hub.clientCount()).toBe(0);
  });

  it('closeAll tolerates a connection registered without a close fn (test/legacy)', () => {
    const hub = createSSEHub();
    hub._add(vi.fn()); // no close fn
    expect(() => hub.closeAll()).not.toThrow();
    expect(hub.clientCount()).toBe(0);
  });

  it('drops a client whose send throws without breaking the fan-out', () => {
    const hub = createSSEHub();
    const bad = vi.fn(() => {
      throw new Error('broken pipe');
    });
    const good = vi.fn();
    hub._add(bad);
    hub._add(good);

    hub.broadcast('ping', { seq: 1 });

    expect(good).toHaveBeenCalledWith('ping', { seq: 1 });
    expect(hub.clientCount()).toBe(1);
  });
});
