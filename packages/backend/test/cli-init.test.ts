import { describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InitError, runInit } from '../src/cli/init.js';

function makeRepo(): { repoPath: string; cleanup: () => void } {
  const repoPath = mkdtempSync(join(tmpdir(), 'throughline-cli-init-'));
  mkdirSync(join(repoPath, '.throughline'), { recursive: true });
  return {
    repoPath,
    cleanup: () => rmSync(repoPath, { recursive: true, force: true }),
  };
}

function writeProjectJson(repoPath: string, body: object): void {
  writeFileSync(join(repoPath, '.throughline', 'project.json'), JSON.stringify(body));
}

// Build a stub fetch impl from a route table.
function makeFetch(
  table: Record<string, (init?: RequestInit) => Promise<Response> | Response>,
): typeof fetch {
  return ((url: string, init?: RequestInit) => {
    // Match `${method} ${path}` first, then fall back to path-only.
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    const key = `${method} ${path}`;
    const handler = table[key] ?? table[path];
    if (!handler) {
      throw new Error(`no stubbed response for ${key}`);
    }
    return Promise.resolve(handler(init));
  }) as unknown as typeof fetch;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('CLI throughline init (C-D19 surface 4)', () => {
  it('prints the canonical "Start the backend first:" message on probe failure', async () => {
    const { repoPath, cleanup } = makeRepo();
    try {
      writeProjectJson(repoPath, { bundle_id: 'freeform' });
      const fetchImpl = makeFetch({
        'GET /health': () => new Response(null, { status: 500 }),
      });
      await expect(
        runInit({ baseUrl: 'http://localhost:0', repoPath, fetchImpl }),
      ).rejects.toMatchObject({
        message: 'Start the backend first: pnpm --filter @throughline/backend start',
        exitCode: 1,
      });
    } finally {
      cleanup();
    }
  });

  it('prints the canonical message when fetch itself throws (connection refused)', async () => {
    const { repoPath, cleanup } = makeRepo();
    try {
      writeProjectJson(repoPath, { bundle_id: 'freeform' });
      const fetchImpl = (() => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch;
      await expect(
        runInit({ baseUrl: 'http://localhost:0', repoPath, fetchImpl }),
      ).rejects.toBeInstanceOf(InitError);
    } finally {
      cleanup();
    }
  });

  it('errors when `.throughline/project.json` is absent (first-run requires the file)', async () => {
    const { repoPath, cleanup } = makeRepo();
    try {
      const fetchImpl = makeFetch({
        'GET /health': () => new Response(null, { status: 200 }),
        'GET /api/projects?include_archived=true': () => jsonResponse(200, { projects: [] }),
      });
      await expect(
        runInit({ baseUrl: 'http://localhost:0', repoPath, fetchImpl }),
      ).rejects.toThrow(/No .throughline\/project.json/);
    } finally {
      cleanup();
    }
  });

  it('first-run path: POSTs an assembled payload to /api/projects', async () => {
    const { repoPath, cleanup } = makeRepo();
    try {
      writeProjectJson(repoPath, {
        bundle_id: 'freeform',
        github_owner: 'acme',
        github_repo: 'widgets',
        project_name: 'Acme widgets',
      });
      const recordedBody = vi.fn();
      const fetchImpl = makeFetch({
        'GET /health': () => new Response(null, { status: 200 }),
        'GET /api/projects?include_archived=true': () => jsonResponse(200, { projects: [] }),
        'POST /api/projects': (init) => {
          recordedBody(JSON.parse(init!.body as string));
          return jsonResponse(201, { project: { id: 'p-new' } });
        },
      });
      const result = await runInit({ baseUrl: 'http://localhost:0', repoPath, fetchImpl });
      expect(result.action).toBe('created');
      expect(result.projectId).toBe('p-new');
      expect(recordedBody).toHaveBeenCalledWith({
        name: 'Acme widgets',
        repo_path: repoPath,
        bundle_id: 'freeform',
        github_owner: 'acme',
        github_repo: 'widgets',
      });
    } finally {
      cleanup();
    }
  });

  it('first-run defaults project name to the repo basename when project.json is silent', async () => {
    const { repoPath, cleanup } = makeRepo();
    try {
      writeProjectJson(repoPath, { bundle_id: 'freeform' });
      const recordedBody = vi.fn();
      const fetchImpl = makeFetch({
        'GET /health': () => new Response(null, { status: 200 }),
        'GET /api/projects?include_archived=true': () => jsonResponse(200, { projects: [] }),
        'POST /api/projects': (init) => {
          recordedBody(JSON.parse(init!.body as string));
          return jsonResponse(201, { project: { id: 'p-default' } });
        },
      });
      await runInit({ baseUrl: 'http://localhost:0', repoPath, fetchImpl });
      const recordedCall = recordedBody.mock.calls[0]?.[0] as { name: string };
      // The basename of the tmp dir is the auto-default.
      expect(recordedCall.name).toBe(repoPath.split('/').pop());
    } finally {
      cleanup();
    }
  });

  it('first-run auto-detects github_owner/github_repo from origin remote when project.json is silent', async () => {
    const { repoPath, cleanup } = makeRepo();
    try {
      execFileSync('git', ['-C', repoPath, 'init', '-q'], { stdio: 'ignore' });
      execFileSync(
        'git',
        ['-C', repoPath, 'remote', 'add', 'origin', 'git@github.com:acme/widgets.git'],
        { stdio: 'ignore' },
      );
      writeProjectJson(repoPath, { bundle_id: 'freeform' });
      const recordedBody = vi.fn();
      const fetchImpl = makeFetch({
        'GET /health': () => new Response(null, { status: 200 }),
        'GET /api/projects?include_archived=true': () => jsonResponse(200, { projects: [] }),
        'POST /api/projects': (init) => {
          recordedBody(JSON.parse(init!.body as string));
          return jsonResponse(201, { project: { id: 'p-auto' } });
        },
      });
      await runInit({ baseUrl: 'http://localhost:0', repoPath, fetchImpl });
      const recordedCall = recordedBody.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(recordedCall.github_owner).toBe('acme');
      expect(recordedCall.github_repo).toBe('widgets');
    } finally {
      cleanup();
    }
  });

  it('re-init path: PATCHes /api/projects/:id with { reinit_throughline: true } when a project for this repo exists', async () => {
    const { repoPath, cleanup } = makeRepo();
    try {
      writeProjectJson(repoPath, { bundle_id: 'freeform' });
      const recordedBody = vi.fn();
      const fetchImpl = makeFetch({
        'GET /health': () => new Response(null, { status: 200 }),
        'GET /api/projects?include_archived=true': () =>
          jsonResponse(200, {
            projects: [{ id: 'p-existing', name: 'Existing', repo_path: repoPath }],
          }),
        [`PATCH /api/projects/p-existing`]: (init) => {
          recordedBody(JSON.parse(init!.body as string));
          return jsonResponse(200, { project: { id: 'p-existing' } });
        },
      });
      const result = await runInit({ baseUrl: 'http://localhost:0', repoPath, fetchImpl });
      expect(result.action).toBe('re-init');
      expect(result.projectId).toBe('p-existing');
      expect(recordedBody).toHaveBeenCalledWith({ reinit_throughline: true });
    } finally {
      cleanup();
    }
  });

  it('re-init path matches by exact persisted repo_path (Slice 1 normalisation collapses equivalents server-side)', async () => {
    const { repoPath, cleanup } = makeRepo();
    try {
      writeProjectJson(repoPath, { bundle_id: 'freeform' });
      // Server returns a different repo_path; no match → first-run path.
      const recordedPost = vi.fn();
      const fetchImpl = makeFetch({
        'GET /health': () => new Response(null, { status: 200 }),
        'GET /api/projects?include_archived=true': () =>
          jsonResponse(200, {
            projects: [{ id: 'p-other', name: 'Other', repo_path: '/some/other/repo' }],
          }),
        'POST /api/projects': (init) => {
          recordedPost(JSON.parse(init!.body as string));
          return jsonResponse(201, { project: { id: 'p-new' } });
        },
      });
      const result = await runInit({ baseUrl: 'http://localhost:0', repoPath, fetchImpl });
      expect(result.action).toBe('created');
      expect(recordedPost).toHaveBeenCalled();
    } finally {
      cleanup();
    }
  });
});
