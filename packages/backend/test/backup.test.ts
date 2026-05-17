import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openDb } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { createSettingsService } from '../src/settings/service.js';
import { createBackupService } from '../src/backup/service.js';
import { createBackupScheduler } from '../src/backup/scheduler.js';
import { writeSecrets, secretsPresence } from '../src/secrets/store.js';
import { makeTmpConfig } from './helpers.js';

describe('backup service (T-D28)', () => {
  it('exports a consistent, restorable snapshot that omits the secrets file', async () => {
    const cfg = makeTmpConfig();
    try {
      const db = openDb(cfg.dbPath);
      runMigrations(db);
      // A row to prove the snapshot carries data.
      db.prepare(
        'INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)',
      ).run('marker', '"hello"', new Date().toISOString());
      // API keys live in a separate file (T-D4) — never in the datastore.
      writeSecrets(cfg.secretsPath, { anthropic_api_key: 'sk-secret' });

      const settings = createSettingsService(db);
      const backup = createBackupService({
        db,
        settings,
        dbPath: cfg.dbPath,
        archiveDir: cfg.archiveDir,
      });

      const snap = await backup.createSnapshot();
      expect(snap.filename).toMatch(/^throughline-backup-.*\.sqlite$/);
      expect(existsSync(snap.path)).toBe(true);

      // Snapshot opens as a valid DB and carries the row.
      const restored = openDb(snap.path);
      const row = restored
        .prepare('SELECT value_json FROM settings WHERE key = ?')
        .get('marker') as { value_json: string };
      expect(row.value_json).toBe('"hello"');
      restored.close();

      // The snapshot is the SQLite file only — the secret never appears in its bytes.
      expect(readFileSync(snap.path).includes(Buffer.from('sk-secret'))).toBe(false);

      // last_backup_at recorded ⇒ status is fresh.
      const status = backup.status();
      expect(status.last_backup_at).not.toBeNull();
      expect(status.stale).toBe(false);
      expect(status.threshold_days).toBe(7);

      snap.cleanup();
      expect(existsSync(snap.path)).toBe(false);
      db.close();
    } finally {
      cfg.cleanup();
    }
  });

  it('reports stale once threshold days elapse and never-backed-up as stale', () => {
    const cfg = makeTmpConfig();
    try {
      const db = openDb(cfg.dbPath);
      runMigrations(db);
      const settings = createSettingsService(db);
      const backup = createBackupService({
        db,
        settings,
        dbPath: cfg.dbPath,
        archiveDir: cfg.archiveDir,
      });

      expect(backup.status().stale).toBe(true); // never backed up

      settings.set('backup_threshold_days', 7);
      const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      settings.set('last_backup_at', old);
      expect(backup.status().stale).toBe(true);

      settings.set('last_backup_at', new Date().toISOString());
      expect(backup.status().stale).toBe(false);
      db.close();
    } finally {
      cfg.cleanup();
    }
  });

  it('auto-copies to the configured target and is a no-op when unset', async () => {
    const cfg = makeTmpConfig();
    try {
      const db = openDb(cfg.dbPath);
      runMigrations(db);
      const settings = createSettingsService(db);
      const backup = createBackupService({
        db,
        settings,
        dbPath: cfg.dbPath,
        archiveDir: cfg.archiveDir,
      });

      expect(await backup.autoCopy()).toBe(false); // no target ⇒ local-only no-op

      const target = join(cfg.dataDir, 'offsite', 'copy.sqlite');
      settings.set('auto_copy_target_path', target);
      expect(await backup.autoCopy()).toBe(true);
      expect(existsSync(target)).toBe(true);
      // The copied file is a valid datastore.
      const copy = openDb(target);
      expect(copy.prepare('SELECT COUNT(*) AS n FROM settings').get()).toBeDefined();
      copy.close();
      expect(backup.status().last_auto_copy_at).not.toBeNull();
      db.close();
    } finally {
      cfg.cleanup();
    }
  });

  it('prunes dated archive subdirs older than the retention window', () => {
    const cfg = makeTmpConfig();
    try {
      const db = openDb(cfg.dbPath);
      runMigrations(db);
      const settings = createSettingsService(db);
      settings.set('archive_retention_days', 30);
      const backup = createBackupService({
        db,
        settings,
        dbPath: cfg.dbPath,
        archiveDir: cfg.archiveDir,
      });

      mkdirSync(cfg.archiveDir, { recursive: true });
      const oldDay = '2000-01-01';
      const today = new Date().toISOString().slice(0, 10);
      mkdirSync(join(cfg.archiveDir, oldDay), { recursive: true });
      writeFileSync(join(cfg.archiveDir, oldDay, 'x.json'), '{}');
      mkdirSync(join(cfg.archiveDir, today), { recursive: true });
      mkdirSync(join(cfg.archiveDir, 'not-a-date'), { recursive: true });

      const removed = backup.pruneArchive();
      expect(removed).toBe(1);
      expect(existsSync(join(cfg.archiveDir, oldDay))).toBe(false);
      expect(existsSync(join(cfg.archiveDir, today))).toBe(true);
      expect(existsSync(join(cfg.archiveDir, 'not-a-date'))).toBe(true);
      db.close();
    } finally {
      cfg.cleanup();
    }
  });

  it('scheduler tick auto-copies when due and prunes', async () => {
    const cfg = makeTmpConfig();
    try {
      const db = openDb(cfg.dbPath);
      runMigrations(db);
      const settings = createSettingsService(db);
      const target = join(cfg.dataDir, 'offsite', 'copy.sqlite');
      settings.set('auto_copy_target_path', target);
      settings.set('backup_nudge_interval_days', 1);
      const backup = createBackupService({
        db,
        settings,
        dbPath: cfg.dbPath,
        archiveDir: cfg.archiveDir,
      });
      const scheduler = createBackupScheduler({ service: backup, settings });
      await scheduler.tick();
      expect(existsSync(target)).toBe(true);
      db.close();
    } finally {
      cfg.cleanup();
    }
  });
});

describe('secrets store write path (T-D4)', () => {
  it('upserts, clears, and never loses an untouched key; presence-only readback', () => {
    const cfg = makeTmpConfig();
    try {
      writeSecrets(cfg.secretsPath, { anthropic_api_key: 'sk-a', github_pat: 'ghp-b' });
      expect(secretsPresence(cfg.secretsPath)).toEqual({
        anthropic_api_key: true,
        github_pat: true,
      });
      // Absent field untouched; empty string clears.
      writeSecrets(cfg.secretsPath, { github_pat: '' });
      expect(secretsPresence(cfg.secretsPath)).toEqual({
        anthropic_api_key: true,
        github_pat: false,
      });
    } finally {
      cfg.cleanup();
    }
  });
});
