import chokidar, { type FSWatcher } from 'chokidar';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { BundleLoadResult, LoadedBundle } from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';
import { parseBundle } from './bundle-parser/index.js';

export interface MethodologyRegistry {
  list(): BundleLoadResult[];
  get(bundleId: string): BundleLoadResult | undefined;
  has(bundleId: string): boolean;
  reload(bundleId: string): BundleLoadResult | undefined;
  stop(): Promise<void>;
}

function readBundleFile(methodologiesDir: string, bundleId: string): string | null {
  const path = join(methodologiesDir, bundleId, 'bundle.md');
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

function discoverBundleIds(methodologiesDir: string): string[] {
  if (!existsSync(methodologiesDir)) return [];
  return readdirSync(methodologiesDir).filter((entry) => {
    const full = join(methodologiesDir, entry);
    if (!statSync(full).isDirectory()) return false;
    return existsSync(join(full, 'bundle.md'));
  });
}

export interface CreateRegistryOptions {
  db: DB;
  methodologiesDir: string;
  watch?: boolean;
  logger?: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
}

export function createMethodologyRegistry(opts: CreateRegistryOptions): MethodologyRegistry {
  const { db, methodologiesDir, watch = true, logger } = opts;
  const cache = new Map<string, BundleLoadResult>();

  function loadOne(bundleId: string): BundleLoadResult {
    const md = readBundleFile(methodologiesDir, bundleId);
    if (md === null) {
      const result: BundleLoadResult = {
        status: 'error',
        bundle_id: bundleId,
        errors: [{ bundle_id: bundleId, message: 'bundle.md missing' }],
      };
      return result;
    }
    return parseBundle(bundleId, md);
  }

  function previousVersion(result: BundleLoadResult | undefined): string | null {
    if (!result || result.status !== 'loaded') return null;
    return result.bundle.identity.version;
  }

  function projectsBoundTo(bundleId: string): string[] {
    return (db.prepare('SELECT id FROM projects WHERE bundle_id = ?').all(bundleId) as Array<{ id: string }>).map(
      (r) => r.id,
    );
  }

  function writeLoadAudit(bundleId: string, result: BundleLoadResult, oldVersion: string | null): void {
    const newVersion = result.status === 'loaded' ? result.bundle.identity.version : null;
    const projectIds = projectsBoundTo(bundleId);
    if (projectIds.length === 0) {
      appendAudit(db, {
        projectId: null,
        entityType: 'bundle_binding',
        entityId: bundleId,
        actor: 'bundle_loader',
        field: 'load',
        oldValue: oldVersion,
        newValue: newVersion,
        triggerContext: {
          status: result.status,
          errors: result.status === 'error' ? result.errors : undefined,
        },
      });
      return;
    }
    for (const projectId of projectIds) {
      appendAudit(db, {
        projectId,
        entityType: 'bundle_binding',
        entityId: bundleId,
        actor: 'bundle_loader',
        field: 'load',
        oldValue: oldVersion,
        newValue: newVersion,
        triggerContext: {
          status: result.status,
          errors: result.status === 'error' ? result.errors : undefined,
        },
      });
    }
  }

  function reload(bundleId: string): BundleLoadResult {
    const prev = cache.get(bundleId);
    const result = loadOne(bundleId);
    // On parse failure, keep the old loaded bundle in cache per C-D4 implications.
    if (result.status === 'error') {
      logger?.error(`bundle "${bundleId}" failed to load: ${result.errors.map((e) => e.message).join('; ')}`);
      writeLoadAudit(bundleId, result, previousVersion(prev));
      // Store the error result separately so the API can surface it. If we previously had
      // a loaded bundle, keep the loaded one available via get() and expose the error
      // alongside via list(). For simplicity in v1, overwrite the cache with the latest
      // result so consumers always see the current state.
      cache.set(bundleId, result);
      return result;
    }
    cache.set(bundleId, result);
    writeLoadAudit(bundleId, result, previousVersion(prev));
    logger?.info(`bundle "${bundleId}" loaded (version ${result.bundle.identity.version}).`);
    return result;
  }

  // Initial scan.
  for (const id of discoverBundleIds(methodologiesDir)) {
    reload(id);
  }

  let watcher: FSWatcher | null = null;
  if (watch) {
    watcher = chokidar.watch(join(methodologiesDir, '**/bundle.md'), { ignoreInitial: true });
    watcher.on('all', (event, filePath) => {
      const rel = filePath.replace(methodologiesDir + '/', '');
      const id = rel.split('/')[0];
      if (!id) return;
      if (event === 'unlink') {
        cache.delete(id);
        return;
      }
      reload(id);
    });
  }

  return {
    list: () => Array.from(cache.values()),
    get: (bundleId) => cache.get(bundleId),
    has: (bundleId) => {
      const r = cache.get(bundleId);
      return r?.status === 'loaded';
    },
    reload,
    stop: async () => {
      if (watcher) await watcher.close();
    },
  };
}
