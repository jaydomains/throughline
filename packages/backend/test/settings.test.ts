import { describe, expect, it } from 'vitest';
import { openDb } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { createSettingsService } from '../src/settings/service.js';
import { makeTmpConfig } from './helpers.js';

describe('settings service', () => {
  it('round-trips key/value entries and audit-logs changes', () => {
    const cfg = makeTmpConfig();
    try {
      const db = openDb(cfg.dbPath);
      runMigrations(db);
      const settings = createSettingsService(db);
      settings.set('stale_threshold_days', 14);
      settings.set('default_model', 'sonnet');
      expect(settings.get('stale_threshold_days')).toBe(14);
      expect(settings.getAll()).toEqual({
        stale_threshold_days: 14,
        default_model: 'sonnet',
      });
      const auditRows = db
        .prepare("SELECT field FROM audit_log WHERE entity_type = 'settings'")
        .all() as Array<{ field: string }>;
      expect(auditRows.map((r) => r.field)).toContain('stale_threshold_days');
      db.close();
    } finally {
      cfg.cleanup();
    }
  });

  it('rejects keys that look like secrets (T-D4)', () => {
    const cfg = makeTmpConfig();
    try {
      const db = openDb(cfg.dbPath);
      runMigrations(db);
      const settings = createSettingsService(db);
      expect(() => settings.set('anthropic_api_key', 'sk-xxx')).toThrow();
      expect(() => settings.set('github_pat', 'ghp_xxx')).toThrow();
      db.close();
    } finally {
      cfg.cleanup();
    }
  });
});
