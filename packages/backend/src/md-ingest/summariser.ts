import type { AnthropicClient } from '../ai/anthropic.js';

// Phase 6c — imported-doc summariser (SPEC §7.9: "AI generates summary and tag
// suggestions during import"). Mirrors the dump-zone extractor's two-implementation +
// routing shape (Phase 4 convention):
//   - anthropic: real Sonnet call; STRICT JSON {summary, tags}. Any failure path falls
//     back to the heuristic summariser so ingestion never hard-fails on the AI surface.
//   - heuristic: first non-heading paragraph as the summary; tags derived from the
//     filename + the doc's H1/H2 headings. Always available, used when no API key.
// SPEC §15 degrade-gracefully: ingestion always produces an entry — the absence of an
// API key only changes the quality of the summary/tags, not whether the doc imports.

export interface SummariseInput {
  rel_path: string;
  content: string;
}

export interface SummariseTelemetry {
  model: string | null; // null on the heuristic path
  input_tokens: number;
  output_tokens: number;
  prompt: string | null; // never persisted; passed to the caller for fingerprinting
}

export interface SummariseResult {
  summary: string;
  tags: string[];
  // Which path produced the summary, and a disclosure note when it degraded to the
  // heuristic — mirrors the dump-zone / reconcile extractor_note twins so an AI
  // summary-failure is surfaced, not silently presented as a healthy summary (T-D60,
  // SF4-02). null note ⇒ the AI summary was used.
  extractor: 'anthropic' | 'heuristic';
  extractor_note: string | null;
  telemetry: SummariseTelemetry;
}

export const HEURISTIC_SUMMARY_NOTE =
  'Heuristic summariser used — configure an Anthropic API key in settings.json to enable AI summaries.';

function withHeuristicNote(extraNote?: string): string {
  return extraNote ? `${extraNote} ${HEURISTIC_SUMMARY_NOTE}` : HEURISTIC_SUMMARY_NOTE;
}

export interface MdSummariser {
  summarise(input: SummariseInput): Promise<SummariseResult>;
}

const MAX_SUMMARY_CHARS = 600;
const MAX_TAGS = 8;
// Cap the document sent to the model; long docs cost tokens without improving a summary.
const MAX_CONTENT_CHARS = 24_000;

function clampSummary(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ');
  return t.length <= MAX_SUMMARY_CHARS ? t : t.slice(0, MAX_SUMMARY_CHARS - 1) + '…';
}

function normaliseTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = normaliseTag(raw);
    if (t.length === 0 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

// Heuristic summary: first paragraph that isn't a markdown heading / fence / list marker.
function firstProse(content: string): string {
  const blocks = content
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
  for (const b of blocks) {
    if (b.startsWith('#')) continue; // heading
    if (b.startsWith('```')) continue; // fenced code
    if (/^([*\-+]|\d+\.)\s/.test(b)) continue; // list
    if (/^<!--/.test(b)) continue; // html comment
    return b;
  }
  return blocks[0] ?? '';
}

function headingTags(content: string): string[] {
  const tags: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    const m = /^#{1,2}\s+(.+?)\s*#*\s*$/.exec(line);
    if (m && m[1]) tags.push(m[1]);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}

function fileNameTag(relPath: string): string {
  const base = relPath.split(/[\\/]/).pop() ?? relPath;
  return base.replace(/\.(md|markdown)$/i, '');
}

export function heuristicSummary(input: SummariseInput): { summary: string; tags: string[] } {
  const summary = clampSummary(firstProse(input.content) || fileNameTag(input.rel_path));
  const tags = dedupeTags(['imported-doc', fileNameTag(input.rel_path), ...headingTags(input.content)]);
  return { summary, tags };
}

export function createHeuristicSummariser(): MdSummariser {
  return {
    async summarise(input) {
      const { summary, tags } = heuristicSummary(input);
      return {
        summary,
        tags,
        extractor: 'heuristic',
        extractor_note: HEURISTIC_SUMMARY_NOTE,
        telemetry: { model: null, input_tokens: 0, output_tokens: 0, prompt: null },
      };
    },
  };
}

const AI_SYSTEM = `You summarise a single Markdown document for Throughline's library.
Return STRICT JSON only, no prose, no code fences:
{"summary":"<2-4 sentence plain-English summary>","tags":["lowercase-hyphenated", "..."]}
The summary is at most 4 sentences. Provide between 2 and 8 short topical tags. If the
document is empty or unreadable, return {"summary":"","tags":[]}.`;

function buildUserPrompt(input: SummariseInput): string {
  const body =
    input.content.length <= MAX_CONTENT_CHARS
      ? input.content
      : input.content.slice(0, MAX_CONTENT_CHARS) + '\n…(truncated)';
  return `File: ${input.rel_path}\n\n${body}`;
}

interface AiShape {
  summary?: unknown;
  tags?: unknown;
}

function parseAiResponse(text: string): AiShape | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as AiShape;
  } catch {
    return null;
  }
}

export interface AnthropicSummariserOptions {
  client: AnthropicClient;
  model?: string;
  resolveModel?: () => string;
}

export function createAnthropicSummariser({
  client,
  model: defaultModel = 'claude-sonnet-4-6',
  resolveModel,
}: AnthropicSummariserOptions): MdSummariser {
  const heuristic = createHeuristicSummariser();
  return {
    async summarise(input) {
      if (!client.available()) return heuristic.summarise(input);
      const model = resolveModel ? resolveModel() : defaultModel;
      const system = AI_SYSTEM;
      const userPrompt = buildUserPrompt(input);
      try {
        const result = await client.call({
          model,
          system,
          messages: [{ role: 'user', content: userPrompt }],
          max_tokens: 1024,
        });
        const parsed = parseAiResponse(result.text);
        if (parsed === null) {
          // Call succeeded (billed) but returned non-JSON — degrade to heuristic and
          // disclose it; telemetry.model stays set so the call is still costed/audited.
          const fallback = heuristicSummary(input);
          return {
            ...fallback,
            extractor: 'heuristic',
            extractor_note: withHeuristicNote(
              'Anthropic returned non-JSON output; falling back to heuristic summary.',
            ),
            telemetry: {
              model,
              input_tokens: result.input_tokens,
              output_tokens: result.output_tokens,
              prompt: system + '\n\n' + userPrompt,
            },
          };
        }
        const summary = clampSummary(
          typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
            ? parsed.summary
            : firstProse(input.content) || fileNameTag(input.rel_path),
        );
        const aiTags = Array.isArray(parsed.tags)
          ? parsed.tags.filter((t): t is string => typeof t === 'string')
          : [];
        const tags = dedupeTags(aiTags.length > 0 ? aiTags : heuristicSummary(input).tags);
        return {
          summary,
          tags,
          extractor: 'anthropic',
          extractor_note: null,
          telemetry: {
            model,
            input_tokens: result.input_tokens,
            output_tokens: result.output_tokens,
            prompt: system + '\n\n' + userPrompt,
          },
        };
      } catch (err) {
        // Network / API failure: degrade to heuristic, no telemetry (no call billed) —
        // disclosed distinctly from the no-key path (T-D60, SF4-02).
        const fallback = heuristicSummary(input);
        return {
          ...fallback,
          extractor: 'heuristic',
          extractor_note: withHeuristicNote(
            `Anthropic call failed (${err instanceof Error ? err.message : 'unknown error'}); using heuristic summary.`,
          ),
          telemetry: { model: null, input_tokens: 0, output_tokens: 0, prompt: null },
        };
      }
    },
  };
}

export interface RoutingSummariserOptions {
  anthropic: MdSummariser;
  heuristic: MdSummariser;
  client: AnthropicClient;
}

// Reads availability per call so re-configuring the key in settings doesn't need a
// backend restart (same convention as the dump-zone routing extractor).
export function createRoutingSummariser(opts: RoutingSummariserOptions): MdSummariser {
  return {
    async summarise(input) {
      if (opts.client.available()) return opts.anthropic.summarise(input);
      return opts.heuristic.summarise(input);
    },
  };
}
