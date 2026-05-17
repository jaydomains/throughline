import { describe, expect, it } from 'vitest';
import { createModelResolver } from '../src/ai/model-resolver.js';

const SONNET = 'claude-sonnet-4-6';
const HAIKU = 'claude-haiku-4-5';
const OPUS = 'claude-opus-4-7';

function resolverFrom(store: Record<string, unknown>) {
  return createModelResolver((k) => store[k]);
}

describe('Phase 16 (DoD) — per-feature model-override resolution (SPEC §9 / CODE_SPEC §14/§19)', () => {
  it('falls back to the CODE_SPEC §14 default when nothing is configured', () => {
    const resolve = resolverFrom({});
    expect(resolve('chat', SONNET)).toBe(SONNET);
    expect(resolve('session_start', HAIKU)).toBe(HAIKU);
  });

  it('per-feature override wins, even over a Haiku-by-design default', () => {
    const resolve = resolverFrom({
      model_override_session_start: 'opus',
      model_override_chat: 'haiku',
    });
    expect(resolve('session_start', HAIKU)).toBe(OPUS);
    expect(resolve('chat', SONNET)).toBe(HAIKU);
  });

  it('global default_model moves Sonnet-tier features', () => {
    const resolve = resolverFrom({ default_model: 'opus' });
    expect(resolve('chat', SONNET)).toBe(OPUS);
    expect(resolve('reconcile', SONNET)).toBe(OPUS);
  });

  it('global default_model does NOT move Haiku-by-design features (cost intent preserved)', () => {
    const resolve = resolverFrom({ default_model: 'opus' });
    expect(resolve('dedup', HAIKU)).toBe(HAIKU);
    expect(resolve('session_start', HAIKU)).toBe(HAIKU);
  });

  it('per-feature override beats the global default for the same feature', () => {
    const resolve = resolverFrom({ default_model: 'opus', model_override_chat: 'haiku' });
    expect(resolve('chat', SONNET)).toBe(HAIKU);
  });

  it('ignores unknown / malformed alias values and falls through', () => {
    const resolve = resolverFrom({
      default_model: 'gpt-9',
      model_override_chat: 42,
      model_override_retro: '',
    });
    expect(resolve('chat', SONNET)).toBe(SONNET);
    expect(resolve('retro', SONNET)).toBe(SONNET);
  });

  it('maps every alias to its CODE_SPEC §14 model id', () => {
    expect(resolverFrom({ model_override_x: 'haiku' })('x', SONNET)).toBe(HAIKU);
    expect(resolverFrom({ model_override_x: 'sonnet' })('x', HAIKU)).toBe(SONNET);
    expect(resolverFrom({ model_override_x: 'opus' })('x', SONNET)).toBe(OPUS);
  });
});
