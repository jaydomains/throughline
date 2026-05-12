import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createSessionsService } from '../src/sessions/service.js';
import { createProjectsService } from '../src/projects/service.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantFreeform(methodologiesDir: string): void {
  const target = join(methodologiesDir, 'freeform');
  mkdirSync(target, { recursive: true });
  copyFileSync(FREEFORM_BUNDLE_PATH, join(target, 'bundle.md'));
}

async function setup() {
  const cfg = makeTmpConfig();
  plantFreeform(cfg.methodologiesDir);
  const backend = await makeBackend(cfg);
  const projects = createProjectsService(backend.db, backend.registry);
  const sessions = createSessionsService(backend.db, projects);
  const project = projects.create({ name: 'demo', repo_path: '/tmp/demo' });
  return { backend, sessions, project };
}

describe('sessions service', () => {
  it('creates and lists sessions per project with audit entries (T-D36)', async () => {
    const { backend, sessions, project } = await setup();
    try {
      const session = sessions.create({ project_id: project.id, name: 'wave 1' });
      expect(session.name).toBe('wave 1');
      const listed = sessions.list(project.id);
      expect(listed).toHaveLength(1);
      const audit = backend.db
        .prepare("SELECT field FROM audit_log WHERE entity_type = 'session' AND entity_id = ?")
        .all(session.id) as Array<{ field: string }>;
      expect(audit.some((r) => r.field === 'create')).toBe(true);
    } finally {
      await backend.cleanup();
    }
  });

  it('renames a session, writes audit, deletes session', async () => {
    const { backend, sessions, project } = await setup();
    try {
      const session = sessions.create({ project_id: project.id, name: 'old' });
      sessions.update(session.id, { name: 'new', branch_ref: 'feature/x' });
      const refreshed = sessions.get(session.id)!;
      expect(refreshed.name).toBe('new');
      expect(refreshed.branch_ref).toBe('feature/x');
      sessions.delete(session.id);
      expect(sessions.get(session.id)).toBeNull();
      const audit = backend.db
        .prepare("SELECT field FROM audit_log WHERE entity_type = 'session' AND entity_id = ?")
        .all(session.id) as Array<{ field: string }>;
      const fields = audit.map((r) => r.field);
      expect(fields).toContain('name');
      expect(fields).toContain('branch_ref');
      expect(fields).toContain('delete');
    } finally {
      await backend.cleanup();
    }
  });
});
