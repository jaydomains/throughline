import type { AuthorityHierarchy, BundleStructuralError } from '@throughline/shared';
import { parseBulletList, parseKeyValueLines } from './sections.js';

export interface AuthorityHierarchyParseResult {
  value?: AuthorityHierarchy;
  errors: BundleStructuralError[];
}

export function parseAuthorityHierarchy(_bundleId: string, body: string): AuthorityHierarchyParseResult {
  const kv = parseKeyValueLines(body);
  const ranking = kv['source_ranking']?.split(/[>,]/).map((s) => s.trim()).filter(Boolean) ?? parseBulletList(body);
  return {
    value: {
      source_ranking: ranking,
      drift_policy: kv['drift_policy'] ?? '',
    },
    errors: [],
  };
}
