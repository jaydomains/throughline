# Execution-Auditor — Pre-Registered Positions (Audit-Remediation Cohort)

**Role:** execution-auditor · **Counterpart:** executor · **Overseer:** execution-overseer ·
**Escalation:** spec-author.
**Audit branch:** `claude/sharp-cerf-mZ381`.
**Yardstick:** the approved plan
`docs/_meta/throughline/plans/2026-06-06-audit-remediation-plan.md` (merged #135) +
`SPEC.md` / `CODE_SPEC.md` / `DECISIONS.md` + the verification bar (three-layer green gate).

> **Anti-anchoring discipline (role §3.2 / §4.2).** These positions are derived from the
> approved plan and the spec **before** any executor diff exists. They are pre-registered and
> timestamped so my later review cannot collapse into agreement with the executor's framing.
> Each slice gets its positions refined the moment its draft PR is known and *before* I read
> its diff. Recorded `0 dropped / 0 added (baseline — positions pre-registered, no findings yet)`.

**Timestamp:** 2026-06-07 (session start, before any executor slice PR exists).

---

## A. Cohort-level positions (apply to every slice)

- **CP-1 — Plan fidelity, both directions.** Each slice must implement exactly what its plan
  entry scopes — **no more, no less**. A silent *partial* (part of a slice's scope shipped as if
  whole) is a finding (role §7). A silent *expansion* (work beyond the slice's scope) is a
  scope-departure I surface (role §7e, ratification class iii). Measured against §5 of the plan
  for that slice.
- **CP-2 — Three-layer gate green at PR HEAD, real-code.** typecheck + test + lint + build all
  green at the actual PR head SHA, verified against the real CI run / a local run — **not** the PR
  body's claim. A red or skipped bar is itself a finding. "Tests pass" is confirmed, never trusted.
- **CP-3 — No regression against existing coverage.** 610 backend / 204 frontend tests is the
  audited baseline (M-14). A slice that drops, skips, or weakens existing tests without a
  plan-sanctioned reason is a finding. Net test count should not silently fall.
- **CP-4 — Spec/anchor consistency.** No slice may silently contradict SPEC / CODE_SPEC /
  DECISIONS or a T-D / C-D anchor. A slice that *needs* an anchor mint or spec amendment must carry
  it explicitly and is a ratification-class change (the overseer's gate; I verify the class is
  flagged, §4 of the plan).
- **CP-5 — Verification approach actually executed.** Each slice's plan entry names a
  verification (e.g. Group A re-runs `pnpm audit --prod` and records before/after counts in the
  handover). I confirm the *named* verification was actually performed and recorded, not asserted.
- **CP-6 — Collision/sequence discipline (plan §3, §6).** No two simultaneously-open slices edit
  the same shared doc; the sequence respects the dependency map. I flag a slice that lands out of
  its dependency order or opens a serialized shared file (`package.json`, `AUTO_CONTINUE_WORKFLOW.md`,
  `REQUIRED_READING.md`, `SPEC.md`, `PLATFORM_STATUS.md`) concurrently with its serialization peer.
- **CP-7 — Ratification flags present where the plan §4 requires them.** A2 (class i, C-D2),
  B1 (class iv), B4 (class ii), D1 (class ii, conditional), D3 (class ii+iii). I verify the
  executor/overseer treat these as ratification-gated, not auto-merge. (Merge execution is the
  overseer's; I only verify the class is honored.)
- **CP-8 — Handover written at slice close** (AUTHORING_DISCIPLINE post-work gate), and for
  Group A it records the before/after `pnpm audit --prod` counts (plan A1/A2/A3 verification).

---

## B. Slice A1 positions (expected first slice — fastify 4→5 + fast-uri pin)

Pre-registered before the A1 diff exists. Plan ref: §5 Group A → A1.

- **A1-P1 — Version floor.** `packages/backend/package.json` must bump `fastify ^4.27.0` to a
  range whose resolved version is **≥ 5.7.2** (the fixed floor for the content-type-bypass High).
  A bump to any `5.x < 5.7.2` does **not** clear the advisory and is a finding.
- **A1-P2 — fast-uri cleared.** `fast-uri` must resolve to its fixed floor — carried by fastify
  v5's dep set, or pinned via a `pnpm.overrides` entry if the resolved tree still pulls a
  vulnerable range. Verified by `pnpm audit --prod` showing the `fast-uri` advisory gone.
- **A1-P3 — v5 breaking-change surface actually handled.** ~36 backend files register routes /
  hooks with fastify, plus `src/server.ts` and `src/http/error-handler.ts`. v5 changes
  route/hook signatures, error handling, the schema/ajv compiler, the content-type parser, and
  plugin encapsulation. The diff must show these touched where the codebase uses the changed API
  — not a bare version bump that typechecks but breaks at runtime. A green typecheck alone does
  **not** prove v5 runtime compatibility.
- **A1-P4 — Lockfile updated** consistently with the manifest; no stale `fastify@4` left
  resolved in the tree.
- **A1-P5 — Gate green + boot.** Full three-layer gate green; backend boots and serves on
  `127.0.0.1:47823` (plan A1 verification — a runtime check, not just typecheck).
- **A1-P6 — audit counts recorded.** Before/after `pnpm audit --prod` counts recorded in the
  handover (plan A1 deliverable); the fastify-`<5.7.2` and fast-uri advisories show **cleared**.
- **A1-P7 — Scope containment.** A1 must touch only the fastify/fast-uri remediation surface.
  The embeddings/protobufjs work is **A2**; the `start`-script change is **D1**. A1 editing
  `start`/`embeddings.ts` is scope expansion (CP-1) — and D1 shares `package.json` with Group A,
  so A1 must not pre-empt it.
- **A1-P8 — No first-slice assumption baked.** If the executor's actual first slice is **not**
  A1, these A1 positions are held and I pre-register that slice's positions before reading its
  diff. The recommended sequence (plan §6) puts A1 first, but the executor chooses.

---

## C. Carry-forward notes (verify at the relevant slice; not yet findings)

- **CN-1 (A2 / C-D2).** Live `packages/backend/package.json` lists `@xenova/transformers` under
  **`optionalDependencies`**, *not* `dependencies` — contrary to plan §0's "(direct)" assertion
  and the audit's "hard direct dependency" framing (gap #3). pnpm installs optionalDependencies by
  default, so the protobufjs chain is still pulled into the prod tree, but the C-D2 amendment text
  in A2 must describe the **actual** declaration (optionalDependency), not repeat the plan's
  mischaracterization. Verify at A2; if the executor's C-D2 body inherits the wrong framing it is a
  correctness finding.
- **CN-2 (A2 transitive pin).** protobufjs Critical is transitively pinned via
  `@xenova/transformers@2 → onnxruntime-web → onnx-proto@4 (protobufjs ^6.8.8)`; an override alone
  cannot lift it without breaking onnx-proto@4. A2 must **replace the stack**
  (`@huggingface/transformers@3` candidate) and the executor must confirm the resolved tree
  actually clears the advisory before committing. An override-only "fix" is a finding.
- **CN-3 (B1 halt classes).** The blessed set is **4–9 (six classes)** per the plan's correction
  of M-8's "4/5/8/9" undercount. B1 must codify only **blessed** classes traceable to a Phase-E
  source; any of 4–9 lacking a traceable blessed definition (halt-7 the likely candidate) must be
  **surfaced**, not invented. I verify per-class provenance cites.
- **CN-4 (B1 / B3 no role-file back-port).** Per plan §4 / OV-1, B1+B3 land entirely in the
  project layer (AUTO_CONTINUE + REQUIRED_READING); the six `.claude/roles/*` externalize
  halt-classes and merge-method and need **no** edit. A slice editing the portable role files is a
  finding (scope); a slice that *should* have but didn't, also a finding — verify against the
  externalization claim.
- **CN-5 (B1 / OQ-2).** B1's dual-context §D rewrite turns on the unresolved OQ-2 (squash vs
  merge-commit for an execution-trio-reviewed auto-continue chain) — a class-(iv) durable-precedent
  question surfaced to the spec-author. B1 (class iv) must not merge without that ruling through the
  authenticated channel. If B1's diff pre-judges OQ-2 without a ruling, surface it.
- **CN-6 (D1 single-command setup).** Primary path = **provide** a real single-command setup that
  makes SPEC §11/§3/§601 true with no spec edit; the "document the manual reality" fallback alone is
  explicitly **not** acceptable (it leaves SPEC:601 false). The SPEC §11 amendment fallback is
  class-(ii) and only if a genuine single-command setup is infeasible.
- **CN-7 (D3 HELD).** D3 (M-6 bootstrap sub-actions) is **held** until OQ-1 is ruled through the
  authenticated channel; it must not be executed on the recommended default alone. Serializes with
  B4 on SPEC.md.
- **CN-8 (M-4 / B4 locus).** Markers go on SPEC §7.21 prose + the **§9** AI-feature table row
  (line ~548) — *not* §13 (the ruling/audit say "§13" but the AI table is in §9; §13 is Open
  questions). Verify B4 edits §9, and removes the orphaned `SettingsView.tsx` `'mermaid'` row.
- **CN-9 (M-10 LAST).** PLATFORM_STATUS full refresh must be the final slice; never opened early
  as a standalone doc-PR while the chain runs (plan §6 collision rule).

---

## B2. Slice A2 positions (PR #141 — embeddings-stack replacement / protobufjs Critical)

**Pre-registered 2026-06-07, before reading the A2 diff** (derived from plan §5 Group A → A2 +
C-D2 + T-D60 + my startup CN-1/CN-2). *Anti-anchoring note:* I have seen the PR #141 **body** via
the open-PR list (unavoidable), but **not** the diff/code; these positions are measured against the
plan/spec, not the executor's framing. Branch `claude/a2-embeddings-protobufjs` @ `2b1f4fda`.

- **A2-P1 — protobufjs Critical cleared.** The resolved tree must carry **protobufjs ≥ 7.5.5**
  (the fixed floor); the Critical RCE **and** the 4× High protobufjs advisories must show **cleared**
  in `pnpm audit --prod`. Verify in the lockfile + audit, not the PR body.
- **A2-P2 — stack REPLACED, not override-only (CN-2).** `@xenova/transformers` and `onnx-proto@4`
  must be **gone** from the resolved tree; `@huggingface/transformers` present. A `pnpm.overrides`
  lifting protobufjs under a retained `onnx-proto@4` would break it — an override-only "fix" is a
  finding. Confirm the executor verified the resolved tree clears the advisory *before* committing.
- **A2-P3 — embeddings.ts correctly adapted.** The dynamic import swapped to the new package; the
  feature-extraction pipeline API, the model id, and the **384-dim** embedding contract preserved or
  correctly adapted. Verify the actual code logic, not the "API unchanged" claim.
- **A2-P4 — C-D2 amendment accurate AND class-(i).** A C-D2 amendment must be present in
  `CODE_SPEC.md`, describe the **new** stack, and describe the dependency **as it actually is**.
  **Plan-vs-reality (CN-1, role §7e):** the plan §5-A2 instructs amending C-D2 to "reflect the
  already-true **hard-direct-dep** reality" — but the live declaration is an **`optionalDependency`**,
  so the plan's framing is itself wrong. The *accurate* amendment (optionalDependency + lazy import +
  T-D60 capability-absent fallback) is the correct outcome even though it departs from the plan's
  literal "hard direct dep" wording; I treat an accurate amendment as a **plan-vs-reality** note, not
  a fidelity failure — and an amendment that parrots the plan's wrong "hard direct dep" framing **is**
  a correctness finding (it re-introduces the inaccuracy CN-1 flagged).
- **A2-P5 — no regression; flake discipline.** Gate green; 610 backend / 204 frontend preserved
  (M-14). `rag.test.ts` (the §3.C flagged flake, most exercised by this swap) passing — and if it
  surfaces, **root-caused/stabilized, never re-run-until-green** (plan §3.C; codified circuit-breaker).
- **A2-P6 — RAG/embeddings path actually works (correctness crux).** The real embedder resolves and
  produces 384-dim vectors, **or** the honest T-D60 capability-absent mode engages — verify by
  exercising the embeddings/RAG path (install + test run where feasible), not by trusting "tests pass."
- **A2-P7 — audit before/after recorded** in the handover (claimed 10→1); the Critical+4High
  protobufjs cleared; **no NEW advisories** introduced by the new chain (verify via a fresh audit).
- **A2-P8 — scope containment + correct rebase.** A2 touches only the embeddings/protobufjs surface
  + C-D2; not A3 (react-router/residual sweep), not D1 (`start` script). Must be rebased on A1
  (`main`@`36be75a`, fastify v5) — confirm `package.json` carries the A1 fastify v5 floor, not a revert.
- **A2-P9 — footprint correctness (new-dependency risk).** `@huggingface/transformers@3` reportedly
  pulls native `onnxruntime-node` (postinstall downloads a CUDA build) + `sharp`. Verify: (a) a clean
  `--frozen-lockfile` install **succeeds** (or degrades gracefully as an optionalDependency without
  failing the install/gate), and (b) no new advisory enters the prod tree. A swap that clears
  protobufjs but breaks install or smuggles a new exposure is a finding.

## B3. Slice A3 positions (branch `claude/a3-residual-sweep` @ `d5a897f` — residual sweep + posture)

**Pre-registered 2026-06-07, before reading the A3 diff** (derived from plan §5 Group A → A3).
*Anti-anchoring:* I have seen only the diff **stat** (file list + line counts), not the diff content
or the handover/PR body. Measured against the plan, not the executor's framing. From my own A2
verification, the residual prod advisory on `main`@`7632f1a` was **1 moderate — react-router
`<6.30.4`**.

- **A3-P1 — react-router moderate cleared.** `react-router`/`react-router-dom` bumped to **≥6.30.4**;
  `pnpm audit --prod` shows the react-router advisory gone.
- **A3-P2 — final audit posture honest.** `pnpm audit --prod` is **clean**, OR any residual is an
  **explicitly-recorded accepted set** with reachability rationale (`127.0.0.1` bind, single-user).
  Verify the actual audit result independently — not the handover's claim.
- **A3-P3 — dependency-posture statement recorded (feeds M-10).** The handover carries
  before/after audit counts + the accepted-residual list with rationale, and **corrects the
  "mere version bumps" mischaracterization** of the E17a-deferred set. This is the text M-10 folds —
  verify it is accurate and self-contained.
- **A3-P4 — no regression; vite-major risk (correctness crux).** Gate green; 610 backend / 204
  frontend preserved. The lockfile churn + frontend `package.json` edit suggests a **vite 5→6 major
  bump** (and/or esbuild) — a major build-tool bump can break the frontend build, change output, or
  break tests. **Independently build the frontend + run its tests** where feasible; a green typecheck
  alone does not prove a vite-major bump is safe.
- **A3-P5 — scope containment + no A1/A2 revert.** A3 touches only the dependency-sweep + posture
  docs; **not** D1 (`start`), **not** SPEC, and **must not** open PLATFORM_STATUS (M-10's file, §3.B
  collision). `package.json` must still carry `fastify ^5.8.3` (A1) + `@huggingface/transformers
  ^3.8.1` (A2) — no regression of the prior links. Identify what the **backend** `package.json`
  1-line change is and confirm it is in-scope (a residual bump/override, not a stray edit).
- **A3-P6 — no NEW advisories.** The vite-6 / react-router bumps introduce no new prod advisory
  (verify via a fresh `pnpm audit --prod` on the resolved tree).
- **A3-P7 — Group A closeout.** A3 is the M-1 closeout; after it, the dependency posture is honest
  and the "production-ready" precondition (for M-12/B6) is met. Confirm the handover frames A3 as
  the Group-A completion and feeds M-10/M-12, without overreaching into those slices.

## B4. Slice D1 positions (PR #143 `claude/d1-deploy-wiring` @ `874cb8c` — deployment wiring, M-2)

**Pre-registered 2026-06-07, before reading the D1 diff** (derived from plan §5 Group D → D1 +
CN-6). *Anti-anchoring:* seen the PR body via the list, not the code.

- **D1-P1 — `start` runs the built artifact.** `packages/backend/package.json` `start` =
  **`node dist/index.js`** (built, production module resolution); `dev` stays `tsx watch`. No
  `tsx --conditions=development` left in `start`.
- **D1-P2 — OS auto-start units inherit the fix.** The launchd / systemd / Task Scheduler units
  run the built artifact under `NODE_ENV=production` (the audit's "systemd sets NODE_ENV=production
  while invoking the dev resolver" contradiction resolved). Verify the unit definitions in
  `auto-start.md` invoke `pnpm … start` (so they inherit) — not `tsx` directly.
- **D1-P3 — single-command setup PROVIDED (primary path, CN-6).** A real single-command setup
  exists (e.g. `scripts/setup.sh` and/or a root script) that runs install + build-all; it makes
  SPEC §11 (`:601`) / §3 (`:51`) **true with no SPEC edit**. The "document the manual reality"
  fallback **alone** is unacceptable. Verify the setup actually runs clean (install + build-all,
  shared→frontend→backend) — not just that a file exists.
- **D1-P4 — `auto-start.md` reconciled.** The false `:12-13` "start runs the compiled
  `dist/index.js` after `pnpm build`" claim is now **true**; the build-first requirement is explicit
  (the OS units don't build).
- **D1-P5 — boots/serves under prod resolution (correctness crux).** `node dist/index.js` under
  `NODE_ENV=production` boots and serves on `127.0.0.1:47823` (production module resolution, **not**
  the `development` condition) — `/health` ok, and the built **frontend (`/` SPA root) served**.
  Verify by running setup + boot, not trusting the claim.
- **D1-P6 — no regression + scope + retention.** Gate green; 610/204 preserved. D1 touches only
  deploy wiring (`start` script, setup script, `auto-start.md`) + docs; retains A1/A2/A3
  (`fastify ^5.8.3`, `@huggingface/transformers ^3.8.1`, vite 8 / vitest 4). No reach into other
  slices.
- **D1-P7 — NOT a ratification class (primary path) — verify no SPEC edit.** Because the primary
  "provide setup" path makes the existing claim true, there must be **no** `SPEC.md` amendment. If
  the diff edits SPEC §11, it took the class-(ii) fallback and the ratification flag applies — I'd
  surface the class mismatch. Confirm the diff contains no SPEC/CODE_SPEC/DECISIONS edit.

## D. What I do not adjudicate (surface to spec-author — role §7)

- Plan/spec ambiguity I discover while auditing (§7a).
- A required fix that would contradict/require changing a canonical anchor (§7b).
- A blessed halt-class condition (§7c, by category).
- A finding thread at 5/5 round-trips without convergence (§7d).
- An unreviewable change, or a discovered plan-vs-reality divergence the executor implemented
  around or failed to surface (§7e) — including the settled rulings being re-litigated.

Settled rulings I do **not** re-litigate (per dispatch): M-1 priority, M-4 deferred, M-5 build,
M-7 dual-context merge-method, M-8 codify halt 4–9, M-11 back-fill ROADMAP/CHECKLIST, M-13 gate
required on main.
