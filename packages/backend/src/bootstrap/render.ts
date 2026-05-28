import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Project } from '@throughline/shared';
import type { MethodologyRegistry } from '../methodology/loader.js';
import type { ProjectsService } from '../projects/service.js';
import { assertPathInsideThroughline } from './path-guard.js';

// C-D21 surface 1+2 — single repo-owned generic prompt template (T-D55)
// rendered by the render endpoint (T-D56). The template lives adjacent to this
// module; read once at module init the same way `routes/web.ts` reads
// `index.html` — sync at startup is the existing precedent and avoids a
// top-level await. The rendered output combines a fixed YAML parameter block
// (bundle file path, repo root, declared output path) with the template body
// verbatim.

const TEMPLATE_PATH = join(dirname(fileURLToPath(import.meta.url)), 'prompt-template.md');
const TEMPLATE_BODY = readFileSync(TEMPLATE_PATH, 'utf8');

// C-D21 implications + docs/.throughline-schema.md transient-files section.
// The render endpoint owns this file so transient ingest state never enters
// the user's git history. user-authored config (`project.json`, `bundle.md`)
// is explicitly NOT covered here — those belong in git and travel with the
// repo.
const GITIGNORE_PAYLOAD = [
  '# Throughline-managed (C-D21). Do not edit.',
  'bootstrap-prompt.md',
  'bootstrap-output.json',
  'bootstrap-archive/',
  'bootstrap-quarantine/',
  '',
].join('\n');

export class BootstrapRenderProjectNotFoundError extends Error {
  constructor(public projectId: string) {
    super(`project ${projectId} not found`);
  }
}

export class BootstrapRenderNoBundleBoundError extends Error {
  constructor(public projectId: string) {
    super(`project ${projectId} has no bundle bound or bound bundle failed to load`);
  }
}

export interface BootstrapRenderDeps {
  projects: ProjectsService;
  registry: MethodologyRegistry;
  methodologiesDir: string;
}

export interface BootstrapRenderResult {
  promptPath: string;
  outputPath: string;
  bundlePath: string;
  invocationCommand: string;
}

// Mirrors the arm precedence in `methodology/loader.ts resolveBundle`:
//   1. <bundle_path>/bundle.md (C-D14)
//   2. <repo_path>/.throughline/bundle.md (T-D51, C-D19 surface 1)
//   3. <methodologiesDir>/<bundle_id>/bundle.md (T-D41)
// The registry's resolveBundle returns the loaded result but not the file
// path it loaded; the render endpoint needs the path to inject into the
// prompt's parameter block. Caller has already gated on resolveBundle ==
// 'loaded', so we just walk the precedence to pick the file path — no
// second resolveBundle here (a redundant call would open a race window
// where the two resolutions could disagree mid-flight).
function resolveBundleFile(methodologiesDir: string, project: Project): string {
  if (project.bundle_path) {
    return join(project.bundle_path, 'bundle.md');
  }
  if (project.repo_path) {
    const arm2 = join(project.repo_path, '.throughline', 'bundle.md');
    if (existsSync(arm2)) return arm2;
  }
  return join(methodologiesDir, project.bundle_id, 'bundle.md');
}

export function renderBootstrapPrompt(
  projectId: string,
  deps: BootstrapRenderDeps,
): BootstrapRenderResult {
  const project = deps.projects.get(projectId);
  if (!project) throw new BootstrapRenderProjectNotFoundError(projectId);

  // Reuse the same load-status check as `bootstrap/service.ts resolvePolicy`.
  // No-bundle-bound here means no methodology rules to apply at extraction
  // time, which would produce a structurally-invalid bootstrap output. Fail
  // at the render step rather than producing a broken prompt.
  const loaded = deps.registry.resolveBundle(
    project.bundle_id,
    project.bundle_path,
    project.repo_path,
  );
  if (loaded.status !== 'loaded') {
    throw new BootstrapRenderNoBundleBoundError(projectId);
  }

  const bundleFile = resolveBundleFile(deps.methodologiesDir, project);
  const throughlineDir = join(project.repo_path, '.throughline');
  const promptPath = join(throughlineDir, 'bootstrap-prompt.md');
  const outputPath = join(throughlineDir, 'bootstrap-output.json');
  const gitignorePath = join(throughlineDir, '.gitignore');

  assertPathInsideThroughline(project.repo_path, promptPath);
  assertPathInsideThroughline(project.repo_path, outputPath);
  assertPathInsideThroughline(project.repo_path, gitignorePath);

  mkdirSync(throughlineDir, { recursive: true });

  const parameterBlock = [
    '---',
    `bundle_path: ${bundleFile}`,
    `repo_root: ${project.repo_path}`,
    `output_path: ${outputPath}`,
    '---',
    '',
  ].join('\n');
  writeFileSync(promptPath, parameterBlock + TEMPLATE_BODY, 'utf8');

  // Idempotent write — only touch when contents differ. Avoids inode churn
  // that would otherwise wake any user-side editor or git-status watcher on
  // every render call.
  if (!existsSync(gitignorePath) || readFileSync(gitignorePath, 'utf8') !== GITIGNORE_PAYLOAD) {
    writeFileSync(gitignorePath, GITIGNORE_PAYLOAD, 'utf8');
  }

  // T-D56 — user runs Claude Code in their normal CLI/IDE against the
  // rendered prompt. Stdin-pipe is the most portable invocation across CLI
  // installs; the unified SettingsView block surfaces this string in a
  // copy-pasteable panel (slice 4).
  const invocationCommand = `cat "${promptPath}" | claude`;

  return { promptPath, outputPath, bundlePath: bundleFile, invocationCommand };
}
