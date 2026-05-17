import { nanoid } from 'nanoid';
import type {
  Item,
  ItemPolicy,
  LoadedBundle,
  ReconcileDiff,
  ReconcileRow,
  ReconcileRowBlocker,
  ReconcileRowCompleted,
  ReconcileRowContradicted,
  ReconcileRowEdited,
  ReconcileRowNew,
  ReconcileRowNoChange,
  ReconcileSource,
} from '@throughline/shared';
import type { AnthropicClient } from '../ai/anthropic.js';
import { bundleDoneStatus } from '../items/policy.js';

// Reconcile engine (SPEC §7.7; T-D35). Same shape as the Phase 4 Extractor convention:
//   - Anthropic-backed implementation when an API key is configured.
//   - Heuristic fallback so the surface works without a key (SPEC §15 degrade-gracefully).
//   - Routing wrapper checks `client.available()` per call so settings changes don't need a
//     backend restart.
//
// The diff has six categories. Heuristic produces all categories except `edited` — telling
// "refine title/description" apart from "new item" needs an LLM. Flagged in Phase 5 handover.

export interface ReconcileEngineInput {
  project_id: string;
  text: string;
  source: ReconcileSource;
  session_id: string | null;
  bundle: LoadedBundle;
  policy: ItemPolicy;
  existing_items: Item[]; // candidate set (session-scoped or project-scoped)
}

export interface ReconcileTelemetry {
  model: string | null; // null on heuristic path
  input_tokens: number;
  output_tokens: number;
  prompt: string | null; // passed to caller for fingerprinting; never persisted
}

export interface ReconcileResult {
  diff: ReconcileDiff;
  telemetry: ReconcileTelemetry;
}

export interface ReconcileEngine {
  diff(input: ReconcileEngineInput): Promise<ReconcileResult>;
}

export const HEURISTIC_RECONCILE_NOTE =
  'Heuristic reconcile used — configure an Anthropic API key in settings.json to enable AI reconcile.';

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have',
  'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'was', 'with',
  'we', 'i', 'you', 'me', 'my', 'our', 'do', 'did', 'done', 'will', 'would',
]);

const COMPLETED_HINTS = ['done', 'complete', 'completed', 'finished', 'shipped', 'landed', 'merged'];
const CONTRADICTED_HINTS = ['broken', 'regressed', 'regression', 'contradicts', 'incorrect', 'reverted', 'reverts'];
const BLOCKER_HINTS = ['blocker', 'blocked by', 'waiting on', 'blocks on'];

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(tokens(a));
  let n = 0;
  for (const t of tokens(b)) if (ta.has(t)) n++;
  return n;
}

// Match an input paragraph to one existing item by token overlap or exact-substring of the
// title. Returns the best match (item, overlap score) or null if no item is plausibly the
// referent. Convention threshold: ≥2 overlapping non-stopword tokens, OR the lowercase title
// appears as a substring.
interface Match {
  item: Item;
  overlap: number;
}
function matchToItem(paragraph: string, items: Item[]): Match | null {
  const para = paragraph.toLowerCase();
  let best: Match | null = null;
  for (const item of items) {
    const titleLower = item.title.toLowerCase();
    if (titleLower.length >= 4 && para.includes(titleLower)) {
      const overlap = Math.max(2, tokenOverlap(item.title, paragraph));
      if (!best || overlap > best.overlap) best = { item, overlap };
      continue;
    }
    const overlap = tokenOverlap(item.title, paragraph);
    if (overlap >= 2 && (!best || overlap > best.overlap)) best = { item, overlap };
  }
  return best;
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function containsAny(s: string, needles: string[]): boolean {
  const lower = s.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

// Extract a candidate blocker phrase from a paragraph that contained a blocker hint. Returns
// the trimmed phrase following the hint, capped at 200 chars, or the whole paragraph as a
// fallback. Heuristic only; AI path drives blocker rows more accurately.
function extractBlockerPhrase(paragraph: string): string {
  const lower = paragraph.toLowerCase();
  for (const hint of BLOCKER_HINTS) {
    const idx = lower.indexOf(hint);
    if (idx >= 0) {
      const after = paragraph.slice(idx + hint.length).trim().replace(/^[:\-—]\s*/, '');
      if (after.length > 0) return after.slice(0, 200);
    }
  }
  return paragraph.slice(0, 200);
}

function titleFromBlock(block: string): { title: string; description: string } {
  const lines = block.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const first = lines[0] ?? block.slice(0, 60);
  const stripped = first.replace(/^([*\-+]|\d+\.)\s+/, '');
  const title = stripped.length <= 80 ? stripped : stripped.slice(0, 77) + '...';
  const description = lines.slice(1).join('\n');
  return { title, description };
}

function classifyMatched(
  paragraph: string,
  item: Item,
  doneStatus: string,
): ReconcileRowCompleted | ReconcileRowContradicted | ReconcileRowBlocker | ReconcileRowNoChange {
  // Order matters: contradicted takes precedence over completed (a "this is broken" claim
  // about a done item is the canonical contradicted case, T-D35). Blocker comes next.
  if (containsAny(paragraph, CONTRADICTED_HINTS)) {
    return {
      category: 'contradicted',
      row_id: nanoid(),
      item_id: item.id,
      current_title: item.title,
      reason: paragraph.slice(0, 280),
      evidence: paragraph,
    };
  }
  if (containsAny(paragraph, COMPLETED_HINTS) && item.status !== doneStatus) {
    return {
      category: 'completed',
      row_id: nanoid(),
      item_id: item.id,
      current_status: item.status,
      next_status: doneStatus,
      current_title: item.title,
      evidence: paragraph,
    };
  }
  if (containsAny(paragraph, BLOCKER_HINTS)) {
    return {
      category: 'blocker',
      row_id: nanoid(),
      item_id: item.id,
      current_blocker_text: item.blocker_text,
      next_blocker_text: extractBlockerPhrase(paragraph),
      evidence: paragraph,
    };
  }
  return {
    category: 'no_change',
    row_id: nanoid(),
    item_id: item.id,
    current_title: item.title,
    evidence: paragraph,
  };
}

function heuristicDiff(input: ReconcileEngineInput, extraNote?: string): ReconcileDiff {
  const blocks = paragraphs(input.text);
  const doneStatus = bundleDoneStatus(input.policy);
  const newType = input.policy.types[0] ?? 'task';
  const newStatus = input.policy.statuses[0] ?? 'open';
  const rows: ReconcileRow[] = [];
  const matchedItemIds = new Set<string>();

  for (const block of blocks) {
    const match = matchToItem(block, input.existing_items);
    if (match) {
      const row = classifyMatched(block, match.item, doneStatus);
      rows.push(row);
      matchedItemIds.add(match.item.id);
    } else {
      const { title, description } = titleFromBlock(block);
      const row: ReconcileRowNew = {
        category: 'new',
        row_id: nanoid(),
        type: newType,
        status: newStatus,
        title,
        description,
        tags: [],
        evidence: block,
      };
      rows.push(row);
    }
  }

  const note = extraNote ? `${extraNote} ${HEURISTIC_RECONCILE_NOTE}` : HEURISTIC_RECONCILE_NOTE;
  return {
    source: input.source,
    extractor: 'heuristic',
    session_id: input.session_id,
    rows,
    extractor_note: note,
  };
}

const AI_SYSTEM_TEMPLATE = `You are the reconcile engine for Throughline, a methodology-aware development tracker.
Project bundle: BUNDLE_ID. Allowed item types: TYPES. Allowed item statuses: STATUSES. "Done"-equivalent status: DONE_STATUS.
Existing items in scope (id, title, status):
ITEMS_BLOCK
You compare the input text against the existing items and produce a six-category diff per T-D35.
Return STRICT JSON only, no prose: {"rows":[<row>, ...]} where each <row> is one of:
- {"category":"completed","item_id":"...","evidence":"..."}
- {"category":"new","type":"...","status":"...","title":"...","description":"...","tags":[],"evidence":"..."}
- {"category":"edited","item_id":"...","next_title":"...","next_description":"...","evidence":"..."}
- {"category":"blocker","item_id":"...","next_blocker_text":"...","evidence":"..."}
- {"category":"contradicted","item_id":"...","reason":"...","evidence":"..."}
- {"category":"no_change","item_id":"...","evidence":"..."}
Contradicted means the input claims an existing done item is broken/regressed/incorrect — never auto-revert; the row spawns a drift signal.
If the input is empty or unparseable, return {"rows":[]}.`;

function buildPrompt(input: ReconcileEngineInput): string {
  const itemsBlock =
    input.existing_items.length === 0
      ? '(none — every paragraph is necessarily new)'
      : input.existing_items
          .map((i) => `- id=${i.id} | status=${i.status} | title=${i.title.replace(/\n/g, ' ')}`)
          .join('\n');
  return AI_SYSTEM_TEMPLATE.replace('BUNDLE_ID', input.policy.bundle_id)
    .replace('TYPES', JSON.stringify(input.policy.types))
    .replace('STATUSES', JSON.stringify(input.policy.statuses))
    .replace('DONE_STATUS', bundleDoneStatus(input.policy))
    .replace('ITEMS_BLOCK', itemsBlock);
}

interface AnthropicResponseShape {
  rows?: Array<Record<string, unknown>>;
}

function parseAnthropicResponse(text: string): AnthropicResponseShape | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned) as AnthropicResponseShape;
  } catch {
    return null;
  }
}

function clampTitle(s: string): string {
  return s.length <= 80 ? s : s.slice(0, 77) + '...';
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((t): t is string => typeof t === 'string');
}

function coerceRow(
  raw: Record<string, unknown>,
  policy: ItemPolicy,
  itemsById: Map<string, Item>,
  doneStatus: string,
): ReconcileRow | null {
  const cat = raw.category;
  const evidence = asString(raw.evidence);
  if (cat === 'new') {
    const title = asString(raw.title).trim();
    if (title.length === 0) return null;
    const type = policy.types.includes(asString(raw.type)) ? asString(raw.type) : policy.types[0]!;
    const status = policy.statuses.includes(asString(raw.status)) ? asString(raw.status) : policy.statuses[0]!;
    const row: ReconcileRowNew = {
      category: 'new',
      row_id: nanoid(),
      type,
      status,
      title: clampTitle(title),
      description: asString(raw.description),
      tags: asStringArray(raw.tags),
      evidence,
    };
    return row;
  }
  const itemId = asString(raw.item_id);
  const item = itemsById.get(itemId);
  if (!item) return null;
  if (cat === 'completed') {
    const row: ReconcileRowCompleted = {
      category: 'completed',
      row_id: nanoid(),
      item_id: item.id,
      current_status: item.status,
      next_status: doneStatus,
      current_title: item.title,
      evidence,
    };
    return row;
  }
  if (cat === 'edited') {
    const nextTitle = clampTitle(asString(raw.next_title, item.title).trim() || item.title);
    const nextDescription = asString(raw.next_description, item.description);
    const row: ReconcileRowEdited = {
      category: 'edited',
      row_id: nanoid(),
      item_id: item.id,
      current_title: item.title,
      current_description: item.description,
      next_title: nextTitle,
      next_description: nextDescription,
      evidence,
    };
    return row;
  }
  if (cat === 'blocker') {
    const next = asString(raw.next_blocker_text, '');
    const row: ReconcileRowBlocker = {
      category: 'blocker',
      row_id: nanoid(),
      item_id: item.id,
      current_blocker_text: item.blocker_text,
      next_blocker_text: next.length > 0 ? next.slice(0, 500) : null,
      evidence,
    };
    return row;
  }
  if (cat === 'contradicted') {
    const row: ReconcileRowContradicted = {
      category: 'contradicted',
      row_id: nanoid(),
      item_id: item.id,
      current_title: item.title,
      reason: asString(raw.reason, evidence).slice(0, 280),
      evidence,
    };
    return row;
  }
  if (cat === 'no_change') {
    const row: ReconcileRowNoChange = {
      category: 'no_change',
      row_id: nanoid(),
      item_id: item.id,
      current_title: item.title,
      evidence,
    };
    return row;
  }
  return null;
}

export function createHeuristicReconcileEngine(): ReconcileEngine {
  return {
    async diff(input) {
      return {
        diff: heuristicDiff(input),
        telemetry: { model: null, input_tokens: 0, output_tokens: 0, prompt: null },
      };
    },
  };
}

export interface AnthropicReconcileEngineOptions {
  client: AnthropicClient;
  model?: string;
  resolveModel?: () => string;
}

export function createAnthropicReconcileEngine({
  client,
  model: defaultModel = 'claude-sonnet-4-6',
  resolveModel,
}: AnthropicReconcileEngineOptions): ReconcileEngine {
  return {
    async diff(input) {
      if (!client.available()) {
        return {
          diff: heuristicDiff(input),
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
          max_tokens: 4096,
        });
        const parsed = parseAnthropicResponse(result.text);
        if (parsed === null) {
          return {
            diff: heuristicDiff(
              input,
              'Anthropic returned non-JSON output; falling back to heuristic reconcile.',
            ),
            telemetry: {
              model,
              input_tokens: result.input_tokens,
              output_tokens: result.output_tokens,
              prompt: system + '\n\n' + userPrompt,
            },
          };
        }
        const itemsById = new Map(input.existing_items.map((i) => [i.id, i]));
        const doneStatus = bundleDoneStatus(input.policy);
        const rows = (parsed.rows ?? [])
          .map((r) => coerceRow(r, input.policy, itemsById, doneStatus))
          .filter((r): r is ReconcileRow => r !== null);
        return {
          diff: {
            source: input.source,
            extractor: 'anthropic',
            session_id: input.session_id,
            rows,
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
          diff: heuristicDiff(
            input,
            `Anthropic call failed (${err instanceof Error ? err.message : 'unknown error'}); using heuristic reconcile.`,
          ),
          telemetry: { model, input_tokens: 0, output_tokens: 0, prompt: null },
        };
      }
    },
  };
}

export interface RoutingReconcileEngineOptions {
  anthropic: ReconcileEngine;
  heuristic: ReconcileEngine;
  client: AnthropicClient;
}

export function createRoutingReconcileEngine(opts: RoutingReconcileEngineOptions): ReconcileEngine {
  return {
    async diff(input) {
      if (opts.client.available()) return opts.anthropic.diff(input);
      return opts.heuristic.diff(input);
    },
  };
}
