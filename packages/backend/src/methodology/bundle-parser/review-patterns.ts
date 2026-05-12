import type { BundleStructuralError, ChecklistSpec, CompanionMode, ReviewPatterns } from '@throughline/shared';
import { isNoneBody, parseKeyValueLines } from './sections.js';

export interface ReviewPatternsParseResult {
  value?: ReviewPatterns;
  errors: BundleStructuralError[];
}

const COMPANION_MODE_HEADING = /^###\s+Companion mode:\s*(.+?)\s*$/gim;
const CHECKLIST_HEADING = /^###\s+Checklist:\s*(.+?)\s*$/gim;

export function parseReviewPatterns(_bundleId: string, body: string): ReviewPatternsParseResult {
  if (isNoneBody(body)) {
    return { value: { status: 'none', checklists: [], companion_modes: [] }, errors: [] };
  }

  const companion_modes: CompanionMode[] = [];
  let match: RegExpExecArray | null;
  COMPANION_MODE_HEADING.lastIndex = 0;
  while ((match = COMPANION_MODE_HEADING.exec(body)) !== null) {
    const id = match[1]!.trim();
    companion_modes.push({ id, name: id, description: '' });
  }

  const checklistHeadings: Array<{ id: string; index: number }> = [];
  CHECKLIST_HEADING.lastIndex = 0;
  while ((match = CHECKLIST_HEADING.exec(body)) !== null) {
    checklistHeadings.push({ id: match[1]!.trim(), index: match.index });
  }
  const checklists: ChecklistSpec[] = checklistHeadings.map((h, i) => {
    const end = checklistHeadings[i + 1]?.index ?? body.length;
    const slice = body.slice(h.index, end);
    const steps = slice
      .split('\n')
      .slice(1)
      .map((rawLine) => rawLine.trim())
      .filter((line) => line.startsWith('- '))
      .map((line) => {
        const parts = line.slice(2).split('|').map((p) => p.trim());
        const id = parts[0] ?? '';
        const kindRaw = parts[1];
        const kind: 'mechanical' | 'judgement' = kindRaw === 'judgement' ? 'judgement' : 'mechanical';
        return { id, kind, description: parts[2] ?? '' };
      })
      .filter((step) => step.id.length > 0);
    return { id: h.id, name: h.id, steps };
  });

  // companion_modes may also be expressed as `companion_modes: a, b, c` key:value.
  if (companion_modes.length === 0) {
    const kv = parseKeyValueLines(body);
    const inline = kv['companion_modes'];
    if (inline) {
      for (const id of inline.split(',').map((s) => s.trim()).filter(Boolean)) {
        companion_modes.push({ id, name: id, description: '' });
      }
    }
  }

  return { value: { status: 'declared', checklists, companion_modes }, errors: [] };
}
