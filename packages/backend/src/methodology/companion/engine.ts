import { nanoid } from 'nanoid';
import type {
  AvailableChecklist,
  ChecklistRun,
  ChecklistRunStep,
  ChecklistStepFindings,
  ChecklistStepKind,
  ChecklistStepState,
  CompanionChecklistsResult,
  LoadedBundle,
} from '@throughline/shared';
import { appendAudit } from '../../audit/log.js';
import { recordCost } from '../../cost/telemetry.js';
import { promptFingerprint } from '../../ai/fingerprint.js';
import { usdEstimate } from '../../ai/pricing.js';
import type { DB } from '../../db/index.js';
import type { MethodologyRegistry } from '../loader.js';
import type { ProjectsService } from '../../projects/service.js';
import type { LibraryService } from '../../library/service.js';
import { runMechanicalCheck, resolveCheckKind, type CheckContext } from '../gates/checks.js';
import type { CompanionJudge } from './judgement.js';

// C-D8 / T-D45 — companion review workflow engine. Bundle-declared checklists instantiate
// as ChecklistRun records; each step drives a small state machine
// (pending → in-progress → passed | failed | skipped). Mechanical steps reuse the exact
// Phase-8 mechanical-check pipeline (gates/checks.ts) so a checklist mechanical step and a
// mechanical gate behave identically. Judgement steps are made by the user directly, or
// AI-via-Anthropic returns a *proposed* judgement the user reviews before committing
// (C-D8 path b). Every transition writes an audit row (entity_type 'checklist_step',
// T-D36). A failed mechanical step never halts the run (T-D44 kin); the user can override
// with a reason and continue.
//
// Schema note (CODE_SPEC §3 schema sketch): the checklist_runs / checklist_run_steps tables ship from
// 0001_init and are deliberately minimal. Step kind/description/order are re-derived from
// the bundle's ChecklistSpec (the bundle is the source of truth); companion_mode and the
// run-summary library-note id are recovered from the run's audit trail, which is the
// canonical companion-review record (T-D45 — queryable via the audit RAG substrate).

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`project ${id} not found`);
  }
}
export class ChecklistNotFoundError extends Error {
  constructor(id: string) {
    super(`checklist ${id} not declared by the project's bundle`);
  }
}
export class RunNotFoundError extends Error {
  constructor(id: string) {
    super(`checklist run ${id} not found`);
  }
}
export class StepNotFoundError extends Error {
  constructor(id: string) {
    super(`checklist run step ${id} not found`);
  }
}
export class StepKindError extends Error {
  constructor(stepId: string, expected: string) {
    super(`step ${stepId} is not a ${expected} step`);
  }
}
export class RunCompletedError extends Error {
  constructor(id: string) {
    super(`checklist run ${id} is already completed`);
  }
}

export interface CompanionEngine {
  listChecklists(projectId: string): CompanionChecklistsResult;
  startRun(projectId: string, checklistId: string, companionMode?: string | null): ChecklistRun;
  listRuns(projectId: string): ChecklistRun[];
  getRun(runId: string): ChecklistRun | null;
  // Cheap single-query ownership lookup for the route-layer cross-project guard.
  runProjectId(runId: string): string | null;
  runMechanicalStep(runId: string, stepId: string): Promise<ChecklistRun>;
  aiJudgeStep(runId: string, stepId: string): Promise<ChecklistRun>;
  resolveJudgementStep(
    runId: string,
    stepId: string,
    input: { decision: 'pass' | 'fail' | 'skip'; rationale: string },
  ): ChecklistRun;
  overrideStep(runId: string, stepId: string, reason: string): ChecklistRun;
  completeRun(runId: string, input: { summary?: string; itemIds?: string[] }): ChecklistRun;
}

interface RunRow {
  id: string;
  project_id: string;
  checklist_id: string;
  state: string;
  started_at: string;
  completed_at: string | null;
}
interface StepRow {
  run_id: string;
  step_id: string;
  state: string;
  findings_json: string | null;
  transitioned_at: string;
}

function emptyFindings(): ChecklistStepFindings {
  return { check: '', summary: '', items: [] };
}

function stepEntityId(runId: string, stepId: string): string {
  return `${runId}:${stepId}`;
}

export interface CreateCompanionEngineOptions {
  db: DB;
  projects: ProjectsService;
  registry: MethodologyRegistry;
  library: LibraryService;
  judge: CompanionJudge;
}

export function createCompanionEngine(opts: CreateCompanionEngineOptions): CompanionEngine {
  const { db, projects, registry, library, judge } = opts;

  function bundleFor(projectId: string): LoadedBundle | null {
    const p = projects.get(projectId);
    if (!p) return null;
    const loaded = registry.resolveBundle(p.bundle_id, p.bundle_path);
    return loaded.status === 'loaded' ? loaded.bundle : null;
  }

  function citedAnchors(projectId: string): string[] {
    const rows = db
      .prepare(
        `SELECT DISTINCT c.anchor_id AS a
           FROM item_anchor_citations c
           JOIN items i ON i.id = c.item_id
          WHERE i.project_id = ?`,
      )
      .all(projectId) as Array<{ a: string }>;
    return rows.map((r) => r.a);
  }

  function stateDigest(projectId: string, bundle: LoadedBundle): string {
    const byStatus = db
      .prepare(`SELECT status, COUNT(*) n FROM items WHERE project_id = ? GROUP BY status`)
      .all(projectId) as Array<{ status: string; n: number }>;
    const anchors = citedAnchors(projectId);
    return [
      `Bundle: ${bundle.identity.name} v${bundle.identity.version}`,
      `Items by status: ${byStatus.map((s) => `${s.status}=${s.n}`).join(', ') || 'none'}`,
      `Cited anchors: ${anchors.join(', ') || 'none'}`,
    ].join('\n');
  }

  // Recover a value from the run's audit trail (companion_mode / summary_entry_id are not
  // persisted columns — the audit log is the canonical record, T-D45).
  function auditValue(runId: string, field: string, key: string): string | null {
    const row = db
      .prepare(
        `SELECT trigger_context_json FROM audit_log
           WHERE entity_type = 'checklist_step' AND entity_id = ? AND field = ?
           ORDER BY timestamp DESC LIMIT 1`,
      )
      .get(runId, field) as { trigger_context_json: string } | undefined;
    if (!row) return null;
    try {
      const v = (JSON.parse(row.trigger_context_json) as Record<string, unknown>)[key];
      return typeof v === 'string' ? v : null;
    } catch {
      return null;
    }
  }

  type StepMeta = Map<string, { ordinal: number; kind: ChecklistStepKind; description: string }>;

  // Step kind/description/order live in the bundle's ChecklistSpec (the source of truth),
  // not the minimal persisted row — build the lookup once per checklist.
  function stepMeta(bundle: LoadedBundle | null, checklistId: string): StepMeta {
    const order: StepMeta = new Map();
    const spec = bundle?.review_patterns.checklists.find((c) => c.id === checklistId);
    (spec?.steps ?? []).forEach((s, i) => {
      order.set(s.id, { ordinal: i, kind: s.kind, description: s.description });
    });
    return order;
  }

  function assembleRun(
    row: RunRow,
    stepRows: StepRow[],
    meta: StepMeta,
    companionMode: string | null,
    summaryEntryId: string | null,
  ): ChecklistRun {
    const steps: ChecklistRunStep[] = stepRows
      .map((r) => {
        const m = meta.get(r.step_id);
        return {
          run_id: r.run_id,
          step_id: r.step_id,
          kind: (m?.kind ?? 'mechanical') as ChecklistStepKind,
          description: m?.description ?? '',
          ordinal: m?.ordinal ?? Number.MAX_SAFE_INTEGER,
          state: r.state as ChecklistStepState,
          findings: r.findings_json
            ? (JSON.parse(r.findings_json) as ChecklistStepFindings)
            : emptyFindings(),
          transitioned_at: r.transitioned_at,
        };
      })
      .sort((a, b) => a.ordinal - b.ordinal);
    return {
      id: row.id,
      project_id: row.project_id,
      checklist_id: row.checklist_id,
      companion_mode: companionMode,
      state: row.state as ChecklistRun['state'],
      summary_entry_id: summaryEntryId,
      started_at: row.started_at,
      completed_at: row.completed_at,
      steps,
    };
  }

  function loadRun(runId: string): ChecklistRun {
    const row = db.prepare(`SELECT * FROM checklist_runs WHERE id = ?`).get(runId) as
      | RunRow
      | undefined;
    if (!row) throw new RunNotFoundError(runId);
    const stepRows = db
      .prepare(`SELECT * FROM checklist_run_steps WHERE run_id = ? ORDER BY rowid`)
      .all(runId) as StepRow[];
    return assembleRun(
      row,
      stepRows,
      stepMeta(bundleFor(row.project_id), row.checklist_id),
      auditValue(row.id, 'run_started', 'companion_mode'),
      auditValue(row.id, 'run_completed', 'summary_entry_id'),
    );
  }

  function requireStep(runId: string, stepId: string): { run: RunRow; step: StepRow } {
    const run = db.prepare(`SELECT * FROM checklist_runs WHERE id = ?`).get(runId) as
      | RunRow
      | undefined;
    if (!run) throw new RunNotFoundError(runId);
    if (run.state === 'completed') throw new RunCompletedError(runId);
    const step = db
      .prepare(`SELECT * FROM checklist_run_steps WHERE run_id = ? AND step_id = ?`)
      .get(runId, stepId) as StepRow | undefined;
    if (!step) throw new StepNotFoundError(stepId);
    return { run, step };
  }

  function specStep(
    run: RunRow,
    stepId: string,
  ): { kind: ChecklistStepKind; description: string } {
    const bundle = bundleFor(run.project_id);
    const spec = bundle?.review_patterns.checklists.find((c) => c.id === run.checklist_id);
    const s = spec?.steps.find((x) => x.id === stepId);
    return { kind: s?.kind ?? 'mechanical', description: s?.description ?? '' };
  }

  function transition(
    run: RunRow,
    stepId: string,
    fromState: string,
    toState: ChecklistStepState,
    findings: ChecklistStepFindings,
    actor: 'user' | 'methodology_runtime' | 'ai',
    field: string,
    triggerContext: Record<string, unknown> = {},
  ): void {
    const at = new Date().toISOString();
    db.prepare(
      `UPDATE checklist_run_steps SET state = ?, findings_json = ?, transitioned_at = ?
         WHERE run_id = ? AND step_id = ?`,
    ).run(toState, JSON.stringify(findings), at, run.id, stepId);
    appendAudit(db, {
      projectId: run.project_id,
      entityType: 'checklist_step',
      entityId: stepEntityId(run.id, stepId),
      actor,
      field,
      oldValue: fromState,
      newValue: toState,
      triggerContext: {
        run_id: run.id,
        checklist_id: run.checklist_id,
        step_id: stepId,
        ...triggerContext,
      },
    });
  }

  return {
    listChecklists(projectId) {
      const bundle = bundleFor(projectId);
      if (!bundle) return { checklists: [], companion_modes: [] };
      const rp = bundle.review_patterns;
      const checklists: AvailableChecklist[] = rp.checklists.map((c) => ({
        id: c.id,
        name: c.name,
        steps: c.steps.map((s) => ({ id: s.id, kind: s.kind, description: s.description })),
      }));
      return {
        checklists,
        companion_modes: rp.companion_modes.map((m) => ({ id: m.id, name: m.name })),
      };
    },

    startRun(projectId, checklistId, companionMode) {
      const p = projects.get(projectId);
      if (!p) throw new ProjectNotFoundError(projectId);
      const bundle = bundleFor(projectId);
      const spec = bundle?.review_patterns.checklists.find((c) => c.id === checklistId);
      if (!bundle || !spec) throw new ChecklistNotFoundError(checklistId);
      const id = nanoid();
      const now = new Date().toISOString();
      // Default companion mode is the bundle's first-declared mode (C-D9 idiom). The
      // modes ↔ review-patterns relationship is a Phase-13 spec gap, deferred per ROADMAP
      // — checklist + mode is a parameter pair here with no behavioural coupling yet.
      const mode = companionMode ?? bundle.review_patterns.companion_modes[0]?.id ?? null;
      db.prepare(
        `INSERT INTO checklist_runs (id, project_id, checklist_id, state, started_at, completed_at)
           VALUES (?, ?, ?, 'running', ?, NULL)`,
      ).run(id, projectId, checklistId, now);
      for (const s of spec.steps) {
        db.prepare(
          `INSERT INTO checklist_run_steps (run_id, step_id, state, findings_json, transitioned_at)
             VALUES (?, ?, 'pending', ?, ?)`,
        ).run(id, s.id, JSON.stringify(emptyFindings()), now);
      }
      appendAudit(db, {
        projectId,
        entityType: 'checklist_step',
        entityId: id,
        actor: 'user',
        field: 'run_started',
        newValue: checklistId,
        triggerContext: { run_id: id, checklist_id: checklistId, companion_mode: mode },
      });
      return loadRun(id);
    },

    listRuns(projectId) {
      // Batched assembly: a constant number of queries regardless of run count
      // (runs + steps + run-level audits), not the 1+4N that per-run loadRun would cost.
      const rows = db
        .prepare(
          // rowid DESC is the stable tiebreaker: started_at is ms-precision ISO, so two
          // runs started in the same millisecond would otherwise order non-deterministically
          // (the companion.test.ts newest-first assertion flaked on exactly this).
          `SELECT * FROM checklist_runs WHERE project_id = ? ORDER BY started_at DESC, rowid DESC`,
        )
        .all(projectId) as RunRow[];
      if (rows.length === 0) return [];
      const runIds = rows.map((r) => r.id);
      const placeholders = runIds.map(() => '?').join(',');

      const stepsByRun = new Map<string, StepRow[]>();
      for (const s of db
        .prepare(
          `SELECT * FROM checklist_run_steps WHERE run_id IN (${placeholders}) ORDER BY run_id, rowid`,
        )
        .all(...runIds) as StepRow[]) {
        const list = stepsByRun.get(s.run_id);
        if (list) list.push(s);
        else stepsByRun.set(s.run_id, [s]);
      }

      // companion_mode / summary_entry_id are recovered from the run-level audit rows
      // (entity_id = runId). Rows arrive timestamp-ascending so the last write wins,
      // matching the single-run auditValue's `ORDER BY timestamp DESC LIMIT 1`.
      const modeByRun = new Map<string, string | null>();
      const summaryByRun = new Map<string, string | null>();
      for (const a of db
        .prepare(
          `SELECT entity_id, field, trigger_context_json FROM audit_log
             WHERE entity_type = 'checklist_step'
               AND field IN ('run_started','run_completed')
               AND entity_id IN (${placeholders})
             ORDER BY timestamp`,
        )
        .all(...runIds) as Array<{
        entity_id: string;
        field: string;
        trigger_context_json: string;
      }>) {
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(a.trigger_context_json) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (a.field === 'run_started') {
          const v = parsed['companion_mode'];
          modeByRun.set(a.entity_id, typeof v === 'string' ? v : null);
        } else {
          const v = parsed['summary_entry_id'];
          summaryByRun.set(a.entity_id, typeof v === 'string' ? v : null);
        }
      }

      const bundle = bundleFor(projectId);
      const metaByChecklist = new Map<string, StepMeta>();
      return rows.map((row) => {
        let meta = metaByChecklist.get(row.checklist_id);
        if (!meta) {
          meta = stepMeta(bundle, row.checklist_id);
          metaByChecklist.set(row.checklist_id, meta);
        }
        return assembleRun(
          row,
          stepsByRun.get(row.id) ?? [],
          meta,
          modeByRun.get(row.id) ?? null,
          summaryByRun.get(row.id) ?? null,
        );
      });
    },

    getRun(runId) {
      try {
        return loadRun(runId);
      } catch (e) {
        if (e instanceof RunNotFoundError) return null;
        throw e;
      }
    },

    runProjectId(runId) {
      const row = db
        .prepare(`SELECT project_id FROM checklist_runs WHERE id = ?`)
        .get(runId) as { project_id: string } | undefined;
      return row?.project_id ?? null;
    },

    async runMechanicalStep(runId, stepId) {
      const { run, step } = requireStep(runId, stepId);
      const meta = specStep(run, stepId);
      if (meta.kind !== 'mechanical') throw new StepKindError(stepId, 'mechanical');
      const p = projects.get(run.project_id)!;
      const bundle = bundleFor(run.project_id);
      if (!bundle) {
        transition(
          run,
          stepId,
          step.state,
          'skipped',
          { check: 'mechanical', summary: 'bundle unresolved; step skipped', items: [] },
          'methodology_runtime',
          'mechanical_skipped',
        );
        return loadRun(runId);
      }
      transition(
        run,
        stepId,
        step.state,
        'in-progress',
        step.findings_json
          ? (JSON.parse(step.findings_json) as ChecklistStepFindings)
          : emptyFindings(),
        'methodology_runtime',
        'mechanical_started',
      );
      const ctx: CheckContext = {
        bundle,
        repoPath: p.repo_path,
        citedAnchors: citedAnchors(run.project_id),
      };
      const kind = resolveCheckKind(stepId, meta.description);
      const res = await runMechanicalCheck(kind, ctx, stepId, meta.description);
      // C-D8: mechanical result is passed | failed; skipped is recorded as-is and an
      // error maps to failed. Never halts the run (T-D44 kin).
      const toState: ChecklistStepState =
        res.status === 'pass' ? 'passed' : res.status === 'skipped' ? 'skipped' : 'failed';
      transition(
        run,
        stepId,
        'in-progress',
        toState,
        { check: res.findings.check, summary: res.findings.summary, items: res.findings.items },
        'methodology_runtime',
        'mechanical_resolved',
        { check_status: res.status },
      );
      return loadRun(runId);
    },

    async aiJudgeStep(runId, stepId) {
      const { run, step } = requireStep(runId, stepId);
      const meta = specStep(run, stepId);
      if (meta.kind !== 'judgement') throw new StepKindError(stepId, 'judgement');
      const p = projects.get(run.project_id)!;
      const bundle = bundleFor(run.project_id);
      const digest = bundle ? stateDigest(run.project_id, bundle) : 'bundle unresolved';
      const result = await judge.judge({
        checklistId: run.checklist_id,
        stepId,
        description: meta.description,
        projectName: p.name,
        stateDigest: digest,
      });
      const at = new Date().toISOString();
      // The AI judgement is a *proposal* (C-D8 path b): the step stays in-progress and the
      // user reviews/commits it via resolve-judgement. Store the proposal in findings.
      const findings: ChecklistStepFindings = {
        ...(step.findings_json
          ? (JSON.parse(step.findings_json) as ChecklistStepFindings)
          : emptyFindings()),
        check: 'judgement',
        summary: `AI proposal: ${result.decision}`,
        items: [{ message: result.rationale }],
        ai_proposal: {
          decision: result.decision,
          rationale: result.rationale,
          model: result.telemetry.model ?? 'unavailable',
          at,
        },
      };
      transition(run, stepId, step.state, 'in-progress', findings, 'ai', 'ai_judgement_proposed', {
        ai_decision: result.decision,
      });
      // T-D24 — record the model + a salted prompt fingerprint, never the prompt body.
      if (result.telemetry.model && result.telemetry.prompt) {
        appendAudit(db, {
          projectId: run.project_id,
          entityType: 'checklist_step',
          entityId: stepEntityId(run.id, stepId),
          actor: 'ai',
          field: 'ai_judgement_model',
          newValue: result.telemetry.model,
          triggerContext: {
            run_id: run.id,
            step_id: stepId,
            model: result.telemetry.model,
            prompt_fingerprint: promptFingerprint(
              'companion_review_judgement',
              result.telemetry.prompt,
            ),
          },
        });
      }
      if (
        result.telemetry.model &&
        (result.telemetry.input_tokens > 0 || result.telemetry.output_tokens > 0)
      ) {
        recordCost(db, {
          projectId: run.project_id,
          feature: 'companion_review_judgement',
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
      return loadRun(runId);
    },

    resolveJudgementStep(runId, stepId, input) {
      const { run, step } = requireStep(runId, stepId);
      const meta = specStep(run, stepId);
      if (meta.kind !== 'judgement') throw new StepKindError(stepId, 'judgement');
      const toState: ChecklistStepState =
        input.decision === 'pass'
          ? 'passed'
          : input.decision === 'skip'
            ? 'skipped'
            : 'failed';
      const prev = step.findings_json
        ? (JSON.parse(step.findings_json) as ChecklistStepFindings)
        : emptyFindings();
      const findings: ChecklistStepFindings = {
        check: 'judgement',
        summary: input.rationale,
        items: [],
        ...(prev.ai_proposal ? { ai_proposal: prev.ai_proposal } : {}),
      };
      transition(run, stepId, step.state, toState, findings, 'user', 'judgement_resolved', {
        decision: input.decision,
      });
      return loadRun(runId);
    },

    overrideStep(runId, stepId, reason) {
      const { run, step } = requireStep(runId, stepId);
      const meta = specStep(run, stepId);
      if (meta.kind !== 'mechanical') throw new StepKindError(stepId, 'mechanical');
      if (step.state !== 'failed') {
        throw new StepKindError(stepId, 'failed-mechanical (only a failed step is overridable)');
      }
      // A failed mechanical step never halts the run (T-D44 kin); the override is
      // audit-logged and the step is marked passed so the run reflects the human call.
      const prev = step.findings_json
        ? (JSON.parse(step.findings_json) as ChecklistStepFindings)
        : emptyFindings();
      const findings: ChecklistStepFindings = {
        ...prev,
        override: { reason, at: new Date().toISOString() },
      };
      transition(run, stepId, step.state, 'passed', findings, 'user', 'override', {
        override_reason: reason,
        original_state: 'failed',
      });
      return loadRun(runId);
    },

    completeRun(runId, input) {
      const row = db.prepare(`SELECT * FROM checklist_runs WHERE id = ?`).get(runId) as
        | RunRow
        | undefined;
      if (!row) throw new RunNotFoundError(runId);
      if (row.state === 'completed') throw new RunCompletedError(runId);
      const now = new Date().toISOString();
      let summaryEntryId: string | null = null;
      const summary = input.summary?.trim();
      if (summary) {
        // The run summary is a normal library note (T-D10) and follows the same
        // edit/attach flows; attach it to the items discussed in the run.
        const entry = library.create({
          project_id: row.project_id,
          type: 'note',
          title: `Companion review — ${row.checklist_id} (${now.slice(0, 10)})`,
          body: summary,
          tags: ['companion-review'],
        });
        summaryEntryId = entry.id;
        for (const itemId of input.itemIds ?? []) {
          try {
            library.attach(entry.id, itemId);
          } catch {
            /* a bad item id must not fail run completion (best-effort attach) */
          }
        }
      }
      db.prepare(`UPDATE checklist_runs SET state = 'completed', completed_at = ? WHERE id = ?`).run(
        now,
        runId,
      );
      appendAudit(db, {
        projectId: row.project_id,
        entityType: 'checklist_step',
        entityId: runId,
        actor: 'user',
        field: 'run_completed',
        oldValue: 'running',
        newValue: 'completed',
        triggerContext: {
          run_id: runId,
          checklist_id: row.checklist_id,
          summary_entry_id: summaryEntryId,
          attached_items: input.itemIds ?? [],
        },
      });
      return loadRun(runId);
    },
  };
}
