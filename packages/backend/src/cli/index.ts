#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from '../config.js';
import { InitError, runInit } from './init.js';

const config = loadConfig();
const BASE = `http://${config.host}:${config.port}`;

interface CommandContext {
  args: string[];
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok && res.status !== 204) {
    const detail = await res.text();
    throw new Error(`${method} ${path} -> ${res.status}: ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function helpText(): string {
  return (
    [
      'throughline — Throughline CLI',
      '',
      'Usage:',
      '  throughline health',
      '  throughline init [--repo <path>]',
      '  throughline methodologies list',
      '  throughline projects list [--archived]',
      '  throughline projects create --name <name> --repo <path> [--bundle <id>]',
      '  throughline projects get <id>',
      '  throughline projects archive <id>',
      '  throughline projects unarchive <id>',
      '  throughline projects delete <id>',
      '',
      `Talks to the backend at ${BASE}.`,
      '',
    ].join('\n')
  );
}

// Explicit `--help`/`-h`: help is what was asked for, so it goes to stdout and exits 0.
function printHelp(): never {
  process.stdout.write(helpText());
  process.exit(0);
}

// Misuse (no command, unknown command, missing required arg): the usage text is a
// diagnostic, so it goes to stderr and exits non-zero.
function usage(): never {
  process.stderr.write(helpText());
  process.exit(2);
}

function parseFlag(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i === -1) return undefined;
  return args[i + 1];
}

async function projectsCmd(ctx: CommandContext): Promise<void> {
  const sub = ctx.args[0];
  const rest = ctx.args.slice(1);
  switch (sub) {
    case 'list': {
      const includeArchived = rest.includes('--archived');
      const data = await call<{ projects: unknown[] }>(
        'GET',
        `/api/projects${includeArchived ? '?include_archived=true' : ''}`,
      );
      process.stdout.write(JSON.stringify(data.projects, null, 2) + '\n');
      return;
    }
    case 'create': {
      const name = parseFlag(rest, '--name');
      const repo = parseFlag(rest, '--repo');
      const bundle = parseFlag(rest, '--bundle');
      if (!name || !repo) usage();
      const data = await call<{ project: unknown }>('POST', '/api/projects', {
        name,
        repo_path: repo,
        bundle_id: bundle,
      });
      process.stdout.write(JSON.stringify(data.project, null, 2) + '\n');
      return;
    }
    case 'get': {
      const id = rest[0];
      if (!id) usage();
      const data = await call<{ project: unknown }>('GET', `/api/projects/${id}`);
      process.stdout.write(JSON.stringify(data.project, null, 2) + '\n');
      return;
    }
    case 'archive':
    case 'unarchive': {
      const id = rest[0];
      if (!id) usage();
      const data = await call<{ project: unknown }>('PATCH', `/api/projects/${id}`, {
        state: sub === 'archive' ? 'archived' : 'active',
      });
      process.stdout.write(JSON.stringify(data.project, null, 2) + '\n');
      return;
    }
    case 'delete': {
      const id = rest[0];
      if (!id) usage();
      await call<void>('DELETE', `/api/projects/${id}`);
      process.stdout.write(`deleted ${id}\n`);
      return;
    }
    default:
      usage();
  }
}

async function methodologiesCmd(ctx: CommandContext): Promise<void> {
  const sub = ctx.args[0];
  if (sub !== 'list') usage();
  const data = await call<{ methodologies: unknown[] }>('GET', '/api/methodologies');
  process.stdout.write(JSON.stringify(data.methodologies, null, 2) + '\n');
}

async function initCmd(ctx: CommandContext): Promise<void> {
  const repoFlag = parseFlag(ctx.args, '--repo');
  const rawRepo = repoFlag ?? process.cwd();
  // Canonicalise the path so the lookup against the backend's normalised
  // repo_path column (Slice 1) matches reliably. If the path doesn't exist
  // yet, fall back to absolute-resolve.
  let repoPath: string;
  try {
    repoPath = realpathSync.native(rawRepo);
  } catch {
    repoPath = resolve(rawRepo);
  }
  try {
    const result = await runInit({ baseUrl: BASE, repoPath });
    process.stdout.write(
      `${result.action === 'created' ? 'Created' : 'Re-initialised'} project ${result.projectId} for ${repoPath}\n`,
    );
  } catch (err) {
    if (err instanceof InitError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(err.exitCode);
    }
    throw err;
  }
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === '--help' || cmd === '-h' || cmd === 'help') printHelp();
  if (!cmd) usage();
  try {
    switch (cmd) {
      case 'health':
        process.stdout.write(JSON.stringify(await call('GET', '/health'), null, 2) + '\n');
        return;
      case 'init':
        return initCmd({ args: rest });
      case 'methodologies':
        return methodologiesCmd({ args: rest });
      case 'projects':
        return projectsCmd({ args: rest });
      default:
        usage();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: ${message}\n`);
    process.exit(1);
  }
}

await main();
