import { nanoid } from 'nanoid';
import type {
  BundleLoadResult,
  CreateItemInput,
  Item,
  ItemLinks,
  ItemLinkSummary,
  ItemPolicy,
  ModulesResult,
  ModuleSummary,
  UpdateItemInput,
} from '@throughline/shared';
import { ItemNotFoundError, ProjectNotFoundError } from '@throughline/shared';
import { DomainError } from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import {
  codeDriftTierByItem,
  disciplineCountsByPrimaryUnit,
  disciplineDriftItemIds,
  itemHasDisciplineDrift,
  itemStrongestCodeTier,
} from '../drift/service.js';
import type { DB } from '../db/index.js';
import type { MethodologyRegistry } from '../methodology/loader.js';
import type { ProjectsService } from '../projects/service.js';
import { parseMentionRefs } from './mentions.js';
import { bundleItemPolicy } from './policy.js';

interface ItemRow {
  id: string;
  project_id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  blocker_text: string | null;
  parent_id: string | null;
  branch_ref: string | null;
  created_at: string;
  updated_at: string;
}

export class ItemPolicyError extends DomainError {
  constructor(message: string, public field: 'type' | 'status') {
    super(message, { statusCode: 400, code: 'policy_violation' });
  }
}

export class BlockerCycleError extends DomainError {
  constructor() {
    super('blocker would form a cycle', { statusCode: 400, code: 'cycle' });
  }
}

export interface ListItemsFilter {
  project_id: string;
  session_id?: string;
  parent_id?: string | null;
}

export interface ItemsService {
  policy(projectId: string): ItemPolicy;
  modules(projectId: string): ModulesResult;
  list(filter: ListItemsFilter): Item[];
  get(id: string): Item | null;
  links(id: string): ItemLinks | null;
  create(input: CreateItemInput): Item;
  update(id: string, input: UpdateItemInput): Item;
  delete(id: string): void;
  addTag(id: string, tag: string): void;
  removeTag(id: string, tag: string): void;
  addBlocker(id: string, blockedById: string): void;
  removeBlocker(id: string, blockedById: string): void;
  addSessionMembership(id: string, sessionId: string): void;
  removeSessionMembership(id: string, sessionId: string): void;
}

interface ItemChildren {
  tagsById: Map<string, string[]>;
  blockersById: Map<string, string[]>;
  mentionsById: Map<string, string[]>;
  sessionsById: Map<string, string[]>;
  primaryUnitsById: Map<string, string[]>;
  phasesById: Map<string, string[]>;
  anchorsById: Map<string, string[]>;
  markersById: Map<string, string[]>;
}

// (table, column) for the four methodology-context join tables (SPEC §7.4, T-D39, C-D12).
const CONTEXT_TABLES = [
  { table: 'item_primary_unit_refs', col: 'primary_unit_ref', key: 'primaryUnitsById' },
  { table: 'item_phase_refs', col: 'phase_id', key: 'phasesById' },
  { table: 'item_anchor_citations', col: 'anchor_id', key: 'anchorsById' },
  { table: 'item_marker_refs', col: 'marker_id', key: 'markersById' },
] as const;

// Batch-fetch all child rows for a set of item ids in three queries total, then index
// them by item_id. Convention: list-shape methods batch their child queries via
// WHERE item_id IN (...), not per-row loops. Avoids the N+1 pattern propagating to
// sessions list / library list / etc. in future phases.
function loadItemChildren(db: DB, ids: string[]): ItemChildren {
  if (ids.length === 0) {
    return {
      tagsById: new Map(),
      blockersById: new Map(),
      mentionsById: new Map(),
      sessionsById: new Map(),
      primaryUnitsById: new Map(),
      phasesById: new Map(),
      anchorsById: new Map(),
      markersById: new Map(),
    };
  }
  const placeholders = ids.map(() => '?').join(',');
  const tagsById = new Map<string, string[]>();
  const blockersById = new Map<string, string[]>();
  const mentionsById = new Map<string, string[]>();
  const sessionsById = new Map<string, string[]>();
  const contextMaps: Record<string, Map<string, string[]>> = {
    primaryUnitsById: new Map(),
    phasesById: new Map(),
    anchorsById: new Map(),
    markersById: new Map(),
  };
  for (const { table, col, key } of CONTEXT_TABLES) {
    const rows = db
      .prepare(`SELECT item_id, ${col} AS val FROM ${table} WHERE item_id IN (${placeholders}) ORDER BY ${col}`)
      .all(...ids) as Array<{ item_id: string; val: string }>;
    const map = contextMaps[key]!;
    for (const r of rows) {
      const arr = map.get(r.item_id) ?? [];
      arr.push(r.val);
      map.set(r.item_id, arr);
    }
  }
  const tagRows = db
    .prepare(`SELECT item_id, tag FROM item_tags WHERE item_id IN (${placeholders}) ORDER BY tag`)
    .all(...ids) as Array<{ item_id: string; tag: string }>;
  for (const r of tagRows) {
    const arr = tagsById.get(r.item_id) ?? [];
    arr.push(r.tag);
    tagsById.set(r.item_id, arr);
  }
  const blockerRows = db
    .prepare(`SELECT item_id, blocked_by_item_id FROM item_blockers WHERE item_id IN (${placeholders})`)
    .all(...ids) as Array<{ item_id: string; blocked_by_item_id: string }>;
  for (const r of blockerRows) {
    const arr = blockersById.get(r.item_id) ?? [];
    arr.push(r.blocked_by_item_id);
    blockersById.set(r.item_id, arr);
  }
  const mentionRows = db
    .prepare(`SELECT item_id, mentions_item_id FROM item_mentions WHERE item_id IN (${placeholders})`)
    .all(...ids) as Array<{ item_id: string; mentions_item_id: string }>;
  for (const r of mentionRows) {
    const arr = mentionsById.get(r.item_id) ?? [];
    arr.push(r.mentions_item_id);
    mentionsById.set(r.item_id, arr);
  }
  const sessionRows = db
    .prepare(`SELECT item_id, session_id FROM item_session_memberships WHERE item_id IN (${placeholders})`)
    .all(...ids) as Array<{ item_id: string; session_id: string }>;
  for (const r of sessionRows) {
    const arr = sessionsById.get(r.item_id) ?? [];
    arr.push(r.session_id);
    sessionsById.set(r.item_id, arr);
  }
  return {
    tagsById,
    blockersById,
    mentionsById,
    sessionsById,
    primaryUnitsById: contextMaps['primaryUnitsById']!,
    phasesById: contextMaps['phasesById']!,
    anchorsById: contextMaps['anchorsById']!,
    markersById: contextMaps['markersById']!,
  };
}

function rowToItemWithChildren(
  row: ItemRow,
  children: ItemChildren,
  drifted: Set<string>,
  codeTierById: Map<string, 'tier-1' | 'tier-2' | 'tier-3'>,
): Item {
  return {
    id: row.id,
    project_id: row.project_id,
    type: row.type,
    title: row.title,
    description: row.description,
    status: row.status,
    blocker_text: row.blocker_text,
    parent_id: row.parent_id,
    branch_ref: row.branch_ref,
    tags: children.tagsById.get(row.id) ?? [],
    blockers: children.blockersById.get(row.id) ?? [],
    mentions: children.mentionsById.get(row.id) ?? [],
    session_ids: children.sessionsById.get(row.id) ?? [],
    methodology_context: {
      primary_unit_refs: children.primaryUnitsById.get(row.id) ?? [],
      phase_refs: children.phasesById.get(row.id) ?? [],
      anchor_citations: children.anchorsById.get(row.id) ?? [],
      marker_refs: children.markersById.get(row.id) ?? [],
    },
    methodology_drift: drifted.has(row.id),
    code_drift_tier: codeTierById.get(row.id) ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToItem(db: DB, row: ItemRow): Item {
  // Single-item path: targeted EXISTS, not the whole-project drift set (the list path
  // still batches via disciplineDriftItemIds).
  const drifted = itemHasDisciplineDrift(db, row.id) ? new Set([row.id]) : new Set<string>();
  const tier = itemStrongestCodeTier(db, row.id);
  const codeTierById = tier ? new Map([[row.id, tier]]) : new Map<string, never>();
  return rowToItemWithChildren(row, loadItemChildren(db, [row.id]), drifted, codeTierById);
}

function bundleFor(
  registry: MethodologyRegistry,
  bundleId: string,
  bundlePath: string | null,
  repoPath: string | null,
): BundleLoadResult {
  return registry.resolveBundle(bundleId, bundlePath, repoPath);
}

function policyFor(
  registry: MethodologyRegistry,
  bundleId: string,
  bundlePath: string | null,
  repoPath: string | null,
): ItemPolicy {
  const r = bundleFor(registry, bundleId, bundlePath, repoPath);
  if (r.status !== 'loaded') {
    throw new Error(`bundle "${bundleId}" failed to load`);
  }
  return bundleItemPolicy(r.bundle);
}

// C-D13 — tier classification is bundle-driven. The primary unit's `tier_rules` string
// declares ordered bands of the form `<tier> <=<n> items; <tier> ><n> items`. The first
// satisfied band (by member-item count) wins; an unparseable / empty rule yields 'untiered'.
function classifyTier(tierRules: string, itemCount: number): string {
  for (const part of tierRules.split(';')) {
    const m = /^\s*(.+?)\s*(<=|>=|<|>|=)\s*(\d+)\s*items?\s*$/i.exec(part.trim());
    if (!m) continue;
    const [, name, op, nRaw] = m;
    const n = Number(nRaw);
    const ok =
      op === '<=' ? itemCount <= n
      : op === '>=' ? itemCount >= n
      : op === '<' ? itemCount < n
      : op === '>' ? itemCount > n
      : itemCount === n;
    if (ok) return name!.trim();
  }
  return 'untiered';
}

// Phase 8 — an item state transition is the internal per-commit gate trigger
// (SPEC §7.12); same gate as the git pre-commit hook. Best-effort, never blocks.
export interface ItemsServiceHooks {
  onStatusTransition?: (projectId: string, itemId: string) => void;
  // Phase 10 (T-D33) — fired BEFORE the row is deleted (and its item_verifier_rules
  // cascade away) so the orphan-rule tracker can snapshot the rules. Best-effort.
  onDelete?: (projectId: string, itemId: string) => void;
}

export function createItemsService(
  db: DB,
  projects: ProjectsService,
  registry: MethodologyRegistry,
  hooks: ItemsServiceHooks = {},
): ItemsService {
  function touch(id: string): void {
    db.prepare('UPDATE items SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  }

  function getRow(id: string): ItemRow | null {
    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as ItemRow | undefined;
    return row ?? null;
  }

  // Methodology-context join tables (C-D12). Each provided field fully replaces that
  // dimension's rows; an undefined field is left untouched (PATCH semantics).
  function writeContext(
    itemId: string,
    ctx:
      | Partial<{
          primary_unit_refs: string[];
          phase_refs: string[];
          anchor_citations: string[];
          marker_refs: string[];
        }>
      | undefined,
  ): void {
    if (!ctx) return;
    const dims = [
      { table: 'item_primary_unit_refs', col: 'primary_unit_ref', values: ctx.primary_unit_refs },
      { table: 'item_phase_refs', col: 'phase_id', values: ctx.phase_refs },
      { table: 'item_anchor_citations', col: 'anchor_id', values: ctx.anchor_citations },
      { table: 'item_marker_refs', col: 'marker_id', values: ctx.marker_refs },
    ] as const;
    for (const { table, col, values } of dims) {
      if (values === undefined) continue;
      db.prepare(`DELETE FROM ${table} WHERE item_id = ?`).run(itemId);
      for (const v of values) {
        if (v.trim().length === 0) continue;
        db.prepare(`INSERT OR IGNORE INTO ${table} (item_id, ${col}) VALUES (?, ?)`).run(itemId, v);
      }
    }
  }

  // Phase 17 (SPEC §7.11, §7.17; WN-1b-a). Resolve the @item:<id> tokens in a
  // description to live same-project item ids, dropping self-refs and refs that
  // don't resolve (silently — same lenient treatment as out-of-set blocker refs
  // in the graph layout). First-seen order preserved.
  function resolveMentions(itemId: string, projectId: string, description: string): string[] {
    const resolved: string[] = [];
    for (const ref of parseMentionRefs(description)) {
      if (ref === itemId) continue;
      const row = getRow(ref);
      if (row && row.project_id === projectId) resolved.push(ref);
    }
    return resolved;
  }

  function currentMentions(itemId: string): string[] {
    return (
      db
        .prepare('SELECT mentions_item_id FROM item_mentions WHERE item_id = ? ORDER BY mentions_item_id')
        .all(itemId) as Array<{ mentions_item_id: string }>
    ).map((r) => r.mentions_item_id);
  }

  // Rewrite the mention projection only when it actually changed — a description
  // edit that doesn't touch any @item: token issues no DELETE/INSERT and no
  // audit entry. Returns the prior set when it rewrote, null when unchanged.
  function syncMentions(itemId: string, projectId: string, description: string): string[] | null {
    const before = currentMentions(itemId);
    const next = resolveMentions(itemId, projectId, description);
    const a = [...before].sort();
    const b = [...next].sort();
    if (a.length === b.length && a.every((v, i) => v === b[i])) return null;
    db.prepare('DELETE FROM item_mentions WHERE item_id = ?').run(itemId);
    for (const m of next) {
      db.prepare('INSERT OR IGNORE INTO item_mentions (item_id, mentions_item_id) VALUES (?, ?)').run(
        itemId,
        m,
      );
    }
    return before;
  }

  return {
    policy(projectId) {
      const project = projects.get(projectId);
      if (!project) throw new ProjectNotFoundError(projectId);
      return policyFor(registry, project.bundle_id, project.bundle_path, project.repo_path);
    },

    modules(projectId) {
      const project = projects.get(projectId);
      if (!project) throw new ProjectNotFoundError(projectId);
      const loaded = bundleFor(registry, project.bundle_id, project.bundle_path, project.repo_path);
      if (loaded.status !== 'loaded') throw new Error(`bundle "${project.bundle_id}" failed to load`);
      const primaryUnit = loaded.bundle.project_layout.primary_unit;
      if (!primaryUnit) {
        return { primary_unit_label: null, modules: [] };
      }
      const counts = db
        .prepare(
          `SELECT r.primary_unit_ref AS ref, COUNT(DISTINCT r.item_id) AS item_count
             FROM item_primary_unit_refs r
             JOIN items i ON i.id = r.item_id
            WHERE i.project_id = ?
            GROUP BY r.primary_unit_ref
            ORDER BY r.primary_unit_ref`,
        )
        .all(projectId) as Array<{ ref: string; item_count: number }>;
      // One grouped query per context dimension (not per primary unit) — same WHERE-grouped
      // batching convention as Phase 3's loadItemChildren. Total: 1 counts + 3 dimension
      // queries, independent of the number of primary units.
      const distinctByRef = (table: string, col: string): Map<string, string[]> => {
        const rows = db
          .prepare(
            `SELECT DISTINCT r.primary_unit_ref AS ref, t.${col} AS val
               FROM ${table} t
               JOIN items i ON i.id = t.item_id
               JOIN item_primary_unit_refs r ON r.item_id = i.id
              WHERE i.project_id = ?
              ORDER BY r.primary_unit_ref, t.${col}`,
          )
          .all(projectId) as Array<{ ref: string; val: string }>;
        const map = new Map<string, string[]>();
        for (const row of rows) {
          const arr = map.get(row.ref) ?? [];
          arr.push(row.val);
          map.set(row.ref, arr);
        }
        return map;
      };
      const phasesByRef = distinctByRef('item_phase_refs', 'phase_id');
      const anchorsByRef = distinctByRef('item_anchor_citations', 'anchor_id');
      const markersByRef = distinctByRef('item_marker_refs', 'marker_id');
      const driftByRef = disciplineCountsByPrimaryUnit(db, projectId);
      const modules: ModuleSummary[] = counts.map((c) => ({
        ref: c.ref,
        item_count: c.item_count,
        phases: phasesByRef.get(c.ref) ?? [],
        anchor_count: (anchorsByRef.get(c.ref) ?? []).length,
        marker_count: (markersByRef.get(c.ref) ?? []).length,
        tier: classifyTier(primaryUnit.tier_rules, c.item_count),
        drift_signal_count: driftByRef.get(c.ref) ?? 0,
      }));
      return { primary_unit_label: primaryUnit.name, modules };
    },

    list({ project_id, session_id, parent_id }) {
      const joinParams: unknown[] = [];
      const filterParams: unknown[] = [project_id];
      const filters: string[] = ['i.project_id = ?'];
      let joins = '';
      if (session_id !== undefined) {
        joins = ' INNER JOIN item_session_memberships m ON m.item_id = i.id AND m.session_id = ?';
        joinParams.push(session_id);
      }
      if (parent_id === null) filters.push('i.parent_id IS NULL');
      else if (parent_id !== undefined) {
        filters.push('i.parent_id = ?');
        filterParams.push(parent_id);
      }
      const sql = `SELECT i.* FROM items i${joins} WHERE ${filters.join(' AND ')} ORDER BY i.created_at ASC`;
      const rows = db.prepare(sql).all(...joinParams, ...filterParams) as ItemRow[];
      const children = loadItemChildren(db, rows.map((r) => r.id));
      const drifted = disciplineDriftItemIds(db, project_id);
      const codeTierById = codeDriftTierByItem(db, project_id);
      return rows.map((r) => rowToItemWithChildren(r, children, drifted, codeTierById));
    },

    get(id) {
      const row = getRow(id);
      return row ? rowToItem(db, row) : null;
    },

    // Phase 17 (SPEC §7.17) — the four "Linked items" relations. The detail
    // panel fetches a single item and can't compute reverse relations
    // (children, mentioning) itself. parents/children from parent_id;
    // mentioned/mentioning from the item_mentions projection. Deterministic
    // order (created_at, id) so the panel render is stable.
    links(id) {
      const row = getRow(id);
      if (!row) return null;
      const summary = (r: ItemRow): ItemLinkSummary => ({
        id: r.id,
        title: r.title,
        type: r.type,
        status: r.status,
      });
      // Batch the row fetch via WHERE id IN (...) — same convention as
      // loadItemChildren; ORDER BY makes the (created_at, id) order the single
      // source of truth (no redundant JS re-sort).
      const byIds = (ids: string[]): ItemLinkSummary[] => {
        if (ids.length === 0) return [];
        const placeholders = ids.map(() => '?').join(',');
        const rows = db
          .prepare(`SELECT * FROM items WHERE id IN (${placeholders}) ORDER BY created_at, id`)
          .all(...ids) as ItemRow[];
        return rows.map(summary);
      };
      const childIds = (
        db
          .prepare('SELECT id FROM items WHERE parent_id = ?')
          .all(id) as Array<{ id: string }>
      ).map((r) => r.id);
      const mentionedIds = (
        db
          .prepare('SELECT mentions_item_id FROM item_mentions WHERE item_id = ?')
          .all(id) as Array<{ mentions_item_id: string }>
      ).map((r) => r.mentions_item_id);
      const mentioningIds = (
        db
          .prepare('SELECT item_id FROM item_mentions WHERE mentions_item_id = ?')
          .all(id) as Array<{ item_id: string }>
      ).map((r) => r.item_id);
      return {
        parents: row.parent_id ? byIds([row.parent_id]) : [],
        children: byIds(childIds),
        mentioned: byIds(mentionedIds),
        mentioning: byIds(mentioningIds),
      };
    },

    create(input) {
      const project = projects.get(input.project_id);
      if (!project) throw new ProjectNotFoundError(input.project_id);
      const policy = policyFor(registry, project.bundle_id, project.bundle_path, project.repo_path);
      const type = input.type ?? policy.types[0];
      if (type === undefined || !policy.types.includes(type)) {
        throw new ItemPolicyError(`item type "${input.type}" not allowed by bundle ${policy.bundle_id}`, 'type');
      }
      const typeStatuses = policy.statuses_by_type[type] ?? policy.statuses;
      const status = input.status ?? typeStatuses[0];
      if (status === undefined || !typeStatuses.includes(status)) {
        throw new ItemPolicyError(
          `item status "${input.status}" not allowed for type "${type}" by bundle ${policy.bundle_id}`,
          'status',
        );
      }
      if (input.parent_id !== undefined && input.parent_id !== null) {
        const parent = getRow(input.parent_id);
        if (!parent || parent.project_id !== project.id) {
          throw new ItemNotFoundError(input.parent_id);
        }
      }
      const id = nanoid();
      const now = new Date().toISOString();
      const tx = db.transaction(() => {
        db.prepare(
          `INSERT INTO items (id, project_id, type, title, description, status, blocker_text, parent_id, branch_ref, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          project.id,
          type,
          input.title,
          input.description ?? '',
          status,
          input.blocker_text ?? null,
          input.parent_id ?? null,
          input.branch_ref ?? null,
          now,
          now,
        );
        for (const tag of input.tags ?? []) {
          db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag) VALUES (?, ?)').run(id, tag);
        }
        for (const sid of input.session_ids ?? []) {
          db.prepare('INSERT OR IGNORE INTO item_session_memberships (item_id, session_id) VALUES (?, ?)').run(id, sid);
        }
        writeContext(id, input.methodology_context);
        syncMentions(id, project.id, input.description ?? '');
      });
      tx();
      appendAudit(db, {
        projectId: project.id,
        entityType: 'item',
        entityId: id,
        actor: 'user',
        field: 'create',
        newValue: input.title,
        triggerContext: { type, status },
      });
      return this.get(id)!;
    },

    update(id, input) {
      const before = getRow(id);
      if (!before) throw new ItemNotFoundError(id);
      const project = projects.get(before.project_id);
      if (!project) throw new ProjectNotFoundError(before.project_id);
      const policy = policyFor(registry, project.bundle_id, project.bundle_path, project.repo_path);

      const next: ItemRow = {
        ...before,
        type: input.type ?? before.type,
        title: input.title ?? before.title,
        description: input.description ?? before.description,
        status: input.status ?? before.status,
        blocker_text:
          input.blocker_text === undefined ? before.blocker_text : input.blocker_text,
        parent_id: input.parent_id === undefined ? before.parent_id : input.parent_id,
        branch_ref: input.branch_ref === undefined ? before.branch_ref : input.branch_ref,
        updated_at: new Date().toISOString(),
      };
      if (!policy.types.includes(next.type)) {
        throw new ItemPolicyError(`item type "${next.type}" not allowed by bundle ${policy.bundle_id}`, 'type');
      }
      const nextTypeStatuses = policy.statuses_by_type[next.type] ?? policy.statuses;
      if (!nextTypeStatuses.includes(next.status)) {
        throw new ItemPolicyError(
          `item status "${next.status}" not allowed for type "${next.type}" by bundle ${policy.bundle_id}`,
          'status',
        );
      }
      if (next.parent_id !== null && next.parent_id !== before.parent_id) {
        const parent = getRow(next.parent_id);
        if (!parent || parent.project_id !== before.project_id) {
          throw new ItemNotFoundError(next.parent_id);
        }
        // Prevent simple cycles: walk up from the proposed parent.
        let walker: ItemRow | null = parent;
        const seen = new Set<string>();
        while (walker) {
          if (walker.id === id) throw new BlockerCycleError();
          if (seen.has(walker.id)) break;
          seen.add(walker.id);
          walker = walker.parent_id ? getRow(walker.parent_id) : null;
        }
      }

      db.prepare(
        `UPDATE items
           SET type = ?, title = ?, description = ?, status = ?, blocker_text = ?, parent_id = ?, branch_ref = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        next.type,
        next.title,
        next.description,
        next.status,
        next.blocker_text,
        next.parent_id,
        next.branch_ref,
        next.updated_at,
        id,
      );

      if (input.methodology_context !== undefined) {
        const beforeCtx = rowToItem(db, before).methodology_context;
        writeContext(id, input.methodology_context);
        const afterCtx = rowToItem(db, getRow(id)!).methodology_context;
        for (const dim of [
          'primary_unit_refs',
          'phase_refs',
          'anchor_citations',
          'marker_refs',
        ] as const) {
          const oldV = beforeCtx[dim].join(',');
          const newV = afterCtx[dim].join(',');
          if (oldV !== newV) {
            appendAudit(db, {
              projectId: before.project_id,
              entityType: 'item',
              entityId: id,
              actor: 'user',
              field: dim,
              oldValue: oldV,
              newValue: newV,
            });
          }
        }
      }

      const mentionsBefore = syncMentions(id, before.project_id, next.description);
      if (mentionsBefore !== null) {
        appendAudit(db, {
          projectId: before.project_id,
          entityType: 'item',
          entityId: id,
          actor: 'user',
          field: 'mentions',
          oldValue: mentionsBefore.join(','),
          newValue: currentMentions(id).join(','),
        });
      }

      for (const [field, oldV, newV] of [
        ['type', before.type, next.type],
        ['title', before.title, next.title],
        ['description', before.description, next.description],
        ['status', before.status, next.status],
        ['blocker_text', before.blocker_text ?? '', next.blocker_text ?? ''],
        ['parent_id', before.parent_id ?? '', next.parent_id ?? ''],
        ['branch_ref', before.branch_ref ?? '', next.branch_ref ?? ''],
      ] as const) {
        if (oldV !== newV) {
          appendAudit(db, {
            projectId: before.project_id,
            entityType: 'item',
            entityId: id,
            actor: 'user',
            field,
            oldValue: String(oldV),
            newValue: String(newV),
          });
        }
      }

      if (before.status !== next.status) {
        hooks.onStatusTransition?.(before.project_id, id);
      }

      return this.get(id)!;
    },

    delete(id) {
      const before = getRow(id);
      if (!before) return;
      // T-D33 — snapshot verifier rules into the orphan tracker before the FK cascade
      // removes them. Best-effort; never blocks the delete.
      try {
        hooks.onDelete?.(before.project_id, id);
      } catch {
        /* orphan-tracking failure must not block item deletion */
      }
      db.prepare('DELETE FROM items WHERE id = ?').run(id);
      appendAudit(db, {
        projectId: before.project_id,
        entityType: 'item',
        entityId: id,
        actor: 'user',
        field: 'delete',
        oldValue: before.title,
      });
    },

    addTag(id, tag) {
      const before = getRow(id);
      if (!before) throw new ItemNotFoundError(id);
      const r = db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag) VALUES (?, ?)').run(id, tag);
      if (r.changes > 0) {
        touch(id);
        appendAudit(db, {
          projectId: before.project_id,
          entityType: 'item',
          entityId: id,
          actor: 'user',
          field: 'tag_add',
          newValue: tag,
        });
      }
    },

    removeTag(id, tag) {
      const before = getRow(id);
      if (!before) throw new ItemNotFoundError(id);
      const r = db.prepare('DELETE FROM item_tags WHERE item_id = ? AND tag = ?').run(id, tag);
      if (r.changes > 0) {
        touch(id);
        appendAudit(db, {
          projectId: before.project_id,
          entityType: 'item',
          entityId: id,
          actor: 'user',
          field: 'tag_remove',
          oldValue: tag,
        });
      }
    },

    addBlocker(id, blockedById) {
      if (id === blockedById) throw new BlockerCycleError();
      const before = getRow(id);
      if (!before) throw new ItemNotFoundError(id);
      const target = getRow(blockedById);
      if (!target || target.project_id !== before.project_id) throw new ItemNotFoundError(blockedById);
      // BFS walk from blockedById following its own blockers; reaching `id` along the chain
      // means the proposed edge closes a cycle. Mirrors the parent-walk pattern above.
      const blockersOf = db.prepare('SELECT blocked_by_item_id FROM item_blockers WHERE item_id = ?');
      const queue: string[] = [blockedById];
      const seen = new Set<string>();
      while (queue.length > 0) {
        const node = queue.shift()!;
        if (node === id) throw new BlockerCycleError();
        if (seen.has(node)) continue;
        seen.add(node);
        for (const row of blockersOf.all(node) as Array<{ blocked_by_item_id: string }>) {
          queue.push(row.blocked_by_item_id);
        }
      }
      const r = db
        .prepare('INSERT OR IGNORE INTO item_blockers (item_id, blocked_by_item_id) VALUES (?, ?)')
        .run(id, blockedById);
      if (r.changes > 0) {
        touch(id);
        appendAudit(db, {
          projectId: before.project_id,
          entityType: 'item',
          entityId: id,
          actor: 'user',
          field: 'blocker_add',
          newValue: blockedById,
        });
      }
    },

    removeBlocker(id, blockedById) {
      const before = getRow(id);
      if (!before) throw new ItemNotFoundError(id);
      const r = db
        .prepare('DELETE FROM item_blockers WHERE item_id = ? AND blocked_by_item_id = ?')
        .run(id, blockedById);
      if (r.changes > 0) {
        touch(id);
        appendAudit(db, {
          projectId: before.project_id,
          entityType: 'item',
          entityId: id,
          actor: 'user',
          field: 'blocker_remove',
          oldValue: blockedById,
        });
      }
    },

    addSessionMembership(id, sessionId) {
      const before = getRow(id);
      if (!before) throw new ItemNotFoundError(id);
      const r = db
        .prepare('INSERT OR IGNORE INTO item_session_memberships (item_id, session_id) VALUES (?, ?)')
        .run(id, sessionId);
      if (r.changes > 0) {
        appendAudit(db, {
          projectId: before.project_id,
          entityType: 'item',
          entityId: id,
          actor: 'user',
          field: 'session_add',
          newValue: sessionId,
        });
      }
    },

    removeSessionMembership(id, sessionId) {
      const before = getRow(id);
      if (!before) throw new ItemNotFoundError(id);
      const r = db
        .prepare('DELETE FROM item_session_memberships WHERE item_id = ? AND session_id = ?')
        .run(id, sessionId);
      if (r.changes > 0) {
        appendAudit(db, {
          projectId: before.project_id,
          entityType: 'item',
          entityId: id,
          actor: 'user',
          field: 'session_remove',
          oldValue: sessionId,
        });
      }
    },
  };
}
