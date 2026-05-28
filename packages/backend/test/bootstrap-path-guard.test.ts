import { describe, expect, it } from 'vitest';
import { join, sep } from 'node:path';
import {
  BootstrapPathEscapeError,
  assertPathInsideThroughline,
} from '../src/bootstrap/path-guard.js';

// Phase 21 — Slice 1 — defence-in-depth path guard for the render endpoint
// and (in slice 3) the archive/quarantine worker. project.repo_path is
// already canonicalised by `projects/service.ts validateRepoPath`, so any
// well-formed call from the routes layer is safe. The guard catches the
// pathological cases: synthetic repo_path with `..`, a candidate path
// escaping via traversal, a sibling directory name that prefix-matches the
// `.throughline` segment by character but not by path boundary.

const ABS_REPO = `${sep}home${sep}user${sep}proj`;

describe('Phase 21 path-guard (C-D21)', () => {
  it('accepts a path equal to the .throughline directory itself', () => {
    expect(() =>
      assertPathInsideThroughline(ABS_REPO, join(ABS_REPO, '.throughline')),
    ).not.toThrow();
  });

  it('accepts a file path strictly under .throughline', () => {
    expect(() =>
      assertPathInsideThroughline(ABS_REPO, join(ABS_REPO, '.throughline', 'bootstrap-prompt.md')),
    ).not.toThrow();
  });

  it('accepts a nested subdirectory under .throughline', () => {
    expect(() =>
      assertPathInsideThroughline(
        ABS_REPO,
        join(ABS_REPO, '.throughline', 'bootstrap-archive', '2026-05-28-x.json'),
      ),
    ).not.toThrow();
  });

  it('rejects a traversal that escapes the repo', () => {
    expect(() =>
      assertPathInsideThroughline(
        ABS_REPO,
        join(ABS_REPO, '.throughline', '..', '..', 'etc', 'passwd'),
      ),
    ).toThrow(BootstrapPathEscapeError);
  });

  it('rejects a traversal that lands at a sibling of .throughline', () => {
    expect(() =>
      assertPathInsideThroughline(ABS_REPO, join(ABS_REPO, 'src', 'index.ts')),
    ).toThrow(BootstrapPathEscapeError);
  });

  it('rejects a sibling directory whose name prefix-matches `.throughline`', () => {
    // Without the trailing-separator check, a bare startsWith would let
    // `<repo>/.throughline-evil/...` through. The guard's `dir + sep`
    // suffix on the prefix check blocks this.
    expect(() =>
      assertPathInsideThroughline(
        ABS_REPO,
        join(ABS_REPO, '.throughline-evil', 'bootstrap-prompt.md'),
      ),
    ).toThrow(BootstrapPathEscapeError);
  });

  it('rejects a non-absolute repo path', () => {
    expect(() =>
      assertPathInsideThroughline(`relative${sep}repo`, join(ABS_REPO, '.throughline', 'x')),
    ).toThrow(BootstrapPathEscapeError);
  });

  it('rejects a non-absolute candidate path', () => {
    expect(() =>
      assertPathInsideThroughline(ABS_REPO, join('.throughline', 'x')),
    ).toThrow(BootstrapPathEscapeError);
  });
});
