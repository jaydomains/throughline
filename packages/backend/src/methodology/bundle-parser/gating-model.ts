import type { BundleStructuralError, GatingModel } from '@throughline/shared';
import { isNoneBody, parseBulletList } from './sections.js';

export interface GatingModelParseResult {
  value?: GatingModel;
  errors: BundleStructuralError[];
}

export function parseGatingModel(_bundleId: string, body: string): GatingModelParseResult {
  if (isNoneBody(body)) {
    return { value: { status: 'none' }, errors: [] };
  }
  return {
    value: {
      status: 'declared',
      tier_rules: parseBulletList(body),
      feature_rules: [],
      permission_rules: [],
    },
    errors: [],
  };
}
