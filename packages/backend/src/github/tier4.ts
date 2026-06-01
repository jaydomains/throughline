import type { DB } from '../db/index.js';
import type { DriftService } from '../drift/service.js';
import { appendAudit } from '../audit/log.js';
import { bundleDoneStatus, bundleDoneStatusForType, bundleItemPolicy } from '../items/policy.js';
import type { MethodologyRegistry } from '../methodology/loader.js';
import type { ProjectsService } from '../projects/service.js';

// Phase 10 (T-D21 tier-4; SPEC §7.14; §13 adopted: cosine ≥ 0.80, AI confirmation pass
// for borderline 0.70–0.80). A duplicate-looking new dump-zone entry matching an already
// -done item is a WEAK signal: it routes to the drift inbox (never an item badge) and
// auto-dismisses after 7 days with an audit-logged "stale-no-action" reason.
//
// v1 similarity uses a deterministic token-cosine. text_embeddings is empty until Phase
// 14 (local embeddings, C-D2); when those land this similarity fn is the single swap
// point. The borderline-band confirmation is an Anthropic call; with no key it degrades
// to "not a duplicate" (conservative — never auto-file a weak signal we cannot confirm).

const STRONG_THRESHOLD = 0.8;
const BORDERLINE_THRESHOLD = 0.7;
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have',
  'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'was', 'with',
]);

function termVector(s: string): Map<string, number> {
  const v = new Map<string, number>();
  for (const t of s.toLowerCase().split(/[^a-z0-9]+/i)) {
    if (t.length < 2 || STOPWORDS.has(t)) continue;
    v.set(t, (v.get(t) ?? 0) + 1);
  }
  return v;
}

export function cosineSimilarity(a: string, b: string): number {
  const va = termVector(a);
  const vb = termVector(b);
  if (va.size === 0 || vb.size === 0) return 0;
  let dot = 0;
  for (const [t, n] of va) dot += n * (vb.get(t) ?? 0);
  let na = 0;
  for (const n of va.values()) na += n * n;
  let nb = 0;
  for (const n of vb.values()) nb += n * n;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface Tier4Candidate {
  title: string;
  description: string;
}

// Optional borderline (0.70–0.80) AI confirmation. Returns true if the AI confirms the
// pair is a genuine duplicate. Absent / unavailable ⇒ borderline pairs are NOT filed.
export type Tier4Confirm = (
  candidate: Tier4Candidate,
  doneItem: { title: string; description: string },
) => Promise<boolean>;

export interface Tier4Service {
  scanCandidates(projectId: string, candidates: Tier4Candidate[]): Promise<void>;
  dismissStale(projectId: string, nowMs?: number): number;
  // F6-01 — the set of bundle-defined "done" statuses for a project: the terminal status of
  // every declared item type (per-type, because a multi-type bundle's union terminal is just
  // one type's done — e.g. test-bundle's union ends at note's `published`, not task's `done`).
  // null when the bundle is not loaded, so callers can refuse to badge rather than guess.
  // Tiers 1-3 use it to badge only done items.
  doneStatuses(projectId: string): string[] | null;
}

export interface CreateTier4Options {
  db: DB;
  projects: ProjectsService;
  registry: MethodologyRegistry;
  drift: DriftService;
  confirm?: Tier4Confirm;
}

export function createTier4Service(opts: CreateTier4Options): Tier4Service {
  const { db, projects, registry, drift, confirm } = opts;

  // Union-terminal done status — the tier-4 dedup scan's existing behaviour (a single
  // done concept for similarity matching). Kept distinct from the per-type set used by
  // tiers 1-3 below.
  function unionDoneStatus(projectId: string): string | null {
    const project = projects.get(projectId);
    if (!project) return null;
    const loaded = registry.resolveBundle(project.bundle_id, project.bundle_path, project.repo_path);
    if (loaded.status !== 'loaded') return null;
    return bundleDoneStatus(bundleItemPolicy(loaded.bundle));
  }

  // Per-type terminal statuses (F6-01) — one "done" per declared item type, deduped.
  function perTypeDoneStatuses(projectId: string): string[] | null {
    const project = projects.get(projectId);
    if (!project) return null;
    const loaded = registry.resolveBundle(project.bundle_id, project.bundle_path, project.repo_path);
    if (loaded.status !== 'loaded') return null;
    const policy = bundleItemPolicy(loaded.bundle);
    const set = new Set<string>();
    for (const type of policy.types) set.add(bundleDoneStatusForType(policy, type));
    if (set.size === 0) set.add(bundleDoneStatus(policy));
    return [...set];
  }

  function doneItems(projectId: string): Array<{ id: string; title: string; description: string }> {
    const done = unionDoneStatus(projectId);
    if (done === null) return [];
    return db
      .prepare(
        'SELECT id, title, description FROM items WHERE project_id = ? AND status = ?',
      )
      .all(projectId, done) as Array<{ id: string; title: string; description: string }>;
  }

  return {
    async scanCandidates(projectId, candidates) {
      if (candidates.length === 0) return;
      const dones = doneItems(projectId);
      if (dones.length === 0) return;
      for (const cand of candidates) {
        const candText = `${cand.title} ${cand.description}`;
        let best: { item: { id: string; title: string; description: string }; score: number } | null =
          null;
        for (const d of dones) {
          const score = cosineSimilarity(candText, `${d.title} ${d.description}`);
          if (!best || score > best.score) best = { item: d, score };
        }
        if (!best || best.score < BORDERLINE_THRESHOLD) continue;
        let fileIt = best.score >= STRONG_THRESHOLD;
        if (!fileIt && best.score >= BORDERLINE_THRESHOLD && confirm) {
          fileIt = await confirm(cand, best.item).catch(() => false);
        }
        if (!fileIt) continue;
        drift.createCodeSignalIdempotent({
          projectId,
          itemId: best.item.id,
          category: 'tier-4',
          reason: `New dump-zone entry "${cand.title}" looks like a duplicate of done item "${best.item.title}" (similarity ${best.score.toFixed(2)})`,
          payload: {
            similarity: best.score,
            candidate_title: cand.title,
            confirmed: best.score < STRONG_THRESHOLD,
          },
        });
      }
    },

    dismissStale(projectId, nowMs = Date.now()) {
      const rows = db
        .prepare(
          `SELECT id, created_at FROM drift_signals
            WHERE project_id = ? AND stream = 'code' AND category = 'tier-4'
              AND dismissed_at IS NULL`,
        )
        .all(projectId) as Array<{ id: string; created_at: string }>;
      let n = 0;
      for (const r of rows) {
        if (nowMs - Date.parse(r.created_at) >= STALE_MS) {
          drift.dismissSignal(r.id, 'stale-no-action');
          appendAudit(db, {
            projectId,
            entityType: 'project',
            entityId: projectId,
            actor: 'system',
            field: 'drift_signal_auto_dismiss',
            oldValue: r.id,
            triggerContext: { reason: 'stale-no-action', tier: 'tier-4', age_days: 7 },
          });
          n += 1;
        }
      }
      return n;
    },

    doneStatuses(projectId) {
      return perTypeDoneStatuses(projectId);
    },
  };
}
