import { describe, expect, it } from 'vitest';
import {
  createAnthropicSummariser,
  createHeuristicSummariser,
  createRoutingSummariser,
} from '../src/md-ingest/summariser.js';
import type { AnthropicClient } from '../src/ai/anthropic.js';

const DOC = '# Deploy Guide\n\nThis document explains the deploy pipeline in detail.\n\n## Steps\n\n- one\n- two';

describe('md-ingest summariser', () => {
  it('heuristic: first prose paragraph + filename/heading tags, no telemetry', async () => {
    const s = createHeuristicSummariser();
    const r = await s.summarise({ rel_path: 'docs/deploy.md', content: DOC });
    expect(r.summary).toBe('This document explains the deploy pipeline in detail.');
    expect(r.tags).toContain('deploy');
    expect(r.telemetry.model).toBeNull();
    expect(r.telemetry.input_tokens).toBe(0);
  });

  it('anthropic: parses STRICT JSON and carries telemetry for fingerprinting', async () => {
    const client: AnthropicClient = {
      available: () => true,
      call: async () => ({
        text: '```json\n{"summary":"Short AI summary.","tags":["Deploy","CI/CD"]}\n```',
        input_tokens: 80,
        output_tokens: 20,
        stop_reason: 'end_turn',
      }),
    };
    const s = createAnthropicSummariser({ client });
    const r = await s.summarise({ rel_path: 'docs/deploy.md', content: DOC });
    expect(r.summary).toBe('Short AI summary.');
    expect(r.tags).toEqual(['deploy', 'ci-cd']); // normalised
    expect(r.telemetry.model).toBe('claude-sonnet-4-6');
    expect(r.telemetry.prompt).toContain('docs/deploy.md');
  });

  it('anthropic: degrades to heuristic on non-JSON output but keeps token telemetry', async () => {
    const client: AnthropicClient = {
      available: () => true,
      call: async () => ({
        text: 'sorry, I cannot do that',
        input_tokens: 10,
        output_tokens: 5,
        stop_reason: 'end_turn',
      }),
    };
    const s = createAnthropicSummariser({ client });
    const r = await s.summarise({ rel_path: 'docs/deploy.md', content: DOC });
    expect(r.summary).toBe('This document explains the deploy pipeline in detail.');
    expect(r.telemetry.model).toBe('claude-sonnet-4-6');
    expect(r.telemetry.input_tokens).toBe(10);
  });

  it('routing: uses heuristic when the key is absent', async () => {
    const client: AnthropicClient = {
      available: () => false,
      call: async () => {
        throw new Error('should not be called');
      },
    };
    const s = createRoutingSummariser({
      anthropic: createAnthropicSummariser({ client }),
      heuristic: createHeuristicSummariser(),
      client,
    });
    const r = await s.summarise({ rel_path: 'docs/deploy.md', content: DOC });
    expect(r.telemetry.model).toBeNull();
    expect(r.summary).toContain('deploy pipeline');
  });
});
