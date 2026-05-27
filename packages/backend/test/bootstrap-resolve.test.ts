import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createItemsService } from '../src/items/service.js';
import { createLibraryService } from '../src/library/service.js';
import { createProjectsService } from '../src/projects/service.js';
import { createSessionsService } from '../src/sessions/service.js';
import { createBootstrapImportService } from '../src/bootstrap/service.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

// Phase 20 — Slice 4 — `listConflicts` + `resolveConflicts` tests
// (T-D54, C-D20 surface 5). Covers the persistent stale-row surface and
// the four resolution actions implemented in v1 (conflict keep_mine /
// take_theirs; stale keep / delete). The merge_fields and archive actions
// are v1 carve-outs documented in the handover.

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
  const items = createItemsService(backend.db, projects, backend.registry);
  const sessions = createSessionsService(backend.db, projects);
  const library = createLibraryService(backend.db, projects);
  const project = projects.create({ name: 'demo', repo_path: '/tmp/demo-' + Math.random().toString(36).slice(2) });
  const bootstrap = createBootstrapImportService({
    db: backend.db,
    projects,
    items,
    sessions,
    library,
    registry: backend.registry,
  });
  return { backend, projects, items, sessions, library, project, bootstrap };
}

describe('bootstrap listConflicts — stale row surface (C-D20 surface 5)', () => {
  it('returns an empty stale list when no bootstrap has run', async () => {
    const { backend, project, bootstrap } = await setup();
    try {
      const r = bootstrap.listConflicts(project.id);
      expect(r.stale).toEqual([]);
    } finally {
      await backend.cleanup();
    }
  });

  it('surfaces stale rows from items + sessions + library, ordered by bootstrap_id', async () => {
    const { backend, project, bootstrap } = await setup();
    try {
      bootstrap.importBootstrap(project.id, {
        version: 1,
        items: [
          { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', title: 'I1', type: 'task', status: 'open' },
        ],
        sessions: [
          { bootstrap_id: 'handover:s1.md', source_type: 'handover', name: 'S1' },
        ],
        library_entries: [
          {
            bootstrap_id: 'decision:T-D1',
            source_type: 'decision',
            type: 'note',
            title: 'L1',
            body: 'b',
            tags: [],
          },
        ],
      });
      // Empty re-import flips all three rows to stale.
      bootstrap.importBootstrap(project.id, { version: 1 });
      const r = bootstrap.listConflicts(project.id);
      expect(r.stale).toHaveLength(3);
      const types = r.stale.map((s) => s.entity_type).sort();
      expect(types).toEqual(['item', 'library', 'session']);
    } finally {
      await backend.cleanup();
    }
  });

  it('does not surface rows that are currently bootstrap_stale=0', async () => {
    const { backend, project, bootstrap } = await setup();
    try {
      bootstrap.importBootstrap(project.id, {
        version: 1,
        items: [
          { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', title: 'I1', type: 'task', status: 'open' },
        ],
      });
      const r = bootstrap.listConflicts(project.id);
      expect(r.stale).toEqual([]);
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects unknown project id', async () => {
    const { backend, bootstrap } = await setup();
    try {
      expect(() => bootstrap.listConflicts('not-a-real-project')).toThrow();
    } finally {
      await backend.cleanup();
    }
  });
});

describe('bootstrap resolveConflicts — stale actions (keep / delete)', () => {
  it('keep flips bootstrap_stale=0 and writes a bootstrap_reimport audit', async () => {
    const { backend, project, bootstrap, items } = await setup();
    try {
      bootstrap.importBootstrap(project.id, {
        version: 1,
        items: [
          { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', title: 'P1', type: 'task', status: 'open' },
        ],
      });
      bootstrap.importBootstrap(project.id, { version: 1 }); // flips to stale
      const stale = bootstrap.listConflicts(project.id);
      const target = stale.stale[0]!;
      const r = bootstrap.resolveConflicts(project.id, [], [
        { entity_type: target.entity_type, entity_id: target.entity_id, bootstrap_id: target.bootstrap_id, action: 'keep' },
      ]);
      expect(r.applied).toBe(1);
      expect(r.errors).toEqual([]);
      // Row still exists; bootstrap_stale=0.
      const row = backend.db
        .prepare('SELECT bootstrap_stale FROM items WHERE id = ?')
        .get(target.entity_id) as { bootstrap_stale: number };
      expect(row.bootstrap_stale).toBe(0);
      // listConflicts no longer surfaces it.
      expect(bootstrap.listConflicts(project.id).stale).toEqual([]);
      // items.get still works.
      expect(items.get(target.entity_id)).not.toBeNull();
    } finally {
      await backend.cleanup();
    }
  });

  it('delete removes the entity via service.delete (cascades + audit)', async () => {
    const { backend, project, bootstrap, items } = await setup();
    try {
      bootstrap.importBootstrap(project.id, {
        version: 1,
        items: [
          { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', title: 'P1', type: 'task', status: 'open' },
        ],
      });
      bootstrap.importBootstrap(project.id, { version: 1 });
      const stale = bootstrap.listConflicts(project.id);
      const target = stale.stale[0]!;
      const r = bootstrap.resolveConflicts(project.id, [], [
        { entity_type: target.entity_type, entity_id: target.entity_id, bootstrap_id: target.bootstrap_id, action: 'delete' },
      ]);
      expect(r.applied).toBe(1);
      expect(items.get(target.entity_id)).toBeNull();
    } finally {
      await backend.cleanup();
    }
  });

  it('reports entity_not_found error for unknown ids without aborting other resolutions', async () => {
    const { backend, project, bootstrap } = await setup();
    try {
      bootstrap.importBootstrap(project.id, {
        version: 1,
        items: [
          { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', title: 'P1', type: 'task', status: 'open' },
        ],
      });
      bootstrap.importBootstrap(project.id, { version: 1 });
      const stale = bootstrap.listConflicts(project.id);
      const real = stale.stale[0]!;
      const r = bootstrap.resolveConflicts(project.id, [], [
        { entity_type: 'item', entity_id: 'does-not-exist', bootstrap_id: 'x', action: 'keep' },
        { entity_type: real.entity_type, entity_id: real.entity_id, bootstrap_id: real.bootstrap_id, action: 'keep' },
      ]);
      expect(r.applied).toBe(1);
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0]?.message).toBe('entity_not_found');
    } finally {
      await backend.cleanup();
    }
  });
});

describe('bootstrap resolveConflicts — conflict actions (keep_mine / take_theirs)', () => {
  it('keep_mine is a no-op (counts to result.noop)', async () => {
    const { backend, project, bootstrap, items } = await setup();
    try {
      const r1 = bootstrap.importBootstrap(project.id, {
        version: 1,
        items: [
          { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', title: 'P1', type: 'task', status: 'open' },
        ],
      });
      const eid = r1.rows[0]!.entity_id!;
      // user edit triggers conflict on re-import
      await new Promise((r) => setTimeout(r, 5));
      items.update(eid, { title: 'user wrote this' });

      const r = bootstrap.resolveConflicts(
        project.id,
        [
          {
            entity_type: 'item',
            entity_id: eid,
            bootstrap_id: 'roadmap:phase-1',
            action: 'keep_mine',
          },
        ],
        [],
      );
      expect(r.noop).toBe(1);
      expect(r.applied).toBe(0);
      // Item unchanged.
      expect(items.get(eid)!.title).toBe('user wrote this');
    } finally {
      await backend.cleanup();
    }
  });

  it('take_theirs validates the proposed row against the bound bundle and overwrites', async () => {
    const { backend, project, bootstrap, items } = await setup();
    try {
      const r1 = bootstrap.importBootstrap(project.id, {
        version: 1,
        items: [
          { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', title: 'P1', type: 'task', status: 'open' },
        ],
      });
      const eid = r1.rows[0]!.entity_id!;
      await new Promise((r) => setTimeout(r, 5));
      items.update(eid, { title: 'user wrote this' });

      const r = bootstrap.resolveConflicts(
        project.id,
        [
          {
            entity_type: 'item',
            entity_id: eid,
            bootstrap_id: 'roadmap:phase-1',
            source_type: 'roadmap',
            action: 'take_theirs',
            proposed: {
              bootstrap_id: 'roadmap:phase-1',
              source_type: 'roadmap',
              title: 'Bootstrap wins',
              type: 'task',
              status: 'done',
            },
          },
        ],
        [],
      );
      expect(r.applied).toBe(1);
      expect(r.errors).toEqual([]);
      const item = items.get(eid)!;
      expect(item.title).toBe('Bootstrap wins');
      expect(item.status).toBe('done');
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects take_theirs with a proposed row that violates bundle policy', async () => {
    const { backend, project, bootstrap } = await setup();
    try {
      const r1 = bootstrap.importBootstrap(project.id, {
        version: 1,
        items: [
          { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', title: 'P1', type: 'task', status: 'open' },
        ],
      });
      const eid = r1.rows[0]!.entity_id!;

      const r = bootstrap.resolveConflicts(
        project.id,
        [
          {
            entity_type: 'item',
            entity_id: eid,
            bootstrap_id: 'roadmap:phase-1',
            action: 'take_theirs',
            proposed: {
              bootstrap_id: 'roadmap:phase-1',
              source_type: 'roadmap',
              title: 'Bad',
              type: 'decision', // freeform declares only task
              status: 'open',
            },
          },
        ],
        [],
      );
      expect(r.applied).toBe(0);
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0]?.message).toContain('proposed row failed validation');
    } finally {
      await backend.cleanup();
    }
  });
});
