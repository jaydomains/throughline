import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createProjectsService } from '../src/projects/service.js';
import { createSessionsService } from '../src/sessions/service.js';
import { createItemsService } from '../src/items/service.js';
import { createLibraryService } from '../src/library/service.js';
import { createDumpZoneService } from '../src/dump-zone/service.js';
import {
  createAnthropicExtractor,
  createHeuristicExtractor,
  createRoutingExtractor,
} from '../src/dump-zone/extractor.js';
import type { AnthropicClient } from '../src/ai/anthropic.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantFreeform(methodologiesDir: string): void {
  const target = join(methodologiesDir, 'freeform');
  mkdirSync(target, { recursive: true });
  copyFileSync(FREEFORM_BUNDLE_PATH, join(target, 'bundle.md'));
}

function unavailableClient(): AnthropicClient {
  return {
    available: () => false,
    call: async () => {
      throw new Error('not configured');
    },
  };
}

async function setup() {
  const cfg = makeTmpConfig();
  plantFreeform(cfg.methodologiesDir);
  const backend = await makeBackend(cfg);
  const projects = createProjectsService(backend.db, backend.registry);
  const sessions = createSessionsService(backend.db, projects);
  const items = createItemsService(backend.db, projects, backend.registry);
  const library = createLibraryService(backend.db, projects);
  const extractor = createRoutingExtractor({
    anthropic: createAnthropicExtractor({ client: unavailableClient() }),
    heuristic: createHeuristicExtractor(),
    client: unavailableClient(),
  });
  const dumpZone = createDumpZoneService({
    db: backend.db,
    projects,
    registry: backend.registry,
    items,
    library,
    extractor,
  });
  const project = projects.create({ name: 'demo', repo_path: '/tmp/demo' });
  const session = sessions.create({ project_id: project.id, name: 'inbox' });
  return { backend, projects, sessions, items, library, dumpZone, project, session };
}

describe('dump zone service', () => {
  it('heuristic propose splits paragraphs into one proposed item each (target=session)', async () => {
    const { backend, dumpZone, project } = await setup();
    try {
      const proposal = await dumpZone.propose({
        project_id: project.id,
        text: 'Fix the login bug\n\nAdd a tour for new users\n\nWrite tests for upload',
        target: 'session',
        source: 'paste',
        session_id: null,
      });
      expect(proposal.payload.extractor).toBe('heuristic');
      expect(proposal.payload.items).toHaveLength(3);
      expect(proposal.payload.items[0]!.title).toBe('Fix the login bug');
      expect(proposal.payload.items[0]!.type).toBe('task');
      expect(proposal.payload.items[0]!.status).toBe('open');
    } finally {
      await backend.cleanup();
    }
  });

  it('apply creates items, routes them to the suggested session, and audit-logs', async () => {
    const { backend, dumpZone, items, project, session } = await setup();
    try {
      const proposal = await dumpZone.propose({
        project_id: project.id,
        text: 'A\n\nB',
        target: 'session',
        source: 'paste',
        session_id: session.id,
      });
      const edited = {
        ...proposal.payload,
        items: proposal.payload.items.map((i) => ({ ...i, target_session_id: session.id })),
      };
      const result = dumpZone.apply({ proposal_id: proposal.id, payload: edited });
      expect(result.applied_item_ids).toHaveLength(2);
      const created = items.get(result.applied_item_ids[0]!);
      expect(created?.session_ids).toContain(session.id);

      // proposal is marked applied
      const refetched = dumpZone.get(proposal.id);
      expect(refetched?.status).toBe('applied');

      const audit = backend.db
        .prepare("SELECT field FROM audit_log WHERE entity_type = 'project' AND project_id = ?")
        .all(project.id) as Array<{ field: string }>;
      expect(audit.some((r) => r.field === 'dump_zone_propose')).toBe(true);
      expect(audit.some((r) => r.field === 'dump_zone_apply')).toBe(true);
    } finally {
      await backend.cleanup();
    }
  });

  it('apply with discard decisions skips those rows', async () => {
    const { backend, dumpZone, project } = await setup();
    try {
      const proposal = await dumpZone.propose({
        project_id: project.id,
        text: 'A\n\nB\n\nC',
        target: 'session',
        source: 'paste',
        session_id: null,
      });
      const discardId = proposal.payload.items[1]!.proposal_item_id;
      const result = dumpZone.apply({
        proposal_id: proposal.id,
        payload: proposal.payload,
        decisions: { [discardId]: 'discard' },
      });
      expect(result.applied_item_ids).toHaveLength(2);
    } finally {
      await backend.cleanup();
    }
  });

  it('library target creates library entries on apply, not items', async () => {
    const { backend, dumpZone, library, project } = await setup();
    try {
      const proposal = await dumpZone.propose({
        project_id: project.id,
        text: 'Note about deployment\n\nPrompt template idea',
        target: 'library',
        source: 'paste',
        session_id: null,
      });
      expect(proposal.payload.library).toHaveLength(2);
      const result = dumpZone.apply({ proposal_id: proposal.id, payload: proposal.payload });
      expect(result.applied_library_entry_ids).toHaveLength(2);
      const list = library.list({ projectId: project.id });
      expect(list.map((e) => e.title)).toContain('Note about deployment');
    } finally {
      await backend.cleanup();
    }
  });

  it('Anthropic extractor records cost telemetry + audit fingerprint when a key is available', async () => {
    const cfg = makeTmpConfig();
    plantFreeform(cfg.methodologiesDir);
    const backend = await makeBackend(cfg);
    const projects = createProjectsService(backend.db, backend.registry);
    const items = createItemsService(backend.db, projects, backend.registry);
    const library = createLibraryService(backend.db, projects);

    // Mock Anthropic client returning a valid JSON response.
    const client: AnthropicClient = {
      available: () => true,
      call: async () => ({
        text: JSON.stringify({
          items: [{ type: 'task', status: 'open', title: 'AI-extracted item', description: '' }],
          clarifying_questions: [],
        }),
        input_tokens: 100,
        output_tokens: 50,
        stop_reason: 'end_turn',
      }),
    };
    const extractor = createRoutingExtractor({
      anthropic: createAnthropicExtractor({ client }),
      heuristic: createHeuristicExtractor(),
      client,
    });
    const dumpZone = createDumpZoneService({
      db: backend.db,
      projects,
      registry: backend.registry,
      items,
      library,
      extractor,
    });
    const project = projects.create({ name: 'demo', repo_path: '/tmp/demo' });
    try {
      const proposal = await dumpZone.propose({
        project_id: project.id,
        text: 'arbitrary text',
        target: 'session',
        source: 'paste',
        session_id: null,
      });
      expect(proposal.payload.extractor).toBe('anthropic');
      expect(proposal.payload.items[0]!.title).toBe('AI-extracted item');

      const cost = backend.db
        .prepare("SELECT * FROM cost_telemetry WHERE feature = 'dump_zone_extraction'")
        .all() as Array<{ input_tokens: number; output_tokens: number }>;
      expect(cost).toHaveLength(1);
      expect(cost[0]!.input_tokens).toBe(100);
      expect(cost[0]!.output_tokens).toBe(50);

      const audit = backend.db
        .prepare(
          "SELECT trigger_context_json FROM audit_log WHERE field = 'dump_zone_propose' AND project_id = ?",
        )
        .get(project.id) as { trigger_context_json: string };
      const ctx = JSON.parse(audit.trigger_context_json) as Record<string, unknown>;
      expect(ctx.prompt_fingerprint).toBeTypeOf('string');
      expect((ctx.prompt_fingerprint as string).length).toBeGreaterThan(8);
    } finally {
      await backend.cleanup();
    }
  });

  it('discard marks the proposal discarded and apply rejects', async () => {
    const { backend, dumpZone, project } = await setup();
    try {
      const proposal = await dumpZone.propose({
        project_id: project.id,
        text: 'A',
        target: 'session',
        source: 'paste',
        session_id: null,
      });
      dumpZone.discard(proposal.id);
      expect(() => dumpZone.apply({ proposal_id: proposal.id, payload: proposal.payload })).toThrow();
    } finally {
      await backend.cleanup();
    }
  });
});

describe('dump zone — Phase 11 Semble enrichment (SPEC §7.15)', () => {
  it('attaches suggested_code_refs to proposed items, best-effort, never blocking', async () => {
    const cfg = makeTmpConfig();
    plantFreeform(cfg.methodologiesDir);
    const backend = await makeBackend(cfg);
    try {
      const projects = createProjectsService(backend.db, backend.registry);
      const items = createItemsService(backend.db, projects, backend.registry);
      const library = createLibraryService(backend.db, projects);
      const extractor = createRoutingExtractor({
        anthropic: createAnthropicExtractor({ client: unavailableClient() }),
        heuristic: createHeuristicExtractor(),
        client: unavailableClient(),
      });
      let throwOnce = true;
      const dumpZone = createDumpZoneService({
        db: backend.db,
        projects,
        registry: backend.registry,
        items,
        library,
        extractor,
        enrichItems: async (_projectId, proposed) =>
          proposed.map((p, i) => {
            // First proposed item simulates an enrichment failure for *its* slot only by
            // throwing for the whole batch on the first propose() call — exercised below.
            if (throwOnce && i === 0) {
              throwOnce = false;
              throw new Error('semble blew up');
            }
            return [
              { path: `src/${p.title.replace(/\s+/g, '-')}.ts`, line_start: 1, line_end: 3, snippet: 'x' },
            ];
          }),
      });
      const project = projects.create({ name: 'demo', repo_path: '/tmp/demo' });

      // First propose: enricher throws → extraction still succeeds, no suggestions.
      const first = await dumpZone.propose({
        project_id: project.id,
        text: 'Fix the login bug',
        target: 'session',
        source: 'paste',
        session_id: null,
      });
      expect(first.payload.items[0]!.suggested_code_refs).toBeUndefined();

      // Second propose: enricher succeeds → suggestions attached and persisted.
      const second = await dumpZone.propose({
        project_id: project.id,
        text: 'Add upload validation',
        target: 'session',
        source: 'paste',
        session_id: null,
      });
      expect(second.payload.items[0]!.suggested_code_refs).toEqual([
        { path: 'src/Add-upload-validation.ts', line_start: 1, line_end: 3, snippet: 'x' },
      ]);
      const refetched = dumpZone.get(second.id);
      expect(refetched?.payload.items[0]!.suggested_code_refs).toHaveLength(1);
    } finally {
      await backend.cleanup();
    }
  });
});
