<!-- Historical artifact. Audit 1 of 5, conducted 2026-05-28 against the repo state of that date. Committed retroactively 2026-05-30 (see handover 2026-05-30-audit-backfill-five-audit-reports.md). Transcribed verbatim from the original session deliverable — NOT edited, summarized, or updated. Findings later closed by subsequent phases are still listed here as originally found; closure is recorded in PLATFORM_STATUS / handovers, not here. -->

# Throughline — Comprehensive Build Audit

**Date:** 2026-05-28 · **Branch:** `claude/zealous-archimedes-hYx5s` · **Scope:** build pipeline only (read-only; no fixes made)
**Environment:** Node v22.22.2, pnpm 9.0.0 · resolved toolchain: TypeScript 5.9.3, ESLint 9.39.4, Vite 5.4.21, Vitest 1.6.1

## Headline

**The green gate is genuinely green.** `pnpm -r typecheck && test && lint && build` all exit 0: 500/500 backend tests, 182/182 frontend tests, 0 lint errors, 0 lint warnings, 0 typecheck errors, all builds emit. **But the build *passing* and the build *output working* are not the same thing** — the single most important finding is that the backend's built `dist/` artifact cannot run under plain Node.

## Per-segment summary

| # | Segment | Result | Findings |
|---|---|---|---|
| 1 | Install / dependency health | exit 0, clean install | 1 critical + 7 high + 7 moderate + 1 low audit advisories |
| 2 | Typecheck (×3 pkgs) | exit 0, clean | 2 informational |
| 3 | Lint (×3 pkgs) | exit 0, **fully clean** | 0 |
| 4 | Test (backend+frontend) | exit 0, 500+182 pass | 3 (1 info, 2 warning) |
| 5 | Build (×3 + monorepo) | exit 0 all | **1 functional-defect** + 1 info |
| 6 | Cross-package integration | clean wiring | 1 warning (→ confirmed by #5), 4 info |
| 7 | CI / workflow config | YAML valid, pins current | 2 warning, 3 info |

---

## Findings grouped by severity

### 🔴 FAILURE-CLASS (build exits 0 but output is broken)

**F1 — Backend `dist/` artifact is non-runnable under plain Node.** *(Segment 5, confirmed via Segment 6)*
`pnpm --filter @throughline/backend build` exits 0 and emits `dist/index.js`, but running it fails:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/throughline/packages/shared/src/bundle.js'
imported from /home/user/throughline/packages/shared/src/index.ts
    at finalizeResolution (node:internal/modules/esm/resolve:275:11)
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///home/user/throughline/packages/shared/src/bundle.js'
Node.js v22.22.2
```
Root cause: `packages/shared/package.json` declares `"main"/"types"/"exports["."]` all → `./src/index.ts` (raw TS). Backend's emitted `dist/index.js` imports `@throughline/shared`, which resolves through the symlink to `shared/src/index.ts`, whose `export * from './bundle.js'` has no `.js` on disk (only `bundle.ts`). Node cannot map `.js`→`.ts`.
- **Mitigant:** every actual run path uses `tsx` (`backend dev`=`tsx watch`, `start`=`tsx src/index.ts`), which transpiles `.ts` on the fly. No provided script runs `node dist/index.js`. So this is **latent** — but `package.json:main` claims `./dist/index.js`, and the `build` step (run in CI) produces an artifact that doesn't run.
- **Category:** runtime-resolution / build-output-validity · **Suggested triage:** **fix-now or accept-by-design (your call)** — either point shared's `exports` at a built `dist/` for the runtime condition (and keep `./src` for a `development`/`types` condition), or document that `dist/` is type-only and the runtime entry is always `tsx`. The build currently emits a misleading artifact.

### 🟠 HIGH / WARNING

**W1 — Security advisories: 1 critical + 7 high (16 total).** *(Segment 1)* `pnpm audit` → `1 low | 7 moderate | 7 high | 1 critical`:
- **critical** `protobufjs <7.5.5` arbitrary code execution — path `backend > @xenova/transformers@2.17.2 > onnxruntime-web@1.14.0 > onnx-proto@4.0.4 > protobufjs@6.11.6` *(optional-dep chain)*
- **high** `fastify <5.7.2` Content-Type body-validation bypass — `backend > fastify@4.29.1` (**patch is in the v5 line → remediation = major upgrade**)
- **high ×2** `fast-uri <=3.1.1` path-traversal + host-confusion (via fastify)
- **high ×4** `protobufjs <=7.5.5` code injection / gadget / process-wide DoS / unbounded recursion *(optional-dep chain)*
- **moderate ×7** esbuild `<=0.24.2` dev-server SSRF; fastify protocol/host spoofing; `vite <=6.4.1` path traversal; protobufjs ×4
- **low** fastify DoS via unbounded memory in `sendWebStream`
- **Pattern:** the critical + 5 of the highs are concentrated in the **optional** `@xenova/transformers`→onnx→protobufjs chain (only loaded if the optional dep is used); the fastify/fast-uri/vite/esbuild advisories sit in the **real** runtime/build path. · **Suggested triage:** **queue** — fastify/vite/esbuild bumps are in-range or minor; the fastify→v5 jump and the optional-chain criticals warrant a deliberate decision. Out-of-scope to fix here.

**W2 — Node major-version divergence, nothing pins local runtime.** *(Segment 7)* CI pins `node-version: 20` (`ci.yml:37`); this environment runs Node v22.22.2; **no `engines` field in any package.json** and no `.nvmrc`/`.node-version`. `@types/node` pinned `^20` reinforces a Node-20 baseline the local Node-22 diverges from. · **queue** — add `engines.node` and/or align CI to the dev runtime.

**W3 — CI is advisory, not a required status check.** *(Segment 7)* `ci.yml:9-13` and `PLATFORM_STATUS.md:43` both state the workflow runs but does not gate merges until set as a required check in branch protection. Already tracked in Queued Work. · **queue** (known out-of-band repo-admin action).

**W4 — React Router v7 future-flag warnings flood frontend test stderr.** *(Segment 4)*
```
⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7...
⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7...
```
Emitted on nearly every `frontend/test/*.test.tsx`. Not a failure (exit 0). · **queue** — opt into `v7_startTransition`/`v7_relativeSplatPath` to silence; deprecation signal for the eventual RR v7 migration.

### 🟡 INFORMATIONAL

- **I1 — Backend test files are not statically typechecked.** *(Segment 2)* `packages/backend/tsconfig.json` → `"exclude": ["test/**/*","dist/**/*"]`; frontend `tsconfig.app.json` → `"include": ["src","test","vitest.setup.ts"]`. The cohort-hardener's six strict-tsc errors were caught *only* because frontend includes `test/`. Equivalent backend test type errors would escape `pnpm typecheck` entirely (vitest runs them but doesn't statically typecheck). · **queue** — add backend `test/**` to a typecheck config.
- **I2 — `shared` test is a no-op.** *(Segment 4)* `"test": "echo 'no tests' && exit 0"`; zero test files in shared. `pnpm -r test` reports it green. Presented neutrally. · **accept or queue.**
- **I3 — shared's `dist/` build is dead weight in-repo.** *(Segment 6)* Because consumers import `./src/index.ts`, shared's `tsc`→`dist/` output is referenced by nothing (flip side of F1). · **accept** (resolved if F1 is fixed by pointing exports at dist).
- **I4 — TypeScript version drift.** *(Segments 2, 6)* All manifests pin `^5.4.5`; resolved 5.9.3. Uniform across packages, no skew. · **accept.**
- **I5 — No cross-package TS project references** (by design); wiring is pnpm symlink + resolver only. *(Segment 6)* · **accept.**
- **I6 — `pnpm -r build` (CI) topological vs root `pnpm build` serial.** *(Segments 6, 7)* Both place shared first; frontend/backend order differs but they're independent → equally correct. · **accept.**
- **I7 — `pull_request` trigger has no branch filter** (fires for all PR bases); `push` scoped to `main`+`claude/**`. Conventional. *(Segment 7)* · **accept.**
- **I8 — Single workflow, no `concurrency` / `timeout-minutes` / matrix.** *(Segment 7)* · **accept** (optional cheap hardening: add `concurrency` + `timeout-minutes`).
- **I9 — Backend benign warn-level test logs** (`gate dispatch plan-mode: no project resolved`; `notifier: no OS backend available … using no-op fallback`). Expected fallbacks, no error-level lines. *(Segment 4)* · **accept.**

---

## Cross-cutting patterns

1. **One root cause spans the two most substantive findings (F1 + I3).** The "consume shared as raw `./src/index.ts`" design makes typecheck/dev/tests work seamlessly (tsx + bundler resolution) but produces a backend `dist/` that can't run under Node *and* a shared `dist/` that nothing uses. Fixing the `exports` map resolves both.
2. **"Green masks gaps" theme (I1 + I2).** Two independent places where the green gate hides missing coverage: shared's no-op test and backend tests being excluded from `tsc`. The CI gate's own blind spots.
3. **Version/runtime drift theme (W2 + I4).** Node 20 (CI) vs 22 (local) with no `engines`, plus TS `^5.4.5`→5.9.3 — the toolchain developers run isn't the one pinned anywhere.
4. **Security advisories cluster by dependency tree (W1).** The critical + most highs live in the *optional* `@xenova/transformers` ML chain; the in-path runtime concerns are fastify/fast-uri/vite/esbuild.

## Recommendation buckets

- **fix-now (your decision):** F1 (backend dist runtime resolution) — or consciously accept-by-design and document `dist` as type-only.
- **queue (into PLATFORM_STATUS):** W1 (security bumps, esp. fastify v5 + optional-chain criticals), W2 (Node `engines`/CI alignment), W4 (RR v7 flags), I1 (backend test typecheck coverage), and W3 (already queued).
- **accept:** I2–I9 (with optional cheap CI hardening on I8).

---

### Per-segment detail notes (captured during the audit)

- **Install:** `pnpm install --frozen-lockfile` exit 0; lockfile up to date; pnpm@9 ran native build scripts (better-sqlite3, sharp, esbuild, protobufjs) rather than blocking them; the optional `@xenova/transformers` chain resolved fully (sharp downloaded libvips). No deprecation/peer-dep warnings during install. `pnpm audit`: 16 advisories (1 critical / 7 high / 7 moderate / 1 low) as itemized in W1.
- **Typecheck:** `shared`/`frontend`/`backend` each exit 0; aggregate `pnpm -r typecheck` matches; resolved TypeScript 5.9.3 (manifests pin ^5.4.5). Coverage asymmetry: backend `tsconfig.json` excludes `test/**` (I1); frontend `tsconfig.app.json` includes `test`.
- **Lint:** `eslint` 9.39.4 + typescript-eslint 8.59.3, flat config; 0 errors / 0 warnings across all three packages (JSON formatter confirmed no hidden warnings). Custom rules: `no-unused-vars` (warn, `^_` ignore), `consistent-type-imports` (error), `prefer-const` (error, ignoreReadBeforeAssign).
- **Test:** backend 500/500 (52 files), frontend 182/182 (29 files), shared no-op; vitest 1.6.1; frontend jsdom + vitest.setup.ts. Warnings surfaced separately: React Router v7 future-flag warnings (W4), benign backend pino warn logs (I9). No failures, no unhandled rejections, no deprecations.
- **Build:** `shared` (tsc), `backend` (tsc + copy-migrations.mjs), `frontend` (tsc -b && vite build) all exit 0; root `pnpm build` and `pnpm -r build` exit 0. Frontend JS bundle 383.57 kB (gzip 113.14 kB, map 1,482.28 kB) — under vite's 500 kB warning threshold, no vite warnings. copy-migrations.mjs mirrors `.sql` migrations + the bootstrap prompt template into `dist/`. The runtime-resolution failure (F1) is the dedicated build finding.
- **Cross-package:** workspace topology (3 packages); `workspace:*` resolves to `link:../shared` symlink; no cross-package TS project references (I5); root serial vs `pnpm -r` topological build order both correct (I6); shared consumed as source, so its `dist/` is dead (I3); the backend-runtime resolution risk (→ confirmed as F1).
- **CI/workflow:** `ci.yml` YAML valid; action pins current (`checkout@v4`, `pnpm/action-setup@v4` v9.0.0 matching `packageManager`, `setup-node@v4` node 20 + `cache: pnpm`); step chain matches the documented gate. Findings: W2 (Node divergence), W3 (advisory-not-required), I7 (unfiltered `pull_request`), I8 (no concurrency/timeout/matrix), I6 (build-order note).

---
*Build green; one functional build defect (dist unrunnable under node), plus dependency-advisory and runtime-divergence items to triage.*
