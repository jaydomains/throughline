import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { nanoid } from 'nanoid';
import { openDb } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { registerAuditRoutes } from '../src/audit/routes.js';
import { deriveTriggerType } from '../src/audit/trigger-type.js';
import { makeTmpConfig } from './helpers.js';
import type { DB } from '../src/db/index.js';
import type { AuditActor, AuditEntry } from '@throughline/shared';

function seed(
  db: DB,
  opts: {
    timestamp: string;
    actor: AuditActor;
    triggerContext?: Record<string, unknown>;
    field?: string;
  },
): string {
  const id = nanoid();
  db.prepare(
    `INSERT INTO audit_log
      (id, timestamp, project_id, entity_type, entity_id, actor, field, old_value, new_value, trigger_context_json)
      VALUES (?, ?, ?, 'item', 'i1', ?, ?, NULL, 'v', ?)`,
  ).run(
    id,
    opts.timestamp,
    null,
    opts.actor,
    opts.field ?? 'status',
    JSON.stringify(opts.triggerContext ?? {}),
  );
  return id;
}

async function setup() {
  const cfg = makeTmpConfig();
  const db = openDb(cfg.dbPath);
  runMigrations(db);
  const app = Fastify();
  registerAuditRoutes(app, db);
  await app.ready();
  return { db, app };
}

async function query(app: Awaited<ReturnType<typeof setup>>['app'], qs: string) {
  const res = await app.inject({ method: 'GET', url: `/api/audit?${qs}` });
  return res;
}

describe('audit log filters (F7-04 / SPEC §7.22)', () => {
  it('filters by time range, actor, and trigger type — independently and combined', async () => {
    const { db, app } = await setup();
    try {
      // Three timestamps across a week.
      seed(db, { timestamp: '2026-05-01T00:00:00.000Z', actor: 'user' });
      seed(db, {
        timestamp: '2026-05-05T00:00:00.000Z',
        actor: 'ai',
        triggerContext: { model: 'claude-sonnet-4-6', prompt_fingerprint: 'abc' },
      });
      seed(db, {
        timestamp: '2026-05-09T00:00:00.000Z',
        actor: 'ai_auto_apply',
        triggerContext: { pr_number: 42, repo: 'o/r' },
      });
      seed(db, {
        timestamp: '2026-05-09T06:00:00.000Z',
        actor: 'methodology_runtime',
        triggerContext: { gate_id: 'g1', moment: 'pre-commit' },
      });

      // Time range: only the two May-09 rows.
      const tr = await query(app, 'since=2026-05-08T00:00:00.000Z&until=2026-05-10T00:00:00.000Z');
      expect(tr.statusCode).toBe(200);
      const trEntries = tr.json().entries as AuditEntry[];
      expect(trEntries).toHaveLength(2);
      expect(trEntries.every((e) => e.timestamp >= '2026-05-08')).toBe(true);

      // Actor filter.
      const ac = await query(app, 'actor=ai');
      expect((ac.json().entries as AuditEntry[]).map((e) => e.actor)).toEqual(['ai']);

      // Trigger-type filters partition the rows.
      const gh = (await query(app, 'trigger_type=github')).json().entries as AuditEntry[];
      expect(gh).toHaveLength(1);
      expect(gh[0]!.trigger_context.pr_number).toBe(42);

      const ai = (await query(app, 'trigger_type=ai')).json().entries as AuditEntry[];
      expect(ai).toHaveLength(1);
      expect(ai[0]!.trigger_context.model).toBe('claude-sonnet-4-6');

      const meth = (await query(app, 'trigger_type=methodology')).json().entries as AuditEntry[];
      expect(meth).toHaveLength(1);

      const manual = (await query(app, 'trigger_type=manual')).json().entries as AuditEntry[];
      expect(manual).toHaveLength(1);
      expect(manual[0]!.actor).toBe('user');

      // Combined: trigger_type=github AND a time window excluding it → empty.
      const combined = await query(
        app,
        'trigger_type=github&until=2026-05-08T00:00:00.000Z',
      );
      expect(combined.json().entries as AuditEntry[]).toHaveLength(0);
    } finally {
      app.close();
      db.close();
    }
  });

  it('a row carrying overlapping keys is classified once, by precedence (github > ai)', async () => {
    const { db, app } = await setup();
    try {
      seed(db, {
        timestamp: '2026-05-05T00:00:00.000Z',
        actor: 'ai_auto_apply',
        triggerContext: { pr_number: 7, model: 'claude-sonnet-4-6' }, // both github + ai keys
      });
      // Precedence puts it in github, NOT ai → appears in github, absent from ai.
      expect((await query(app, 'trigger_type=github')).json().entries as AuditEntry[]).toHaveLength(1);
      expect((await query(app, 'trigger_type=ai')).json().entries as AuditEntry[]).toHaveLength(0);
      // SQL predicate and the JS deriver agree.
      expect(deriveTriggerType({ pr_number: 7, model: 'x' })).toBe('github');
    } finally {
      app.close();
      db.close();
    }
  });

  it('rejects an unknown actor or trigger_type with 400 (no silent empty)', async () => {
    const { db, app } = await setup();
    try {
      seed(db, { timestamp: '2026-05-01T00:00:00.000Z', actor: 'user' });
      expect((await query(app, 'actor=robot')).statusCode).toBe(400);
      expect((await query(app, 'trigger_type=slack')).statusCode).toBe(400);
    } finally {
      app.close();
      db.close();
    }
  });

  it('deriveTriggerType covers each documented discriminator and the manual default', () => {
    expect(deriveTriggerType({ pr_number: 1 })).toBe('github');
    expect(deriveTriggerType({ repo: 'o/r' })).toBe('github');
    expect(deriveTriggerType({ model: 'm' })).toBe('ai');
    expect(deriveTriggerType({ prompt_fingerprint: 'f' })).toBe('ai');
    expect(deriveTriggerType({ gate_id: 'g' })).toBe('methodology');
    expect(deriveTriggerType({ moment: 'pre-commit' })).toBe('methodology');
    expect(deriveTriggerType({ checklist_id: 'c' })).toBe('methodology');
    expect(deriveTriggerType({})).toBe('manual');
    expect(deriveTriggerType({ some_other_key: 'x' })).toBe('manual');
  });
});
