import type { BundleStructuralError, DisciplineDriftCategory, ValidationRules } from '@throughline/shared';
import { isNoneBody, parseBulletList } from './sections.js';

export interface ValidationRulesParseResult {
  value?: ValidationRules;
  errors: BundleStructuralError[];
}

const DRIFT_CATEGORY_HEADING = /^###\s+Drift category:\s*(.+?)\s*$/gim;

function parseDriftCategories(body: string): DisciplineDriftCategory[] {
  const out: DisciplineDriftCategory[] = [];
  const headings: Array<{ name: string; index: number }> = [];
  let match: RegExpExecArray | null;
  DRIFT_CATEGORY_HEADING.lastIndex = 0;
  while ((match = DRIFT_CATEGORY_HEADING.exec(body)) !== null) {
    headings.push({ name: match[1]!.trim(), index: match.index });
  }
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i]!.index;
    const end = headings[i + 1]?.index ?? body.length;
    const slice = body.slice(start, end);
    const triggerMatch = /trigger:\s*(file-change|pre-write|manual)/i.exec(slice);
    const checkMatch = /check:\s*(banned_string|structural|cross_reference|regex)/i.exec(slice);
    const detailsMatch = /details:\s*(.+)/i.exec(slice);
    out.push({
      name: headings[i]!.name,
      trigger: (triggerMatch?.[1] ?? 'manual') as DisciplineDriftCategory['trigger'],
      check_kind: (checkMatch?.[1] ?? 'banned_string') as DisciplineDriftCategory['check_kind'],
      details: detailsMatch?.[1]?.trim() ?? '',
    });
  }
  return out;
}

export function parseValidationRules(_bundleId: string, body: string): ValidationRulesParseResult {
  if (isNoneBody(body)) {
    return {
      value: {
        status: 'none',
        banned_string_sweeps: [],
        implementation_discipline_rules: [],
        cross_reference_resolution_rules: [],
        structural_validation_rules: [],
        discipline_drift_categories: [],
      },
      errors: [],
    };
  }
  return {
    value: {
      status: 'declared',
      banned_string_sweeps: parseBulletList(body),
      implementation_discipline_rules: [],
      cross_reference_resolution_rules: [],
      structural_validation_rules: [],
      discipline_drift_categories: parseDriftCategories(body),
    },
    errors: [],
  };
}
