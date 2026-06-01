import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createProjectsService } from '../src/projects/service.js';
import { createLibraryService } from '../src/library/service.js';
import { createSpecAssistService } from '../src/library/spec-assist.js';
import { makeBackend, makeTmpConfig } from './helpers.js';
import type { AnthropicClient } from '../src/ai/anthropic.js';

const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantFreeform(methodologiesDir: string): void {
  const target = join(methodologiesDir, 'freeform');
  mkdirSync(target, { recursive: true });
  copyFileSync(FREEFORM_BUNDLE_PATH, join(target, 'bundle.md'));
}

function client(opts: { available: boolean; text?: string; throws?: boolean }): AnthropicClient {
  return {
    available: () => opts.available,
    call: async () => {
      if (opts.throws) throw new Error('upstream 500');
      return { text: opts.text ?? '', input_tokens: 40, output_tokens: 80, stop_reason: 'end_turn' };
    },
  };
}

async function setup(anthropic: AnthropicClient) {
  const cfg = makeTmpConfig();
  plantFreeform(cfg.methodologiesDir);
  const backend = await makeBackend(cfg);
  const projects = createProjectsService(backend.db, backend.registry);
  const library = createLibraryService(backend.db, projects);
  const specAssist = createSpecAssistService({ db: backend.db, projects, library, anthropic });
  const project = projects.create({ name: 'demo', repo_path: '/tmp/spec-assist' });
  return { backend, projects, library, specAssist, project };
}

describe('E20b — project-spec LLM-assist (draft-only, user-mediated)', () => {
  it('drafts a revision via AI without persisting anything (never auto-edits)', async () => {
    const { backend, library, specAssist, project } = await setup(
      client({ available: true, text: '# Project Spec\n\nRevised goals.' }),
    );
    try {
      const r = await specAssist.draft(project.id, 'tighten the goals');
      expect(r.status).toBe('ok');
      expect(r.used_ai).toBe(true);
      expect(r.draft).toContain('Revised goals');
      // Draft-only: no project_spec entry was written.
      expect(library.list({ projectId: project.id, type: 'project_spec' })).toHaveLength(0);
      // The draft is audited as a proposal (applied:false), and cost is recorded (T-D24/T-D29).
      const audit = backend.db
        .prepare("SELECT trigger_context_json FROM audit_log WHERE field = 'project_spec_draft'")
        .get() as { trigger_context_json: string } | undefined;
      expect(audit).toBeTruthy();
      const ctx = JSON.parse(audit!.trigger_context_json) as { applied: boolean; prompt_fingerprint: string };
      expect(ctx.applied).toBe(false);
      expect(ctx.prompt_fingerprint).toBeTruthy();
      const cost = backend.db
        .prepare("SELECT COUNT(*) n FROM cost_telemetry WHERE feature = 'project_spec_assist'")
        .get() as { n: number };
      expect(cost.n).toBe(1);
    } finally {
      await backend.cleanup();
    }
  });

  it('caps an over-long instruction before it reaches the model (bounds token cost)', async () => {
    let seen = '';
    const recording: AnthropicClient = {
      available: () => true,
      call: async (input) => {
        seen = String(input.messages[0]?.content ?? '');
        return { text: '# Spec', input_tokens: 1, output_tokens: 1, stop_reason: 'end_turn' };
      },
    };
    const { backend, specAssist, project } = await setup(recording);
    try {
      await specAssist.draft(project.id, 'x'.repeat(5000));
      const instrPart = seen.split('Revision instruction:\n')[1] ?? '';
      expect(instrPart.length).toBe(2000); // capped, not the full 5000
    } finally {
      await backend.cleanup();
    }
  });

  it('discloses unavailable (no draft) when AI is not configured — never a fabricated draft (T-D60)', async () => {
    const { backend, specAssist, project } = await setup(client({ available: false }));
    try {
      const r = await specAssist.draft(project.id, 'anything');
      expect(r).toEqual({ draft: null, used_ai: false, status: 'unavailable' });
    } finally {
      await backend.cleanup();
    }
  });

  it('reports a failed draft when the AI call throws (no draft, no fabrication)', async () => {
    const { backend, specAssist, project } = await setup(client({ available: true, throws: true }));
    try {
      const r = await specAssist.draft(project.id, 'anything');
      expect(r).toEqual({ draft: null, used_ai: false, status: 'failed' });
    } finally {
      await backend.cleanup();
    }
  });
});
