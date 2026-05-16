import { execFile } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { GateFindings, GateFiringStatus, LoadedBundle } from '@throughline/shared';

// C-D15 — built-in generic mechanical-check catalogue. The bundle grammar carries no
// field binding a mechanical GateSpec to a concrete check, so the runtime ships a fixed
// set of generic primitives driven off the bundle's typed sections and dispatches each
// GateSpec by a gate-id keyword convention. Unrecognised mechanical gates and any check
// error record a non-blocking skipped/error finding (never blocks the repo, T-D44).

export type CheckKind =
  | 'banned-string'
  | 'structural'
  | 'anchor-resolution'
  | 'blocking-marker'
  | 'script-spawn'
  | 'unrecognised';

export interface CheckContext {
  bundle: LoadedBundle;
  repoPath: string;
  // Anchor ids cited by the project's items, gathered by the runtime.
  citedAnchors: string[];
}

export interface CheckResult {
  status: GateFiringStatus;
  findings: GateFindings;
}

// Gate-id keyword → built-in check kind (C-D15). Description is consulted only to detect
// a script gate (a token that looks like an executable path).
export function resolveCheckKind(gateId: string, description: string): CheckKind {
  const id = gateId.toLowerCase();
  if (/\bverify\b/.test(id) || /\S+\.sh\b/.test(description)) return 'script-spawn';
  if (id.includes('banned') || id.includes('banned-string')) return 'banned-string';
  if (id.includes('structure') || id.includes('structural') || id.includes('conformance'))
    return 'structural';
  if (id.includes('anchor')) return 'anchor-resolution';
  if (id.includes('marker')) return 'blocking-marker';
  return 'unrecognised';
}

function findings(check: string, summary: string, items: GateFindings['items'] = []): GateFindings {
  return { check, summary, items };
}

// Resolve the bundle's declared doc surface to readable absolute file paths under the
// project's repo. Returns null when the repo is unreadable so the caller can `skip`
// rather than `fail` (never-blocks, T-D44).
function docFiles(ctx: CheckContext): string[] | null {
  const { repoPath, bundle } = ctx;
  if (!repoPath || !isAbsolute(repoPath) || !existsSync(repoPath)) return null;
  const out: string[] = [];
  const docSet = bundle.project_layout.primary_unit?.doc_set ?? [];
  for (const rel of docSet) {
    const p = join(repoPath, rel);
    if (existsSync(p) && statSync(p).isFile()) out.push(p);
  }
  for (const dir of bundle.project_layout.runtime_artefact_dirs) {
    const base = join(repoPath, dir);
    if (!existsSync(base) || !statSync(base).isDirectory()) continue;
    walk(base, out, 0);
  }
  return out;
}

function walk(dir: string, out: string[], depth: number): void {
  if (depth > 6) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out, depth + 1);
    else if (st.isFile()) out.push(full);
  }
}

function bannedStringCheck(ctx: CheckContext): CheckResult {
  const files = docFiles(ctx);
  if (files === null) {
    return {
      status: 'skipped',
      findings: findings('banned-string', 'repo path unreadable; sweep skipped'),
    };
  }
  const banned = [
    ...ctx.bundle.validation_rules.banned_string_sweeps,
    ...(ctx.bundle.anchor_system.banned_content_in_bodies ?? []),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  const hits: GateFindings['items'] = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const token of banned) {
        if (line.includes(token)) {
          hits.push({ message: `"${token}" at line ${i + 1}`, ref: file });
        }
      }
    });
  }
  return hits.length === 0
    ? { status: 'pass', findings: findings('banned-string', 'no banned strings found') }
    : {
        status: 'fail',
        findings: findings('banned-string', `${hits.length} banned-string occurrence(s)`, hits),
      };
}

function structuralCheck(ctx: CheckContext): CheckResult {
  const { repoPath, bundle } = ctx;
  if (!repoPath || !isAbsolute(repoPath) || !existsSync(repoPath)) {
    return {
      status: 'skipped',
      findings: findings('structural', 'repo path unreadable; conformance skipped'),
    };
  }
  const required = bundle.project_layout.primary_unit?.doc_set ?? [];
  const missing: GateFindings['items'] = [];
  for (const rel of required) {
    if (!existsSync(join(repoPath, rel))) missing.push({ message: `missing required file`, ref: rel });
  }
  return missing.length === 0
    ? {
        status: 'pass',
        findings: findings('structural', `all ${required.length} required file(s) present`),
      }
    : {
        status: 'fail',
        findings: findings('structural', `${missing.length} required file(s) missing`, missing),
      };
}

function anchorResolutionCheck(ctx: CheckContext): CheckResult {
  const { bundle, citedAnchors } = ctx;
  if (citedAnchors.length === 0) {
    return { status: 'pass', findings: findings('anchor-resolution', 'no anchors cited') };
  }
  const files = docFiles(ctx);
  if (files === null) {
    return {
      status: 'skipped',
      findings: findings('anchor-resolution', 'repo path unreadable; resolution skipped'),
    };
  }
  const formatRe = bundle.anchor_system.format_regex
    ? new RegExp(bundle.anchor_system.format_regex)
    : null;
  // status_vocabulary convention: first term is "live", remaining terms are non-live
  // (e.g. test-bundle: active, superseded). A cited anchor resolving to a non-live
  // status fails the gate.
  const vocab = bundle.anchor_system.status_vocabulary ?? [];
  const liveStatus = vocab[0];
  const corpus = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  const unresolved: GateFindings['items'] = [];
  for (const anchor of citedAnchors) {
    if (formatRe && !formatRe.test(anchor)) {
      unresolved.push({ message: `"${anchor}" does not match anchor format`, ref: anchor });
      continue;
    }
    // Resolves if it appears as a heading line; non-live if a sibling status line names a
    // non-live vocabulary term within the heading's block.
    const headingIdx = corpus.indexOf(anchor);
    if (headingIdx === -1) {
      unresolved.push({ message: `"${anchor}" cited but not found in docs`, ref: anchor });
      continue;
    }
    if (liveStatus) {
      const block = corpus.slice(headingIdx, headingIdx + 600).toLowerCase();
      const nonLive = vocab
        .slice(1)
        .find((s) => new RegExp(`status[:\\s]+${s.toLowerCase()}`).test(block));
      if (nonLive) {
        unresolved.push({ message: `"${anchor}" resolves but is ${nonLive}`, ref: anchor });
      }
    }
  }
  return unresolved.length === 0
    ? {
        status: 'pass',
        findings: findings('anchor-resolution', `${citedAnchors.length} cited anchor(s) resolve`),
      }
    : {
        status: 'fail',
        findings: findings(
          'anchor-resolution',
          `${unresolved.length} anchor(s) unresolved or non-live`,
          unresolved,
        ),
      };
}

function blockingMarkerCheck(ctx: CheckContext, gateDescription: string): CheckResult {
  const files = docFiles(ctx);
  if (files === null) {
    return {
      status: 'skipped',
      findings: findings('blocking-marker', 'repo path unreadable; marker scan skipped'),
    };
  }
  // Prefer marker tokens named explicitly in the gate description; fall back to every
  // declared marker format.
  const declared = ctx.bundle.marker_system.formats ?? [];
  const named = declared.filter((fmt) => gateDescription.includes(fmt));
  const tokens = (named.length > 0 ? named : declared).map((s) => s.trim()).filter(Boolean);
  const hits: GateFindings['items'] = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const token of tokens) {
        if (line.includes(token)) hits.push({ message: `${token} at line ${i + 1}`, ref: file });
      }
    });
  }
  return hits.length === 0
    ? { status: 'pass', findings: findings('blocking-marker', 'no blocking markers present') }
    : {
        status: 'fail',
        findings: findings('blocking-marker', `${hits.length} blocking marker(s)`, hits),
      };
}

function extractScriptToken(description: string): string | null {
  const m = /(\S+\.sh)\b/.exec(description);
  return m ? m[1]! : null;
}

async function scriptSpawnCheck(
  ctx: CheckContext,
  gateId: string,
  description: string,
): Promise<CheckResult> {
  const { repoPath } = ctx;
  const script = extractScriptToken(description) ?? gateId;
  if (!repoPath || !isAbsolute(repoPath) || !existsSync(repoPath)) {
    return {
      status: 'skipped',
      findings: findings('script-spawn', `repo path unreadable; ${script} not run`),
    };
  }
  const scriptPath = join(repoPath, script);
  if (!existsSync(scriptPath)) {
    return {
      status: 'skipped',
      findings: findings('script-spawn', `${script} not found in repo; skipped`),
    };
  }
  return new Promise<CheckResult>((resolve) => {
    execFile(
      scriptPath,
      [],
      { cwd: repoPath, timeout: 30_000, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        const tail = (stderr || stdout || '').toString().trim().slice(-500);
        if (err) {
          resolve({
            status: 'fail',
            findings: findings('script-spawn', `${script} exited non-zero`, [
              { message: tail || String(err), ref: script },
            ]),
          });
        } else {
          resolve({ status: 'pass', findings: findings('script-spawn', `${script} passed`) });
        }
      },
    );
  });
}

export async function runMechanicalCheck(
  kind: CheckKind,
  ctx: CheckContext,
  gateId: string,
  description: string,
): Promise<CheckResult> {
  try {
    switch (kind) {
      case 'banned-string':
        return bannedStringCheck(ctx);
      case 'structural':
        return structuralCheck(ctx);
      case 'anchor-resolution':
        return anchorResolutionCheck(ctx);
      case 'blocking-marker':
        return blockingMarkerCheck(ctx, description);
      case 'script-spawn':
        return await scriptSpawnCheck(ctx, gateId, description);
      case 'unrecognised':
      default:
        return {
          status: 'skipped',
          findings: findings(
            'unrecognised',
            `gate "${gateId}" maps to no built-in mechanical check (C-D15)`,
          ),
        };
    }
  } catch (e) {
    // A check error never blocks the repo (T-D44) — record it and move on.
    return {
      status: 'error',
      findings: findings(kind, `check error: ${e instanceof Error ? e.message : String(e)}`),
    };
  }
}
