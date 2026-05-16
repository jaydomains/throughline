import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

// Phase 10 (C-D16) — the hybrid seam. The only Phase-10 data that is an expensive GitHub
// API payload is the changed-file list / diff-stat of a PR. Everything else (PR state,
// SHAs, reviews, check-run annotations) is a small GitHub-only metadata fact (api.ts).
//
// So changed-file enumeration goes local-git-first: the backend already has the project's
// `repo_path`, `git diff --name-only base...head` is free (no API call, no rate-limit
// cost, no large payload), and it is offline-testable with a real temp repo. Base/head
// SHAs come from the cheap API metadata call we already make for PR state.
//
// On any miss (no clone / shallow / ref absent even after a lazy fetch / git absent) the
// result is `unavailable` and the caller falls back to the GitHub API files endpoint.
// Shelling `git` via child_process (not adding `simple-git`) follows the exact precedent
// recorded for the Phase-8 hook-installer in CODE_SPEC §7.

export interface DiffResult {
  status: 'ok' | 'unavailable';
  files: string[];
  // `git diff --shortstat`-style summary, used by auto-reconcile input. '' when ok with
  // no changes; null when unavailable.
  stat: string | null;
}

export interface LocalGit {
  changedFiles(repoPath: string, baseSha: string, headSha: string, prNumber: number): Promise<DiffResult>;
}

function isGitRepo(repoPath: string): boolean {
  return existsSync(join(repoPath, '.git'));
}

async function git(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await exec('git', args, {
    cwd: repoPath,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  return stdout;
}

async function haveCommit(repoPath: string, sha: string): Promise<boolean> {
  try {
    await git(repoPath, ['cat-file', '-e', `${sha}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

export function createLocalGit(): LocalGit {
  return {
    async changedFiles(repoPath, baseSha, headSha, prNumber) {
      const unavailable: DiffResult = { status: 'unavailable', files: [], stat: null };
      if (!repoPath || !isGitRepo(repoPath)) return unavailable;
      try {
        // Lazily fetch the PR head + base only when a needed commit is absent. The PR
        // ref `refs/pull/N/head` lives on the *base* repo, so this also covers fork PRs.
        // The fetch is git-protocol (no REST rate-limit cost) and best-effort.
        if (!(await haveCommit(repoPath, headSha))) {
          await git(repoPath, [
            'fetch',
            '--quiet',
            'origin',
            `pull/${prNumber}/head`,
          ]).catch(() => undefined);
        }
        if (!(await haveCommit(repoPath, baseSha))) {
          await git(repoPath, ['fetch', '--quiet', 'origin']).catch(() => undefined);
        }
        if (!(await haveCommit(repoPath, headSha)) || !(await haveCommit(repoPath, baseSha))) {
          return unavailable;
        }
        const names = await git(repoPath, [
          'diff',
          '--name-only',
          `${baseSha}...${headSha}`,
        ]);
        const stat = await git(repoPath, [
          'diff',
          '--shortstat',
          `${baseSha}...${headSha}`,
        ]);
        return {
          status: 'ok',
          files: names
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0),
          stat: stat.trim(),
        };
      } catch {
        return unavailable;
      }
    },
  };
}
