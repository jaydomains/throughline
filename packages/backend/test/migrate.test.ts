import { describe, expect, it } from 'vitest';
import { openDb } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { makeTmpConfig } from './helpers.js';

describe('migration runner', () => {
  it('applies all migrations and is idempotent', () => {
    const cfg = makeTmpConfig();
    try {
      const db = openDb(cfg.dbPath);
      const firstRun = runMigrations(db);
      expect(firstRun).toContain('0001_init.sql');
      const secondRun = runMigrations(db);
      expect(secondRun).toEqual([]);
      const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map(
        (r) => r.name,
      );
      expect(tables).toContain('projects');
      expect(tables).toContain('audit_log');
      expect(tables).toContain('drift_signals');
      expect(tables).toContain('gate_firings');
      expect(tables).toContain('cost_telemetry');
      expect(tables).toContain('settings');
      db.close();
    } finally {
      cfg.cleanup();
    }
  });

  it('enforces non-null bundle_id on projects (T-D47)', () => {
    const cfg = makeTmpConfig();
    try {
      const db = openDb(cfg.dbPath);
      runMigrations(db);
      expect(() =>
        db
          .prepare('INSERT INTO projects (id, name, repo_path, state, settings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run('p1', 'P', '/tmp', 'active', '{}', new Date().toISOString(), new Date().toISOString()),
      ).toThrow();
      db.close();
    } finally {
      cfg.cleanup();
    }
  });
});
