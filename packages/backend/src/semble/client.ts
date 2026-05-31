import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { SembleHit, SembleStatus } from '@throughline/shared';

// Phase 11 — Semble client (C-D17, T-D27, T-D13; SPEC §7.15/§15/§10).
//
// Per-query one-shot child process via `execFile` — the same idiom as
// `github/local-git.ts`, `github/pr-linking.ts`, `methodology/gates/hook-installer.ts`
// (C-D16): zero new dependencies, no MCP client, no supervised long-lived subprocess,
// no socket/HTTP. Keyless (T-D27): "configured" == the command resolves and runs,
// mirroring `AnthropicClient.available()` → feature-disable degradation.
//
// ASSUMED CLI CONTRACT (spec-author gap — SPEC/CODE_SPEC pin the wire model but not
// Semble's argv/output): the public MinishLab/semble CLI is invoked as
//
//   <cmd> search --json --path <repo> --limit <n> -- <query>
//
// emitting JSON on stdout (a hits array, or an object wrapping one, or JSON-lines).
// The parser below is deliberately tolerant of field-name variants. If the real
// interface differs, the `THROUGHLINE_SEMBLE_CMD` override plus a localised parser
// tweak absorb it — no SPEC change. Verify hands-on before this surface is dogfooded.

const defaultExec = promisify(execFile);

export type SembleExec = (
  cmd: string,
  args: string[],
  opts: { cwd?: string; maxBuffer?: number; windowsHide?: boolean; timeout?: number },
) => Promise<{ stdout: string; stderr: string }>;

export interface SembleSearchInput {
  repoPath: string;
  query: string;
  limit?: number;
}

// A search outcome that distinguishes a real, possibly-empty result ('ok') from a
// degradation ('degraded' — the binary crashed, timed out, or exited abnormally). Per
// T-D60 a degradation is disclosed, never collapsed into an empty hit list that reads
// as "search worked, nothing here".
export type SembleSearchOutcome =
  | { status: 'ok'; hits: SembleHit[] }
  | { status: 'degraded' };

export interface SembleClient {
  // Probe the capability state. 'unavailable' ⇒ the command does not resolve (ENOENT);
  // 'degraded' ⇒ it is present but the probe crashed/timed out; 'available' otherwise
  // (including a non-zero exit from a command that *did* run — keyless, T-D27).
  probe(): Promise<SembleStatus>;
  search(input: SembleSearchInput): Promise<SembleSearchOutcome>;
}

interface CreateClientOptions {
  command: string;
  execImpl?: SembleExec;
}

const SEARCH_TIMEOUT_MS = 30_000;
const MAX_BUFFER = 16 * 1024 * 1024;
const DEFAULT_LIMIT = 10;

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

// Tolerate the field-name variants the assumed contract might emit.
function coerceHit(raw: unknown): SembleHit | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const path = str(r.path) ?? str(r.file) ?? str(r.filename) ?? str(r.filepath);
  if (!path) return null;
  const lineStart =
    num(r.line_start) ?? num(r.start_line) ?? num(r.line) ?? num(r.lineno) ?? 1;
  const lineEnd =
    num(r.line_end) ?? num(r.end_line) ?? num(r.line_to) ?? lineStart;
  const snippet =
    str(r.snippet) ?? str(r.text) ?? str(r.content) ?? str(r.chunk) ?? '';
  const score = num(r.score) ?? num(r.distance) ?? num(r.similarity);
  return {
    path,
    line_start: lineStart,
    line_end: lineEnd >= lineStart ? lineEnd : lineStart,
    snippet,
    score,
  };
}

// Accept: a JSON array, an object with a hits/results/matches array, or JSON-lines.
function parseHits(stdout: string): SembleHit[] {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) return [];
  const fromArray = (arr: unknown[]): SembleHit[] =>
    arr.map(coerceHit).filter((h): h is SembleHit => h !== null);
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return fromArray(parsed);
    if (typeof parsed === 'object' && parsed !== null) {
      const o = parsed as Record<string, unknown>;
      for (const key of ['hits', 'results', 'matches', 'chunks', 'data']) {
        if (Array.isArray(o[key])) return fromArray(o[key] as unknown[]);
      }
      const single = coerceHit(parsed);
      return single ? [single] : [];
    }
    return [];
  } catch {
    // JSON-lines fallback.
    const hits: SembleHit[] = [];
    for (const line of trimmed.split('\n')) {
      const l = line.trim();
      if (!l) continue;
      try {
        const h = coerceHit(JSON.parse(l));
        if (h) hits.push(h);
      } catch {
        /* skip unparseable line */
      }
    }
    return hits;
  }
}

export function createSembleClient({ command, execImpl }: CreateClientOptions): SembleClient {
  const exec = execImpl ?? defaultExec;
  return {
    async probe() {
      try {
        await exec(command, ['--version'], { windowsHide: true, timeout: 10_000 });
        return 'available';
      } catch (err) {
        const e = err as { code?: unknown; killed?: unknown };
        // ENOENT ⇒ the command does not resolve ⇒ not configured (absent).
        if (e.code === 'ENOENT') return 'unavailable';
        // A numeric exit code means the command *did* run, just exited non-zero —
        // still present (keyless, T-D27).
        if (typeof e.code === 'number') return 'available';
        // Timed out / killed / spawn failure: installed but not responding. Disclose it
        // rather than masquerading as 'available' (T-D60).
        return 'degraded';
      }
    },
    async search({ repoPath, query, limit }) {
      const q = query.trim();
      // An empty query or missing repo is an honest empty, not a degradation.
      if (!repoPath || q.length === 0) return { status: 'ok', hits: [] };
      const n = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), 50);
      try {
        const { stdout } = await exec(
          command,
          ['search', '--json', '--path', repoPath, '--limit', String(n), '--', q],
          {
            cwd: repoPath,
            maxBuffer: MAX_BUFFER,
            windowsHide: true,
            timeout: SEARCH_TIMEOUT_MS,
          },
        );
        // Unparseable output still parses to [] (parseHits never throws) — that is an
        // honest empty. Only an exec rejection below is a degradation.
        return { status: 'ok', hits: parseHits(stdout).slice(0, n) };
      } catch {
        // Absent binary, non-zero exit, timeout: a real degradation. Disclose it (T-D60)
        // instead of returning [] (which read as "search worked, nothing here" — SF4-01).
        return { status: 'degraded' };
      }
    },
  };
}
