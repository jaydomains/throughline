# Executor wake-log — Slice: rag-test stabilization (inserted before B3)

**Slice:** spec-author-inserted stabilization slice (Option A ruling, 2026-06-07, authenticated in-session). Sits between **B2** and **B3** in the chain.
**Finding:** the `rag.test.ts` flake (audit **M-14**) — aggravated mid-chain by A2's embeddings swap (the real `@huggingface/transformers` model now loads under full-suite concurrency, creating a race that wasn't active pre-A2). Ruled out of "Phase-F deferral" into "stabilize now."
**Scope (ruled):** pin `rag.test.ts` to the deterministic fallback embedder so the suite is reproducible regardless of whether the real model loads. **Test-infra only, normal class** (not a ratification class).
**Branch:** `claude/rag-stabilization` → base `main` (rebased onto `17c193a`, post-B2).
**Counterparts:** execution-auditor (`claude/sharp-cerf-mZ381`), execution-overseer (`claude/blissful-brown-POKvS`).

One line per event: last-seen remote HEAD (`git ls-remote`), set-diff (`N dropped / M added`), per-thread `X/5`.

---

- **2026-06-07** — Implementation commit. Last-seen remote: `main` `17c193a`, auditor `7b40422`, overseer `103f379` (`git ls-remote`). Set-diff: **0 dropped / 0 added (baseline)**. Threads: none.
  - **Root cause (confirmed):** in this env `createTextEmbedder()` resolves to the **real** model (the "dtype not specified for model" log lines in earlier runs). Under full-suite concurrency the model load races, intermittently failing a `rag.test.ts` assertion (~1-in-4 full-suite runs across B1/B2; always green in isolation). The tests are designed embedder-agnostic (T-D60) — they validate the RAG pipeline, not the model — so the real-model load is pure nondeterminism with no test value.
  - **Fix (test-infra):** added an additive export `createFallbackEmbedder()` to `embeddings.ts` (returns the existing deterministic `fallbackEmbedder`; **zero production behaviour change** — `server.ts` still uses `createTextEmbedder()`). Pinned the **default** embedder in the `rag.test.ts` and `library.test.ts` harnesses to `createFallbackEmbedder()` (tests that need a specific embedder still inject their own — `throwingEmbedder` / `queryFailingEmbedder`).
  - **Verification (the point of the slice):** backend suite **610/610 on 5 consecutive runs**, with **0 "dtype not specified" model-load lines** — the real model no longer loads in tests; the flake source is eliminated and the suite is reproducible. typecheck · lint · build green; frontend 204/204 unaffected. (Bonus: tests no longer download a model → faster, fully offline CI.)
  - **Scope:** `embeddings.ts` (additive export only), `rag.test.ts`, `library.test.ts` + this slice's docs. No production behaviour change; not a ratification class. **Disjoint from B2** (ci.yml/AUTO_CONTINUE) — authored in parallel, **rebased onto post-B2 `main`** cleanly.
  - **Sequence:** inserted before **B3** per the ruling; the remaining slices (B3, C1, D2, B5, B6, M-10) now run against stable CI.
