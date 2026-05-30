import { isAbsolute, join, normalize, sep } from 'node:path';
import { DomainError } from '@throughline/shared';

// C-D21 — render endpoint and worker write into `<repo_path>/.throughline/`
// only. The repo_path on a Project is already canonicalised by
// `projects/service.ts validateRepoPath` (realpathSync.native), so any
// well-formed call here is safe. The guard exists as defence-in-depth:
// future callers (workers spawned with a fresh repo_path, tests injecting a
// crafted value) could otherwise escape via `..` segments.

export class BootstrapPathEscapeError extends DomainError {
  constructor(public repoPath: string, public candidatePath: string) {
    super(
      `path "${candidatePath}" is not inside "${repoPath}${sep}.throughline${sep}"`,
      { statusCode: 400, code: 'path_escape' },
    );
  }
}

export function assertPathInsideThroughline(repoPath: string, candidatePath: string): void {
  if (!isAbsolute(repoPath) || !isAbsolute(candidatePath)) {
    throw new BootstrapPathEscapeError(repoPath, candidatePath);
  }
  const throughlineDir = normalize(join(repoPath, '.throughline'));
  const normalised = normalize(candidatePath);
  // Equal-to-dir is accepted (`mkdirSync` on .throughline itself is legal);
  // anything else must be strictly under the directory with a separator suffix
  // so siblings like `<repo>/.throughline-evil/...` don't slip past a bare
  // startsWith on the path string.
  if (normalised === throughlineDir) return;
  if (normalised.startsWith(throughlineDir + sep)) return;
  throw new BootstrapPathEscapeError(repoPath, candidatePath);
}
