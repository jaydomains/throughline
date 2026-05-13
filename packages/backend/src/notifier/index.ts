// Phase 6b — OS notification capability layer (T-D32).
// Single abstraction over platform-specific notification surfaces. Feature code (the
// reminder scheduler today; periodic-review nudges, gate-failure pings, drift signals
// later) calls `notifier.notify(...)` and remains unaware of macOS Notification Center,
// Windows Toast, libnotify, etc. T-D32: not duplicated per platform.

import { createRequire } from 'node:module';

export interface Notification {
  title: string;
  body: string;
  // Optional deep link the OS notification can route the user to when clicked. The
  // current implementations don't wire click-through (node-notifier's behaviour varies
  // by platform); the field exists so callers don't need to be retrofitted later.
  url?: string;
}

export interface Notifier {
  notify(n: Notification): Promise<void>;
}

// In-memory notifier: records every call so tests can assert on payloads and so the
// production layer has a usable fallback when `node-notifier` is unavailable. Production
// fallback logs a warning on construction so the operator notices the degraded path.
export interface NoopNotifier extends Notifier {
  readonly calls: ReadonlyArray<Notification>;
  reset(): void;
}

export function createNoopNotifier(): NoopNotifier {
  const calls: Notification[] = [];
  return {
    get calls() {
      return calls;
    },
    async notify(n: Notification): Promise<void> {
      calls.push({ ...n });
    },
    reset() {
      calls.length = 0;
    },
  };
}

export interface OsNotifierOptions {
  // Test/SSR escape hatch — when set, callers can swap in their own factory rather than
  // probing for node-notifier. Production passes nothing and the layer probes.
  factory?: () => Notifier | null;
  logger?: { info: (m: string) => void; warn: (m: string) => void };
}

// Production factory. Probes for `node-notifier`; if absent, falls back to the noop
// notifier and warns once. The lazy require pattern means the dep is optional — the
// abstraction is the T-D32 value, and platform code can land without breaking dev/test.
export function createOsNotifier(opts: OsNotifierOptions = {}): Notifier {
  const factory = opts.factory ?? defaultProbe;
  const log = opts.logger;
  const probed = factory();
  if (probed) {
    log?.info('notifier: OS backend wired');
    return probed;
  }
  log?.warn(
    'notifier: no OS backend available (install node-notifier to enable native firing); using no-op fallback',
  );
  return createNoopNotifier();
}

function defaultProbe(): Notifier | null {
  // Lazy probe. require/import of node-notifier is deferred to call time and wrapped so
  // a missing module doesn't break the backend on startup. When the module is present
  // its `notify` is dispatched on every call. Production wiring uses default
  // configuration; per-platform tweaks land if node-notifier proves insufficient (T-D32
  // CODE_SPEC §4: "platform-specific shell-outs as fallback if node-notifier falls
  // short on a target OS").
  try {
    // Use a string-built specifier so bundlers + the TS resolver don't try to resolve
    // the optional dep at type-check time. `createRequire` is used because the backend
    // is ESM; dynamic import would also work but require keeps the probe synchronous,
    // which lets `createOsNotifier()` return without awaiting.
    const moduleId = 'node-notifier';
    const req = createRequire(import.meta.url);
    const mod = req(moduleId) as
      | { notify(opts: Record<string, unknown>, cb?: (err: Error | null) => void): void }
      | { default: { notify(opts: Record<string, unknown>, cb?: (err: Error | null) => void): void } };
    const handle = 'default' in mod ? mod.default : mod;
    return {
      async notify(n: Notification): Promise<void> {
        await new Promise<void>((resolve) => {
          handle.notify(
            {
              title: n.title,
              message: n.body,
              ...(n.url !== undefined ? { open: n.url } : {}),
            },
            () => resolve(),
          );
        });
      },
    };
  } catch {
    return null;
  }
}
