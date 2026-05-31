import type { BundleStructuralError, DisciplineDriftCategory, ValidationRules } from '@throughline/shared';
import { isNoneBody, parseBulletList } from './sections.js';

export interface ValidationRulesParseResult {
  value?: ValidationRules;
  errors: BundleStructuralError[];
  // SF2-03: non-fatal warnings for malformed-but-coerced lines (the bundle still loads).
  warnings: BundleStructuralError[];
}

const DRIFT_CATEGORY_HEADING = /^###\s+Drift category:\s*(.+?)\s*$/gim;

function parseDriftCategories(
  bundleId: string,
  body: string,
  warnings: BundleStructuralError[],
): DisciplineDriftCategory[] {
  const out: DisciplineDriftCategory[] = [];
  const headings: Array<{ name: string; index: number }> = [];
  let match: RegExpExecArray | null;
  DRIFT_CATEGORY_HEADING.lastIndex = 0;
  while ((match = DRIFT_CATEGORY_HEADING.exec(body)) !== null) {
    headings.push({ name: match[1]!.trim(), index: match.index });
  }
  for (let i = 0; i < headings.length; i++) {
    const name = headings[i]!.name;
    const start = headings[i]!.index;
    const end = headings[i + 1]?.index ?? body.length;
    const slice = body.slice(start, end);
    const triggerMatch = /trigger:\s*(file-change|pre-write|manual)/i.exec(slice);
    const checkMatch = /check:\s*(banned_string|structural|cross_reference|regex)/i.exec(slice);
    const detailsMatch = /details:\s*(.+)/i.exec(slice);
    // SF2-03: a `trigger:` / `check:` line that is *present but unrecognised* (a typo like
    // `check: regexp`) was silently coerced to the default — for `check` that means the
    // category quietly runs the WRONG scanner. Surface it as a warning instead of a silent
    // retype; the default still applies so the bundle loads.
    if (!triggerMatch && /^\s*trigger:\s*\S/im.test(slice)) {
      warnings.push({
        bundle_id: bundleId,
        section: '10. Validation rules',
        message: `drift category "${name}": unrecognised trigger value (allowed: file-change, pre-write, manual); defaulting to 'manual'`,
      });
    }
    if (!checkMatch && /^\s*check:\s*\S/im.test(slice)) {
      warnings.push({
        bundle_id: bundleId,
        section: '10. Validation rules',
        message: `drift category "${name}": unrecognised check kind (allowed: banned_string, structural, cross_reference, regex); defaulting to 'banned_string' — the category will run the wrong scanner until fixed`,
      });
    }
    out.push({
      name,
      trigger: (triggerMatch?.[1] ?? 'manual') as DisciplineDriftCategory['trigger'],
      check_kind: (checkMatch?.[1] ?? 'banned_string') as DisciplineDriftCategory['check_kind'],
      details: detailsMatch?.[1]?.trim() ?? '',
    });
  }
  return out;
}

export function parseValidationRules(bundleId: string, body: string): ValidationRulesParseResult {
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
      warnings: [],
    };
  }
  const warnings: BundleStructuralError[] = [];
  const discipline_drift_categories = parseDriftCategories(bundleId, body, warnings);
  return {
    value: {
      status: 'declared',
      banned_string_sweeps: parseBulletList(body),
      implementation_discipline_rules: [],
      cross_reference_resolution_rules: [],
      structural_validation_rules: [],
      discipline_drift_categories,
    },
    errors: [],
    warnings,
  };
}
