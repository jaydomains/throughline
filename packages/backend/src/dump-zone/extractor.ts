import { nanoid } from 'nanoid';
import type {
  ItemPolicy,
  LoadedBundle,
  ProposalPayload,
  ProposalSource,
  ProposalTarget,
  ProposedItem,
  ProposedLibraryEntry,
} from '@throughline/shared';
import type { AnthropicClient } from '../ai/anthropic.js';

// Bundle-aware dump-zone extractor (T-D5, §7.6). The extractor turns raw text into a typed
// ProposalPayload regardless of capture surface; the review modal consumes the payload and
// the apply step writes items / library entries.
//
// Two implementations:
//   - anthropic: real Sonnet call, bundle policy injected into the system prompt so item
//     types/statuses match what the project's bundle allows. Graceful failure: any
//     error path falls back to the heuristic extractor and surfaces a note in payload.
//   - heuristic: one item per paragraph (blank-line-separated) or bullet line. Splits
//     library entries into snippets when target='library'. Always available, used when
//     the Anthropic key is absent.
//
// SPEC §15 degrade-gracefully: the dump zone always opens a review modal — the absence of an
// AI key only changes the quality of suggestions, not whether the surface works.

export interface ExtractionInput {
  project_id: string;
  text: string;
  target: ProposalTarget;
  source: ProposalSource;
  bundle: LoadedBundle;
  policy: ItemPolicy;
  suggested_session_id: string | null;
}

export interface ExtractionTelemetry {
  model: string | null; // null on heuristic path
  input_tokens: number;
  output_tokens: number;
  prompt: string | null; // never persisted; passed to the caller for fingerprinting
}

export interface ExtractionResult {
  payload: ProposalPayload;
  telemetry: ExtractionTelemetry;
}

export interface Extractor {
  extract(input: ExtractionInput): Promise<ExtractionResult>;
}

export const HEURISTIC_NOTE =
  'Heuristic extractor used — configure an Anthropic API key in settings.json to enable AI extraction.';

// Paragraph split that keeps non-empty groups; preserves intra-paragraph newlines so titles
// like "TODO: fix X" stay together while distinct ideas separated by blank lines split apart.
function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function titleFromBlock(block: string): { title: string; description: string } {
  const lines = block.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const first = lines[0] ?? block.slice(0, 60);
  // Strip leading bullet markers from the first line.
  const stripped = first.replace(/^([*\-+]|\d+\.)\s+/, '');
  const title = stripped.length <= 80 ? stripped : stripped.slice(0, 77) + '...';
  const description = lines.slice(1).join('\n');
  return { title, description };
}

// F5-04: the bundle's primary-unit concept label, or null for a freeform bundle. Bundle-
// agnostic — the name comes from the bundle's declaration, no unit names are baked in.
function primaryUnitName(input: ExtractionInput): string | null {
  return input.bundle.project_layout.primary_unit?.name ?? null;
}

function heuristicSessionItems(input: ExtractionInput): ProposedItem[] {
  const blocks = paragraphs(input.text);
  if (blocks.length === 0) return [];
  const type = input.policy.types[0] ?? 'task';
  const status = input.policy.statuses[0] ?? 'open';
  return blocks.map((block) => {
    const { title, description } = titleFromBlock(block);
    return {
      proposal_item_id: nanoid(),
      type,
      status,
      title,
      description,
      tags: [],
      target_session_id: input.suggested_session_id,
      // Heuristic extraction makes no primary-unit suggestion (no AI to infer it); the user
      // can still set one in the review modal when the bundle declares a primary unit.
      suggested_primary_unit_ref: null,
      confidence: null,
    };
  });
}

function heuristicLibraryEntries(input: ExtractionInput): ProposedLibraryEntry[] {
  const blocks = paragraphs(input.text);
  if (blocks.length === 0) return [];
  return blocks.map((block) => {
    const { title } = titleFromBlock(block);
    return {
      proposal_item_id: nanoid(),
      type: 'note',
      title,
      body: block,
      tags: [],
    };
  });
}

function heuristicPayload(input: ExtractionInput, extraNote?: string): ProposalPayload {
  const note = extraNote ? `${extraNote} ${HEURISTIC_NOTE}` : HEURISTIC_NOTE;
  if (input.target === 'session') {
    return {
      target: 'session',
      source: input.source,
      extractor: 'heuristic',
      items: heuristicSessionItems(input),
      library: [],
      clarifying_questions: [],
      suggested_session_id: input.suggested_session_id,
      primary_unit_name: primaryUnitName(input),
      extractor_note: note,
    };
  }
  return {
    target: 'library',
    source: input.source,
    extractor: 'heuristic',
    items: [],
    library: heuristicLibraryEntries(input),
    clarifying_questions: [],
    suggested_session_id: null,
    primary_unit_name: primaryUnitName(input),
    extractor_note: note,
  };
}

const AI_SYSTEM_TEMPLATE = `You are the dump-zone extractor for Throughline, a methodology-aware development tracker.
Project bundle: BUNDLE_ID. Allowed item types: TYPES. Allowed item statuses: STATUSES.
Target surface: TARGET. Return STRICT JSON only, no prose.
For target='session', return: {"items":[{"type":"<one of TYPES>","status":"<one of STATUSES>","title":"...","description":"...","tags":[]}],"clarifying_questions":[]}
For target='library', return: {"library":[{"type":"note","title":"...","body":"...","tags":[]}],"clarifying_questions":[]}
Titles are single-line and at most 80 chars. Descriptions hold the supporting text. If the input is empty or unparseable, return empty arrays.`;

function buildPrompt(input: ExtractionInput): string {
  const base = AI_SYSTEM_TEMPLATE.replace('BUNDLE_ID', input.policy.bundle_id)
    .replace('TYPES', JSON.stringify(input.policy.types))
    .replace('STATUSES', JSON.stringify(input.policy.statuses))
    .replace('TARGET', input.target);
  // F5-04: when the bundle organises work into primary units, ask the extractor to suggest
  // one per item (a free-form ref/label naming the unit it belongs to). Omitted for freeform.
  const puName = primaryUnitName(input);
  if (input.target === 'session' && puName !== null) {
    return (
      base +
      `\nThis project organises work into "${puName}" units. For each item you may add an ` +
      `optional "primary_unit" field: a short label naming the ${puName} the item belongs to ` +
      `(reuse an existing one when it fits). Omit it when unsure.`
    );
  }
  return base;
}

interface AnthropicProposedItem {
  type?: unknown;
  status?: unknown;
  title?: unknown;
  description?: unknown;
  tags?: unknown;
  primary_unit?: unknown;
}
interface AnthropicProposedLibraryEntry {
  type?: unknown;
  title?: unknown;
  body?: unknown;
  tags?: unknown;
}
interface AnthropicResponseShape {
  items?: AnthropicProposedItem[];
  library?: AnthropicProposedLibraryEntry[];
  clarifying_questions?: unknown;
}

function clampTitle(s: string): string {
  return s.length <= 80 ? s : s.slice(0, 77) + '...';
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((t): t is string => typeof t === 'string');
}

function coerceItem(
  raw: AnthropicProposedItem,
  policy: ItemPolicy,
  targetSessionId: string | null,
  primaryUnitDeclared: boolean,
): ProposedItem | null {
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (title.length === 0) return null;
  const type = typeof raw.type === 'string' && policy.types.includes(raw.type) ? raw.type : policy.types[0];
  const status =
    typeof raw.status === 'string' && policy.statuses.includes(raw.status) ? raw.status : policy.statuses[0];
  if (type === undefined || status === undefined) return null;
  // F5-04: only honour a suggested primary unit when the bundle actually declares the concept;
  // a stray suggestion against a freeform bundle is dropped.
  const suggestedPrimaryUnit =
    primaryUnitDeclared && typeof raw.primary_unit === 'string' && raw.primary_unit.trim().length > 0
      ? raw.primary_unit.trim()
      : null;
  return {
    proposal_item_id: nanoid(),
    type,
    status,
    title: clampTitle(title),
    description: typeof raw.description === 'string' ? raw.description : '',
    tags: asStringArray(raw.tags),
    target_session_id: targetSessionId,
    suggested_primary_unit_ref: suggestedPrimaryUnit,
    confidence: null,
  };
}

function coerceLibraryEntry(raw: AnthropicProposedLibraryEntry): ProposedLibraryEntry | null {
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (title.length === 0) return null;
  const allowed = ['note', 'prompt', 'snippet', 'imported_doc'] as const;
  type LibType = (typeof allowed)[number];
  const type: LibType = allowed.includes(raw.type as LibType) ? (raw.type as LibType) : 'note';
  return {
    proposal_item_id: nanoid(),
    type,
    title: clampTitle(title),
    body: typeof raw.body === 'string' ? raw.body : '',
    tags: asStringArray(raw.tags),
  };
}

function parseAnthropicResponse(text: string): AnthropicResponseShape | null {
  // Tolerate code-fence wrapping that LLMs sometimes emit despite "STRICT JSON only".
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned) as AnthropicResponseShape;
  } catch {
    return null;
  }
}

export function createHeuristicExtractor(): Extractor {
  return {
    async extract(input) {
      return {
        payload: heuristicPayload(input),
        telemetry: { model: null, input_tokens: 0, output_tokens: 0, prompt: null },
      };
    },
  };
}

export interface AnthropicExtractorOptions {
  client: AnthropicClient;
  model?: string;
  resolveModel?: () => string;
}

export function createAnthropicExtractor({
  client,
  model: defaultModel = 'claude-sonnet-4-6',
  resolveModel,
}: AnthropicExtractorOptions): Extractor {
  return {
    async extract(input) {
      if (!client.available()) {
        return {
          payload: heuristicPayload(input),
          telemetry: { model: null, input_tokens: 0, output_tokens: 0, prompt: null },
        };
      }
      const model = resolveModel ? resolveModel() : defaultModel;
      const system = buildPrompt(input);
      const userPrompt = input.text;
      try {
        const result = await client.call({
          model,
          system,
          messages: [{ role: 'user', content: userPrompt }],
          max_tokens: 2048,
        });
        const parsed = parseAnthropicResponse(result.text);
        if (parsed === null) {
          return {
            payload: heuristicPayload(
              input,
              'Anthropic returned non-JSON output; falling back to heuristic extraction.',
            ),
            telemetry: {
              model,
              input_tokens: result.input_tokens,
              output_tokens: result.output_tokens,
              prompt: system + '\n\n' + userPrompt,
            },
          };
        }
        const items: ProposedItem[] =
          input.target === 'session'
            ? (parsed.items ?? [])
                .map((raw) =>
                  coerceItem(raw, input.policy, input.suggested_session_id, primaryUnitName(input) !== null),
                )
                .filter((i): i is ProposedItem => i !== null)
            : [];
        const library: ProposedLibraryEntry[] =
          input.target === 'library'
            ? (parsed.library ?? [])
                .map(coerceLibraryEntry)
                .filter((e): e is ProposedLibraryEntry => e !== null)
            : [];
        const clarifying = asStringArray(parsed.clarifying_questions);
        return {
          payload: {
            target: input.target,
            source: input.source,
            extractor: 'anthropic',
            items,
            library,
            clarifying_questions: clarifying,
            suggested_session_id: input.target === 'session' ? input.suggested_session_id : null,
            primary_unit_name: primaryUnitName(input),
            extractor_note: null,
          },
          telemetry: {
            model,
            input_tokens: result.input_tokens,
            output_tokens: result.output_tokens,
            prompt: system + '\n\n' + userPrompt,
          },
        };
      } catch (err) {
        return {
          payload: heuristicPayload(
            input,
            `Anthropic call failed (${err instanceof Error ? err.message : 'unknown error'}); using heuristic extraction.`,
          ),
          telemetry: { model, input_tokens: 0, output_tokens: 0, prompt: null },
        };
      }
    },
  };
}

export interface RoutingExtractorOptions {
  anthropic: Extractor;
  heuristic: Extractor;
  client: AnthropicClient;
}

// Routes to Anthropic when the key is configured at extract-time, else to heuristic. Reading
// availability on each call (rather than at module load) means re-configuring the key in
// settings doesn't require a backend restart.
export function createRoutingExtractor(opts: RoutingExtractorOptions): Extractor {
  return {
    async extract(input) {
      if (opts.client.available()) return opts.anthropic.extract(input);
      return opts.heuristic.extract(input);
    },
  };
}
