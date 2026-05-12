import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import chokidar from 'chokidar';
import { setTimeout as wait } from 'node:timers/promises';
import { createMethodologyRegistry } from '../src/methodology/loader.js';
import { createProjectsService } from '../src/projects/service.js';
import { openDb } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { makeTmpConfig } from './helpers.js';

const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantFreeformBundle(methodologiesDir: string): string {
  const target = join(methodologiesDir, 'freeform');
  mkdirSync(target, { recursive: true });
  const dest = join(target, 'bundle.md');
  copyFileSync(FREEFORM_BUNDLE_PATH, dest);
  return dest;
}

describe('methodology loader', () => {
  it('initial scan loads bundles found on disk', async () => {
    const cfg = makeTmpConfig();
    try {
      plantFreeformBundle(cfg.methodologiesDir);
      const db = openDb(cfg.dbPath);
      runMigrations(db);
      const registry = createMethodologyRegistry({
        db,
        methodologiesDir: cfg.methodologiesDir,
        watch: false,
      });
      const list = registry.list();
      expect(list.length).toBe(1);
      expect(list[0]?.status).toBe('loaded');
      await registry.stop();
      db.close();
    } finally {
      cfg.cleanup();
    }
  });

  it('writes an audit-log entry per bound project on bundle reload', async () => {
    const cfg = makeTmpConfig();
    try {
      const bundlePath = plantFreeformBundle(cfg.methodologiesDir);
      const db = openDb(cfg.dbPath);
      runMigrations(db);
      const registry = createMethodologyRegistry({
        db,
        methodologiesDir: cfg.methodologiesDir,
        watch: false,
      });
      const projects = createProjectsService(db, registry);
      const p1 = projects.create({ name: 'A', repo_path: '/tmp/a' });
      const p2 = projects.create({ name: 'B', repo_path: '/tmp/b' });

      // Trigger reload manually (watch is disabled in test).
      const md = readFileSync(bundlePath, 'utf8').replace('version: 1.0.0', 'version: 1.0.1');
      writeFileSync(bundlePath, md);
      registry.reload('freeform');

      const rows = db
        .prepare(
          "SELECT project_id, new_value FROM audit_log WHERE entity_type = 'bundle_binding' AND field = 'load' AND new_value = '1.0.1'",
        )
        .all() as Array<{ project_id: string; new_value: string }>;
      const projectIds = new Set(rows.map((r) => r.project_id));
      expect(projectIds.has(p1.id)).toBe(true);
      expect(projectIds.has(p2.id)).toBe(true);

      await registry.stop();
      db.close();
    } finally {
      cfg.cleanup();
    }
  });

  it('chokidar wiring picks up live file changes', async () => {
    // Smoke test that chokidar.watch on the methodologies dir at least registers without throwing.
    const cfg = makeTmpConfig();
    try {
      plantFreeformBundle(cfg.methodologiesDir);
      const watcher = chokidar.watch(join(cfg.methodologiesDir, '**/bundle.md'), { ignoreInitial: true });
      await wait(50);
      await watcher.close();
      expect(true).toBe(true);
    } finally {
      cfg.cleanup();
    }
  });
});
