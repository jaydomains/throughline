# Executor wake-log — Slice D1 (deployment wiring: run the built artifact + single-command setup)

**Slice:** D1 of the audit-remediation plan (`2026-06-06-audit-remediation-plan.md`).
**Finding:** M-2 (run path + OS units + docs + DoD §11 single-command-setup sub-item).
**Branch:** `claude/d1-deploy-wiring` → base `main` (@ `7d0a252`, Group A included).
**Counterparts:** execution-auditor (`claude/sharp-cerf-mZ381`), execution-overseer (`claude/blissful-brown-POKvS`).

One line per event: last-seen remote HEAD (`git ls-remote`), set-diff (`N dropped / M added`), per-thread `X/5`.

---

- **2026-06-07** — Implementation commit. Last-seen remote: `main` `7d0a252`, auditor `8e8a99b`, overseer `a90747a` (`git ls-remote`). Set-diff: **0 dropped / 0 added (baseline — no reviewer findings on D1 yet)**. Threads: none.
  - **Scope (M-2):**
    - **Run path:** `packages/backend/package.json` `start: tsx --conditions=development src/index.ts` → **`node dist/index.js`** (the built artifact under production module resolution). `dev: tsx watch …` unchanged.
    - **Single-command setup (DoD §11 — PRIMARY path, no spec edit):** added **`scripts/setup.sh`** (executable; `pnpm install` + `pnpm -r build` for all packages, with run/auto-start guidance) and a root `package.json` **`start`** script (`pnpm --filter @throughline/backend start`). This makes SPEC §11 (`:601` "installs and runs via documented single-command setup") and §3 (`:51` "one command, scriptable on login") **true with no SPEC amendment** → **not a ratification class** (the plan's class-(ii) flag was conditional on the fallback, which I did not take).
    - **Deploy doc:** `docs/install/auto-start.md` — added a "Setup first (build the artifact)" section, corrected the `start`-runs-`dist` claim (now true), made the build-first requirement explicit (the three OS units run the same `start` and do **not** build for you), and added the simpler `pnpm start`.
  - **OS units:** the launchd / systemd / Task Scheduler units all invoke `pnpm --filter @throughline/backend start`, so they **inherit** the `start → node dist/index.js` fix automatically; the audit's contradiction (systemd `NODE_ENV=production` while invoking the dev resolver) is resolved — they now invoke the prod resolver. Units left unedited (they inherit the fix); the build-first requirement is documented globally.
  - **Verification:** `./scripts/setup.sh` runs clean (install + build all). `pnpm start` boots `node dist/index.js` under `NODE_ENV=production` on `127.0.0.1:47823`: `/health` 200, **SPA root `/` served 200** (built frontend dist served — confirms build-all + serve path), clean shutdown. Full gate green: typecheck · test (610 backend / 204 frontend) · lint · build.
  - **Carry-forward honoured:** the A2 footprint note (onnxruntime-node native/GPU postinstall) is relevant to this deploy path — the OS units run after `setup.sh` builds; if the optional native install fails, the T-D60 fallback keeps the backend running. Noted in the handover.
  - **Ratification:** **not** a ratification class — primary path provides the setup, making the existing SPEC claim true; no SPEC/CODE_SPEC/DECISIONS edit. Auto-merges on the standard gate.
