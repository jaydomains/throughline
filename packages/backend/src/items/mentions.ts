// Phase 17 — item-mention reference parsing (SPEC §7.11, §7.17; WN-1b-a).
//
// A user references another item from description text with the explicit token
// `@item:<id>`, where <id> is a 21-char nanoid (alphabet [A-Za-z0-9_-], the
// nanoid default). The explicit namespaced token keeps capture unambiguous and
// false-positive-free — opaque bare ids in prose are not matched. The negative
// lookahead stops a 22nd id-class char from producing a (wrong) 21-char match.
// Mirrors the PR_REF_RE convention in github/tiers.ts.
//
// Returned ids are deduped, first-seen order preserved. Resolution against live
// same-project items (and self-ref drop) happens in the items service, not here.

const MENTION_RE = /@item:([A-Za-z0-9_-]{21})(?![A-Za-z0-9_-])/g;

export function parseMentionRefs(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of text.matchAll(MENTION_RE)) {
    const id = m[1]!;
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
