import type { BundleStructuralError, CommunicationModel } from '@throughline/shared';
import { isNoneBody, parseBulletList } from './sections.js';

export interface CommunicationModelParseResult {
  value?: CommunicationModel;
  errors: BundleStructuralError[];
}

export function parseCommunicationModel(_bundleId: string, body: string): CommunicationModelParseResult {
  if (isNoneBody(body)) {
    return { value: { status: 'none' }, errors: [] };
  }
  return {
    value: {
      status: 'declared',
      edge_types: parseBulletList(body),
      routing_rules: [],
      producer_ownership_rules: [],
    },
    errors: [],
  };
}
