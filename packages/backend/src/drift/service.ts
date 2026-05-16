import { nanoid } from 'nanoid';
import type { DisciplineDriftResult, DisciplineDriftSignal } from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';

// Drift signals (T-D21). Phase 5 is the first producer (contradicted-as-drift from the
// reconcile engine per T-D35). Phase 9 adds the discipline-drift stream (C-D7); Phase 10
// adds code-drift tiers 1/3/4; Phase 11 (Semble) wires tier-3 once code refs exist.
//
// Code-drift writes stay deliberately small (insert + audit). Discipline-drift adds an
// idempotent open/dismiss lifecycle so re-running a scanner does not pile up duplicate
// rows, plus the surfacing queries the gates view / modules view / item rows consume.

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

export interface DisciplineSignalInput {
  projectId: string;
  category: string;
  itemId: string | null;
  primaryUnitRef: string | null;
  reason: string;
  payload?: Record<string, unknown>;
}

export interface OpenDisciplineSignal {
  id: string;
  category: string;
  item_id: string | null;
  primary_unit_ref: string | null;
  reason: string;
}

export interface DriftService {
  hasPrAssociation(itemId: string): boolean;
  createCodeSignal(input: CodeDriftSignalInput): string;
  // Discipline-drift (C-D7). Open = stream='discipline' AND dismissed_at IS NULL.
  createDisciplineSignal(input: DisciplineSignalInput): string;
  listOpenDisciplineSignals(projectId: string, category?: string): OpenDisciplineSignal[];
  dismissSignal(id: string, reason: string): void;
  disciplineGroups(projectId: string): DisciplineDriftResult;
  // Modules view (SPEC §7.14): a primary unit is "in drift" when a signal carries its ref
  // explicitly or is scoped to an item that belongs to it.
  disciplineCountsByPrimaryUnit(projectId: string): Map<string, number>;
  // Item rows / detail panel: an item inherits the indicator when a signal is scoped to it
  // directly or to one of its primary units.
  itemIdsWithDisciplineDrift(projectId: string): Set<string>;
}

// Item ids that inherit the discipline-drift indicator: scoped to the item directly, or
// to one of its primary units (SPEC §7.14). Exported so the items service can hydrate the
// derived `methodology_drift` flag without taking a DriftService dependency.
export function disciplineDriftItemIds(db: DB, projectId: string): Set<string> {
  const rows = db
    .prepare(
      `SELECT ds.item_id AS item_id
         FROM drift_signals ds
        WHERE ds.project_id = ? AND ds.stream = 'discipline'
          AND ds.dismissed_at IS NULL AND ds.item_id IS NOT NULL
       UNION
       SELECT r.item_id AS item_id
         FROM drift_signals ds
         JOIN item_primary_unit_refs r ON r.primary_unit_ref = ds.primary_unit_ref
         JOIN items i ON i.id = r.item_id AND i.project_id = ds.project_id
        WHERE ds.project_id = ? AND ds.stream = 'discipline'
          AND ds.dismissed_at IS NULL AND ds.primary_unit_ref IS NOT NULL`,
    )
    .all(projectId, projectId) as Array<{ item_id: string }>;
  return new Set(rows.map((r) => r.item_id));
}

// Open discipline-signal count per primary-unit ref (SPEC §7.14 modules badges). UNION
// dedups (signal, ref) pairs so an item with N units counts a signal once per unit.
// Exported so the items service can decorate ModuleSummary without a DriftService dep.
export function disciplineCountsByPrimaryUnit(db: DB, projectId: string): Map<string, number> {
  const rows = db
    .prepare(
      `SELECT ref, COUNT(*) AS n FROM (
         SELECT ds.id AS sid, ds.primary_unit_ref AS ref
           FROM drift_signals ds
          WHERE ds.project_id = ? AND ds.stream = 'discipline'
            AND ds.dismissed_at IS NULL AND ds.primary_unit_ref IS NOT NULL
         UNION
         SELECT ds.id AS sid, r.primary_unit_ref AS ref
           FROM drift_signals ds
           JOIN item_primary_unit_refs r ON r.item_id = ds.item_id
          WHERE ds.project_id = ? AND ds.stream = 'discipline'
            AND ds.dismissed_at IS NULL AND ds.item_id IS NOT NULL
       )
       GROUP BY ref`,
    )
    .all(projectId, projectId) as Array<{ ref: string; n: number }>;
  return new Map(rows.map((r) => [r.ref, r.n]));
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

    createDisciplineSignal(input) {
      const id = nanoid();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO drift_signals
          (id, project_id, stream, category, item_id, primary_unit_ref, reason, payload_json, created_at)
          VALUES (?, ?, 'discipline', ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        input.projectId,
        input.category,
        input.itemId,
        input.primaryUnitRef,
        input.reason,
        JSON.stringify(input.payload ?? {}),
        now,
      );
      appendAudit(db, {
        projectId: input.projectId,
        entityType: 'project',
        entityId: input.projectId,
        actor: 'methodology_runtime',
        field: 'drift_signal_create',
        newValue: id,
        triggerContext: {
          stream: 'discipline',
          category: input.category,
          item_id: input.itemId,
          primary_unit_ref: input.primaryUnitRef,
        },
      });
      return id;
    },

    listOpenDisciplineSignals(projectId, category) {
      const rows = category
        ? db
            .prepare(
              `SELECT id, category, item_id, primary_unit_ref, reason
                 FROM drift_signals
                WHERE project_id = ? AND stream = 'discipline'
                  AND dismissed_at IS NULL AND category = ?
                ORDER BY created_at`,
            )
            .all(projectId, category)
        : db
            .prepare(
              `SELECT id, category, item_id, primary_unit_ref, reason
                 FROM drift_signals
                WHERE project_id = ? AND stream = 'discipline' AND dismissed_at IS NULL
                ORDER BY created_at`,
            )
            .all(projectId);
      return rows as OpenDisciplineSignal[];
    },

    dismissSignal(id, reason) {
      const row = db
        .prepare(`SELECT project_id, category FROM drift_signals WHERE id = ?`)
        .get(id) as { project_id: string; category: string } | undefined;
      if (!row) return;
      db.prepare(
        `UPDATE drift_signals SET dismissed_at = ?, dismiss_reason = ?
          WHERE id = ? AND dismissed_at IS NULL`,
      ).run(new Date().toISOString(), reason, id);
      appendAudit(db, {
        projectId: row.project_id,
        entityType: 'project',
        entityId: row.project_id,
        actor: 'methodology_runtime',
        field: 'drift_signal_dismiss',
        newValue: id,
        triggerContext: { category: row.category, dismiss_reason: reason },
      });
    },

    disciplineGroups(projectId) {
      const rows = db
        .prepare(
          `SELECT id, project_id, category, item_id, primary_unit_ref, reason, created_at
             FROM drift_signals
            WHERE project_id = ? AND stream = 'discipline' AND dismissed_at IS NULL
            ORDER BY category, created_at`,
        )
        .all(projectId) as DisciplineDriftSignal[];
      const byCategory = new Map<string, DisciplineDriftSignal[]>();
      for (const r of rows) {
        const arr = byCategory.get(r.category) ?? [];
        arr.push(r);
        byCategory.set(r.category, arr);
      }
      return {
        groups: Array.from(byCategory.entries()).map(([category, signals]) => ({
          category,
          signals,
        })),
      };
    },

    disciplineCountsByPrimaryUnit(projectId) {
      return disciplineCountsByPrimaryUnit(db, projectId);
    },

    itemIdsWithDisciplineDrift(projectId) {
      return disciplineDriftItemIds(db, projectId);
    },
  };
}
