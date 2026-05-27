import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createProjectsService } from '../src/projects/service.js';
import { createItemsService } from '../src/items/service.js';
import { createLibraryService } from '../src/library/service.js';
import { createCompanionEngine } from '../src/methodology/companion/engine.js';
import type { CompanionJudge } from '../src/methodology/companion/judgement.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const TEST_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'test-bundle', 'bundle.md');
const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantBundle(methodologiesDir: string, name: string, src: string): void {
  const target = join(methodologiesDir, name);
  mkdirSync(target, { recursive: true });
  copyFileSync(src, join(target, 'bundle.md'));
}

function makeRepo(dir: string): string {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SPEC.md'), '# Spec\nclean\n');
  writeFileSync(join(dir, 'NOTES.md'), '# Notes\n');
  mkdirSync(join(dir, 'docs', '_meta'), { recursive: true });
  mkdirSync(join(dir, 'docs', 'handovers'), { recursive: true });
  return dir;
}

// A judge that records the prompt it saw and returns a fixed proposal with telemetry, so
// the AI-judgement audit/cost wiring (T-D24/T-D29) can be asserted without a network call.
function stubJudge(): CompanionJudge & { calls: number } {
  return {
    calls: 0,
    available: () => true,
    async judge(ctx) {
      this.calls += 1;
      return {
        decision: 'pass',
        rationale: `looks fine for ${ctx.stepId}`,
        telemetry: {
          model: 'claude-sonnet-4-6',
          input_tokens: 120,
          output_tokens: 30,
          prompt: ctx.stateDigest,
        },
      };
    },
  };
}

async function setup(bundleId = 'test-bundle') {
  const cfg = makeTmpConfig();
  plantBundle(cfg.methodologiesDir, 'test-bundle', TEST_BUNDLE_PATH);
  plantBundle(cfg.methodologiesDir, 'freeform', FREEFORM_BUNDLE_PATH);
  const backend = await makeBackend(cfg);
  const repoPath = makeRepo(join(cfg.dataDir, 'repo'));
  const projects = createProjectsService(backend.db, backend.registry);
  const items = createItemsService(backend.db, projects, backend.registry, {});
  const library = createLibraryService(backend.db, projects);
  const judge = stubJudge();
  const engine = createCompanionEngine({
    db: backend.db,
    projects,
    registry: backend.registry,
    library,
    judge,
  });
  const project = projects.create({ name: 'tb', repo_path: repoPath, bundle_id: bundleId });
  return { backend, cfg, projects, items, library, engine, judge, project };
}

async function withCleanup<T extends { backend: { cleanup: () => Promise<void> } }>(
  p: Promise<T>,
): Promise<T & { cleanup: () => Promise<void> }> {
  const v = await p;
  return { ...v, cleanup: async () => v.backend.cleanup() };
}

describe('Phase 12 — companion review runtime (C-D8, T-D45)', () => {
  it('bundle-declared checklists instantiate as a ChecklistRun with all steps pending', async () => {
    const { engine, project, cleanup } = await withCleanup(setup());
    try {
      const cat = engine.listChecklists(project.id);
      expect(cat.checklists.map((c) => c.id)).toEqual(['review']);
      expect(cat.companion_modes.map((m) => m.id)).toEqual(['standard', 'strict']);

      const run = engine.startRun(project.id, 'review');
      expect(run.state).toBe('running');
      // default companion mode is the bundle's first-declared mode.
      expect(run.companion_mode).toBe('standard');
      expect(run.steps).toHaveLength(2);
      expect(run.steps.every((s) => s.state === 'pending')).toBe(true);
      expect(run.steps.map((s) => s.kind)).toEqual(['mechanical', 'judgement']);
    } finally {
      await cleanup();
    }
  });

  it('mechanical step runs the shared check pipeline, writes findings + audits each transition', async () => {
    const { backend, engine, project, cleanup } = await withCleanup(setup());
    try {
      const run = engine.startRun(project.id, 'review');
      const after = await engine.runMechanicalStep(run.id, 'anchor-citation-validation');
      const step = after.steps.find((s) => s.step_id === 'anchor-citation-validation')!;
      // clean repo, no cited anchors → anchor-resolution passes.
      expect(step.state).toBe('passed');
      expect(step.findings.check).toBe('anchor-resolution');

      const audits = backend.db
        .prepare(
          `SELECT field FROM audit_log
             WHERE entity_type = 'checklist_step' AND actor = 'methodology_runtime'
             ORDER BY timestamp`,
        )
        .all() as Array<{ field: string }>;
      expect(audits.map((a) => a.field)).toEqual(['mechanical_started', 'mechanical_resolved']);
    } finally {
      await cleanup();
    }
  });

  it('a failed mechanical step does not halt the run; override is audit-logged and continues', async () => {
    const { backend, engine, items, project, cleanup } = await withCleanup(setup());
    try {
      // Cite an anchor that does not resolve in the repo docs → mechanical step fails.
      const item = items.create({ project_id: project.id, type: 'task', title: 't' });
      backend.db
        .prepare(`INSERT INTO item_anchor_citations (item_id, anchor_id) VALUES (?, ?)`)
        .run(item.id, 'ZZ-D99');

      const run = engine.startRun(project.id, 'review');
      const failed = await engine.runMechanicalStep(run.id, 'anchor-citation-validation');
      expect(
        failed.steps.find((s) => s.step_id === 'anchor-citation-validation')!.state,
      ).toBe('failed');

      // Run is still running; the failure is a proposal, not a halt (T-D44 kin).
      expect(failed.state).toBe('running');

      const overridden = engine.overrideStep(
        run.id,
        'anchor-citation-validation',
        'anchor lands in a later slice',
      );
      const step = overridden.steps.find(
        (s) => s.step_id === 'anchor-citation-validation',
      )!;
      expect(step.state).toBe('passed');
      expect(step.findings.override?.reason).toBe('anchor lands in a later slice');

      const ov = backend.db
        .prepare(
          `SELECT * FROM audit_log WHERE entity_type = 'checklist_step' AND field = 'override'`,
        )
        .all() as unknown[];
      expect(ov).toHaveLength(1);
    } finally {
      await cleanup();
    }
  });

  it('judgement step takes a user call with rationale and audit-logs the transition', async () => {
    const { backend, engine, project, cleanup } = await withCleanup(setup());
    try {
      const run = engine.startRun(project.id, 'review');
      const after = engine.resolveJudgementStep(run.id, 'scope-assessment', {
        decision: 'pass',
        rationale: 'scope matches the planned slice',
      });
      const step = after.steps.find((s) => s.step_id === 'scope-assessment')!;
      expect(step.state).toBe('passed');
      expect(step.findings.summary).toBe('scope matches the planned slice');

      const a = backend.db
        .prepare(
          `SELECT actor, field FROM audit_log
             WHERE entity_type = 'checklist_step' AND field = 'judgement_resolved'`,
        )
        .get() as { actor: string; field: string };
      expect(a.actor).toBe('user');
    } finally {
      await cleanup();
    }
  });

  it('AI judgement proposes (step stays in-progress), records model + fingerprint + cost', async () => {
    const { backend, engine, judge, project, cleanup } = await withCleanup(setup());
    try {
      const run = engine.startRun(project.id, 'review');
      const after = await engine.aiJudgeStep(run.id, 'scope-assessment');
      const step = after.steps.find((s) => s.step_id === 'scope-assessment')!;
      expect(judge.calls).toBe(1);
      // A proposal does not auto-resolve the step (C-D8 path b).
      expect(step.state).toBe('in-progress');
      expect(step.findings.ai_proposal?.decision).toBe('pass');
      expect(step.findings.ai_proposal?.model).toBe('claude-sonnet-4-6');

      const model = backend.db
        .prepare(
          `SELECT new_value, trigger_context_json FROM audit_log
             WHERE entity_type = 'checklist_step' AND field = 'ai_judgement_model'`,
        )
        .get() as { new_value: string; trigger_context_json: string };
      expect(model.new_value).toBe('claude-sonnet-4-6');
      const tc = JSON.parse(model.trigger_context_json) as Record<string, unknown>;
      expect(typeof tc.prompt_fingerprint).toBe('string');
      // T-D24 — the raw prompt is never stored.
      expect(model.trigger_context_json).not.toContain('Bundle:');

      const cost = backend.db
        .prepare(
          `SELECT feature, model FROM cost_telemetry WHERE feature = 'companion_review_judgement'`,
        )
        .get() as { feature: string; model: string } | undefined;
      expect(cost?.model).toBe('claude-sonnet-4-6');

      // The user then commits a (possibly different) call; AI proposal is retained.
      const resolved = engine.resolveJudgementStep(run.id, 'scope-assessment', {
        decision: 'fail',
        rationale: 'overrode AI: scope crept',
      });
      const rs = resolved.steps.find((s) => s.step_id === 'scope-assessment')!;
      expect(rs.state).toBe('failed');
      expect(rs.findings.ai_proposal?.decision).toBe('pass');
    } finally {
      await cleanup();
    }
  });

  it('completing a run saves an optional library note attached to discussed items (T-D10)', async () => {
    const { engine, items, library, project, cleanup } = await withCleanup(setup());
    try {
      const item = items.create({ project_id: project.id, type: 'task', title: 'discussed' });
      const run = engine.startRun(project.id, 'review');
      const done = engine.completeRun(run.id, {
        summary: '## Review\nAll good.',
        itemIds: [item.id],
      });
      expect(done.state).toBe('completed');
      expect(done.completed_at).not.toBeNull();
      expect(done.summary_entry_id).toBeTruthy();

      const note = library.get(done.summary_entry_id!)!;
      expect(note.type).toBe('note');
      expect(note.body).toContain('All good.');
      const attached = library.listAttachedNotes(item.id);
      expect(attached.map((n) => n.id)).toContain(done.summary_entry_id);
    } finally {
      await cleanup();
    }
  });

  it('completing without a summary skips note creation; further mutation is rejected', async () => {
    const { engine, project, cleanup } = await withCleanup(setup());
    try {
      const run = engine.startRun(project.id, 'review');
      const done = engine.completeRun(run.id, {});
      expect(done.summary_entry_id).toBeNull();
      expect(() => engine.completeRun(run.id, {})).toThrow();
      await expect(
        engine.runMechanicalStep(run.id, 'anchor-citation-validation'),
      ).rejects.toThrow();
    } finally {
      await cleanup();
    }
  });

  it('runProjectId resolves run ownership for the cross-project route guard', async () => {
    const { engine, projects, project, cleanup } = await withCleanup(setup());
    try {
      const other = projects.create({
        name: 'other',
        repo_path: `${project.repo_path}-other`,
        bundle_id: 'test-bundle',
      });
      const run = engine.startRun(project.id, 'review');
      expect(engine.runProjectId(run.id)).toBe(project.id);
      // A run from project A does not belong to project B (guard denies the mutation).
      expect(engine.runProjectId(run.id)).not.toBe(other.id);
      expect(engine.runProjectId('does-not-exist')).toBeNull();
    } finally {
      await cleanup();
    }
  });

  it('listRuns batch-assembles every run newest-first with recovered mode + summary', async () => {
    const { engine, project, cleanup } = await withCleanup(setup());
    try {
      const first = engine.startRun(project.id, 'review', 'standard');
      engine.completeRun(first.id, { summary: 'first run notes' });
      const second = engine.startRun(project.id, 'review', 'strict');

      const runs = engine.listRuns(project.id);
      expect(runs.map((r) => r.id)).toEqual([second.id, first.id]);
      const f = runs.find((r) => r.id === first.id)!;
      const s = runs.find((r) => r.id === second.id)!;
      expect(f.state).toBe('completed');
      expect(f.companion_mode).toBe('standard');
      expect(f.summary_entry_id).toBeTruthy();
      expect(s.state).toBe('running');
      expect(s.companion_mode).toBe('strict');
      expect(s.summary_entry_id).toBeNull();
      // Steps are still re-derived from the bundle ChecklistSpec in the batched path.
      expect(s.steps.map((x) => x.step_id)).toEqual([
        'anchor-citation-validation',
        'scope-assessment',
      ]);
      expect(s.steps.map((x) => x.kind)).toEqual(['mechanical', 'judgement']);
    } finally {
      await cleanup();
    }
  });

  it('freeform-bound project declares no checklists (verified no-op)', async () => {
    const { engine, project, cleanup } = await withCleanup(setup('freeform'));
    try {
      const cat = engine.listChecklists(project.id);
      expect(cat.checklists).toHaveLength(0);
      expect(() => engine.startRun(project.id, 'review')).toThrow();
    } finally {
      await cleanup();
    }
  });
});
