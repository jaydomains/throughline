import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DB } from '../src/db/index.js';
import { createProjectsService } from '../src/projects/service.js';
import { createItemsService } from '../src/items/service.js';
import { createLibraryService } from '../src/library/service.js';
import { createDirectivesService } from '../src/directives/service.js';
import {
  createSessionStartEngine,
  InvalidModeError,
} from '../src/methodology/session-start/engine.js';
import type {
  RelevanceClassifier,
  RelevanceCandidate,
} from '../src/methodology/session-start/classifier.js';
import { createAnthropicRelevanceClassifier } from '../src/methodology/session-start/classifier.js';
import type { AnthropicClient } from '../src/ai/anthropic.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

// A client that "succeeds" (a billed call) but returns text the classifier can't parse —
// the SF2-04 case: an unparseable AI response that used to be reported as AI-classified.
function nonJsonClient(): AnthropicClient {
  return {
    available: () => true,
    call: async () => ({ text: 'sorry, I cannot help with that', input_tokens: 50, output_tokens: 8, stop_reason: 'end_turn' }),
  };
}

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
  return dir;
}

// Records calls + the candidates it saw and returns a fixed tiering with telemetry, so the
// classify→render mapping and the T-D24/T-D29 wiring can be asserted without a network call.
function stubClassifier(
  tierFor: (c: RelevanceCandidate) => 'high' | 'medium' | 'low' = () => 'medium',
  available = true,
): RelevanceClassifier & { calls: number; lastCandidates: RelevanceCandidate[] } {
  return {
    calls: 0,
    lastCandidates: [],
    available: () => available,
    async classify(_slice, candidates) {
      this.calls += 1;
      this.lastCandidates = candidates;
      const tiers: Record<string, 'high' | 'medium' | 'low'> = {};
      for (const c of candidates) tiers[c.ref] = tierFor(c);
      return {
        tiers,
        classified_by_ai: available,
        telemetry: available
          ? { model: 'claude-haiku-4-5', input_tokens: 90, output_tokens: 20, prompt: _slice }
          : { model: null, input_tokens: 0, output_tokens: 0, prompt: null },
      };
    },
  };
}

async function setup(
  bundleId = 'test-bundle',
  classifier: RelevanceClassifier = stubClassifier(),
) {
  const cfg = makeTmpConfig();
  plantBundle(cfg.methodologiesDir, 'test-bundle', TEST_BUNDLE_PATH);
  plantBundle(cfg.methodologiesDir, 'freeform', FREEFORM_BUNDLE_PATH);
  const backend = await makeBackend(cfg);
  const repoPath = makeRepo(join(cfg.dataDir, 'repo'));
  const projects = createProjectsService(backend.db, backend.registry);
  const items = createItemsService(backend.db, projects, backend.registry, {});
  const library = createLibraryService(backend.db, projects);
  const directives = createDirectivesService(backend.db, projects, items, library);
  const engine = createSessionStartEngine({
    db: backend.db,
    projects,
    registry: backend.registry,
    items,
    library,
    directives,
    classifier,
  });
  const project = projects.create({ name: 'tb', repo_path: repoPath, bundle_id: bundleId });
  return {
    backend,
    projects,
    items,
    library,
    directives,
    engine,
    project,
    cleanup: () => backend.cleanup(),
  };
}

function costRows(db: DB, projectId: string): number {
  return (
    db
      .prepare(
        `SELECT COUNT(*) n FROM cost_telemetry WHERE project_id = ? AND feature = 'session_start_assembly'`,
      )
      .get(projectId) as { n: number }
  ).n;
}

describe('Phase 13 — session-start scaffolding (C-D9, T-D12)', () => {
  it('lists the bundle-declared companion modes with the first as default', async () => {
    const s = await setup();
    try {
      const r = s.engine.modes(s.project.id);
      expect(r.modes.map((m) => m.id)).toEqual(['standard', 'strict']);
      expect(r.default_mode).toBe('standard');
    } finally {
      await s.cleanup();
    }
  });

  it('renders the bundle template for the chosen mode and lists open items', async () => {
    const s = await setup();
    try {
      s.items.create({ project_id: s.project.id, title: 'wire the pipeline', status: 'open' });
      s.items.create({ project_id: s.project.id, title: 'finished thing', status: 'done' });

      const def = await s.engine.generate(s.project.id, null);
      expect(def.mode).toBe('standard');
      expect(def.prompt).toContain('# Session start — tb (standard)');
      expect(def.prompt).toContain('- wire the pipeline [open]');
      // `done` is the terminal status of the `task` type ⇒ not an open item.
      expect(def.prompt).not.toContain('finished thing');

      const strict = await s.engine.generate(s.project.id, 'strict');
      expect(strict.mode).toBe('strict');
      expect(strict.prompt).toContain('# Session start — tb (strict)');
    } finally {
      await s.cleanup();
    }
  });

  it('rejects a mode the bundle does not declare', async () => {
    const s = await setup();
    try {
      await expect(s.engine.generate(s.project.id, 'nope')).rejects.toBeInstanceOf(
        InvalidModeError,
      );
    } finally {
      await s.cleanup();
    }
  });

  it('auto-prepends include-in-prompt directives (item + library, with note)', async () => {
    const s = await setup();
    try {
      const it = s.items.create({
        project_id: s.project.id,
        title: 'pinned ctx',
        description: 'always start here',
        status: 'open',
      });
      s.directives.create({
        project_id: s.project.id,
        parent_type: 'item',
        parent_id: it.id,
        kind: 'include_prompt',
        payload: { note: 'read first' },
      });
      const entry = s.library.create({
        project_id: s.project.id,
        type: 'note',
        title: 'house rules',
        body: 'no force-push',
      });
      s.directives.create({
        project_id: s.project.id,
        parent_type: 'library',
        parent_id: entry.id,
        kind: 'include_prompt',
      });

      const r = await s.engine.generate(s.project.id, null);
      const prefixEnd = r.prompt.indexOf('# Session start');
      const prefix = r.prompt.slice(0, prefixEnd);
      expect(prefix).toContain('Include-in-prompt (T-D12)');
      expect(prefix).toContain('> read first');
      expect(prefix).toContain('always start here');
      expect(prefix).toContain('no force-push');
    } finally {
      await s.cleanup();
    }
  });

  it('classifier tiers drive decision rendering; AI telemetry is audited + costed (T-D24/T-D29)', async () => {
    const classifier = stubClassifier((c) => (c.text.includes('keep') ? 'high' : 'low'));
    const s = await setup('test-bundle', classifier);
    try {
      // `note`-type items are the bundle's decision-bearing board (types beyond the first).
      s.items.create({
        project_id: s.project.id,
        type: 'note',
        title: 'keep me',
        description: 'governing rationale',
        status: 'draft',
      });
      s.items.create({
        project_id: s.project.id,
        type: 'note',
        title: 'drop me',
        description: 'irrelevant',
        status: 'draft',
      });

      const r = await s.engine.generate(s.project.id, null);
      expect(r.classifier_used_ai).toBe(true);
      // Scope to the rendered Decisions block: high ⇒ full text, low ⇒ dropped.
      const decisionsBlock = r.prompt.slice(
        r.prompt.indexOf('Decisions:'),
        r.prompt.indexOf('Anchors:'),
      );
      expect(decisionsBlock).toContain('### keep me');
      expect(decisionsBlock).toContain('governing rationale');
      expect(decisionsBlock).not.toContain('drop me');

      expect(costRows(s.backend.db, s.project.id)).toBe(1);
      const fp = s.backend.db
        .prepare(
          `SELECT trigger_context_json FROM audit_log
             WHERE entity_type = 'session_start' AND field = 'relevance_model'`,
        )
        .get() as { trigger_context_json: string };
      const ctx = JSON.parse(fp.trigger_context_json) as {
        model: string;
        prompt_fingerprint: string;
      };
      expect(ctx.model).toBe('claude-haiku-4-5');
      expect(ctx.prompt_fingerprint).toMatch(/^[0-9a-f]{16}$/);
    } finally {
      await s.cleanup();
    }
  });

  it('degrades to citation-only with no AI cost when the classifier is unavailable', async () => {
    const classifier = stubClassifier(() => 'medium', false);
    const s = await setup('test-bundle', classifier);
    try {
      s.items.create({
        project_id: s.project.id,
        type: 'note',
        title: 'a decision',
        description: 'body',
        status: 'draft',
      });
      const r = await s.engine.generate(s.project.id, null);
      expect(r.classifier_used_ai).toBe(false);
      // medium ⇒ citation line, not full body.
      expect(r.prompt).toContain('- a decision (');
      expect(r.prompt).not.toContain('### a decision');
      expect(costRows(s.backend.db, s.project.id)).toBe(0);
    } finally {
      await s.cleanup();
    }
  });

  it('unparseable AI ⇒ classifier_used_ai false, all-medium, but the call is still costed (SF2-04)', async () => {
    // The real classifier with a client that returns non-JSON: the call is made (and billed),
    // but it did not classify — so the result must report classifier_used_ai:false (not true)
    // while cost is still recorded (the decoupling: classified_by_ai vs a billed call).
    const s = await setup('test-bundle', createAnthropicRelevanceClassifier({ client: nonJsonClient() }));
    try {
      s.items.create({
        project_id: s.project.id,
        type: 'note',
        title: 'a decision',
        description: 'body',
        status: 'draft',
      });
      const r = await s.engine.generate(s.project.id, null);
      expect(r.classifier_used_ai).toBe(false); // SF2-04: was true before the fix
      // Degraded to the safe all-medium default ⇒ citation line, not full body.
      expect(r.prompt).toContain('- a decision (');
      expect(r.prompt).not.toContain('### a decision');
      // The billed call is still costed + audited — cost reflects the call, not the parse.
      expect(costRows(s.backend.db, s.project.id)).toBe(1);
    } finally {
      await s.cleanup();
    }
  });

  it('classifier reports classified_by_ai honestly: false on unparseable, true on parsed', async () => {
    const candidates: RelevanceCandidate[] = [{ ref: 'd1', text: 'a decision' }];
    const unparseable = createAnthropicRelevanceClassifier({ client: nonJsonClient() });
    const bad = await unparseable.classify('slice', candidates);
    expect(bad.classified_by_ai).toBe(false);
    expect(bad.telemetry.model).not.toBeNull(); // a call was made (billed) — decoupled
    expect(bad.tiers.d1).toBe('medium'); // safe all-medium default

    const okClient: AnthropicClient = {
      available: () => true,
      call: async () => ({ text: '{"d1":"high"}', input_tokens: 40, output_tokens: 5, stop_reason: 'end_turn' }),
    };
    const good = await createAnthropicRelevanceClassifier({ client: okClient }).classify('slice', candidates);
    expect(good.classified_by_ai).toBe(true);
    expect(good.tiers.d1).toBe('high');

    // Valid JSON that applies no tier (empty / all-mismatched keys) yields the same
    // all-medium result as the fallback — it must report classified_by_ai:false, not true on
    // parse-success alone (reviewer round-1 finding 1; T-D60 / SF2-04 boundary).
    const emptyJsonClient: AnthropicClient = {
      available: () => true,
      call: async () => ({ text: '{"unrelated":"high"}', input_tokens: 30, output_tokens: 4, stop_reason: 'end_turn' }),
    };
    const empty = await createAnthropicRelevanceClassifier({ client: emptyJsonClient }).classify('slice', candidates);
    expect(empty.classified_by_ai).toBe(false);
    expect(empty.telemetry.model).not.toBeNull(); // a call was made (billed) — decoupled
    expect(empty.tiers.d1).toBe('medium'); // all-medium default, indistinguishable from fallback
  });

  it('re-render-without-AI: unchanged context serves the cached prompt; a change regenerates', async () => {
    const classifier = stubClassifier();
    const s = await setup('test-bundle', classifier);
    try {
      const it = s.items.create({
        project_id: s.project.id,
        title: 'task one',
        status: 'open',
      });
      const first = await s.engine.generate(s.project.id, null);
      expect(first.cached).toBe(false);
      expect(classifier.calls).toBe(1);

      const second = await s.engine.generate(s.project.id, null);
      expect(second.cached).toBe(true);
      expect(second.prompt).toBe(first.prompt);
      expect(classifier.calls).toBe(1); // no fresh Haiku call
      expect(costRows(s.backend.db, s.project.id)).toBe(1);

      // Mutating the assembled context invalidates the fingerprint ⇒ regenerate.
      s.items.update(it.id, { title: 'task one renamed' });
      const third = await s.engine.generate(s.project.id, null);
      expect(third.cached).toBe(false);
      expect(classifier.calls).toBe(2);
    } finally {
      await s.cleanup();
    }
  });

  it('cache invalidates when the resolved template changes without a version bump', async () => {
    const classifier = stubClassifier();
    const s = await setup('test-bundle', classifier);
    try {
      s.items.create({ project_id: s.project.id, title: 'task one', status: 'open' });
      const first = await s.engine.generate(s.project.id, null);
      expect(first.cached).toBe(false);

      const cached = await s.engine.generate(s.project.id, null);
      expect(cached.cached).toBe(true);

      // Edit the standard session-start template in place — same identity.version — and
      // hot-reload the bundle, as the loader's file watcher would in development.
      const bundleFile = join(
        s.backend.config.methodologiesDir,
        'test-bundle',
        'bundle.md',
      );
      const edited = readFileSync(bundleFile, 'utf8').replace(
        'You are working on a test-bundle-bound component in standard mode.',
        'STANDARD MODE — REWORDED PREAMBLE.',
      );
      writeFileSync(bundleFile, edited);
      s.backend.registry.reload('test-bundle');

      const afterEdit = await s.engine.generate(s.project.id, null);
      expect(afterEdit.cached).toBe(false);
      expect(afterEdit.prompt).toContain('STANDARD MODE — REWORDED PREAMBLE.');
      expect(afterEdit.prompt).not.toBe(first.prompt);
    } finally {
      await s.cleanup();
    }
  });

  it('surfaces cross-primary-unit dependencies', async () => {
    const s = await setup();
    try {
      const a = s.items.create({
        project_id: s.project.id,
        title: 'frontend work',
        status: 'open',
        methodology_context: { primary_unit_refs: ['web'] },
      });
      const b = s.items.create({
        project_id: s.project.id,
        title: 'backend api',
        status: 'open',
        methodology_context: { primary_unit_refs: ['api'] },
      });
      s.items.addBlocker(a.id, b.id);

      const r = await s.engine.generate(s.project.id, null);
      expect(r.prompt).toContain('frontend work ⟵ blocked by backend api');
    } finally {
      await s.cleanup();
    }
  });

  it('freeform-bound project produces a minimum-spec prompt via the default mode', async () => {
    const s = await setup('freeform');
    try {
      const m = s.engine.modes(s.project.id);
      expect(m.modes.map((x) => x.id)).toEqual(['default']);
      expect(m.default_mode).toBe('default');

      s.items.create({ project_id: s.project.id, title: 'just a task', status: 'open' });
      const r = await s.engine.generate(s.project.id, null);
      expect(r.mode).toBe('default');
      expect(r.prompt).toContain('Session start — tb');
      expect(r.prompt).toContain('just a task');
      expect(r.classifications).toEqual([]); // no decisions/anchors in freeform
    } finally {
      await s.cleanup();
    }
  });
});

const EXEC_PLAN_SENTINEL = 'EXEC-PLAN-SENTINEL ship in vertical slices';
const SPEC_SENTINEL = 'PROJECT-SPEC-SENTINEL the north star';

// test-bundle with an `execution_plan` template injected into §9 Templates (the fixture
// otherwise declares none) — so the F4-01 execution-plan wiring has a bundle to read from.
async function setupExecPlan() {
  const cfg = makeTmpConfig();
  const src = readFileSync(TEST_BUNDLE_PATH, 'utf8').replace(
    '### Template: session_start:standard',
    `### Template: execution_plan\n\n${EXEC_PLAN_SENTINEL}\n\n### Template: session_start:standard`,
  );
  const target = join(cfg.methodologiesDir, 'test-bundle');
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, 'bundle.md'), src);
  plantBundle(cfg.methodologiesDir, 'freeform', FREEFORM_BUNDLE_PATH);
  const backend = await makeBackend(cfg);
  const repoPath = makeRepo(join(cfg.dataDir, 'repo'));
  const projects = createProjectsService(backend.db, backend.registry);
  const items = createItemsService(backend.db, projects, backend.registry, {});
  const library = createLibraryService(backend.db, projects);
  const directives = createDirectivesService(backend.db, projects, items, library);
  const engine = createSessionStartEngine({
    db: backend.db,
    projects,
    registry: backend.registry,
    items,
    library,
    directives,
    classifier: stubClassifier(),
  });
  const project = projects.create({ name: 'tb', repo_path: repoPath, bundle_id: 'test-bundle' });
  return { backend, library, engine, project, cleanup: () => backend.cleanup() };
}

describe('E20 / F4-01 — session-start assembles all declared inputs', () => {
  it('includes the canonical project_spec content and the execution-plan slice', async () => {
    const s = await setupExecPlan();
    try {
      s.library.create({
        project_id: s.project.id,
        type: 'project_spec',
        title: 'Project Spec',
        body: SPEC_SENTINEL,
      });
      const r = await s.engine.generate(s.project.id, 'standard');
      // Project spec (input #6) — read directly from the canonical entry.
      expect(r.prompt).toContain('## Project spec');
      expect(r.prompt).toContain(SPEC_SENTINEL);
      // Execution-plan slice (input #5) — the bundle's whole execution_plan template.
      expect(r.prompt).toContain('## Execution plan');
      expect(r.prompt).toContain(EXEC_PLAN_SENTINEL);
    } finally {
      await s.cleanup();
    }
  });

  it('omits both blocks when neither input is present (no project_spec, no execution_plan)', async () => {
    const s = await setup(); // plain test-bundle declares no execution_plan
    try {
      const r = await s.engine.generate(s.project.id, 'standard');
      expect(r.prompt).not.toContain('## Project spec');
      expect(r.prompt).not.toContain('## Execution plan');
    } finally {
      await s.cleanup();
    }
  });

  it('a project_spec edit changes the input fingerprint (no stale cached prompt)', async () => {
    const s = await setupExecPlan();
    try {
      const spec = s.library.create({
        project_id: s.project.id,
        type: 'project_spec',
        title: 'Project Spec',
        body: 'first version',
      });
      const before = await s.engine.generate(s.project.id, 'standard');
      expect(before.prompt).toContain('first version');
      s.library.update(spec.id, { body: 'SECOND-VERSION-SENTINEL' });
      const after = await s.engine.generate(s.project.id, 'standard');
      expect(after.prompt).toContain('SECOND-VERSION-SENTINEL');
      expect(after.prompt).not.toContain('first version');
    } finally {
      await s.cleanup();
    }
  });
});
