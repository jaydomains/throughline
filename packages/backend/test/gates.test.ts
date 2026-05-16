import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { createProjectsService } from '../src/projects/service.js';
import { createItemsService } from '../src/items/service.js';
import { createGateRuntime } from '../src/methodology/gates/runtime.js';
import { createAnthropicJudgementGate } from '../src/methodology/gates/judgement.js';
import { createGateHookQueue } from '../src/methodology/gates/hook-queue.js';
import { installGateHooks } from '../src/methodology/gates/hook-installer.js';
import { readRuntimeUrl, writeRuntimeFile } from '../src/methodology/gates/runtime-file.js';
import type { AnthropicClient } from '../src/ai/anthropic.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const TEST_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'test-bundle', 'bundle.md');

function plantTestBundle(methodologiesDir: string): void {
  const target = join(methodologiesDir, 'test-bundle');
  mkdirSync(target, { recursive: true });
  copyFileSync(TEST_BUNDLE_PATH, join(target, 'bundle.md'));
}

// A repo whose doc set satisfies the test-bundle's structural gate.
function makeRepo(dir: string, opts: { banned?: boolean } = {}): string {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SPEC.md'), opts.banned ? '# Spec\nTODO: finish this\n' : '# Spec\nclean\n');
  writeFileSync(join(dir, 'NOTES.md'), '# Notes\n');
  mkdirSync(join(dir, 'docs', '_meta'), { recursive: true });
  mkdirSync(join(dir, 'docs', 'handovers'), { recursive: true });
  return dir;
}

const judgement = createAnthropicJudgementGate({
  client: { available: () => false, call: async () => ({ text: '', input_tokens: 0, output_tokens: 0, stop_reason: null }) },
});

async function setup(repoOpts: { banned?: boolean } = {}) {
  const cfg = makeTmpConfig();
  plantTestBundle(cfg.methodologiesDir);
  const backend = await makeBackend(cfg);
  const repoPath = makeRepo(join(cfg.dataDir, 'repo'), repoOpts);
  const projects = createProjectsService(backend.db, backend.registry);
  const runtime = createGateRuntime({
    db: backend.db,
    projects,
    registry: backend.registry,
    judgement,
  });
  const items = createItemsService(backend.db, projects, backend.registry, {
    onStatusTransition: (projectId) => runtime.onItemStatusTransition(projectId),
  });
  const project = projects.create({
    name: 'tb',
    repo_path: repoPath,
    bundle_id: 'test-bundle',
  });
  return { backend, cfg, projects, items, runtime, project, repoPath };
}

describe('Phase 8 — gate runtime (C-D6)', () => {
  it('per-commit dispatches the two independent gates with per-gate firings (T-D42)', async () => {
    const { backend, runtime, project, cleanup } = await withCleanup(setup());
    try {
      const { firings } = await runtime.dispatch('per-commit', { projectId: project.id });
      expect(firings.map((f) => f.gate_id).sort()).toEqual([
        'banned-string-sweep',
        'structure-check',
      ]);
      // Each firing wrote a gate_firings row + an audit-log entry (T-D36).
      const rows = backend.db
        .prepare(`SELECT * FROM gate_firings WHERE project_id = ?`)
        .all(project.id) as Array<{ gate_id: string; status: string }>;
      expect(rows).toHaveLength(2);
      const audits = backend.db
        .prepare(
          `SELECT * FROM audit_log WHERE entity_type = 'gate_firing' AND actor = 'methodology_runtime'`,
        )
        .all() as unknown[];
      expect(audits.length).toBeGreaterThanOrEqual(2);
      // Clean repo → both mechanical checks pass.
      expect(firings.every((f) => f.status === 'pass')).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it('banned-string sweep fails (proposal) without throwing — never blocks (T-D44)', async () => {
    const { runtime, project, cleanup } = await withCleanup(setup({ banned: true }));
    try {
      const { firings } = await runtime.dispatch('per-commit', { projectId: project.id });
      const swept = firings.find((f) => f.gate_id === 'banned-string-sweep')!;
      expect(swept.status).toBe('fail');
      expect(swept.findings.items.length).toBeGreaterThan(0);
    } finally {
      await cleanup();
    }
  });

  it('an item status transition fires the per-commit moment internally (SPEC §7.12)', async () => {
    const { backend, items, project, cleanup } = await withCleanup(setup());
    try {
      const item = items.create({ project_id: project.id, type: 'task', title: 't' });
      const before = backend.db
        .prepare(`SELECT COUNT(*) n FROM gate_firings WHERE project_id = ?`)
        .get(project.id) as { n: number };
      items.update(item.id, { status: 'doing' });
      await new Promise((r) => setTimeout(r, 50)); // best-effort async dispatch
      const after = backend.db
        .prepare(`SELECT COUNT(*) n FROM gate_firings WHERE project_id = ?`)
        .get(project.id) as { n: number };
      expect(after.n).toBeGreaterThan(before.n);
    } finally {
      await cleanup();
    }
  });

  it('listFirings groups latest firing per gate; override is audit-logged (T-D44)', async () => {
    const { backend, runtime, project, cleanup } = await withCleanup(setup({ banned: true }));
    try {
      await runtime.dispatch('per-commit', { projectId: project.id });
      const listed = runtime.listFirings(project.id);
      const perCommit = listed.groups.find((g) => g.moment === 'per-commit')!;
      const fail = perCommit.firings.find((f) => f.gate_id === 'banned-string-sweep')!;
      const overridden = runtime.override(project.id, fail.id, 'accepted for this slice');
      expect(overridden?.findings.override?.reason).toBe('accepted for this slice');
      const row = backend.db
        .prepare(
          `SELECT * FROM audit_log WHERE entity_type = 'gate_firing' AND field = 'override'`,
        )
        .get() as { actor: string; trigger_context_json: string };
      expect(row.actor).toBe('user');
      expect(JSON.parse(row.trigger_context_json).override_reason).toBe('accepted for this slice');
    } finally {
      await cleanup();
    }
  });

  it('freeform-bound project declares no gates → dispatch is a no-op', async () => {
    const cfg = makeTmpConfig();
    plantTestBundle(cfg.methodologiesDir);
    // Plant freeform too.
    const ff = join(cfg.methodologiesDir, 'freeform');
    mkdirSync(ff, { recursive: true });
    copyFileSync(
      join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md'),
      join(ff, 'bundle.md'),
    );
    const backend = await makeBackend(cfg);
    try {
      const projects = createProjectsService(backend.db, backend.registry);
      const runtime = createGateRuntime({ db: backend.db, projects, registry: backend.registry, judgement });
      const project = projects.create({ name: 'ff', repo_path: '/tmp/ff', bundle_id: 'freeform' });
      const { firings } = await runtime.dispatch('per-commit', { projectId: project.id });
      expect(firings).toHaveLength(0);
    } finally {
      await backend.cleanup();
      cfg.cleanup();
    }
  });
});

describe('Phase 8 — judgement gate', () => {
  it('skips (never blocks) when Anthropic is unconfigured', async () => {
    const res = await judgement.evaluate({
      gateId: 'g',
      description: 'd',
      projectName: 'p',
      stateDigest: 's',
    });
    expect(res.status).toBe('skipped');
  });

  it('parses a structured pass/fail response and surfaces telemetry', async () => {
    const client: AnthropicClient = {
      available: () => true,
      call: async () => ({
        text: JSON.stringify({ status: 'fail', summary: 'scope drift', items: [{ message: 'x' }] }),
        input_tokens: 10,
        output_tokens: 5,
        stop_reason: 'end_turn',
      }),
    };
    const g = createAnthropicJudgementGate({ client });
    const res = await g.evaluate({ gateId: 'scope', description: 'd', projectName: 'p', stateDigest: 's' });
    expect(res.status).toBe('fail');
    expect(res.findings.items[0]!.message).toBe('x');
    expect(res.telemetry.model).toBe('claude-sonnet-4-6');
    expect(res.telemetry.prompt).toContain('scope');
  });
});

describe('Phase 8 — hook transport', () => {
  it('runtime URL file round-trips (port stability, CODE_SPEC §7)', () => {
    const cfg = makeTmpConfig();
    try {
      writeRuntimeFile(cfg.runtimeFilePath, 'http://127.0.0.1:54321');
      expect(readRuntimeUrl(cfg.runtimeFilePath)).toBe('http://127.0.0.1:54321');
    } finally {
      cfg.cleanup();
    }
  });

  it('hook-event queue drains valid events and quarantines bad ones', async () => {
    const { cfg, runtime, repoPath, cleanup } = await withCleanup(setup());
    try {
      mkdirSync(cfg.gateHookQueueDir, { recursive: true });
      mkdirSync(cfg.gateHookFailuresDir, { recursive: true });
      writeFileSync(
        join(cfg.gateHookQueueDir, '20260516T000000Z-aaa.json'),
        JSON.stringify({ moment: 'per-commit', repo_path: repoPath, fired_at: 'x' }),
      );
      writeFileSync(join(cfg.gateHookQueueDir, '20260516T000001Z-bbb.json'), '{ not json');
      const q = createGateHookQueue({
        queueDir: cfg.gateHookQueueDir,
        failuresDir: cfg.gateHookFailuresDir,
        runtime,
      });
      await q.drain();
      // Valid event consumed; bad one quarantined with an .error.json companion.
      const remaining = readdirSync(cfg.gateHookQueueDir).filter((f) => f.endsWith('.json'));
      expect(remaining).toHaveLength(0);
      const failures = readdirSync(cfg.gateHookFailuresDir);
      expect(failures.some((f) => f.endsWith('.error.json'))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it('installs idempotent advisory git hooks resolved via git rev-parse', async () => {
    const { cfg, repoPath, cleanup } = await withCleanup(setup());
    try {
      execFileSync('git', ['-C', repoPath, 'init', '-q'], { timeout: 10_000 });
      const r1 = installGateHooks({
        repoPath,
        runtimeFilePath: cfg.runtimeFilePath,
        queueDir: cfg.gateHookQueueDir,
      });
      expect(r1.installed).toBe(true);
      const hookPath = join(r1.hooksDir!, 'pre-commit');
      const body = readFileSync(hookPath, 'utf8');
      expect(body).toContain('throughline-methodology-gate');
      expect(body).toContain('exit 0'); // never blocks (T-D44)
      // Idempotent re-install.
      const r2 = installGateHooks({
        repoPath,
        runtimeFilePath: cfg.runtimeFilePath,
        queueDir: cfg.gateHookQueueDir,
      });
      expect(r2.installed).toBe(true);
    } finally {
      await cleanup();
    }
  });
});

// Small helper so each test cleans its temp backend even on assertion failure.
async function withCleanup<T extends { backend: { cleanup: () => Promise<void> }; cfg: { cleanup: () => void } }>(
  p: Promise<T>,
): Promise<T & { cleanup: () => Promise<void> }> {
  const v = await p;
  return {
    ...v,
    cleanup: async () => {
      await v.backend.cleanup();
    },
  };
}
