import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseBundle } from '../src/methodology/bundle-parser/index.js';

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
});
