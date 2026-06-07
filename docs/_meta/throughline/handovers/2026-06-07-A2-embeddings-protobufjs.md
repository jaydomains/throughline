# Throughline / backend — Handover: Slice A2 (embeddings-stack replacement; protobufjs Critical)

**Status:** final — approved by executor
**Generated:** 2026-06-07 09:15 UTC
**Last commit SHA:** _(merge SHA assigned by execution-overseer at merge)_ — 2026-06-07
**Previous handover:** `docs/_meta/throughline/handovers/2026-06-07-A1-fastify-v5-fast-uri.md` (A1)
**Slice:** A2 of the audit-remediation cohort (plan `2026-06-06-audit-remediation-plan.md`). **PR:** _(A2 draft)_.

---

## Build State vs Spec

| Plan deliverable (A2, §5 Group A) | State | Evidence | Notes |
|---|---|---|---|
| Replace embeddings stack (not override-only) | built | `packages/backend/package.json` (`@huggingface/transformers ^3.8.1`) | `@xenova/transformers` + `onnx-proto@4` gone from the tree |
| Resolved tree clears protobufjs advisory | built | `pnpm-lock.yaml` (`protobufjs@7.6.2`); `pnpm audit --prod` 10→1 | Confirmed before commit (auditor CN-2) |
| Update `embeddings.ts` import/API | built | `src/intelligence/embeddings.ts:~115` (spec) + comment | API identical (`pipeline('feature-extraction')` → `.tolist()`); model + 384-dim unchanged |
| C-D2 amendment | built | `CODE_SPEC.md` C-D2 (2026-06-07 amendment note) | Records rename **and** corrects declaration to `optionalDependency` |
| RAG/embeddings tests passing | built | `test/rag.test.ts` (16) + `test/embeddings.test.ts` (4) green | Real embedder loads; T-D60 agnostic assertions hold |

## Last Decision Minted

- **C-D2 amendment (class-(i) anchor change)** — the Transformers.js package is `@huggingface/transformers@3` (renamed from `@xenova/transformers@2`), declared an **`optionalDependency`** (lazy dynamic import + T-D60 capability-absent fallback), **not** a hard direct dependency. Rationale: the old stack transitively pinned the protobufjs Critical RCE (`onnx-proto@4 → protobufjs ^6.8.8`); the successor resolves `protobufjs@>=7.5.8`. Lands in: `CODE_SPEC.md` C-D2. The all-MiniLM-L6-v2 / 384-dim contract and the lazy-import/fallback shape are unchanged (no T-D25/T-D31/T-D60 change).

## Active Blockers

_none._ (Merge is ratification-gated — class-(i) C-D2; see Open Questions.)

## Files Changed Since Last Handover

**New:** `docs/_meta/throughline/plans/2026-06-07-audit-remediation-A2-executor-wake-log.md`; this handover.
**Modified:**
- `packages/backend/package.json` — optionalDep `@xenova/transformers ^2.17.2` → `@huggingface/transformers ^3.8.1`.
- `packages/backend/src/intelligence/embeddings.ts` — dynamic-import spec + C-D2 comment (model/contract unchanged).
- `CODE_SPEC.md` — C-D2 amendment note (rename + dependency-declaration correction).
- `packages/backend/test/{embeddings,rag}.test.ts` — comment accuracy (package name).
- `pnpm-lock.yaml` — regenerated (+518/−287).

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Successor version | `package.json` | Plan named `@huggingface/transformers@3` as the candidate (latest is v4.2.0) | Pinned `^3.8.1` (the plan's named major; clears the advisory; a stable transformers release — v4 only adds a newer *dev*-pinned onnxruntime). Executor-discretion version choice per plan A2 ("executor confirms the resolved tree clears the advisory"). |
| Dep framing | `CODE_SPEC.md` | Plan §0/audit Gap#3 call `@xenova/transformers` a "hard direct dep" | Corrected: it is an `optionalDependency`; C-D2 amendment describes the actual declaration (auditor CN-1 / overseer EO-6). |
| Install footprint | `pnpm-lock.yaml` | New stack pulls native `onnxruntime-node` (GPU build at postinstall) + `onnxruntime-web` + `sharp` | Accepted — optionalDependency, lazy, T-D60 fallback if native install/load fails. Flagged for A3 posture + D1 deploy. |

## Open Questions

- [ ] **Ratification (class-(i), C-D2 amendment)** — A2 does not auto-merge; needs spec-author ratification at merge. The settled M-1 ruling covers the stack swap; the overseer confirms the C-D2 wording through the authenticated channel. Landing site: overseer ratification gate → merge.

## Recently Resolved

- M-1 (protobufjs/embeddings portion) — the deploy-blocking **Critical protobufjs RCE** (+ 4 High + 4 Moderate protobufjs advisories) cleared. Combined with A1, the prod audit is now **1 moderate** (react-router), addressed by A3.

## Cross-Module Dependencies

**Upstream:** `@huggingface/transformers@3` (optional; RAG text substrate embedder).
**Downstream:** **A3** (residual sweep, react-router + posture statement) and **D1** (deploy; shared `package.json`) rebase on this. **M-10** (final PLATFORM_STATUS) folds the "embeddings stack migrated / Critical cleared" state.

## Verification — `pnpm audit --prod` before/after

| Severity | Before A2 (= after A1) | After A2 | Cleared by A2 |
|---|---|---|---|
| Critical | 1 | 0 | protobufjs RCE |
| High | 4 | 0 | 4× protobuf.js (code-injection / gadget / DoS ×2) |
| Moderate | 5 | 1 | 4× protobufjs (DoS / prototype-injection / overlong-UTF8 / recursive-JSON) |
| **Total** | **10** | **1** | **9 protobufjs advisories** |

Remaining: 1 moderate (react-router `<6.30.4`) → A3.
**Gate:** typecheck ✓ · test ✓ (610 / 204) · lint ✓ · build ✓. **Boot:** `127.0.0.1:47823` health/methodologies/clean-shutdown ✓. **Lockfile:** `--frozen-lockfile` consistent.

## Reference

- Plan §5 A2; audit `2026-06-06-end-to-end-summary.md` (M-1); `CODE_SPEC.md` C-D2; `DECISIONS.md` T-D60 / T-D25 / T-D31; `SPEC.md §14`.
- PR: _(A2 draft)_.
