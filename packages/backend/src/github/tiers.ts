import type { DB } from '../db/index.js';
import type { DriftService } from '../drift/service.js';
import type { GhAnnotation, GhPull } from './api.js';

// Phase 10 (T-D21; SPEC §7.14; CODE_SPEC §9) — code-drift tiers 1-3. Each tier is
// idempotent (the poller calls these every cycle): a finding that still reproduces keeps
// its open signal, a finding that cleared dismisses it. Tier-4 (semantic dedup) lives in
// tier4.ts; tiers 1-3 badge the item directly.
//
// Tier 1 = Semgrep finding (read as a check-run annotation via the GitHub API — a
//          GitHub-only fact, no local-git path) matched to item_verifier_rules.
// Tier 2 = a revert PR/commit undoing a PR a done item is associated with (PR metadata).
// Tier 3 = a PR whose changed files overlap a done item's item_code_refs.path. The file
//          list comes local-git-first (C-D16); tier-3 is dormant until Phase 11 populates
//          code refs, but the pipeline is fully wired + tested here.

const REVERT_RE = /\brevert(?:s|ed|ing)?\b/i;
const PR_REF_RE = /#(\d+)/g;

// Tier 1. `annotations` are for the PR head SHA. Convention-driven match (spec-author
// gap #7 — verifier-tool plurality — is surfaced, not resolved here): an annotation maps
// to a verifier rule when its rule id (annotation title) equals item_verifier_rules
// .rule_id, or its flagged path contains the rule_path stem.
// The stem of a verifier rule_path: its basename without extension (e.g.
// `rules/security/no-eval.yml` → `no-eval`). Used for the SPEC §7.14 path-stem match.
function ruleStem(rulePath: string): string {
  const base = rulePath.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

export function runTier1(
  db: DB,
  drift: DriftService,
  projectId: string,
  pull: GhPull,
  annotations: GhAnnotation[],
  doneStatuses: string[] | null,
  annotationsAvailable: boolean,
): void {
  // F6-01: only badge done items (SPEC §7.14, matching the tier-4 done filter). A null set
  // means the bundle isn't loaded — refuse to badge rather than guess.
  if (doneStatuses === null || doneStatuses.length === 0) return;
  // SF3-04 (refuse-rather-than-fallback / SF2-01 precedent): a failed per-PR annotation
  // sub-fetch arrives here as an empty list, which the pass/clear logic below would read as
  // "every rule passed" and silently dismiss real tier-1 signals. When the fetch did not
  // succeed we have no evidence either way, so leave existing signals + last_status untouched.
  if (!annotationsAvailable) return;
  const placeholders = doneStatuses.map(() => '?').join(',');
  const rules = db
    .prepare(
      `SELECT vr.id AS rule_row_id, vr.item_id, vr.rule_id, vr.rule_path
         FROM item_verifier_rules vr
         JOIN items i ON i.id = vr.item_id
        WHERE i.project_id = ? AND i.status IN (${placeholders})`,
    )
    .all(projectId, ...doneStatuses) as Array<{
    rule_row_id: string;
    item_id: string;
    rule_id: string;
    rule_path: string;
  }>;
  if (rules.length === 0) return;

  const failing = annotations.filter((a) => a.annotation_level === 'failure');
  const now = new Date().toISOString();

  for (const rule of rules) {
    // F6-02 / SPEC §7.14: an annotation maps to a verifier rule when its title equals the
    // rule id, OR its flagged path contains the rule_path stem. The previous substring
    // match on `message`/`raw_details` over-matched (a rule id mentioned anywhere in the
    // annotation prose falsely fired); it is dropped in favour of the documented contract.
    const stem = ruleStem(rule.rule_path);
    const hit = failing.find(
      (a) =>
        (a.title !== null && a.title.trim() === rule.rule_id) ||
        (stem.length > 0 && a.path.includes(stem)),
    );
    const status = hit ? 'fail' : 'pass';
    db.prepare(
      'UPDATE item_verifier_rules SET last_status = ?, last_run_at = ? WHERE id = ?',
    ).run(status, now, rule.rule_row_id);

    const open = drift.listOpenCodeSignals(projectId, {
      category: 'tier-1',
      itemId: rule.item_id,
    });
    if (hit) {
      drift.createCodeSignalIdempotent({
        projectId,
        itemId: rule.item_id,
        category: 'tier-1',
        reason: `Semgrep verifier rule ${rule.rule_id} failed on PR #${pull.number}`,
        payload: { rule_id: rule.rule_id, pr_number: pull.number, head_sha: pull.head.sha },
      });
    } else {
      // Passing clears the badge (CHECKLIST §Phase 10).
      for (const s of open) drift.dismissSignal(s.id, 'verifier rule passing on latest run');
    }
  }
}

// Tier 2. A revert PR (title/body says "revert" and references #N) → every item
// associated with PR #N is badged orange.
export function runTier2(
  db: DB,
  drift: DriftService,
  projectId: string,
  pull: GhPull,
  repo: string,
  doneStatuses: string[] | null,
): void {
  // F6-01: only badge done items (SPEC §7.14). Null/empty = bundle not loaded → refuse.
  if (doneStatuses === null || doneStatuses.length === 0) return;
  const text = `${pull.title}\n${pull.body ?? ''}`;
  if (!REVERT_RE.test(text)) return;
  const referenced = new Set<number>();
  for (const m of text.matchAll(PR_REF_RE)) referenced.add(Number(m[1]));
  referenced.delete(pull.number);
  if (referenced.size === 0) return;

  for (const revertedPr of referenced) {
    const items = db
      .prepare(
        `SELECT a.item_id FROM item_pr_associations a
           JOIN items i ON i.id = a.item_id
          WHERE i.project_id = ? AND a.repo = ? AND a.pr_number = ? AND i.status IN (${doneStatuses
            .map(() => '?')
            .join(',')})`,
      )
      .all(projectId, repo, revertedPr, ...doneStatuses) as Array<{ item_id: string }>;
    for (const { item_id } of items) {
      drift.createCodeSignalIdempotent({
        projectId,
        itemId: item_id,
        category: 'tier-2',
        reason: `PR #${revertedPr} was reverted by PR #${pull.number}`,
        payload: { reverted_pr: revertedPr, revert_pr: pull.number },
      });
    }
  }
}

// Tier 3. Changed files (local-git-first) overlapping a done item's code refs.
export function runTier3(
  db: DB,
  drift: DriftService,
  projectId: string,
  pull: GhPull,
  changedFiles: string[],
  doneStatuses: string[] | null,
): void {
  // F6-01: only badge done items (SPEC §7.14). Null/empty = bundle not loaded → refuse.
  if (doneStatuses === null || doneStatuses.length === 0) return;
  if (changedFiles.length === 0) return;
  const changed = new Set(changedFiles);
  const refs = db
    .prepare(
      `SELECT cr.item_id, cr.path FROM item_code_refs cr
         JOIN items i ON i.id = cr.item_id
        WHERE i.project_id = ? AND i.status IN (${doneStatuses.map(() => '?').join(',')})`,
    )
    .all(projectId, ...doneStatuses) as Array<{ item_id: string; path: string }>;
  const byItem = new Map<string, string[]>();
  for (const r of refs) {
    if (changed.has(r.path)) {
      const arr = byItem.get(r.item_id) ?? [];
      arr.push(r.path);
      byItem.set(r.item_id, arr);
    }
  }
  for (const [itemId, paths] of byItem) {
    drift.createCodeSignalIdempotent({
      projectId,
      itemId,
      category: 'tier-3',
      reason: `PR #${pull.number} touches code referenced by this item (${paths
        .slice(0, 3)
        .join(', ')})`,
      payload: { pr_number: pull.number, paths },
    });
  }
}
