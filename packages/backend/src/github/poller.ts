import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { PrBadge, PrSnapshot, PrState } from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';
import type { DriftService } from '../drift/service.js';
import type { JobHealth } from '../health/job-health.js';
import type { GateRuntime } from '../methodology/gates/runtime.js';
import type { ProjectsService } from '../projects/service.js';
import type { GhPull, GitHubApi } from './api.js';
import type { LocalGit } from './local-git.js';
import type { GithubStateCache } from './state-cache.js';
import type { AutoReconcileService } from './auto-reconcile.js';
import type { Tier4Service } from './tier4.js';
import { runTier1, runTier2, runTier3 } from './tiers.js';

// Phase 10 (T-D7; C-D16; SPEC §7.13) — polling-only GitHub awareness. Per the rate-limit
// analysis (C-D16): ETag-conditional list polls returning 304 do NOT count against the
// authenticated primary limit, so the steady-state cost is ~0; the only expensive payload
// (changed-file list) goes local-git-first via LocalGit.
//
// Cadence (SPEC §7.13): 60s when a project is "active", 5min otherwise. "Active" has no
// first-class signal in the schema (sessions carry no pin/last-dump timestamp) so it is
// APPROXIMATED as "a session or reconcile run touched within 2h" — an implementation
// -shape choice recorded CODE_SPEC-only (C-D16) and surfaced as an Open Question.

const ACTIVE_CADENCE_MS = 60_000;
const IDLE_CADENCE_MS = 5 * 60_000;
const ACTIVE_WINDOW_MS = 2 * 60 * 60 * 1000;
const SEMGREP_WORKFLOW_REL = join('.github', 'workflows', 'throughline-semgrep.yml');

function deriveState(pull: GhPull, reviews: { state: string }[]): PrState {
  if (pull.merged_at) return 'merged';
  if (pull.state === 'closed') return 'closed';
  if (reviews.some((r) => r.state === 'APPROVED')) return 'approved';
  return 'open';
}

export interface GitHubPoller {
  start(): void;
  stop(): void;
  // Wait for any in-flight poll to finish so its DB writes complete before the caller
  // closes the database (S7-01 shutdown ordering). Bounded so a wedged poll cannot hang
  // shutdown. No-op when nothing is in flight.
  drain(timeoutMs?: number): Promise<void>;
  // Poll one project now (used by the loop, manual refresh, and tests). Returns the PR
  // badges so the route can answer synchronously after an explicit refresh.
  pollProject(projectId: string): Promise<PrBadge[]>;
}

export interface CreateGitHubPollerOptions {
  db: DB;
  projects: ProjectsService;
  api: GitHubApi;
  localGit: LocalGit;
  cache: GithubStateCache;
  drift: DriftService;
  gateRuntime: GateRuntime;
  autoReconcile: AutoReconcileService;
  tier4: Tier4Service;
  watch?: boolean;
  now?: () => number;
  logger?: { info: (m: string) => void; warn: (m: string) => void; error: (m: string) => void };
  // Optional per-loop health tracker (C-D26): each poll records success/failure so a
  // poller that starts failing every tick is observable, not a silent warn-log.
  health?: JobHealth;
}

export function createGitHubPoller(opts: CreateGitHubPollerOptions): GitHubPoller {
  const { db, projects, api, localGit, cache, drift, gateRuntime, autoReconcile, tier4 } = opts;
  const watch = opts.watch ?? true;
  const now = opts.now ?? Date.now;
  const logger = opts.logger;
  let timer: NodeJS.Timeout | null = null;
  const lastPolledAt = new Map<string, number>();
  // In-flight guard: a poll can outlast the tick interval (slow GitHub response, many
  // PRs with annotations). Without this a second concurrent poll for the same project
  // would double-dispatch the pr-open gate and re-run auto-reconcile on merge.
  const inFlight = new Set<string>();

  function isActive(projectId: string): boolean {
    const cutoff = new Date(now() - ACTIVE_WINDOW_MS).toISOString();
    const s = db
      .prepare(
        `SELECT 1 FROM sessions WHERE project_id = ? AND updated_at >= ? LIMIT 1`,
      )
      .get(projectId, cutoff);
    if (s) return true;
    const r = db
      .prepare(
        `SELECT 1 FROM reconcile_runs WHERE project_id = ? AND created_at >= ? LIMIT 1`,
      )
      .get(projectId, cutoff);
    return r !== undefined;
  }

  function warnWorkflowIfMissing(projectId: string): void {
    const project = projects.get(projectId);
    if (!project) return;
    if (project.settings_json?.github_workflow_checked === true) return;
    const present =
      project.repo_path != null && existsSync(join(project.repo_path, SEMGREP_WORKFLOW_REL));
    projects.update(projectId, {
      settings: { ...project.settings_json, github_workflow_checked: true },
    });
    if (!present) {
      appendAudit(db, {
        projectId,
        entityType: 'project',
        entityId: projectId,
        actor: 'system',
        field: 'github_workflow_template_warning',
        newValue: SEMGREP_WORKFLOW_REL,
        triggerContext: { expected_path: SEMGREP_WORKFLOW_REL, present: false },
      });
      logger?.warn(
        `project ${projectId}: recommended Semgrep workflow ${SEMGREP_WORKFLOW_REL} not present (SPEC §7.16)`,
      );
    }
  }

  async function pollProject(projectId: string): Promise<PrBadge[]> {
    const project = projects.get(projectId);
    if (!project || !project.github_owner || !project.github_repo || !api.available()) {
      return [];
    }
    const owner = project.github_owner;
    const repoName = project.github_repo;
    const repo = `${owner}/${repoName}`;
    // A poll already running for this project (tick raced a manual /github/refresh, or
    // the previous poll outlasted the tick) — return the warm cache rather than starting
    // a concurrent poll that would double-dispatch pr-open / auto-reconcile.
    if (inFlight.has(projectId)) return cache.listSnapshots(repo).map(toBadge);
    inFlight.add(projectId);
    try {
      const badges = await doPollProject(projectId, project, owner, repoName, repo);
      // C-D26: a completed poll records loop health; a throw records the failure and
      // rethrows so callers (the tick loop, the manual-refresh route) behave as before.
      opts.health?.recordSuccess(new Date(now()));
      return badges;
    } catch (err) {
      opts.health?.recordFailure(new Date(now()), err);
      throw err;
    } finally {
      inFlight.delete(projectId);
    }
  }

  async function doPollProject(
    projectId: string,
    project: NonNullable<ReturnType<typeof projects.get>>,
    owner: string,
    repoName: string,
    repo: string,
  ): Promise<PrBadge[]> {
    warnWorkflowIfMissing(projectId);

    const prevEtag = cache.getListEtag(repo);
    const res = await api.listPulls(owner, repoName, prevEtag);
    if (res.status === 'not-modified') {
      // 304 — nothing changed; reuse cached snapshots (rate-limit-free, C-D16).
      return cache.listSnapshots(repo).map(toBadge);
    }
    if (res.status === 'unavailable' || res.data === null) {
      return cache.listSnapshots(repo).map(toBadge);
    }

    // S4-02: persist the new list ETag only AFTER the snapshot upserts below commit. The
    // ETag was previously set here, before the loop — so a mid-loop throw left the ETag
    // advanced while the snapshots were never written, and every later poll got a 304
    // (If-None-Match match) and reused permanently-stale snapshots. Setting it after the
    // loop means a mid-loop throw retains the old ETag, so the next poll re-fetches.
    const newListEtag = res.etag;
    const pulls = res.data;
    const badges: PrBadge[] = [];
    for (const pull of pulls) {
      const prior = cache.getSnapshot(repo, pull.number);
      const reviews = await api.listReviews(owner, repoName, pull.number).catch(() => []);
      const state = deriveState(pull, reviews);
      const nowIso = new Date(now()).toISOString();
      const snap: PrSnapshot = {
        repo,
        pr_number: pull.number,
        title: pull.title,
        state,
        url: pull.html_url,
        head_ref: pull.head.ref,
        base_ref: pull.base.ref,
        head_sha: pull.head.sha,
        base_sha: pull.base.sha,
        merged_at: pull.merged_at,
        activity_at: pull.updated_at,
        last_polled_at: nowIso,
      };

      // PR-open methodology gate (SPEC §7.13): a newly observed open PR dispatches the
      // bundle's pr-open gates via the Phase-8 dispatcher (CODE_SPEC §7).
      if (!prior && state === 'open') {
        await gateRuntime
          .runMoment(projectId, 'pr-open')
          .catch((e) => logger?.warn(`pr-open dispatch failed: ${e}`));
      }

      // Tier 1 (Semgrep annotations) + Tier 2 (revert) — GitHub-only metadata facts.
      const annotations = await api
        .listAnnotations(owner, repoName, pull.head.sha)
        .catch(() => []);
      runTier1(db, drift, projectId, pull, annotations);
      runTier2(db, drift, projectId, pull, repo);

      // Tier 3 — changed-file overlap, local-git-first with API fallback (C-D16).
      let changed: string[] = [];
      const local = await localGit.changedFiles(
        project.repo_path,
        pull.base.sha,
        pull.head.sha,
        pull.number,
      );
      if (local.status === 'ok') {
        changed = local.files;
      } else {
        // API fallback: a `files` listing is the one expensive payload; only paid when
        // local git could not resolve the refs (C-D16).
        changed = await api
          .listPullFiles(owner, repoName, pull.number)
          .catch(() => []);
      }
      runTier3(db, drift, projectId, pull, changed);

      // Auto-reconcile on merge (T-D6/T-D18): only for a PR we previously tracked open
      // (a tracked branch that merges) — never a PR first seen already-merged.
      if (prior && prior.state !== 'merged' && state === 'merged') {
        const stat = local.status === 'ok' ? local.stat ?? '' : '';
        await autoReconcile
          .onMerge(projectId, pull, stat)
          .catch((e) => logger?.warn(`auto-reconcile failed for PR #${pull.number}: ${e}`));
      }

      cache.upsertSnapshot(snap);
      badges.push(toBadge(snap));
    }

    // All snapshots committed — now it is safe to advance the list ETag (S4-02).
    cache.setListEtag(repo, newListEtag);
    tier4.dismissStale(projectId, now());
    lastPolledAt.set(projectId, now());
    return badges;
  }

  function tick(): void {
    const t = now();
    for (const project of projects.list()) {
      if (!project.github_owner || !project.github_repo) continue;
      const cadence = isActive(project.id) ? ACTIVE_CADENCE_MS : IDLE_CADENCE_MS;
      const last = lastPolledAt.get(project.id) ?? 0;
      if (t - last < cadence) continue;
      // pollProject records loop health (C-D26) for the attempt; the tick only needs to
      // keep the loop alive past a rejected poll.
      void pollProject(project.id).catch((e) =>
        logger?.warn(`poll failed for ${project.id}: ${e instanceof Error ? e.message : e}`),
      );
    }
  }

  return {
    start() {
      if (!watch || timer) return;
      // Tick at the active cadence; per-project gating enforces the 60s/5min split.
      timer = setInterval(tick, ACTIVE_CADENCE_MS);
      if (typeof timer.unref === 'function') timer.unref();
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    async drain(timeoutMs = 5000) {
      // `inFlight` holds the project ids whose poll is mid-flight. A poll is a chain of
      // awaited API + DB writes (reconcile, gate runs, cache writes); closing the DB while
      // one is running throws on a closed handle. Wait for the set to empty, bounded so a
      // network-wedged poll can't block process exit.
      const deadline = Date.now() + timeoutMs;
      while (inFlight.size > 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    },
    pollProject,
  };
}

function toBadge(snap: PrSnapshot): PrBadge {
  return {
    pr_number: snap.pr_number,
    repo: snap.repo,
    state: snap.state,
    url: snap.url,
    title: snap.title,
    activity_at: snap.activity_at,
  };
}
