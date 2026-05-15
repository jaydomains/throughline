import chokidar, { type FSWatcher } from 'chokidar';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ProjectsService } from '../projects/service.js';
import type { MdIngestService } from './service.js';

// Phase 6c — tracked-source watcher (SPEC §7.9: "tracked entries re-ingest on file
// change"). Mirrors the Phase 4 inbox watcher: a chokidar watch over the opted-in
// folders that schedules a serial resync, plus a manual `syncOnce()` test seam (the
// "manual tick() separate from start()/stop()" convention from the 6b scheduler).
//
// On any add/change under an opted-in folder we resync every tracked entry. Re-ingest is
// hash-gated in the service, so unchanged files are a cheap no-op — this keeps the
// path → entry mapping trivial and correct even as tracked toggles flip at runtime.

export interface MdIngestWatcherOptions {
  projects: ProjectsService;
  service: MdIngestService;
  watch?: boolean;
  logger?: { info: (m: string) => void; warn: (m: string) => void; error: (m: string) => void };
}

export interface MdIngestWatcher {
  syncOnce(): Promise<void>;
  start(): void;
  // Re-derive the watched path set from the current opt-in folders. Called after the
  // REST surface adds/removes a folder so newly-registered folders receive file-change
  // events without a server restart; removed folders stop being watched.
  refresh(): void;
  stop(): Promise<void>;
}

export function createMdIngestWatcher(opts: MdIngestWatcherOptions): MdIngestWatcher {
  const { projects, service, watch = true, logger } = opts;
  let watcher: FSWatcher | null = null;
  let syncing: Promise<void> = Promise.resolve();
  const watched = new Set<string>();

  async function resyncAll(): Promise<void> {
    for (const project of projects.list()) {
      let tracked;
      try {
        tracked = service.listTrackedEntries(project.id);
      } catch (err) {
        logger?.warn(
          `md-ingest resync skipped project ${project.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        continue;
      }
      for (const entry of tracked) {
        try {
          const { changed } = await service.reingestEntry(project.id, entry.id, 'system');
          if (changed) {
            logger?.info(`md-ingest re-ingested tracked entry ${entry.id} (${entry.source_path})`);
          }
        } catch (err) {
          // SourceFileMissingError etc. — warn and keep going; a missing source file
          // shouldn't take down the resync for sibling tracked entries.
          logger?.warn(
            `md-ingest re-ingest failed for entry ${entry.id}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    }
  }

  function scheduleSync(): Promise<void> {
    syncing = syncing.then(() => resyncAll()).catch((err) => {
      logger?.error(
        `md-ingest sync error: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
    return syncing;
  }

  function watchPaths(): string[] {
    const paths: string[] = [];
    for (const project of projects.list()) {
      let folders;
      try {
        folders = service.listFolders(project.id);
      } catch {
        continue;
      }
      for (const f of folders) {
        const abs = resolve(project.repo_path, f.rel_path);
        if (existsSync(abs)) paths.push(abs);
      }
    }
    return paths;
  }

  // Diff the desired path set against what chokidar is currently watching and apply the
  // delta. Idempotent — safe to call on every folder add/remove.
  function applyWatchDelta(): void {
    if (!watcher) return;
    const desired = new Set(watchPaths());
    for (const p of desired) {
      if (!watched.has(p)) {
        watcher.add(p);
        watched.add(p);
      }
    }
    for (const p of [...watched]) {
      if (!desired.has(p)) {
        watcher.unwatch(p);
        watched.delete(p);
      }
    }
  }

  return {
    async syncOnce() {
      await scheduleSync();
    },
    start() {
      if (!watch || watcher) return;
      // Always create the instance, even with zero folders, so folders added later via
      // refresh() start receiving events without a restart.
      watcher = chokidar.watch([], { ignoreInitial: true });
      watcher.on('add', () => void scheduleSync());
      watcher.on('change', () => void scheduleSync());
      watcher.on('unlink', () => void scheduleSync());
      applyWatchDelta();
    },
    refresh() {
      applyWatchDelta();
    },
    async stop() {
      if (watcher) {
        await watcher.close();
        watcher = null;
      }
      watched.clear();
      await syncing;
    },
  };
}
