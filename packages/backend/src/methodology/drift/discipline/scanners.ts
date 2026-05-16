import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { DisciplineDriftCategory, LoadedBundle } from '@throughline/shared';
import type { DB } from '../../../db/index.js';
import { resolveDocSurface } from '../../gates/checks.js';

// C-D7 — discipline-drift scanners. One scanner per bundle-declared category
// (validation-rules section); the category's `check_kind` selects a generic primitive,
// mirroring the C-D15 built-in catalogue idea for gates. Findings are project-scoped by
// default; `cross_reference` additionally scopes to the citing item via the existing
// item_anchor_citations linkage (the only file-independent item attribution the T-D42
// grammar affords — banned_string/structural/regex have no file→unit mapping and stay
// project-wide; see CODE_SPEC C-D7 implications).

export interface ScanFinding {
  message: string;
  ref: string | null;
  itemId: string | null;
  primaryUnitRef: string | null;
}

function bannedStringScan(repoPath: string, bundle: LoadedBundle): ScanFinding[] {
  const files = resolveDocSurface(repoPath, bundle);
  if (files === null) return [];
  const banned = [
    ...bundle.validation_rules.banned_string_sweeps,
    ...(bundle.anchor_system.banned_content_in_bodies ?? []),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  if (banned.length === 0) return [];
  const out: ScanFinding[] = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const token of banned) {
        if (line.includes(token)) {
          out.push({
            message: `"${token}" at line ${i + 1}`,
            ref: file,
            itemId: null,
            primaryUnitRef: null,
          });
        }
      }
    });
  }
  return out;
}

function structuralScan(repoPath: string, bundle: LoadedBundle): ScanFinding[] {
  if (!repoPath || !isAbsolute(repoPath) || !existsSync(repoPath)) return [];
  const required = bundle.project_layout.primary_unit?.doc_set ?? [];
  const out: ScanFinding[] = [];
  for (const rel of required) {
    if (!existsSync(join(repoPath, rel))) {
      out.push({
        message: 'missing required file',
        ref: rel,
        itemId: null,
        primaryUnitRef: null,
      });
    }
  }
  return out;
}

function citingItems(db: DB, projectId: string, anchorId: string): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT c.item_id AS item_id
         FROM item_anchor_citations c
         JOIN items i ON i.id = c.item_id
        WHERE i.project_id = ? AND c.anchor_id = ?`,
    )
    .all(projectId, anchorId) as Array<{ item_id: string }>;
  return rows.map((r) => r.item_id);
}

function crossReferenceScan(
  db: DB,
  projectId: string,
  repoPath: string,
  bundle: LoadedBundle,
): ScanFinding[] {
  const anchors = (
    db
      .prepare(
        `SELECT DISTINCT c.anchor_id AS a
           FROM item_anchor_citations c
           JOIN items i ON i.id = c.item_id
          WHERE i.project_id = ?`,
      )
      .all(projectId) as Array<{ a: string }>
  ).map((r) => r.a);
  if (anchors.length === 0) return [];
  const files = resolveDocSurface(repoPath, bundle);
  if (files === null) return [];
  const formatRe = bundle.anchor_system.format_regex
    ? new RegExp(bundle.anchor_system.format_regex)
    : null;
  // status_vocabulary convention (same as the Phase-8 anchor-resolution gate): first term
  // is "live", the rest are non-live. A cited anchor that does not resolve, or resolves to
  // a non-live status, is a cross-reference failure (SPEC §7.14).
  const vocab = bundle.anchor_system.status_vocabulary ?? [];
  const liveStatus = vocab[0];
  const corpus = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  const out: ScanFinding[] = [];
  for (const anchor of anchors) {
    let problem: string | null = null;
    if (formatRe && !formatRe.test(anchor)) {
      problem = `cited anchor "${anchor}" does not match the bundle anchor format`;
    } else {
      const headingIdx = corpus.indexOf(anchor);
      if (headingIdx === -1) {
        problem = `cited anchor "${anchor}" does not resolve to any doc heading`;
      } else if (liveStatus) {
        const block = corpus.slice(headingIdx, headingIdx + 600).toLowerCase();
        const nonLive = vocab
          .slice(1)
          .find((s) => new RegExp(`status[:\\s]+${s.toLowerCase()}`).test(block));
        if (nonLive) {
          problem = `cited anchor "${anchor}" resolves but is ${nonLive} (not acknowledged)`;
        }
      }
    }
    if (!problem) continue;
    const items = citingItems(db, projectId, anchor);
    if (items.length === 0) {
      out.push({ message: problem, ref: anchor, itemId: null, primaryUnitRef: null });
    } else {
      for (const itemId of items) {
        out.push({ message: problem, ref: anchor, itemId, primaryUnitRef: null });
      }
    }
  }
  return out;
}

function regexScan(
  repoPath: string,
  bundle: LoadedBundle,
  category: DisciplineDriftCategory,
): ScanFinding[] {
  const pattern = category.details.trim();
  if (!pattern) return [];
  let re: RegExp;
  try {
    re = new RegExp(pattern);
  } catch {
    // An unparseable pattern is a bundle-authoring issue, not a repo drift — skip
    // silently rather than fail (never-blocks spirit, T-D44).
    return [];
  }
  const files = resolveDocSurface(repoPath, bundle);
  if (files === null) return [];
  const out: ScanFinding[] = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (re.test(line)) {
        out.push({
          message: `/${pattern}/ matched at line ${i + 1}`,
          ref: file,
          itemId: null,
          primaryUnitRef: null,
        });
      }
    });
  }
  return out;
}

export function runDisciplineScan(
  db: DB,
  projectId: string,
  repoPath: string,
  bundle: LoadedBundle,
  category: DisciplineDriftCategory,
): ScanFinding[] {
  try {
    switch (category.check_kind) {
      case 'banned_string':
        return bannedStringScan(repoPath, bundle);
      case 'structural':
        return structuralScan(repoPath, bundle);
      case 'cross_reference':
        return crossReferenceScan(db, projectId, repoPath, bundle);
      case 'regex':
        return regexScan(repoPath, bundle, category);
      default:
        return [];
    }
  } catch {
    // A scanner error is never a repo block (T-D44 spirit) — treat as "no findings"
    // for this pass; the next file change / re-scan retries.
    return [];
  }
}
