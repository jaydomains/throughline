import type { BackgroundJobHealth } from '@throughline/shared';

// Phase E E5 — background-job health model (C-D26; SF5-01/02/04).
//
// A small mutable tracker per background loop. Each loop calls `recordSuccess` after a
// clean tick and `recordFailure` after a tick that threw, so a loop that starts failing
// becomes an observable `healthy: false` + `last_error` fact instead of a silent
// catch-and-log. The registry collects every tracker for the health route. This is the
// backend data layer, deliberately distinct from the C-D25 frontend visibility component
// (LBD-3 — the two layers evolve independently).

export interface JobHealth {
  readonly name: string;
  recordSuccess(at: Date): void;
  recordFailure(at: Date, err: unknown): void;
  snapshot(): BackgroundJobHealth;
}

export function createJobHealth(name: string): JobHealth {
  // Optimistic until the first run: no failure has been observed and the loop has not
  // yet run, which `last_run_at: null` makes explicit.
  let lastRunAt: string | null = null;
  let lastError: string | null = null;
  let healthy = true;

  return {
    name,
    recordSuccess(at: Date): void {
      lastRunAt = at.toISOString();
      lastError = null;
      healthy = true;
    },
    recordFailure(at: Date, err: unknown): void {
      lastRunAt = at.toISOString();
      lastError = err instanceof Error ? err.message : String(err);
      healthy = false;
    },
    snapshot(): BackgroundJobHealth {
      return { name, last_run_at: lastRunAt, last_error: lastError, healthy };
    },
  };
}

export interface JobHealthRegistry {
  // Create (or return the existing) tracker for a loop name and register it.
  track(name: string): JobHealth;
  // Snapshot every registered tracker, in registration order.
  snapshot(): BackgroundJobHealth[];
}

export function createJobHealthRegistry(): JobHealthRegistry {
  const order: string[] = [];
  const byName = new Map<string, JobHealth>();
  return {
    track(name: string): JobHealth {
      const existing = byName.get(name);
      if (existing) return existing;
      const h = createJobHealth(name);
      byName.set(name, h);
      order.push(name);
      return h;
    },
    snapshot(): BackgroundJobHealth[] {
      return order.map((n) => byName.get(n)!.snapshot());
    },
  };
}
