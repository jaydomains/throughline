import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, type ServerHandle } from '../src/server.js';
import { makeTmpConfig } from './helpers.js';

const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantFreeform(methodologiesDir: string): void {
  const target = join(methodologiesDir, 'freeform');
  mkdirSync(target, { recursive: true });
  copyFileSync(FREEFORM_BUNDLE_PATH, join(target, 'bundle.md'));
}

interface TestRun {
  server: ServerHandle;
  cleanup: () => Promise<void>;
}

async function makeRun(): Promise<TestRun> {
  const cfg = makeTmpConfig({ port: 0 });
  plantFreeform(cfg.methodologiesDir);
  // serveFrontend=false: tests don't need the SPA, and the catch-all would
  // otherwise consume 404 paths and break the assertions.
  const server = await startServer(cfg, { serveFrontend: false });
  return {
    server,
    cleanup: async () => {
      await server.close();
      cfg.cleanup();
    },
  };
}

describe('GET /api/methodologies', () => {
  let run: TestRun;
  beforeEach(async () => {
    run = await makeRun();
  });
  afterEach(async () => {
    await run.cleanup();
  });

  it('reports freeform bundle with has_primary_unit=false and has_gates=false', async () => {
    const res = await fetch(`${run.server.url}/api/methodologies`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      methodologies: Array<{
        status: string;
        bundle_id: string;
        has_primary_unit?: boolean;
        has_gates?: boolean;
      }>;
    };
    const freeform = body.methodologies.find((m) => m.bundle_id === 'freeform');
    expect(freeform).toBeDefined();
    expect(freeform?.status).toBe('loaded');
    expect(freeform?.has_primary_unit).toBe(false);
    expect(freeform?.has_gates).toBe(false);
  });
});

describe('POST /api/projects/:id/switch', () => {
  let run: TestRun;
  beforeEach(async () => {
    run = await makeRun();
  });
  afterEach(async () => {
    await run.cleanup();
  });

  it('writes last_active_project_id into settings and audit-logs the change', async () => {
    const created = await fetch(`${run.server.url}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Switchable', repo_path: '/tmp/sw' }),
    });
    expect(created.status).toBe(201);
    const { project } = (await created.json()) as { project: { id: string } };

    const switched = await fetch(`${run.server.url}/api/projects/${project.id}/switch`, {
      method: 'POST',
    });
    expect(switched.status).toBe(200);
    expect(await switched.json()).toEqual({ ok: true });

    const settingsRes = await fetch(`${run.server.url}/api/settings`);
    const { settings } = (await settingsRes.json()) as {
      settings: Record<string, unknown>;
    };
    expect(settings['last_active_project_id']).toBe(project.id);

    const audit = run.server.db
      .prepare("SELECT field FROM audit_log WHERE entity_type = 'settings' AND entity_id = ?")
      .all('last_active_project_id') as Array<{ field: string }>;
    expect(audit.length).toBeGreaterThan(0);
  });

  it('404s for unknown project', async () => {
    const res = await fetch(`${run.server.url}/api/projects/does-not-exist/switch`, {
      method: 'POST',
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/gate-trigger', () => {
  let run: TestRun;
  beforeEach(async () => {
    run = await makeRun();
  });
  afterEach(async () => {
    await run.cleanup();
  });

  it('404s when an explicit project_id does not resolve (misrouted trigger fails loudly)', async () => {
    const res = await fetch(`${run.server.url}/api/gate-trigger`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ moment: 'plan-mode', project_id: 'does-not-exist' }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'project_not_found' });
  });

  it('still accepts a loopback trigger with no project_id (best-effort, no-resolve)', async () => {
    const res = await fetch(`${run.server.url}/api/gate-trigger`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ moment: 'plan-mode' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, fired: 0 });
  });
});

describe('items + sessions REST', () => {
  let run: TestRun;
  beforeEach(async () => {
    run = await makeRun();
  });
  afterEach(async () => {
    await run.cleanup();
  });

  it('round-trips a session + item + policy + audit through the API', async () => {
    const created = await fetch(`${run.server.url}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'demo', repo_path: '/tmp/d' }),
    });
    const { project } = (await created.json()) as { project: { id: string } };

    const policyRes = await fetch(`${run.server.url}/api/projects/${project.id}/policy`);
    const { policy } = (await policyRes.json()) as { policy: { types: string[]; statuses: string[] } };
    expect(policy.types).toEqual(['task']);
    expect(policy.statuses).toEqual(['open', 'done']);

    const sessionRes = await fetch(`${run.server.url}/api/projects/${project.id}/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'wave 1' }),
    });
    expect(sessionRes.status).toBe(201);
    const { session } = (await sessionRes.json()) as { session: { id: string } };

    const itemRes = await fetch(`${run.server.url}/api/projects/${project.id}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'first task' }),
    });
    expect(itemRes.status).toBe(201);
    const { item } = (await itemRes.json()) as { item: { id: string } };

    const linkRes = await fetch(
      `${run.server.url}/api/projects/${project.id}/items/${item.id}/sessions/${session.id}`,
      { method: 'POST' },
    );
    expect(linkRes.status).toBe(200);

    const sessionItems = await fetch(
      `${run.server.url}/api/projects/${project.id}/items?session_id=${session.id}`,
    );
    const itemsBody = (await sessionItems.json()) as { items: Array<{ id: string }> };
    expect(itemsBody.items.map((i) => i.id)).toEqual([item.id]);

    const audit = await fetch(
      `${run.server.url}/api/audit?entity_type=item&entity_id=${item.id}`,
    );
    const { entries } = (await audit.json()) as { entries: Array<{ field: string }> };
    expect(entries.some((e) => e.field === 'create')).toBe(true);
  });

  it('returns default stale_threshold_days from /api/settings', async () => {
    const res = await fetch(`${run.server.url}/api/settings`);
    const { settings } = (await res.json()) as { settings: Record<string, unknown> };
    expect(settings['stale_threshold_days']).toBe(14);
  });
});

describe('GET /events (SSE)', () => {
  let run: TestRun;
  beforeEach(async () => {
    run = await makeRun();
  });
  afterEach(async () => {
    await run.cleanup();
  });

  it('streams a welcome event on connect', async () => {
    const ac = new AbortController();
    const res = await fetch(`${run.server.url}/events`, {
      signal: ac.signal,
      headers: { accept: 'text/event-stream' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type') ?? '').toContain('text/event-stream');

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
      // Pull until we see the welcome frame or hit a small read budget.
      for (let i = 0; i < 5 && !buf.includes('event: welcome'); i += 1) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
      }
    } finally {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
      ac.abort();
    }
    expect(buf).toContain('event: welcome');
    expect(buf).toMatch(/data: \{.*"at":/);
  });
});

describe('Phase 15 — backup / cost / secrets routes', () => {
  let run: TestRun;
  beforeEach(async () => {
    run = await makeRun();
  });
  afterEach(async () => {
    await run.cleanup();
  });

  it('GET /api/backup/status reports never-backed-up as stale', async () => {
    const res = await fetch(`${run.server.url}/api/backup/status`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      last_backup_at: string | null;
      stale: boolean;
      threshold_days: number;
      auto_copy_target_path: string | null;
    };
    expect(body.last_backup_at).toBeNull();
    expect(body.stale).toBe(true);
    expect(body.threshold_days).toBe(7);
    expect(body.auto_copy_target_path).toBeNull();
  });

  it('POST /api/backup/export streams a SQLite snapshot download', async () => {
    const res = await fetch(`${run.server.url}/api/backup/export`, { method: 'POST' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition') ?? '').toMatch(
      /attachment; filename="throughline-backup-.*\.sqlite"/,
    );
    const buf = Buffer.from(await res.arrayBuffer());
    // SQLite file header magic.
    expect(buf.subarray(0, 16).toString('utf8')).toContain('SQLite format 3');
    const status = await (await fetch(`${run.server.url}/api/backup/status`)).json();
    expect((status as { last_backup_at: string | null }).last_backup_at).not.toBeNull();
  });

  it('GET /api/cost/summary returns zeroed windows on a fresh datastore', async () => {
    const res = await fetch(`${run.server.url}/api/cost/summary?scope=global`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      scope: string;
      day: { usd_estimate: number };
      daily_threshold_usd: number | null;
    };
    expect(body.scope).toBe('global');
    expect(body.day.usd_estimate).toBe(0);
    expect(body.daily_threshold_usd).toBeNull();
  });

  it('secrets are write-only: PUT then GET returns presence booleans only', async () => {
    let res = await fetch(`${run.server.url}/api/secrets`);
    expect(await res.json()).toEqual({ anthropic_api_key: false, github_pat: false });

    res = await fetch(`${run.server.url}/api/secrets`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ anthropic_api_key: 'sk-xyz' }),
    });
    expect(res.status).toBe(200);
    const after = (await res.json()) as Record<string, unknown>;
    expect(after).toEqual({ anthropic_api_key: true, github_pat: false });
    // The key value itself is never echoed.
    expect(JSON.stringify(after)).not.toContain('sk-xyz');
  });
});
