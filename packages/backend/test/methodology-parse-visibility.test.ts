import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openDb } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { createProjectsService } from '../src/projects/service.js';
import { createItemsService } from '../src/items/service.js';
import { createLibraryService } from '../src/library/service.js';
import { createCompanionEngine } from '../src/methodology/companion/engine.js';
import { runDisciplineScan } from '../src/methodology/drift/discipline/scanners.js';
import { makeBackend, makeTmpConfig } from './helpers.js';
import type { DisciplineDriftCategory, LoadedBundle } from '@throughline/shared';

function makeRepo(dir: string): string {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SPEC.md'), '# Spec\nclean\n');
  writeFileSync(join(dir, 'NOTES.md'), '# Notes\n');
  return dir;
}

const TEST_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'test-bundle', 'bundle.md');
const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantBundle(methodologiesDir: string, id: string, srcPath: string): void {
  const target = join(methodologiesDir, id);
  mkdirSync(target, { recursive: true });
  copyFileSync(srcPath, join(target, 'bundle.md'));
}

function stubJudge() {
  return {
    available: () => true,
    async judge(ctx: { stepId: string; stateDigest: string }) {
      return {
        decision: 'pass' as const,
        rationale: `ok for ${ctx.stepId}`,
        telemetry: { model: 'claude-sonnet-4-6', input_tokens: 1, output_tokens: 1, prompt: ctx.stateDigest },
      };
    },
  };
}

// ── SF2-07 — companion run-complete audit must reflect what actually attached ──────────
describe('SF2-07 — companion attach audit reflects reality, not the request', () => {
  it('records only the items that attached, plus a failure list for the rest', async () => {
    const cfg = makeTmpConfig();
    plantBundle(cfg.methodologiesDir, 'test-bundle', TEST_BUNDLE_PATH);
    plantBundle(cfg.methodologiesDir, 'freeform', FREEFORM_BUNDLE_PATH);
    const backend = await makeBackend(cfg);
    try {
      const repoPath = makeRepo(join(cfg.dataDir, 'repo'));
      const projects = createProjectsService(backend.db, backend.registry);
      const items = createItemsService(backend.db, projects, backend.registry, {});
      const library = createLibraryService(backend.db, projects);
      const engine = createCompanionEngine({
        db: backend.db,
        projects,
        registry: backend.registry,
        library,
        judge: stubJudge(),
      });
      const project = projects.create({ name: 'tb', repo_path: repoPath, bundle_id: 'test-bundle' });
      const good = items.create({ project_id: project.id, type: 'task', title: 'real item' });

      const run = engine.startRun(project.id, 'review');
      // One real item id + one bogus id that library.attach will reject (ItemNotFoundError).
      const done = engine.completeRun(run.id, {
        summary: 'review notes',
        itemIds: [good.id, 'does-not-exist'],
      });
      expect(done.state).toBe('completed');

      // The good item actually got the note; the bogus one did not.
      expect(library.listAttachedNotes(good.id).map((n) => n.id)).toContain(done.summary_entry_id);

      // The audit row must say so: attached_items = [good], attach_failures = [bogus].
      const audit = backend.db
        .prepare(
          `SELECT trigger_context_json FROM audit_log
             WHERE entity_id = ? AND field = 'run_completed'`,
        )
        .get(run.id) as { trigger_context_json: string };
      const ctx = JSON.parse(audit.trigger_context_json) as Record<string, unknown>;
      expect(ctx.attached_items).toEqual([good.id]);
      expect(ctx.attach_failures).toEqual(['does-not-exist']);
    } finally {
      await backend.cleanup();
    }
  });
});

// ── SF2-08 — a refused bundle regex must not read as a clean check ─────────────────────
function category(over: Partial<DisciplineDriftCategory>): DisciplineDriftCategory {
  return { name: 'cat', trigger: 'manual', check_kind: 'regex', details: '', ...over };
}

describe('SF2-08 — refused bundle regex is surfaced, not silently skipped', () => {
  // A refused regex-category pattern makes the category unevaluable: the engine must
  // PRESERVE its open signals (ok:false), not reconcile them away as "clean".
  it('regex category with a catastrophic pattern → ok:false (signals preserved), not ok:true/[]', () => {
    const db = openDb(makeTmpConfig().dbPath);
    runMigrations(db);
    try {
      const res = runDisciplineScan(
        db,
        'p1',
        '/tmp/none',
        {} as LoadedBundle, // not dereferenced — the refused-pattern branch returns first
        category({ check_kind: 'regex', details: '(a+)+', name: 'redos' }),
      );
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.message).toMatch(/refused/i);
    } finally {
      db.close();
    }
  });

  it('a valid regex pattern still scans normally (ok:true)', () => {
    const db = openDb(makeTmpConfig().dbPath);
    runMigrations(db);
    try {
      const res = runDisciplineScan(
        db,
        'p1',
        '/tmp/none', // no doc surface → empty findings, but evaluable
        { project_layout: { primary_unit: null }, runtime_artefact_dirs: [] } as unknown as LoadedBundle,
        category({ check_kind: 'regex', details: 'TODO', name: 'todos' }),
      );
      expect(res.ok).toBe(true);
    } finally {
      db.close();
    }
  });

  it('cross_reference with a refused format_regex stays ok:true but carries a warning', () => {
    const db = openDb(makeTmpConfig().dbPath);
    runMigrations(db);
    try {
      // No anchor citations → crossReferenceScan returns [] early; the warning is emitted by
      // runDisciplineScan's format_regex precheck regardless.
      const res = runDisciplineScan(
        db,
        'p1',
        '/tmp/none',
        { anchor_system: { format_regex: '(a+)+' } } as unknown as LoadedBundle,
        category({ check_kind: 'cross_reference', details: '', name: 'xref' }),
      );
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.findings).toEqual([]);
        expect(res.warnings ?? []).toHaveLength(1);
        expect((res.warnings ?? [])[0]).toMatch(/format_regex was refused/i);
      }
    } finally {
      db.close();
    }
  });
});
