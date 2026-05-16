import { nanoid } from 'nanoid';
import type { OrphanCleanupDraftResult, OrphanedRule } from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';
import type { ProjectsService } from '../projects/service.js';
import type { GitHubApi } from './api.js';

// Phase 10 (T-D33; CODE_SPEC §13) — verifier-rule lifecycle on item deletion is
// orphan-flag, NOT auto-removal: deleting an item in Throughline must never silently
// mutate the user's repo (SPEC §5). The rule files stay until the user merges a cleanup
// PR; orphans surface in the settings panel (and Phase-14 periodic-review hygiene); a
// one-click action drafts the removal PR; dismiss-without-removal is also supported and
// audit-logged.

export class OrphanRuleNotFoundError extends Error {
  constructor(id: string) {
    super(`orphaned rule ${id} not found`);
  }
}

export class GithubNotConfiguredError extends Error {
  constructor() {
    super('project has no github_owner/github_repo configured');
  }
}

export interface OrphanRulesService {
  // Called from the items-service onDelete hook, BEFORE the FK cascade drops
  // item_verifier_rules. Idempotent per (project, rule_path, item).
  captureForItem(projectId: string, itemId: string): void;
  list(projectId: string, opts?: { includeDismissed?: boolean }): OrphanedRule[];
  dismiss(id: string): void;
  draftCleanupPr(id: string): Promise<OrphanCleanupDraftResult>;
}

interface OrphanRow {
  id: string;
  project_id: string;
  rule_path: string;
  original_item_id: string;
  created_at: string;
  dismissed_at: string | null;
}

export interface CreateOrphanRulesOptions {
  db: DB;
  projects: ProjectsService;
  api: GitHubApi;
}

export function createOrphanRulesService(opts: CreateOrphanRulesOptions): OrphanRulesService {
  const { db, projects, api } = opts;

  return {
    captureForItem(projectId, itemId) {
      const rules = db
        .prepare('SELECT rule_path FROM item_verifier_rules WHERE item_id = ?')
        .all(itemId) as Array<{ rule_path: string }>;
      if (rules.length === 0) return;
      const now = new Date().toISOString();
      for (const { rule_path } of rules) {
        const exists = db
          .prepare(
            `SELECT 1 FROM orphaned_rules
              WHERE project_id = ? AND rule_path = ? AND original_item_id = ?
                AND dismissed_at IS NULL LIMIT 1`,
          )
          .get(projectId, rule_path, itemId);
        if (exists) continue;
        const id = nanoid();
        db.prepare(
          `INSERT INTO orphaned_rules
            (id, project_id, rule_path, original_item_id, created_at, dismissed_at)
            VALUES (?, ?, ?, ?, ?, NULL)`,
        ).run(id, projectId, rule_path, itemId, now);
        appendAudit(db, {
          projectId,
          entityType: 'project',
          entityId: projectId,
          actor: 'system',
          field: 'verifier_rule_orphaned',
          newValue: rule_path,
          triggerContext: { rule_path, original_item_id: itemId },
        });
      }
    },

    list(projectId, { includeDismissed = false } = {}) {
      const sql = includeDismissed
        ? 'SELECT * FROM orphaned_rules WHERE project_id = ? ORDER BY created_at DESC'
        : 'SELECT * FROM orphaned_rules WHERE project_id = ? AND dismissed_at IS NULL ORDER BY created_at DESC';
      const rows = db.prepare(sql).all(projectId) as OrphanRow[];
      return rows.map((r) => ({
        id: r.id,
        project_id: r.project_id,
        rule_path: r.rule_path,
        original_item_id: r.original_item_id,
        created_at: r.created_at,
        dismissed_at: r.dismissed_at,
      }));
    },

    dismiss(id) {
      const row = db.prepare('SELECT * FROM orphaned_rules WHERE id = ?').get(id) as
        | OrphanRow
        | undefined;
      if (!row) throw new OrphanRuleNotFoundError(id);
      if (row.dismissed_at) return;
      db.prepare('UPDATE orphaned_rules SET dismissed_at = ? WHERE id = ?').run(
        new Date().toISOString(),
        id,
      );
      // T-D33: dismiss-without-removal is audit-logged.
      appendAudit(db, {
        projectId: row.project_id,
        entityType: 'project',
        entityId: row.project_id,
        actor: 'user',
        field: 'orphan_rule_dismissed',
        oldValue: row.rule_path,
        triggerContext: { rule_path: row.rule_path, original_item_id: row.original_item_id },
      });
    },

    async draftCleanupPr(id) {
      const row = db.prepare('SELECT * FROM orphaned_rules WHERE id = ?').get(id) as
        | OrphanRow
        | undefined;
      if (!row) throw new OrphanRuleNotFoundError(id);
      const project = projects.get(row.project_id);
      if (!project || !project.github_owner || !project.github_repo) {
        throw new GithubNotConfiguredError();
      }
      const result = await api.draftRuleRemovalPr({
        owner: project.github_owner,
        repo: project.github_repo,
        baseBranch: 'main',
        newBranch: `throughline/remove-orphan-rule-${id}`,
        rulePath: row.rule_path,
        itemId: row.original_item_id,
      });
      appendAudit(db, {
        projectId: row.project_id,
        entityType: 'project',
        entityId: row.project_id,
        actor: 'user',
        field: 'orphan_rule_cleanup_pr',
        newValue: result.url,
        triggerContext: {
          rule_path: row.rule_path,
          pr_number: result.number,
          original_item_id: row.original_item_id,
        },
      });
      return { pr_url: result.url, pr_number: result.number };
    },
  };
}
