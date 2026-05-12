import type { BundleIdentity, BundleStructuralError } from '@throughline/shared';
import { parseBulletList, parseKeyValueLines } from './sections.js';

export interface IdentityParseResult {
  value?: BundleIdentity;
  errors: BundleStructuralError[];
}

export function parseIdentity(bundleId: string, body: string): IdentityParseResult {
  const errors: BundleStructuralError[] = [];
  const kv = parseKeyValueLines(body);
  const name = kv['name'];
  const version = kv['version'];
  const precedenceLine = kv['authority_precedence'];

  if (!name) {
    errors.push({ bundle_id: bundleId, section: '1. Identity', message: 'Missing `name:` line.' });
  }
  if (!version) {
    errors.push({ bundle_id: bundleId, section: '1. Identity', message: 'Missing `version:` line.' });
  }

  let precedence: string[] = [];
  if (precedenceLine) {
    precedence = precedenceLine.split(/[>,]/).map((s) => s.trim()).filter(Boolean);
  } else {
    precedence = parseBulletList(body);
  }

  if (errors.length > 0) return { errors };
  return {
    value: { name: name!, version: version!, authority_precedence: precedence },
    errors,
  };
}
