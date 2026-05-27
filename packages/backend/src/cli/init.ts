// C-D19 surface 4 — `throughline init` CLI subcommand.
//
// Single side-effect channel per T-D52: HTTP calls only, no datastore writes,
// no schema knowledge. Reads `.throughline/project.json` locally (Slice 2's
// reader, imported as library code from the same package); auto-detects the
// GitHub origin remote when the file is silent (Slice 2's helper); then either
// POSTs `/api/projects` (first-run) or PATCHes `/api/projects/:id` with
// `reinit_throughline: true` (re-init).
//
// Health probe lands on `GET /health` (T-D52 amended 2026-05-27 to match the
// implementation; the existing backend route at `routes/health.ts` was the
// canonical path).

import { basename } from 'node:path';
import { readProjectConfig } from '../init/config-reader.js';
import { detectGitHubRemote } from '../init/git-remote.js';

interface ProjectSummary {
  id: string;
  name: string;
  repo_path: string;
}

export interface InitOptions {
  baseUrl: string;
  repoPath: string;
  // Test seam: override the global fetch (Node 20+ has it built-in). Real
  // invocations leave this undefined.
  fetchImpl?: typeof fetch;
}

export class InitError extends Error {
  constructor(message: string, public readonly exitCode: number = 1) {
    super(message);
  }
}

const BACKEND_DOWN_MESSAGE = 'Start the backend first: pnpm --filter @throughline/backend start';

async function probeHealth(opts: InitOptions): Promise<void> {
  const fetchFn = opts.fetchImpl ?? fetch;
  try {
    const res = await fetchFn(`${opts.baseUrl}/health`);
    if (!res.ok) {
      throw new InitError(BACKEND_DOWN_MESSAGE, 1);
    }
  } catch (err) {
    if (err instanceof InitError) throw err;
    throw new InitError(BACKEND_DOWN_MESSAGE, 1);
  }
}

async function listProjects(opts: InitOptions): Promise<ProjectSummary[]> {
  const fetchFn = opts.fetchImpl ?? fetch;
  const res = await fetchFn(`${opts.baseUrl}/api/projects?include_archived=true`);
  if (!res.ok) {
    throw new InitError(`GET /api/projects -> ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as { projects: ProjectSummary[] };
  return body.projects;
}

async function postCreate(opts: InitOptions, body: Record<string, unknown>): Promise<{ id: string }> {
  const fetchFn = opts.fetchImpl ?? fetch;
  const res = await fetchFn(`${opts.baseUrl}/api/projects`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new InitError(`POST /api/projects -> ${res.status}: ${await res.text()}`);
  }
  const created = (await res.json()) as { project: { id: string } };
  return { id: created.project.id };
}

async function patchReinit(opts: InitOptions, projectId: string): Promise<void> {
  const fetchFn = opts.fetchImpl ?? fetch;
  const res = await fetchFn(`${opts.baseUrl}/api/projects/${projectId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reinit_throughline: true }),
  });
  if (!res.ok) {
    throw new InitError(`PATCH /api/projects/${projectId} -> ${res.status}: ${await res.text()}`);
  }
}

export interface InitResult {
  // 'created' on first-run; 're-init' when an existing project bound to repo_path was found.
  action: 'created' | 're-init';
  projectId: string;
}

// Find the project bound to repoPath using exact-string match. The backend
// normalises repo_path on every write (Slice 1, C-D19 surface 8), so by the
// time we list projects, equivalent paths have already collapsed.
function findByRepoPath(projects: ProjectSummary[], repoPath: string): ProjectSummary | null {
  for (const p of projects) if (p.repo_path === repoPath) return p;
  return null;
}

export async function runInit(opts: InitOptions): Promise<InitResult> {
  await probeHealth(opts);

  const existingProjects = await listProjects(opts);
  const existing = findByRepoPath(existingProjects, opts.repoPath);

  if (existing) {
    // Re-init path: backend is the single re-reader (T-D52, C-D19 surface 7).
    // The CLI sends only the flag; the backend reads `.throughline/project.json`
    // off the project's persisted (normalised) repo_path.
    await patchReinit(opts, existing.id);
    return { action: 're-init', projectId: existing.id };
  }

  // First-run path: the CLI does the local read + auto-detect and POSTs an
  // assembled payload. C-D19 surface 4 — POST /api/projects already exists;
  // no `init_throughline` flag on create, so the CLI assembles fields locally.
  const cfg = readProjectConfig(opts.repoPath);
  if (cfg === null) {
    throw new InitError(
      `No .throughline/project.json found in ${opts.repoPath}; throughline init expects clone-and-go config to exist.`,
    );
  }

  let owner = cfg.github_owner;
  let repo = cfg.github_repo;
  if (owner === null || repo === null) {
    const detected = detectGitHubRemote(opts.repoPath);
    if (detected) {
      if (owner === null) owner = detected.owner;
      if (repo === null) repo = detected.repo;
    }
  }

  const body: Record<string, unknown> = {
    name: cfg.project_name ?? basename(opts.repoPath),
    repo_path: opts.repoPath,
    bundle_id: cfg.bundle_id,
  };
  if (cfg.bundle_path !== null) body.bundle_path = cfg.bundle_path;
  if (owner !== null) body.github_owner = owner;
  if (repo !== null) body.github_repo = repo;

  const { id } = await postCreate(opts, body);
  return { action: 'created', projectId: id };
}
