import { nanoid } from 'nanoid';
import type {
  ApplyRequest,
  ApplyResult,
  DumpZoneProposal,
  ProposalPayload,
  ProposalSource,
  ProposalTarget,
} from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import { promptFingerprint } from '../ai/fingerprint.js';
import { usdEstimate } from '../ai/pricing.js';
import type { DB } from '../db/index.js';
import type { ItemsService } from '../items/service.js';
import type { LibraryService } from '../library/service.js';
import type { MethodologyRegistry } from '../methodology/loader.js';
import type { ProjectsService } from '../projects/service.js';
import { bundleItemPolicy } from '../items/policy.js';
import { recordCost } from '../cost/telemetry.js';
import type { Extractor } from './extractor.js';

// Dump-zone service. Propose() runs the bundle-aware extractor against the input text, writes
// a row into proposed_extractions, audit-logs the extraction (with prompt fingerprint per
// T-D24 + cost telemetry per T-D29 when AI was used), and returns the typed proposal for the
// review modal. Apply() validates the (possibly user-edited) payload against the bundle's
// item policy, writes items / library entries, audits each one, and marks the proposal
// applied.

const RECENT_PROPOSALS_DEFAULT_LIMIT = 50;

interface ProposalRow {
  id: string;
  project_id: string;
  target: ProposalTarget;
  source: ProposalSource;
  extractor: 'anthropic' | 'heuristic';
  raw_text: string;
  payload_json: string;
  status: 'pending' | 'applied' | 'discarded';
  created_at: string;
  resolved_at: string | null;
}

function rowToProposal(row: ProposalRow): DumpZoneProposal {
  return {
    id: row.id,
    project_id: row.project_id,
    target: row.target,
    source: row.source,
    extractor: row.extractor,
    raw_text: row.raw_text,
    payload: JSON.parse(row.payload_json) as ProposalPayload,
    status: row.status,
    created_at: row.created_at,
    resolved_at: row.resolved_at,
  };
}

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`project ${id} not found`);
  }
}

export class ProposalNotFoundError extends Error {
  constructor(id: string) {
    super(`proposal ${id} not found`);
  }
}

export class ProposalStateError extends Error {
  constructor(id: string, state: string) {
    super(`proposal ${id} is ${state}, cannot apply`);
  }
}

export interface ProposeInput {
  project_id: string;
  text: string;
  target: ProposalTarget;
  source: ProposalSource;
  session_id: string | null;
}

export interface DumpZoneService {
  propose(input: ProposeInput): Promise<DumpZoneProposal>;
  get(id: string): DumpZoneProposal | null;
  listRecent(projectId: string, limit?: number): DumpZoneProposal[];
  apply(input: ApplyRequest): ApplyResult;
  discard(id: string): void;
}

interface CreateOptions {
  db: DB;
  projects: ProjectsService;
  registry: MethodologyRegistry;
  items: ItemsService;
  library: LibraryService;
  extractor: Extractor;
  // Phase 10 (T-D21 tier-4) — fired with each proposed item's text at propose time so the
  // code-drift dedup scanner can flag duplicate-looking entries against done items.
  // Best-effort; never blocks extraction.
  onProposedItems?: (
    projectId: string,
    items: Array<{ title: string; description: string }>,
  ) => void;
}

export function createDumpZoneService(opts: CreateOptions): DumpZoneService {
  const { db, projects, registry, items, library, extractor, onProposedItems } = opts;

  function getRow(id: string): ProposalRow | null {
    const row = db.prepare('SELECT * FROM proposed_extractions WHERE id = ?').get(id) as
      | ProposalRow
      | undefined;
    return row ?? null;
  }

  return {
    async propose(input) {
      const project = projects.get(input.project_id);
      if (!project) throw new ProjectNotFoundError(input.project_id);
      const bundleResult = registry.resolveBundle(project.bundle_id, project.bundle_path);
      if (bundleResult.status !== 'loaded') {
        throw new Error(`bundle "${project.bundle_id}" not loaded`);
      }
      const policy = bundleItemPolicy(bundleResult.bundle);
      const extraction = await extractor.extract({
        project_id: project.id,
        text: input.text,
        target: input.target,
        source: input.source,
        bundle: bundleResult.bundle,
        policy,
        suggested_session_id: input.session_id,
      });
      const id = nanoid();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO proposed_extractions
          (id, project_id, target, source, extractor, raw_text, payload_json, status, created_at, resolved_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL)`,
      ).run(
        id,
        project.id,
        input.target,
        input.source,
        extraction.payload.extractor,
        input.text,
        JSON.stringify(extraction.payload),
        now,
      );
      const actor = extraction.payload.extractor === 'anthropic' ? 'ai' : 'system';
      const triggerContext: Record<string, unknown> = {
        source: input.source,
        target: input.target,
        extractor: extraction.payload.extractor,
        item_count: extraction.payload.items.length,
        library_count: extraction.payload.library.length,
      };
      if (extraction.telemetry.model) {
        triggerContext.model = extraction.telemetry.model;
      }
      if (extraction.telemetry.prompt) {
        triggerContext.prompt_fingerprint = promptFingerprint(
          'dump_zone_extraction',
          extraction.telemetry.prompt,
        );
      }
      appendAudit(db, {
        projectId: project.id,
        entityType: 'project',
        entityId: project.id,
        actor,
        field: 'dump_zone_propose',
        newValue: id,
        triggerContext,
      });
      if (extraction.telemetry.model && (extraction.telemetry.input_tokens > 0 || extraction.telemetry.output_tokens > 0)) {
        recordCost(db, {
          projectId: project.id,
          feature: 'dump_zone_extraction',
          model: extraction.telemetry.model,
          inputTokens: extraction.telemetry.input_tokens,
          outputTokens: extraction.telemetry.output_tokens,
          usdEstimate: usdEstimate(
            extraction.telemetry.model,
            extraction.telemetry.input_tokens,
            extraction.telemetry.output_tokens,
          ),
        });
      }
      if (onProposedItems && extraction.payload.items.length > 0) {
        try {
          onProposedItems(
            project.id,
            extraction.payload.items.map((it) => ({
              title: it.title,
              description: it.description,
            })),
          );
        } catch {
          /* tier-4 dedup is best-effort; never block extraction */
        }
      }
      return rowToProposal(getRow(id)!);
    },

    get(id) {
      const row = getRow(id);
      return row ? rowToProposal(row) : null;
    },

    listRecent(projectId, limit = RECENT_PROPOSALS_DEFAULT_LIMIT) {
      const rows = db
        .prepare(
          `SELECT * FROM proposed_extractions
            WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`,
        )
        .all(projectId, limit) as ProposalRow[];
      return rows.map(rowToProposal);
    },

    apply(req) {
      const row = getRow(req.proposal_id);
      if (!row) throw new ProposalNotFoundError(req.proposal_id);
      if (row.status !== 'pending') throw new ProposalStateError(row.id, row.status);
      const project = projects.get(row.project_id);
      if (!project) throw new ProjectNotFoundError(row.project_id);
      const decisions = req.decisions ?? {};
      const applied_item_ids: string[] = [];
      const applied_library_entry_ids: string[] = [];

      // Re-validate every proposed item against the bundle's policy at apply time. The user
      // might have edited type/status fields in the modal; the policy is the contract.
      for (const proposed of req.payload.items) {
        if (decisions[proposed.proposal_item_id] === 'discard') continue;
        const item = items.create({
          project_id: row.project_id,
          type: proposed.type,
          status: proposed.status,
          title: proposed.title,
          description: proposed.description,
          tags: proposed.tags,
          session_ids: proposed.target_session_id ? [proposed.target_session_id] : [],
        });
        applied_item_ids.push(item.id);
      }
      for (const entry of req.payload.library) {
        if (decisions[entry.proposal_item_id] === 'discard') continue;
        const created = library.create({
          project_id: row.project_id,
          type: entry.type,
          title: entry.title,
          body: entry.body,
          tags: entry.tags,
        });
        applied_library_entry_ids.push(created.id);
      }
      const now = new Date().toISOString();
      db.prepare(
        `UPDATE proposed_extractions SET status = 'applied', resolved_at = ?, payload_json = ? WHERE id = ?`,
      ).run(now, JSON.stringify(req.payload), row.id);
      appendAudit(db, {
        projectId: row.project_id,
        entityType: 'project',
        entityId: row.project_id,
        actor: 'user',
        field: 'dump_zone_apply',
        oldValue: row.id,
        newValue: JSON.stringify({
          items: applied_item_ids,
          library: applied_library_entry_ids,
        }),
        triggerContext: { proposal_id: row.id, target: row.target, source: row.source },
      });
      return { applied_item_ids, applied_library_entry_ids };
    },

    discard(id) {
      const row = getRow(id);
      if (!row) return;
      if (row.status !== 'pending') return;
      const now = new Date().toISOString();
      db.prepare(
        `UPDATE proposed_extractions SET status = 'discarded', resolved_at = ? WHERE id = ?`,
      ).run(now, id);
      appendAudit(db, {
        projectId: row.project_id,
        entityType: 'project',
        entityId: row.project_id,
        actor: 'user',
        field: 'dump_zone_discard',
        oldValue: id,
      });
    },
  };
}
