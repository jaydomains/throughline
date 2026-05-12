import type { BundleStructuralError, GateSpec, PhaseMoment, StateMachine } from '@throughline/shared';
import { isNoneBody, parseBulletList, parseKeyValueLines } from './sections.js';

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
      },
      errors: [],
    };
  }
  const kv = parseKeyValueLines(body);
  const phases = kv['phases']?.split(',').map((s) => s.trim()).filter(Boolean) ?? parseBulletList(body);
  const transitions = (kv['transitions']?.split(',') ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .map((expr) => {
      const [from, to] = expr.split('->').map((s) => s.trim());
      return from && to ? { from, to } : null;
    })
    .filter((t): t is { from: string; to: string } => t !== null);
  return {
    value: {
      status: 'declared',
      phases,
      transitions,
      gates_by_moment: extractGatesByMoment(body),
    },
    errors: [],
  };
}
