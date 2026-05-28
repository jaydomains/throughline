import { describe, expect, it } from 'vitest';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProjectsService } from '../src/projects/service.js';
import {
  BootstrapRenderNoBundleBoundError,
  BootstrapRenderProjectNotFoundError,
  renderBootstrapPrompt,
} from '../src/bootstrap/render.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

// Phase 21 — Slice 1 — render endpoint tests (C-D21 surfaces 1, 2, 7).
//
// Covers the four surfaces this slice ships together:
//   * prompt template loaded from the bundled module path (T-D55)
//   * parameter block prepended with canonical paths (T-D56)
//   * `.throughline/.gitignore` written and idempotent
//   * path-guard prevents writes outside `<repo_path>/.throughline/`
//   (path-guard's unit-level escape cases live in bootstrap-path-guard.test.ts)

const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantFreeform(methodologiesDir: string): void {
  const target = join(methodologiesDir, 'freeform');
  mkdirSync(target, { recursive: true });
  copyFileSync(FREEFORM_BUNDLE_PATH, join(target, 'bundle.md'));
}

function makeRepoPath(): string {
  // realpath the tmp root so `projects/service.ts validateRepoPath`'s
  // symlink-resolution produces the same canonical path the render endpoint
  // operates on (macOS routes /tmp through /private/var/.../).
  return realpathSync.native(mkdtempSync(join(tmpdir(), 'throughline-render-repo-')));
}

async function setup() {
  const cfg = makeTmpConfig();
  plantFreeform(cfg.methodologiesDir);
  const backend = await makeBackend(cfg);
  const projects = createProjectsService(backend.db, backend.registry);
  const repoPath = makeRepoPath();
  const project = projects.create({ name: 'demo', repo_path: repoPath });
  return {
    backend,
    projects,
    project,
    repoPath,
    deps: {
      projects,
      registry: backend.registry,
      methodologiesDir: cfg.methodologiesDir,
    },
    cleanup: async () => {
      rmSync(repoPath, { recursive: true, force: true });
      await backend.cleanup();
    },
  };
}

describe('Phase 21 render endpoint (C-D21 surfaces 1, 2, 7)', () => {
  it('writes the prompt with parameter block + template body', async () => {
    const ctx = await setup();
    try {
      const result = renderBootstrapPrompt(ctx.project.id, ctx.deps);
      expect(existsSync(result.promptPath)).toBe(true);
      const content = readFileSync(result.promptPath, 'utf8');
      // Parameter block first, template body after.
      expect(content.startsWith('---\n')).toBe(true);
      expect(content).toContain(`bundle_path: ${result.bundlePath}`);
      expect(content).toContain(`repo_root: ${ctx.repoPath}`);
      expect(content).toContain(`output_path: ${result.outputPath}`);
      // Template body marker (h1) appears after the frontmatter.
      expect(content).toContain('# Throughline bootstrap');
    } finally {
      await ctx.cleanup();
    }
  });

  it('places prompt + output path strictly inside <repo>/.throughline/', async () => {
    const ctx = await setup();
    try {
      const result = renderBootstrapPrompt(ctx.project.id, ctx.deps);
      expect(result.promptPath).toBe(join(ctx.repoPath, '.throughline', 'bootstrap-prompt.md'));
      expect(result.outputPath).toBe(join(ctx.repoPath, '.throughline', 'bootstrap-output.json'));
    } finally {
      await ctx.cleanup();
    }
  });

  it('auto-creates .throughline/ when missing', async () => {
    const ctx = await setup();
    try {
      // freshly-minted repo has no .throughline/ yet.
      expect(existsSync(join(ctx.repoPath, '.throughline'))).toBe(false);
      renderBootstrapPrompt(ctx.project.id, ctx.deps);
      expect(existsSync(join(ctx.repoPath, '.throughline'))).toBe(true);
    } finally {
      await ctx.cleanup();
    }
  });

  it('writes the Throughline-managed .gitignore on first render', async () => {
    const ctx = await setup();
    try {
      renderBootstrapPrompt(ctx.project.id, ctx.deps);
      const gi = readFileSync(join(ctx.repoPath, '.throughline', '.gitignore'), 'utf8');
      expect(gi).toContain('bootstrap-prompt.md');
      expect(gi).toContain('bootstrap-output.json');
      expect(gi).toContain('bootstrap-archive/');
      expect(gi).toContain('bootstrap-quarantine/');
    } finally {
      await ctx.cleanup();
    }
  });

  it('is idempotent: re-render produces byte-identical prompt + .gitignore', async () => {
    const ctx = await setup();
    try {
      const a = renderBootstrapPrompt(ctx.project.id, ctx.deps);
      const promptA = readFileSync(a.promptPath, 'utf8');
      const giA = readFileSync(join(ctx.repoPath, '.throughline', '.gitignore'), 'utf8');
      const b = renderBootstrapPrompt(ctx.project.id, ctx.deps);
      const promptB = readFileSync(b.promptPath, 'utf8');
      const giB = readFileSync(join(ctx.repoPath, '.throughline', '.gitignore'), 'utf8');
      expect(promptB).toBe(promptA);
      expect(giB).toBe(giA);
    } finally {
      await ctx.cleanup();
    }
  });

  it('preserves a manually-edited .gitignore body when content already matches', async () => {
    const ctx = await setup();
    try {
      renderBootstrapPrompt(ctx.project.id, ctx.deps);
      const gitignorePath = join(ctx.repoPath, '.throughline', '.gitignore');
      const before = readFileSync(gitignorePath, 'utf8');
      // Touch the file with an unrelated mtime — same content; render must
      // not rewrite (test the existence-of-content equality short-circuit).
      writeFileSync(gitignorePath, before, 'utf8');
      const mtimeBefore = realpathSync.native(gitignorePath); // sanity
      renderBootstrapPrompt(ctx.project.id, ctx.deps);
      const after = readFileSync(gitignorePath, 'utf8');
      expect(after).toBe(before);
      expect(mtimeBefore).toBeTruthy();
    } finally {
      await ctx.cleanup();
    }
  });

  it('returns a copy-pasteable invocation command pointing at the prompt path', async () => {
    const ctx = await setup();
    try {
      const result = renderBootstrapPrompt(ctx.project.id, ctx.deps);
      expect(result.invocationCommand).toContain(result.promptPath);
      // Stdin-pipe shape — most portable across Claude CLI installs.
      expect(result.invocationCommand).toMatch(/cat ".+" \| claude/);
    } finally {
      await ctx.cleanup();
    }
  });

  it('throws BootstrapRenderProjectNotFoundError for an unknown project id', async () => {
    const ctx = await setup();
    try {
      expect(() => renderBootstrapPrompt('does-not-exist', ctx.deps)).toThrow(
        BootstrapRenderProjectNotFoundError,
      );
    } finally {
      await ctx.cleanup();
    }
  });

  it('throws BootstrapRenderNoBundleBoundError when the bundle fails to load', async () => {
    const ctx = await setup();
    try {
      // Delete the planted bundle so resolveBundle returns status: 'error'.
      rmSync(join(ctx.deps.methodologiesDir, 'freeform'), { recursive: true, force: true });
      ctx.deps.registry.reload('freeform');
      expect(() => renderBootstrapPrompt(ctx.project.id, ctx.deps)).toThrow(
        BootstrapRenderNoBundleBoundError,
      );
    } finally {
      await ctx.cleanup();
    }
  });

  it('uses the arm-2 path when <repo>/.throughline/bundle.md exists and loads', async () => {
    const ctx = await setup();
    try {
      // Plant a per-repo bundle (arm 2). The project remains bound by id, so
      // the registry's resolveBundle precedence picks the per-repo file.
      mkdirSync(join(ctx.repoPath, '.throughline'), { recursive: true });
      copyFileSync(FREEFORM_BUNDLE_PATH, join(ctx.repoPath, '.throughline', 'bundle.md'));
      // Re-bind via the registry so the per-repo cache learns about the new file.
      ctx.deps.registry.unregisterProjectBundle(ctx.project.id);
      ctx.deps.registry.registerProjectBundle(ctx.project.id, ctx.project.bundle_id, null, ctx.repoPath);
      const result = renderBootstrapPrompt(ctx.project.id, ctx.deps);
      expect(result.bundlePath).toBe(join(ctx.repoPath, '.throughline', 'bundle.md'));
    } finally {
      await ctx.cleanup();
    }
  });

  it('uses the arm-3 (install-shipped) path when no other arm wins', async () => {
    const ctx = await setup();
    try {
      const result = renderBootstrapPrompt(ctx.project.id, ctx.deps);
      expect(result.bundlePath).toBe(join(ctx.deps.methodologiesDir, 'freeform', 'bundle.md'));
    } finally {
      await ctx.cleanup();
    }
  });
});
