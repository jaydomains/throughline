import { describe, expect, it } from 'vitest';
import { openDb } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { makeTmpConfig } from './helpers.js';

// Phase 20 — Slice 1 — schema migration tests (T-D54, C-D20 surface 1).
//
// The 0012 migration adds `bootstrap_id TEXT` (nullable) and
// `bootstrap_stale INTEGER NOT NULL DEFAULT 0` to items / sessions /
// library_entries, plus a unique partial index per table on
// `(project_id, bootstrap_id) WHERE bootstrap_id IS NOT NULL`.
//
// What this file pins:
//   * columns + indexes are present after a fresh migration run
//   * existing creation paths are unaffected (NULL bootstrap_id is accepted; the
//     md-ingest `(project_id, source_path)` keying on library_entries continues
//     to operate independently of the bootstrap index)
//   * the partial-index semantics hold across the three tables:
//       - two NULL rows on the same (project_id) do not collide
//       - same non-null (project_id, bootstrap_id) collides
//       - same non-null bootstrap_id across distinct project_ids does not collide
//   * the stale-flag default is 0 (re-import flips it; not exercised here)
//
// Direct SQL inserts (vs. going through service.create) — this slice deliberately
// has no service-layer code; the test validates the schema in isolation.

function setupDb() {
  const cfg = makeTmpConfig();
  const db = openDb(cfg.dbPath);
  runMigrations(db);
  return {
    db,
    cleanup: () => {
      db.close();
      cfg.cleanup();
    },
  };
}

function insertProject(db: ReturnType<typeof openDb>, id: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO projects (id, name, repo_path, bundle_id, state, settings_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, `Project ${id}`, `/tmp/${id}`, 'freeform', 'active', '{}', now, now);
}

function insertItem(
  db: ReturnType<typeof openDb>,
  opts: { id: string; projectId: string; bootstrapId?: string | null },
): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO items (id, project_id, type, title, description, status, blocker_text, parent_id, branch_ref, created_at, updated_at, bootstrap_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(opts.id, opts.projectId, 'task', 'T', '', 'open', null, null, null, now, now, opts.bootstrapId ?? null);
}

function insertSession(
  db: ReturnType<typeof openDb>,
  opts: { id: string; projectId: string; bootstrapId?: string | null },
): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO sessions (id, project_id, name, branch_ref, context, settings_json, created_at, updated_at, bootstrap_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(opts.id, opts.projectId, `S ${opts.id}`, null, null, '{}', now, now, opts.bootstrapId ?? null);
}

function insertLibraryEntry(
  db: ReturnType<typeof openDb>,
  opts: {
    id: string;
    projectId: string;
    type?: string;
    sourcePath?: string | null;
    bootstrapId?: string | null;
  },
): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO library_entries (id, project_id, type, title, body, tags_json, created_at, updated_at, source_path, bootstrap_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    opts.id,
    opts.projectId,
    opts.type ?? 'note',
    `L ${opts.id}`,
    '',
    '[]',
    now,
    now,
    opts.sourcePath ?? null,
    opts.bootstrapId ?? null,
  );
}

describe('Phase 20 schema migration (0012, C-D20 surface 1)', () => {
  it('adds bootstrap_id and bootstrap_stale columns to items / sessions / library_entries', () => {
    const { db, cleanup } = setupDb();
    try {
      for (const table of ['items', 'sessions', 'library_entries']) {
        const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string; notnull: number }>);
        const names = cols.map((c) => c.name);
        expect(names).toContain('bootstrap_id');
        expect(names).toContain('bootstrap_stale');
        const stale = cols.find((c) => c.name === 'bootstrap_stale')!;
        // INTEGER 0/1 convention; stays in step with 0006's source_tracked column.
        expect(stale.notnull).toBe(1);
      }
    } finally {
      cleanup();
    }
  });

  it('creates unique partial indexes per table on (project_id, bootstrap_id) WHERE bootstrap_id IS NOT NULL', () => {
    const { db, cleanup } = setupDb();
    try {
      for (const expected of [
        'idx_items_bootstrap_id',
        'idx_sessions_bootstrap_id',
        'idx_library_entries_bootstrap_id',
      ]) {
        const row = db
          .prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?")
          .get(expected) as { sql: string } | undefined;
        expect(row, `index ${expected} missing`).toBeDefined();
        expect(row!.sql).toContain('UNIQUE');
        expect(row!.sql).toContain('WHERE bootstrap_id IS NOT NULL');
        expect(row!.sql).toContain('project_id');
      }
    } finally {
      cleanup();
    }
  });

  it('accepts multiple NULL bootstrap_id rows under the same project (existing creation paths unaffected)', () => {
    const { db, cleanup } = setupDb();
    try {
      insertProject(db, 'p1');
      // Two items, two sessions, two library entries, all with NULL bootstrap_id —
      // mirroring the manual-create and md-ingest paths that never set the column.
      expect(() => {
        insertItem(db, { id: 'i1', projectId: 'p1' });
        insertItem(db, { id: 'i2', projectId: 'p1' });
        insertSession(db, { id: 's1', projectId: 'p1' });
        insertSession(db, { id: 's2', projectId: 'p1' });
        insertLibraryEntry(db, { id: 'l1', projectId: 'p1' });
        insertLibraryEntry(db, { id: 'l2', projectId: 'p1' });
      }).not.toThrow();
    } finally {
      cleanup();
    }
  });

  it('rejects duplicate (project_id, bootstrap_id) on items when both are non-null', () => {
    const { db, cleanup } = setupDb();
    try {
      insertProject(db, 'p1');
      insertItem(db, { id: 'i1', projectId: 'p1', bootstrapId: 'roadmap:phase-1' });
      expect(() => insertItem(db, { id: 'i2', projectId: 'p1', bootstrapId: 'roadmap:phase-1' })).toThrow(/UNIQUE/);
    } finally {
      cleanup();
    }
  });

  it('rejects duplicate (project_id, bootstrap_id) on sessions when both are non-null', () => {
    const { db, cleanup } = setupDb();
    try {
      insertProject(db, 'p1');
      insertSession(db, { id: 's1', projectId: 'p1', bootstrapId: 'handover:2026-05-25.md' });
      expect(() =>
        insertSession(db, { id: 's2', projectId: 'p1', bootstrapId: 'handover:2026-05-25.md' }),
      ).toThrow(/UNIQUE/);
    } finally {
      cleanup();
    }
  });

  it('rejects duplicate (project_id, bootstrap_id) on library_entries when both are non-null', () => {
    const { db, cleanup } = setupDb();
    try {
      insertProject(db, 'p1');
      insertLibraryEntry(db, { id: 'l1', projectId: 'p1', bootstrapId: 'decision:T-D53' });
      expect(() =>
        insertLibraryEntry(db, { id: 'l2', projectId: 'p1', bootstrapId: 'decision:T-D53' }),
      ).toThrow(/UNIQUE/);
    } finally {
      cleanup();
    }
  });

  it('allows the same bootstrap_id across distinct project_ids (uniqueness is scoped per project)', () => {
    const { db, cleanup } = setupDb();
    try {
      insertProject(db, 'p1');
      insertProject(db, 'p2');
      expect(() => {
        insertItem(db, { id: 'i1', projectId: 'p1', bootstrapId: 'roadmap:phase-1' });
        insertItem(db, { id: 'i2', projectId: 'p2', bootstrapId: 'roadmap:phase-1' });
        insertSession(db, { id: 's1', projectId: 'p1', bootstrapId: 'handover:x.md' });
        insertSession(db, { id: 's2', projectId: 'p2', bootstrapId: 'handover:x.md' });
        insertLibraryEntry(db, { id: 'l1', projectId: 'p1', bootstrapId: 'decision:T-D1' });
        insertLibraryEntry(db, { id: 'l2', projectId: 'p2', bootstrapId: 'decision:T-D1' });
      }).not.toThrow();
    } finally {
      cleanup();
    }
  });

  it('does not interfere with the md-ingest (project_id, source_path) library keying on library_entries', () => {
    // 0006 introduced source-tracking columns and `idx_library_source_tracked`; the
    // md-ingest service queries on (project_id, source_path) directly without a
    // unique index (uniqueness is enforced application-side by findEntryBySource).
    // Bootstrap rows carry bootstrap_id and leave source_path NULL; md-ingest rows
    // carry source_path and leave bootstrap_id NULL. The two creation paths must
    // coexist on the same project without index collision.
    const { db, cleanup } = setupDb();
    try {
      insertProject(db, 'p1');
      // md-ingest-style row.
      insertLibraryEntry(db, {
        id: 'l-md',
        projectId: 'p1',
        type: 'imported_doc',
        sourcePath: 'docs/handover.md',
      });
      // Bootstrap-style row referencing the same conceptual handover, derived via T-D54.
      insertLibraryEntry(db, {
        id: 'l-bs',
        projectId: 'p1',
        type: 'note',
        bootstrapId: 'handover:2026-05-25-handover.md',
      });
      const rows = db.prepare('SELECT id FROM library_entries WHERE project_id = ?').all('p1') as Array<{ id: string }>;
      expect(rows.map((r) => r.id).sort()).toEqual(['l-bs', 'l-md']);
    } finally {
      cleanup();
    }
  });

  it('defaults bootstrap_stale to 0 on all three tables', () => {
    const { db, cleanup } = setupDb();
    try {
      insertProject(db, 'p1');
      insertItem(db, { id: 'i1', projectId: 'p1', bootstrapId: 'roadmap:phase-1' });
      insertSession(db, { id: 's1', projectId: 'p1', bootstrapId: 'handover:x.md' });
      insertLibraryEntry(db, { id: 'l1', projectId: 'p1', bootstrapId: 'decision:T-D1' });
      const item = db.prepare('SELECT bootstrap_stale FROM items WHERE id = ?').get('i1') as { bootstrap_stale: number };
      const session = db.prepare('SELECT bootstrap_stale FROM sessions WHERE id = ?').get('s1') as { bootstrap_stale: number };
      const lib = db.prepare('SELECT bootstrap_stale FROM library_entries WHERE id = ?').get('l1') as { bootstrap_stale: number };
      expect(item.bootstrap_stale).toBe(0);
      expect(session.bootstrap_stale).toBe(0);
      expect(lib.bootstrap_stale).toBe(0);
    } finally {
      cleanup();
    }
  });
});
