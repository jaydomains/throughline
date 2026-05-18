import chokidar, { type FSWatcher } from 'chokidar';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { InboxWorker } from './worker.js';

// Watches the configured Claude Code inbox directory; on each "add" event, enqueues the file
// then asks the worker to drain. Per CHECKLIST §Phase 4: "Inbox queue processes serially with
// per-file state tracking" — single in-flight drain at a time.

export interface InboxWatcherOptions {
  inboxDir: string;
  worker: InboxWorker;
  watch?: boolean;
  logger?: { info: (m: string) => void; warn: (m: string) => void; error: (m: string) => void };
}

export interface InboxWatcher {
  scanOnce(): Promise<void>;
  stop(): Promise<void>;
}

export function createInboxWatcher(opts: InboxWatcherOptions): InboxWatcher {
  const { inboxDir, worker, watch = true, logger } = opts;
  let watcher: FSWatcher | null = null;
  let draining: Promise<void> = Promise.resolve();
  let stopping: Promise<void> | null = null;

  function enqueueExistingFiles(): void {
    if (!existsSync(inboxDir)) return;
    for (const entry of readdirSync(inboxDir)) {
      const full = join(inboxDir, entry);
      try {
        if (!statSync(full).isFile()) continue;
        worker.enqueue(full);
      } catch (err) {
        logger?.warn(
          `inbox initial scan failed on ${entry}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  function scheduleDrain(): Promise<void> {
    // Chain rather than racing — keeps the serial-processing guarantee.
    draining = draining.then(() => worker.drain()).catch((err) => {
      logger?.error(`inbox drain error: ${err instanceof Error ? err.message : String(err)}`);
    });
    return draining;
  }

  // Always process anything already present in the inbox at startup so files queued while the
  // backend was down (per SPEC §7.6 "Backend down behaviour") are picked up.
  enqueueExistingFiles();
  void scheduleDrain();

  if (watch) {
    watcher = chokidar.watch(inboxDir, { ignoreInitial: true, depth: 0 });
    watcher.on('add', (filePath) => {
      worker.enqueue(filePath);
      void scheduleDrain();
    });
  }

  return {
    async scanOnce() {
      enqueueExistingFiles();
      await scheduleDrain();
    },
    stop() {
      // Idempotent: a second stop() returns the same settled promise rather than
      // re-closing an already-closed chokidar watcher.
      if (!stopping) {
        stopping = (async () => {
          if (watcher) {
            await watcher.close();
            watcher = null;
          }
          await draining;
        })();
      }
      return stopping;
    },
  };
}
