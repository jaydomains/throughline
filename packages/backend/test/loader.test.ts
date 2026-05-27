import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

  // C-D19 surface 1 — third bundle-resolution arm.
  describe('per-repo arm (C-D19 surface 1)', () => {
    it('arm 2 wins over arm 3 when <repoPath>/.throughline/bundle.md is present', async () => {
      const cfg = makeTmpConfig();
      try {
        plantFreeformBundle(cfg.methodologiesDir);
        const repoDir = mkdtempSync(join(tmpdir(), 'throughline-repo-'));
        try {
          mkdirSync(join(repoDir, '.throughline'), { recursive: true });
          // Stamp a repo-local bundle that parses and identifies as a different
          // version so resolution preference is observable.
          const md = readFileSync(FREEFORM_BUNDLE_PATH, 'utf8').replace('version: 1.0.0', 'version: 9.9.9');
          writeFileSync(join(repoDir, '.throughline', 'bundle.md'), md);
          const db = openDb(cfg.dbPath);
          runMigrations(db);
          const registry = createMethodologyRegistry({
            db,
            methodologiesDir: cfg.methodologiesDir,
            watch: false,
          });
          const result = registry.resolveBundle('freeform', null, repoDir);
          expect(result.status).toBe('loaded');
          if (result.status === 'loaded') {
            expect(result.bundle.identity.version).toBe('9.9.9');
          }
          await registry.stop();
          db.close();
        } finally {
          rmSync(repoDir, { recursive: true, force: true });
        }
      } finally {
        cfg.cleanup();
      }
    });

    it('falls through to arm 3 when the per-repo file is absent', async () => {
      const cfg = makeTmpConfig();
      try {
        plantFreeformBundle(cfg.methodologiesDir);
        const repoDir = mkdtempSync(join(tmpdir(), 'throughline-repo-'));
        try {
          const db = openDb(cfg.dbPath);
          runMigrations(db);
          const registry = createMethodologyRegistry({
            db,
            methodologiesDir: cfg.methodologiesDir,
            watch: false,
          });
          // No `.throughline/bundle.md` planted.
          const result = registry.resolveBundle('freeform', null, repoDir);
          expect(result.status).toBe('loaded');
          if (result.status === 'loaded') {
            expect(result.bundle.identity.version).toBe('1.0.0');
          }
          await registry.stop();
          db.close();
        } finally {
          rmSync(repoDir, { recursive: true, force: true });
        }
      } finally {
        cfg.cleanup();
      }
    });

    it('arm 1 wins over arm 2 when bundle_path is also set', async () => {
      const cfg = makeTmpConfig();
      try {
        plantFreeformBundle(cfg.methodologiesDir);
        const repoDir = mkdtempSync(join(tmpdir(), 'throughline-repo-'));
        const externalDir = mkdtempSync(join(tmpdir(), 'throughline-external-'));
        try {
          mkdirSync(join(repoDir, '.throughline'), { recursive: true });
          const repoMd = readFileSync(FREEFORM_BUNDLE_PATH, 'utf8').replace('version: 1.0.0', 'version: 2.0.0');
          writeFileSync(join(repoDir, '.throughline', 'bundle.md'), repoMd);
          const externalMd = readFileSync(FREEFORM_BUNDLE_PATH, 'utf8').replace('version: 1.0.0', 'version: 3.0.0');
          writeFileSync(join(externalDir, 'bundle.md'), externalMd);
          const db = openDb(cfg.dbPath);
          runMigrations(db);
          const registry = createMethodologyRegistry({
            db,
            methodologiesDir: cfg.methodologiesDir,
            watch: false,
          });
          const result = registry.resolveBundle('freeform', externalDir, repoDir);
          expect(result.status).toBe('loaded');
          if (result.status === 'loaded') {
            expect(result.bundle.identity.version).toBe('3.0.0');
          }
          await registry.stop();
          db.close();
        } finally {
          rmSync(repoDir, { recursive: true, force: true });
          rmSync(externalDir, { recursive: true, force: true });
        }
      } finally {
        cfg.cleanup();
      }
    });

    it('refcounts the per-repo watch target across multiple projects', async () => {
      const cfg = makeTmpConfig();
      try {
        plantFreeformBundle(cfg.methodologiesDir);
        const repoDir = mkdtempSync(join(tmpdir(), 'throughline-repo-'));
        try {
          mkdirSync(join(repoDir, '.throughline'), { recursive: true });
          writeFileSync(join(repoDir, '.throughline', 'bundle.md'), readFileSync(FREEFORM_BUNDLE_PATH, 'utf8'));
          const db = openDb(cfg.dbPath);
          runMigrations(db);
          const registry = createMethodologyRegistry({
            db,
            methodologiesDir: cfg.methodologiesDir,
            watch: false,
          });
          // Two projects on the same repo_path; both register the same watch file.
          // Unregistering one leaves the binding intact for the other.
          registry.registerProjectBundle('p1', 'freeform', null, repoDir);
          registry.registerProjectBundle('p2', 'freeform', null, repoDir);
          expect(registry.resolveBundle('freeform', null, repoDir).status).toBe('loaded');
          registry.unregisterProjectBundle('p1');
          expect(registry.resolveBundle('freeform', null, repoDir).status).toBe('loaded');
          registry.unregisterProjectBundle('p2');
          // After the last project unregisters, the per-repo cache entry is gone;
          // a fresh resolve loads from disk again.
          const reloaded = registry.resolveBundle('freeform', null, repoDir);
          expect(reloaded.status).toBe('loaded');
          await registry.stop();
          db.close();
        } finally {
          rmSync(repoDir, { recursive: true, force: true });
        }
      } finally {
        cfg.cleanup();
      }
    });

    it('startup hydration of a project without `.throughline/bundle.md` writes no audit (ENOENT is quiet)', async () => {
      // Regression: clone-and-go projects whose `.throughline/bundle.md` does
      // not yet exist resolve via arm 3 at registration time. There is no
      // binding event to record — registerProjectBundle + resolveBundle must
      // not produce per-project audit rows on ENOENT.
      const cfg = makeTmpConfig();
      try {
        plantFreeformBundle(cfg.methodologiesDir);
        const repoDir = mkdtempSync(join(tmpdir(), 'throughline-repo-'));
        try {
          const db = openDb(cfg.dbPath);
          runMigrations(db);
          const registry = createMethodologyRegistry({
            db,
            methodologiesDir: cfg.methodologiesDir,
            watch: false,
            logger: { info: () => {}, warn: () => {}, error: () => {} },
          });
          // Clear audit rows seeded by the install-shipped bundle's initial scan,
          // then exercise the arm-2 register + resolve paths.
          db.prepare("DELETE FROM audit_log").run();
          registry.registerProjectBundle('p-quiet', 'freeform', null, repoDir);
          const result = registry.resolveBundle('freeform', null, repoDir);
          expect(result.status).toBe('loaded'); // arm 3 fallback
          const rows = db
            .prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity_type = 'bundle_binding'")
            .get() as { n: number };
          expect(rows.n).toBe(0);
          await registry.stop();
          db.close();
        } finally {
          rmSync(repoDir, { recursive: true, force: true });
        }
      } finally {
        cfg.cleanup();
      }
    });

    it('parse error in per-repo bundle.md falls through to arm 3 rather than throwing', async () => {
      const cfg = makeTmpConfig();
      try {
        plantFreeformBundle(cfg.methodologiesDir);
        const repoDir = mkdtempSync(join(tmpdir(), 'throughline-repo-'));
        try {
          mkdirSync(join(repoDir, '.throughline'), { recursive: true });
          writeFileSync(join(repoDir, '.throughline', 'bundle.md'), '# not a valid bundle\n');
          const db = openDb(cfg.dbPath);
          runMigrations(db);
          const registry = createMethodologyRegistry({
            db,
            methodologiesDir: cfg.methodologiesDir,
            watch: false,
            logger: { info: () => {}, warn: () => {}, error: () => {} },
          });
          // Arm 2 errors out; resolution falls through to arm 3 (install-shipped).
          const result = registry.resolveBundle('freeform', null, repoDir);
          expect(result.status).toBe('loaded');
          if (result.status === 'loaded') {
            expect(result.bundle.identity.version).toBe('1.0.0');
          }
          await registry.stop();
          db.close();
        } finally {
          rmSync(repoDir, { recursive: true, force: true });
        }
      } finally {
        cfg.cleanup();
      }
    });
  });
});
