import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { BackupStatus } from '@throughline/shared';
import type Database from 'better-sqlite3';
import type { DB } from '../db/index.js';
import type { SettingsService } from '../settings/service.js';
import { appendAudit } from '../audit/log.js';

// Backup (T-D28, CODE_SPEC §17). The datastore is a single SQLite file; a snapshot is a
// consistent online copy of it. API keys (T-D4) live in secrets.json and the
// install-shipped methodologies/ directory is outside the datastore, so neither is ever
// part of a snapshot by construction — there is nothing to filter out.

export const DEFAULT_BACKUP_THRESHOLD_DAYS = 7;
export const DEFAULT_ARCHIVE_RETENTION_DAYS = 30;

const KEY_THRESHOLD = 'backup_threshold_days';
export const KEY_AUTO_COPY_TARGET = 'auto_copy_target_path';
export const KEY_BACKUP_NUDGE_INTERVAL_DAYS = 'backup_nudge_interval_days';
const KEY_ARCHIVE_RETENTION = 'archive_retention_days';
const KEY_LAST_BACKUP_AT = 'last_backup_at';
const KEY_LAST_AUTO_COPY_AT = 'last_auto_copy_at';

function toPositiveInt(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

export interface Snapshot {
  path: string;
  filename: string;
  cleanup: () => void;
}

export interface BackupService {
  // Online-consistent copy of the datastore to a temp file. Caller streams it then
  // invokes cleanup(). Records last_backup_at on success.
  createSnapshot(): Promise<Snapshot>;
  status(): BackupStatus;
  // Copies a fresh snapshot to settings.auto_copy_target_path when set. Returns false
  // (a no-op) when no target is configured — snapshots stay local-only.
  autoCopy(): Promise<boolean>;
  // Hygiene (CHECKLIST §15): prune dated archive subdirs older than the retention window.
  pruneArchive(): number;
}

export interface CreateBackupServiceOptions {
  db: DB;
  settings: SettingsService;
  dbPath: string;
  archiveDir: string;
}

function timestampSlug(d: Date): string {
  // Filesystem-safe ISO: 2026-05-17T13-53-21
  return d.toISOString().replace(/:/g, '-').replace(/\..+$/, '');
}

export function createBackupService(opts: CreateBackupServiceOptions): BackupService {
  const { db, settings, dbPath, archiveDir } = opts;

  function thresholdDays(): number {
    return toPositiveInt(settings.get(KEY_THRESHOLD), DEFAULT_BACKUP_THRESHOLD_DAYS);
  }

  function autoCopyTarget(): string | null {
    const v = settings.get(KEY_AUTO_COPY_TARGET);
    return typeof v === 'string' && v.length > 0 ? v : null;
  }

  async function snapshotTo(destPath: string): Promise<void> {
    // better-sqlite3's online backup is WAL-safe and produces a consistent file even
    // while the server is serving traffic — a plain copyFile would miss the WAL.
    await (db as Database.Database).backup(destPath);
  }

  return {
    async createSnapshot() {
      const now = new Date();
      const filename = `throughline-backup-${timestampSlug(now)}.sqlite`;
      const dir = join(tmpdir(), 'throughline-backup');
      mkdirSync(dir, { recursive: true });
      const path = join(dir, filename);
      await snapshotTo(path);
      settings.set(KEY_LAST_BACKUP_AT, now.toISOString());
      appendAudit(db, {
        projectId: null,
        entityType: 'settings',
        entityId: KEY_LAST_BACKUP_AT,
        actor: 'user',
        field: 'backup_export',
        newValue: filename,
      });
      return {
        path,
        filename,
        cleanup: () => {
          try {
            rmSync(path, { force: true });
          } catch {
            /* best-effort temp cleanup */
          }
        },
      };
    },

    status() {
      const lastRaw = settings.get(KEY_LAST_BACKUP_AT);
      const last = typeof lastRaw === 'string' ? lastRaw : null;
      const lastAutoRaw = settings.get(KEY_LAST_AUTO_COPY_AT);
      const lastAuto = typeof lastAutoRaw === 'string' ? lastAutoRaw : null;
      const days = thresholdDays();
      let stale = true;
      if (last) {
        const ageMs = Date.now() - new Date(last).getTime();
        stale = ageMs > days * 24 * 60 * 60 * 1000;
      }
      return {
        last_backup_at: last,
        threshold_days: days,
        stale,
        auto_copy_target_path: autoCopyTarget(),
        last_auto_copy_at: lastAuto,
      };
    },

    async autoCopy() {
      const target = autoCopyTarget();
      if (!target) return false;
      mkdirSync(dirname(target), { recursive: true });
      // Stage to a temp file then copy to the target so a crash mid-backup can't leave
      // a truncated file at the user's configured destination.
      const now = new Date();
      const stageDir = join(tmpdir(), 'throughline-backup');
      mkdirSync(stageDir, { recursive: true });
      const stage = join(stageDir, `auto-${timestampSlug(now)}.sqlite`);
      try {
        await snapshotTo(stage);
        copyFileSync(stage, target);
      } finally {
        try {
          rmSync(stage, { force: true });
        } catch {
          /* best-effort */
        }
      }
      const iso = now.toISOString();
      settings.set(KEY_LAST_AUTO_COPY_AT, iso);
      settings.set(KEY_LAST_BACKUP_AT, iso);
      appendAudit(db, {
        projectId: null,
        entityType: 'settings',
        entityId: KEY_LAST_AUTO_COPY_AT,
        actor: 'system',
        field: 'backup_auto_copy',
        newValue: target,
      });
      return true;
    },

    pruneArchive() {
      const retention = toPositiveInt(
        settings.get(KEY_ARCHIVE_RETENTION),
        DEFAULT_ARCHIVE_RETENTION_DAYS,
      );
      if (!existsSync(archiveDir)) return 0;
      const cutoff = Date.now() - retention * 24 * 60 * 60 * 1000;
      let removed = 0;
      for (const name of readdirSync(archiveDir)) {
        // Dated subdirs are YYYY-MM-DD (inbox worker convention). Anything else is left
        // alone — we only prune what we know we created.
        if (!/^\d{4}-\d{2}-\d{2}$/.test(name)) continue;
        const full = join(archiveDir, name);
        let isDir = false;
        try {
          isDir = statSync(full).isDirectory();
        } catch {
          continue;
        }
        if (!isDir) continue;
        const dayMs = new Date(`${name}T00:00:00.000Z`).getTime();
        if (Number.isNaN(dayMs) || dayMs >= cutoff) continue;
        try {
          rmSync(full, { recursive: true, force: true });
          removed += 1;
        } catch {
          /* best-effort hygiene */
        }
      }
      return removed;
    },
  };
}
