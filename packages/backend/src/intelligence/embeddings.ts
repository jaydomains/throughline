import { createHash } from 'node:crypto';

// C-D2 — local embeddings for the text RAG substrate (T-D25, T-D31). C-D2 mandates
// Transformers.js (`@huggingface/transformers`, an all-MiniLM-L6-v2 ONNX). It is wired
// behind a *lazy dynamic import* and declared an optionalDependency: when the package and
// its first-launch model download are present the real embedder runs; otherwise a
// deterministic offline embedder takes over. (A2 / M-1, 2026-06-07: the package was renamed
// from the deprecated `@xenova/transformers@2` to its maintained successor
// `@huggingface/transformers@3`, whose newer onnxruntime resolves `protobufjs@>=7.5.8` and
// clears the Critical RCE + High/Moderate advisories the old onnx-proto@4 chain pinned. The
// lazy-import + optionalDependency shape and the all-MiniLM-L6-v2/384-dim contract are
// unchanged.) This matches the codebase's capability-gating
// discipline (Semble absent, Anthropic key absent) and keeps the substrate fully offline
// and the build/tests green without a network round-trip. The fallback is a hashed
// token-gram vector — lexical-overlap cosine, good enough for keyword-class retrieval
// until the model is cached.
//
// T-D60 narrows C-D2 (refuse-rather-than-fallback): this fallback is a *capability-absent
// honest-distinct mode*, never an undisclosed substitute. The embedder reports its `kind`
// ('transformers' | 'fallback') so callers disclose it on the wire (RagQueryResult.embedder)
// rather than passing keyword-class hits off as authoritative model retrieval. The import
// failure is the only thing that pins the fallback (capability genuinely absent); a runtime
// extractor throw after the real backend resolved is *not caught here* — it has always
// propagated (that uncaught propagation was the S4-03 crash). The behavioural fix lives at
// the search boundary (text-index), which now classifies it as an EmbedError and surfaces a
// refused retrieval ('unavailable') instead of a silent SHA1 substitution. See DECISIONS.md
// T-D60 / SPEC.md §14.

export interface TextEmbedder {
  readonly kind: 'transformers' | 'fallback';
  readonly dim: number;
  embed(texts: string[]): Promise<number[][]>;
}

// A failure that originated in the embedding step — a runtime extractor throw, a model
// backend that broke after resolving, etc. — as opposed to an infrastructure/DB failure.
// text-index wraps every embedder.embed() call in this type so the search boundary can
// classify an embed-failure as a refused retrieval (embedder:'unavailable', T-D60) while
// letting infra throws propagate as real errors (e.g. a T-D58 DomainError → its canonical
// status). It is deliberately NOT a DomainError: it is caught and converted inside the
// text index and never reaches a route handler.
export class EmbedError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'EmbedError';
  }
}

const FALLBACK_DIM = 256;

function l2normalize(v: number[]): number[] {
  let s = 0;
  for (const x of v) s += x * x;
  const n = Math.sqrt(s);
  if (n === 0) return v;
  return v.map((x) => x / n);
}

export function cosine(a: number[], b: number[]): number {
  // Vectors are stored L2-normalised, so cosine is the dot product. Guard mismatched
  // dims (e.g. an index built under a different embedder) by returning 0.
  if (a.length !== b.length) return 0;
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i]! * b[i]!;
  return d;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

// Deterministic hashed bag-of-tokens + token-bigram embedder. Same text ⇒ same vector;
// shared tokens ⇒ positive cosine. No model, no network, no per-call cost.
function fallbackEmbed(texts: string[]): number[][] {
  return texts.map((text) => {
    const v = new Array<number>(FALLBACK_DIM).fill(0);
    const toks = tokenize(text);
    const grams = [...toks];
    for (let i = 0; i + 1 < toks.length; i++) grams.push(`${toks[i]}_${toks[i + 1]}`);
    for (const g of grams) {
      const h = createHash('sha1').update(g).digest();
      const bucket = h.readUInt32BE(0) % FALLBACK_DIM;
      const sign = (h[4]! & 1) === 0 ? 1 : -1;
      v[bucket] = v[bucket]! + sign;
    }
    return l2normalize(v);
  });
}

const fallbackEmbedder: TextEmbedder = {
  kind: 'fallback',
  dim: FALLBACK_DIM,
  embed: async (texts) => fallbackEmbed(texts),
};

// Resolved lazily and memoised: the first embed() attempt tries Transformers.js; on an
// *import/resolution* failure (package not installed, model download blocked) it pins the
// fallback so a subsequent call doesn't re-pay the failed import — the disclosed
// capability-absent mode (T-D60). A *runtime* throw from the resolved extractor is not
// caught here (it is not the absence of a capability); it propagates to the search
// boundary, which surfaces it as a refused retrieval rather than a silent substitution.
export function createTextEmbedder(): TextEmbedder {
  let resolved: TextEmbedder | null = null;
  let pending: Promise<TextEmbedder> | null = null;

  async function resolve(): Promise<TextEmbedder> {
    if (resolved) return resolved;
    if (pending) return pending;
    pending = (async () => {
      try {
        // Indirect specifier so the bundler/tsc doesn't hard-require an absent optional dep.
        const spec = '@huggingface/transformers';
        const mod = (await import(/* @vite-ignore */ spec)) as {
          pipeline: (
            task: string,
            model: string,
          ) => Promise<
            (
              input: string[],
              opts: { pooling: 'mean'; normalize: boolean },
            ) => Promise<{ tolist: () => number[][] }>
          >;
        };
        const extractor = await mod.pipeline(
          'feature-extraction',
          'Xenova/all-MiniLM-L6-v2',
        );
        const real: TextEmbedder = {
          kind: 'transformers',
          dim: 384,
          embed: async (texts) => {
            if (texts.length === 0) return [];
            const out = await extractor(texts, { pooling: 'mean', normalize: true });
            return out.tolist();
          },
        };
        resolved = real;
        return real;
      } catch {
        resolved = fallbackEmbedder;
        return fallbackEmbedder;
      }
    })();
    return pending;
  }

  return {
    // Reports the fallback until the first embed() resolves the backend. Callers that
    // need the eventual kind read it from RagReindexResult after a reindex.
    get kind() {
      return (resolved ?? fallbackEmbedder).kind;
    },
    get dim() {
      return (resolved ?? fallbackEmbedder).dim;
    },
    embed: async (texts) => (await resolve()).embed(texts),
  };
}
