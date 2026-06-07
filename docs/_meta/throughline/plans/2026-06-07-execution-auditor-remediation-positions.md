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

## B5. Slice B1 positions (PR #144 `claude/b1-governance-doctrine` @ `4ebf3d4` — governance doctrine, M-7+M-8, class-(iv))

**Pre-registered 2026-06-07, before reading the B1 diff content** (derived from plan §5 B1 +
CN-3/CN-4/CN-5). *Anti-anchoring:* I have seen the PR body (which previews the executor's halt
mapping); I will **independently read the canonical Phase-E source** and form my own view of the
blessed 4–9 definitions before adjudicating the executor's against it.

- **B1-P1 — §D dual-context rewrite.** The self-disproving invariant ("every PR is a two-parent
  merge commit; squash not used") is replaced with the dual-context method: **bare auto-continue
  chain-runner → merge-commit**; **role-trio review cycle → squash**, *including the
  execution-trio-reviewed auto-continue build chain* (OQ-2 ruled squash; axis = review-topology, not
  chain-automation). Cross-refs REQUIRED_READING §7.
- **B1-P2 — halt classes 4–9 codified, each with blessed provenance.** Six extensions, each cited to
  a blessed Phase-E source. Per CN-3, **codify only blessed classes; any of 4–9 without a traceable
  blessed definition must be SURFACED, not invented.**
- **B1-P3 — THE CRUX: definitions match the canonical blessed source, not invented.** The executor's
  6/7/8 differ from the plan's starting-map (plan: 6=fingerprint-staleness, 7=murky, 8=flake;
  executor: 6=test regression, 7=doc-PR collision, 8=out-of-audit silent-failure). I will **read the
  canonical source (`plans/2026-05-30-phase-e-full-audit-close.md` ~line 202 + the sources the plan
  §0/§5 cited) myself** and determine ground truth:
  - If the executor's definitions match the canonical blessed source and the plan's starting-map was
    imprecise → acceptable **plan-vs-reality** correction (like A2's C-D2 fix), provided it is
    transparently flagged (it is). I flag it; not a finding **iff** source-verified.
  - If any definition is **not** found in a blessed source (invented/misattributed) → **finding +
    surface** (§7e / class-(iv) governance floor): inventing authority-floor semantics is the exact
    failure CN-3 guards against. A *single* blessed source line "202" defining all six cleanly would
    be unusual given the plan said they were "scattered" — I verify line 202 actually defines each.
- **B1-P4 — no role-file back-port (CN-4/OV-1).** `.claude/roles/*` untouched (they externalize
  halt-classes by category + merge-method as a REQUIRED_READING parameter). Verify the diff edits
  AUTO_CONTINUE only.
- **B1-P5 — B1 owns AUTO_CONTINUE only; REQUIRED_READING untouched.** The §4 pointer + the §"known
  gap … owed work" note in REQUIRED_READING are **B3's** to update (§4/§5 collision). B1 leaving a
  *transient* stale REQUIRED_READING §4 pointer is acceptable **iff** flagged for B3 (it is). Verify
  B1 does not touch REQUIRED_READING and does not prematurely claim the §4 note is updated.
- **B1-P6 — OQ-2 reflected (CN-5).** §D states execution-trio-reviewed auto-continue chain → squash.
  Authentication of the OQ-2 ruling + the class-(iv) ratification is the **overseer's lane** (it
  confirms through the authenticated channel at merge); M-7/M-8 are settled in my dispatch. I verify
  the §D *content* says squash; I do not re-litigate OQ-2.
- **B1-P7 — gate green; genuinely doc-only.** B1 touches no code, so it cannot cause/fix a code
  flake. Verify the diff is AUTO_CONTINUE + handover + wake-log only. The `rag.test.ts` flake (M-14,
  pre-existing, Phase-F-deferred) is **not** B1-caused; honest disposition = pre-existing, not a B1
  blocker (consistent with it being doc-only). Confirm no code file in the diff.
- **B1-P8 — class-(iv) ratification flagged.** PR marks B1 class-(iv); does not auto-merge without
  spec-author ratification of the doctrine + OQ-2 authenticity (overseer's lane). Verify the flag.

## B6. Slice B2 positions (PR #145 `claude/b2-ci-enforcement` @ `830bbf3` — CI-enforcement reconciliation, M-13)

**Pre-registered 2026-06-07, before reading the B2 diff content** (derived from plan §5 B2 + settled
M-13). *Anti-anchoring:* seen the PR body via the list, not the code.

- **B2-P1 — ci.yml "advisory" hedge removed.** The `ci.yml` header/enforcement note no longer says
  "advisory … until the repo-admin action lands"; it states `gate` is the enforcing required check on
  `main`. **Comment-only** — the workflow jobs/steps (behaviour) unchanged. Verify the yaml *logic* is
  untouched.
- **B2-P2 — AUTO_CONTINUE `:24` hedge removed.** The CI gate-layer clause's "advisory" hedge is gone;
  states `gate` is required on `main`. Verify B2 edits only that clause and does **not** disturb B1's
  §D / halt-class content (B2 follows B1 on this shared file; must be based on post-B1 `main` `9501018`).
- **B2-P3 — PLATFORM_STATUS untouched.** `:37` already says "DONE / enforcing"; B2 must **leave it**
  (M-10's domain + collision rule). Verify no PLATFORM_STATUS edit.
- **B2-P4 — three docs read consistently.** ci.yml + AUTO_CONTINUE + PLATFORM_STATUS all say CI is
  the enforcing required check; **no stray "advisory"** survives re the gate (the dependency
  "accepted-advisory register" is unrelated and may remain).
- **B2-P5 — not a ratification class.** ci.yml / AUTO_CONTINUE / PLATFORM_STATUS are not
  SPEC/CODE_SPEC/DECISIONS. Verify no SPEC edit.
- **B2-P6 — gate green; scope contained; no B1 revert.** Touches only ci.yml + AUTO_CONTINUE:24 +
  handover/wake-log; based on `9501018`; B1's content intact.
- **B2-P7 — rag.test.ts recurring-flake surface (discovered finding, my §7 lane too).** The executor
  reports the M-14 `rag.test.ts` flake has **recurred across B1 and B2 (~1-in-4, A2-aggravated)** and
  is surfacing it to the spec-author as a finding + scope decision (dedicated stabilization slice vs
  keep Phase-F-deferred). This **exceeds the plan's scope** (M-14 was "no action") → a legitimate
  spec-author **scope decision** I should **independently assess and corroborate** (my dispatch:
  surface discovered findings that exceed plan scope). B2 itself (doc/yaml-only) can neither cause nor
  fix it → not a B2 blocker. Honest self-check: my A2 sign-off ran rag.test.ts 16/16 once; a 1-in-4
  flake would not reliably show single-run, and M-14 pre-flagged it — but if A2's heavier stack
  aggravated it, that is the cohort-level item now being surfaced.

## B7. Slice B3 positions (PR #147 `claude/b3-required-reading` @ `615d034` — REQUIRED_READING reconciliation, M-9 + M-8 pointer)

**Pre-registered 2026-06-07, before reading the B3 diff content** (derived from plan §5 B3 +
CN-4). Live tree (verified): `archive/ audits/ experiments/ handovers/ mockups/ plans/` (6 subdirs).

- **B3-P1 — §5 tree corrected to match live tree exactly (M-9).** The false "there are **no**
  `experiments/` … only `mockups/`" denial removed; §5 now names all six subdirs. I verify the new
  §5 wording against a fresh `ls docs/_meta/throughline/` — exact match, nothing omitted/extra.
- **B3-P2 — §4 halt-pointer flipped (M-8, B1-deferred part).** The "halt-4…9 not codified / owed
  work / treat only the three as authoritative" note now points at the **codified** set in
  AUTO_CONTINUE (landed by B1); section-name pointer updated to "Halt Classes"; "three codified" →
  "nine codified". No stale "owed work" halt claim remains. Verify the §4 pointer resolves to the
  real post-B1 section name.
- **B3-P3 — §7 (merge-method) untouched/correct.** B1 confirmed §7 already reflects the dual-context
  method; B3 should not disturb it. Verify B3 edits only §4 + §5 (+ any directly-dependent text).
- **B3-P4 — no role-file back-port (CN-4/OV-1).** `.claude/roles/*` untouched.
- **B3-P5 — scope contained.** REQUIRED_READING.md only (+ handover/wake-log); based on post-B1
  `main` `8657adf`; doesn't disturb other sections.
- **B3-P6 — gate green; doc-only.** No code; 610/204 preserved; rag-stabilization holding (no flake).
- **B3-P7 — closes the B1-flagged loop.** B1 explicitly deferred the §4 pointer + section-name to B3;
  verify B3 actually closes it (no residual stale "The Three Halt Classes" reference in §4).

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
