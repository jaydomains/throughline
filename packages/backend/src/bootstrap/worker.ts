import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { nanoid } from 'nanoid';
import {
  BootstrapNoBundleBoundError,
  BootstrapProjectNotFoundError,
  BootstrapValidationFailedError,
  type BootstrapImportResult,
  type BootstrapImportService,
} from './service.js';
import type { BootstrapWorker } from './watcher.js';

// C-D21 surface 4 — archive/quarantine worker. Mirrors
// `packages/backend/src/inbox/worker.ts` in shape: on success, move the
// detected file into `<repo>/.throughline/bootstrap-archive/` with an
// ISO-timestamp prefix; on failure (parse, validation, or ingest throw),
// move into `<repo>/.throughline/bootstrap-quarantine/` and write a sibling
// `.error.json` carrying the validator error. Archive and quarantine dirs
// are lazy-created (matches inbox.worker.ts:84,132 `mkdirSync recursive`).
//
// Direct-call to `BootstrapImportService.importBootstrap` rather than an
// HTTP self-call (inbox precedent: `dumpZone.propose()`). Avoids serialization
// round-trips, fake auth/origin handling, and an entire test surface (the
// route layer) that the direct call sidesteps. The Phase 20 POST /import
// route remains exposed for external callers.

export interface BootstrapWorkerOptions {
  importService: BootstrapImportService;
  logger?: {
    info: (m: string) => void;
    warn: (m: string) => void;
    error: (m: string) => void;
  };
}

export interface LastIngest {
  at: string;
  counts: BootstrapImportResult['counts'];
}

export interface BootstrapWorkerWithState extends BootstrapWorker {
  // Slice 4 reads the most-recent ingest result for the unified Bootstrap
  // block's status display. In-memory: persistence across backend restart is
  // not a v1 requirement (the user re-renders or queries the archive
  // directly if they want historical state).
  getLastIngest(projectId: string): LastIngest | null;
}

interface QueueItem {
  projectId: string;
  filePath: string;
}

const BOOTSTRAP_OUTPUT_FILENAME = 'bootstrap-output.json';
const ARCHIVE_SUBDIR = 'bootstrap-archive';
const QUARANTINE_SUBDIR = 'bootstrap-quarantine';
// Suffix of the .error.json marker written on EVERY quarantine (before the payload copy
// that may fail). Counting these markers — not the payload copies — is what makes a
// copy-failure quarantine visible (SF1-03 / SF1-01 residual).
const QUARANTINE_ERROR_SUFFIX = '-bootstrap-output.error.json';

// Filesystem-safe, collision-free filename prefix (S1-01). The ISO timestamp keeps the
// dated-subdir intent (sortable, no colons — Windows-hostile), but second/millisecond
// resolution alone collided: two ingests within the same tick produced the same prefix,
// so the second archive/quarantine write clobbered the first. A nanoid suffix guarantees
// uniqueness regardless of clock resolution or two writes landing in the same millisecond.
function timestampPrefix(): string {
  const iso = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
  return `${iso}-${nanoid(6)}`;
}

export function createBootstrapWorker(opts: BootstrapWorkerOptions): BootstrapWorkerWithState {
  const { importService, logger } = opts;
  const queue: QueueItem[] = [];
  const lastIngest = new Map<string, LastIngest>();
  let draining = false;

  function targetDir(filePath: string, subdir: string): string {
    // filePath is <repo>/.throughline/bootstrap-output.json. The archive /
    // quarantine subdirectories live alongside it under .throughline/.
    return join(dirname(filePath), subdir);
  }

  function moveToSubdir(filePath: string, subdir: string): string {
    const dir = targetDir(filePath, subdir);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const target = join(dir, `${timestampPrefix()}-${BOOTSTRAP_OUTPUT_FILENAME}`);
    copyFileSync(filePath, target);
    rmSync(filePath, { force: true });
    return target;
  }

  function archive(filePath: string, result: BootstrapImportResult): string {
    const archived = moveToSubdir(filePath, ARCHIVE_SUBDIR);
    lastIngest.set(result.project_id, {
      at: new Date().toISOString(),
      counts: result.counts,
    });
    return archived;
  }

  function quarantine(filePath: string, errorPayload: unknown): { jsonPath: string; errorPath: string } {
    const dir = targetDir(filePath, QUARANTINE_SUBDIR);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const stamp = timestampPrefix();
    const jsonPath = join(dir, `${stamp}-${BOOTSTRAP_OUTPUT_FILENAME}`);
    const errorPath = join(dir, `${stamp}${QUARANTINE_ERROR_SUFFIX}`);
    // Always emit the .error.json so the user can see what the worker
    // observed even if the payload move fails (permissions on the
    // quarantine dir, disk full, etc.).
    writeFileSync(errorPath, `${JSON.stringify(errorPayload, null, 2)}\n`, 'utf8');
    try {
      copyFileSync(filePath, jsonPath);
    } catch (err) {
      // Copy failed — leave the source file in place so the user can
      // inspect / retry the failing payload manually. Mirrors the inbox
      // precedent (inbox/worker.ts:92-101): copy + rm sit inside one try
      // so a failed copy aborts the delete.
      logger?.warn(
        `bootstrap quarantine copy failed for ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { jsonPath, errorPath };
    }
    rmSync(filePath, { force: true });
    return { jsonPath, errorPath };
  }

  async function processOne(item: QueueItem): Promise<void> {
    const { projectId, filePath } = item;
    if (!existsSync(filePath)) {
      // File vanished between watcher event and processing — chokidar can
      // fire after a rapid write-then-delete (e.g. the user cleared their
      // .throughline/ manually before the drain ran). Nothing to do.
      logger?.warn(`bootstrap worker: file vanished before processing: ${filePath}`);
      return;
    }

    let body: string;
    try {
      body = readFileSync(filePath, 'utf8');
    } catch (err) {
      quarantine(filePath, {
        error: 'read_failed',
        message: err instanceof Error ? err.message : String(err),
        project_id: projectId,
        received_at: new Date().toISOString(),
      });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch (err) {
      quarantine(filePath, {
        error: 'parse_failed',
        message: err instanceof Error ? err.message : String(err),
        project_id: projectId,
        received_at: new Date().toISOString(),
      });
      return;
    }

    try {
      const result = importService.importBootstrap(projectId, parsed);
      archive(filePath, result);
      logger?.info(
        `bootstrap ingested ${projectId}: ` +
          `new=${result.counts.new}, reimported=${result.counts.reimported}, ` +
          `conflict=${result.counts.conflict}, stale_flagged=${result.counts.stale_flagged}`,
      );
    } catch (err) {
      const received_at = new Date().toISOString();
      if (err instanceof BootstrapValidationFailedError) {
        quarantine(filePath, {
          error: 'validation_failed',
          errors: err.errors,
          project_id: projectId,
          received_at,
        });
        return;
      }
      if (err instanceof BootstrapNoBundleBoundError) {
        quarantine(filePath, {
          error: 'no_bundle_bound',
          message: `project ${projectId} lost its bundle binding between render and ingest`,
          project_id: projectId,
          received_at,
        });
        return;
      }
      if (err instanceof BootstrapProjectNotFoundError) {
        quarantine(filePath, {
          error: 'project_not_found',
          message: `project ${projectId} was deleted between render and ingest`,
          project_id: projectId,
          received_at,
        });
        return;
      }
      // Unexpected throw — quarantine with a generic envelope. We don't
      // re-raise: the watcher's serial drain catches all errors anyway, but
      // surfacing a quarantine + .error.json gives the user a recoverable
      // surface (vs a silent dropped file).
      logger?.error(
        `bootstrap worker unexpected error for ${projectId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      quarantine(filePath, {
        error: 'ingest_failed',
        message: err instanceof Error ? err.message : String(err),
        project_id: projectId,
        received_at,
      });
    }
  }

  return {
    enqueue(projectId, filePath) {
      // Idempotent guard against duplicate enqueues for the same path while
      // a drain is in flight — chokidar may emit both `add` and a follow-up
      // `change` for the same write, and we don't want to re-process the
      // file just because the watcher saw two events.
      if (queue.some((q) => q.projectId === projectId && q.filePath === filePath)) return;
      queue.push({ projectId, filePath });
    },

    async drain() {
      if (draining) {
        // Caller's chained-promise drain (watcher.scheduleDrain) ensures
        // serial drain semantics; this re-entrancy guard is belt-and-braces
        // for direct test callers.
        return;
      }
      draining = true;
      try {
        while (queue.length > 0) {
          const item = queue.shift()!;
          await processOne(item);
        }
      } finally {
        draining = false;
      }
    },

    getLastIngest(projectId) {
      return lastIngest.get(projectId) ?? null;
    },
  };
}

// C-D21 surface 4 — `GET /api/projects/:id/bootstrap/state` derives the
// filesystem state from the repo directly + the in-memory last-ingest cache.
// Read-only against fs + the worker's state map; no DB queries beyond what
// the calling code provides for project lookup.

export interface BootstrapState {
  throughlineDir: 'absent' | 'present';
  promptRendered: boolean;
  pendingOutput: boolean;
  lastIngest: LastIngest | null;
  archiveCount: number;
  quarantineCount: number;
  promptPath: string | null;
  outputPath: string | null;
}

export function readBootstrapState(
  repoPath: string,
  lastIngest: LastIngest | null,
): BootstrapState {
  const throughlineDir = join(repoPath, '.throughline');
  if (!existsSync(throughlineDir)) {
    return {
      throughlineDir: 'absent',
      promptRendered: false,
      pendingOutput: false,
      lastIngest,
      archiveCount: 0,
      quarantineCount: 0,
      promptPath: null,
      outputPath: null,
    };
  }
  const promptPath = join(throughlineDir, 'bootstrap-prompt.md');
  const outputPath = join(throughlineDir, BOOTSTRAP_OUTPUT_FILENAME);
  const archiveDir = join(throughlineDir, ARCHIVE_SUBDIR);
  const quarantineDir = join(throughlineDir, QUARANTINE_SUBDIR);

  function countBySuffix(dir: string, suffix: string): number {
    if (!existsSync(dir)) return 0;
    try {
      return readdirSync(dir).filter((name) => name.endsWith(suffix)).length;
    } catch {
      return 0;
    }
  }

  return {
    throughlineDir: 'present',
    promptRendered: existsSync(promptPath),
    pendingOutput: existsSync(outputPath),
    lastIngest,
    archiveCount: countBySuffix(archiveDir, `-${BOOTSTRAP_OUTPUT_FILENAME}`),
    // Count the .error.json marker (1 per quarantine, written before the copy that may
    // fail) so a copy-failure — which leaves only the marker — is no longer invisible
    // (SF1-03 / SF1-01 residual / S1-03).
    quarantineCount: countBySuffix(quarantineDir, QUARANTINE_ERROR_SUFFIX),
    promptPath: existsSync(promptPath) ? promptPath : null,
    outputPath,
  };
}
