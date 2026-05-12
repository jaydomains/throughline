import type { AnchorSystem, BundleStructuralError } from '@throughline/shared';
import { isNoneBody, parseBulletList, parseKeyValueLines } from './sections.js';

export interface AnchorSystemParseResult {
  value?: AnchorSystem;
  errors: BundleStructuralError[];
}

export function parseAnchorSystem(_bundleId: string, body: string): AnchorSystemParseResult {
  if (isNoneBody(body)) {
    return { value: { status: 'none' }, errors: [] };
  }
  const kv = parseKeyValueLines(body);
  const value: AnchorSystem = {
    status: 'declared',
    body_sections: kv['body_sections']?.split(',').map((s) => s.trim()).filter(Boolean) ?? [],
    status_vocabulary: kv['status_vocabulary']?.split(',').map((s) => s.trim()).filter(Boolean) ?? [],
    heading_tags: kv['heading_tags']?.split(',').map((s) => s.trim()).filter(Boolean) ?? [],
    state_transitions: parseBulletList(body),
    banned_content_in_bodies:
      kv['banned_content_in_bodies']?.split(',').map((s) => s.trim()).filter(Boolean) ?? [],
  };
  if (kv['format_regex']) value.format_regex = kv['format_regex'];
  if (kv['namespace']) value.namespace = kv['namespace'];
  return { value, errors: [] };
}
