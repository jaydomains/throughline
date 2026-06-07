# Throughline — Handover: rag-test stabilization (inserted slice, before B3)

**Status:** final — approved by executor
**Generated:** 2026-06-07 14:55 UTC
**Last commit SHA:** _(merge SHA assigned by execution-overseer at merge)_ — 2026-06-07
**Previous handover:** `docs/_meta/throughline/handovers/2026-06-07-B2-ci-enforcement.md` (B2)
**Slice:** spec-author-inserted stabilization slice (sits between B2 and B3). **PR:** _(draft)_. **Not a ratification class.**

---

## Why this slice exists

A discovered finding during execution: `rag.test.ts` (audit **M-14**, originally Phase-F-deferred) **flaked on the first full-suite run of both B1 and B2** (~1-in-4 runs; always green in isolation). Root cause: **A2's embeddings swap aggravated it** — the new `@huggingface/transformers` stack actually loads the real model under full-suite concurrency (vs the old stack reliably falling back), creating a race that wasn't active before A2. The spec author ruled (2026-06-07, authenticated in-session) to **stabilize now (Option A)** rather than keep deferring — moving it from "pre-existing Phase-F deferral" to "introduced mid-chain disruption," and refusing to train reviewers to ignore red CI. Inserted before B3 so B3/C1/D2/B5/B6/M-10 run against stable CI.

## Build State vs Spec (ruled scope)

| Deliverable | State | Evidence |
|---|---|---|
| Pin `rag.test.ts` to the deterministic fallback embedder | built | `rag.test.ts` harness default → `createFallbackEmbedder()` |
| Suite reproducible regardless of real-model load | built | backend 610/610 ×5 runs, **0 model-load lines** |
| Test-infra only, normal class | built | only an additive export in `embeddings.ts` (zero behaviour change) + test harnesses |

## Last Decision Minted

> No new decision/anchor. Test-determinism fix. `createFallbackEmbedder()` is an additive export of the existing deterministic `fallbackEmbedder` (T-D60); production wiring unchanged.

## Active Blockers

_none._

## Files Changed Since Last Handover

**New:** this slice's wake-log; this handover.
**Modified:**
- `packages/backend/src/intelligence/embeddings.ts` — **additive** `export function createFallbackEmbedder()` (returns the existing fallback; zero behaviour change).
- `packages/backend/test/rag.test.ts` — default harness embedder pinned to `createFallbackEmbedder()`; import updated.
- `packages/backend/test/library.test.ts` — same default-embedder pin.

## Drift Flags

| Flag | What | How resolved |
|---|---|---|
| Production-file touch under "test-infra only" | `embeddings.ts` gains an export | **Additive export only — zero production behaviour change** (`server.ts` still calls `createTextEmbedder()`); it merely exposes the existing deterministic embedder for test injection. Honors "test-infra only" in effect. Flagged transparently. |

## Open Questions

_none._

## Recently Resolved

- The recurring `rag.test.ts` flake (M-14, A2-aggravated) is **stabilized at root cause** — the real model no longer loads in the test suite, so the run-to-run nondeterminism is gone. CI is reproducible for the remaining chain.

## Cross-Module Dependencies

**Upstream:** the A2 embeddings stack (`@huggingface/transformers`) whose concurrent model-load was the flake source. **Downstream:** B3, C1, D2, B5, B6, M-10 now run against stable CI; M-10 can note the rag flake closed (vs the audit's M-14 "flake status unconfirmed").

## Verification

- **Backend suite 610/610 across 5 consecutive runs**, **0 "dtype not specified" model-load lines** (real model no longer loads in tests) — the flake source is eliminated.
- typecheck ✓ · lint ✓ · build ✓ · frontend 204/204 ✓.
- The embedder-agnostic assertions (T-D60: `['transformers','fallback']`) still pass (now deterministically `fallback`); tests injecting `throwingEmbedder`/`queryFailingEmbedder` are unaffected.

## Reference

- Spec-author Option-A ruling (2026-06-07, in-session); audit `2026-06-06-end-to-end-summary.md` (M-14); plan §3.C (rag flake cross-link, "stabilize, never re-run-until-green"); `embeddings.ts` (T-D60).
- PR: _(draft)_.
