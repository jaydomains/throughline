import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createProjectsService } from '../src/projects/service.js';
import { createScratchpadService } from '../src/scratchpad/service.js';
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
  const scratchpad = createScratchpadService(backend.db);
  const project = projects.create({ name: 'demo', repo_path: '/tmp/demo' });
  return { backend, projects, scratchpad, project };
}

describe('scratchpad service', () => {
  it('creates a jot, lists it, audit-logs the create, and deletes it', async () => {
    const { backend, scratchpad, project } = await setup();
    try {
      const jot = scratchpad.create({ project_id: project.id, body: 'remember the milk' });
      const list = scratchpad.list(project.id);
      expect(list.find((j) => j.id === jot.id)).toBeTruthy();

      const audit = backend.db
        .prepare("SELECT field FROM audit_log WHERE project_id = ? AND field = 'scratchpad_jot'")
        .all(project.id) as Array<{ field: string }>;
      expect(audit).toHaveLength(1);

      scratchpad.delete(jot.id);
      const afterDelete = scratchpad.list(project.id);
      expect(afterDelete.find((j) => j.id === jot.id)).toBeUndefined();
    } finally {
      await backend.cleanup();
    }
  });

  it('scratchpad has no AI: no cost_telemetry rows recorded for jots', async () => {
    const { backend, scratchpad, project } = await setup();
    try {
      scratchpad.create({ project_id: project.id, body: 'a jot' });
      const cost = backend.db.prepare('SELECT * FROM cost_telemetry').all();
      expect(cost).toHaveLength(0);
    } finally {
      await backend.cleanup();
    }
  });
});
