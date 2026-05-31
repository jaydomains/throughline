// Phase 6b — OS notification capability layer (T-D32); Phase E E4 — capability honesty (T-D60).
// Single abstraction over platform-specific notification surfaces. Feature code (the
// reminder scheduler today; periodic-review nudges, gate-failure pings, drift signals
// later) calls `notifier.notify(...)` and remains unaware of macOS Notification Center,
// Windows Toast, libnotify, etc. T-D32: not duplicated per platform.
//
// E4 / T-D60 (refuse-rather-than-fallback): `notify` returns a disclosed NotifyResult
// instead of always resolving. A no-op fallback (no OS backend) reports 'unavailable',
// never 'delivered' — so the reminder scheduler does not consume a reminder that was
// never delivered, and the settings panel does not claim notifications work when they
// don't (SF5-03).

import { createRequire } from 'node:module';
import type { NotifyOutcome } from '@throughline/shared';

export interface Notification {
  title: string;
  body: string;
  // Optional deep link the OS notification can route the user to when clicked. The
  // current implementations don't wire click-through (node-notifier's behaviour varies
  // by platform); the field exists so callers don't need to be retrofitted later.
  url?: string;
}

// Whether the capability is present ('os' — a real backend is wired) or absent
// ('unavailable' — degraded fallback). The recording test double reports 'os'.
export type NotifierKind = 'os' | 'unavailable';

// The disclosed result of a notify attempt (T-D60). `error` accompanies 'failed'.
export interface NotifyResult {
  outcome: NotifyOutcome;
  error?: string;
}

export interface Notifier {
  readonly kind: NotifierKind;
  notify(n: Notification): Promise<NotifyResult>;
}

// Low-level OS backend: a fire-and-forget surface that resolves on delivery and rejects
// on failure. `createOsNotifier` wraps one of these (when probed) into the disclosed
// `Notifier` contract. Kept separate so probe/test factories need not carry `kind`.
export interface OsBackend {
  notify(n: Notification): Promise<void>;
}

// In-memory recording notifier: records every call so tests can assert on payloads, and
// reports 'delivered' — it stands in for a working OS backend. It is NOT the production
// no-backend fallback (that is `createUnavailableNotifier`, which honestly reports
// 'unavailable'); production wiring goes through `createOsNotifier`.
export interface RecordingNotifier extends Notifier {
  readonly calls: ReadonlyArray<Notification>;
  reset(): void;
}

export function createRecordingNotifier(): RecordingNotifier {
  const calls: Notification[] = [];
  return {
    kind: 'os',
    get calls() {
      return calls;
    },
    async notify(n: Notification): Promise<NotifyResult> {
      calls.push({ ...n });
      return { outcome: 'delivered' };
    },
    reset() {
      calls.length = 0;
    },
  };
}

// The honest capability-absent notifier: nothing is delivered, and every call discloses
// 'unavailable'. This is what `createOsNotifier` returns when no OS backend is present —
// replacing the old silent no-op that reported success (SF5-03).
export function createUnavailableNotifier(): Notifier {
  return {
    kind: 'unavailable',
    async notify(): Promise<NotifyResult> {
      return { outcome: 'unavailable' };
    },
  };
}

export interface OsNotifierOptions {
  // Test/SSR escape hatch — when set, callers can swap in their own backend factory rather
  // than probing for node-notifier. Production passes nothing and the layer probes.
  factory?: () => OsBackend | null;
  logger?: { info: (m: string) => void; warn: (m: string) => void };
}

// Production factory. Probes for `node-notifier`; if present, wraps it into the disclosed
// Notifier contract; if absent, returns the honest 'unavailable' notifier and warns once.
// The lazy require pattern means the dep is optional — the abstraction is the T-D32 value,
// and platform code can land without breaking dev/test.
export function createOsNotifier(opts: OsNotifierOptions = {}): Notifier {
  const factory = opts.factory ?? defaultProbe;
  const log = opts.logger;
  const backend = factory();
  if (backend) {
    log?.info('notifier: OS backend wired');
    return {
      kind: 'os',
      async notify(n: Notification): Promise<NotifyResult> {
        // A delivery failure is disclosed as 'failed' (not thrown): callers branch on the
        // outcome rather than a try/catch, and the failure is never mistaken for success.
        try {
          await backend.notify(n);
          return { outcome: 'delivered' };
        } catch (err) {
          return { outcome: 'failed', error: err instanceof Error ? err.message : String(err) };
        }
      },
    };
  }
  log?.warn(
    'notifier: no OS backend available (install node-notifier to enable native firing); reporting capability unavailable',
  );
  return createUnavailableNotifier();
}

function defaultProbe(): OsBackend | null {
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
        // Propagate node-notifier callback errors so callers (the reminder scheduler)
        // can log + leave the directive armed for retry. Swallowing the err parameter
        // would mark a failed fire as delivered — permission denied, daemon offline,
        // etc. would silently drop reminders.
        await new Promise<void>((resolve, reject) => {
          handle.notify(
            {
              title: n.title,
              message: n.body,
              ...(n.url !== undefined ? { open: n.url } : {}),
            },
            (err) => {
              if (err) reject(err);
              else resolve();
            },
          );
        });
      },
    };
  } catch {
    return null;
  }
}
