// Section walker: split markdown into the canonical eleven H2 sections.
// C-D3 / C-D4: each H2 heading in the order `## 1. Identity` ... `## 11. Authority hierarchy`.

import type { BundleStructuralError } from '@throughline/shared';

export const CANONICAL_SECTIONS = [
  '1. Identity',
  '2. Project layout',
  '3. Anchor system',
  '4. Marker system',
  '5. State machine',
  '6. Communication model',
  '7. Gating model',
  '8. Review patterns',
  '9. Templates',
  '10. Validation rules',
  '11. Authority hierarchy',
] as const;

export type CanonicalSection = (typeof CANONICAL_SECTIONS)[number];

export interface RawSection {
  heading: CanonicalSection;
  body: string;
}

export interface SectionSplit {
  sections: Record<CanonicalSection, string>;
  errors: BundleStructuralError[];
}

const HEADING_PATTERN = /^##\s+(.+?)\s*$/;

export function splitSections(bundleId: string, markdown: string): SectionSplit {
  const lines = markdown.split(/\r?\n/);
  const collected: RawSection[] = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  const pushCurrent = () => {
    if (currentHeading !== null) {
      collected.push({ heading: currentHeading as CanonicalSection, body: currentLines.join('\n').trim() });
    }
  };

  for (const line of lines) {
    const match = HEADING_PATTERN.exec(line);
    if (match) {
      pushCurrent();
      currentHeading = match[1] ?? null;
      currentLines = [];
    } else if (currentHeading !== null) {
      currentLines.push(line);
    }
  }
  pushCurrent();

  const errors: BundleStructuralError[] = [];
  const collectedHeadings = collected.map((s) => s.heading);

  // Order check: collected H2 headings must equal the canonical list, in order.
  // Extra H2 headings or out-of-order or missing => structural errors.
  if (collectedHeadings.length !== CANONICAL_SECTIONS.length) {
    errors.push({
      bundle_id: bundleId,
      message: `Expected ${CANONICAL_SECTIONS.length} H2 sections, got ${collectedHeadings.length}.`,
    });
  }
  for (let i = 0; i < CANONICAL_SECTIONS.length; i++) {
    const expected = CANONICAL_SECTIONS[i]!;
    const actual = collectedHeadings[i];
    if (actual !== expected) {
      errors.push({
        bundle_id: bundleId,
        section: expected,
        message: `Section ${i + 1}: expected "${expected}", got "${actual ?? '<missing>'}".`,
      });
    }
  }

  // Build the section map even if there are errors, using whatever we managed to collect.
  const sections = Object.fromEntries(
    CANONICAL_SECTIONS.map((s) => [s, collected.find((c) => c.heading === s)?.body ?? '']),
  ) as Record<CanonicalSection, string>;

  return { sections, errors };
}

// Body helpers used by per-section parsers. Bundles describe each field as either
// `field: value` lines, `none` for absent sections, or markdown sub-headings with lists.
// These helpers handle the simple cases; richer shapes are parsed by their owner.

export function isNoneBody(body: string): boolean {
  const trimmed = body.trim().toLowerCase();
  return trimmed === 'none' || trimmed === '_none_' || trimmed === '';
}

export function parseKeyValueLines(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('<!--')) continue;
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase().replace(/\s+/g, '_');
    const value = line.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

export function parseBulletList(body: string): string[] {
  const out: string[] = [];
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('- ') || line.startsWith('* ')) {
      out.push(line.slice(2).trim());
    }
  }
  return out;
}
