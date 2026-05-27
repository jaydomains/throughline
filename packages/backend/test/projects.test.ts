import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BundleNotLoadedError,
  DuplicateRepoPathError,
  InvalidRepoPathError,
  createProjectsService,
} from '../src/projects/service.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantFreeformBundle(methodologiesDir: string): void {
  const target = join(methodologiesDir, 'freeform');
  mkdirSync(target, { recursive: true });
  copyFileSync(FREEFORM_BUNDLE_PATH, join(target, 'bundle.md'));
}

describe('projects service', () => {
  it('defaults bundle_id to freeform on create and writes an audit row', async () => {
    const cfg = makeTmpConfig();
    plantFreeformBundle(cfg.methodologiesDir);
    const backend = await makeBackend(cfg);
    try {
      const projects = createProjectsService(backend.db, backend.registry);
      const project = projects.create({ name: 'Demo', repo_path: '/tmp/demo' });
      expect(project.bundle_id).toBe('freeform');
      expect(project.state).toBe('active');
      const audit = backend.db
        .prepare("SELECT field, entity_type FROM audit_log WHERE entity_id = ?")
        .all(project.id) as Array<{ field: string; entity_type: string }>;
      expect(audit.some((r) => r.field === 'create' && r.entity_type === 'project')).toBe(true);
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects create with unknown bundle', async () => {
    const cfg = makeTmpConfig();
    plantFreeformBundle(cfg.methodologiesDir);
    const backend = await makeBackend(cfg);
    try {
      const projects = createProjectsService(backend.db, backend.registry);
      expect(() => projects.create({ name: 'X', repo_path: '/tmp/x', bundle_id: 'no-such-bundle' })).toThrow(
        BundleNotLoadedError,
      );
    } finally {
      await backend.cleanup();
    }
  });

  it('archives + unarchives via state change with audit entry', async () => {
    const cfg = makeTmpConfig();
    plantFreeformBundle(cfg.methodologiesDir);
    const backend = await makeBackend(cfg);
    try {
      const projects = createProjectsService(backend.db, backend.registry);
      const project = projects.create({ name: 'Archivable', repo_path: '/tmp/a' });
      const archived = projects.update(project.id, { state: 'archived' });
      expect(archived.state).toBe('archived');
      expect(archived.archived_at).not.toBeNull();
      const unarchived = projects.update(project.id, { state: 'active' });
      expect(unarchived.state).toBe('active');
      expect(unarchived.archived_at).toBeNull();
    } finally {
      await backend.cleanup();
    }
  });

  // C-D19 surface 8 — repo_path normalisation + uniqueness check.
  describe('repo_path normalisation (C-D19 surface 8)', () => {
    it('rejects a relative repo_path', async () => {
      const cfg = makeTmpConfig();
      plantFreeformBundle(cfg.methodologiesDir);
      const backend = await makeBackend(cfg);
      try {
        const projects = createProjectsService(backend.db, backend.registry);
        expect(() => projects.create({ name: 'X', repo_path: 'relative/path' })).toThrow(InvalidRepoPathError);
      } finally {
        await backend.cleanup();
      }
    });

    it('rejects a repo_path containing `..` segments', async () => {
      const cfg = makeTmpConfig();
      plantFreeformBundle(cfg.methodologiesDir);
      const backend = await makeBackend(cfg);
      try {
        const projects = createProjectsService(backend.db, backend.registry);
        expect(() => projects.create({ name: 'X', repo_path: '/tmp/../etc' })).toThrow(InvalidRepoPathError);
      } finally {
        await backend.cleanup();
      }
    });

    it('canonicalises a symlinked repo_path to its real path', async () => {
      const cfg = makeTmpConfig();
      plantFreeformBundle(cfg.methodologiesDir);
      const backend = await makeBackend(cfg);
      const real = mkdtempSync(join(tmpdir(), 'throughline-real-'));
      const link = join(tmpdir(), `throughline-link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      symlinkSync(real, link);
      try {
        const projects = createProjectsService(backend.db, backend.registry);
        const project = projects.create({ name: 'Symlinked', repo_path: link });
        // realpathSync may canonicalise both the link AND the tmpdir root (e.g.
        // /tmp → /private/tmp on macOS); compare against the same realpath of the
        // target dir rather than the raw string.
        const realResolved = await import('node:fs').then((m) => m.realpathSync.native(real));
        expect(project.repo_path).toBe(realResolved);
      } finally {
        rmSync(link, { force: true });
        rmSync(real, { recursive: true, force: true });
        await backend.cleanup();
      }
    });

    it('falls back to normalize() when the path does not yet exist on disk', async () => {
      // Realpath fallback: pre-materialisation create (tests, scripted setup) is allowed.
      const cfg = makeTmpConfig();
      plantFreeformBundle(cfg.methodologiesDir);
      const backend = await makeBackend(cfg);
      try {
        const projects = createProjectsService(backend.db, backend.registry);
        const project = projects.create({ name: 'Pre-mat', repo_path: '/tmp/this-path-does-not-exist-12345' });
        expect(project.repo_path).toBe('/tmp/this-path-does-not-exist-12345');
      } finally {
        await backend.cleanup();
      }
    });

    it('a second create against an equivalent path collides on uniqueness', async () => {
      const cfg = makeTmpConfig();
      plantFreeformBundle(cfg.methodologiesDir);
      const backend = await makeBackend(cfg);
      const real = mkdtempSync(join(tmpdir(), 'throughline-real-'));
      const link = join(tmpdir(), `throughline-link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      symlinkSync(real, link);
      try {
        const projects = createProjectsService(backend.db, backend.registry);
        const first = projects.create({ name: 'First', repo_path: real });
        // Same target via symlink — should collide post-normalisation.
        let caught: unknown = null;
        try {
          projects.create({ name: 'Second', repo_path: link });
        } catch (err) {
          caught = err;
        }
        expect(caught).toBeInstanceOf(DuplicateRepoPathError);
        if (caught instanceof DuplicateRepoPathError) {
          expect(caught.existingProjectId).toBe(first.id);
        }
      } finally {
        rmSync(link, { force: true });
        rmSync(real, { recursive: true, force: true });
        await backend.cleanup();
      }
    });

    it('update to an equivalent existing path collides on uniqueness', async () => {
      const cfg = makeTmpConfig();
      plantFreeformBundle(cfg.methodologiesDir);
      const backend = await makeBackend(cfg);
      try {
        const projects = createProjectsService(backend.db, backend.registry);
        const a = projects.create({ name: 'A', repo_path: '/tmp/repo-A' });
        const b = projects.create({ name: 'B', repo_path: '/tmp/repo-B' });
        expect(() => projects.update(b.id, { repo_path: '/tmp/repo-A' })).toThrow(DuplicateRepoPathError);
        // Self-update to the same canonical path is a no-op, not a collision.
        const refreshed = projects.update(a.id, { repo_path: '/tmp/repo-A' });
        expect(refreshed.repo_path).toBe('/tmp/repo-A');
      } finally {
        await backend.cleanup();
      }
    });
  });

  it('cascade-deletes per-project rows', async () => {
    const cfg = makeTmpConfig();
    plantFreeformBundle(cfg.methodologiesDir);
    const backend = await makeBackend(cfg);
    try {
      const projects = createProjectsService(backend.db, backend.registry);
      const project = projects.create({ name: 'Cascade', repo_path: '/tmp/c' });
      backend.db
        .prepare(
          'INSERT INTO items (id, project_id, type, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run('it1', project.id, 'task', 'an item', 'open', new Date().toISOString(), new Date().toISOString());
      projects.delete(project.id);
      const remaining = backend.db.prepare('SELECT COUNT(*) AS n FROM items WHERE project_id = ?').get(project.id) as {
        n: number;
      };
      expect(remaining.n).toBe(0);
    } finally {
      await backend.cleanup();
    }
  });
});
