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
