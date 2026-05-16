import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { BundleNotLoadedError, createProjectsService } from '../src/projects/service.js';
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
