import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createProjectsService } from '../src/projects/service.js';
import { createLibraryService, LibraryEntryTypeError } from '../src/library/service.js';
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
  const library = createLibraryService(backend.db, projects);
  const project = projects.create({ name: 'demo', repo_path: '/tmp/demo' });
  return { backend, projects, library, project };
}

describe('library service (minimal Phase 4)', () => {
  it('creates a note and lists it under its project', async () => {
    const { backend, library, project } = await setup();
    try {
      const entry = library.create({
        project_id: project.id,
        type: 'note',
        title: 'jot heap',
        body: 'a note body',
        tags: ['inbox'],
      });
      expect(entry.id).toBeTruthy();
      const listed = library.list(project.id);
      expect(listed.find((e) => e.id === entry.id)?.tags).toEqual(['inbox']);

      const audit = backend.db
        .prepare("SELECT field FROM audit_log WHERE entity_type = 'library' AND entity_id = ?")
        .all(entry.id) as Array<{ field: string }>;
      expect(audit.some((r) => r.field === 'create')).toBe(true);
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects an invalid type', async () => {
    const { backend, library, project } = await setup();
    try {
      expect(() =>
        library.create({
          project_id: project.id,
          // @ts-expect-error — invalid type by construction
          type: 'bogus',
          title: 't',
        }),
      ).toThrow(LibraryEntryTypeError);
    } finally {
      await backend.cleanup();
    }
  });
});
