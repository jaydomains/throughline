import { describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { openDb } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { createSettingsService } from '../src/settings/service.js';
import { createCostSummaryService } from '../src/cost/summary.js';
import { recordCost } from '../src/cost/telemetry.js';
import { makeTmpConfig } from './helpers.js';
import type { DB } from '../src/db/index.js';

function seedAt(db: DB, projectId: string | null, feature: string, usd: number, iso: string) {
  db.prepare(
    `INSERT INTO cost_telemetry
       (id, project_id, timestamp, feature, model, input_tokens, output_tokens, usd_estimate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(nanoid(), projectId, iso, feature, 'claude-sonnet-4-6', 100, 50, usd);
}

describe('cost summary (T-D29)', () => {
  it('rolls up day/week/month with per-feature breakdown and project vs global scope', () => {
    const cfg = makeTmpConfig();
    try {
      const db = openDb(cfg.dbPath);
      runMigrations(db);
      // Projects are referenced by FK; insert two minimal rows.
      const now = new Date('2026-05-17T12:00:00.000Z');
      for (const pid of ['pA', 'pB']) {
        db.prepare(
          `INSERT INTO projects (id, name, repo_path, github_owner, github_repo, bundle_id, bundle_path, state, settings_json, created_at, updated_at, archived_at)
           VALUES (?, ?, '/x', NULL, NULL, 'freeform', NULL, 'active', '{}', ?, ?, NULL)`,
        ).run(pid, pid, now.toISOString(), now.toISOString());
      }
      const settings = createSettingsService(db);
      const cost = createCostSummaryService(db, settings);

      // Today (within day window)
      seedAt(db, 'pA', 'dump_zone', 0.5, '2026-05-17T09:00:00.000Z');
      seedAt(db, 'pA', 'chat', 0.25, '2026-05-17T10:00:00.000Z');
      // 3 days ago (week but not day)
      seedAt(db, 'pA', 'dump_zone', 1.0, '2026-05-14T09:00:00.000Z');
      // 20 days ago (month but not week)
      seedAt(db, 'pA', 'retro', 2.0, '2026-04-28T09:00:00.000Z');
      // Other project
      seedAt(db, 'pB', 'chat', 4.0, '2026-05-17T09:00:00.000Z');

      const pA = cost.summary({ scope: 'project', projectId: 'pA', now });
      expect(pA.day.usd_estimate).toBeCloseTo(0.75);
      expect(pA.week.usd_estimate).toBeCloseTo(1.75);
      expect(pA.month.usd_estimate).toBeCloseTo(3.75);
      const dayFeatures = pA.day.by_feature.map((f) => f.feature).sort();
      expect(dayFeatures).toEqual(['chat', 'dump_zone']);
      // Sorted by spend desc.
      expect(pA.day.by_feature[0]!.feature).toBe('dump_zone');

      const global = cost.summary({ scope: 'global', projectId: null, now });
      expect(global.project_id).toBeNull();
      expect(global.day.usd_estimate).toBeCloseTo(4.75); // pA 0.75 + pB 4.0
      db.close();
    } finally {
      cfg.cleanup();
    }
  });

  it('threshold defaults to none and flips exceeded only when set and breached', () => {
    const cfg = makeTmpConfig();
    try {
      const db = openDb(cfg.dbPath);
      runMigrations(db);
      const settings = createSettingsService(db);
      const cost = createCostSummaryService(db, settings);
      const now = new Date('2026-05-17T12:00:00.000Z');
      seedAt(db, null, 'rag_text', 3.0, '2026-05-17T09:00:00.000Z');

      let s = cost.summary({ scope: 'global', projectId: null, now });
      expect(s.daily_threshold_usd).toBeNull();
      expect(s.daily_threshold_exceeded).toBe(false);

      settings.set('cost_daily_threshold_usd', 5);
      s = cost.summary({ scope: 'global', projectId: null, now });
      expect(s.daily_threshold_exceeded).toBe(false);

      settings.set('cost_daily_threshold_usd', 2);
      s = cost.summary({ scope: 'global', projectId: null, now });
      expect(s.daily_threshold_usd).toBe(2);
      expect(s.daily_threshold_exceeded).toBe(true);
      db.close();
    } finally {
      cfg.cleanup();
    }
  });

  it('counts the existing recordCost write path', () => {
    const cfg = makeTmpConfig();
    try {
      const db = openDb(cfg.dbPath);
      runMigrations(db);
      const settings = createSettingsService(db);
      const cost = createCostSummaryService(db, settings);
      recordCost(db, {
        projectId: null,
        feature: 'session_retro',
        model: 'claude-sonnet-4-6',
        inputTokens: 1000,
        outputTokens: 500,
        usdEstimate: 0.012,
      });
      const s = cost.summary({ scope: 'global', projectId: null });
      expect(s.day.call_count).toBe(1);
      expect(s.day.usd_estimate).toBeCloseTo(0.012);
      db.close();
    } finally {
      cfg.cleanup();
    }
  });
});
