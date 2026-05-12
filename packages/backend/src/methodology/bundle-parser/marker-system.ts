import type { BundleStructuralError, MarkerSystem } from '@throughline/shared';
import { isNoneBody, parseBulletList, parseKeyValueLines } from './sections.js';

export interface MarkerSystemParseResult {
  value?: MarkerSystem;
  errors: BundleStructuralError[];
}

export function parseMarkerSystem(_bundleId: string, body: string): MarkerSystemParseResult {
  if (isNoneBody(body)) {
    return { value: { status: 'none' }, errors: [] };
  }
  const kv = parseKeyValueLines(body);
  return {
    value: {
      status: 'declared',
      formats: kv['formats']?.split(',').map((s) => s.trim()).filter(Boolean) ?? [],
      categories: parseBulletList(body),
      gating_behaviour_by_category: {},
    },
    errors: [],
  };
}
