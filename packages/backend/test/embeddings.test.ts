import { describe, expect, it } from 'vitest';
import { cosine, createTextEmbedder } from '../src/intelligence/embeddings.js';

// E1 — embedder honesty (T-D60, narrowing C-D2). These lock the contract the wire
// disclosure rests on: the embedder always reports a truthful `kind`, and the local
// fallback is a deterministic capability-absent mode — never an undisclosed substitute.
// The query-level "embed-failure surfaces, never silent-empty" regressions live in
// rag.test.ts, where the embedder state reaches RagQueryResult.embedder.

describe('E1 — cosine similarity (C-D2)', () => {
  it('is the dot product for L2-normalised vectors and guards mismatched dims', () => {
    const a = [0.6, 0.8];
    expect(cosine(a, a)).toBeCloseTo(1, 6);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0, 6);
    // A vector built under a different embedder (different dim) must not throw — return 0.
    expect(cosine([1, 0, 0], [1, 0])).toBe(0);
  });
});

describe('E1 — text embedder discloses its kind honestly (T-D60)', () => {
  it('reports a truthful kind drawn only from the disclosed set, with a positive dim', async () => {
    const embedder = createTextEmbedder();
    const [v] = await embedder.embed(['wire the widget pipeline']);
    expect(v).toBeDefined();
    // The whole point of T-D60: the kind is the truth the wire surfaces. It is never an
    // undisclosed third state. (`@huggingface/transformers` is an optionalDependency; this
    // env runs the disclosed capability-absent fallback when the package or its model
    // download is unavailable — but the assertion holds for either backend.)
    expect(['transformers', 'fallback']).toContain(embedder.kind);
    expect(embedder.dim).toBeGreaterThan(0);
    expect(v!.length).toBe(embedder.dim);
  });

  it('is deterministic: the same text yields the same vector (capability-absent mode)', async () => {
    const embedder = createTextEmbedder();
    const [a] = await embedder.embed(['connect the ingest to the renderer']);
    const [b] = await embedder.embed(['connect the ingest to the renderer']);
    expect(a).toEqual(b);
  });

  it('gives shared-token texts a higher cosine than disjoint texts', async () => {
    const embedder = createTextEmbedder();
    const [base, near, far] = await embedder.embed([
      'widget pipeline ingest renderer',
      'widget pipeline ingest stage',
      'grocery list milk eggs bread',
    ]);
    expect(cosine(base!, near!)).toBeGreaterThan(cosine(base!, far!));
  });
});
