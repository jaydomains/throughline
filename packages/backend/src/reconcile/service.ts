import { nanoid } from 'nanoid';
import type {
  ReconcileApplyRequest,
  ReconcileApplyResult,
  ReconcileDiff,
  ReconcileRowDecision,
  ReconcileRun,
  ReconcileRunStatus,
  ReconcileSource,
} from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import { promptFingerprint } from '../ai/fingerprint.js';
import { usdEstimate } from '../ai/pricing.js';
import { recordCost } from '../cost/telemetry.js';
import type { DB } from '../db/index.js';
import type { DriftService } from '../drift/service.js';
import type { ItemsService } from '../items/service.js';
import type { MethodologyRegistry } from '../methodology/loader.js';
import type { ProjectsService } from '../projects/service.js';
import type { SessionsService } from '../sessions/service.js';
import { bundleItemPolicy } from '../items/policy.js';
import type { ReconcileEngine } from './engine.js';

const RECENT_RUNS_DEFAULT_LIMIT = 50;

interface ReconcileRunRow {
  id: string;
  project_id: string;
  session_id: string | null;
  source: ReconcileSource;
  status: ReconcileRunStatus;
  raw_text: string;
  diff_json: string;
  created_at: string;
  resolved_at: string | null;
}

function rowToRun(row: ReconcileRunRow): ReconcileRun {
  return {
    id: row.id,
    project_id: row.project_id,
    session_id: row.session_id,
    source: row.source,
    status: row.status,
    raw_text: row.raw_text,
    diff: JSON.parse(row.diff_json) as ReconcileDiff,
    created_at: row.created_at,
    resolved_at: row.resolved_at,
  };
}

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`project ${id} not found`);
  }
}

export class ReconcileRunNotFoundError extends Error {
  constructor(id: string) {
    super(`reconcile run ${id} not found`);
  }
}

export class ReconcileRunStateError extends Error {
  constructor(id: string, state: string) {
    super(`reconcile run ${id} is ${state}, cannot apply`);
  }
}

export interface ProposeReconcileInput {
  project_id: string;
  text: string;
  source: ReconcileSource;
  session_id: string | null;
}

export interface ReconcileService {
  propose(input: ProposeReconcileInput): Promise<ReconcileRun>;
  get(id: string): ReconcileRun | null;
  listRecent(projectId: string, limit?: number): ReconcileRun[];
  apply(input: ReconcileApplyRequest): ReconcileApplyResult;
  discard(id: string): void;
}

interface CreateOptions {
  db: DB;
  projects: ProjectsService;
  sessions: SessionsService;
  registry: MethodologyRegistry;
  items: ItemsService;
  drift: DriftService;
  engine: ReconcileEngine;
}

export function createReconcileService(opts: CreateOptions): ReconcileService {
  const { db, projects, sessions, registry, items, drift, engine } = opts;

  function getRow(id: string): ReconcileRunRow | null {
    const row = db.prepare('SELECT * FROM reconcile_runs WHERE id = ?').get(id) as
      | ReconcileRunRow
      | undefined;
    return row ?? null;
  }

  function decisionFor(
    decisions: Record<string, ReconcileRowDecision> | undefined,
    rowId: string,
  ): ReconcileRowDecision {
    return decisions?.[rowId] ?? 'accept';
  }

  return {
    async propose(input) {
      const project = projects.get(input.project_id);
      if (!project) throw new ProjectNotFoundError(input.project_id);
      const bundleResult = registry.get(project.bundle_id);
      if (!bundleResult || bundleResult.status !== 'loaded') {
        throw new Error(`bundle "${project.bundle_id}" not loaded`);
      }
      const policy = bundleItemPolicy(bundleResult.bundle);
      const existing = input.session_id
        ? items.list({ project_id: project.id, session_id: input.session_id })
        : items.list({ project_id: project.id });

      const result = await engine.diff({
        project_id: project.id,
        text: input.text,
        source: input.source,
        session_id: input.session_id,
        bundle: bundleResult.bundle,
        policy,
        existing_items: existing,
      });

      const id = nanoid();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO reconcile_runs
          (id, project_id, session_id, source, status, raw_text, diff_json, created_at, resolved_at)
          VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, NULL)`,
      ).run(
        id,
        project.id,
        input.session_id,
        input.source,
        input.text,
        JSON.stringify(result.diff),
        now,
      );

      const actor = result.diff.extractor === 'anthropic' ? 'ai' : 'system';
      const triggerContext: Record<string, unknown> = {
        source: input.source,
        extractor: result.diff.extractor,
        session_id: input.session_id,
        row_count: result.diff.rows.length,
        category_counts: countByCategory(result.diff),
      };
      if (result.telemetry.model) {
        triggerContext.model = result.telemetry.model;
      }
      if (result.telemetry.prompt) {
        triggerContext.prompt_fingerprint = promptFingerprint(
          'reconcile_diff',
          result.telemetry.prompt,
        );
      }
      appendAudit(db, {
        projectId: project.id,
        entityType: 'project',
        entityId: project.id,
        actor,
        field: 'reconcile_propose',
        newValue: id,
        triggerContext,
      });

      if (
        result.telemetry.model &&
        (result.telemetry.input_tokens > 0 || result.telemetry.output_tokens > 0)
      ) {
        recordCost(db, {
          projectId: project.id,
          feature: 'reconcile_diff',
          model: result.telemetry.model,
          inputTokens: result.telemetry.input_tokens,
          outputTokens: result.telemetry.output_tokens,
          usdEstimate: usdEstimate(
            result.telemetry.model,
            result.telemetry.input_tokens,
            result.telemetry.output_tokens,
          ),
        });
      }

      // Validate the optional session_id; the foreign key is ON DELETE SET NULL so a stale id
      // would otherwise quietly persist as-is. We don't reject here — the propose can target a
      // project-wide reconcile by passing null — but we want a row only if the session exists.
      if (input.session_id && !sessions.get(input.session_id)) {
        db.prepare('UPDATE reconcile_runs SET session_id = NULL WHERE id = ?').run(id);
      }

      return rowToRun(getRow(id)!);
    },

    get(id) {
      const row = getRow(id);
      return row ? rowToRun(row) : null;
    },

    listRecent(projectId, limit = RECENT_RUNS_DEFAULT_LIMIT) {
      const rows = db
        .prepare(
          `SELECT * FROM reconcile_runs
            WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`,
        )
        .all(projectId, limit) as ReconcileRunRow[];
      return rows.map(rowToRun);
    },

    apply(req) {
      const row = getRow(req.run_id);
      if (!row) throw new ReconcileRunNotFoundError(req.run_id);
      if (row.status !== 'pending') throw new ReconcileRunStateError(row.id, row.status);
      const project = projects.get(row.project_id);
      if (!project) throw new ProjectNotFoundError(row.project_id);

      const result: ReconcileApplyResult = {
        completed_item_ids: [],
        new_item_ids: [],
        edited_item_ids: [],
        blocker_item_ids: [],
        no_change_item_ids: [],
        drift_signal_ids: [],
        rejected_row_ids: [],
      };

      for (const r of req.diff.rows) {
        const decision = decisionFor(req.decisions, r.row_id);
        if (decision === 'reject') {
          result.rejected_row_ids.push(r.row_id);
          continue;
        }
        switch (r.category) {
          case 'completed': {
            items.update(r.item_id, { status: r.next_status });
            result.completed_item_ids.push(r.item_id);
            break;
          }
          case 'new': {
            const created = items.create({
              project_id: project.id,
              type: r.type,
              status: r.status,
              title: r.title,
              description: r.description,
              tags: r.tags,
              session_ids: req.diff.session_id ? [req.diff.session_id] : [],
            });
            result.new_item_ids.push(created.id);
            break;
          }
          case 'edited': {
            items.update(r.item_id, {
              title: r.next_title,
              description: r.next_description,
            });
            result.edited_item_ids.push(r.item_id);
            break;
          }
          case 'blocker': {
            items.update(r.item_id, { blocker_text: r.next_blocker_text });
            result.blocker_item_ids.push(r.item_id);
            break;
          }
          case 'no_change': {
            // Log only — surfaces in periodic-review hygiene that a row was reviewed and
            // intentionally not mutated. Helps avoid the "did anyone ever look at this?" gap.
            appendAudit(db, {
              projectId: project.id,
              entityType: 'item',
              entityId: r.item_id,
              actor: 'user',
              field: 'reconcile_review_noop',
              triggerContext: { run_id: row.id, row_id: r.row_id },
            });
            result.no_change_item_ids.push(r.item_id);
            break;
          }
          case 'contradicted': {
            // T-D35 + T-D21: spawn a code-drift signal rather than reverting state. Tier
            // depends on whether the item has a PR association recorded.
            const category = drift.hasPrAssociation(r.item_id) ? 'tier-2' : 'tier-3';
            const driftId = drift.createCodeSignal({
              projectId: project.id,
              itemId: r.item_id,
              category,
              reason: r.reason,
              payload: {
                reconcile_run_id: row.id,
                row_id: r.row_id,
                evidence: r.evidence,
                source: req.diff.source,
              },
            });
            result.drift_signal_ids.push(driftId);
            break;
          }
        }
      }

      const now = new Date().toISOString();
      db.prepare(
        `UPDATE reconcile_runs
          SET status = 'applied', resolved_at = ?, diff_json = ?
          WHERE id = ?`,
      ).run(now, JSON.stringify(req.diff), row.id);

      appendAudit(db, {
        projectId: project.id,
        entityType: 'project',
        entityId: project.id,
        actor: 'user',
        field: 'reconcile_apply',
        oldValue: row.id,
        newValue: JSON.stringify(summariseResult(result)),
        triggerContext: { run_id: row.id, source: row.source },
      });

      return result;
    },

    discard(id) {
      const row = getRow(id);
      // Idempotent: discard on a missing or already-resolved run is a no-op. Mirrors the
      // dump-zone discard convention; useful when the modal cancel races with apply.
      if (!row) return;
      if (row.status !== 'pending') return;
      const now = new Date().toISOString();
      db.prepare(
        `UPDATE reconcile_runs SET status = 'discarded', resolved_at = ? WHERE id = ?`,
      ).run(now, id);
      appendAudit(db, {
        projectId: row.project_id,
        entityType: 'project',
        entityId: row.project_id,
        actor: 'user',
        field: 'reconcile_discard',
        oldValue: id,
      });
    },
  };
}

function countByCategory(diff: ReconcileDiff): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of diff.rows) {
    out[r.category] = (out[r.category] ?? 0) + 1;
  }
  return out;
}

function summariseResult(result: ReconcileApplyResult): Record<string, number> {
  return {
    completed: result.completed_item_ids.length,
    new: result.new_item_ids.length,
    edited: result.edited_item_ids.length,
    blocker: result.blocker_item_ids.length,
    no_change: result.no_change_item_ids.length,
    drift: result.drift_signal_ids.length,
    rejected: result.rejected_row_ids.length,
  };
}
