import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AnthropicClient } from '../src/ai/anthropic.js';
import type { GitHubApi } from '../src/github/api.js';
import { createProjectsService } from '../src/projects/service.js';
import { createItemsService } from '../src/items/service.js';
import { createLibraryService } from '../src/library/service.js';
import { createSessionsService } from '../src/sessions/service.js';
import { createDriftService } from '../src/drift/service.js';
import { createOrphanRulesService } from '../src/github/orphan-rules.js';
import { createSettingsService } from '../src/settings/service.js';
import { createRetroService, SessionNotFoundError } from '../src/intelligence/retro.js';
import { createPeriodicReviewService } from '../src/intelligence/periodic-review.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const FREEFORM = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantFreeform(dir: string): void {
  const target = join(dir, 'freeform');
  mkdirSync(target, { recursive: true });
  copyFileSync(FREEFORM, join(target, 'bundle.md'));
}
function stubAnthropic(answer: string): AnthropicClient {
  return {
    available: () => true,
    call: async () => ({ text: answer, input_tokens: 40, output_tokens: 15, stop_reason: 'end_turn' }),
  };
}
function offAnthropic(): AnthropicClient {
  return { available: () => false, call: async () => { throw new Error('off'); } };
}
function costRows(db: import('../src/db/index.js').DB, feature: string): number {
  return (db.prepare(`SELECT COUNT(*) n FROM cost_telemetry WHERE feature = ?`).get(feature) as { n: number }).n;
}
function auditRows(db: import('../src/db/index.js').DB, field: string): number {
  return (db.prepare(`SELECT COUNT(*) n FROM audit_log WHERE field = ?`).get(field) as { n: number }).n;
}

async function setup(anthropic: AnthropicClient = offAnthropic()) {
  const cfg = makeTmpConfig();
  plantFreeform(cfg.methodologiesDir);
  const backend = await makeBackend(cfg);
  const repoPath = join(cfg.dataDir, 'repo');
  mkdirSync(repoPath, { recursive: true });
  const projects = createProjectsService(backend.db, backend.registry);
  const items = createItemsService(backend.db, projects, backend.registry, {});
  const library = createLibraryService(backend.db, projects);
  const sessions = createSessionsService(backend.db, projects);
  const drift = createDriftService(backend.db);
  const orphanRules = createOrphanRulesService({
    db: backend.db,
    projects,
    api: {} as unknown as GitHubApi,
  });
  const settings = createSettingsService(backend.db);
  const retro = createRetroService({ db: backend.db, projects, sessions, items, library, anthropic });
  const periodicReview = createPeriodicReviewService({
    db: backend.db,
    projects,
    registry: backend.registry,
    drift,
    orphanRules,
    items,
    sessions,
    settings,
    anthropic,
  });
  const project = projects.create({ name: 'p1', repo_path: repoPath });
  return {
    backend, projects, items, library, sessions, drift, orphanRules, settings,
    retro, periodicReview, project, repoPath, cleanup: () => backend.cleanup(),
  };
}

describe('Phase 14 — end-of-session retro (SPEC §7.18)', () => {
  it('AI-summarises, saves a library note, attaches it, and appends session-start.md', async () => {
    const s = await setup(stubAnthropic('## Retro\nThings moved.'));
    try {
      const sess = s.sessions.create({ project_id: s.project.id, name: 'sprint-1' });
      const it = s.items.create({ project_id: s.project.id, title: 'wire feature', status: 'open' });
      s.items.addSessionMembership(it.id, sess.id);

      const r = await s.retro.generate(s.project.id, {
        session_id: sess.id,
        attach_to_items: true,
        append_to_session_start: true,
      });

      expect(r.used_ai).toBe(true);
      expect(r.summary).toContain('Things moved');
      const note = s.library.get(r.library_entry_id);
      expect(note?.type).toBe('note');
      expect(r.attached_item_ids).toEqual([it.id]);
      expect(s.library.listAttachedNotes(it.id).map((n) => n.id)).toContain(r.library_entry_id);
      expect(r.appended_to_session_start).toBe(true);
      expect(readFileSync(join(s.repoPath, 'session-start.md'), 'utf8')).toContain('Things moved');
      expect(costRows(s.backend.db, 'session_retro')).toBe(1);
      expect(auditRows(s.backend.db, 'retro')).toBe(1);
    } finally {
      await s.cleanup();
    }
  });

  it('degrades to a deterministic structured summary with no cost when AI is off', async () => {
    const s = await setup(offAnthropic());
    try {
      const sess = s.sessions.create({ project_id: s.project.id, name: 's2' });
      const r = await s.retro.generate(s.project.id, { session_id: sess.id });
      expect(r.used_ai).toBe(false);
      expect(r.summary).toContain('# Session retro — s2');
      expect(r.appended_to_session_start).toBe(false);
      expect(costRows(s.backend.db, 'session_retro')).toBe(0);
      expect(auditRows(s.backend.db, 'retro')).toBe(1);
    } finally {
      await s.cleanup();
    }
  });

  it('rejects a session that does not belong to the project', async () => {
    const s = await setup();
    try {
      await expect(
        s.retro.generate(s.project.id, { session_id: 'nope' }),
      ).rejects.toBeInstanceOf(SessionNotFoundError);
    } finally {
      await s.cleanup();
    }
  });
});

describe('Phase 14 — periodic review (T-D22)', () => {
  it('hygiene buckets run with no AI and span drift / orphans / blockers / sessions', async () => {
    const s = await setup(offAnthropic());
    try {
      s.drift.createCodeSignal({
        projectId: s.project.id, itemId: null, category: 'tier-2', reason: 'drifted',
      });
      s.drift.createDisciplineSignal({
        projectId: s.project.id, category: 'anchor-missing', itemId: null,
        primaryUnitRef: null, reason: 'no anchor',
      });
      s.backend.db
        .prepare(
          `INSERT INTO orphaned_rules (id, project_id, rule_path, original_item_id, created_at)
             VALUES ('o1', ?, 'rules/x.yml', 'gone', ?)`,
        )
        .run(s.project.id, new Date().toISOString());
      const a = s.items.create({ project_id: s.project.id, title: 'blocked work', status: 'open' });
      const b = s.items.create({ project_id: s.project.id, title: 'blocker', status: 'open' });
      s.items.addBlocker(a.id, b.id);

      const r = s.periodicReview.review(s.project.id);
      expect(r.interval_days).toBe(14);
      expect(r.last_reviewed_at).toBeNull();
      expect(r.due).toBe(true);
      const cat = (c: string) => r.buckets.find((x) => x.category === c)!;
      expect(cat('code-drift').count).toBe(1);
      expect(cat('discipline-drift').count).toBe(1);
      expect(cat('orphaned-rules').count).toBe(1);
      expect(cat('long-held-blockers').count).toBe(1);
      expect(cat('untouched-sessions')).toBeTruthy();
      // No cost during the no-AI hygiene pass (T-D22).
      expect(costRows(s.backend.db, 'periodic_review')).toBe(0);
    } finally {
      await s.cleanup();
    }
  });

  it('honours a per-project interval override and advances last-reviewed on synthesise', async () => {
    const s = await setup(stubAnthropic('Clean up the tier-2 signal first.'));
    try {
      s.projects.update(s.project.id, { settings: { periodic_review_interval_days: 7 } });
      expect(s.periodicReview.review(s.project.id).interval_days).toBe(7);

      const syn = await s.periodicReview.synthesize(s.project.id);
      expect(syn.used_ai).toBe(true);
      expect(syn.answer).toContain('tier-2');
      expect(costRows(s.backend.db, 'periodic_review')).toBe(1);
      expect(auditRows(s.backend.db, 'periodic_review_opened')).toBe(1);

      const after = s.periodicReview.review(s.project.id);
      expect(after.last_reviewed_at).not.toBeNull();
      expect(after.due).toBe(false);
    } finally {
      await s.cleanup();
    }
  });

  it('synthesise records the review-opened event even with no AI key', async () => {
    const s = await setup(offAnthropic());
    try {
      const syn = await s.periodicReview.synthesize(s.project.id);
      expect(syn.used_ai).toBe(false);
      expect(syn.answer).toBeNull();
      expect(auditRows(s.backend.db, 'periodic_review_opened')).toBe(1);
      expect(s.periodicReview.review(s.project.id).last_reviewed_at).not.toBeNull();
    } finally {
      await s.cleanup();
    }
  });
});
