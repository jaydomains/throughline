import { describe, expect, it, vi } from 'vitest';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { createProjectsService } from '../src/projects/service.js';
import { createItemsService } from '../src/items/service.js';
import { createDriftService } from '../src/drift/service.js';
import { createGateRuntime } from '../src/methodology/gates/runtime.js';
import { createAnthropicJudgementGate } from '../src/methodology/gates/judgement.js';
import { createGithubStateCache } from '../src/github/state-cache.js';
import { createGitHubPoller } from '../src/github/poller.js';
import { createJobHealth } from '../src/health/job-health.js';
import { createPrLinkingService } from '../src/github/pr-linking.js';
import { createOrphanRulesService } from '../src/github/orphan-rules.js';
import { createAutoReconcileService } from '../src/github/auto-reconcile.js';
import { createTier4Service } from '../src/github/tier4.js';
import type { GhPull, GitHubApi } from '../src/github/api.js';
import type { LocalGit } from '../src/github/local-git.js';
import type { ReconcileService } from '../src/reconcile/service.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const TEST_BUNDLE = join(__dirname, '..', '..', '..', 'methodologies', 'test-bundle', 'bundle.md');
const FREEFORM = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plant(dir: string, id: string, src: string): void {
  mkdirSync(join(dir, id), { recursive: true });
  copyFileSync(src, join(dir, id, 'bundle.md'));
}

const judgement = createAnthropicJudgementGate({
  client: {
    available: () => false,
    call: async () => ({ text: '', input_tokens: 0, output_tokens: 0, stop_reason: null }),
  },
});

function pull(over: Partial<GhPull> = {}): GhPull {
  return {
    number: 1,
    title: 'Add upload validation',
    body: null,
    html_url: 'https://github.com/o/r/pull/1',
    state: 'open',
    merged_at: null,
    updated_at: '2026-05-16T00:00:00.000Z',
    created_at: '2026-05-15T00:00:00.000Z',
    head: { ref: 'feature/x', sha: 'headsha' },
    base: { ref: 'main', sha: 'basesha' },
    ...over,
  };
}

function fakeApi(opts: {
  pulls?: GhPull[];
  reviews?: { state: string; submitted_at: string | null }[];
  annotations?: { path: string; annotation_level: string; message: string; title: string | null }[];
  branchPull?: GhPull | null;
  available?: boolean;
  files?: string[];
} = {}): GitHubApi {
  return {
    available: () => opts.available ?? true,
    listPulls: vi.fn(async () => ({
      status: 'ok' as const,
      etag: 'etag-1',
      data: opts.pulls ?? [],
    })),
    getPull: vi.fn(async () => opts.pulls?.[0] ?? null),
    listReviews: vi.fn(async () => opts.reviews ?? []),
    listAnnotations: vi.fn(async () => opts.annotations ?? []),
    findPullForBranch: vi.fn(async () => opts.branchPull ?? null),
    getDefaultBranch: vi.fn(async () => 'main'),
    listPullFiles: vi.fn(async () => opts.files ?? []),
    fileExists: vi.fn(async () => true),
    draftRuleRemovalPr: vi.fn(async () => ({
      url: 'https://github.com/o/r/pull/99',
      number: 99,
    })),
  };
}

const localGitUnavailable: LocalGit = {
  changedFiles: async () => ({ status: 'unavailable', files: [], stat: null }),
};
function localGitWith(files: string[]): LocalGit {
  return { changedFiles: async () => ({ status: 'ok', files, stat: '1 file changed' }) };
}

async function setup(opts: { bundle?: 'test-bundle' | 'freeform'; githubConfigured?: boolean } = {}) {
  const cfg = makeTmpConfig();
  plant(cfg.methodologiesDir, 'test-bundle', TEST_BUNDLE);
  plant(cfg.methodologiesDir, 'freeform', FREEFORM);
  const backend = await makeBackend(cfg);
  const repoPath = join(cfg.dataDir, 'repo');
  mkdirSync(repoPath, { recursive: true });
  const projects = createProjectsService(backend.db, backend.registry);
  const drift = createDriftService(backend.db);
  const orphanRules = createOrphanRulesService({
    db: backend.db,
    projects,
    api: fakeApi(),
  });
  const items = createItemsService(backend.db, projects, backend.registry, {
    onDelete: (pid, iid) => orphanRules.captureForItem(pid, iid),
  });
  const gateRuntime = createGateRuntime({
    db: backend.db,
    projects,
    registry: backend.registry,
    judgement,
  });
  const project = projects.create({
    name: 'P',
    repo_path: repoPath,
    bundle_id: opts.bundle ?? 'test-bundle',
    ...(opts.githubConfigured === false
      ? {}
      : { github_owner: 'o', github_repo: 'r' }),
  });
  return { cfg, backend, projects, drift, items, gateRuntime, project, repoPath, orphanRules };
}

describe('Phase 10 — GitHub poller', () => {
  it('is a verified no-op without github_owner / PAT (SPEC §10)', async () => {
    const s = await setup({ githubConfigured: false });
    const cache = createGithubStateCache(s.backend.db);
    const tier4 = createTier4Service({
      db: s.backend.db,
      projects: s.projects,
      registry: s.backend.registry,
      drift: s.drift,
    });
    const poller = createGitHubPoller({
      db: s.backend.db,
      projects: s.projects,
      api: fakeApi(),
      localGit: localGitUnavailable,
      cache,
      drift: s.drift,
      gateRuntime: s.gateRuntime,
      autoReconcile: createAutoReconcileService({
        db: s.backend.db,
        projects: s.projects,
        items: s.items,
        reconcile: {} as ReconcileService,
      }),
      tier4,
      watch: false,
    });
    expect(await poller.pollProject(s.project.id)).toEqual([]);
    await s.backend.cleanup();
  });

  it('records loop health: a failed poll flips healthy:false + surfaces last_error (E5/C-D26)', async () => {
    const s = await setup();
    const cache = createGithubStateCache(s.backend.db);
    const tier4 = createTier4Service({
      db: s.backend.db,
      projects: s.projects,
      registry: s.backend.registry,
      drift: s.drift,
    });
    const health = createJobHealth('github-poller');
    const base = fakeApi();
    const api: GitHubApi = {
      ...base,
      listPulls: vi.fn(async () => {
        throw new Error('github 500');
      }),
    };
    const poller = createGitHubPoller({
      db: s.backend.db,
      projects: s.projects,
      api,
      localGit: localGitUnavailable,
      cache,
      drift: s.drift,
      gateRuntime: s.gateRuntime,
      autoReconcile: createAutoReconcileService({
        db: s.backend.db,
        projects: s.projects,
        items: s.items,
        reconcile: {} as ReconcileService,
      }),
      tier4,
      watch: false,
      health,
    });

    // Pre-E5 a failing poll was a silent warn-log with no observable state.
    expect(health.snapshot().healthy).toBe(true);
    await expect(poller.pollProject(s.project.id)).rejects.toThrow('github 500');
    expect(health.snapshot().healthy).toBe(false);
    expect(health.snapshot().last_error).toContain('github 500');

    // A subsequent clean poll recovers the health.
    (api.listPulls as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
      status: 'ok' as const,
      etag: 'e',
      data: [],
    }));
    await poller.pollProject(s.project.id);
    expect(health.snapshot().healthy).toBe(true);
    expect(health.snapshot().last_error).toBeNull();

    await s.backend.cleanup();
  });

  it('drain() waits for an in-flight poll to finish before resolving (S7-01)', async () => {
    const s = await setup();
    const cache = createGithubStateCache(s.backend.db);
    const tier4 = createTier4Service({
      db: s.backend.db,
      projects: s.projects,
      registry: s.backend.registry,
      drift: s.drift,
    });
    // Hold listPulls open so a poll stays in flight until we release it — modelling a
    // slow API call mid-shutdown. The poll does DB writes after this resolves, so closing
    // the DB before drain() returns would race a closed handle (the S7-01 defect).
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const base = fakeApi();
    const api: GitHubApi = {
      ...base,
      listPulls: vi.fn(async () => {
        await gate;
        return { status: 'ok' as const, etag: 'e', data: [] };
      }),
    };
    const poller = createGitHubPoller({
      db: s.backend.db,
      projects: s.projects,
      api,
      localGit: localGitUnavailable,
      cache,
      drift: s.drift,
      gateRuntime: s.gateRuntime,
      autoReconcile: createAutoReconcileService({
        db: s.backend.db,
        projects: s.projects,
        items: s.items,
        reconcile: {} as ReconcileService,
      }),
      tier4,
      watch: false,
    });

    let pollDone = false;
    const pollP = poller.pollProject(s.project.id).then(() => {
      pollDone = true;
    });
    await new Promise((r) => setTimeout(r, 5)); // let the poll enter the in-flight set

    let drainResolved = false;
    const drainP = poller.drain(2000).then(() => {
      drainResolved = true;
    });
    await new Promise((r) => setTimeout(r, 60));
    // The poll is still blocked on listPulls, so drain must not have resolved yet.
    expect(pollDone).toBe(false);
    expect(drainResolved).toBe(false);

    release();
    await pollP;
    await drainP;
    expect(pollDone).toBe(true);
    expect(drainResolved).toBe(true);

    await s.backend.cleanup();
  });

  it('drain() resolves immediately when no poll is in flight', async () => {
    const s = await setup();
    const cache = createGithubStateCache(s.backend.db);
    const tier4 = createTier4Service({
      db: s.backend.db,
      projects: s.projects,
      registry: s.backend.registry,
      drift: s.drift,
    });
    const poller = createGitHubPoller({
      db: s.backend.db,
      projects: s.projects,
      api: fakeApi(),
      localGit: localGitUnavailable,
      cache,
      drift: s.drift,
      gateRuntime: s.gateRuntime,
      autoReconcile: createAutoReconcileService({
        db: s.backend.db,
        projects: s.projects,
        items: s.items,
        reconcile: {} as ReconcileService,
      }),
      tier4,
      watch: false,
    });
    const t0 = Date.now();
    await poller.drain(2000);
    expect(Date.now() - t0).toBeLessThan(500);
    await s.backend.cleanup();
  });

  it('caches PR snapshots and dispatches the pr-open gate for a newly observed open PR', async () => {
    const s = await setup();
    const cache = createGithubStateCache(s.backend.db);
    const runMoment = vi.spyOn(s.gateRuntime, 'runMoment');
    const tier4 = createTier4Service({
      db: s.backend.db,
      projects: s.projects,
      registry: s.backend.registry,
      drift: s.drift,
    });
    const poller = createGitHubPoller({
      db: s.backend.db,
      projects: s.projects,
      api: fakeApi({ pulls: [pull()] }),
      localGit: localGitUnavailable,
      cache,
      drift: s.drift,
      gateRuntime: s.gateRuntime,
      autoReconcile: createAutoReconcileService({
        db: s.backend.db,
        projects: s.projects,
        items: s.items,
        reconcile: {} as ReconcileService,
      }),
      tier4,
      watch: false,
    });
    const badges = await poller.pollProject(s.project.id);
    expect(badges).toHaveLength(1);
    expect(badges[0]).toMatchObject({ pr_number: 1, state: 'open' });
    expect(runMoment).toHaveBeenCalledWith(s.project.id, 'pr-open');
    expect(cache.getSnapshot('o/r', 1)?.state).toBe('open');
    await s.backend.cleanup();
  });

  it('returns cached snapshots on a 304 (rate-limit-free poll)', async () => {
    const s = await setup();
    const cache = createGithubStateCache(s.backend.db);
    const api = fakeApi({ pulls: [pull()] });
    const tier4 = createTier4Service({
      db: s.backend.db,
      projects: s.projects,
      registry: s.backend.registry,
      drift: s.drift,
    });
    const mk = () =>
      createGitHubPoller({
        db: s.backend.db,
        projects: s.projects,
        api,
        localGit: localGitUnavailable,
        cache,
        drift: s.drift,
        gateRuntime: s.gateRuntime,
        autoReconcile: createAutoReconcileService({
          db: s.backend.db,
          projects: s.projects,
          items: s.items,
          reconcile: {} as ReconcileService,
        }),
        tier4,
        watch: false,
      });
    await mk().pollProject(s.project.id);
    (api.listPulls as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 'not-modified',
      etag: 'etag-1',
      data: null,
    });
    const badges = await mk().pollProject(s.project.id);
    expect(badges).toHaveLength(1);
    await s.backend.cleanup();
  });
});

describe('Phase 10 — code-drift tiers 1-3', () => {
  it('tier-1: failing Semgrep annotation badges the item; passing clears it', async () => {
    const s = await setup();
    const item = s.items.create({ project_id: s.project.id, title: 'verified work', status: 'done' });
    s.backend.db
      .prepare(
        'INSERT INTO item_verifier_rules (id, item_id, rule_path, rule_id) VALUES (?,?,?,?)',
      )
      .run('vr1', item.id, '.semgrep/throughline/itm.yml', 'no-eval');
    const cache = createGithubStateCache(s.backend.db);
    const tier4 = createTier4Service({
      db: s.backend.db,
      projects: s.projects,
      registry: s.backend.registry,
      drift: s.drift,
    });
    const base = {
      db: s.backend.db,
      projects: s.projects,
      localGit: localGitUnavailable,
      cache,
      drift: s.drift,
      gateRuntime: s.gateRuntime,
      autoReconcile: createAutoReconcileService({
        db: s.backend.db,
        projects: s.projects,
        items: s.items,
        reconcile: {} as ReconcileService,
      }),
      tier4,
      watch: false as const,
    };
    await createGitHubPoller({
      ...base,
      api: fakeApi({
        pulls: [pull()],
        annotations: [
          { path: 'src/x.ts', annotation_level: 'failure', message: 'no-eval', title: 'no-eval' },
        ],
      }),
    }).pollProject(s.project.id);
    expect(s.drift.listOpenCodeSignals(s.project.id, { category: 'tier-1' })).toHaveLength(1);
    expect(
      (
        s.backend.db
          .prepare('SELECT last_status FROM item_verifier_rules WHERE id = ?')
          .get('vr1') as { last_status: string }
      ).last_status,
    ).toBe('fail');

    await createGitHubPoller({
      ...base,
      api: fakeApi({ pulls: [pull()], annotations: [] }),
    }).pollProject(s.project.id);
    expect(s.drift.listOpenCodeSignals(s.project.id, { category: 'tier-1' })).toHaveLength(0);
    await s.backend.cleanup();
  });

  it('tier-2: a revert PR badges items associated with the reverted PR', async () => {
    const s = await setup();
    const item = s.items.create({ project_id: s.project.id, title: 'shipped', status: 'done' });
    s.backend.db
      .prepare(
        'INSERT INTO item_pr_associations (item_id, pr_number, repo, auto_detected_at) VALUES (?,?,?,?)',
      )
      .run(item.id, 7, 'o/r', null);
    const cache = createGithubStateCache(s.backend.db);
    const tier4 = createTier4Service({
      db: s.backend.db,
      projects: s.projects,
      registry: s.backend.registry,
      drift: s.drift,
    });
    await createGitHubPoller({
      db: s.backend.db,
      projects: s.projects,
      api: fakeApi({ pulls: [pull({ number: 12, title: 'Revert "shipped" (#7)' })] }),
      localGit: localGitUnavailable,
      cache,
      drift: s.drift,
      gateRuntime: s.gateRuntime,
      autoReconcile: createAutoReconcileService({
        db: s.backend.db,
        projects: s.projects,
        items: s.items,
        reconcile: {} as ReconcileService,
      }),
      tier4,
      watch: false,
    }).pollProject(s.project.id);
    const sig = s.drift.listOpenCodeSignals(s.project.id, { category: 'tier-2' });
    expect(sig).toHaveLength(1);
    expect(sig[0]!.item_id).toBe(item.id);
    await s.backend.cleanup();
  });

  it('tier-3: local-git changed files overlapping code refs badge the item; API fallback used when local git unavailable', async () => {
    const s = await setup();
    const item = s.items.create({ project_id: s.project.id, title: 'auth', status: 'done' });
    s.backend.db
      .prepare(
        'INSERT INTO item_code_refs (id, item_id, path, line_start, line_end) VALUES (?,?,?,?,?)',
      )
      .run('cr1', item.id, 'src/auth.ts', 1, 10);
    const cache = createGithubStateCache(s.backend.db);
    const tier4 = createTier4Service({
      db: s.backend.db,
      projects: s.projects,
      registry: s.backend.registry,
      drift: s.drift,
    });
    const base = {
      db: s.backend.db,
      projects: s.projects,
      cache,
      drift: s.drift,
      gateRuntime: s.gateRuntime,
      autoReconcile: createAutoReconcileService({
        db: s.backend.db,
        projects: s.projects,
        items: s.items,
        reconcile: {} as ReconcileService,
      }),
      tier4,
      watch: false as const,
    };
    // local git resolves the diff
    await createGitHubPoller({
      ...base,
      api: fakeApi({ pulls: [pull()] }),
      localGit: localGitWith(['src/auth.ts']),
    }).pollProject(s.project.id);
    expect(s.drift.listOpenCodeSignals(s.project.id, { category: 'tier-3' })).toHaveLength(1);

    // fresh project: local git unavailable → API files fallback
    const s2 = await setup();
    const item2 = s2.items.create({ project_id: s2.project.id, title: 'auth2', status: 'done' });
    s2.backend.db
      .prepare(
        'INSERT INTO item_code_refs (id, item_id, path, line_start, line_end) VALUES (?,?,?,?,?)',
      )
      .run('cr2', item2.id, 'src/auth.ts', 1, 10);
    const apiFallback = fakeApi({ pulls: [pull()], files: ['src/auth.ts'] });
    await createGitHubPoller({
      db: s2.backend.db,
      projects: s2.projects,
      api: apiFallback,
      localGit: localGitUnavailable,
      cache: createGithubStateCache(s2.backend.db),
      drift: s2.drift,
      gateRuntime: s2.gateRuntime,
      autoReconcile: createAutoReconcileService({
        db: s2.backend.db,
        projects: s2.projects,
        items: s2.items,
        reconcile: {} as ReconcileService,
      }),
      tier4: createTier4Service({
        db: s2.backend.db,
        projects: s2.projects,
        registry: s2.backend.registry,
        drift: s2.drift,
      }),
      watch: false,
    }).pollProject(s2.project.id);
    expect(apiFallback.listPullFiles).toHaveBeenCalled();
    expect(s2.drift.listOpenCodeSignals(s2.project.id, { category: 'tier-3' })).toHaveLength(1);
    await s.backend.cleanup();
    await s2.backend.cleanup();
  });
});

describe('Phase 10 — auto-reconcile on merge (T-D6/T-D18)', () => {
  function stubReconcile(extractor: 'anthropic' | 'heuristic', categories: string[]): ReconcileService {
    let applied = false;
    const run = {
      id: 'run1',
      project_id: '',
      session_id: null,
      source: 'pr-description' as const,
      status: 'pending' as const,
      raw_text: '',
      created_at: new Date().toISOString(),
      resolved_at: null,
      diff: {
        source: 'pr-description' as const,
        extractor,
        session_id: null,
        extractor_note: null,
        rows: categories.map((c, i) => ({
          category: c,
          row_id: `r${i}`,
          item_id: 'x',
          current_title: 't',
          evidence: 'e',
          ...(c === 'completed' ? { current_status: 'doing', next_status: 'done' } : {}),
        })) as never,
      },
    };
    return {
      propose: async () => run,
      get: () => run,
      listRecent: () => [run],
      apply: () => {
        applied = true;
        return {
          completed_item_ids: [],
          new_item_ids: [],
          edited_item_ids: [],
          blocker_item_ids: [],
          no_change_item_ids: [],
          drift_signal_ids: [],
          rejected_row_ids: [],
        };
      },
      discard: () => undefined,
      get _applied() {
        return applied;
      },
    } as unknown as ReconcileService;
  }

  it('high confidence auto-applies, logs confidence + provenance, and supports 24h undo', async () => {
    const s = await setup();
    const ar = createAutoReconcileService({
      db: s.backend.db,
      projects: s.projects,
      items: s.items,
      reconcile: stubReconcile('anthropic', ['completed', 'no_change']),
    });
    const outcome = await ar.onMerge(
      s.project.id,
      pull({ number: 5, merged_at: '2026-05-16T01:00:00Z' }),
      '2 files changed',
    );
    expect(outcome.confidence).toBe('high');
    expect(outcome.disposition).toBe('auto-applied');
    expect(outcome.undo_token).toBeTruthy();
    const audit = s.backend.db
      .prepare(
        "SELECT trigger_context_json FROM audit_log WHERE field='github_auto_reconcile' AND actor='ai_auto_apply'",
      )
      .get() as { trigger_context_json: string };
    const ctx = JSON.parse(audit.trigger_context_json);
    expect(ctx.confidence).toBe('high');
    expect(ctx.pr_number).toBe(5);
    expect(ctx.undo_token).toBe(outcome.undo_token);
    ar.undo(outcome.undo_token!);
    // Undo is now restart-safe (persisted to the audit row), so a repeat with the same
    // token still resolves from the audit snapshot; only an unknown token throws.
    expect(() => ar.undo('bogus-token')).toThrow();
    await s.backend.cleanup();
  });

  it('medium confidence leaves the run pending for one-click approve; low → modal', async () => {
    const s = await setup();
    const med = await createAutoReconcileService({
      db: s.backend.db,
      projects: s.projects,
      items: s.items,
      reconcile: stubReconcile('anthropic', ['completed', 'edited']),
    }).onMerge(s.project.id, pull(), '');
    expect(med.confidence).toBe('medium');
    expect(med.disposition).toBe('pending-approval');

    const low = await createAutoReconcileService({
      db: s.backend.db,
      projects: s.projects,
      items: s.items,
      reconcile: stubReconcile('heuristic', ['completed']),
    }).onMerge(s.project.id, pull(), '');
    expect(low.confidence).toBe('low');
    expect(low.disposition).toBe('modal');
    await s.backend.cleanup();
  });

  it('only fires for a PR previously tracked open then merged (not first-seen-merged)', async () => {
    const s = await setup();
    const cache = createGithubStateCache(s.backend.db);
    const onMerge = vi.fn(async () => ({}) as never);
    const tier4 = createTier4Service({
      db: s.backend.db,
      projects: s.projects,
      registry: s.backend.registry,
      drift: s.drift,
    });
    const mk = (pulls: GhPull[]) =>
      createGitHubPoller({
        db: s.backend.db,
        projects: s.projects,
        api: fakeApi({ pulls }),
        localGit: localGitUnavailable,
        cache,
        drift: s.drift,
        gateRuntime: s.gateRuntime,
        autoReconcile: { onMerge, undo: vi.fn(), approve: vi.fn() },
        tier4,
        watch: false,
      });
    // First seen already merged — must NOT trigger.
    await mk([pull({ merged_at: '2026-05-16T00:00:00Z', state: 'closed' })]).pollProject(
      s.project.id,
    );
    expect(onMerge).not.toHaveBeenCalled();
    // Track open, then merge — must trigger once.
    await mk([pull({ number: 2 })]).pollProject(s.project.id);
    await mk([pull({ number: 2, merged_at: '2026-05-16T02:00:00Z', state: 'closed' })]).pollProject(
      s.project.id,
    );
    expect(onMerge).toHaveBeenCalledTimes(1);
    await s.backend.cleanup();
  });
});

describe('Phase 10 — manual item-to-PR linking (T-D34)', () => {
  it('auto-detects from the item branch, sets, and unsets the association', async () => {
    const s = await setup();
    const item = s.items.create({
      project_id: s.project.id,
      title: 'x',
      branch_ref: 'feature/x',
    });
    const linking = createPrLinkingService({
      db: s.backend.db,
      projects: s.projects,
      api: fakeApi({ branchPull: pull({ number: 42 }) }),
    });
    const detected = await linking.detect(item.id);
    expect(detected.candidate?.pr_number).toBe(42);
    expect(detected.candidate?.auto_detected).toBe(true);
    const assoc = linking.set(item.id, 42, true);
    expect(assoc.pr_number).toBe(42);
    expect(linking.get(item.id)?.pr_number).toBe(42);
    linking.unset(item.id);
    expect(linking.get(item.id)).toBeNull();
    await s.backend.cleanup();
  });

  it('detect returns no candidate (skip path) when nothing resolves', async () => {
    const s = await setup();
    const item = s.items.create({ project_id: s.project.id, title: 'x' });
    const linking = createPrLinkingService({
      db: s.backend.db,
      projects: s.projects,
      api: fakeApi({ branchPull: null }),
    });
    const r = await linking.detect(item.id);
    expect(r.candidate).toBeNull();
    await s.backend.cleanup();
  });
});

describe('Phase 10 — orphaned verifier rules (T-D33)', () => {
  it('captures rules on item delete, lists, drafts a cleanup PR, and dismisses', async () => {
    const s = await setup();
    const api = fakeApi();
    const orphan = createOrphanRulesService({ db: s.backend.db, projects: s.projects, api });
    const items = createItemsService(s.backend.db, s.projects, s.backend.registry, {
      onDelete: (pid, iid) => orphan.captureForItem(pid, iid),
    });
    const item = items.create({ project_id: s.project.id, title: 'rule-bearer' });
    s.backend.db
      .prepare('INSERT INTO item_verifier_rules (id, item_id, rule_path, rule_id) VALUES (?,?,?,?)')
      .run('vr', item.id, '.semgrep/throughline/itm.yml', 'r');
    items.delete(item.id);
    const list = orphan.list(s.project.id);
    expect(list).toHaveLength(1);
    expect(list[0]!.rule_path).toBe('.semgrep/throughline/itm.yml');
    const draft = await orphan.draftCleanupPr(list[0]!.id);
    expect(draft.pr_number).toBe(99);
    expect(api.draftRuleRemovalPr).toHaveBeenCalled();
    orphan.dismiss(list[0]!.id);
    expect(orphan.list(s.project.id)).toHaveLength(0);
    await s.backend.cleanup();
  });
});

describe('Phase 10 — tier-4 dedup + drift inbox', () => {
  it('files a tier-4 inbox signal for a near-duplicate and auto-dismisses after 7 days', async () => {
    const s = await setup({ bundle: 'freeform' });
    s.items.create({
      project_id: s.project.id,
      title: 'Implement upload validation for avatars',
      description: 'reject files over 5mb and non-image types',
      status: 'done',
    });
    const tier4 = createTier4Service({
      db: s.backend.db,
      projects: s.projects,
      registry: s.backend.registry,
      drift: s.drift,
    });
    await tier4.scanCandidates(s.project.id, [
      {
        title: 'Implement upload validation for avatars',
        description: 'reject files over 5mb and non-image types',
      },
    ]);
    const inbox = s.drift.inbox(s.project.id);
    expect(inbox.code_count).toBe(1);
    expect(inbox.total_count).toBe(1);
    expect(inbox.signals[0]!.category).toBe('tier-4');

    // 7 days later → stale auto-dismiss with audit reason.
    const future = Date.now() + 8 * 24 * 60 * 60 * 1000;
    expect(tier4.dismissStale(s.project.id, future)).toBe(1);
    expect(s.drift.inbox(s.project.id).total_count).toBe(0);
    const a = s.backend.db
      .prepare("SELECT 1 FROM audit_log WHERE field='drift_signal_auto_dismiss'")
      .get();
    expect(a).toBeTruthy();
    await s.backend.cleanup();
  });

  it('drift inbox counts both streams and excludes strong code tiers', async () => {
    const s = await setup();
    const item = s.items.create({ project_id: s.project.id, title: 'i', status: 'done' });
    s.drift.createCodeSignal({
      projectId: s.project.id,
      itemId: item.id,
      category: 'tier-1',
      reason: 'strong',
    });
    s.drift.createCodeSignal({
      projectId: s.project.id,
      itemId: item.id,
      category: 'tier-4',
      reason: 'weak',
    });
    s.drift.createDisciplineSignal({
      projectId: s.project.id,
      category: 'banned',
      itemId: null,
      primaryUnitRef: null,
      reason: 'disc',
    });
    const inbox = s.drift.inbox(s.project.id);
    expect(inbox.total_count).toBe(2); // tier-4 + discipline; tier-1 badges, excluded
    expect(inbox.code_count).toBe(1);
    expect(inbox.discipline_count).toBe(1);
    await s.backend.cleanup();
  });
});

describe('Phase 10 — robustness fixes', () => {
  it('in-flight guard prevents a concurrent poll from double-dispatching pr-open', async () => {
    const s = await setup();
    const cache = createGithubStateCache(s.backend.db);
    const runMoment = vi.spyOn(s.gateRuntime, 'runMoment');
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const api = fakeApi({ pulls: [pull()] });
    (api.listPulls as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      await gate;
      return { status: 'ok', etag: 'e', data: [pull()] };
    });
    const tier4 = createTier4Service({
      db: s.backend.db,
      projects: s.projects,
      registry: s.backend.registry,
      drift: s.drift,
    });
    const poller = createGitHubPoller({
      db: s.backend.db,
      projects: s.projects,
      api,
      localGit: localGitUnavailable,
      cache,
      drift: s.drift,
      gateRuntime: s.gateRuntime,
      autoReconcile: createAutoReconcileService({
        db: s.backend.db,
        projects: s.projects,
        items: s.items,
        reconcile: {} as ReconcileService,
      }),
      tier4,
      watch: false,
    });
    const p1 = poller.pollProject(s.project.id);
    const second = await poller.pollProject(s.project.id); // guarded → warm cache
    expect(second).toEqual([]);
    release();
    await p1;
    expect(runMoment).toHaveBeenCalledTimes(1);
    expect(api.listPulls).toHaveBeenCalledTimes(1);
    await s.backend.cleanup();
  });

  it('auto-reconcile undo survives a "restart" via the persisted audit snapshot', async () => {
    const s = await setup();
    const item = s.items.create({ project_id: s.project.id, title: 'x', status: 'doing' });
    const reconcile = {
      propose: async () => ({
        id: 'run1',
        project_id: s.project.id,
        session_id: null,
        source: 'pr-description' as const,
        status: 'pending' as const,
        raw_text: '',
        created_at: new Date().toISOString(),
        resolved_at: null,
        diff: {
          source: 'pr-description' as const,
          extractor: 'anthropic' as const,
          session_id: null,
          extractor_note: null,
          rows: [
            {
              category: 'completed',
              row_id: 'r0',
              item_id: item.id,
              current_status: 'doing',
              next_status: 'done',
              current_title: 'x',
              evidence: 'e',
            },
          ] as never,
        },
      }),
      get: () => null,
      listRecent: () => [],
      apply: () => {
        s.items.update(item.id, { status: 'done' });
        return {
          completed_item_ids: [item.id],
          new_item_ids: [],
          edited_item_ids: [],
          blocker_item_ids: [],
          no_change_item_ids: [],
          drift_signal_ids: [],
          rejected_row_ids: [],
        };
      },
      discard: () => undefined,
    } as unknown as ReconcileService;
    const ar1 = createAutoReconcileService({
      db: s.backend.db,
      projects: s.projects,
      items: s.items,
      reconcile,
    });
    const outcome = await ar1.onMerge(s.project.id, pull(), '');
    expect(outcome.disposition).toBe('auto-applied');
    expect(s.items.get(item.id)!.status).toBe('done');
    // Fresh service instance = simulated restart (empty in-memory undo store).
    const ar2 = createAutoReconcileService({
      db: s.backend.db,
      projects: s.projects,
      items: s.items,
      reconcile,
    });
    ar2.undo(outcome.undo_token!);
    expect(s.items.get(item.id)!.status).toBe('doing');
    expect(() => ar2.undo('bogus')).toThrow();
    // Consumed-marker: a repeat undo via the audit fallback (another "restart") must NOT
    // replay the revert over post-undo user edits.
    s.items.update(item.id, { status: 'done' });
    const ar3 = createAutoReconcileService({
      db: s.backend.db,
      projects: s.projects,
      items: s.items,
      reconcile,
    });
    expect(() => ar3.undo(outcome.undo_token!)).toThrow();
    expect(s.items.get(item.id)!.status).toBe('done');
    await s.backend.cleanup();
  });

  it('tier-2 detects a revert mentioned only in the PR body', async () => {
    const s = await setup();
    const item = s.items.create({ project_id: s.project.id, title: 'shipped', status: 'done' });
    s.backend.db
      .prepare(
        'INSERT INTO item_pr_associations (item_id, pr_number, repo, auto_detected_at) VALUES (?,?,?,?)',
      )
      .run(item.id, 7, 'o/r', null);
    const cache = createGithubStateCache(s.backend.db);
    await createGitHubPoller({
      db: s.backend.db,
      projects: s.projects,
      api: fakeApi({
        pulls: [pull({ number: 30, title: 'Roll back change', body: 'This reverts #7 due to a regression.' })],
      }),
      localGit: localGitUnavailable,
      cache,
      drift: s.drift,
      gateRuntime: s.gateRuntime,
      autoReconcile: createAutoReconcileService({
        db: s.backend.db,
        projects: s.projects,
        items: s.items,
        reconcile: {} as ReconcileService,
      }),
      tier4: createTier4Service({
        db: s.backend.db,
        projects: s.projects,
        registry: s.backend.registry,
        drift: s.drift,
      }),
      watch: false,
    }).pollProject(s.project.id);
    expect(s.drift.listOpenCodeSignals(s.project.id, { category: 'tier-2' })).toHaveLength(1);
    await s.backend.cleanup();
  });

  it('orphan cleanup PR targets the repo default branch, not hardcoded main', async () => {
    const s = await setup();
    const api = fakeApi();
    (api.getDefaultBranch as ReturnType<typeof vi.fn>).mockResolvedValue('develop');
    const orphan = createOrphanRulesService({ db: s.backend.db, projects: s.projects, api });
    const items = createItemsService(s.backend.db, s.projects, s.backend.registry, {
      onDelete: (pid, iid) => orphan.captureForItem(pid, iid),
    });
    const item = items.create({ project_id: s.project.id, title: 'r' });
    s.backend.db
      .prepare('INSERT INTO item_verifier_rules (id, item_id, rule_path, rule_id) VALUES (?,?,?,?)')
      .run('vr', item.id, '.semgrep/throughline/itm.yml', 'r');
    items.delete(item.id);
    await orphan.draftCleanupPr(orphan.list(s.project.id)[0]!.id);
    expect(api.getDefaultBranch).toHaveBeenCalledWith('o', 'r');
    expect(api.draftRuleRemovalPr).toHaveBeenCalledWith(
      expect.objectContaining({ baseBranch: 'develop' }),
    );
    await s.backend.cleanup();
  });
});

describe('Phase 10 — local git diff seam', () => {
  it('reads changed file names from a real local clone (offline)', async () => {
    const s = await setup();
    const { createLocalGit } = await import('../src/github/local-git.js');
    const repo = s.repoPath;
    const run = (args: string[]) =>
      execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args], {
        cwd: repo,
        stdio: 'pipe',
      }).toString();
    run(['init', '-q']);
    run(['config', 'user.email', 't@t']);
    run(['config', 'user.name', 't']);
    run(['config', 'commit.gpgsign', 'false']);
    writeFileSync(join(repo, 'a.txt'), 'one\n');
    run(['add', '.']);
    run(['commit', '-qm', 'base']);
    const base = run(['rev-parse', 'HEAD']).trim();
    writeFileSync(join(repo, 'b.txt'), 'two\n');
    run(['add', '.']);
    run(['commit', '-qm', 'head']);
    const head = run(['rev-parse', 'HEAD']).trim();
    const lg = createLocalGit();
    const res = await lg.changedFiles(repo, base, head, 1);
    expect(res.status).toBe('ok');
    expect(res.files).toContain('b.txt');
    await s.backend.cleanup();
  });
});
