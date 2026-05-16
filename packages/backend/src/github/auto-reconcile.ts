import { nanoid } from 'nanoid';
import type {
  AutoReconcileConfidence,
  AutoReconcileOutcome,
  ReconcileDiff,
} from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';
import type { ItemsService } from '../items/service.js';
import type { ProjectsService } from '../projects/service.js';
import type { ReconcileService } from '../reconcile/service.js';
import type { GhPull } from './api.js';

// Phase 10 (T-D6 / T-D18; SPEC §7.13) — auto-reconcile on PR merge. When a tracked branch
// merges, the PR description + merge/commit message + diff stats are fed to the reconcile
// engine and the resulting diff is dispatched by AI confidence:
//   high   → auto-apply with toast + 24h undo (T-D6)
//   medium → notification badge + one-click approve (the run is left pending; the normal
//            reconcile-apply endpoint is the "approve" action)
//   low    → reconcile modal as normal (run left pending)
//
// Confidence scoring is INSTRUMENTED FROM DAY 1 into the audit log (T-D6) so the §13
// threshold values can be calibrated empirically after the first 10 / 50 runs. The
// formula here is the transparent v1 default; its knobs are project-overridable via
// settings_json.github_auto_reconcile (a §13 partially-blocking item, not a hard spec).

export interface AutoReconcileThresholds {
  // Max diff rows for a high-confidence auto-apply (large diffs always get human eyes).
  high_max_rows: number;
}

const DEFAULT_THRESHOLDS: AutoReconcileThresholds = { high_max_rows: 8 };

interface UndoSnapshot {
  token: string;
  project_id: string;
  expires_at: string;
  items: Array<{
    id: string;
    status: string;
    title: string;
    description: string;
    blocker_text: string | null;
  }>;
}

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

export class UndoError extends Error {}

export interface AutoReconcileService {
  onMerge(projectId: string, pull: GhPull, diffStat: string): Promise<AutoReconcileOutcome>;
  undo(token: string): void;
  // medium-confidence one-click approve = apply the still-pending run.
  approve(projectId: string, runId: string): void;
}

export interface CreateAutoReconcileOptions {
  db: DB;
  projects: ProjectsService;
  items: ItemsService;
  reconcile: ReconcileService;
  now?: () => number;
}

function thresholdsFor(settings: Record<string, unknown>): AutoReconcileThresholds {
  const raw = settings.github_auto_reconcile;
  if (raw && typeof raw === 'object' && 'high_max_rows' in raw) {
    const v = (raw as { high_max_rows: unknown }).high_max_rows;
    if (typeof v === 'number' && v > 0) return { high_max_rows: v };
  }
  return DEFAULT_THRESHOLDS;
}

// Transparent v1 confidence model (calibratable per §13). Heuristic-extractor diffs never
// auto-apply (SPEC: only high-confidence AI auto-applies); any contradicted row forces a
// human (it spawns a drift signal anyway); otherwise small all-completed/no-change diffs
// are high, modest completed-dominated diffs are medium, everything else low.
function scoreConfidence(
  diff: ReconcileDiff,
  th: AutoReconcileThresholds,
): { confidence: AutoReconcileConfidence; composition: Record<string, number> } {
  const composition: Record<string, number> = {};
  for (const r of diff.rows) composition[r.category] = (composition[r.category] ?? 0) + 1;
  if (diff.extractor !== 'anthropic') return { confidence: 'low', composition };
  if ((composition.contradicted ?? 0) > 0) return { confidence: 'low', composition };
  const total = diff.rows.length;
  if (total === 0) return { confidence: 'low', composition };
  if (total > th.high_max_rows) return { confidence: 'low', composition };
  const safe = (composition.completed ?? 0) + (composition.no_change ?? 0);
  if (safe === total) return { confidence: 'high', composition };
  const completedDominated = (composition.completed ?? 0) >= Math.ceil(total / 2);
  return { confidence: completedDominated ? 'medium' : 'low', composition };
}

export function createAutoReconcileService(
  opts: CreateAutoReconcileOptions,
): AutoReconcileService {
  const { db, projects, items, reconcile } = opts;
  const now = opts.now ?? Date.now;
  const undoStore = new Map<string, UndoSnapshot>();

  function pruneUndo(): void {
    const t = now();
    for (const [k, v] of undoStore) {
      if (Date.parse(v.expires_at) <= t) undoStore.delete(k);
    }
  }

  function snapshot(projectId: string, diff: ReconcileDiff, token: string): UndoSnapshot {
    const ids = new Set<string>();
    for (const r of diff.rows) {
      if (r.category === 'completed' || r.category === 'edited' || r.category === 'blocker') {
        ids.add(r.item_id);
      }
    }
    const itemsSnap: UndoSnapshot['items'] = [];
    for (const id of ids) {
      const it = items.get(id);
      if (it) {
        itemsSnap.push({
          id: it.id,
          status: it.status,
          title: it.title,
          description: it.description,
          blocker_text: it.blocker_text,
        });
      }
    }
    return {
      token,
      project_id: projectId,
      expires_at: new Date(now() + UNDO_WINDOW_MS).toISOString(),
      items: itemsSnap,
    };
  }

  return {
    async onMerge(projectId, pull, diffStat) {
      const project = projects.get(projectId);
      if (!project) throw new Error(`project ${projectId} not found`);
      const th = thresholdsFor(project.settings_json);
      const inputText = [
        `PR #${pull.number}: ${pull.title}`,
        '',
        pull.title,
        '',
        `Merge of branch ${pull.head.ref} into ${pull.base.ref}.`,
        diffStat ? `Diff: ${diffStat}` : '',
      ]
        .filter((l) => l !== undefined)
        .join('\n');

      const run = await reconcile.propose({
        project_id: projectId,
        text: inputText,
        source: 'pr-description',
        session_id: null,
      });
      const { confidence, composition } = scoreConfidence(run.diff, th);

      // T-D6: confidence score + full PR provenance logged from day 1, every disposition.
      const baseContext = {
        pr_number: pull.number,
        repo: `${project.github_owner}/${project.github_repo}`,
        confidence,
        confidence_composition: composition,
        reconcile_run_id: run.id,
        pr_description: `${pull.title}`,
        extractor: run.diff.extractor,
      };

      if (confidence === 'high') {
        const token = nanoid();
        const snap = snapshot(projectId, run.diff, token);
        reconcile.apply({ run_id: run.id, diff: run.diff });
        undoStore.set(token, snap);
        pruneUndo();
        appendAudit(db, {
          projectId,
          entityType: 'project',
          entityId: projectId,
          actor: 'ai_auto_apply',
          field: 'github_auto_reconcile',
          newValue: 'auto-applied',
          triggerContext: { ...baseContext, undo_token: token, undo_expires_at: snap.expires_at },
        });
        return {
          pr_number: pull.number,
          repo: baseContext.repo,
          confidence,
          disposition: 'auto-applied',
          reconcile_run_id: run.id,
          undo_token: token,
          undo_expires_at: snap.expires_at,
        };
      }

      const disposition = confidence === 'medium' ? 'pending-approval' : 'modal';
      appendAudit(db, {
        projectId,
        entityType: 'project',
        entityId: projectId,
        actor: 'ai_auto_apply',
        field: 'github_auto_reconcile',
        newValue: disposition,
        triggerContext: baseContext,
      });
      return {
        pr_number: pull.number,
        repo: baseContext.repo,
        confidence,
        disposition,
        reconcile_run_id: run.id,
      };
    },

    undo(token) {
      pruneUndo();
      const snap = undoStore.get(token);
      if (!snap) throw new UndoError('undo token expired or unknown');
      for (const it of snap.items) {
        items.update(it.id, {
          status: it.status,
          title: it.title,
          description: it.description,
          blocker_text: it.blocker_text,
        });
      }
      undoStore.delete(token);
      appendAudit(db, {
        projectId: snap.project_id,
        entityType: 'project',
        entityId: snap.project_id,
        actor: 'user',
        field: 'github_auto_reconcile_undo',
        oldValue: token,
        triggerContext: { reverted_item_count: snap.items.length },
      });
    },

    approve(projectId, runId) {
      const run = reconcile.get(runId);
      if (!run || run.project_id !== projectId) throw new UndoError('run not found');
      reconcile.apply({ run_id: runId, diff: run.diff });
      appendAudit(db, {
        projectId,
        entityType: 'project',
        entityId: projectId,
        actor: 'user',
        field: 'github_auto_reconcile_approve',
        newValue: runId,
      });
    },
  };
}
