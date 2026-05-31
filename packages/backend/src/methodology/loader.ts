import chokidar, { type FSWatcher } from 'chokidar';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import type { BundleLoadResult, Project } from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';
import { parseBundle } from './bundle-parser/index.js';

export interface MethodologyRegistry {
  list(): BundleLoadResult[];
  get(bundleId: string): BundleLoadResult | undefined;
  has(bundleId: string): boolean;
  reload(bundleId: string): BundleLoadResult | undefined;
  // C-D14 + C-D19 — resolve a project's bundle. Precedence:
  //   1. <bundlePath>/bundle.md (C-D14)
  //   2. <repoPath>/.throughline/bundle.md (T-D51, C-D19 surface 1)
  //   3. install-shipped methodologies/<bundleId>/bundle.md (T-D41)
  resolveBundle(bundleId: string, bundlePath?: string | null, repoPath?: string | null): BundleLoadResult;
  hasBundle(bundleId: string, bundlePath?: string | null, repoPath?: string | null): boolean;
  // C-D14 + C-D19 — bundle source files become watch targets, refcounted by project.
  // Arm 1 watches <bundlePath>/bundle.md; arm 2 watches <repoPath>/.throughline/bundle.md.
  registerProjectBundle(
    projectId: string,
    bundleId: string,
    bundlePath?: string | null,
    repoPath?: string | null,
  ): void;
  unregisterProjectBundle(projectId: string): void;
  stop(): Promise<void>;
}

/**
 * Canonical project→bundle resolution (T-D51, C-D19). Takes the project so `repo_path` is
 * always threaded into the resolver — arm 2 (`<repo_path>/.throughline/bundle.md`) can never
 * be silently skipped. Prefer this over calling `registry.resolveBundle(...)` with a
 * project's fields by hand: omitting `repo_path` at the call site is exactly the F1-01 /
 * S5-02 defect this helper makes structurally impossible.
 */
export function resolveProjectBundle(
  registry: MethodologyRegistry,
  project: Pick<Project, 'bundle_id' | 'bundle_path' | 'repo_path'>,
): BundleLoadResult {
  return registry.resolveBundle(project.bundle_id, project.bundle_path, project.repo_path);
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
    try {
      if (!statSync(full).isDirectory()) return false;
    } catch {
      // S3-03: a dangling symlink (or otherwise unreadable entry) makes statSync throw.
      // Skip just that entry rather than letting it abort the whole startup hydration.
      return false;
    }
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
  // C-D19 surface 1 — per-repo `<repo_path>/.throughline/bundle.md` arm.
  // Same refcounted-watch shape as externalCache/externalMeta; the second-arm
  // file lives inside the project's repo rather than at an arbitrary external
  // path. Resolution falls through to install-shipped (arm 3) when the
  // per-repo file is absent or parses as an error.
  const repoCache = new Map<string, BundleLoadResult>();
  const repoMeta = new Map<string, { bundleId: string; refs: Set<string> }>();

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

  // C-D19 surface 1 — audit binding helper for the per-repo arm. Projects on
  // arm 2 have NULL bundle_path and a repo_path whose `.throughline/bundle.md`
  // matches the watched file.
  function projectsBoundToRepoFile(file: string): string[] {
    return (
      db
        .prepare(
          "SELECT id FROM projects WHERE bundle_path IS NULL AND repo_path = ?",
        )
        .all(repoDirFromFile(file)) as Array<{ id: string }>
    ).map((r) => r.id);
  }

  function repoDirFromFile(file: string): string {
    // <repoPath>/.throughline/bundle.md → <repoPath>
    return dirname(dirname(file));
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

  function repoFileFor(repoPath: string): string {
    return join(repoPath, '.throughline', 'bundle.md');
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

  // C-D19 surface 1 — per-repo bundle load. Mirrors loadExternalFile's TOCTOU-
  // safe pattern: attempt the read directly, fold any fs failure into a normal
  // bundle-load error. The 'ENOENT' result is meaningful for the third arm —
  // resolveBundle uses it as the "fall through to install-shipped" signal.
  //
  // ENOENT is the *expected* state for clone-and-go projects whose repo has not
  // yet gained a `.throughline/bundle.md` — those projects resolve via arm 3
  // and there is no real binding event to record. Skip audit + notify on
  // ENOENT so startup hydration does not produce per-project noise; non-ENOENT
  // read failures (EACCES, EIO, …) remain auditable misconfigurations.
  function loadRepoFile(file: string, bundleId: string): BundleLoadResult {
    const prev = repoCache.get(file);
    let result: BundleLoadResult;
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
      repoCache.set(file, result);
      if (code !== 'ENOENT') {
        logger?.error(`per-repo bundle "${bundleId}" unreadable at ${file} (${code})`);
        const bound = projectsBoundToRepoFile(file);
        writeLoadAudit(bundleId, bound, result, previousVersion(prev));
        notifyReloaded(bundleId, bound);
      }
      return result;
    }
    result = parseBundle(bundleId, md);
    if (result.status === 'error') {
      logger?.error(
        `per-repo bundle "${bundleId}" (${file}) failed to load: ${result.errors
          .map((e) => e.message)
          .join('; ')}`,
      );
    } else {
      logger?.info(
        `per-repo bundle "${bundleId}" loaded from ${file} (version ${result.bundle.identity.version}).`,
      );
    }
    repoCache.set(file, result);
    const bound = projectsBoundToRepoFile(file);
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
      // SF5-08: guard the whole handler. This is the one watch site whose callback was
      // unguarded — a throw here runs inside chokidar's emit and would be swallowed (the
      // file event silently lost). Contain it so the watcher stays alive.
      try {
        if (filePath.startsWith(methodologiesDir + sep)) {
          const rel = filePath.slice(methodologiesDir.length + 1);
          const id = rel.split(sep)[0];
          if (!id) return;
          if (event === 'unlink') {
            cache.delete(id);
            // S3-01/SF2-05: notify projects bound to this install bundle so they reload
            // (and surface the now-absent/error state) — was silent for arm-3 deletion.
            notifyReloaded(id, projectsBoundToBundle(id));
            return;
          }
          reload(id);
          return;
        }
        // External per-project bundle file (C-D14).
        const externalMetaEntry = externalMeta.get(filePath);
        if (externalMetaEntry) {
          if (event === 'unlink') {
            externalCache.delete(filePath);
            // S3-01/SF2-05: notify projects bound to this external path so they reload via
            // the arm-3 install fallback — was silent for arm-1 deletion.
            notifyReloaded(externalMetaEntry.bundleId, projectsBoundToPath(dirname(filePath)));
            return;
          }
          loadExternalFile(filePath, externalMetaEntry.bundleId);
          return;
        }
        // Per-repo bundle file (C-D19 surface 1).
        const repoMetaEntry = repoMeta.get(filePath);
        if (!repoMetaEntry) return;
        if (event === 'unlink') {
          repoCache.delete(filePath);
          // Notify projects bound to this repo so they reload via arm 3 fallback.
          const bound = projectsBoundToRepoFile(filePath);
          notifyReloaded(repoMetaEntry.bundleId, bound);
          return;
        }
        loadRepoFile(filePath, repoMetaEntry.bundleId);
      } catch (err) {
        logger?.error(
          `methodology watcher handler failed for ${event} ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });
  }

  function resolveBundle(
    bundleId: string,
    bundlePath?: string | null,
    repoPath?: string | null,
  ): BundleLoadResult {
    // Arm 1 — explicit external bundle_path.
    if (bundlePath) {
      const file = externalFileFor(bundlePath);
      return externalCache.get(file) ?? loadExternalFile(file, bundleId);
    }
    // Arm 2 — per-repo `<repoPath>/.throughline/bundle.md`.
    if (repoPath) {
      const file = repoFileFor(repoPath);
      const cached = repoCache.get(file);
      const result = cached ?? loadRepoFile(file, bundleId);
      // Only count arm 2 as a hit when the file loaded successfully. ENOENT
      // (and other read errors) fall through to arm 3 so the install-shipped
      // bundle remains the safety net.
      if (result.status === 'loaded') return result;
    }
    // Arm 3 — install-shipped fallback.
    return (
      cache.get(bundleId) ?? {
        status: 'error',
        bundle_id: bundleId,
        errors: [{ bundle_id: bundleId, message: 'bundle.md missing' }],
      }
    );
  }

  function hasBundle(
    bundleId: string,
    bundlePath?: string | null,
    repoPath?: string | null,
  ): boolean {
    return resolveBundle(bundleId, bundlePath, repoPath).status === 'loaded';
  }

  function registerProjectBundle(
    projectId: string,
    bundleId: string,
    bundlePath?: string | null,
    repoPath?: string | null,
  ): void {
    // Arm 1 wins: when bundle_path is set, only that file is watched per project.
    if (bundlePath) {
      const file = externalFileFor(bundlePath);
      let meta = externalMeta.get(file);
      if (!meta) {
        meta = { bundleId, refs: new Set() };
        externalMeta.set(file, meta);
        if (watcher) watcher.add(file);
        if (!externalCache.has(file)) loadExternalFile(file, bundleId);
      }
      meta.refs.add(projectId);
      return;
    }
    // Arm 2 — watch the per-repo file even if it doesn't currently exist; a
    // future creation fires chokidar's `add` event and shifts the binding from
    // arm 3 to arm 2 reactively (clone-and-go intent: a repo gaining
    // `.throughline/bundle.md` later in its life should bind without manual
    // re-init).
    if (repoPath) {
      const file = repoFileFor(repoPath);
      let meta = repoMeta.get(file);
      if (!meta) {
        meta = { bundleId, refs: new Set() };
        repoMeta.set(file, meta);
        if (watcher) watcher.add(file);
        if (!repoCache.has(file)) loadRepoFile(file, bundleId);
      }
      meta.refs.add(projectId);
    }
    // Else arm 3 — install-shipped methodologies dir already watched globally.
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
    for (const [file, meta] of repoMeta) {
      if (!meta.refs.has(projectId)) continue;
      meta.refs.delete(projectId);
      if (meta.refs.size === 0) {
        if (watcher) watcher.unwatch(file);
        repoMeta.delete(file);
        repoCache.delete(file);
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
