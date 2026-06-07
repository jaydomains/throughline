# Throughline — Handover: Slice A3 (residual advisory sweep + honest dependency posture)

**Status:** final — approved by executor
**Generated:** 2026-06-07 09:40 UTC
**Last commit SHA:** _(merge SHA assigned by execution-overseer at merge)_ — 2026-06-07
**Previous handover:** `docs/_meta/throughline/handovers/2026-06-07-A2-embeddings-protobufjs.md` (A2)
**Slice:** A3 of the audit-remediation cohort — **closes Group A**. **PR:** _(A3 draft)_.

---

## Build State vs Spec

| Plan deliverable (A3, §5 Group A) | State | Evidence | Notes |
|---|---|---|---|
| Re-run `pnpm audit --prod` after A1+A2 | done | prod 1 → 0 | only react-router remained pre-A3 |
| Address remaining Moderates (vite/esbuild) where a clean bump exists | built | `packages/frontend/package.json` (vite ^8, vitest ^4, plugin-react ^6) | clean bump existed → applied (no accepted-residual needed) |
| Clear react-router (prod) | built | `react-router-dom ^6.30.4` | open-redirect moderate cleared |
| Document accepted residuals w/ rationale | n/a | _none_ | every advisory had a clean bump → zero residuals |
| Dependency-posture statement (feeds M-10) | built | this handover, "Dependency posture" §below | corrects "mere version bumps" framing |

## Last Decision Minted

> No new decisions minted. A3 is dependency hygiene only — no SPEC/CODE_SPEC/DECISIONS or T-D/C-D anchor touched. Not a ratification class.

## Active Blockers

_none._

## Files Changed Since Last Handover

**New:** `docs/_meta/throughline/plans/2026-06-07-audit-remediation-A3-executor-wake-log.md`; this handover.
**Modified:**
- `packages/frontend/package.json` — `react-router-dom ^6.23.1→^6.30.4`, `vite ^5.2.11→^8.0.0`, `@vitejs/plugin-react ^4.3.0→^6.0.0`, `vitest ^1.5.0→^4.1.0`.
- `packages/backend/package.json` — `vitest ^1.5.0→^4.1.0` (devDep).
- `pnpm-lock.yaml` — regenerated (−1146/+485; old vite-5/vitest-1/esbuild-0.21 chains removed).

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Bump magnitude | `frontend/package.json` | Plan named "vite 5→6" as the candidate; latest stable is vite 8 / vitest 4 / plugin-react 6 | Went to current stable majors — the only versions that clear the advisories (vitest critical needs `>=4.1.0`; vite needs `>=6.4.2`). Clean: gate green, **no config/test changes**. Plan anticipated "could be larger if vite 6 has a breaking surface" — there was none. |
| Better-than-planned outcome | — | Plan anticipated possible accepted-residuals | None needed — every advisory had a clean bump; full tree now advisory-free. |

## Open Questions

_none for A3._

## Recently Resolved

- **M-1 fully closed (Group A complete).** A1 (fastify) + A2 (embeddings/protobufjs) + A3 (residual sweep) take the audited tree from **15 → 0** advisories.

## Cross-Module Dependencies

**Upstream:** vite 8 / vitest 4 / @vitejs/plugin-react 6 (build+test tooling); react-router-dom 6.30.4 (frontend runtime).
**Downstream:** **D1** (deploy; shares backend `package.json`) rebases on this. **M-10** (final PLATFORM_STATUS) folds the dependency-posture statement below. **B6** (README) can now make an honest "dependency-hardened" claim.

## Dependency posture (post-Group-A — for M-10 and B6)

**Correction of the PLATFORM_STATUS framing.** The audited deferred dependency set was **not "mere version bumps"** as the living status doc characterised it. It carried a **Critical protobufjs RCE + 7 High advisories in the production tree** and required real remediation across three slices:
- **A1** — a **fastify v4→v5 major migration** (cleared the content-type-bypass High, the two fast-uri Highs, a spoofable Moderate, and a sendWebStream Low; floor `^5.8.3`).
- **A2** — a **full embeddings-stack replacement** `@xenova/transformers@2 → @huggingface/transformers@3` (the protobufjs Critical was transitively pinned via `onnx-proto@4 → protobufjs ^6.8.8` and unliftable by override; cleared the Critical + 4 High + 4 Moderate protobufjs advisories). C-D2 amended.
- **A3** — a **build-tooling major migration** (vite 5→8, vitest 1→4, @vitejs/plugin-react 4→6) clearing the dev-tree Vitest-UI Critical + Vite/esbuild Moderates, plus a **react-router** patch (6.30.3→6.30.4) clearing the only remaining prod-runtime Moderate.

**Result:** `pnpm audit --prod` **and** full `pnpm audit` both report **0 known vulnerabilities** (from 15: 1 Critical / 7 High / 6 Moderate / 1 Low). **No accepted residuals.** The dependency-posture precondition for an honest "production-ready"/"dependency-hardened" claim is **met**.

**Footprint note (carry-forward, EO-12):** the A2 embeddings successor `@huggingface/transformers@3` pulls native `onnxruntime-node` (its postinstall downloads a GPU/CUDA build from GitHub releases) + `onnxruntime-web` + `sharp` — a heavier install footprint than the prior WASM-only path. Mitigated: it is an `optionalDependency`, lazy-loaded, with the T-D60 capability-absent fallback if the native install/load fails. Relevant to the D1 deploy path; not an advisory.

## Verification — audit before/after (full cohort)

| Severity | Audit start (pre-A1) | After A1 | After A2 | After A3 |
|---|---|---|---|---|
| Critical | 1 | 1 | 0 | **0** |
| High | 7 | 4 | 0 | **0** |
| Moderate | 6 | 5 | 5→1\* | **0** |
| Low | 1 | 0 | 0 | **0** |
| **Total (full incl. dev)** | **15** | — | — | **0** |

\*A2's `--prod` audit showed 1 (react-router); the dev-tree vitest/vite/esbuild (1 Critical + 2 Moderate) were visible only in the full audit and are cleared by A3.

**Gate:** typecheck ✓ · test ✓ (610 / 204, vitest 4) · lint ✓ · build ✓ (vite 8). **Boot:** `127.0.0.1:47823` health 200, clean shutdown. **Lockfile:** `--frozen-lockfile` consistent.

## Reference

- Plan §5 A3 + §6 (Group A closeout); audit `2026-06-06-end-to-end-summary.md` (M-1, M-10, M-12).
- PR: _(A3 draft)_.
