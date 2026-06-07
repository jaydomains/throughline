# Executor wake-log — Slice A2 (embeddings-stack replacement; protobufjs Critical)

**Slice:** A2 of the audit-remediation plan (`2026-06-06-audit-remediation-plan.md`).
**Finding:** M-1 (protobufjs/embeddings portion); **touches C-D2 (ratification class i)**.
**Branch:** `claude/a2-embeddings-protobufjs` → base `main` (@ `36be75a`, A1 included).
**Counterparts:** execution-auditor (`claude/sharp-cerf-mZ381`), execution-overseer (`claude/blissful-brown-POKvS`).

One line per event: last-seen remote HEAD (`git ls-remote`), set-diff (`N dropped / M added`), per-thread `X/5`.

---

- **2026-06-07** — Implementation commit. Last-seen remote: `main` `36be75a`, auditor `9885398`, overseer `a35f7f6` (`git ls-remote`). Set-diff: **0 dropped / 0 added (baseline — no reviewer findings on A2 yet)**. Threads: none.
  - **Scope:** replaced the embeddings stack `@xenova/transformers@^2.17.2` → `@huggingface/transformers@^3.8.1` (kept as **`optionalDependency`** — the C-D2/T-D60 capability-absent design depends on it; **not** moved to a hard direct dep). The successor's newer onnxruntime resolves `protobufjs@7.6.2` (≥7.5.8), replacing the old `onnxruntime-web@1.14 → onnx-proto@4 → protobufjs ^6.8.8` chain an override alone could not lift (auditor CN-2).
  - **Files:** `packages/backend/package.json` (optionalDep swap); `src/intelligence/embeddings.ts` (dynamic-import spec `@xenova/transformers` → `@huggingface/transformers`; C-D2 comment; model `Xenova/all-MiniLM-L6-v2` + 384-dim contract **unchanged**); `CODE_SPEC.md` **C-D2 amendment** (dated note: rename + **dependency-declaration correction** to `optionalDependency`, addressing auditor CN-1 / overseer EO-6 — *not* the plan's "hard direct dep" framing); two test comments (`embeddings.test.ts`, `rag.test.ts`); `pnpm-lock.yaml`.
  - **Audit delta (`pnpm audit --prod`):** **10 → 1**. Cleared by A2: the protobufjs **1 Critical (RCE) + 4 High + 4 Moderate** (9 advisories). Remaining 1 = react-router moderate → **A3** (residual sweep). No new advisories introduced by the new dep chain (frozen-lockfile audit confirms).
  - **Gate:** typecheck ✓ · test ✓ (610 backend / 204 frontend — M-14 baseline preserved; `rag.test.ts` 16/16 passed, no flake surfaced per plan §3.C) · lint ✓ · build ✓. Boot ✓ (`node dist/index.js` on `127.0.0.1:47823`: `/health`, `/api/methodologies` 200, clean shutdown). The real embedder path is exercised by the tests (transformers.js loads the model — "dtype" log line), and the T-D60 embedder-agnostic assertions hold for either backend.
  - **Ratification:** A2 is **class-(i)** (C-D2 anchor amendment) — does **not** auto-merge; needs spec-author ratification at merge (the M-1 ruling should collapse it, but the C-D2 *wording* is the overseer's gate to confirm).
  - **Footprint note (for A3/D1):** `@huggingface/transformers@3` pulls `onnxruntime-node` (native; its postinstall downloads a ~GPU/CUDA build from GitHub releases) + `onnxruntime-web` + `sharp` — a heavier install footprint than `@xenova/transformers@2`'s WASM-only path. Tolerable: it's an `optionalDependency` (pnpm continues if its native postinstall fails) and lazy-loaded with the T-D60 fallback. Flagged for the A3 honest-dependency-posture statement and D1 deploy.
