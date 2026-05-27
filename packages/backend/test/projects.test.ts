import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BundleNotLoadedError,
  DuplicateRepoPathError,
  InvalidRepoPathError,
  createProjectsService,
} from '../src/projects/service.js';
import { BundleIdMismatchError, InvalidProjectConfigError } from '../src/init/config-reader.js';
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

  // C-D19 surface 7 — re-init via PATCH `reinit_throughline: true`.
  describe('re-init flow (C-D19 surface 7)', () => {
    function makeRealRepo(): { repoPath: string; cleanup: () => void } {
      const repoPath = mkdtempSync(join(tmpdir(), 'throughline-reinit-'));
      mkdirSync(join(repoPath, '.throughline'), { recursive: true });
      return {
        repoPath,
        cleanup: () => rmSync(repoPath, { recursive: true, force: true }),
      };
    }
    function writeProjectJson(repoPath: string, body: object): void {
      writeFileSync(join(repoPath, '.throughline', 'project.json'), JSON.stringify(body));
    }

    it('backend re-reads `.throughline/project.json` from persisted repo_path and applies fields', async () => {
      const cfg = makeTmpConfig();
      plantFreeformBundle(cfg.methodologiesDir);
      const backend = await makeBackend(cfg);
      const { repoPath, cleanup: rmRepo } = makeRealRepo();
      try {
        const projects = createProjectsService(backend.db, backend.registry);
        const project = projects.create({ name: 'Original', repo_path: repoPath });
        // Author project.json after create — re-init picks it up.
        writeProjectJson(repoPath, {
          bundle_id: 'freeform',
          github_owner: 'acme',
          github_repo: 'widgets',
          project_name: 'Renamed by config',
        });
        const updated = projects.update(project.id, { reinit_throughline: true });
        expect(updated.name).toBe('Renamed by config');
        expect(updated.github_owner).toBe('acme');
        expect(updated.github_repo).toBe('widgets');
      } finally {
        rmRepo();
        await backend.cleanup();
      }
    });

    it('returns the project unchanged when `.throughline/project.json` is absent', async () => {
      const cfg = makeTmpConfig();
      plantFreeformBundle(cfg.methodologiesDir);
      const backend = await makeBackend(cfg);
      const { repoPath, cleanup: rmRepo } = makeRealRepo();
      try {
        const projects = createProjectsService(backend.db, backend.registry);
        const project = projects.create({ name: 'NoConfig', repo_path: repoPath });
        // Note: makeRealRepo creates `.throughline/` but no project.json inside.
        const updated = projects.update(project.id, { reinit_throughline: true });
        expect(updated.name).toBe('NoConfig');
        expect(updated.bundle_id).toBe(project.bundle_id);
      } finally {
        rmRepo();
        await backend.cleanup();
      }
    });

    it('explicit input fields override file fields on re-init', async () => {
      const cfg = makeTmpConfig();
      plantFreeformBundle(cfg.methodologiesDir);
      const backend = await makeBackend(cfg);
      const { repoPath, cleanup: rmRepo } = makeRealRepo();
      try {
        const projects = createProjectsService(backend.db, backend.registry);
        const project = projects.create({ name: 'Mixed', repo_path: repoPath });
        writeProjectJson(repoPath, { bundle_id: 'freeform', project_name: 'File says this' });
        const updated = projects.update(project.id, {
          reinit_throughline: true,
          name: 'Caller insists on this',
        });
        expect(updated.name).toBe('Caller insists on this');
      } finally {
        rmRepo();
        await backend.cleanup();
      }
    });

    it('auto-detects github_owner/github_repo from origin remote when project.json is silent', async () => {
      const cfg = makeTmpConfig();
      plantFreeformBundle(cfg.methodologiesDir);
      const backend = await makeBackend(cfg);
      const { repoPath, cleanup: rmRepo } = makeRealRepo();
      try {
        execFileSync('git', ['-C', repoPath, 'init', '-q'], { stdio: 'ignore' });
        execFileSync(
          'git',
          ['-C', repoPath, 'remote', 'add', 'origin', 'git@github.com:acme/widgets.git'],
          { stdio: 'ignore' },
        );
        const projects = createProjectsService(backend.db, backend.registry);
        const project = projects.create({ name: 'Auto', repo_path: repoPath });
        writeProjectJson(repoPath, { bundle_id: 'freeform' });
        const updated = projects.update(project.id, { reinit_throughline: true });
        expect(updated.github_owner).toBe('acme');
        expect(updated.github_repo).toBe('widgets');
      } finally {
        rmRepo();
        await backend.cleanup();
      }
    });

    it('surfaces InvalidProjectConfigError when project.json is malformed', async () => {
      const cfg = makeTmpConfig();
      plantFreeformBundle(cfg.methodologiesDir);
      const backend = await makeBackend(cfg);
      const { repoPath, cleanup: rmRepo } = makeRealRepo();
      try {
        const projects = createProjectsService(backend.db, backend.registry);
        const project = projects.create({ name: 'Bad', repo_path: repoPath });
        writeFileSync(join(repoPath, '.throughline', 'project.json'), '{not valid');
        expect(() => projects.update(project.id, { reinit_throughline: true })).toThrow(InvalidProjectConfigError);
      } finally {
        rmRepo();
        await backend.cleanup();
      }
    });

    it('surfaces BundleIdMismatchError when project.json disagrees with sibling bundle.md', async () => {
      const cfg = makeTmpConfig();
      plantFreeformBundle(cfg.methodologiesDir);
      const backend = await makeBackend(cfg);
      const { repoPath, cleanup: rmRepo } = makeRealRepo();
      try {
        const projects = createProjectsService(backend.db, backend.registry);
        const project = projects.create({ name: 'Mismatch', repo_path: repoPath });
        // Plant a sibling bundle.md whose §1 Identity name is "freeform"...
        const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');
        copyFileSync(FREEFORM_BUNDLE_PATH, join(repoPath, '.throughline', 'bundle.md'));
        // ...but project.json claims a different bundle_id.
        writeProjectJson(repoPath, { bundle_id: 'not-freeform' });
        expect(() => projects.update(project.id, { reinit_throughline: true })).toThrow(BundleIdMismatchError);
      } finally {
        rmRepo();
        await backend.cleanup();
      }
    });

    it('strict-boolean check — only `reinit_throughline === true` triggers the re-init path', async () => {
      // Regression: declared-type-boolean is enforced at runtime. A
      // non-boolean truthy value (e.g. `"yes"`, `1`) must not activate
      // re-init.
      const cfg = makeTmpConfig();
      plantFreeformBundle(cfg.methodologiesDir);
      const backend = await makeBackend(cfg);
      const { repoPath, cleanup: rmRepo } = makeRealRepo();
      try {
        const projects = createProjectsService(backend.db, backend.registry);
        const project = projects.create({ name: 'StrictBool', repo_path: repoPath });
        writeProjectJson(repoPath, { bundle_id: 'freeform', project_name: 'Should not apply' });
        // Cast: the shared type forbids these values; we deliberately exercise
        // the wire-time defence-in-depth check.
        const updated = projects.update(project.id, { reinit_throughline: 'yes' as unknown as boolean });
        expect(updated.name).toBe('StrictBool');
        const updated2 = projects.update(project.id, { reinit_throughline: 1 as unknown as boolean });
        expect(updated2.name).toBe('StrictBool');
      } finally {
        rmRepo();
        await backend.cleanup();
      }
    });

    it('does not touch items, sessions, or audit history on re-init', async () => {
      const cfg = makeTmpConfig();
      plantFreeformBundle(cfg.methodologiesDir);
      const backend = await makeBackend(cfg);
      const { repoPath, cleanup: rmRepo } = makeRealRepo();
      try {
        const projects = createProjectsService(backend.db, backend.registry);
        const project = projects.create({ name: 'Preserved', repo_path: repoPath });
        backend.db
          .prepare(
            'INSERT INTO items (id, project_id, type, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          )
          .run('it-keep', project.id, 'task', 'must survive', 'open', new Date().toISOString(), new Date().toISOString());
        writeProjectJson(repoPath, { bundle_id: 'freeform', project_name: 'After re-init' });
        projects.update(project.id, { reinit_throughline: true });
        const itemRow = backend.db
          .prepare('SELECT title FROM items WHERE id = ?')
          .get('it-keep') as { title: string } | undefined;
        expect(itemRow?.title).toBe('must survive');
      } finally {
        rmRepo();
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
