import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Manual code TODO/FIXME scanner. Per §7.6 and the §13 adoption applied in ROADMAP Phase 4:
//   - default patterns: TODO:, FIXME:, XXX:
//   - manual invocation only in v1 (no file-watcher auto-scan)
//
// The scanner walks the project's repo_path while honouring a small ignore list. Returns one
// match per line. Capping result count keeps the dump-zone review modal usable; if the cap
// is hit, the response signals truncation so the UI can ask for narrower patterns.

export const DEFAULT_PATTERNS = ['TODO:', 'FIXME:', 'XXX:'] as const;

const IGNORED_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.cache',
  '.venv',
  'venv',
  '__pycache__',
  'target',
]);

const TEXT_FILE_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.rb',
  '.java',
  '.kt',
  '.swift',
  '.c',
  '.cc',
  '.cpp',
  '.h',
  '.hpp',
  '.cs',
  '.php',
  '.sh',
  '.bash',
  '.zsh',
  '.md',
  '.markdown',
  '.txt',
  '.yml',
  '.yaml',
  '.json',
  '.toml',
  '.ini',
  '.cfg',
  '.html',
  '.css',
  '.scss',
  '.sass',
  '.lua',
  '.vue',
  '.svelte',
]);

const DEFAULT_MAX_MATCHES = 200;
const DEFAULT_MAX_FILES = 5000;
const DEFAULT_MAX_FILE_BYTES = 1_000_000;

export interface ScanMatch {
  pattern: string;
  path: string; // relative to repo_path
  line: number;
  text: string;
}

export interface ScanOptions {
  patterns?: string[];
  maxMatches?: number;
  maxFiles?: number;
  maxFileBytes?: number;
}

export interface ScanResult {
  matches: ScanMatch[];
  patterns: string[];
  files_scanned: number;
  truncated: boolean;
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i).toLowerCase();
}

export function scanRepo(repoPath: string, options: ScanOptions = {}): ScanResult {
  const patterns = options.patterns?.length ? [...options.patterns] : [...DEFAULT_PATTERNS];
  const maxMatches = options.maxMatches ?? DEFAULT_MAX_MATCHES;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;

  if (!existsSync(repoPath)) {
    return { matches: [], patterns, files_scanned: 0, truncated: false };
  }
  const matches: ScanMatch[] = [];
  let filesScanned = 0;
  let truncated = false;

  function walk(dir: string): void {
    if (truncated) return;
    if (filesScanned >= maxFiles) {
      truncated = true;
      return;
    }
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (truncated) return;
      const full = join(dir, entry);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        if (IGNORED_DIR_NAMES.has(entry) || entry.startsWith('.git/')) continue;
        walk(full);
        continue;
      }
      if (!stat.isFile()) continue;
      const ext = extOf(entry);
      if (!TEXT_FILE_EXTS.has(ext)) continue;
      if (stat.size > maxFileBytes) continue;
      filesScanned++;
      let content: string;
      try {
        content = readFileSync(full, 'utf8');
      } catch {
        continue;
      }
      const lines = content.split(/\r?\n/);
      const rel = relative(repoPath, full);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        for (const pat of patterns) {
          if (line.includes(pat)) {
            matches.push({ pattern: pat, path: rel, line: i + 1, text: line.trim().slice(0, 240) });
            if (matches.length >= maxMatches) {
              truncated = true;
              return;
            }
            break;
          }
        }
      }
    }
  }

  walk(repoPath);
  return { matches, patterns, files_scanned: filesScanned, truncated };
}

export function matchesToDumpZoneText(matches: ScanMatch[]): string {
  // Each match becomes its own paragraph so the heuristic and AI extractors both split the
  // result into one proposed item per TODO.
  return matches
    .map((m) => `${m.pattern} ${m.text.replace(/^.*?(?:TODO:|FIXME:|XXX:)\s*/, '')}\n(${m.path}:${m.line})`)
    .join('\n\n');
}
