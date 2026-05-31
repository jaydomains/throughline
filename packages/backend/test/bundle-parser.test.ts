import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseBundle } from '../src/methodology/bundle-parser/index.js';
import { parseValidationRules } from '../src/methodology/bundle-parser/validation-rules.js';
import { parseStateMachine } from '../src/methodology/bundle-parser/state-machine.js';

const FREEFORM_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

describe('bundle parser', () => {
  it('parses the freeform bundle successfully', () => {
    const md = readFileSync(FREEFORM_PATH, 'utf8');
    const result = parseBundle('freeform', md);
    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    expect(result.bundle.identity.name).toBe('freeform');
    expect(result.bundle.identity.version).toBe('1.0.0');
  });

  it('accepts "none" declarations as legitimate (T-D47)', () => {
    const md = readFileSync(FREEFORM_PATH, 'utf8');
    const result = parseBundle('freeform', md);
    if (result.status !== 'loaded') throw new Error('expected loaded');
    expect(result.bundle.project_layout.primary_unit).toBeNull();
    expect(result.bundle.anchor_system.status).toBe('none');
    expect(result.bundle.marker_system.status).toBe('none');
    expect(result.bundle.communication_model.status).toBe('none');
    expect(result.bundle.gating_model.status).toBe('none');
    expect(result.bundle.review_patterns.status).toBe('none');
    expect(result.bundle.validation_rules.status).toBe('none');
  });

  it('fails loudly when sections are missing', () => {
    const md = `# Bad bundle\n\n## 1. Identity\n\nname: bad\nversion: 0.0.1\n`;
    const result = parseBundle('bad', md);
    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('fails loudly when sections are out of order', () => {
    const md = `# Reordered

## 2. Project layout

none

## 1. Identity

name: x
version: 0.0.1

## 3. Anchor system

none

## 4. Marker system

none

## 5. State machine

none

## 6. Communication model

none

## 7. Gating model

none

## 8. Review patterns

none

## 9. Templates

none

## 10. Validation rules

none

## 11. Authority hierarchy

source_ranking: spec
`;
    const result = parseBundle('reordered', md);
    expect(result.status).toBe('error');
  });

  it('SF2-03: an unrecognised drift-category check kind is surfaced as a warning, not silently retyped', () => {
    const body = [
      '### Drift category: Stale TODOs',
      'trigger: file-change',
      'check: bogus-kind', // not one of the allowed kinds — pre-fix silently became banned_string
      'details: TODO without an owner',
    ].join('\n');
    const result = parseValidationRules('test', body);
    const cats = result.value?.discipline_drift_categories ?? [];
    expect(cats).toHaveLength(1);
    // The default still applies (so the bundle loads) — but it is now VISIBLE as a warning,
    // naming that the category will run the wrong scanner until fixed.
    expect(cats[0]!.check_kind).toBe('banned_string');
    expect(result.warnings.some((w) => /unrecognised check kind/i.test(w.message))).toBe(true);
  });

  it('SF2-03: a well-formed drift category produces no warnings and keeps its declared kinds', () => {
    const body = [
      '### Drift category: X',
      'trigger: file-change',
      'check: regex',
      'details: y',
    ].join('\n');
    const result = parseValidationRules('test', body);
    expect(result.warnings).toEqual([]);
    expect(result.value!.discipline_drift_categories[0]!.check_kind).toBe('regex');
    expect(result.value!.discipline_drift_categories[0]!.trigger).toBe('file-change');
  });

  it('S3-02: an item-type heading at EOF (no body) parses to sensible defaults, not a mis-parsed heading', () => {
    // The last heading has no trailing body — exercises the EOF `indexOf('\n')` path.
    const body = '### Item type: task\nboard: Tasks\nstatuses: open, done\n\n### Item type: note';
    const result = parseStateMachine('test', body);
    const types = result.value?.item_types ?? [];
    expect(types.map((t) => t.id)).toEqual(['task', 'note']);
    // The body-less 'note' heading yields defaults — not key/value scraped from the heading.
    const note = types.find((t) => t.id === 'note')!;
    expect(note.board_label).toBe('note');
    expect(note.statuses).toEqual([]);
  });
});
