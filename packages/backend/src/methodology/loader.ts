import chokidar, { type FSWatcher } from 'chokidar';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import type { BundleLoadResult, LoadedBundle } from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';
import { parseBundle } from './bundle-parser/index.js';

export interface MethodologyRegistry {
  list(): BundleLoadResult[];
  get(bundleId: string): BundleLoadResult | undefined;
  has(bundleId: string): boolean;
  reload(bundleId: string): BundleLoadResult | undefined;
  // C-D14 — resolve a project's bundle: external `bundlePath/bundle.md` when set,
  // else the install-shipped `methodologies/<bundleId>/bundle.md`.
  resolveBundle(bundleId: string, bundlePath?: string | null): BundleLoadResult;
  hasBundle(bundleId: string, bundlePath?: string | null): boolean;
  // C-D14 — external bundle dirs become watch targets, refcounted by project.
  registerProjectBundle(projectId: string, bundleId: string, bundlePath?: string | null): void;
  unregisterProjectBundle(projectId: string): void;
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
  // Phase 9 (C-D7) — invoked after a bundle (re)loads with the project ids bound to it,
  // so project-bound scanners can tear down and rebuild against the new ruleset.
  onBundleReloaded?: (bundleId: string, projectIds: string[]) => void;
  logger?: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
}

export function createMethodologyRegistry(opts: CreateRegistryOptions): MethodologyRegistry {
  const { db, methodologiesDir, watch = true, onBundleReloaded, logger } = opts;

  function notifyReloaded(bundleId: string, projectIds: string[]): void {
    if (!onBundleReloaded) return;
    try {
      onBundleReloaded(bundleId, projectIds);
    } catch (err) {
      logger?.warn(
        `onBundleReloaded hook failed for "${bundleId}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
  const cache = new Map<string, BundleLoadResult>();
  // C-D14 — external bundles keyed by absolute bundle.md path; `refs` refcounts
  // the projects bound to that path so the watch target lives exactly as long
  // as at least one project needs it.
  const externalCache = new Map<string, BundleLoadResult>();
  const externalMeta = new Map<string, { bundleId: string; refs: Set<string> }>();

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

  function projectsBoundToBundle(bundleId: string): string[] {
    return (db.prepare('SELECT id FROM projects WHERE bundle_id = ?').all(bundleId) as Array<{ id: string }>).map(
      (r) => r.id,
    );
  }

  function projectsBoundToPath(bundleDir: string): string[] {
    return (
      db.prepare('SELECT id FROM projects WHERE bundle_path = ?').all(bundleDir) as Array<{ id: string }>
    ).map((r) => r.id);
  }

  function writeLoadAudit(
    entityId: string,
    projectIds: string[],
    result: BundleLoadResult,
    oldVersion: string | null,
  ): void {
    const newVersion = result.status === 'loaded' ? result.bundle.identity.version : null;
    const triggerContext = {
      status: result.status,
      errors: result.status === 'error' ? result.errors : undefined,
    };
    const targets: Array<string | null> = projectIds.length === 0 ? [null] : projectIds;
    for (const projectId of targets) {
      appendAudit(db, {
        projectId,
        entityType: 'bundle_binding',
        entityId,
        actor: 'bundle_loader',
        field: 'load',
        oldValue: oldVersion,
        newValue: newVersion,
        triggerContext,
      });
    }
  }

  function reload(bundleId: string): BundleLoadResult {
    const prev = cache.get(bundleId);
    const result = loadOne(bundleId);
    const boundProjects = projectsBoundToBundle(bundleId);
    if (result.status === 'error') {
      logger?.error(`bundle "${bundleId}" failed to load: ${result.errors.map((e) => e.message).join('; ')}`);
      writeLoadAudit(bundleId, boundProjects, result, previousVersion(prev));
      cache.set(bundleId, result);
      notifyReloaded(bundleId, boundProjects);
      return result;
    }
    cache.set(bundleId, result);
    writeLoadAudit(bundleId, boundProjects, result, previousVersion(prev));
    logger?.info(`bundle "${bundleId}" loaded (version ${result.bundle.identity.version}).`);
    notifyReloaded(bundleId, boundProjects);
    return result;
  }

  function externalFileFor(bundlePath: string): string {
    return join(bundlePath, 'bundle.md');
  }

  function loadExternalFile(file: string, bundleId: string): BundleLoadResult {
    const prev = externalCache.get(file);
    let result: BundleLoadResult;
    // No existsSync pre-check: it is TOCTOU-prone and misses EACCES/EIO. Attempt
    // the read directly and turn any fs failure (ENOENT, EACCES, EIO, …) into a
    // normal bundle-load error so neither the chokidar watcher nor resolveBundle
    // can throw an unhandled exception.
    let md: string;
    try {
      md = readFileSync(file, 'utf8');
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? 'EUNKNOWN';
      result = {
        status: 'error',
        bundle_id: bundleId,
        errors: [{ bundle_id: bundleId, message: `cannot read bundle.md at ${file} (${code})` }],
      };
      logger?.error(`external bundle "${bundleId}" unreadable at ${file} (${code})`);
      externalCache.set(file, result);
      const bound = projectsBoundToPath(dirname(file));
      writeLoadAudit(bundleId, bound, result, previousVersion(prev));
      notifyReloaded(bundleId, bound);
      return result;
    }
    result = parseBundle(bundleId, md);
    if (result.status === 'error') {
      logger?.error(
        `external bundle "${bundleId}" (${file}) failed to load: ${result.errors
          .map((e) => e.message)
          .join('; ')}`,
      );
    } else {
      logger?.info(
        `external bundle "${bundleId}" loaded from ${file} (version ${result.bundle.identity.version}).`,
      );
    }
    externalCache.set(file, result);
    const bound = projectsBoundToPath(dirname(file));
    writeLoadAudit(bundleId, bound, result, previousVersion(prev));
    notifyReloaded(bundleId, bound);
    return result;
  }

  // Initial scan of install-shipped bundles.
  for (const id of discoverBundleIds(methodologiesDir)) {
    reload(id);
  }

  let watcher: FSWatcher | null = null;
  if (watch) {
    watcher = chokidar.watch(join(methodologiesDir, '**/bundle.md'), { ignoreInitial: true });
    watcher.on('all', (event, filePath) => {
      if (filePath.startsWith(methodologiesDir + sep)) {
        const rel = filePath.slice(methodologiesDir.length + 1);
        const id = rel.split(sep)[0];
        if (!id) return;
        if (event === 'unlink') {
          cache.delete(id);
          return;
        }
        reload(id);
        return;
      }
      // External per-project bundle file (C-D14).
      const meta = externalMeta.get(filePath);
      if (!meta) return;
      if (event === 'unlink') {
        externalCache.delete(filePath);
        return;
      }
      loadExternalFile(filePath, meta.bundleId);
    });
  }

  function resolveBundle(bundleId: string, bundlePath?: string | null): BundleLoadResult {
    if (bundlePath) {
      const file = externalFileFor(bundlePath);
      return externalCache.get(file) ?? loadExternalFile(file, bundleId);
    }
    return (
      cache.get(bundleId) ?? {
        status: 'error',
        bundle_id: bundleId,
        errors: [{ bundle_id: bundleId, message: 'bundle.md missing' }],
      }
    );
  }

  function hasBundle(bundleId: string, bundlePath?: string | null): boolean {
    return resolveBundle(bundleId, bundlePath).status === 'loaded';
  }

  function registerProjectBundle(projectId: string, bundleId: string, bundlePath?: string | null): void {
    if (!bundlePath) return;
    const file = externalFileFor(bundlePath);
    let meta = externalMeta.get(file);
    if (!meta) {
      meta = { bundleId, refs: new Set() };
      externalMeta.set(file, meta);
      if (watcher) watcher.add(file);
      if (!externalCache.has(file)) loadExternalFile(file, bundleId);
    }
    meta.refs.add(projectId);
  }

  function unregisterProjectBundle(projectId: string): void {
    for (const [file, meta] of externalMeta) {
      if (!meta.refs.has(projectId)) continue;
      meta.refs.delete(projectId);
      if (meta.refs.size === 0) {
        if (watcher) watcher.unwatch(file);
        externalMeta.delete(file);
        externalCache.delete(file);
      }
    }
  }

  return {
    list: () => Array.from(cache.values()),
    get: (bundleId) => cache.get(bundleId),
    has: (bundleId) => {
      const r = cache.get(bundleId);
      return r?.status === 'loaded';
    },
    reload,
    resolveBundle,
    hasBundle,
    registerProjectBundle,
    unregisterProjectBundle,
    stop: async () => {
      if (watcher) await watcher.close();
    },
  };
}
