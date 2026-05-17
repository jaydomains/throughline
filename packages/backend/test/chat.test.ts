import { describe, expect, it, vi } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AnthropicClient } from '../src/ai/anthropic.js';
import type { DumpZoneService } from '../src/dump-zone/service.js';
import type { DumpZoneProposal } from '@throughline/shared';
import { createProjectsService } from '../src/projects/service.js';
import { createItemsService } from '../src/items/service.js';
import { createSessionsService } from '../src/sessions/service.js';
import { createChatService, ProjectNotFoundError } from '../src/intelligence/chat.js';
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
function costRows(db: import('../src/db/index.js').DB, feature: string): number {
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
});
