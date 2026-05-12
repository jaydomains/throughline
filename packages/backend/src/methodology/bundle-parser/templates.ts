import type { BundleStructuralError, Templates } from '@throughline/shared';
import { isNoneBody } from './sections.js';

export interface TemplatesParseResult {
  value?: Templates;
  errors: BundleStructuralError[];
}

const NAMED_TEMPLATE_HEADING = /^###\s+Template:\s*(.+?)\s*$/gim;

export function parseTemplates(_bundleId: string, body: string): TemplatesParseResult {
  if (isNoneBody(body)) {
    return { value: { status: 'none' }, errors: [] };
  }
  const named: Record<string, string> = {};
  const matches: Array<{ name: string; index: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = NAMED_TEMPLATE_HEADING.exec(body)) !== null) {
    matches.push({ name: match[1]!.trim(), index: match.index });
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i]!.index;
    const end = matches[i + 1]?.index ?? body.length;
    const slice = body.slice(start, end);
    const firstNewline = slice.indexOf('\n');
    named[matches[i]!.name] = firstNewline >= 0 ? slice.slice(firstNewline + 1).trim() : '';
  }
  const value: Templates = {
    status: 'declared',
    fixed_doc_outlines: named,
    session_start_by_mode: Object.fromEntries(
      Object.entries(named)
        .filter(([k]) => k.startsWith('session_start:'))
        .map(([k, v]) => [k.slice('session_start:'.length), v]),
    ),
  };
  if (named['handover']) value.handover = named['handover'];
  if (named['decision']) value.decision = named['decision'];
  if (named['research_artefact']) value.research_artefact = named['research_artefact'];
  if (named['execution_plan']) value.execution_plan = named['execution_plan'];
  return { value, errors: [] };
}
