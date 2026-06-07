# Executor wake-log — Slice A3 (residual advisory sweep + honest dependency posture)

**Slice:** A3 of the audit-remediation plan (`2026-06-06-audit-remediation-plan.md`) — **closes Group A**.
**Finding:** M-1 (closeout); feeds M-10.
**Branch:** `claude/a3-residual-sweep` → base `main` (@ `7632f1a`, A1+A2 included).
**Counterparts:** execution-auditor (`claude/sharp-cerf-mZ381`), execution-overseer (`claude/blissful-brown-POKvS`).

One line per event: last-seen remote HEAD (`git ls-remote`), set-diff (`N dropped / M added`), per-thread `X/5`.

---

- **2026-06-07** — Implementation commit. Last-seen remote: `main` `7632f1a`, auditor `b455300`, overseer `af938e7` (`git ls-remote`). Set-diff: **0 dropped / 0 added (baseline — no reviewer findings on A3 yet)**. Threads: none.
  - **Scope (residual sweep):** cleared all four remaining advisories — **clean bumps existed for every one**, so no accepted-residuals were needed.
    - **react-router** (moderate, **prod**): `react-router-dom ^6.23.1 → ^6.30.4` (resolves 6.30.4; patched floor for the open-redirect). Frontend runtime dep.
    - **vitest** (critical, dev), **vite** + **esbuild** (moderate, dev): bumped frontend `vite ^5.2.11 → ^8.0.0`, `@vitejs/plugin-react ^4.3.0 → ^6.0.0`, `vitest ^1.5.0 → ^4.1.0`, and backend `vitest ^1.5.0 → ^4.1.0`. vitest 4 pulls vite 8 + esbuild 0.27.7, clearing all three dev-tree advisories at once. Configs (`vite.config.ts`, `vitest.config.ts` ×2) needed **no** changes — options are portable across the majors; **no test edits**.
  - **Files:** `packages/frontend/package.json` (react-router-dom, vite, plugin-react, vitest), `packages/backend/package.json` (vitest devDep), `pnpm-lock.yaml` (−1146/+485). **No source/spec/anchor/PLATFORM_STATUS edits** (M-10 owns PLATFORM_STATUS; A3 records the posture text here for M-10 to fold — plan §3.B collision rule).
  - **Audit delta (`pnpm audit`):** **prod 1 → 0; full 4 → 0.** With A1+A2+A3 the whole tree (prod + dev) is advisory-free — down from 15 (1 Critical, 7 High, 6 Moderate, 1 Low) at audit start.
  - **Gate:** typecheck ✓ · test ✓ (610 backend / 204 frontend — M-14 baseline preserved under vitest 4) · lint ✓ · build ✓ (frontend vite-8 build ✓). Boot ✓ (`127.0.0.1:47823` health 200, clean shutdown). `--frozen-lockfile` consistent.
  - **Ratification:** A3 is **not** a ratification class — no SPEC/CODE_SPEC/DECISIONS or anchor touched (only dependency manifests). Auto-merges on the standard gate.
  - **Dependency-posture statement (for M-10):** see the handover's "Dependency posture" section — corrects the PLATFORM_STATUS "mere version bumps" mischaracterization and carries the onnxruntime-node/sharp footprint note (EO-12).

- **2026-06-07** — Fix-round (EO-13, circuit-breaker round 1). Last-seen remote: `main` `7632f1a`, auditor `1cb90d1`, overseer `ec20213`, self `d5a897f` (`git ls-remote`). Set-diff: **0 dropped / 1 added (EO-13)**. Threads: EO-13 **1/5**.
  - **Finding:** the CI `gate` failed nondeterministically at `d5a897f` (two runs at the same SHA split pass/fail) — `gatesView.test.tsx:88` `getByTestId('gate-status-structure-check')` ran before the async `listGateFirings` data rendered; the rendered DOM was the empty gates state. vitest 4's changed async scheduling exposed a **pre-existing race** the test always had (the `waitFor` waited only on the `view-gates` container, not the data node). Independently caught by the overseer (EO-13) and by me from the CI log.
  - **Root-cause fix (not re-run, not weakening):** `packages/frontend/test/gatesView.test.tsx` — replaced `await waitFor(view-gates)` + bare `getByTestId(gate-status-structure-check)` with `await screen.findByTestId('gate-status-structure-check')` (async-aware retry on the actual data node). Assertions unchanged. Verified: gatesView test 4/4 green; full frontend suite 204/204 ×2 green; scan confirms no sibling instance of the container-wait anti-pattern. Sole change is the test wait; no product code, no other test, no dependency touched.
