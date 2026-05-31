import { describe, expect, it, vi } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { DB } from '../src/db/index.js';
import type { AnthropicClient } from '../src/ai/anthropic.js';
import type { DumpZoneService } from '../src/dump-zone/service.js';
import type { DumpZoneProposal } from '@throughline/shared';
import { createProjectsService } from '../src/projects/service.js';
import { createItemsService } from '../src/items/service.js';
import { createSessionsService } from '../src/sessions/service.js';
import { ProjectNotFoundError } from '@throughline/shared';
import { createChatService } from '../src/intelligence/chat.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const FREEFORM = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantFreeform(dir: string): void {
  const target = join(dir, 'freeform');
  mkdirSync(target, { recursive: true });
  copyFileSync(FREEFORM, join(target, 'bundle.md'));
}
function stubAnthropic(answer: string): AnthropicClient {
  return {
    available: () => true,
    call: async () => ({ text: answer, input_tokens: 25, output_tokens: 10, stop_reason: 'end_turn' }),
  };
}
function offAnthropic(): AnthropicClient {
  return { available: () => false, call: async () => { throw new Error('off'); } };
}
// A configured key whose call fails — the SF3-03 case that used to masquerade as "no key".
function failingAnthropic(): AnthropicClient {
  return { available: () => true, call: async () => { throw new Error('502 upstream'); } };
}
function costRows(db: DB, feature: string): number {
  return (db.prepare(`SELECT COUNT(*) n FROM cost_telemetry WHERE feature = ?`).get(feature) as { n: number }).n;
}

async function setup(anthropic: AnthropicClient = offAnthropic()) {
  const cfg = makeTmpConfig();
  plantFreeform(cfg.methodologiesDir);
  const backend = await makeBackend(cfg);
  const projects = createProjectsService(backend.db, backend.registry);
  const items = createItemsService(backend.db, projects, backend.registry, {});
  const sessions = createSessionsService(backend.db, projects);
  const proposeSpy = vi.fn(
    async (input: { project_id: string; source: string; target: string }): Promise<DumpZoneProposal> =>
      ({
        id: 'prop1',
        project_id: input.project_id,
        target: input.target,
        source: input.source,
        extractor: 'heuristic',
        raw_text: 'x',
        payload: { items: [] },
        status: 'pending',
        created_at: new Date().toISOString(),
      }) as unknown as DumpZoneProposal,
  );
  const dumpZone = { propose: proposeSpy } as unknown as DumpZoneService;
  const chat = createChatService({
    db: backend.db,
    projects,
    items,
    registry: backend.registry,
    dumpZone,
    anthropic,
  });
  const project = projects.create({ name: 'p1', repo_path: '/tmp/p1' });
  return { backend, projects, items, sessions, chat, proposeSpy, project, cleanup: () => backend.cleanup() };
}

describe('Phase 14 — chat (SPEC §7.19, T-D23)', () => {
  it('per-list chat persists the turn and replies with session + methodology context', async () => {
    const s = await setup(stubAnthropic('Blocked items: none.'));
    try {
      const sess = s.sessions.create({ project_id: s.project.id, name: 'list-1' });
      const it = s.items.create({ project_id: s.project.id, title: 'task one', status: 'open' });
      s.items.addSessionMembership(it.id, sess.id);

      const r = await s.chat.send(s.project.id, {
        context_type: 'session',
        context_id: sess.id,
        message: "what's blocking the most stuff",
      });
      expect(r.used_ai).toBe(true);
      expect(r.assistant_message.content).toContain('Blocked items');
      expect(r.user_message.role).toBe('user');
      expect(costRows(s.backend.db, 'chat')).toBe(1);

      const hist = s.chat.history(s.project.id, 'session', sess.id);
      expect(hist.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
      expect(hist.messages[0]!.content).toContain('blocking');
    } finally {
      await s.cleanup();
    }
  });

  it('persists history independently per context and degrades with no AI key', async () => {
    const s = await setup(offAnthropic());
    try {
      await s.chat.send(s.project.id, { context_type: 'session', context_id: 'sX', message: 'hi list' });
      await s.chat.send(s.project.id, { context_type: 'dump_zone', context_id: s.project.id, message: 'hi dump' });

      const sHist = s.chat.history(s.project.id, 'session', 'sX');
      const dHist = s.chat.history(s.project.id, 'dump_zone', s.project.id);
      expect(sHist.messages).toHaveLength(2);
      expect(dHist.messages).toHaveLength(2);
      expect(sHist.messages[0]!.content).toBe('hi list');
      expect(dHist.messages[0]!.content).toBe('hi dump');
      // No-AI degrade: stub reply, no cost.
      expect(sHist.messages[1]!.content).toContain('AI is not configured');
      expect(costRows(s.backend.db, 'chat')).toBe(0);
    } finally {
      await s.cleanup();
    }
  });

  it('proposed changes route through the dump-zone review modal (no auto-mutation)', async () => {
    const s = await setup();
    try {
      const p = await s.chat.propose(s.project.id, {
        context_type: 'dump_zone',
        context_id: s.project.id,
        text: 'add a task: ship the thing',
        target: 'session',
        session_id: null,
      });
      expect(p.id).toBe('prop1');
      expect(s.proposeSpy).toHaveBeenCalledWith(
        expect.objectContaining({ project_id: s.project.id, source: 'paste', target: 'session' }),
      );
    } finally {
      await s.cleanup();
    }
  });

  it('rejects an unknown project', async () => {
    const s = await setup();
    try {
      await expect(
        s.chat.send('nope', { context_type: 'session', context_id: 'x', message: 'y' }),
      ).rejects.toBeInstanceOf(ProjectNotFoundError);
    } finally {
      await s.cleanup();
    }
  });

  it('a failed AI call reports ai_status "failed", not "no key configured" (T-D60, SF3-03)', async () => {
    const s = await setup(failingAnthropic());
    try {
      const r = await s.chat.send(s.project.id, {
        context_type: 'session',
        context_id: 's1',
        message: 'hello',
      });
      expect(r.used_ai).toBe(false);
      expect(r.ai_status).toBe('failed');
      // The honesty fix: a failed call must NOT read as "AI is not configured".
      expect(r.assistant_message.content).not.toContain('not configured');
      expect(r.assistant_message.content).toContain('AI call failed');
      expect(costRows(s.backend.db, 'chat')).toBe(0);
    } finally {
      await s.cleanup();
    }
  });

  it('no key reports ai_status "unavailable"; a usable reply reports "ok"', async () => {
    const off = await setup(offAnthropic());
    try {
      const r = await off.chat.send(off.project.id, {
        context_type: 'session',
        context_id: 's1',
        message: 'hi',
      });
      expect(r.used_ai).toBe(false);
      expect(r.ai_status).toBe('unavailable');
      expect(r.assistant_message.content).toContain('not configured');
    } finally {
      await off.cleanup();
    }
    const on = await setup(stubAnthropic('here is a reply'));
    try {
      const r = await on.chat.send(on.project.id, {
        context_type: 'session',
        context_id: 's1',
        message: 'hi',
      });
      expect(r.used_ai).toBe(true);
      expect(r.ai_status).toBe('ok');
    } finally {
      await on.cleanup();
    }
  });
});

describe('Phase 16 (DoD) — per-feature model override is consumed end-to-end', () => {
  it('routes the resolved model into the AI call and cost telemetry', async () => {
    const seen: string[] = [];
    const capturing: AnthropicClient = {
      available: () => true,
      call: async (input) => {
        seen.push(input.model);
        return { text: 'ok', input_tokens: 5, output_tokens: 3, stop_reason: 'end_turn' };
      },
    };
    const cfg = makeTmpConfig();
    plantFreeform(cfg.methodologiesDir);
    const backend = await makeBackend(cfg);
    try {
      const projects = createProjectsService(backend.db, backend.registry);
      const items = createItemsService(backend.db, projects, backend.registry, {});
      const dumpZone = { propose: vi.fn() } as unknown as DumpZoneService;
      // resolveModel stands in for the server.ts closure modelFor('chat', …);
      // an explicit per-feature override (Opus) must reach the call + telemetry.
      const chat = createChatService({
        db: backend.db,
        projects,
        items,
        registry: backend.registry,
        dumpZone,
        anthropic: capturing,
        resolveModel: () => 'claude-opus-4-7',
      });
      const project = projects.create({ name: 'p1', repo_path: '/tmp/p1' });
      await chat.send(project.id, { context_type: 'session', context_id: 's1', message: 'hi' });
      expect(seen).toEqual(['claude-opus-4-7']);
      expect(
        (
          backend.db
            .prepare(`SELECT model FROM cost_telemetry WHERE feature = 'chat'`)
            .get() as { model: string }
        ).model,
      ).toBe('claude-opus-4-7');
    } finally {
      await backend.cleanup();
    }
  });
});
