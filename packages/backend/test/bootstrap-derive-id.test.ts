import { describe, expect, it } from 'vitest';
import {
  bootstrapId,
  extractBootstrapIdOverride,
  normalizeChecklistText,
  SOURCE_TYPES,
  type SourceType,
} from '../src/bootstrap/derive-id.js';

// Phase 20 — Slice 2 — derivation module tests (T-D54, C-D20 surface 3).
//
// The module is the single source of truth for `bootstrap_id` derivation per
// source type. Phase 21's prompt template references the same rules so the
// producer (Claude Code) emits IDs the consumer (this phase) recognises;
// regressions here corrupt both phases.

describe('Phase 20 derive-id module (T-D54, C-D20 surface 3)', () => {
  describe('bootstrapId() — per-source-type derivation', () => {
    it('decision: anchor id passes through verbatim', () => {
      expect(bootstrapId('decision', 'T-D53')).toBe('decision:T-D53');
      expect(bootstrapId('decision', 'WN-clone-Q2')).toBe('decision:WN-clone-Q2');
      // Custom bundle anchors per T-D54 ("equivalents in user bundles").
      expect(bootstrapId('decision', 'PRINCIPLE-1')).toBe('decision:PRINCIPLE-1');
    });

    it('roadmap: phase-<n> form is the stable key (prefix included)', () => {
      expect(bootstrapId('roadmap', 'phase-1')).toBe('roadmap:phase-1');
      expect(bootstrapId('roadmap', 'phase-20')).toBe('roadmap:phase-20');
    });

    it('handover: filename (with optional sub-anchor) passes through', () => {
      expect(bootstrapId('handover', '2026-05-25-session-3.md')).toBe('handover:2026-05-25-session-3.md');
      expect(bootstrapId('handover', '2026-05-25-session-3.md#sub-anchor')).toBe(
        'handover:2026-05-25-session-3.md#sub-anchor',
      );
    });

    it('checklist: raw text is normalised then sha256/16-char-hex prefixed with checklist:', () => {
      const id = bootstrapId('checklist', 'Build the bootstrap migration.');
      expect(id).toMatch(/^checklist:[0-9a-f]{16}$/);
    });

    it('checklist: hash is deterministic — same input twice produces same id', () => {
      const a = bootstrapId('checklist', 'Build the bootstrap migration.');
      const b = bootstrapId('checklist', 'Build the bootstrap migration.');
      expect(a).toBe(b);
    });

    it('checklist: normalisation absorbs casing / whitespace / trailing punctuation', () => {
      // All five variants should normalise to the same canonical key and produce the same id.
      const variants = [
        'Build the bootstrap migration.',
        'build the bootstrap migration',
        '  Build  the   bootstrap  migration.  ',
        'Build the bootstrap migration!',
        'BUILD THE BOOTSTRAP MIGRATION;',
      ];
      const ids = variants.map((v) => bootstrapId('checklist', v));
      expect(new Set(ids).size).toBe(1);
    });

    it('checklist: word-level edits break identity (creates new id)', () => {
      // T-D54: "casing/whitespace/punctuation typo-fixes preserve identity for
      // free; word-level semantic edits create new identity, and the
      // stale-flag (below) surfaces the prior row for user ack."
      const before = bootstrapId('checklist', 'Build the bootstrap migration.');
      const after = bootstrapId('checklist', 'Build the bootstrap migration and the endpoint.');
      expect(before).not.toBe(after);
    });

    it('override: user slug passes through verbatim under override: prefix', () => {
      expect(bootstrapId('override', 'my-stable-slug')).toBe('override:my-stable-slug');
      // Slugs that look like derived ids stay in the override namespace.
      expect(bootstrapId('override', 'decision-T-D1')).toBe('override:decision-T-D1');
    });

    it('rejects empty keys for every source type', () => {
      for (const t of SOURCE_TYPES) {
        expect(() => bootstrapId(t, '')).toThrow(/empty key/);
      }
    });

    it('rejects checklist keys that normalise to the empty string', () => {
      expect(() => bootstrapId('checklist', '   ')).toThrow(/empty string/);
      expect(() => bootstrapId('checklist', '...')).toThrow(/empty string/);
    });

    it('rejects unknown source types at runtime (exhaustive switch defence)', () => {
      // TypeScript blocks this at compile time; the runtime guard catches any
      // caller that bypasses the type system (untyped JSON, untyped JS importer).
      expect(() => bootstrapId('unknown' as SourceType, 'x')).toThrow(/unknown source type/);
    });
  });

  describe('normalizeChecklistText()', () => {
    it('lowercases input', () => {
      expect(normalizeChecklistText('FOO')).toBe('foo');
    });

    it('collapses internal whitespace runs to single spaces', () => {
      expect(normalizeChecklistText('foo   bar\n\nbaz')).toBe('foo bar baz');
    });

    it('trims leading and trailing whitespace', () => {
      expect(normalizeChecklistText('  foo  ')).toBe('foo');
    });

    it('strips trailing punctuation (. , ; : ! ?)', () => {
      expect(normalizeChecklistText('foo.')).toBe('foo');
      expect(normalizeChecklistText('foo,')).toBe('foo');
      expect(normalizeChecklistText('foo;')).toBe('foo');
      expect(normalizeChecklistText('foo:')).toBe('foo');
      expect(normalizeChecklistText('foo!')).toBe('foo');
      expect(normalizeChecklistText('foo?')).toBe('foo');
      expect(normalizeChecklistText('foo!!!')).toBe('foo');
      expect(normalizeChecklistText('foo.;')).toBe('foo');
    });

    it('leaves internal punctuation alone', () => {
      expect(normalizeChecklistText('foo, bar.')).toBe('foo, bar');
      expect(normalizeChecklistText('foo.bar')).toBe('foo.bar');
    });

    it('preserves the empty string', () => {
      expect(normalizeChecklistText('')).toBe('');
      expect(normalizeChecklistText('   ')).toBe('');
    });
  });

  describe('extractBootstrapIdOverride()', () => {
    it('extracts a well-formed override marker', () => {
      expect(extractBootstrapIdOverride('Body text <!-- @bootstrap-id: my-slug -->')).toBe('my-slug');
    });

    it('trims surrounding whitespace inside the marker', () => {
      expect(extractBootstrapIdOverride('<!--   @bootstrap-id:    my-slug   -->')).toBe('my-slug');
    });

    it('returns null when no marker is present', () => {
      expect(extractBootstrapIdOverride('Plain body, no marker.')).toBeNull();
      expect(extractBootstrapIdOverride('')).toBeNull();
    });

    it('returns null when the marker payload is empty or whitespace-only', () => {
      expect(extractBootstrapIdOverride('<!-- @bootstrap-id:  -->')).toBeNull();
    });

    it('returns the first marker when multiple appear in the same row (validator handles the rest)', () => {
      // The validator (Slice 3) is responsible for raising a clear error when
      // it observes two markers in one row; the derivation module just exposes
      // a primitive lookup.
      const md = '<!-- @bootstrap-id: first --> body <!-- @bootstrap-id: second -->';
      expect(extractBootstrapIdOverride(md)).toBe('first');
    });

    it('ignores HTML comments that are not @bootstrap-id markers', () => {
      expect(extractBootstrapIdOverride('<!-- @other-marker: x -->')).toBeNull();
      expect(extractBootstrapIdOverride('<!-- plain html comment -->')).toBeNull();
    });

    it('allows slugs that include hyphens, slashes, and other URL-safe punctuation', () => {
      expect(extractBootstrapIdOverride('<!-- @bootstrap-id: my-2026-05-slug -->')).toBe('my-2026-05-slug');
      expect(extractBootstrapIdOverride('<!-- @bootstrap-id: subteam/feature-x -->')).toBe('subteam/feature-x');
    });
  });

  describe('SOURCE_TYPES export', () => {
    it('lists exactly the five source types named in T-D54, in the canonical order', () => {
      expect(SOURCE_TYPES).toEqual(['decision', 'roadmap', 'handover', 'checklist', 'override']);
    });
  });
});
