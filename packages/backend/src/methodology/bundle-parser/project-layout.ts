import type { BundleStructuralError, ProjectLayout } from '@throughline/shared';
import { isNoneBody, parseBulletList, parseKeyValueLines } from './sections.js';

export interface ProjectLayoutParseResult {
  value?: ProjectLayout;
  errors: BundleStructuralError[];
}

const PRIMARY_HEADING = /^###\s+Primary unit\s*$/im;
const RUNTIME_DIRS_HEADING = /^###\s+Runtime artefact directories\s*$/im;

function extractSubsection(body: string, heading: RegExp): string {
  const lines = body.split('\n');
  let inSection = false;
  const out: string[] = [];
  for (const line of lines) {
    if (heading.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^###\s+/.test(line)) break;
    if (inSection) out.push(line);
  }
  return out.join('\n').trim();
}

export function parseProjectLayout(_bundleId: string, body: string): ProjectLayoutParseResult {
  if (isNoneBody(body)) {
    return {
      value: { primary_unit: null, runtime_artefact_dirs: [], tiers: [] },
      errors: [],
    };
  }

  // Top-level lines above the first ### sub-heading carry §2's project-wide fields.
  // Currently only `tiers:` — the architectural-tier vocabulary §6's `when:` clauses
  // resolve against (T-D49).
  const firstSub = body.search(/^###\s+/m);
  const headerBody = firstSub >= 0 ? body.slice(0, firstSub) : body;
  const headerKv = parseKeyValueLines(headerBody);
  const tiers = (headerKv['tiers'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const primarySub = extractSubsection(body, PRIMARY_HEADING);
  const dirsSub = extractSubsection(body, RUNTIME_DIRS_HEADING);

  let primary_unit: ProjectLayout['primary_unit'] = null;
  if (primarySub && !isNoneBody(primarySub)) {
    const nameMatch = /name:\s*(.+)/i.exec(primarySub);
    const tierMatch = /tier_rules:\s*(.+)/i.exec(primarySub);
    primary_unit = {
      name: nameMatch?.[1]?.trim() ?? 'unit',
      tier_rules: tierMatch?.[1]?.trim() ?? '',
      doc_set: parseBulletList(primarySub),
      templates_by_doc_type: {},
    };
  }

  const runtime_artefact_dirs = dirsSub ? parseBulletList(dirsSub) : [];

  return { value: { primary_unit, runtime_artefact_dirs, tiers }, errors: [] };
}
