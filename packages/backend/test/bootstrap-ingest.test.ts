import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createItemsService } from '../src/items/service.js';
import { createLibraryService } from '../src/library/service.js';
import { createProjectsService } from '../src/projects/service.js';
import { createSessionsService } from '../src/sessions/service.js';
import {
  BootstrapNoBundleBoundError,
  BootstrapProjectNotFoundError,
  BootstrapValidationFailedError,
  createBootstrapImportService,
} from '../src/bootstrap/service.js';
import { hasUserEditsSinceLastBootstrap } from '../src/bootstrap/predicate.js';
import { validateBootstrapFile } from '../src/bootstrap/service.js';
import { appendAudit } from '../src/audit/log.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

// Phase 20 — Slice 3 — bootstrap ingest pipeline tests (T-D53, T-D54, C-D20).
//
// Covers four surfaces that ship together as Slice 3:
//   * validator    — T-D53 file shape + bundle-aware item type/status check
//                    + duplicate bootstrap_id detection
//   * predicate    — `hasUserEditsSinceLastBootstrap` over `audit_log`
//   * service      — transactional upsert + per-row classification + audit
//   * stale sweep  — bootstrap_id-disappearance flag (never auto-deletes)

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

function freeformPolicy(projectId: string, items: ReturnType<typeof createItemsService>) {
  // The test's project uses the freeform bundle; items service exposes its policy.
  return items.policy(projectId);
}

describe('bootstrap predicate — hasUserEditsSinceLastBootstrap (C-D20 surface 4)', () => {
  it('returns false for an entity with no bootstrap audit history (never imported)', async () => {
    const { backend } = await setup();
    try {
      expect(hasUserEditsSinceLastBootstrap(backend.db, 'item', 'never-existed')).toBe(false);
    } finally {
      await backend.cleanup();
    }
  });

  it('returns false when only bootstrap_import / bootstrap_reimport audits exist', async () => {
    const { backend, project } = await setup();
    try {
      const eid = 'e-1';
      appendAudit(backend.db, {
        projectId: project.id,
        entityType: 'item',
        entityId: eid,
        actor: 'system',
        field: 'bootstrap_import',
        triggerContext: { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', status: 'new' },
      });
      appendAudit(backend.db, {
        projectId: project.id,
        entityType: 'item',
        entityId: eid,
        actor: 'system',
        field: 'bootstrap_reimport',
        triggerContext: { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', status: 'reimported' },
      });
      expect(hasUserEditsSinceLastBootstrap(backend.db, 'item', eid)).toBe(false);
    } finally {
      await backend.cleanup();
    }
  });

  it('returns true when a non-bootstrap audit row exists strictly after the last bootstrap audit', async () => {
    const { backend, project } = await setup();
    try {
      const eid = 'e-2';
      appendAudit(backend.db, {
        projectId: project.id,
        entityType: 'item',
        entityId: eid,
        actor: 'system',
        field: 'bootstrap_import',
      });
      // Force a strictly-greater timestamp by waiting a tick.
      await new Promise((r) => setTimeout(r, 5));
      appendAudit(backend.db, {
        projectId: project.id,
        entityType: 'item',
        entityId: eid,
        actor: 'user',
        field: 'title',
        oldValue: 'old',
        newValue: 'new',
      });
      expect(hasUserEditsSinceLastBootstrap(backend.db, 'item', eid)).toBe(true);
    } finally {
      await backend.cleanup();
    }
  });

  it('returns false when the only post-bootstrap audit is itself bootstrap_* prefixed', async () => {
    const { backend, project } = await setup();
    try {
      const eid = 'e-3';
      appendAudit(backend.db, {
        projectId: project.id,
        entityType: 'item',
        entityId: eid,
        actor: 'system',
        field: 'bootstrap_import',
      });
      await new Promise((r) => setTimeout(r, 5));
      appendAudit(backend.db, {
        projectId: project.id,
        entityType: 'item',
        entityId: eid,
        actor: 'system',
        field: 'bootstrap_stale',
      });
      expect(hasUserEditsSinceLastBootstrap(backend.db, 'item', eid)).toBe(false);
    } finally {
      await backend.cleanup();
    }
  });

  it('treats a non-bootstrap audit BEFORE the last bootstrap as already-imported (no conflict)', async () => {
    const { backend, project } = await setup();
    try {
      const eid = 'e-4';
      // user `create` audit at T0
      appendAudit(backend.db, {
        projectId: project.id,
        entityType: 'item',
        entityId: eid,
        actor: 'user',
        field: 'create',
      });
      await new Promise((r) => setTimeout(r, 5));
      // bootstrap_import audit at T0+ — the bootstrap path's normal chronology.
      appendAudit(backend.db, {
        projectId: project.id,
        entityType: 'item',
        entityId: eid,
        actor: 'system',
        field: 'bootstrap_import',
      });
      expect(hasUserEditsSinceLastBootstrap(backend.db, 'item', eid)).toBe(false);
    } finally {
      await backend.cleanup();
    }
  });
});

describe('bootstrap validator — T-D53 file shape + bundle-aware validation', () => {
  it('rejects a top-level value that is not an object', async () => {
    const { backend, items, project } = await setup();
    try {
      const result = validateBootstrapFile([], freeformPolicy(project.id, items));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]?.message).toContain('object');
      }
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects an unsupported version field', async () => {
    const { backend, items, project } = await setup();
    try {
      const result = validateBootstrapFile({ version: 2 }, freeformPolicy(project.id, items));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]?.path).toBe('version');
      }
    } finally {
      await backend.cleanup();
    }
  });

  it('accepts an empty file (no rows)', async () => {
    const { backend, items, project } = await setup();
    try {
      const result = validateBootstrapFile({ version: 1 }, freeformPolicy(project.id, items));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.parsed.items).toEqual([]);
        expect(result.parsed.sessions).toEqual([]);
        expect(result.parsed.library_entries).toEqual([]);
      }
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects an item with a type not declared by the bound bundle', async () => {
    const { backend, items, project } = await setup();
    try {
      const result = validateBootstrapFile(
        {
          version: 1,
          items: [
            {
              bootstrap_id: 'roadmap:phase-1',
              source_type: 'roadmap',
              title: 'P1',
              type: 'decision', // freeform declares only 'task'
              status: 'open',
            },
          ],
        },
        freeformPolicy(project.id, items),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]?.message).toContain('not declared by bundle');
      }
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects an item with a status not in the type lifecycle', async () => {
    const { backend, items, project } = await setup();
    try {
      const result = validateBootstrapFile(
        {
          version: 1,
          items: [
            {
              bootstrap_id: 'roadmap:phase-1',
              source_type: 'roadmap',
              title: 'P1',
              type: 'task',
              status: 'blocked', // freeform lifecycle is open/done
            },
          ],
        },
        freeformPolicy(project.id, items),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]?.message).toContain('not allowed for type');
      }
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects rows that share a bootstrap_id across the file (cites both source rows)', async () => {
    const { backend, items, project } = await setup();
    try {
      const result = validateBootstrapFile(
        {
          version: 1,
          items: [
            { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', title: 'A', type: 'task', status: 'open' },
            { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', title: 'B', type: 'task', status: 'open' },
          ],
        },
        freeformPolicy(project.id, items),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]?.message).toMatch(/duplicate bootstrap_id/);
        expect(result.errors[0]?.message).toContain('item index 0');
      }
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects cross-entity bootstrap_id collisions (item + library on same id)', async () => {
    const { backend, items, project } = await setup();
    try {
      const result = validateBootstrapFile(
        {
          version: 1,
          items: [{ bootstrap_id: 'override:x', source_type: 'override', title: 'A', type: 'task', status: 'open' }],
          library_entries: [
            {
              bootstrap_id: 'override:x',
              source_type: 'override',
              type: 'note',
              title: 'L',
              body: '',
              tags: [],
            },
          ],
        },
        freeformPolicy(project.id, items),
      );
      expect(result.ok).toBe(false);
    } finally {
      await backend.cleanup();
    }
  });

  it('accepts an override:-prefixed bootstrap_id regardless of source_type (T-D54 override semantics)', async () => {
    const { backend, items, project } = await setup();
    try {
      const result = validateBootstrapFile(
        {
          version: 1,
          items: [
            // source_type=checklist, but override syntax was used so bootstrap_id has the override: prefix
            {
              bootstrap_id: 'override:my-stable-slug',
              source_type: 'checklist',
              title: 'X',
              type: 'task',
              status: 'open',
            },
          ],
        },
        freeformPolicy(project.id, items),
      );
      expect(result.ok).toBe(true);
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects a bootstrap_id whose prefix mismatches source_type without the override escape', async () => {
    const { backend, items, project } = await setup();
    try {
      const result = validateBootstrapFile(
        {
          version: 1,
          items: [
            {
              bootstrap_id: 'roadmap:phase-1',
              source_type: 'decision', // mismatch
              title: 'X',
              type: 'task',
              status: 'open',
            },
          ],
        },
        freeformPolicy(project.id, items),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]?.message).toContain('does not match source_type');
      }
    } finally {
      await backend.cleanup();
    }
  });
});

describe('bootstrap service — upsert classifier + transactional audit (C-D20 surface 2)', () => {
  it('inserts new items and stamps bootstrap_id + bootstrap_stale=0', async () => {
    const { backend, project, bootstrap, items } = await setup();
    try {
      const r = bootstrap.importBootstrap(project.id, {
        version: 1,
        items: [
          {
            bootstrap_id: 'roadmap:phase-1',
            source_type: 'roadmap',
            title: 'Phase 1',
            type: 'task',
            status: 'open',
          },
        ],
      });
      expect(r.counts.new).toBe(1);
      expect(r.counts.reimported).toBe(0);
      expect(r.counts.conflict).toBe(0);
      expect(r.counts.stale_flagged).toBe(0);
      const entityId = r.rows[0]!.entity_id!;
      const item = items.get(entityId)!;
      expect(item.title).toBe('Phase 1');
      // raw column check: bootstrap_id stamped, stale=0.
      const row = backend.db
        .prepare('SELECT bootstrap_id, bootstrap_stale FROM items WHERE id = ?')
        .get(entityId) as { bootstrap_id: string; bootstrap_stale: number };
      expect(row.bootstrap_id).toBe('roadmap:phase-1');
      expect(row.bootstrap_stale).toBe(0);
      // audit shape: a `create` (from items.create) followed by `bootstrap_import`.
      const audits = backend.db
        .prepare('SELECT field FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY timestamp, id')
        .all('item', entityId) as Array<{ field: string }>;
      expect(audits.map((a) => a.field)).toContain('create');
      expect(audits.map((a) => a.field)).toContain('bootstrap_import');
    } finally {
      await backend.cleanup();
    }
  });

  it('classifies a re-import on an unedited row as reimported and writes a single bootstrap_reimport audit', async () => {
    const { backend, project, bootstrap, items } = await setup();
    try {
      bootstrap.importBootstrap(project.id, {
        version: 1,
        items: [
          { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', title: 'Phase 1', type: 'task', status: 'open' },
        ],
      });
      const r2 = bootstrap.importBootstrap(project.id, {
        version: 1,
        items: [
          { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', title: 'Phase 1 (updated)', type: 'task', status: 'done' },
        ],
      });
      expect(r2.counts.reimported).toBe(1);
      expect(r2.counts.new).toBe(0);
      const entityId = r2.rows[0]!.entity_id!;
      const item = items.get(entityId)!;
      expect(item.title).toBe('Phase 1 (updated)');
      expect(item.status).toBe('done');
      // The reimport path emits a single bootstrap_reimport audit; no per-field
      // user-attributed audits leak from the UPDATE.
      const audits = backend.db
        .prepare('SELECT field, actor FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY timestamp, id')
        .all('item', entityId) as Array<{ field: string; actor: string }>;
      const reimportAudits = audits.filter((a) => a.field === 'bootstrap_reimport');
      expect(reimportAudits).toHaveLength(1);
      // No `title` or `status` per-field audits emitted during reimport.
      const fieldAudits = audits.filter((a) => a.field === 'title' || a.field === 'status');
      expect(fieldAudits).toHaveLength(0);
    } finally {
      await backend.cleanup();
    }
  });

  it('classifies a row whose entity has user edits since last import as conflict (no overwrite)', async () => {
    const { backend, project, bootstrap, items } = await setup();
    try {
      bootstrap.importBootstrap(project.id, {
        version: 1,
        items: [
          { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', title: 'P1', type: 'task', status: 'open' },
        ],
      });
      const entityId = backend.db
        .prepare('SELECT id FROM items WHERE bootstrap_id = ?')
        .get('roadmap:phase-1') as { id: string };
      // Simulate user edit through the items.update path.
      await new Promise((r) => setTimeout(r, 5));
      items.update(entityId.id, { title: 'User-edited' });

      const r2 = bootstrap.importBootstrap(project.id, {
        version: 1,
        items: [
          {
            bootstrap_id: 'roadmap:phase-1',
            source_type: 'roadmap',
            title: 'Bootstrap wants this',
            type: 'task',
            status: 'open',
          },
        ],
      });
      expect(r2.counts.conflict).toBe(1);
      expect(r2.counts.reimported).toBe(0);
      // Row is NOT overwritten; user's title stands.
      const finalItem = items.get(entityId.id)!;
      expect(finalItem.title).toBe('User-edited');
      // No bootstrap_reimport audit was emitted for this row in r2.
      const reimports = backend.db
        .prepare(
          "SELECT field FROM audit_log WHERE entity_type = 'item' AND entity_id = ? AND field = 'bootstrap_reimport'",
        )
        .all(entityId.id) as Array<{ field: string }>;
      expect(reimports).toHaveLength(0);
    } finally {
      await backend.cleanup();
    }
  });

  it('flags rows whose bootstrap_id is missing from a subsequent import as stale (not deleted)', async () => {
    const { backend, project, bootstrap, items } = await setup();
    try {
      bootstrap.importBootstrap(project.id, {
        version: 1,
        items: [
          { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', title: 'P1', type: 'task', status: 'open' },
          { bootstrap_id: 'roadmap:phase-2', source_type: 'roadmap', title: 'P2', type: 'task', status: 'open' },
        ],
      });
      const r2 = bootstrap.importBootstrap(project.id, {
        version: 1,
        // phase-2 dropped from the import; phase-1 still present.
        items: [
          { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', title: 'P1', type: 'task', status: 'open' },
        ],
      });
      expect(r2.counts.stale_flagged).toBe(1);
      const staleRow = r2.rows.find((row) => row.status === 'stale_flagged')!;
      expect(staleRow.bootstrap_id).toBe('roadmap:phase-2');
      // Row still exists; just flagged stale.
      const stillThere = backend.db
        .prepare('SELECT id, bootstrap_stale FROM items WHERE bootstrap_id = ?')
        .get('roadmap:phase-2') as { id: string; bootstrap_stale: number };
      expect(stillThere).toBeDefined();
      expect(stillThere.bootstrap_stale).toBe(1);
      // items.get still returns the item.
      expect(items.get(stillThere.id)).not.toBeNull();
    } finally {
      await backend.cleanup();
    }
  });

  it('does not re-flag the same stale row on every subsequent empty re-import (idempotent stale)', async () => {
    const { backend, project, bootstrap } = await setup();
    try {
      bootstrap.importBootstrap(project.id, {
        version: 1,
        items: [
          { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', title: 'P1', type: 'task', status: 'open' },
        ],
      });
      // First empty re-import flips the row to stale.
      const r1 = bootstrap.importBootstrap(project.id, { version: 1, items: [] });
      expect(r1.counts.stale_flagged).toBe(1);
      // Second empty re-import: the row is already stale; no new flip.
      const r2 = bootstrap.importBootstrap(project.id, { version: 1, items: [] });
      expect(r2.counts.stale_flagged).toBe(0);
      // Audit log carries exactly one bootstrap_stale row for this entity.
      const staleAudits = backend.db
        .prepare("SELECT id FROM audit_log WHERE entity_type = 'item' AND field = 'bootstrap_stale'")
        .all() as Array<{ id: string }>;
      expect(staleAudits).toHaveLength(1);
    } finally {
      await backend.cleanup();
    }
  });

  it('inserts new sessions and library entries with their bootstrap_id stamped', async () => {
    const { backend, project, bootstrap } = await setup();
    try {
      const r = bootstrap.importBootstrap(project.id, {
        version: 1,
        sessions: [
          {
            bootstrap_id: 'handover:2026-05-25.md',
            source_type: 'handover',
            name: 'Phase 20 doc prereqs',
          },
        ],
        library_entries: [
          {
            bootstrap_id: 'decision:T-D53',
            source_type: 'decision',
            type: 'note',
            title: 'T-D53',
            body: 'Bootstrap import file shape',
            tags: ['decision'],
          },
        ],
      });
      expect(r.counts.new).toBe(2);
      const sessionRow = backend.db
        .prepare('SELECT bootstrap_id, bootstrap_stale FROM sessions WHERE bootstrap_id = ?')
        .get('handover:2026-05-25.md') as { bootstrap_id: string; bootstrap_stale: number };
      expect(sessionRow.bootstrap_id).toBe('handover:2026-05-25.md');
      expect(sessionRow.bootstrap_stale).toBe(0);
      const libRow = backend.db
        .prepare('SELECT bootstrap_id, bootstrap_stale, tags_json FROM library_entries WHERE bootstrap_id = ?')
        .get('decision:T-D53') as { bootstrap_id: string; bootstrap_stale: number; tags_json: string };
      expect(libRow.bootstrap_id).toBe('decision:T-D53');
      expect(JSON.parse(libRow.tags_json)).toEqual(['decision']);
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects validation failures with BootstrapValidationFailedError carrying error details', async () => {
    const { backend, project, bootstrap } = await setup();
    try {
      expect(() =>
        bootstrap.importBootstrap(project.id, {
          version: 1,
          items: [{ bootstrap_id: 'x', source_type: 'roadmap' }], // missing required fields
        }),
      ).toThrow(BootstrapValidationFailedError);
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects a project that does not exist', async () => {
    const { backend, bootstrap } = await setup();
    try {
      expect(() => bootstrap.importBootstrap('does-not-exist', { version: 1 })).toThrow(BootstrapProjectNotFoundError);
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects a project with no bundle bound (clone-and-go init required up-front)', async () => {
    // The default test project has freeform bound. Construct a separate project
    // with a non-loadable bundle to verify the BootstrapNoBundleBoundError path.
    const { backend, projects, bootstrap } = await setup();
    try {
      // Directly insert a project with a bundle_id the registry cannot resolve.
      const bad = backend.db.prepare(
        `INSERT INTO projects (id, name, repo_path, bundle_id, state, settings_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      bad.run(
        'p-no-bundle',
        'No bundle',
        '/tmp/no-bundle-' + Math.random().toString(36).slice(2),
        'definitely-not-a-bundle',
        'active',
        '{}',
        new Date().toISOString(),
        new Date().toISOString(),
      );
      void projects;
      expect(() => bootstrap.importBootstrap('p-no-bundle', { version: 1 })).toThrow(BootstrapNoBundleBoundError);
    } finally {
      await backend.cleanup();
    }
  });

  it('end-to-end: new → unedited re-import → user edit → conflict on next re-import', async () => {
    const { backend, project, bootstrap, items } = await setup();
    try {
      const r1 = bootstrap.importBootstrap(project.id, {
        version: 1,
        items: [
          { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', title: 'P1', type: 'task', status: 'open' },
        ],
      });
      expect(r1.counts.new).toBe(1);
      const eid = r1.rows[0]!.entity_id!;

      const r2 = bootstrap.importBootstrap(project.id, {
        version: 1,
        items: [
          { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', title: 'P1 v2', type: 'task', status: 'open' },
        ],
      });
      expect(r2.counts.reimported).toBe(1);

      await new Promise((r) => setTimeout(r, 5));
      items.update(eid, { description: 'user added' });

      const r3 = bootstrap.importBootstrap(project.id, {
        version: 1,
        items: [
          { bootstrap_id: 'roadmap:phase-1', source_type: 'roadmap', title: 'P1 v3', type: 'task', status: 'open' },
        ],
      });
      expect(r3.counts.conflict).toBe(1);
      const item = items.get(eid)!;
      expect(item.title).toBe('P1 v2'); // user edit only changed description; title remains from r2
      expect(item.description).toBe('user added');
    } finally {
      await backend.cleanup();
    }
  });
});
