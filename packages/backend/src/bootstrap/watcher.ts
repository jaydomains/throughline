import chokidar, { type FSWatcher } from 'chokidar';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { ProjectsService } from '../projects/service.js';

// C-D21 surface 3 — chokidar watcher on
// `<repo_path>/.throughline/bootstrap-output.json` per project. Detected file
// writes hand off to a BootstrapWorker (slice 3 real implementation; slice 2
// ships against this interface alone, stubbed in tests). Mirrors
// `packages/backend/src/inbox/watcher.ts` in shape: serial drain via promise
// chaining, idempotent stop, startup-scan via existing-file enqueue
// (SPEC §7.6 "Backend down behaviour").
//
// Lifecycle (locked at Phase 21 chain-open):
//
//   register      — render-endpoint first call adds the project to the
//                   registry. Idempotent: a second register for the same
//                   project is a no-op.
//   startupScan   — on server boot, iterate every bound project (those with
//                   a canonical repo_path) and register the watcher. If a
//                   bootstrap-output.json already sits on disk from a prior
//                   session, enqueue it before chokidar arms — closes the
//                   restart-mid-wait data-loss gap C-D21 left implicit.
//   unregister    — called from projects.service.delete() so a deleted
//                   project's watcher is closed.
//   stop          — graceful shutdown; closes every per-project chokidar
//                   instance and awaits any in-flight drain.
//
// "User renders prompt then abandons Claude Code" is an accepted leak per
// spec-author decision at chain-open: chokidar `depth: 0` on a single file is
// near-free, backend restart self-clears the registry, render is a rare
// action — over-engineering self-clearing cleanup is the wrong cost trade.

export interface BootstrapWorker {
  enqueue(projectId: string, filePath: string): void;
  drain(): Promise<void>;
}

export interface BootstrapWatcherLogger {
  info: (m: string) => void;
  warn: (m: string) => void;
  error: (m: string) => void;
}

export interface BootstrapWatcherRegistryOptions {
  worker: BootstrapWorker;
  watch?: boolean;
  logger?: BootstrapWatcherLogger;
}

export interface BootstrapWatcherRegistry {
  register(projectId: string, repoPath: string): void;
  unregister(projectId: string): Promise<void>;
  stop(): Promise<void>;
  startupScan(projects: ProjectsService): Promise<void>;
}

interface Entry {
  watcher: FSWatcher | null;
  repoPath: string;
}

const BOOTSTRAP_OUTPUT_FILENAME = 'bootstrap-output.json';

export function createBootstrapWatcherRegistry(
  opts: BootstrapWatcherRegistryOptions,
): BootstrapWatcherRegistry {
  const { worker, watch = true, logger } = opts;
  const entries = new Map<string, Entry>();
  let draining: Promise<void> = Promise.resolve();
  let stopping: Promise<void> | null = null;

  function outputPathFor(repoPath: string): string {
    return join(repoPath, '.throughline', BOOTSTRAP_OUTPUT_FILENAME);
  }

  function enqueueIfPresent(projectId: string, repoPath: string): void {
    const target = outputPathFor(repoPath);
    if (!existsSync(target)) return;
    try {
      if (!statSync(target).isFile()) return;
      worker.enqueue(projectId, target);
    } catch (err) {
      logger?.warn(
        `bootstrap startup-scan failed on ${target}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  function scheduleDrain(): Promise<void> {
    // Serial drain across all projects' watchers — mirrors inbox precedent.
    // Single in-flight ingest at a time keeps the worker's archive/quarantine
    // semantics simple and matches Phase 20's `bootstrap/service.ts`
    // transactional upsert (one transaction per ingest, no overlapping
    // writes on the same project_id).
    draining = draining.then(() => worker.drain()).catch((err) => {
      logger?.error(
        `bootstrap drain error: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
    return draining;
  }

  function attachWatcher(projectId: string, repoPath: string): FSWatcher | null {
    if (!watch) return null;
    const throughlineDir = join(repoPath, '.throughline');
    // chokidar.watch on a non-existent file polls slowly and unreliably.
    // Inbox precedent watches a directory with `depth: 0`; we mirror that
    // and filter events to the bootstrap-output filename. The render
    // endpoint mkdirs `.throughline/` before the first watcher registration,
    // and startupScan tolerates absence below (renders haven't fired yet).
    if (!existsSync(throughlineDir)) {
      try {
        mkdirSync(throughlineDir, { recursive: true });
      } catch (err) {
        logger?.warn(
          `bootstrap watcher mkdir failed for ${throughlineDir}: ${err instanceof Error ? err.message : String(err)}`,
        );
        return null;
      }
    }
    const fsWatcher = chokidar.watch(throughlineDir, { ignoreInitial: true, depth: 0 });
    const onWrite = (filePath: string): void => {
      // depth: 0 still emits events for any file in the directory; we only
      // care about the bootstrap-output.json filename. Archive/quarantine
      // worker writes (slice 3) go into sibling subdirectories so they're
      // out of scope here anyway.
      if (basename(filePath) !== BOOTSTRAP_OUTPUT_FILENAME) return;
      worker.enqueue(projectId, filePath);
      void scheduleDrain();
    };
    fsWatcher.on('add', onWrite);
    fsWatcher.on('change', onWrite);
    return fsWatcher;
  }

  const registry: BootstrapWatcherRegistry = {
    register(projectId, repoPath) {
      if (entries.has(projectId)) return; // idempotent — accept the leak
      enqueueIfPresent(projectId, repoPath);
      void scheduleDrain();
      const fsWatcher = attachWatcher(projectId, repoPath);
      entries.set(projectId, { watcher: fsWatcher, repoPath });
    },

    async unregister(projectId) {
      const entry = entries.get(projectId);
      if (!entry) return;
      entries.delete(projectId);
      if (entry.watcher) {
        try {
          await entry.watcher.close();
        } catch (err) {
          logger?.warn(
            `bootstrap unregister close failed for ${projectId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    },

    stop() {
      if (!stopping) {
        stopping = (async () => {
          for (const [projectId, entry] of entries) {
            if (entry.watcher) {
              try {
                await entry.watcher.close();
              } catch (err) {
                logger?.warn(
                  `bootstrap stop close failed for ${projectId}: ${err instanceof Error ? err.message : String(err)}`,
                );
              }
            }
          }
          entries.clear();
          await draining;
        })();
      }
      return stopping;
    },

    async startupScan(projects) {
      for (const project of projects.list()) {
        if (!project.repo_path) continue;
        registry.register(project.id, project.repo_path);
      }
      await scheduleDrain();
    },
  };

  return registry;
}
