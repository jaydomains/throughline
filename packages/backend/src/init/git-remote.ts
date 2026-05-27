// C-D19 surface 3 — git remote `origin` auto-detection.
//
// Shells `git remote get-url origin` under repo_path and parses GitHub
// coordinates from the URL. Supports SSH (`git@github.com:owner/repo.git`),
// SSH-scheme (`ssh://git@github.com/owner/repo.git`), and HTTPS
// (`https://github.com/owner/repo.git`) forms.
//
// Used by:
//   • Slice 3 CLI `throughline init` — fills `.throughline/project.json` gaps.
//   • Slice 2 backend re-init — fills `github_owner`/`github_repo` when the
//     project.json is silent on them.

import { execFileSync } from 'node:child_process';

export interface GitHubRemote {
  owner: string;
  repo: string;
}

// Strips a trailing `.git` segment if present.
function stripDotGit(url: string): string {
  return url.endsWith('.git') ? url.slice(0, -4) : url;
}

export function parseGitHubRemote(url: string): GitHubRemote | null {
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;

  // SSH form: git@github.com:owner/repo[.git]
  const sshMatch = /^git@github\.com:([^/]+)\/(.+)$/.exec(trimmed);
  if (sshMatch) {
    return { owner: sshMatch[1]!, repo: stripDotGit(sshMatch[2]!) };
  }

  // URL forms: https://github.com/owner/repo[.git] OR ssh://git@github.com/owner/repo[.git]
  const urlMatch = /^(?:https?|ssh):\/\/(?:[^@/]+@)?github\.com\/([^/]+)\/([^/?#]+)\/?$/.exec(trimmed);
  if (urlMatch) {
    return { owner: urlMatch[1]!, repo: stripDotGit(urlMatch[2]!) };
  }

  return null;
}

// Reads the repo's origin remote and parses it. Returns null when:
//   • the path is not a git repo,
//   • the repo has no `origin` remote,
//   • the remote URL does not point at github.com,
//   • git is not on PATH.
//
// Any non-success exit silently yields null — the caller treats missing GitHub
// coordinates as the projected default state, not a hard error.
export function detectGitHubRemote(repoPath: string): GitHubRemote | null {
  let raw: string;
  try {
    raw = execFileSync('git', ['-C', repoPath, 'remote', 'get-url', 'origin'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
  return parseGitHubRemote(raw);
}
