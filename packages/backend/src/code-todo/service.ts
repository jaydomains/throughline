import { nanoid } from 'nanoid';
import type { CodeTodoScanResult } from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';
import type { DumpZoneService } from '../dump-zone/service.js';
import type { ProjectsService } from '../projects/service.js';
import { matchesToDumpZoneText, scanRepo, DEFAULT_PATTERNS } from './scanner.js';

// Manual code TODO/FIXME scan service. Per §7.6 + ROADMAP Phase 4 §13 adoption: manual
// invocation only in v1. Scan walks the project's repo_path, finds matches for the configured
// patterns, packages them as a dump-zone proposal so the same review-modal apply path lands
// the resulting items. Each run writes a row to code_todo_scans for audit.

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`project ${id} not found`);
  }
}

export class RepoPathMissingError extends Error {
  constructor(path: string) {
    super(`project repo_path "${path}" does not exist`);
  }
}

export interface ScanInput {
  project_id: string;
  patterns?: string[];
}

export interface CodeTodoService {
  scan(input: ScanInput): Promise<CodeTodoScanResult>;
}

interface CreateOptions {
  db: DB;
  projects: ProjectsService;
  dumpZone: DumpZoneService;
}

export function createCodeTodoService({ db, projects, dumpZone }: CreateOptions): CodeTodoService {
  return {
    async scan(input) {
      const project = projects.get(input.project_id);
      if (!project) throw new ProjectNotFoundError(input.project_id);
      const patterns = input.patterns?.length ? input.patterns : [...DEFAULT_PATTERNS];
      const result = scanRepo(project.repo_path, { patterns });
      const text = matchesToDumpZoneText(result.matches);
      // Empty text still produces a (possibly-empty) proposal so the UI surface stays
      // consistent. The propose() call will produce zero items via the heuristic path.
      const proposal = await dumpZone.propose({
        project_id: project.id,
        text: text.length > 0 ? text : '(no matches found)',
        target: 'session',
        source: 'code_todo',
        session_id: null,
      });
      const id = nanoid();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO code_todo_scans (id, project_id, patterns_json, match_count, proposed_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(id, project.id, JSON.stringify(patterns), result.matches.length, proposal.id, now);
      appendAudit(db, {
        projectId: project.id,
        entityType: 'project',
        entityId: project.id,
        actor: 'user',
        field: 'code_todo_scan',
        newValue: String(result.matches.length),
        triggerContext: {
          scan_id: id,
          proposal_id: proposal.id,
          patterns,
          files_scanned: result.files_scanned,
          truncated: result.truncated,
        },
      });
      return {
        scan_id: id,
        proposal_id: proposal.id,
        match_count: result.matches.length,
      };
    },
  };
}
