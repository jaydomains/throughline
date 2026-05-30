// C-D19 surface 2 — `.throughline/project.json` reader.
//
// Reads and validates the per-repo project config file documented in
// `docs/.throughline-schema.md`. Unknown top-level keys are rejected
// (schema is closed for forward-compat-by-deliberate-version-bump per T-D51).
//
// The reader lives in the backend package because the backend is the single
// validator and writer (T-D52). The CLI imports it as library code via
// same-package resolution.

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { parseBundle } from '../methodology/bundle-parser/index.js';
import { DomainError } from '@throughline/shared';

export interface ProjectConfig {
  bundle_id: string;
  bundle_path: string | null;
  github_owner: string | null;
  github_repo: string | null;
  project_name: string | null;
}

export class InvalidProjectConfigError extends DomainError {
  constructor(message: string, public readonly path: string) {
    super(`invalid .throughline/project.json at ${path}: ${message}`, {
      statusCode: 400,
      code: 'invalid_project_config',
      details: { path },
    });
  }
}

export class BundleIdMismatchError extends DomainError {
  constructor(public readonly configBundleId: string, public readonly bundleFileName: string) {
    super(
      `bundle_id "${configBundleId}" in project.json does not match name "${bundleFileName}" declared in sibling .throughline/bundle.md §1 Identity`,
      { statusCode: 400, code: 'bundle_id_mismatch', details: { config_bundle_id: configBundleId, bundle_file_name: bundleFileName } },
    );
  }
}

const ALLOWED_KEYS = new Set(['bundle_id', 'bundle_path', 'github_owner', 'github_repo', 'project_name']);

function projectConfigPath(repoPath: string): string {
  return join(repoPath, '.throughline', 'project.json');
}

function repoBundlePath(repoPath: string): string {
  return join(repoPath, '.throughline', 'bundle.md');
}

export function projectConfigExists(repoPath: string): boolean {
  return existsSync(projectConfigPath(repoPath));
}

// Returns null if `.throughline/project.json` does not exist. Throws on any
// validation failure — a present but malformed file is a hard error, not a
// silent "no config" signal.
export function readProjectConfig(repoPath: string): ProjectConfig | null {
  const path = projectConfigPath(repoPath);
  if (!existsSync(path)) return null;

  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? 'EUNKNOWN';
    throw new InvalidProjectConfigError(`unreadable (${code})`, path);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new InvalidProjectConfigError(`malformed JSON — ${msg}`, path);
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new InvalidProjectConfigError('top level must be a JSON object', path);
  }

  const obj = parsed as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new InvalidProjectConfigError(`unknown top-level key "${key}"`, path);
    }
  }

  const bundleId = obj['bundle_id'];
  if (typeof bundleId !== 'string' || bundleId.length === 0) {
    throw new InvalidProjectConfigError('"bundle_id" is required and must be a non-empty string', path);
  }

  // bundle_path may be absolute OR repo-relative (per schema). Resolve relative
  // forms against repoPath so the persisted value is unambiguous.
  let bundlePath: string | null = null;
  const rawBundlePath = obj['bundle_path'];
  if (rawBundlePath !== undefined && rawBundlePath !== null) {
    if (typeof rawBundlePath !== 'string' || rawBundlePath.length === 0) {
      throw new InvalidProjectConfigError('"bundle_path" must be a non-empty string when set', path);
    }
    bundlePath = isAbsolute(rawBundlePath) ? rawBundlePath : resolve(repoPath, rawBundlePath);
  }

  const githubOwner = obj['github_owner'];
  if (githubOwner !== undefined && githubOwner !== null && typeof githubOwner !== 'string') {
    throw new InvalidProjectConfigError('"github_owner" must be a string when set', path);
  }
  const githubRepo = obj['github_repo'];
  if (githubRepo !== undefined && githubRepo !== null && typeof githubRepo !== 'string') {
    throw new InvalidProjectConfigError('"github_repo" must be a string when set', path);
  }
  const projectName = obj['project_name'];
  if (projectName !== undefined && projectName !== null && typeof projectName !== 'string') {
    throw new InvalidProjectConfigError('"project_name" must be a string when set', path);
  }

  // C-D19 — when `.throughline/bundle.md` is also present, its §1 Identity
  // `name:` field must match the project.json `bundle_id`. Mismatch is a hard
  // error because it indicates the per-repo bundle file does not declare the
  // bundle the project means to bind to.
  const bundleFile = repoBundlePath(repoPath);
  if (existsSync(bundleFile)) {
    let bundleMd: string;
    try {
      bundleMd = readFileSync(bundleFile, 'utf8');
    } catch {
      // Unreadable sibling: skip the cross-check. The loader's arm 2 will
      // surface the underlying read failure on its own audit path.
      bundleMd = '';
    }
    if (bundleMd.length > 0) {
      const parsedBundle = parseBundle(bundleId, bundleMd);
      if (parsedBundle.status === 'loaded' && parsedBundle.bundle.identity.name !== bundleId) {
        throw new BundleIdMismatchError(bundleId, parsedBundle.bundle.identity.name);
      }
    }
  }

  return {
    bundle_id: bundleId,
    bundle_path: bundlePath,
    github_owner: (githubOwner as string | undefined) ?? null,
    github_repo: (githubRepo as string | undefined) ?? null,
    project_name: (projectName as string | undefined) ?? null,
  };
}
