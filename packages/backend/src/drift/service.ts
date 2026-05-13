import { nanoid } from 'nanoid';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';

// Drift signals (T-D21). Phase 5 is the first producer (contradicted-as-drift from the
// reconcile engine per T-D35). Phase 9 (discipline-drift) and Phase 10 (code-drift tiers
// 1/3/4) will extend this surface; Phase 11 (Semble) wires tier-3 once code refs exist.
//
// Keep the helper deliberately small in v1: it inserts a row, audit-logs the creation,
// and returns the new id. Re-verify / dismiss / surface APIs land with their consuming
// phases.

export type DriftStream = 'code' | 'discipline';

// Code-drift categories per T-D21 + CODE_SPEC §9 table. Phase 5 produces tier-2 / tier-3.
// Phase 10 produces tier-1 / tier-4. Discipline-drift categories come from the bundle and
// land in Phase 9 — we treat them as opaque strings here.
export type CodeDriftCategory = 'tier-1' | 'tier-2' | 'tier-3' | 'tier-4';

export interface CodeDriftSignalInput {
  projectId: string;
  itemId: string | null;
  category: CodeDriftCategory;
  reason: string;
  payload?: Record<string, unknown>;
}

export interface DriftService {
  hasPrAssociation(itemId: string): boolean;
  createCodeSignal(input: CodeDriftSignalInput): string;
}

export function createDriftService(db: DB): DriftService {
  return {
    hasPrAssociation(itemId) {
      const row = db
        .prepare('SELECT 1 FROM item_pr_associations WHERE item_id = ? LIMIT 1')
        .get(itemId);
      return row !== undefined;
    },
    createCodeSignal(input) {
      const id = nanoid();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO drift_signals
          (id, project_id, stream, category, item_id, primary_unit_ref, reason, payload_json, created_at)
          VALUES (?, ?, 'code', ?, ?, NULL, ?, ?, ?)`,
      ).run(
        id,
        input.projectId,
        input.category,
        input.itemId,
        input.reason,
        JSON.stringify(input.payload ?? {}),
        now,
      );
      appendAudit(db, {
        projectId: input.projectId,
        entityType: 'project',
        entityId: input.projectId,
        actor: 'system',
        field: 'drift_signal_create',
        newValue: id,
        triggerContext: {
          stream: 'code',
          category: input.category,
          item_id: input.itemId,
        },
      });
      return id;
    },
  };
}
