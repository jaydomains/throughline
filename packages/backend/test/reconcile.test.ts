import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type {
  ReconcileDiff,
  ReconcileRowBlocker,
  ReconcileRowEdited,
  ReconcileRowNew,
} from '@throughline/shared';
import { createProjectsService } from '../src/projects/service.js';
import { createSessionsService } from '../src/sessions/service.js';
import { createItemsService } from '../src/items/service.js';
import { createDriftService } from '../src/drift/service.js';
import {
  createAnthropicReconcileEngine,
  createHeuristicReconcileEngine,
  createRoutingReconcileEngine,
} from '../src/reconcile/engine.js';
import { createReconcileService } from '../src/reconcile/service.js';
import type { AnthropicClient } from '../src/ai/anthropic.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantFreeform(methodologiesDir: string): void {
  const target = join(methodologiesDir, 'freeform');
  mkdirSync(target, { recursive: true });
  copyFileSync(FREEFORM_BUNDLE_PATH, join(target, 'bundle.md'));
}

function unavailableClient(): AnthropicClient {
  return {
    available: () => false,
    call: async () => {
      throw new Error('not configured');
    },
  };
}

async function setup() {
  const cfg = makeTmpConfig();
  plantFreeform(cfg.methodologiesDir);
  const backend = await makeBackend(cfg);
  const projects = createProjectsService(backend.db, backend.registry);
  const sessions = createSessionsService(backend.db, projects);
  const items = createItemsService(backend.db, projects, backend.registry);
  const drift = createDriftService(backend.db);
  const client = unavailableClient();
  const engine = createRoutingReconcileEngine({
    anthropic: createAnthropicReconcileEngine({ client }),
    heuristic: createHeuristicReconcileEngine(),
    client,
  });
  const reconcile = createReconcileService({
    db: backend.db,
    projects,
    sessions,
    registry: backend.registry,
    items,
    drift,
    engine,
  });
  const project = projects.create({ name: 'demo', repo_path: '/tmp/demo' });
  const session = sessions.create({ project_id: project.id, name: 'inbox' });
  return { backend, projects, sessions, items, drift, reconcile, project, session };
}

describe('reconcile engine — heuristic', () => {
  it('classifies a matched title + done hint as a completed row', async () => {
    const { backend, items, reconcile, project, session } = await setup();
    try {
      const item = items.create({
        project_id: project.id,
        title: 'Fix the login bug',
        session_ids: [session.id],
      });
      const run = await reconcile.propose({
        project_id: project.id,
        text: 'Fix the login bug is done. Shipped this morning.',
        source: 'manual',
        session_id: session.id,
      });
      const row = run.diff.rows[0]!;
      expect(row.category).toBe('completed');
      if (row.category === 'completed') {
        expect(row.item_id).toBe(item.id);
        expect(row.next_status).toBe('done');
      }
    } finally {
      await backend.cleanup();
    }
  });

  it('classifies an unmatched paragraph as a new row', async () => {
    const { backend, reconcile, project, session } = await setup();
    try {
      const run = await reconcile.propose({
        project_id: project.id,
        text: 'Add a tour for new users',
        source: 'manual',
        session_id: session.id,
      });
      expect(run.diff.rows).toHaveLength(1);
      const row = run.diff.rows[0]!;
      expect(row.category).toBe('new');
      if (row.category === 'new') {
        expect(row.title).toBe('Add a tour for new users');
        expect(row.type).toBe('task');
        expect(row.status).toBe('open');
      }
    } finally {
      await backend.cleanup();
    }
  });

  it('classifies a "broken" claim against an existing item as contradicted', async () => {
    const { backend, items, reconcile, project, session } = await setup();
    try {
      items.create({
        project_id: project.id,
        title: 'Login flow refresh',
        status: 'done',
        session_ids: [session.id],
      });
      const run = await reconcile.propose({
        project_id: project.id,
        text: 'The login flow refresh is broken under SSO again.',
        source: 'manual',
        session_id: session.id,
      });
      expect(run.diff.rows[0]!.category).toBe('contradicted');
    } finally {
      await backend.cleanup();
    }
  });

  it('classifies a blocker phrase as a blocker row with extracted text', async () => {
    const { backend, items, reconcile, project, session } = await setup();
    try {
      items.create({
        project_id: project.id,
        title: 'Onboarding redesign',
        session_ids: [session.id],
      });
      const run = await reconcile.propose({
        project_id: project.id,
        text: 'Onboarding redesign blocked by design review on Tuesday.',
        source: 'manual',
        session_id: session.id,
      });
      const row = run.diff.rows[0]!;
      expect(row.category).toBe('blocker');
      if (row.category === 'blocker') {
        expect(row.next_blocker_text ?? '').toContain('design review');
      }
    } finally {
      await backend.cleanup();
    }
  });

  it('normalises a non-existent session_id to null before writing the run', async () => {
    const { backend, reconcile, project } = await setup();
    try {
      const run = await reconcile.propose({
        project_id: project.id,
        text: 'Add a tour for new users',
        source: 'manual',
        session_id: 'session-does-not-exist',
      });
      // Validated up front, not written-then-corrected: the row, the diff, and the
      // re-fetched run all carry null — no transient invalid session_id ever persisted.
      expect(run.session_id).toBeNull();
      expect(run.diff.session_id).toBeNull();
      expect(reconcile.get(run.id)?.session_id).toBeNull();
    } finally {
      await backend.cleanup();
    }
  });
});

describe('reconcile service — apply', () => {
  it('applies completed rows by updating item status and audit-logging', async () => {
    const { backend, items, reconcile, project, session } = await setup();
    try {
      const item = items.create({
        project_id: project.id,
        title: 'Wire up feedback toast',
        session_ids: [session.id],
      });
      const run = await reconcile.propose({
        project_id: project.id,
        text: 'Wire up feedback toast — finished and merged.',
        source: 'manual',
        session_id: session.id,
      });
      const result = reconcile.apply({ run_id: run.id, diff: run.diff });
      expect(result.completed_item_ids).toEqual([item.id]);
      const refetched = items.get(item.id);
      expect(refetched?.status).toBe('done');

      const audit = backend.db
        .prepare("SELECT field FROM audit_log WHERE project_id = ?")
        .all(project.id) as Array<{ field: string }>;
      expect(audit.some((r) => r.field === 'reconcile_propose')).toBe(true);
      expect(audit.some((r) => r.field === 'reconcile_apply')).toBe(true);
      expect(audit.some((r) => r.field === 'status')).toBe(true);
    } finally {
      await backend.cleanup();
    }
  });

  it('creates items for new rows and attaches them to the session', async () => {
    const { backend, items, reconcile, project, session } = await setup();
    try {
      const run = await reconcile.propose({
        project_id: project.id,
        text: 'Write tests for upload\n\nAdd error message for empty form',
        source: 'manual',
        session_id: session.id,
      });
      const result = reconcile.apply({ run_id: run.id, diff: run.diff });
      expect(result.new_item_ids).toHaveLength(2);
      const created = items.get(result.new_item_ids[0]!);
      expect(created?.session_ids).toContain(session.id);
    } finally {
      await backend.cleanup();
    }
  });

  it('applies edited rows by updating title and description', async () => {
    const { backend, items, reconcile, project, session } = await setup();
    try {
      const item = items.create({
        project_id: project.id,
        title: 'Onboard new users',
        description: 'placeholder',
        session_ids: [session.id],
      });
      const run = await reconcile.propose({
        project_id: project.id,
        text: '(seed input; heuristic edited rows arrive from the AI path)',
        source: 'manual',
        session_id: session.id,
      });
      const editedRow: ReconcileRowEdited = {
        category: 'edited',
        row_id: 'r1',
        item_id: item.id,
        current_title: item.title,
        current_description: item.description,
        next_title: 'Onboard new users with a tour',
        next_description: 'Step-by-step tour for first-time sign-ups.',
        evidence: 'manual',
      };
      const diff: ReconcileDiff = {
        ...run.diff,
        rows: [editedRow],
      };
      const result = reconcile.apply({ run_id: run.id, diff });
      expect(result.edited_item_ids).toEqual([item.id]);
      const refetched = items.get(item.id);
      expect(refetched?.title).toBe('Onboard new users with a tour');
      expect(refetched?.description).toContain('Step-by-step tour');
    } finally {
      await backend.cleanup();
    }
  });

  it('contradicted rows spawn tier-2 drift signals when item has a PR association', async () => {
    const { backend, items, reconcile, project, session } = await setup();
    try {
      const item = items.create({
        project_id: project.id,
        title: 'Crop avatars on upload',
        status: 'done',
        session_ids: [session.id],
      });
      backend.db
        .prepare(
          `INSERT INTO item_pr_associations (item_id, pr_number, repo, auto_detected_at)
            VALUES (?, ?, ?, ?)`,
        )
        .run(item.id, 42, 'jaydomains/throughline', null);

      const run = await reconcile.propose({
        project_id: project.id,
        text: 'crop avatars on upload is broken again under safari',
        source: 'manual',
        session_id: session.id,
      });
      const result = reconcile.apply({ run_id: run.id, diff: run.diff });
      expect(result.drift_signal_ids).toHaveLength(1);

      const row = backend.db
        .prepare('SELECT stream, category, item_id FROM drift_signals WHERE id = ?')
        .get(result.drift_signal_ids[0]) as { stream: string; category: string; item_id: string };
      expect(row.stream).toBe('code');
      expect(row.category).toBe('tier-2');
      expect(row.item_id).toBe(item.id);

      // Item status was NOT reverted — T-D35: contradicted spawns drift, never reverts state.
      const refetched = items.get(item.id);
      expect(refetched?.status).toBe('done');
    } finally {
      await backend.cleanup();
    }
  });

  it('contradicted rows without PR association spawn tier-3 drift signals', async () => {
    const { backend, items, reconcile, project, session } = await setup();
    try {
      items.create({
        project_id: project.id,
        title: 'Crop avatars on upload',
        status: 'done',
        session_ids: [session.id],
      });
      const run = await reconcile.propose({
        project_id: project.id,
        text: 'crop avatars on upload is broken again under safari',
        source: 'manual',
        session_id: session.id,
      });
      const result = reconcile.apply({ run_id: run.id, diff: run.diff });
      expect(result.drift_signal_ids).toHaveLength(1);
      const row = backend.db
        .prepare('SELECT category FROM drift_signals WHERE id = ?')
        .get(result.drift_signal_ids[0]) as { category: string };
      expect(row.category).toBe('tier-3');
    } finally {
      await backend.cleanup();
    }
  });

  it('no-change rows mutate nothing but record a reconcile_review_noop audit row', async () => {
    const { backend, items, reconcile, project, session } = await setup();
    try {
      const item = items.create({
        project_id: project.id,
        title: 'Spike on caching layer',
        session_ids: [session.id],
      });
      const run = await reconcile.propose({
        project_id: project.id,
        text: 'spike on caching layer was mentioned in passing.',
        source: 'manual',
        session_id: session.id,
      });
      expect(run.diff.rows[0]!.category).toBe('no_change');
      const result = reconcile.apply({ run_id: run.id, diff: run.diff });
      expect(result.no_change_item_ids).toEqual([item.id]);
      const audit = backend.db
        .prepare("SELECT field FROM audit_log WHERE entity_type = 'item' AND entity_id = ?")
        .all(item.id) as Array<{ field: string }>;
      expect(audit.some((r) => r.field === 'reconcile_review_noop')).toBe(true);
    } finally {
      await backend.cleanup();
    }
  });

  it('respects per-row reject decisions for both mutations and drift signals', async () => {
    const { backend, items, reconcile, project, session } = await setup();
    try {
      items.create({
        project_id: project.id,
        title: 'Crop avatars on upload',
        status: 'done',
        session_ids: [session.id],
      });
      const run = await reconcile.propose({
        project_id: project.id,
        text: 'crop avatars on upload is broken again',
        source: 'manual',
        session_id: session.id,
      });
      const rowId = run.diff.rows[0]!.row_id;
      const result = reconcile.apply({
        run_id: run.id,
        diff: run.diff,
        decisions: { [rowId]: 'reject' },
      });
      expect(result.rejected_row_ids).toEqual([rowId]);
      expect(result.drift_signal_ids).toHaveLength(0);

      const count = (
        backend.db.prepare('SELECT COUNT(*) as n FROM drift_signals').get() as { n: number }
      ).n;
      expect(count).toBe(0);
    } finally {
      await backend.cleanup();
    }
  });

  it('rejects new-row decisions correctly (does not create item)', async () => {
    const { backend, reconcile, project, session } = await setup();
    try {
      const run = await reconcile.propose({
        project_id: project.id,
        text: 'Add a debug overlay to the dump zone',
        source: 'manual',
        session_id: session.id,
      });
      const rowId = run.diff.rows[0]!.row_id;
      const result = reconcile.apply({
        run_id: run.id,
        diff: run.diff,
        decisions: { [rowId]: 'reject' },
      });
      expect(result.new_item_ids).toHaveLength(0);
      expect(result.rejected_row_ids).toEqual([rowId]);
    } finally {
      await backend.cleanup();
    }
  });

  it('applies blocker rows by updating blocker_text', async () => {
    const { backend, items, reconcile, project, session } = await setup();
    try {
      const item = items.create({
        project_id: project.id,
        title: 'Ship onboarding tour',
        session_ids: [session.id],
      });
      const run = await reconcile.propose({
        project_id: project.id,
        text: 'Ship onboarding tour blocked by design review on Tuesday.',
        source: 'manual',
        session_id: session.id,
      });
      const result = reconcile.apply({ run_id: run.id, diff: run.diff });
      expect(result.blocker_item_ids).toEqual([item.id]);
      const refetched = items.get(item.id);
      expect(refetched?.blocker_text ?? '').toContain('design review');
    } finally {
      await backend.cleanup();
    }
  });

  it('cannot apply a run that is already applied (409-equivalent)', async () => {
    const { backend, reconcile, project, session } = await setup();
    try {
      const run = await reconcile.propose({
        project_id: project.id,
        text: 'Random new entry',
        source: 'manual',
        session_id: session.id,
      });
      reconcile.apply({ run_id: run.id, diff: run.diff });
      expect(() => reconcile.apply({ run_id: run.id, diff: run.diff })).toThrow(/cannot apply/);
    } finally {
      await backend.cleanup();
    }
  });

  it('discard is idempotent', async () => {
    const { backend, reconcile, project, session } = await setup();
    try {
      const run = await reconcile.propose({
        project_id: project.id,
        text: 'Random new entry',
        source: 'manual',
        session_id: session.id,
      });
      reconcile.discard(run.id);
      reconcile.discard(run.id); // no throw
      const refetched = reconcile.get(run.id);
      expect(refetched?.status).toBe('discarded');
    } finally {
      await backend.cleanup();
    }
  });
});

describe('reconcile engine — Anthropic path', () => {
  it('records cost telemetry + audit fingerprint when the model returns valid JSON', async () => {
    const cfg = makeTmpConfig();
    plantFreeform(cfg.methodologiesDir);
    const backend = await makeBackend(cfg);
    const projects = createProjectsService(backend.db, backend.registry);
    const sessions = createSessionsService(backend.db, projects);
    const items = createItemsService(backend.db, projects, backend.registry);
    const drift = createDriftService(backend.db);
    const client: AnthropicClient = {
      available: () => true,
      call: async () => ({
        text: JSON.stringify({
          rows: [
            {
              category: 'new',
              type: 'task',
              status: 'open',
              title: 'Anthropic-suggested item',
              description: '',
              tags: [],
              evidence: 'mock',
            } satisfies Partial<ReconcileRowNew> & { category: 'new' },
          ],
        }),
        input_tokens: 200,
        output_tokens: 80,
        stop_reason: 'end_turn',
      }),
    };
    const engine = createRoutingReconcileEngine({
      anthropic: createAnthropicReconcileEngine({ client }),
      heuristic: createHeuristicReconcileEngine(),
      client,
    });
    const reconcile = createReconcileService({
      db: backend.db,
      projects,
      sessions,
      registry: backend.registry,
      items,
      drift,
      engine,
    });
    const project = projects.create({ name: 'demo', repo_path: '/tmp/demo' });
    const session = sessions.create({ project_id: project.id, name: 'inbox' });
    try {
      const run = await reconcile.propose({
        project_id: project.id,
        text: 'arbitrary text',
        source: 'manual',
        session_id: session.id,
      });
      expect(run.diff.extractor).toBe('anthropic');
      expect(run.diff.rows[0]!.category).toBe('new');

      const cost = backend.db
        .prepare('SELECT input_tokens, output_tokens, feature FROM cost_telemetry')
        .all() as Array<{ input_tokens: number; output_tokens: number; feature: string }>;
      expect(cost).toHaveLength(1);
      expect(cost[0]!.input_tokens).toBe(200);
      expect(cost[0]!.feature).toBe('reconcile_diff');

      const audit = backend.db
        .prepare("SELECT trigger_context_json FROM audit_log WHERE field = 'reconcile_propose'")
        .get() as { trigger_context_json: string };
      const ctx = JSON.parse(audit.trigger_context_json) as Record<string, unknown>;
      expect(typeof ctx.prompt_fingerprint).toBe('string');
      expect(ctx.model).toBe('claude-sonnet-4-6');
    } finally {
      await backend.cleanup();
    }
  });
});

describe('reconcile apply — validate-then-transact (review fixes)', () => {
  it('rejects an apply whose diff references an item from another project', async () => {
    const { backend, projects, sessions, items, reconcile, project, session } = await setup();
    try {
      const otherProject = projects.create({ name: 'other', repo_path: '/tmp/other' });
      const otherSession = sessions.create({
        project_id: otherProject.id,
        name: 'other-inbox',
      });
      const foreignItem = items.create({
        project_id: otherProject.id,
        title: 'Foreign item',
        session_ids: [otherSession.id],
      });
      items.create({
        project_id: project.id,
        title: 'Local item',
        session_ids: [session.id],
      });

      const run = await reconcile.propose({
        project_id: project.id,
        text: 'Local item — done',
        source: 'manual',
        session_id: session.id,
      });

      // Tamper with the diff to point at the foreign item.
      const tamperedDiff = {
        ...run.diff,
        rows: run.diff.rows.map((r) =>
          r.category === 'completed' ? { ...r, item_id: foreignItem.id } : r,
        ),
      };

      expect(() => reconcile.apply({ run_id: run.id, diff: tamperedDiff })).toThrow(
        /do not belong to project/,
      );

      // The foreign item must be untouched and the run must still be pending — validation
      // happens before any mutation.
      expect(items.get(foreignItem.id)?.status).toBe('open');
      expect(reconcile.get(run.id)?.status).toBe('pending');
    } finally {
      await backend.cleanup();
    }
  });

  it('apply is transactional: a mid-loop failure rolls back earlier mutations', async () => {
    const { backend, items, reconcile, project, session } = await setup();
    try {
      const itemA = items.create({
        project_id: project.id,
        title: 'Item A',
        session_ids: [session.id],
      });

      const run = await reconcile.propose({
        project_id: project.id,
        text: '(seed)',
        source: 'manual',
        session_id: session.id,
      });

      // Build a diff with: one valid edit + one row whose item_id no longer exists. The bulk
      // item-ownership check uses items.id, so a deleted-id row passes pre-flight (no row
      // returned therefore no project mismatch); items.update will then throw ItemNotFound
      // mid-loop. Transactional apply must roll back the first mutation.
      const tamperedDiff = {
        ...run.diff,
        rows: [
          {
            category: 'edited' as const,
            row_id: 'r1',
            item_id: itemA.id,
            current_title: itemA.title,
            current_description: itemA.description,
            next_title: 'Item A renamed',
            next_description: 'should be rolled back',
            evidence: 'first',
          },
          {
            category: 'completed' as const,
            row_id: 'r2',
            item_id: 'item-that-does-not-exist',
            current_status: 'open',
            next_status: 'done',
            current_title: 'Ghost',
            evidence: 'second',
          },
        ],
      };

      // Pre-flight check needs the ghost id present in the items table for project-id match;
      // since it's absent the bulk check sees no row therefore project mismatch. Use a foreign
      // item-id whose project matches but whose row we delete just before apply to get past
      // pre-flight but fail mid-loop.
      const itemB = items.create({
        project_id: project.id,
        title: 'Item B',
        session_ids: [session.id],
      });
      backend.db.prepare('DELETE FROM items WHERE id = ?').run(itemB.id);
      tamperedDiff.rows[1]!.item_id = itemB.id;

      expect(() => reconcile.apply({ run_id: run.id, diff: tamperedDiff })).toThrow();

      // Roll-back assertion: Item A's title was NOT updated, and the run is still pending.
      const refetched = items.get(itemA.id);
      expect(refetched?.title).toBe('Item A');
      expect(reconcile.get(run.id)?.status).toBe('pending');
    } finally {
      await backend.cleanup();
    }
  });
});

describe('reconcile blocker shape', () => {
  it('preserves null next_blocker_text when caller explicitly clears the blocker', async () => {
    const { backend, items, reconcile, project, session } = await setup();
    try {
      const item = items.create({
        project_id: project.id,
        title: 'Cleanup orphans',
        session_ids: [session.id],
        blocker_text: 'waiting on design',
      });
      const run = await reconcile.propose({
        project_id: project.id,
        text: '(seed input)',
        source: 'manual',
        session_id: session.id,
      });
      const blockerRow: ReconcileRowBlocker = {
        category: 'blocker',
        row_id: 'rb',
        item_id: item.id,
        current_blocker_text: 'waiting on design',
        next_blocker_text: null,
        evidence: 'unblocked',
      };
      reconcile.apply({
        run_id: run.id,
        diff: { ...run.diff, rows: [blockerRow] },
      });
      const refetched = items.get(item.id);
      expect(refetched?.blocker_text).toBeNull();
    } finally {
      await backend.cleanup();
    }
  });
});
