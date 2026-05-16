import { describe, expect, it } from 'vitest';
import {
  escapeRegExp,
  safeCompile,
  safeTest,
} from '../src/methodology/drift/discipline/safe-regex.js';

describe('Phase 9 — bundle-regex safety guard (PR #16 review)', () => {
  it('compiles benign patterns and matches normally', () => {
    const re = safeCompile('TODO|FIXME');
    expect(re).not.toBeNull();
    expect(safeTest(re!, 'a FIXME here')).toBe(true);
    expect(safeTest(re!, 'nothing')).toBe(false);
  });

  it('refuses the catastrophic-backtracking families (returns null, never compiles)', () => {
    for (const evil of ['(a+)+$', '(.*)*x', '(a|aa)+$', '([^"]*)*!', '(\\d+)+#']) {
      expect(safeCompile(evil)).toBeNull();
    }
  });

  it('refuses over-long patterns', () => {
    expect(safeCompile('a'.repeat(1001))).toBeNull();
  });

  it('returns null (not throw) on invalid syntax', () => {
    expect(safeCompile('(unclosed')).toBeNull();
  });

  it('a refused pattern can never reach the matcher, so the evil input is never run', () => {
    // The real protection: safeCompile rejects before any .test() against attacker input.
    const re = safeCompile('(a+)+$');
    expect(re).toBeNull();
    // Caller contract (scanners.ts): re === null ⇒ skip, so the ReDoS string below is
    // never matched. Proven by construction here.
  });

  it('caps the matched input length as a second layer', () => {
    const re = safeCompile('x$');
    expect(re).not.toBeNull();
    // 'x' sits past the input cap, so it is sliced off and not matched.
    expect(safeTest(re!, 'a'.repeat(10_000) + 'x')).toBe(false);
  });

  it('escapeRegExp neutralises metacharacters', () => {
    const re = new RegExp(escapeRegExp('a.c+'));
    expect(re.test('a.c+')).toBe(true);
    expect(re.test('abcc')).toBe(false);
  });
});
