import { createHash } from 'node:crypto';

// T-D54 — bootstrap_id derivation rules per source type, plus the universal
// `@bootstrap-id:` override. Format is `<source-type>:<stable-key>`; the
// per-source prefix prevents cross-source collision and stays human-readable
// for debugging. Hash convention: sha256, 16-char hex prefix, unsalted —
// distinct from the privacy-salted `promptFingerprint` (T-D24) and the
// change-detection `contentHash`. Three named functions, three named purposes;
// they live adjacent in the backend tree so a reader sees the family at once.
//
// Consumed in Slice 3 by the bootstrap validator and stateful upsert; the same
// rules are referenced by Phase 21's prompt template (T-D55) so the producer
// emits IDs the consumer recognises.

export type SourceType = 'decision' | 'roadmap' | 'handover' | 'checklist' | 'override';

export const SOURCE_TYPES: readonly SourceType[] = ['decision', 'roadmap', 'handover', 'checklist', 'override'];

// Normalisation rule for `checklist` source type per T-D54: lowercase,
// whitespace collapsed to single spaces, trailing punctuation stripped. The
// goal is to absorb the natural editorial drift a CHECKLIST row picks up over
// time (casing/whitespace/punctuation typo-fixes preserve identity for free)
// while leaving word-level semantic edits as identity-breaking changes that
// surface via the stale-flag.
export function normalizeChecklistText(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:!?]+$/u, '');
}

function sha256_16(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

// `bootstrapId(sourceType, key)` returns `<source-type>:<stable-key>` per T-D54.
// Content-hashed types (currently `checklist`) accept raw text and hash it
// internally so the normalisation rule lives in one place. Non-hashed types
// pass the stable key through verbatim.
export function bootstrapId(sourceType: SourceType, key: string): string {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error(`bootstrapId: empty key for source type "${sourceType}"`);
  }
  switch (sourceType) {
    case 'checklist': {
      const normalised = normalizeChecklistText(key);
      if (normalised.length === 0) {
        throw new Error('bootstrapId: checklist key normalises to empty string');
      }
      return `checklist:${sha256_16(normalised)}`;
    }
    case 'decision':
    case 'roadmap':
    case 'handover':
    case 'override':
      return `${sourceType}:${key}`;
    default: {
      const exhaustive: never = sourceType;
      throw new Error(`bootstrapId: unknown source type "${exhaustive}"`);
    }
  }
}

// T-D54 universal escape hatch. A source row may carry
// `<!-- @bootstrap-id: my-slug -->` to override the derivation rules; the
// override wins. The slug is a user-authored stable key — Phase 20 does not
// constrain its character set beyond requiring at least one non-whitespace
// character; the override prefix `override:` keeps user slugs in a distinct
// namespace from derived IDs even if a user picks `decision-T-D1` as a slug.
//
// Returns the slug (trimmed) if present, or null. The first occurrence wins
// when multiple markers appear in the same row — the validator (Slice 3) is
// responsible for raising a clear error if it observes that case.
const OVERRIDE_MARKER = /<!--\s*@bootstrap-id:\s*([^\s][^]*?)\s*-->/;

export function extractBootstrapIdOverride(markdown: string): string | null {
  const match = OVERRIDE_MARKER.exec(markdown);
  const captured = match?.[1];
  if (!captured) return null;
  const slug = captured.trim();
  if (slug.length === 0) return null;
  return slug;
}
