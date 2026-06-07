# Auditor-B — Slice 1: Deployability & Dependency-Security Deep-Dive

*Independent slice audit (parallel to Auditor-A). Durable record on Auditor-B's own branch,
written before any read of A's slice-1 findings. Pushed to the slice-1 PR
(`claude/audit-slice-1-deployability`) as `B-S1-k` comments once it opens.*

**Anchored by:** M-1 (deps RCE), M-2 (prod run-path), M-3 (UUID UX — out of my deep focus; deploy-path findings below).
**HEAD:** main `5d489ea`. **Method:** ran the real deploy path + `pnpm audit --prod` + runtime import probes; verify-don't-trust.

---

## B-S1-1 — The Critical protobufjs RCE path is reachable in a *default* install, not opt-in-gated
- **Severity:** High
- **Evidence:** `@xenova/transformers` is an **optionalDependency** of the backend — pnpm/npm install optionalDependencies **by default**, and the symlink is present (`packages/backend/node_modules/@xenova/transformers → .pnpm/@xenova+transformers@2.17.2`). I probed the actual runtime resolution: `node -e import('@xenova/transformers')` → **IMPORT OK**. So `embeddings.ts`'s lazy `import('@xenova/transformers')` (line 111) **succeeds** on a default box; the real embedder resolves, calls `pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2')`, which auto-downloads the model from HuggingFace on first use, and `onnxruntime-web@1.14.0` parses it via **`protobufjs@6.11.6`** — the Critical (`<7.5.5`, arbitrary code execution) advisory.
- **Gap:** The reconciled M-1 caveat ("reachability narrowed — loads only when the optional embeddings model is installed") *understates* it. The package is present **by default**; the only gate is first RAG/intelligence use triggering the model download. The vulnerable parser then loads on a stock install. Threat vector = a malicious/compromised `.onnx` model fed to the protobuf decoder (supply-chain or MITM on the HF download), bounded by the single-user / `127.0.0.1` posture. Net: keep **High** (Critical advisory on a default-reachable path); real-world exploitability is narrow (semi-trusted model source), but it is *not* behind an explicit user opt-in as the deferral framing implies.
- **Confidence:** High (runtime import + dependency tree both verified).

## B-S1-2 — protobufjs is transitively *pinned*; "protobufjs 6→7" is a stack upgrade, not a bump
- **Severity:** Medium (remediation-cost correction to M-1)
- **Evidence:** `onnx-proto@4.0.4` declares `"protobufjs": "^6.8.8"` (verified in its `package.json`); it is pulled by `onnxruntime-web@1.14.0` ← `@xenova/transformers@2.17.2`. protobufjs 6→7 carries API/codegen changes onnx-proto@4 does not support, so you **cannot** lift protobufjs to the patched `>=7.5.5` without breaking `onnx-proto`, or forcing a pnpm `overrides` that onnx-proto@4 may not tolerate.
- **Gap:** PLATFORM_STATUS describes the E17a deferral as "protobufjs 6→7" — implying a version bump. The real remediation is replacing the embeddings stack (e.g. `@xenova/transformers@2` → `@huggingface/transformers@3` with a newer onnxruntime that drops onnx-proto/protobufjs-6). That is genuinely deferred-major work — correctly deferred, but **mis-described** as a bump, which hides its true cost from anyone planning the fastify-v5 phase.
- **Confidence:** High.

## B-S1-3 — The "DEFERRED-MAJOR" blob mixes one-line patches with real majors, delaying cheap security fixes
- **Severity:** Medium
- **Evidence:** `pnpm audit --prod` advisories, triaged by remediation cost:
  - `react-router-dom 6.30.3 → 6.30.4` (open-redirect, Moderate) — **PATCH**. Deployable now.
  - `fast-uri → 3.1.2` (two Highs: path-traversal, host-confusion) — **PATCH** (transitive under fastify; pnpm `overrides` or fastify bump). Deployable now.
  - `fastify 4.29.1 → >=5.7.2` (High content-type bypass) / `>=5.8.3` (Moderate proto/host spoof) — **MAJOR**. There is **no fastify-4 patch**; the only remedy is the 5.x major (the genuine E17a deferral). Note the patched floor is `5.8.3`, so "fastify 4→5" must target a *specific* minor, not just "5".
  - `protobufjs` — major stack upgrade (B-S1-2).
  - `vite` / `esbuild` (also in the deferred list) — **devDependencies**, excluded from `--prod`; **no runtime/prod exposure** at all.
- **Gap:** E17a's "DEFERRED-MAJOR (Option 1) — all dep remediation deferred" lumps two cheap patches (react-router, fast-uri = 3 of the High/Moderate advisories) and two dev-only build deps in with the two true majors (fastify, protobufjs). The cheap patches could ship now and clear real runtime advisories; deferring them as "major" leaves runtime exposure open for no remediation-cost reason.
- **Confidence:** High.

## B-S1-4 — The documented "production" auto-start is doubly fictional; a verified-working compiled path exists but is bypassed
- **Severity:** Medium (deepens M-2)
- **Evidence:** `start` = `tsx --conditions=development src/index.ts`.
  1. `--conditions=development` forces the dev module map (`@throughline/shared` → its `src/index.ts`, not `dist`).
  2. `NODE_ENV` is read **nowhere** in `packages/backend/src` (verified grep → NONE). So the systemd unit's `Environment=NODE_ENV=production` is **wholly inert** — it changes nothing.
  3. I ran the *built* artifact directly: `node packages/backend/dist/index.js` → boots clean and serves (`"Server listening at http://127.0.0.1:45799"`, exit 137 = killed by my timeout = stayed up). So a **working compiled production path exists** — `start` just doesn't use it.
- **Gap:** `auto-start.md` claims *"`start` runs the compiled `dist/index.js` after `pnpm build`"* — false. All three OS units (launchd / Task Scheduler / systemd) invoke the same `start`, so **every** documented auto-start inherits the dev-resolver-on-TS-source path. The fix is a one-liner (`"start": "node dist/index.js"`, keeping `dev` as the `tsx watch` variant) and the artifact is proven-runnable. `tsx` is a prod `dependency`, so the current path at least *functions* (doesn't crash) — but production ships TS source + a transpiler instead of built JS, and the backend `dist/` that `pnpm build` emits is dead weight on the run path.
- **Confidence:** High.

## B-S1-5 — Secrets-at-rest & bind posture hold under the real deploy path (scope-negative, NOT a finding)
- **Re-confirmed per slice scope (T-D4 / T-D31):**
  - **Bind:** `config.ts:54` hardcodes `host: '127.0.0.1'` with **no env override** — only `THROUGHLINE_PORT` is env-tunable; there is no path to bind `0.0.0.0`. T-D31 is enforced *structurally*, not by convention.
  - **Secrets:** `secrets.json` lives in `THROUGHLINE_DATA_DIR` (`config.ts:43`), separate from the SQLite datastore. `backup/service.ts:10-13` snapshots only the DB file — secrets are "never part of a snapshot by construction." Written `0600`, atomic (temp+rename). T-D4 honored.
- **No finding.** Recording so the Overseer has the deploy-path security confirmation, not just the overpass spot-check.

## B-S1-6 — "What is between current state and a deployable single-user install" (synthesis, per slice ask)
1. **[High] Critical RCE on a default-reachable path** (B-S1-1) — clears only via the embeddings/onnx **stack upgrade** (B-S1-2), genuinely major.
2. **[Medium] No working *documented* production run command** (B-S1-4) — `start` runs the dev resolver; doc claims `dist`; `NODE_ENV=production` is inert. One-line script fix + doc correction; the compiled artifact already works.
3. **[Medium] fastify 4→5 major migration** — the real deferred runtime-security work; must land `>=5.8.3`.
4. **[Medium] Cheap runtime security patches stranded in the major-deferral blob** (B-S1-3) — react-router `6.30.4` + fast-uri `3.1.2` are shippable now and clear 3 advisories.
5. **Otherwise the substrate is deployable:** `pnpm install` (exit 0) + `pnpm build` + the full gate are green (M-14); `node dist/index.js` serves the built frontend + API; secrets/bind posture is sound (B-S1-5); single-user/`127.0.0.1` bounds blast radius. The blockers to an *honest* "production-ready" claim are dependency-security (#1/#3/#4) and the production run-command wiring (#2) — not the application code.

---

*B-S1 complete. — Auditor-B*
