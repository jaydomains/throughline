import type { Directive } from '@throughline/shared';
import type { DB } from '../db/index.js';
import type { ItemsService } from '../items/service.js';
import type { LibraryService } from '../library/service.js';
import type { Notifier } from '../notifier/index.js';
import type { DirectivesService } from './service.js';

// Phase 6b — reminder scheduler. Polls the directives table on a configurable tick
// (default 30s) for reminders whose next_fire_at has passed and fires them via the
// notifier capability layer (T-D32). Recurring reminders re-arm after each fire;
// one-shot reminders set next_fire_at=NULL on fire and fall out of the index.
//
// Test seam: `now` is a factory injected at construction time, and `tick()` is exposed
// for direct invocation. Tests don't use fake timers — they seed past-due reminders and
// call `tick()` directly.

export interface ReminderSchedulerOptions {
  db: DB;
  service: DirectivesService;
  notifier: Notifier;
  items: ItemsService;
  library: LibraryService;
  intervalMs?: number;
  now?: () => Date;
  logger?: { info: (m: string) => void; warn: (m: string) => void; error: (m: string) => void };
}

export interface ReminderScheduler {
  start(): void;
  stop(): void;
  tick(): Promise<void>;
}

export function createReminderScheduler(opts: ReminderSchedulerOptions): ReminderScheduler {
  const interval = opts.intervalMs ?? 30_000;
  const clock = opts.now ?? (() => new Date());
  const log = opts.logger;
  let timer: NodeJS.Timeout | null = null;
  let running = false;

  function resolveTitle(d: Directive): string {
    if (d.parent_type === 'item') {
      const item = opts.items.get(d.parent_id);
      return item ? `Reminder · ${item.title}` : 'Reminder';
    }
    const entry = opts.library.get(d.parent_id);
    return entry ? `Reminder · ${entry.title}` : 'Reminder';
  }

  function resolveBody(d: Directive): string {
    const payload = d.payload as { note?: string };
    if (payload.note) return payload.note;
    if (d.parent_type === 'item') {
      const item = opts.items.get(d.parent_id);
      return item?.description ?? '';
    }
    const entry = opts.library.get(d.parent_id);
    return entry?.body.slice(0, 240) ?? '';
  }

  function resolveUrl(d: Directive): string {
    // Local deep link — backend routes can build a project-relative URL the UI knows
    // how to interpret. Click-through wiring is platform-specific and not all backends
    // honour it; we still surface it so consumers can use it when available.
    if (d.parent_type === 'item') {
      return `/projects/${d.project_id}/tree?item=${d.parent_id}`;
    }
    return `/projects/${d.project_id}/library?entry=${d.parent_id}`;
  }

  async function tick(): Promise<void> {
    if (running) return;
    running = true;
    try {
      const due = opts.service.listDueReminders(clock());
      for (const d of due) {
        try {
          const result = await opts.notifier.notify({
            title: resolveTitle(d),
            body: resolveBody(d),
            url: resolveUrl(d),
          });
          // E4 / T-D60: only a real delivery consumes the reminder. An 'unavailable'
          // (no OS backend) or 'failed' fire leaves the directive armed for the next
          // tick — a non-delivery is never marked as delivered (SF5-03).
          if (result.outcome === 'delivered') {
            opts.service.markFired(d.id, clock());
          } else {
            const detail = result.error ? `${result.outcome}: ${result.error}` : result.outcome;
            log?.warn(`reminder ${d.id} not delivered (${detail}); left armed for retry`);
          }
        } catch (err) {
          log?.error(
            `reminder ${d.id} fire failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } finally {
      running = false;
    }
  }

  return {
    start() {
      if (timer) return;
      log?.info(`reminder scheduler started (interval ${interval}ms)`);
      timer = setInterval(() => {
        void tick();
      }, interval);
      // Don't keep the process alive solely for the scheduler.
      if (typeof timer.unref === 'function') timer.unref();
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
      log?.info('reminder scheduler stopped');
    },
    tick,
  };
}
