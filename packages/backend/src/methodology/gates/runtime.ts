import { nanoid } from 'nanoid';
import { resolve as resolvePath } from 'node:path';
import type {
  GateFiring,
  GateFiringsResult,
  GateFindings,
  GateMomentGroup,
  GateRunResult,
  LoadedBundle,
  PhaseMoment,
} from '@throughline/shared';
import { appendAudit } from '../../audit/log.js';
import { recordCost } from '../../cost/telemetry.js';
import { promptFingerprint } from '../../ai/fingerprint.js';
import { usdEstimate } from '../../ai/pricing.js';
import type { DB } from '../../db/index.js';
import type { MethodologyRegistry } from '../loader.js';
import type { ProjectsService } from '../../projects/service.js';
import { runMechanicalCheck, resolveCheckKind, type CheckContext } from './checks.js';
import type { JudgementGate } from './judgement.js';

const MOMENTS: PhaseMoment[] = [
  'plan-mode',
  'pre-write',
  'per-commit',
  'post-commit',
  'pr-open',
];

export interface GateDispatchInput {
  projectId?: string;
  repoPath?: string;
  headSha?: string;
  itemId?: string;
}

export interface GateRuntime {
  dispatch(moment: PhaseMoment, input: GateDispatchInput): Promise<GateRunResult>;
  runMoment(projectId: string, moment: PhaseMoment): Promise<GateRunResult>;
  listFirings(projectId: string): GateFiringsResult;
  override(projectId: string, firingId: string, reason: string): GateFiring | null;
  // Internal per-commit trigger: an item state transition fires the same gates as the
  // git pre-commit hook (SPEC §7.12). Best-effort; never throws into the caller.
  onItemStatusTransition(projectId: string): void;
}

interface GateFiringRow {
  id: string;
  project_id: string;
  moment: string;
  gate_id: string;
  status: string;
  findings_json: string;
  created_at: string;
}

export interface CreateGateRuntimeOptions {
  db: DB;
  projects: ProjectsService;
  registry: MethodologyRegistry;
  judgement: JudgementGate;
  // Phase 9 (C-D7) — fired after a moment is resolved to a project, before gate firings.
  // The discipline-drift engine uses it to run write-time scanners at the pre-write
  // moment without duplicating trigger logic. Best-effort; must never throw into gates.
  onMoment?: (projectId: string, moment: PhaseMoment) => void;
  logger?: { info: (m: string) => void; warn: (m: string) => void; error: (m: string) => void };
}

function rowToFiring(row: GateFiringRow): GateFiring {
  return {
    id: row.id,
    project_id: row.project_id,
    moment: row.moment as PhaseMoment,
    gate_id: row.gate_id,
    status: row.status as GateFiring['status'],
    findings: JSON.parse(row.findings_json) as GateFindings,
    created_at: row.created_at,
  };
}

export function createGateRuntime(opts: CreateGateRuntimeOptions): GateRuntime {
  const { db, projects, registry, judgement, onMoment, logger } = opts;

  function fireMomentHook(projectId: string, moment: PhaseMoment): void {
    if (!onMoment) return;
    try {
      onMoment(projectId, moment);
    } catch (e) {
      logger?.warn(
        `onMoment hook failed for ${projectId} (${moment}): ${e instanceof Error ? e.message : e}`,
      );
    }
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

  function resolveProject(input: GateDispatchInput): { id: string; repo_path: string } | null {
    if (input.projectId) {
      const p = projects.get(input.projectId);
      return p ? { id: p.id, repo_path: p.repo_path } : null;
    }
    if (input.repoPath) {
      const target = resolvePath(input.repoPath);
      const match = projects
        .list({ includeArchived: true })
        .find((p) => resolvePath(p.repo_path) === target);
      return match ? { id: match.id, repo_path: match.repo_path } : null;
    }
    return null;
  }

  function persist(
    projectId: string,
    moment: PhaseMoment,
    gateId: string,
    status: GateFiring['status'],
    findings: GateFindings,
  ): GateFiring {
    const id = nanoid();
    const createdAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO gate_firings (id, project_id, moment, gate_id, status, findings_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, projectId, moment, gateId, status, JSON.stringify(findings), createdAt);
    appendAudit(db, {
      projectId,
      entityType: 'gate_firing',
      entityId: id,
      actor: 'methodology_runtime',
      field: 'firing',
      newValue: status,
      triggerContext: { moment, gate_id: gateId, status },
    });
    return { id, project_id: projectId, moment, gate_id: gateId, status, findings, created_at: createdAt };
  }

  async function runGates(
    projectId: string,
    repoPath: string,
    moment: PhaseMoment,
  ): Promise<GateFiring[]> {
    const project = projects.get(projectId);
    if (!project) return [];
    const loaded = registry.resolveBundle(project.bundle_id, project.bundle_path);
    if (loaded.status !== 'loaded') return [];
    const gates = loaded.bundle.state_machine.gates_by_moment[moment] ?? [];
    if (gates.length === 0) return [];
    const ctx: CheckContext = {
      bundle: loaded.bundle,
      repoPath,
      citedAnchors: citedAnchors(projectId),
    };
    const out: GateFiring[] = [];
    // Independent per-gate findings streams (T-D42); a partial pass/fail is expected.
    for (const gate of gates) {
      if (gate.kind === 'judgement') {
        const res = await judgement.evaluate({
          gateId: gate.id,
          description: gate.description,
          projectName: project.name,
          stateDigest: stateDigest(projectId, loaded.bundle),
        });
        const firing = persist(projectId, moment, gate.id, res.status, res.findings);
        if (res.telemetry.model && res.telemetry.prompt) {
          appendAudit(db, {
            projectId,
            entityType: 'gate_firing',
            entityId: firing.id,
            actor: 'methodology_runtime',
            field: 'judgement_model',
            newValue: res.telemetry.model,
            triggerContext: {
              model: res.telemetry.model,
              prompt_fingerprint: promptFingerprint('methodology_gate_judgement', res.telemetry.prompt),
            },
          });
        }
        if (
          res.telemetry.model &&
          (res.telemetry.input_tokens > 0 || res.telemetry.output_tokens > 0)
        ) {
          recordCost(db, {
            projectId,
            feature: 'methodology_gate_judgement',
            model: res.telemetry.model,
            inputTokens: res.telemetry.input_tokens,
            outputTokens: res.telemetry.output_tokens,
            usdEstimate: usdEstimate(
              res.telemetry.model,
              res.telemetry.input_tokens,
              res.telemetry.output_tokens,
            ),
          });
        }
        out.push(firing);
      } else {
        const kind = resolveCheckKind(gate.id, gate.description);
        const res = await runMechanicalCheck(kind, ctx, gate.id, gate.description);
        out.push(persist(projectId, moment, gate.id, res.status, res.findings));
      }
    }
    return out;
  }

  async function dispatch(moment: PhaseMoment, input: GateDispatchInput): Promise<GateRunResult> {
    const target = resolveProject(input);
    if (!target) {
      logger?.warn(`gate dispatch ${moment}: no project resolved`);
      return { firings: [] };
    }
    fireMomentHook(target.id, moment);
    const firings = await runGates(target.id, target.repo_path, moment);
    return { firings };
  }

  async function runMoment(projectId: string, moment: PhaseMoment): Promise<GateRunResult> {
    const p = projects.get(projectId);
    if (!p) return { firings: [] };
    fireMomentHook(projectId, moment);
    return { firings: await runGates(projectId, p.repo_path, moment) };
  }

  function listFirings(projectId: string): GateFiringsResult {
    const project = projects.get(projectId);
    if (!project) return { groups: [] };
    const loaded = registry.resolveBundle(project.bundle_id, project.bundle_path);
    if (loaded.status !== 'loaded') return { groups: [] };
    const groups: GateMomentGroup[] = [];
    for (const moment of MOMENTS) {
      const gates = loaded.bundle.state_machine.gates_by_moment[moment] ?? [];
      if (gates.length === 0) continue;
      const firings: GateFiring[] = [];
      for (const gate of gates) {
        const row = db
          .prepare(
            `SELECT * FROM gate_firings
              WHERE project_id = ? AND moment = ? AND gate_id = ?
              ORDER BY created_at DESC LIMIT 1`,
          )
          .get(projectId, moment, gate.id) as GateFiringRow | undefined;
        if (row) firings.push(rowToFiring(row));
      }
      groups.push({ moment, firings });
    }
    return { groups };
  }

  function override(projectId: string, firingId: string, reason: string): GateFiring | null {
    const row = db
      .prepare(`SELECT * FROM gate_firings WHERE id = ? AND project_id = ?`)
      .get(firingId, projectId) as GateFiringRow | undefined;
    if (!row) return null;
    const findings = JSON.parse(row.findings_json) as GateFindings;
    const at = new Date().toISOString();
    findings.override = { reason, original_findings_ref: row.id, at };
    db.prepare(`UPDATE gate_firings SET findings_json = ? WHERE id = ?`).run(
      JSON.stringify(findings),
      row.id,
    );
    appendAudit(db, {
      projectId,
      entityType: 'gate_firing',
      entityId: row.id,
      actor: 'user',
      field: 'override',
      oldValue: row.status,
      newValue: 'overridden',
      triggerContext: {
        moment: row.moment,
        gate_id: row.gate_id,
        override_reason: reason,
        original_findings_ref: row.id,
      },
    });
    return rowToFiring({ ...row, findings_json: JSON.stringify(findings) });
  }

  function onItemStatusTransition(projectId: string): void {
    // Best-effort, non-blocking — an item transition is the internal per-commit trigger.
    void runMoment(projectId, 'per-commit').catch((e) =>
      logger?.warn(`per-commit dispatch failed for ${projectId}: ${e instanceof Error ? e.message : e}`),
    );
  }

  return { dispatch, runMoment, listFirings, override, onItemStatusTransition };
}
