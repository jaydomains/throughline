import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCommunicationModel } from '../src/methodology/bundle-parser/communication-model.js';
import { parseBundle } from '../src/methodology/bundle-parser/index.js';

// T-D49 — §6 grammar parser. These are the parser-level unit tests; the
// test-bundle fixture's §6 is exercised end-to-end in test-bundle.test.ts via
// parseBundle, but a couple of fixture-level assertions live here too so the
// happy-path shape is pinned to this file.

const TIERS_AB = ['tier-a', 'tier-b'] as const;

describe('parseCommunicationModel — happy path', () => {
  it('returns the "none" shape for an empty body', () => {
    const res = parseCommunicationModel('test', '', TIERS_AB);
    expect(res.errors).toEqual([]);
    expect(res.value?.status).toBe('none');
    expect(res.value?.edge_types).toEqual([]);
    expect(res.value?.tier_routing).toEqual([]);
    expect(res.value?.producer_ownership).toBeNull();
  });

  it('returns the "none" shape for a literal "none" body', () => {
    const res = parseCommunicationModel('test', 'none', TIERS_AB);
    expect(res.errors).toEqual([]);
    expect(res.value?.status).toBe('none');
  });

  it('parses direct and mediated edge types with optional contract_source / invariant', () => {
    const body = `### Edge type: mediated

when: tier-a <-> tier-a
mechanism: via router
contract_source: tier-a-flows
invariant: violation

### Edge type: direct-call

when: tier-a <-> tier-b
mechanism: direct
`;
    const res = parseCommunicationModel('test', body, TIERS_AB);
    expect(res.errors).toEqual([]);
    expect(res.value?.status).toBe('declared');
    expect(res.value?.edge_types).toHaveLength(2);

    const mediated = res.value!.edge_types[0]!;
    expect(mediated.name).toBe('mediated');
    expect(mediated.when).toEqual({ kind: 'pair', a: 'tier-a', b: 'tier-a' });
    expect(mediated.mechanism).toEqual({ kind: 'via', module_id: 'router' });
    expect(mediated.contract_source).toBe('tier-a-flows');
    expect(mediated.invariant).toBe('violation');

    const direct = res.value!.edge_types[1]!;
    expect(direct.name).toBe('direct-call');
    expect(direct.mechanism).toEqual({ kind: 'direct' });
    expect(direct.contract_source).toBeNull();
    expect(direct.invariant).toBeNull();
  });

  it('accepts `any` as a wildcard when:', () => {
    const body = `### Edge type: catch-all

when: any
mechanism: direct
`;
    const res = parseCommunicationModel('test', body, TIERS_AB);
    expect(res.errors).toEqual([]);
    expect(res.value?.edge_types[0]?.when).toEqual({ kind: 'any' });
  });

  it('parses tier-routing overrides and producer ownership', () => {
    const body = `### Edge type: stub

when: tier-a <-> tier-b
mechanism: direct

### Tier routing: tier-b

mechanism: direct
note: tier-b always direct

### Producer ownership

rule: producer-owns-shape
notes: producer owns the contract
`;
    const res = parseCommunicationModel('test', body, TIERS_AB);
    expect(res.errors).toEqual([]);
    expect(res.value?.tier_routing).toEqual([
      { tier: 'tier-b', mechanism: { kind: 'direct' }, note: 'tier-b always direct' },
    ]);
    expect(res.value?.producer_ownership).toEqual({
      rule: 'producer-owns-shape',
      notes: 'producer owns the contract',
    });
  });
});

describe('parseCommunicationModel — structural errors', () => {
  it('flags a missing when: clause', () => {
    const body = `### Edge type: bad

mechanism: direct
`;
    const res = parseCommunicationModel('test', body, TIERS_AB);
    expect(res.value).toBeUndefined();
    expect(res.errors.some((e) => /missing when/.test(e.message))).toBe(true);
  });

  it('flags a missing mechanism:', () => {
    const body = `### Edge type: bad

when: tier-a <-> tier-b
`;
    const res = parseCommunicationModel('test', body, TIERS_AB);
    expect(res.value).toBeUndefined();
    expect(res.errors.some((e) => /missing mechanism/.test(e.message))).toBe(true);
  });

  it('flags a mechanism declared as both direct and via …', () => {
    const body = `### Edge type: bad

when: tier-a <-> tier-b
mechanism: direct via router
`;
    const res = parseCommunicationModel('test', body, TIERS_AB);
    expect(res.value).toBeUndefined();
    expect(res.errors.some((e) => /cannot be both "direct" and "via …"/.test(e.message))).toBe(true);
  });

  it('flags a duplicate edge-type name', () => {
    const body = `### Edge type: dup

when: tier-a <-> tier-a
mechanism: direct

### Edge type: dup

when: tier-a <-> tier-b
mechanism: direct
`;
    const res = parseCommunicationModel('test', body, TIERS_AB);
    expect(res.value).toBeUndefined();
    expect(res.errors.some((e) => /duplicate edge-type name/.test(e.message))).toBe(true);
  });

  it('flags a tier name not declared in §2 — at parse time, not later (confirmation 1)', () => {
    const body = `### Edge type: bad

when: tier-a <-> tier-c
mechanism: direct
`;
    const res = parseCommunicationModel('test', body, TIERS_AB);
    expect(res.value).toBeUndefined();
    expect(
      res.errors.some((e) => /tier "tier-c" is not declared in §2/.test(e.message)),
    ).toBe(true);
  });

  it('flags a Tier-routing override referencing an undeclared tier', () => {
    const body = `### Tier routing: tier-x

mechanism: direct
`;
    const res = parseCommunicationModel('test', body, TIERS_AB);
    expect(res.value).toBeUndefined();
    expect(res.errors.some((e) => /tier "tier-x" is not declared in §2/.test(e.message))).toBe(true);
  });

  it('flags an unknown sub-section heading', () => {
    const body = `### Some other thing

key: value
`;
    const res = parseCommunicationModel('test', body, TIERS_AB);
    expect(res.value).toBeUndefined();
    expect(res.errors.some((e) => /Unknown sub-section/.test(e.message))).toBe(true);
  });

  it('flags producer-ownership with the wrong rule', () => {
    const body = `### Producer ownership

rule: consumer-owns-shape
`;
    const res = parseCommunicationModel('test', body, TIERS_AB);
    expect(res.value).toBeUndefined();
    expect(res.errors.some((e) => /must be "producer-owns-shape"/.test(e.message))).toBe(true);
  });
});

describe('parseCommunicationModel — test-bundle fixture (end-to-end through parseBundle)', () => {
  const TEST_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'test-bundle', 'bundle.md');

  it('test-bundle parses cleanly with the new §2 tiers and §6 grammar', () => {
    const md = readFileSync(TEST_BUNDLE_PATH, 'utf8');
    const result = parseBundle('test-bundle', md);
    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    expect(result.bundle.project_layout.tiers).toEqual(['tier-a', 'tier-b']);
    const cm = result.bundle.communication_model;
    expect(cm.status).toBe('declared');
    expect(cm.edge_types.map((e) => e.name)).toEqual(['mediated', 'direct-call']);
    expect(cm.edge_types[0]!.mechanism).toEqual({ kind: 'via', module_id: 'router' });
    expect(cm.edge_types[0]!.invariant).toBe('violation');
    expect(cm.tier_routing.map((t) => t.tier)).toEqual(['tier-b']);
    expect(cm.producer_ownership?.rule).toBe('producer-owns-shape');
  });
});
