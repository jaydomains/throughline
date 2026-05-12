import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(here, 'migrations');

interface MigrationFile {
  name: string;
  sql: string;
}

function ensureMigrationsTable(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TEXT NOT NULL
    );
  `);
}

function discoverMigrations(): MigrationFile[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS_DIR, name), 'utf8') }));
}

export function runMigrations(db: DB): string[] {
  ensureMigrationsTable(db);
  const applied = new Set(
    (db.prepare('SELECT name FROM _migrations').all() as Array<{ name: string }>).map((row) => row.name),
  );
  const ran: string[] = [];
  const insert = db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)');
  for (const m of discoverMigrations()) {
    if (applied.has(m.name)) continue;
    const tx = db.transaction(() => {
      db.exec(m.sql);
      insert.run(m.name, new Date().toISOString());
    });
    tx();
    ran.push(m.name);
  }
  return ran;
}
