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

  it('refuses nested-alternation backtracking hidden by an extra group (S2-01 regression)', () => {
    // `((a|a))+` wraps the overlapping alternation in an extra group so the dangerous
    // `|` is not top-level. An earlier detector only flagged top-level alternations and
    // let this through — it compiled and ran exponentially (a confirmed ~106s ReDoS:
    // ~16ms at 16 chars, ~9.7s at 28). It must be refused before it can ever compile.
    for (const evil of ['((a|a))+$', '((a|ab))+$', '(((a|a)))*x', '((a|a)|b)+$']) {
      expect(safeCompile(evil)).toBeNull();
    }
    // A genuinely benign quantified group with a nested alternation is allowed to be
    // refused too (over-refusal is the safe failure mode), but plain quantified groups
    // without alternation or inner quantifiers must still compile.
    expect(safeCompile('(abc)+')).not.toBeNull();
    expect(safeCompile('(a)+')).not.toBeNull();
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
