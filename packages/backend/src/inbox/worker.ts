import { nanoid } from 'nanoid';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, join } from 'node:path';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';
import type { ProjectsService } from '../projects/service.js';
import type { DumpZoneService } from '../dump-zone/service.js';

// T-D16, T-D37 — Claude Code push via watched filesystem inbox.
//
// File-to-project routing convention (v1, filename-prefix only):
//   "<project_id>__<rest>.md"    → routed to <project_id>
//   "<anything-without-prefix>"  → routed to last_active_project_id (from settings)
//
// Outcomes:
//   - success → archived to <archiveDir>/YYYY-MM-DD/<original_filename>
//   - failure → quarantined to <failuresDir>/<original_filename> + sibling
//               <original_filename>.error.json with { error, received_at, attempted_project_id }
//
// Per T-D37, these internal file movements are not user-facing writes — the worker performs
// them autonomously. Surface state via the cc_inbox_queue table for the UI.

const PROJECT_PREFIX_RE = /^([A-Za-z0-9_-]+)__/;

interface QueueRow {
  id: string;
  original_path: string;
  received_at: string;
  state: 'queued' | 'processed' | 'failed';
  error_text: string | null;
}

export interface InboxWorkerOptions {
  db: DB;
  projects: ProjectsService;
  dumpZone: DumpZoneService;
  archiveDir: string;
  failuresDir: string;
  getLastActiveProjectId: () => string | null;
  logger?: { info: (m: string) => void; warn: (m: string) => void; error: (m: string) => void };
}

export interface InboxWorker {
  enqueue(filePath: string): string;
  process(id: string): Promise<void>;
  drain(): Promise<void>;
  listQueue(limit?: number): QueueRow[];
}

function dateSubdir(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function createInboxWorker(opts: InboxWorkerOptions): InboxWorker {
  const { db, projects, dumpZone, archiveDir, failuresDir, getLastActiveProjectId, logger } = opts;

  function enqueue(filePath: string): string {
    // Idempotent: if a queued row already exists for this path, return it.
    const existing = db
      .prepare(`SELECT * FROM cc_inbox_queue WHERE original_path = ? AND state = 'queued'`)
      .get(filePath) as QueueRow | undefined;
    if (existing) return existing.id;
    const id = nanoid();
    db.prepare(
      `INSERT INTO cc_inbox_queue (id, original_path, received_at, state, error_text)
       VALUES (?, ?, ?, 'queued', NULL)`,
    ).run(id, filePath, new Date().toISOString());
    logger?.info(`inbox queued ${basename(filePath)} as ${id}`);
    return id;
  }

  function quarantine(row: QueueRow, error: string, attemptedProjectId: string | null): void {
    if (!existsSync(failuresDir)) mkdirSync(failuresDir, { recursive: true });
    const targetName = basename(row.original_path);
    const targetPath = join(failuresDir, targetName);
    try {
      if (existsSync(row.original_path)) {
        copyFileSync(row.original_path, targetPath);
        rmSync(row.original_path, { force: true });
      }
    } catch (copyErr) {
      logger?.warn(
        `inbox quarantine copy failed for ${row.original_path}: ${copyErr instanceof Error ? copyErr.message : String(copyErr)}`,
      );
    }
    writeFileSync(
      targetPath + '.error.json',
      JSON.stringify(
        {
          error,
          received_at: row.received_at,
          attempted_project_id: attemptedProjectId,
        },
        null,
        2,
      ),
      'utf8',
    );
    db.prepare(`UPDATE cc_inbox_queue SET state = 'failed', error_text = ? WHERE id = ?`).run(
      error,
      row.id,
    );
    appendAudit(db, {
      projectId: attemptedProjectId,
      entityType: 'project',
      entityId: attemptedProjectId ?? 'global',
      actor: 'inbox_worker',
      field: 'inbox_failed',
      newValue: error.slice(0, 200),
      triggerContext: { inbox_file_id: row.id, original_filename: targetName },
    });
  }

  function archive(row: QueueRow, projectId: string): void {
    const dayDir = join(archiveDir, dateSubdir());
    if (!existsSync(dayDir)) mkdirSync(dayDir, { recursive: true });
    const targetPath = join(dayDir, basename(row.original_path));
    try {
      if (existsSync(row.original_path)) {
        copyFileSync(row.original_path, targetPath);
        rmSync(row.original_path, { force: true });
      }
    } catch (copyErr) {
      logger?.warn(
        `inbox archive copy failed for ${row.original_path}: ${copyErr instanceof Error ? copyErr.message : String(copyErr)}`,
      );
    }
    db.prepare(`UPDATE cc_inbox_queue SET state = 'processed', error_text = NULL WHERE id = ?`).run(
      row.id,
    );
    appendAudit(db, {
      projectId,
      entityType: 'project',
      entityId: projectId,
      actor: 'inbox_worker',
      field: 'inbox_processed',
      newValue: basename(row.original_path),
      triggerContext: { inbox_file_id: row.id },
    });
  }

  function resolveProjectId(filename: string): string | null {
    const m = PROJECT_PREFIX_RE.exec(filename);
    if (m) {
      const candidate = m[1]!;
      if (projects.get(candidate)) return candidate;
    }
    const fallback = getLastActiveProjectId();
    if (fallback && projects.get(fallback)) return fallback;
    return null;
  }

  async function process(id: string): Promise<void> {
    const row = db.prepare(`SELECT * FROM cc_inbox_queue WHERE id = ?`).get(id) as QueueRow | undefined;
    if (!row) return;
    if (row.state !== 'queued') return;
    if (!existsSync(row.original_path)) {
      quarantine(row, 'file_missing_at_processing', null);
      return;
    }
    const filename = basename(row.original_path);
    const projectId = resolveProjectId(filename);
    if (!projectId) {
      quarantine(row, 'no_project_routing', null);
      return;
    }
    let text: string;
    try {
      text = readFileSync(row.original_path, 'utf8');
    } catch (err) {
      quarantine(row, `read_failed: ${err instanceof Error ? err.message : String(err)}`, projectId);
      return;
    }
    if (text.trim().length === 0) {
      quarantine(row, 'empty_file', projectId);
      return;
    }
    try {
      await dumpZone.propose({
        project_id: projectId,
        text,
        target: 'session',
        source: 'inbox',
        session_id: null,
      });
      archive(row, projectId);
    } catch (err) {
      quarantine(
        row,
        `propose_failed: ${err instanceof Error ? err.message : String(err)}`,
        projectId,
      );
    }
  }

  async function drain(): Promise<void> {
    const queued = db
      .prepare(`SELECT id FROM cc_inbox_queue WHERE state = 'queued' ORDER BY received_at ASC`)
      .all() as Array<{ id: string }>;
    // Serial drain — `cc_inbox_queue processes serially with per-file state tracking` per
    // CHECKLIST §Phase 4. Each propose() may take seconds when the AI extractor runs; running
    // them in parallel risks rate-limiting and makes the UI's "what's processing now" surface
    // ambiguous.
    for (const { id } of queued) {
      await process(id);
    }
  }

  function listQueue(limit = 100): QueueRow[] {
    return db
      .prepare(`SELECT * FROM cc_inbox_queue ORDER BY received_at DESC LIMIT ?`)
      .all(limit) as QueueRow[];
  }

  return { enqueue, process, drain, listQueue };
}
