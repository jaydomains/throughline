import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';

// Global key/value settings (T-D4: API keys are NOT stored here; they live in the secrets file).
// Per-project overrides live on projects.settings_json (C-D5) and are accessed via the projects service.

export interface SettingsService {
  getAll(): Record<string, unknown>;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  setMany(entries: Record<string, unknown>): void;
}

const BANNED_KEY_PATTERN = /(?:api_key|secret|password|token|github_pat)(?:$|_)/i;

function ensureNotSecret(key: string): void {
  if (BANNED_KEY_PATTERN.test(key)) {
    throw new Error(`settings key "${key}" looks like a secret; store it in ~/.throughline/secrets.json instead`);
  }
}

export function createSettingsService(db: DB): SettingsService {
  const getStmt = db.prepare('SELECT value_json FROM settings WHERE key = ?');
  const allStmt = db.prepare('SELECT key, value_json FROM settings');
  const upsertStmt = db.prepare(
    `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
  );

  function get(key: string): unknown {
    const row = getStmt.get(key) as { value_json: string } | undefined;
    return row ? (JSON.parse(row.value_json) as unknown) : undefined;
  }

  function set(key: string, value: unknown): void {
    ensureNotSecret(key);
    const prev = get(key);
    upsertStmt.run(key, JSON.stringify(value), new Date().toISOString());
    appendAudit(db, {
      projectId: null,
      entityType: 'settings',
      entityId: key,
      actor: 'user',
      field: key,
      oldValue: prev === undefined ? null : JSON.stringify(prev),
      newValue: JSON.stringify(value),
    });
  }

  return {
    getAll() {
      const rows = allStmt.all() as Array<{ key: string; value_json: string }>;
      return Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value_json) as unknown]));
    },
    get,
    set,
    setMany(entries) {
      const tx = db.transaction((es: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(es)) set(k, v);
      });
      tx(entries);
    },
  };
}
