import type { SettingsService } from '../settings/service.js';
import type { JobHealth } from '../health/job-health.js';
import type { BackupService } from './service.js';
import { KEY_BACKUP_NUDGE_INTERVAL_DAYS } from './service.js';

// Phase 15 (T-D28, CODE_SPEC §17) — backup scheduler. On a coarse tick it (a) runs the
// off-disk auto-copy when due per backup_nudge_interval_days and a target is set, and
// (b) prunes expired dated archive subdirs (CHECKLIST §15 hygiene). The tick is coarse
// (hourly) because the cadence is days; tests call tick() directly.

export interface BackupSchedulerOptions {
  service: BackupService;
  settings: SettingsService;
  intervalMs?: number;
  now?: () => Date;
  logger?: { info: (m: string) => void; warn: (m: string) => void; error: (m: string) => void };
  // Optional per-loop health tracker (C-D26). When present, a clean tick records success
  // and a tick that threw records the failure, making the loop's state observable.
  health?: JobHealth;
}

export interface BackupScheduler {
  start(): void;
  stop(): void;
  tick(): Promise<void>;
}

const DEFAULT_NUDGE_INTERVAL_DAYS = 7;

function toPositiveInt(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

export function createBackupScheduler(opts: BackupSchedulerOptions): BackupScheduler {
  const interval = opts.intervalMs ?? 60 * 60 * 1000;
  const clock = opts.now ?? (() => new Date());
  const log = opts.logger;
  let timer: NodeJS.Timeout | null = null;
  let running = false;

  async function tick(): Promise<void> {
    if (running) return;
    running = true;
    // Capture the first sub-op failure so the loop's health reflects a degraded tick
    // (C-D26) — the sub-catches keep logging, but the failure is no longer invisible.
    let tickError: unknown = null;
    try {
      const status = opts.service.status();
      const intervalDays = toPositiveInt(
        opts.settings.get(KEY_BACKUP_NUDGE_INTERVAL_DAYS),
        DEFAULT_NUDGE_INTERVAL_DAYS,
      );
      if (status.auto_copy_target_path) {
        const lastAuto = status.last_auto_copy_at;
        const dueMs = intervalDays * 24 * 60 * 60 * 1000;
        const due = !lastAuto || clock().getTime() - new Date(lastAuto).getTime() >= dueMs;
        if (due) {
          try {
            await opts.service.autoCopy();
            log?.info('backup: auto-copy completed');
          } catch (err) {
            tickError = err;
            log?.error(
              `backup: auto-copy failed: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }
      try {
        const removed = opts.service.pruneArchive();
        if (removed > 0) log?.info(`backup: pruned ${removed} expired archive day(s)`);
      } catch (err) {
        tickError = err;
        log?.warn(
          `backup: archive prune failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } catch (err) {
      // status() / settings read threw — previously this propagated unhandled out of the
      // void tick(); now it degrades the loop's health rather than vanishing.
      tickError = err;
      log?.error(`backup: tick failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      running = false;
    }
    if (tickError) opts.health?.recordFailure(clock(), tickError);
    else opts.health?.recordSuccess(clock());
  }

  return {
    start() {
      if (timer) return;
      timer = setInterval(() => {
        void tick();
      }, interval);
      // Don't keep the event loop alive solely for the backup tick.
      timer.unref?.();
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    tick,
  };
}
