import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, join } from 'node:path';

// CODE_SPEC §7 / SPEC §7.12 — consented, idempotent methodology-gate hook installation.
//
// Hook-path resolution uses git's canonical mechanism (`git rev-parse --git-path hooks`)
// rather than joining repo_path + .git/hooks, so linked worktrees, gitdir-pointer
// submodules, and core.hooksPath overrides (Husky) resolve correctly. The spec names
// simple-git as the planned git surface; we invoke git directly via execFileSync to
// avoid adding a dependency for a single one-shot path query — equivalent for this use,
// recorded as an implementation note in CODE_SPEC §7.
//
// Hooks are advisory and non-blocking (T-D44): they always exit 0, chain (not replace)
// any pre-existing hook, and fall back to the durable queue when the backend is down.

const SENTINEL = '# throughline-methodology-gate';

export interface InstallHooksInput {
  repoPath: string;
  runtimeFilePath: string;
  queueDir: string;
}

export interface InstallHooksResult {
  installed: boolean;
  hooksDir?: string;
  reason?: string;
}

function resolveHooksDir(repoPath: string): string | null {
  try {
    const rel = execFileSync('git', ['-C', repoPath, 'rev-parse', '--git-path', 'hooks'], {
      encoding: 'utf8',
      timeout: 10_000,
    }).trim();
    if (!rel) return null;
    return isAbsolute(rel) ? rel : join(repoPath, rel);
  } catch {
    return null;
  }
}

function hookScript(
  moment: 'per-commit' | 'post-commit',
  runtimeFilePath: string,
  queueDir: string,
): string {
  const localHook = moment === 'per-commit' ? 'pre-commit.local' : 'post-commit.local';
  return `#!/bin/sh
${SENTINEL}
# Advisory, non-blocking (T-D44): always exits 0; chains a pre-existing hook if present.
set +e
RUNTIME_FILE="${runtimeFilePath}"
QUEUE_DIR="${queueDir}"
MOMENT="${moment}"
REPO_PATH="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HEAD_SHA="$(git rev-parse HEAD 2>/dev/null || echo '')"
FIRED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
PAYLOAD="{\\"moment\\":\\"$MOMENT\\",\\"repo_path\\":\\"$REPO_PATH\\",\\"head_sha\\":\\"$HEAD_SHA\\",\\"fired_at\\":\\"$FIRED_AT\\"}"
URL=""
if [ -f "$RUNTIME_FILE" ]; then
  URL="$(sed -n 's/.*"url"[ ]*:[ ]*"\\([^"]*\\)".*/\\1/p' "$RUNTIME_FILE" | head -n1)"
fi
DELIVERED=0
if [ -n "$URL" ]; then
  curl -fsS -m 3 -X POST -H 'content-type: application/json' \\
    -d "$PAYLOAD" "$URL/api/gate-trigger" >/dev/null 2>&1 && DELIVERED=1
fi
if [ "$DELIVERED" -ne 1 ]; then
  # Durable fallback: backend unreachable — queue the event for startup drain.
  mkdir -p "$QUEUE_DIR" 2>/dev/null
  TS="$(date -u +%Y%m%dT%H%M%SZ)"
  RND="$$$(date +%N 2>/dev/null || echo 0)"
  printf '%s' "$PAYLOAD" > "$QUEUE_DIR/$TS-$RND.json" 2>/dev/null
fi
# Chain a pre-existing (non-Throughline) hook if one was preserved.
PREV="$(dirname "$0")/${localHook}"
if [ -x "$PREV" ]; then
  "$PREV" "$@"
fi
exit 0
`;
}

function installOne(
  hooksDir: string,
  hookName: 'pre-commit' | 'post-commit',
  moment: 'per-commit' | 'post-commit',
  runtimeFilePath: string,
  queueDir: string,
): 'installed' | 'skipped_custom_hook' {
  const hookPath = join(hooksDir, hookName);
  const localPath = join(hooksDir, `${hookName}.local`);
  if (existsSync(hookPath)) {
    const current = readFileSync(hookPath, 'utf8');
    if (current.includes(SENTINEL)) {
      // Already Throughline-managed — idempotent rewrite (picks up path changes).
    } else if (!existsSync(localPath)) {
      // Hook collision policy (SPEC §7.12): chain, do not replace. Preserve the user's
      // hook as <hook>.local and invoke it from ours.
      renameSync(hookPath, localPath);
      chmodSync(localPath, 0o755);
    } else {
      // A non-Throughline hook exists AND the .local chain slot is already occupied
      // (the user replaced our installed hook with their own custom one). Overwriting
      // here would permanently destroy a user-owned file in a user-owned repo —
      // forbidden under T-D37. Leave it untouched and report the skip; the git-side
      // trigger for this hook stays unavailable until the user resolves the collision.
      return 'skipped_custom_hook';
    }
  }
  writeFileSync(hookPath, hookScript(moment, runtimeFilePath, queueDir), 'utf8');
  chmodSync(hookPath, 0o755);
  return 'installed';
}

export function installGateHooks(input: InstallHooksInput): InstallHooksResult {
  const { repoPath, runtimeFilePath, queueDir } = input;
  if (!repoPath || !isAbsolute(repoPath) || !existsSync(repoPath)) {
    return { installed: false, reason: 'repo_path_unreadable' };
  }
  const hooksDir = resolveHooksDir(repoPath);
  if (!hooksDir) {
    return { installed: false, reason: 'not_a_git_repo' };
  }
  try {
    if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true });
    const skipped: string[] = [];
    if (installOne(hooksDir, 'pre-commit', 'per-commit', runtimeFilePath, queueDir) === 'skipped_custom_hook')
      skipped.push('pre-commit');
    if (installOne(hooksDir, 'post-commit', 'post-commit', runtimeFilePath, queueDir) === 'skipped_custom_hook')
      skipped.push('post-commit');
    if (skipped.length > 0) {
      // Non-fatal (SPEC §7.12): nothing destroyed, the skip is surfaced and audit-logged
      // by the caller; the un-skipped hook (if any) was still installed.
      return {
        installed: false,
        hooksDir,
        reason: `custom hook preserved, not overwritten: ${skipped.join(', ')}`,
      };
    }
    return { installed: true, hooksDir };
  } catch (e) {
    return { installed: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
