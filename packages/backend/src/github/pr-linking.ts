import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type {
  ItemPrAssociation,
  PrLinkCandidate,
  PrLinkDetectResult,
} from '@throughline/shared';
import { ItemNotFoundError } from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';
import type { ProjectsService } from '../projects/service.js';
import type { GitHubApi } from './api.js';

const exec = promisify(execFile);

// Phase 10 (T-D34) — manual item-to-PR linking: auto-detect from the active git branch,
// user override (pick another / paste a number), and skip-acceptable. Items without a PR
// association lose tier-2 coverage but keep tiers 1/3/4. Re-association is possible any
// time from the item detail panel.
//
// Branch read shells `git` via child_process (the hook-installer / local-git precedent),
// not `simple-git` (C-D16).

export interface PrLinkingService {
  detect(itemId: string): Promise<PrLinkDetectResult>;
  set(itemId: string, prNumber: number, autoDetected: boolean): ItemPrAssociation;
  unset(itemId: string): void;
  get(itemId: string): ItemPrAssociation | null;
}

interface ItemRow {
  id: string;
  project_id: string;
  branch_ref: string | null;
}

export interface CreatePrLinkingOptions {
  db: DB;
  projects: ProjectsService;
  api: GitHubApi;
}

async function activeBranch(repoPath: string): Promise<string | null> {
  if (!repoPath || !existsSync(join(repoPath, '.git'))) return null;
  try {
    const { stdout } = await exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: repoPath,
      windowsHide: true,
    });
    const b = stdout.trim();
    return b && b !== 'HEAD' ? b : null;
  } catch {
    return null;
  }
}

export function createPrLinkingService(opts: CreatePrLinkingOptions): PrLinkingService {
  const { db, projects, api } = opts;

  function itemRow(itemId: string): ItemRow {
    const row = db
      .prepare('SELECT id, project_id, branch_ref FROM items WHERE id = ?')
      .get(itemId) as ItemRow | undefined;
    if (!row) throw new ItemNotFoundError(itemId);
    return row;
  }

  return {
    async detect(itemId) {
      const item = itemRow(itemId);
      const project = projects.get(item.project_id);
      if (!project || !project.github_owner || !project.github_repo || !api.available()) {
        return { candidate: null, branch: null };
      }
      // The item's own branch_ref wins; otherwise the repo's checked-out branch (T-D34).
      const branch = item.branch_ref?.trim() || (await activeBranch(project.repo_path));
      if (!branch) return { candidate: null, branch: null };
      const pull = await api.findPullForBranch(
        project.github_owner,
        project.github_repo,
        branch,
      );
      if (!pull) return { candidate: null, branch };
      const candidate: PrLinkCandidate = {
        pr_number: pull.number,
        repo: `${project.github_owner}/${project.github_repo}`,
        title: pull.title,
        url: pull.html_url,
        auto_detected: true,
      };
      return { candidate, branch };
    },

    set(itemId, prNumber, autoDetected) {
      const item = itemRow(itemId);
      const project = projects.get(item.project_id);
      if (!project || !project.github_owner || !project.github_repo) {
        throw new Error('project has no github_owner/github_repo configured');
      }
      const repo = `${project.github_owner}/${project.github_repo}`;
      const now = new Date().toISOString();
      // One association per item (re-association replaces). PK is (item, repo, pr_number)
      // so a clean replace = delete-then-insert.
      db.prepare('DELETE FROM item_pr_associations WHERE item_id = ?').run(itemId);
      db.prepare(
        `INSERT INTO item_pr_associations (item_id, pr_number, repo, auto_detected_at)
           VALUES (?, ?, ?, ?)`,
      ).run(itemId, prNumber, repo, autoDetected ? now : null);
      appendAudit(db, {
        projectId: item.project_id,
        entityType: 'item',
        entityId: itemId,
        actor: 'user',
        field: 'pr_association',
        newValue: `${repo}#${prNumber}`,
        triggerContext: { pr_number: prNumber, repo, auto_detected: autoDetected },
      });
      return { item_id: itemId, pr_number: prNumber, repo, auto_detected_at: autoDetected ? now : null };
    },

    unset(itemId) {
      const item = itemRow(itemId);
      const r = db.prepare('DELETE FROM item_pr_associations WHERE item_id = ?').run(itemId);
      if (r.changes > 0) {
        appendAudit(db, {
          projectId: item.project_id,
          entityType: 'item',
          entityId: itemId,
          actor: 'user',
          field: 'pr_association',
          oldValue: 'removed',
        });
      }
    },

    get(itemId) {
      const row = db
        .prepare(
          'SELECT item_id, pr_number, repo, auto_detected_at FROM item_pr_associations WHERE item_id = ? LIMIT 1',
        )
        .get(itemId) as ItemPrAssociation | undefined;
      return row ?? null;
    },
  };
}
