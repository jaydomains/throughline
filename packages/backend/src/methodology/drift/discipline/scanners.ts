import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { DisciplineDriftCategory, LoadedBundle } from '@throughline/shared';
import type { DB } from '../../../db/index.js';
import { resolveDocSurface } from '../../gates/checks.js';
import { escapeRegExp, safeCompile, safeTest } from './safe-regex.js';

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
  // format_regex is bundle-authored (untrusted). A refused/invalid pattern → no format
  // constraint rather than failing every anchor on a broken bundle (skip spirit, T-D44).
  const formatRe = bundle.anchor_system.format_regex
    ? safeCompile(bundle.anchor_system.format_regex)
    : null;
  // status_vocabulary convention (same as the Phase-8 anchor-resolution gate): first term
  // is "live", the rest are non-live. A cited anchor that does not resolve, or resolves to
  // a non-live status, is a cross-reference failure (SPEC §7.14). Vocab terms are constant
  // for the bundle: compile the non-live matchers once (not N anchors × M terms) and
  // escape each term so a metacharacter in a vocab word can't malform the pattern.
  const vocab = bundle.anchor_system.status_vocabulary ?? [];
  const liveStatus = vocab[0];
  const nonLiveMatchers = vocab.slice(1).map((term) => ({
    term,
    re: new RegExp(`status[:\\s]+${escapeRegExp(term.toLowerCase())}`),
  }));
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
        const nonLive = nonLiveMatchers.find((m) => m.re.test(block));
        if (nonLive) {
          problem = `cited anchor "${anchor}" resolves but is ${nonLive.term} (not acknowledged)`;
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
  // An unparseable OR catastrophic-backtracking pattern is a bundle-authoring issue,
  // not a repo drift — skip silently rather than hang the scanner / event loop or
  // fail (never-blocks spirit, T-D44).
  const re = safeCompile(pattern);
  if (re === null) return [];
  const files = resolveDocSurface(repoPath, bundle);
  if (files === null) return [];
  const out: ScanFinding[] = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (safeTest(re, line)) {
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

// A scan either succeeds (with a possibly-empty finding set) or errors. The distinction
// is load-bearing (SF2-01): an empty success means "the repo reproduces no findings for
// this category" and the engine reconciles open signals away, whereas an error means
// "we could not determine the current state" and the engine must NOT dismiss anything —
// a transient read error otherwise reads as a clean repo and wipes real open signals.
export type DisciplineScanResult =
  // `warnings` carry bundle-authoring diagnostics that are NOT repo drift but must not be
  // silent (SF2-08): e.g. a refused/invalid `format_regex` whose constraint went unenforced.
  | { ok: true; findings: ScanFinding[]; warnings?: string[] }
  | { ok: false; error: Error };

export function runDisciplineScan(
  db: DB,
  projectId: string,
  repoPath: string,
  bundle: LoadedBundle,
  category: DisciplineDriftCategory,
): DisciplineScanResult {
  try {
    switch (category.check_kind) {
      case 'banned_string':
        return { ok: true, findings: bannedStringScan(repoPath, bundle) };
      case 'structural':
        return { ok: true, findings: structuralScan(repoPath, bundle) };
      case 'cross_reference': {
        // SF2-08: a refused/invalid format_regex silently dropped the anchor-format
        // constraint. The other cross-reference checks (resolution/liveness) are still
        // valid, so this stays ok:true — but the dropped constraint surfaces as a warning
        // rather than reading as a clean format check.
        const fr = bundle.anchor_system.format_regex;
        const warnings: string[] =
          fr && safeCompile(fr) === null
            ? [
                `cross_reference: anchor format_regex was refused (invalid or ` +
                  `catastrophic-backtracking); the anchor-format constraint is NOT enforced ` +
                  `this scan — fix the bundle's anchor_system.format_regex.`,
              ]
            : [];
        return { ok: true, findings: crossReferenceScan(db, projectId, repoPath, bundle), warnings };
      }
      case 'regex': {
        // SF2-08: a refused/invalid regex-category pattern means the category could not be
        // evaluated at all — returning ok:true/[] would reconcile its open signals away and
        // read as "clean". Treat it as unevaluable (ok:false) so the engine PRESERVES the
        // category's signals (same posture as a transient scanner error, SF2-01) and logs it.
        const pattern = category.details.trim();
        if (pattern && safeCompile(pattern) === null) {
          return {
            ok: false,
            error: new Error(
              `regex category "${category.name}" pattern was refused (invalid or ` +
                `catastrophic-backtracking); category not evaluated — fix the bundle pattern.`,
            ),
          };
        }
        return { ok: true, findings: regexScan(repoPath, bundle, category) };
      }
      default:
        return { ok: true, findings: [] };
    }
  } catch (err) {
    // A scanner error is never a repo block (T-D44 spirit) — but it is also NOT "no
    // findings". Surface it as an error so the engine preserves existing signals for this
    // category instead of dismissing them; the next file change / re-scan retries.
    return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}
