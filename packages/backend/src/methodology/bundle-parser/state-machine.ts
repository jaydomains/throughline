import type {
  BundleStructuralError,
  GateSpec,
  ItemTypeSpec,
  PhaseMoment,
  StateMachine,
} from '@throughline/shared';
import { isNoneBody, parseBulletList, parseKeyValueLines } from './sections.js';

function parseTransitionList(raw: string | undefined): Array<{ from: string; to: string }> {
  return (raw?.split(',') ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .map((expr) => {
      const [from, to] = expr.split('->').map((s) => s.trim());
      return from && to ? { from, to } : null;
    })
    .filter((t): t is { from: string; to: string } => t !== null);
}

// C-D12 — sub-heading shape `### Item type: <id>` followed by `board:` / `statuses:` /
// `transitions:` key-value lines. Mirrors the `### Gates: <moment>` convention. Bundles
// that declare none (freeform) yield [] and the runtime infers a single board.
function extractItemTypes(body: string): ItemTypeSpec[] {
  const headingPattern = /^###\s+Item type:\s+(.+?)\s*$/gim;
  const headings: Array<{ id: string; index: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(body)) !== null) {
    const id = match[1]?.trim();
    if (id) headings.push({ id, index: match.index });
  }
  const out: ItemTypeSpec[] = [];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i]!.index;
    const end = headings[i + 1]?.index ?? body.length;
    const slice = body.slice(start, end);
    const kv = parseKeyValueLines(slice.slice(slice.indexOf('\n') + 1));
    out.push({
      id: headings[i]!.id,
      board_label: kv['board']?.trim() || headings[i]!.id,
      statuses: kv['statuses']?.split(',').map((s) => s.trim()).filter(Boolean) ?? [],
      transitions: parseTransitionList(kv['transitions']),
    });
  }
  return out;
}

export interface StateMachineParseResult {
  value?: StateMachine;
  errors: BundleStructuralError[];
}

const KNOWN_MOMENTS: ReadonlySet<PhaseMoment> = new Set<PhaseMoment>([
  'pre-write',
  'per-commit',
  'plan-mode',
  'post-commit',
  'pr-open',
]);

function extractGatesByMoment(body: string): Partial<Record<PhaseMoment, GateSpec[]>> {
  // Sub-heading shape: `### Gates: <moment>` followed by a bullet list of gates,
  // each line `- <id> | <mechanical|judgement> | <description>`.
  const out: Partial<Record<PhaseMoment, GateSpec[]>> = {};
  const sectionPattern = /^###\s+Gates:\s+(.+?)\s*$/gim;
  let match: RegExpExecArray | null;
  const headings: Array<{ moment: PhaseMoment; index: number }> = [];
  while ((match = sectionPattern.exec(body)) !== null) {
    const candidate = match[1]?.trim().toLowerCase() as PhaseMoment | undefined;
    if (!candidate || !KNOWN_MOMENTS.has(candidate)) continue;
    headings.push({ moment: candidate, index: match.index });
  }
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i]!.index;
    const end = headings[i + 1]?.index ?? body.length;
    const slice = body.slice(start, end);
    const lines = slice.split('\n').slice(1);
    const gates: GateSpec[] = [];
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('- ')) continue;
      const parts = line.slice(2).split('|').map((p) => p.trim());
      const id = parts[0];
      const kindRaw = parts[1];
      if (!id || (kindRaw !== 'mechanical' && kindRaw !== 'judgement')) continue;
      gates.push({ id, kind: kindRaw, description: parts[2] ?? '' });
    }
    out[headings[i]!.moment] = gates;
  }
  return out;
}

export function parseStateMachine(_bundleId: string, body: string): StateMachineParseResult {
  if (isNoneBody(body)) {
    return {
      value: {
        status: 'none',
        phases: [],
        transitions: [],
        gates_by_moment: {},
        item_types: [],
      },
      errors: [],
    };
  }
  // Top-level phases/transitions are read from the region before the first `###` sub-heading
  // so item-type sub-blocks (which also carry `transitions:`) don't bleed into them.
  const firstSub = body.search(/^###\s+/m);
  const headerBody = firstSub >= 0 ? body.slice(0, firstSub) : body;
  const kv = parseKeyValueLines(headerBody);
  const phases =
    kv['phases']?.split(',').map((s) => s.trim()).filter(Boolean) ?? parseBulletList(headerBody);
  return {
    value: {
      status: 'declared',
      phases,
      transitions: parseTransitionList(kv['transitions']),
      gates_by_moment: extractGatesByMoment(body),
      item_types: extractItemTypes(body),
    },
    errors: [],
  };
}
