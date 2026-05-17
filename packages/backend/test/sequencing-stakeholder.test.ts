import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AnthropicClient } from '../src/ai/anthropic.js';
import type { GateRuntime } from '../src/methodology/gates/runtime.js';
import type { GateFiringsResult } from '@throughline/shared';
import { createProjectsService } from '../src/projects/service.js';
import { createItemsService } from '../src/items/service.js';
import { createSequencingService, ProjectNotFoundError } from '../src/intelligence/sequencing.js';
import {
  createStakeholderService,
  ItemNotFoundError,
} from '../src/intelligence/stakeholder.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const FREEFORM = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantFreeform(dir: string): void {
  const target = join(dir, 'freeform');
  mkdirSync(target, { recursive: true });
  copyFileSync(FREEFORM, join(target, 'bundle.md'));
}
function fakeGateRuntime(result: GateFiringsResult): GateRuntime {
  return { listFirings: () => result } as unknown as GateRuntime;
}
function stubAnthropic(answer: string): AnthropicClient {
  return {
    available: () => true,
    call: async () => ({ text: answer, input_tokens: 20, output_tokens: 8, stop_reason: 'end_turn' }),
  };
}
function offAnthropic(): AnthropicClient {
  return { available: () => false, call: async () => { throw new Error('off'); } };
}
function costRows(db: import('../src/db/index.js').DB, feature: string): number {
  return (db.prepare(`SELECT COUNT(*) n FROM cost_telemetry WHERE feature = ?`).get(feature) as { n: number }).n;
}

async function setup(gates: GateFiringsResult = { groups: [] }, anthropic: AnthropicClient = offAnthropic()) {
  const cfg = makeTmpConfig();
  plantFreeform(cfg.methodologiesDir);
  const backend = await makeBackend(cfg);
  const projects = createProjectsService(backend.db, backend.registry);
  const items = createItemsService(backend.db, projects, backend.registry, {});
  const sequencing = createSequencingService({
    projects,
    items,
    gateRuntime: fakeGateRuntime(gates),
  });
  const stakeholder = createStakeholderService({ db: backend.db, projects, items, anthropic });
  const project = projects.create({ name: 'p1', repo_path: '/tmp/p1' });
  return { backend, projects, items, sequencing, stakeholder, project, cleanup: () => backend.cleanup() };
}

describe('Phase 14 — dependency-aware sequencing (SPEC §7.18)', () => {
  it('topo-orders by readiness + downstream impact and reports unblock impact', async () => {
    const s = await setup();
    try {
      const a = s.items.create({ project_id: s.project.id, title: 'A', status: 'open' });
      const b = s.items.create({ project_id: s.project.id, title: 'B', status: 'open' });
      const c = s.items.create({ project_id: s.project.id, title: 'C', status: 'open' });
      s.items.addBlocker(a.id, b.id); // B blocks A
      s.items.addBlocker(b.id, c.id); // C blocks B  → chain C → B → A

      const r = s.sequencing.doNext(s.project.id);
      expect(r.sequence[0]!.id).toBe(c.id); // only ready item, deepest impact
      expect(r.sequence.find((x) => x.id === c.id)!.downstream_unblocked).toBe(2);
      expect(r.sequence.find((x) => x.id === a.id)!.ready).toBe(false);
      expect(r.sequence.find((x) => x.id === a.id)!.blocker_chain_depth).toBe(2);
      expect(r.do_next.map((x) => x.id)).toEqual([c.id]);
      expect(r.unblock_impact).toEqual({ if_you_unblock: [c.id], items_freed: 2 });
    } finally {
      await s.cleanup();
    }
  });

  it('deprioritises items whose primary unit has a failing, non-overridden gate', async () => {
    const inUnit = { primary_unit_refs: ['unit-x'] };
    const s0 = await setup();
    // Create items first so we know the failing item's id, then rebuild with that gate.
    const flagged = s0.items.create({
      project_id: s0.project.id,
      title: 'flagged',
      status: 'open',
      methodology_context: inUnit,
    });
    const clean = s0.items.create({ project_id: s0.project.id, title: 'clean', status: 'open' });
    const seq = createSequencingService({
      projects: s0.projects,
      items: s0.items,
      gateRuntime: fakeGateRuntime({
        groups: [
          {
            moment: 'pre-write',
            firings: [
              {
                id: 'g1',
                project_id: s0.project.id,
                moment: 'pre-write',
                gate_id: 'verify',
                status: 'fail',
                findings: { check: 'x', summary: 's', items: [{ message: 'bad', ref: flagged.id }] },
                created_at: new Date().toISOString(),
              },
            ],
          },
        ],
      }),
    });
    try {
      const r = seq.doNext(s0.project.id);
      const f = r.sequence.find((x) => x.id === flagged.id)!;
      const c = r.sequence.find((x) => x.id === clean.id)!;
      expect(f.gate_deprioritised).toBe(true);
      expect(c.gate_deprioritised).toBe(false);
      // Gate-deprioritised item sinks below the clean one.
      expect(r.sequence.findIndex((x) => x.id === clean.id)).toBeLessThan(
        r.sequence.findIndex((x) => x.id === flagged.id),
      );
      expect(r.do_next.map((x) => x.id)).toEqual([clean.id]);
    } finally {
      await s0.cleanup();
    }
  });

  it('rejects an unknown project', async () => {
    const s = await setup();
    try {
      expect(() => s.sequencing.doNext('nope')).toThrowError(ProjectNotFoundError);
    } finally {
      await s.cleanup();
    }
  });
});

describe('Phase 14 — stakeholder view (T-D17)', () => {
  it('AI-renders, caches, and records cost + audit', async () => {
    const s = await setup({ groups: [] }, stubAnthropic('Plain-language summary.'));
    try {
      const it = s.items.create({ project_id: s.project.id, title: 'tech item', description: 'gnarly', status: 'open' });
      const r1 = await s.stakeholder.render(s.project.id, it.id);
      expect(r1.used_ai).toBe(true);
      expect(r1.cached).toBe(false);
      expect(r1.rendered).toContain('Plain-language');
      expect(costRows(s.backend.db, 'stakeholder_view')).toBe(1);

      const r2 = await s.stakeholder.render(s.project.id, it.id);
      expect(r2.cached).toBe(true);
      expect(costRows(s.backend.db, 'stakeholder_view')).toBe(1); // no second AI call
    } finally {
      await s.cleanup();
    }
  });

  it('cache invalidates when the item content changes', async () => {
    const s = await setup({ groups: [] }, offAnthropic());
    try {
      const it = s.items.create({ project_id: s.project.id, title: 'orig', description: 'd', status: 'open' });
      const r1 = await s.stakeholder.render(s.project.id, it.id);
      expect(r1.used_ai).toBe(false);
      expect((await s.stakeholder.render(s.project.id, it.id)).cached).toBe(true);

      s.items.update(it.id, { title: 'edited title' });
      const r3 = await s.stakeholder.render(s.project.id, it.id);
      expect(r3.cached).toBe(false);
      expect(r3.rendered).toContain('edited title');
    } finally {
      await s.cleanup();
    }
  });

  it('rejects an item that is not in the project', async () => {
    const s = await setup();
    try {
      await expect(
        s.stakeholder.render(s.project.id, 'ghost'),
      ).rejects.toBeInstanceOf(ItemNotFoundError);
    } finally {
      await s.cleanup();
    }
  });
});
