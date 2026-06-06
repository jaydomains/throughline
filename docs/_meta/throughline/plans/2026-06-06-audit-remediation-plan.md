# Throughline — Audit-Remediation Plan

**Plan scope:** turn the 14 reconciled findings (M-1…M-14) of the 2026-06-06 end-to-end
audit into a sequenced execution roadmap, executable by the execution chain
(`executor.md` / `execution-auditor.md` / `execution-overseer.md`).

**Author:** planner · **Reviewers:** plan-auditor (content), plan-overseer (governance) ·
**Escalation:** spec-author.

**Status:** draft — under three-party review (planner authoring)

**Audit source:** `docs/_meta/throughline/audits/2026-06-06-end-to-end-summary.md`;
per-finding evidence on PR #133 (`RECONCILED FINDINGS` comment).

**Wake-log:** `docs/_meta/throughline/plans/2026-06-06-audit-remediation-plan-wake-log.md`.

---

## 0. Ground-truth verification (done before authoring)

Per planner §4.2 (verify-before-write), every load-bearing precondition below was checked
against the **live tree on `main`** at authoring time, not inherited from the audit prose:

- **Repo state:** `main` has advanced past the audit base `5d489ea` → current `4980dfd`
  ("audit: throughline end-to-end summary (#134)"). The audit summary is merged; the dep
  tree and docs are otherwise unchanged from the audited state. This plan's branch is cut
  off current `main`.
- **M-1:** `packages/backend/package.json` carries `fastify: ^4.27.0` (direct) and
  `@xenova/transformers: ^2.17.2` (direct). `fast-uri`, `onnxruntime-web`, `protobufjs`
  are transitive (not in any first-party `package.json`). Consumer of the embeddings
  stack: `packages/backend/src/intelligence/embeddings.ts` (lazy import ~line 111).
- **M-2:** `start` script = `tsx --conditions=development src/index.ts`;
  `docs/install/auto-start.md:12-13` claims `start` "runs the compiled `dist/index.js`
  after `pnpm build`" (false today); the Linux systemd unit (`auto-start.md:81,84`) sets
  `NODE_ENV=production` while `ExecStart` invokes `start`; macOS launchd and Windows Task
  Scheduler entries both invoke `start` too. `build` = `tsc && copy-migrations` (emits a
  `dist/` no run-path uses).
- **M-3:** `packages/frontend/src/views/IntelligenceView.tsx:282` (`placeholder="session id"`)
  and `:391` (`placeholder="item id"`) — raw UUID text inputs; chat surface similar.
- **M-4:** SPEC §7.21 prose (`SPEC.md:415-417`), the **§9 "AI role"** AI-feature table row
  (`SPEC.md:548`), T-D14 (`SPEC.md:654`), and the §15 API-account table (`SPEC.md:710`) all
  reference mermaid; the orphaned Settings model-override row is `SettingsView.tsx:47`
  (`'mermaid'`). No implementation, no `*(deferred)*` marker. **Locus correction:** the
  settled ruling and audit summary say "§13's AI table," but the AI-feature table is in **§9**
  (verified: line 548 sits under the `## 9. AI role` header at line 532; §13 is "Open
  questions" and contains no AI table). Ruling intent preserved — only the section reference is
  corrected so the executor edits the right place.
- **M-5:** SPEC §7.20 (`SPEC.md:406-413`) calls the per-session markdown fast-path "the
  shipped v1 export surface" and rests the larger-export deferral on it; **0** session
  markdown copy/route implementations exist.
- **M-6:** SPEC §7.27 (`SPEC.md:479`) lists `merge_fields` and `archive`; code defers both
  with explicit comments (`BootstrapReviewModal.tsx:23,25`).
- **M-9 (scope-corrected):** the directories are
  `docs/_meta/throughline/experiments/dormancy-push-test/` and
  `docs/_meta/throughline/archive/`, created by #131 (`aea28e2`), the commit immediately
  before REQUIRED_READING's #132 (`5d489ea`). They are **not** root-level (my first check
  used the wrong scope). REQUIRED_READING §5 (`REQUIRED_READING.md:124-126`) states "there
  are **no** `experiments/` … the only other subdirectory is `mockups/`" — false. Finding
  stands.
- **M-10:** `PLATFORM_STATUS.md` Snapshot dated **2026-06-01**; "Recent Slice History" ends
  at #103; "_this PR_" still points at E17; the entire role-file governance suite (#117–#132)
  is absent.
- **M-11:** `ROADMAP.md` / `CHECKLIST.md` stop at Phase 22; no grep hit for Phase E / Phase F /
  fastify / audit-fix in either.
- **M-13:** three-way contradiction live — `ci.yml:9-13` ("advisory … until that repo-admin
  action lands"), `PLATFORM_STATUS.md:37` ("Branch-protection required-check — **DONE**"),
  `AUTO_CONTINUE_WORKFLOW.md:24` ("advisory one" hedge). Ruling: the gate **is** required
  on `main`; reconcile all three to that.

---

## 1. Settled spec-author rulings (do not re-litigate)

> **Ruling provenance (OV-3 — for the execution-overseer's ratification gates).** The seven
> rulings below were issued by the spec author through the **authenticated dispatch briefing
> that initiated this planning session** — that is the authenticated channel for this plan, not
> PR #133. PR #133 carries only the *Overseer's severity* rulings (M-7/M-8/M-4 grades); the
> build / defer / codify / back-fill decisions are **not** in #133 and must not be sourced from
> it. Per role §8.3 / AUTO_CONTINUE "authenticated ratification": a ruling **relayed** under the
> shared role-session identity (including this plan's restatement of it) is **pending until
> confirmed/current** through the authenticated channel. Therefore, at each ratification-class
> merge gate (§4), the **execution-overseer re-confirms the governing ruling through the
> authenticated channel** rather than relying on this plan's relayed restatement. The
> planner-vs-spec-author partition (7 settled / the rest planner-scoped) is itself part of that
> authenticated briefing.

| Finding | Ruling (settled) |
|---|---|
| **M-1** (High) | Accelerate as next priority. Fastify-v5 migration, `@xenova/transformers→onnxruntime-web→protobufjs` chain review, `fast-uri` pin. Must land before any honest "production-ready" claim. |
| **M-4** (Med) | Defer to later versions. Add `*(deferred)*` markers to SPEC §7.21 and the AI-feature table; remove the orphaned Settings model-override row. *(Ruling says "§13's AI table"; the AI-feature table is actually in §9 — line 548. Ruling intent preserved, locus corrected — see §0 and B4.)* |
| **M-5** (Med) | Build the fast-path. Makes the §7.20 deferral justification honest. |
| **M-7** (Med) | Dual-context canonical: **squash** for role-trio review cycles, **merge-commit** for the auto-continue build-slice chain. Rewrite AUTO_CONTINUE §D to document both. REQUIRED_READING §7 already reflects this. |
| **M-8** (Med) | Codify halt-4 … halt-9 into AUTO_CONTINUE.md; pull definitions from the Phase E audit wake-log. |
| **M-11** (Med) | Drift, not convention. Back-fill ROADMAP.md and CHECKLIST.md to include Phase E, the audit-fix cohort, the role-file authoring suite. Keep current going forward. |
| **M-13** (Low) | Gate **is** required on `main`. Update ci.yml to remove "advisory" language, keep PLATFORM_STATUS "DONE", remove AUTO_CONTINUE's hedge — all three say the same thing. |

Findings the planner scopes (no ruling): **M-2, M-3, M-6, M-9, M-10, M-12, M-14**.
- **M-12** (Low): ruling-by-dependency — "update once M-1 resolves the underlying
  truthfulness gap." Stale test counts (500/182 → 610/204) + drop the "production-ready
  end-to-end" overclaim until the project is actually deployable. **Gated on Group A.**
- **M-14** (Info): **no action.** Preserved as audit record (this plan does not modify it).

---

## 2. Surfaced decisions — awaiting spec-author ruling

> **OQ-1 (M-6 — bootstrap sub-actions): build, defer-with-marker, or remove from SPEC §7.27?**
> The rulings settled M-1/M-4/M-5/M-7/M-8/M-11/M-13 but did **not** settle M-6's three-way
> choice. SPEC §7.27 lists `merge_fields` (conflict action) and `archive` (stale action);
> code carves both out (`BootstrapReviewModal.tsx:23,25`); working alternatives exist
> (`keep_mine`/`take_theirs` for conflicts; `keep`/`delete` for stale rows). Choosing among
> build / defer-with-marker / remove is a **scope decision (ratification class iii)** and
> any SPEC edit is a **spec amendment (class ii)** — genuinely the spec-author's call, not
> a planner default (planner §7(a)).
>
> **Recommended default (pending ruling):** *defer-with-marker* — add a `*(deferred)*`
> qualifier to the two §7.27 actions, mirroring the M-4 treatment. Lowest cost, restores
> honesty, preserves the working alternatives, and leaves the door open for a later build.
> The plan carries M-6 as **slice D3** with that default; the slice is **held** (not
> executed) until the ruling lands. The default is recorded, **not baked** — the executor
> does not proceed on D3 until OQ-1 is answered through the authenticated channel.

> **OQ-2 (M-7 / B1 — merge method for an execution-trio-reviewed auto-continue build-slice
> chain): squash or merge-commit? *(surfaced by the plan-overseer — OV-4; class-(iv)
> durable precedent.)*** The dual-context M-7 ruling (squash for role-trio review cycles;
> merge-commit for the auto-continue build-slice chain) does **not** classify the case that is
> **both at once** — the execution trio reviewing an auto-continue chain of build slices, which
> is how this remediation (and any build cohort) runs. The records cannot resolve it:
> `REQUIRED_READING §7` lists the **execution-trio** under *both* buckets, and the audit's M-7
> finding observed every Phase-E build slice was **squash-merged**. The narrow question: for
> build slices reviewed by the execution trio under auto-continue, **squash** (matching empirical
> Phase-E practice + the §7 execution-trio listing) or **merge-commit** (matching the §7
> build-chain clause) — and is the distinguishing axis *review-topology* (trio ⇒ squash) or
> *chain-automation* (auto-continue ⇒ merge-commit)? **Non-halting** (role §8.3): the plan
> converges on everything else; the plan's §6/§8 are made internally consistent by **not**
> pre-judging the method (deferred to the execution-overseer's lane), and **B1 is authored
> against this answer** — the plan-overseer will not merge B1 (class-iv) without the ruling
> through the **authenticated channel**. The spec-author may settle it now or at B1's
> execution-time ratification. Surfaced by the plan-overseer at PR #135 (comment 4640328474);
> recorded here so it survives compaction.

---

## 3. Cross-finding dependency & collision map

The execution chain must respect these. Two distinct constraint kinds:

**A. Semantic dependencies (must land in order):**
- **M-10 (PLATFORM_STATUS) and M-12 (README) depend on Group A.** Both make
  accuracy/honesty claims that are only true once the dependency exposure resolves. M-10 is
  the **final slice** (full-state refresh capturing all of A/B/C/D); M-12 is gated to land
  **after** Group A.
- **M-8's REQUIRED_READING §4 pointer-update depends on M-8's AUTO_CONTINUE codification
  landing first** (the §4 "known gap … owed work" note can only flip to "now codified"
  after the halt classes are written into AUTO_CONTINUE).

**B. File-collision serializations (rolling-shared-doc collision rule,
AUTO_CONTINUE_WORKFLOW "Concurrent Doc-PR Collision"):** no two simultaneously-open slices
may edit the same shared doc. Files touched by more than one finding:

| Shared file | Findings | Resolution |
|---|---|---|
| `AUTO_CONTINUE_WORKFLOW.md` | M-7, M-8, M-13 | M-7+M-8 combined in **B1**; M-13's hedge-removal in **B2**, sequenced **after B1**. |
| `REQUIRED_READING.md` | M-8 (§4), M-9 (§5) | combined in **B3** (REQUIRED_READING reconciliation), sequenced **after B1** (the §4 note depends on B1). |
| `SPEC.md` | M-4 (§7.21/§13), M-6 (§7.27) | **B4** (M-4) and **D3** (M-6) both edit SPEC.md → **serialize**; do not run concurrently. |
| `packages/backend/package.json` | M-1 (deps), M-2 (scripts) | Group A (deps) before **D1** (scripts) → serialize on this file. |
| `PLATFORM_STATUS.md` | every slice (post-work touch) + M-10 (full refresh) | normal per-slice sign-off touches are fine; **M-10 is the last slice** — never open it early as a standalone doc-PR while the chain runs. |

**C. Test-flake cross-link:** `rag.test.ts` (a PLATFORM_STATUS-flagged flake, M-14) is the
test most exercised by the **A2** embeddings swap. Treat any A2 failure as a real finding —
**root-cause / stabilize, never re-run-until-green** — under the **codified circuit-breaker
halt class** and the general verify-before-green discipline (AUTO_CONTINUE "CI flake is a
finding"). *(Note for sequencing: A2 runs before B1 codifies the extended halt classes, so this
guidance rests on the **already-codified** floor, not on an extended class by number. The
blessed flake-handling halt class is among those **B1** codifies; do not invoke it as live
authority in A2, which precedes its codification — REQUIRED_READING §4 directs treating the
three codified classes as authoritative until 4–9 are written in.)*

---

## 4. Ratification-class flags (for the execution-overseer)

Slices touching ratification scope-classes (REQUIRED_READING §7; role files §8.3) do **not**
auto-merge on the three-sign-off gate — they need explicit spec-author ratification at merge
(the spec author has already ruled on most, so ratification should collapse to ~zero, but the
class still applies):

| Slice | Class | Why |
|---|---|---|
| **A2** | (i) anchor change | Embeddings-stack swap touches **C-D2** (its "optional first-launch download" description vs the hard-direct-dep reality; already narrowed by T-D60). |
| **B1** | (iv) durable precedent | Merge-method doctrine + halt-class set are the governance floor all six role files delegate to. |
| **B4** | (ii) spec amendment | SPEC.md §7.21 + §9 AI-feature-table edits. |
| **D1** | (ii) — **conditional** | **Only if** the DoD §11 fallback (amend SPEC §11 to match manual reality) is taken. The primary D1 path — *provide* a single-command setup — needs **no** spec edit (it makes the existing SPEC §11/§3 claim true). See D1. |
| **D3** | (ii)+(iii) | SPEC §7.27 amendment + the M-6 scope decision (OQ-1). |

All other slices auto-merge on the standard gate. ROADMAP/CHECKLIST/PLATFORM_STATUS/README/
ci.yml/REQUIRED_READING are **not** in the class-(ii) spec-record set (SPEC/CODE_SPEC/DECISIONS).

> **Back-port conclusion — no role-file edit owed (OV-1).** The audit's M-7/M-8 "touches"
> lists name the role files (M-7 → `plan-overseer.md`; M-8 → *all six* `.claude/roles/*`).
> Verified against the live tree: the six role files **externalize** both governed parameters —
> halt classes are referred to **"by category"** with an explicit prohibition on reproducing
> the labels (`executor.md:374`; `execution-auditor.md` likewise), and merge-method is read as a
> **"project parameter (REQUIRED_READING.md)"** (`executor.md:69`; `plan-overseer.md`), while the
> merge-executor files' "squash-merge" wording (`plan-overseer.md:18`) is the **role-trio
> context** and is **correct** under the dual-context ruling, not stale. **Conclusion: B1 + B3
> land entirely in the project layer (AUTO_CONTINUE + REQUIRED_READING); no role-file back-port
> is owed** — the externalized design propagates the fix automatically. Recorded here (and in B1)
> so the executor neither wrongly edits the portable role files nor misses a genuinely-needed
> edit. (role §8.3 back-port discipline + the baked-vs-externalized boundary.)

---

## 5. The slices

LOC bands: **XS** <50 · **S** 50–150 · **M** 150–400 · **L** 400–800 · **XL** >800.

### Group A — Dependency remediation (priority; blocks deploy)

#### A1 — Fastify 4→5 migration + fast-uri pin
- **Scope:** bump `fastify ^4.27.0 → >=5.7.2` (the fixed floor for the content-type-bypass
  High); resolve the v5 breaking-change surface (route/hook signatures, error handling,
  schema/ajv compiler, content-type parser, plugin-encapsulation changes per the official
  v5 migration guide). Pin/override `fast-uri` to its fixed floor (carried by fastify v5's
  dependency set, or via a `pnpm.overrides` entry if the resolved tree still pulls a
  vulnerable range).
- **Findings:** M-1 (fastify + fast-uri portion).
- **Dependencies:** none (first slice). Must precede D1 (shared `package.json`).
- **LOC:** **M** (depends on how much of the v5-changed API surface the backend uses;
  audit shows fastify is the server foundation — expect route/plugin touch-ups, not a
  rewrite).
- **Deliverables:** updated `package.json` + lockfile; code changes for v5 compatibility;
  any new `pnpm.overrides`; tests adjusted if v5 changes a tested contract.
- **Verification:** full three-layer gate green (`typecheck`/`test`/`lint`/`build`);
  `pnpm audit --prod` shows the `fastify <5.7.2` and `fast-uri` advisories **cleared**;
  backend boots and serves on `127.0.0.1:47823`. Record the before/after `pnpm audit --prod`
  counts in the handover.

#### A2 — Embeddings-stack replacement (protobufjs Critical)
- **Scope:** the Critical `protobufjs <7.5.5` RCE is **transitively pinned** —
  `@xenova/transformers@2.17.2 → onnxruntime-web@1.14.0 → onnx-proto@4.0.4` declares
  `protobufjs ^6.8.8`, so protobufjs **cannot** be lifted to `>=7.5.5` by override alone
  without breaking onnx-proto@4 (audit B-S1-2). Real remediation = **replace the embeddings
  stack**. Primary candidate: `@xenova/transformers@2` → `@huggingface/transformers@3` (the
  renamed successor, which carries a newer onnxruntime that resolves protobufjs `>=7`).
  Executor confirms the resolved tree actually clears the advisory before committing.
  Update `embeddings.ts` (the lazy import ~line 111 + any API-shape differences in the new
  package). Amend **C-D2** to reflect both the new stack and the already-true hard-direct-dep
  reality (currently mis-described as "optional first-launch download"; already narrowed by
  T-D60 to capability-absent honest-distinct mode).
- **Findings:** M-1 (protobufjs/embeddings portion); touches C-D2 anchor.
- **Dependencies:** after A1 (shared `package.json`/lockfile). Cross-link: exercises
  `rag.test.ts` (flake — §3.C).
- **LOC:** **M** (dependency + lockfile + embeddings.ts API adaptation + the C-D2 anchor
  body; the model-download path and `Xenova/all-MiniLM-L6-v2` reference may change).
- **Deliverables:** updated `package.json` + lockfile; rewritten `embeddings.ts` import/API;
  C-D2 amendment in `CODE_SPEC.md` (ratification class i); RAG/embeddings tests passing.
- **Verification:** `pnpm audit --prod` shows the **Critical protobufjs cleared** (and the
  4× High protobufjs entries); full gate green; RAG semantic-search path exercised (real
  embedder resolves, or honest capability-absent mode per T-D60); `rag.test.ts` stabilized
  if it surfaces (root-cause, not re-run). Record before/after audit counts.

#### A3 — Residual advisory sweep + honest dependency posture
- **Scope:** after A1+A2, re-run `pnpm audit --prod`; address the remaining Moderate
  advisories from the E17a-deferred set (vite 5→6, esbuild) where a clean bump exists, and
  **consciously document** any residual that is genuinely accepted (with reachability
  rationale: `127.0.0.1` bind, single-user). Correct the PLATFORM_STATUS / status-doc
  language that mischaracterised the deferred set as "mere version bumps" (the corrected
  posture text feeds M-10's final refresh).
- **Findings:** M-1 (closeout); feeds M-10.
- **Dependencies:** after A1, A2.
- **LOC:** **S–M** (mostly dependency bumps + posture documentation; could be larger if
  vite 6 has a breaking surface in the frontend build).
- **Deliverables:** final `package.json` + lockfile; a recorded dependency-posture statement
  (audit-count before/after, accepted-residual list with rationale) in the handover, ready
  for M-10 to fold into PLATFORM_STATUS.
- **Verification:** `pnpm audit --prod` clean **or** an explicitly-recorded accepted-residual
  set; full gate green.

> **Group A completion = the deploy-blocking exposure is resolved.** Only after A1–A3 is any
> "production-ready" claim honest (precondition for M-12).

### Group B — Documentation reconciliation (mostly mechanical)

#### B1 — Governance-doctrine codification (merge-method + halt-classes)
- **Scope:** rewrite `AUTO_CONTINUE_WORKFLOW.md §D` to document the **dual-context** merge
  method honestly (squash for role-trio review cycles; merge-commit for the auto-continue
  build-slice chain) per the M-7 ruling — replacing the self-disproving "every PR is a
  two-parent merge; squash not used" invariant. **The dual-context §D rewrite must be authored
  against the OQ-2 ruling (§2)** — the execution-trio-reviewed-auto-continue-chain case the M-7
  ruling left unclassified; B1 cannot crisply codify §D until that class-(iv) point is ruled, and
  the plan-overseer will not merge B1 (class-iv) without it through the authenticated channel.
  Codify the blessed extended halt classes into
  the "Three Halt Classes" section (renaming/expanding it). **The blessed set is `4–9` (six
  classes)** — confirmed against the Phase-E record (`plans/2026-05-30-phase-e-full-audit-close.md:5`
  "halt-class 4–9 blessed"; the reconciled M-8's "4/5/8/9" was an **undercount**, corrected here).
- **Source breadth (A-3 — load-bearing):** the definitions are **scattered across the Phase-E
  artifact set**, *not* a single wake-log. Pull from the full set, with these verified anchors as
  the starting map: **halt-4** = estimate breach (`audits/2026-05-31-phase-e-execution-audit-1.md:50,61`),
  **halt-5** = unplanned anchor (`plans/2026-05-30-phase-e-full-audit-close.md:194,350`),
  **halt-6** = fingerprint-staleness, **halt-8** = flake (`audits/2026-05-31-phase-e-execution-audit-1.md:51`),
  **halt-9** = blessed decision-gate (`plans/2026-05-30-phase-e-full-audit-close.md:342,403`);
  **halt-7** is the murkiest. Widen the executor's reading to
  `plans/2026-05-30-phase-e-full-audit-close.md`, `plans/phase-e-audit-approval.md`, the
  `plans/2026-05-31-phase-e-*` set, and the Phase-E audit/augmentation wake-logs.
- **Don't-invent guard (A-3, REQUIRED_READING §4):** codify only the **blessed** classes —
  invent **no** new authority-floor semantics. **If any of 4–9 lacks a traceable blessed
  definition (halt-7 the likely candidate), the executor surfaces it (spec-drift / ambiguity
  halt) rather than authoring one.** Confirm REQUIRED_READING §7 already reflects the
  dual-context method (ruling says it does — **verify, do not re-edit** unless verification fails).
- **No role-file back-port owed (OV-1):** B1 lands entirely in the project layer — the six role
  files externalize halt-classes (by category) and merge-method (as a REQUIRED_READING
  parameter), verified no stale enumeration (see §4 back-port note). Do **not** edit
  `.claude/roles/*`.
- **Findings:** M-7, M-8 (codification portion).
- **Dependencies:** none; but **owns AUTO_CONTINUE_WORKFLOW.md** — B2 must follow it.
- **LOC:** **M** (six halt-class definitions + §D rewrite).
- **Deliverables:** rewritten §D; expanded halt-class section (3 → 9, with per-class provenance
  cites to the Phase-E source artifacts); REQUIRED_READING §4 "known gap" note updated to point
  at the now-codified set **(this REQUIRED_READING edit moves to B3 to avoid the §4/§5 file
  collision — see B3)**.
- **Verification:** gate green (doc-only, but CI must stay green); **every codified halt class
  traces to a blessed Phase-E source** (and any that cannot is surfaced, not invented); no
  remaining "owed work" language for halt classes.
- **Ratification:** class (iv) — durable governance precedent (spec-author already ruled).

#### B2 — CI-enforcement reconciliation
- **Scope:** the gate **is** required on `main`. Remove the "advisory" language from
  `ci.yml` (the header note `ci.yml:9-13`) and the hedge from `AUTO_CONTINUE_WORKFLOW.md:24`;
  confirm `PLATFORM_STATUS.md:37` ("DONE") already says the same and leave it. All three
  docs end up consistent: CI is the enforcing required-check.
- **Findings:** M-13.
- **Dependencies:** **after B1** (both edit `AUTO_CONTINUE_WORKFLOW.md`).
- **LOC:** **XS**.
- **Deliverables:** `ci.yml` header corrected; AUTO_CONTINUE hedge removed; PLATFORM_STATUS
  verified consistent.
- **Verification:** gate green; the three statements read identically; no "advisory" survives.

#### B3 — REQUIRED_READING reconciliation (tree + halt-pointer)
- **Scope:** correct REQUIRED_READING §5 (`:124-126`) to reflect the **actual** tree —
  `docs/_meta/throughline/` contains `experiments/` and `archive/` (plus `mockups/`,
  `plans/`, `audits/`, `handovers/`) — removing the false "there are no experiments/…"
  denial (M-9). Update §4's "known gap … halt-4…9 not codified … owed work" note to point
  at the now-codified set landed in B1 (M-8 pointer-update).
- **Findings:** M-9, M-8 (REQUIRED_READING §4 pointer portion).
- **No role-file back-port owed (OV-1):** the §4-pointer + §5-tree edits to REQUIRED_READING are
  the **only** edits B3 makes; the six `.claude/roles/*` files externalize halt-classes/merge-method
  and need **no** edit (see §4 back-port note).
- **Dependencies:** **after B1** (the §4 pointer depends on B1's codification; and §4/§5
  share the file so this must be one slice, not two).
- **LOC:** **XS–S**.
- **Deliverables:** §5 tree statement matched to live tree (re-verified at execution time);
  §4 note flipped from "owed" to "codified in AUTO_CONTINUE (B1)".
- **Verification:** gate green; `ls docs/_meta/throughline/` matches §5 exactly; §4 carries
  no stale "owed work" claim.

#### B4 — Mermaid deferral markers
- **Scope:** add `*(deferred)*` markers to SPEC §7.21 prose (`:415-417`) and the **§9
  "AI role" AI-feature table row** (`:548`) per the M-4 ruling — **note the locus correction
  in §0: the ruling/audit say "§13" but the AI-feature table is in §9 (line 548); §13 is "Open
  questions" with no AI table.** Remove the orphaned Settings model-override row
  (`SettingsView.tsx:47` `'mermaid'`). Decide (executor's call within the ruling) whether the
  T-D14 line (`:654`) and the §15 API-account-table mermaid mention (`:710`) also need a marker
  for internal consistency — recommend a light `*(deferred)*` cross-note on T-D14 so the
  decision index stays honest; leave the §15 API-account table (it lists capability
  prerequisites, not a shipped-claim).
- **Findings:** M-4.
- **Dependencies:** **serialize with D3** (both edit `SPEC.md`).
- **LOC:** **S** (SPEC markers + one frontend row removal + any SettingsView test update).
- **Deliverables:** SPEC §7.21/§13 markers; SettingsView mermaid row removed; frontend
  tests/typecheck adjusted.
- **Verification:** gate green; no implementation-implying mermaid claim remains unmarked;
  `grep mermaid SettingsView.tsx` returns nothing.
- **Ratification:** class (ii) — spec amendment (spec-author already ruled).

#### B5 — ROADMAP & CHECKLIST back-fill
- **Scope:** back-fill `ROADMAP.md` and `CHECKLIST.md` to include the cohorts that have no
  sequencing/build-state home: **Phase E** (full audit-fix close, E1–E26), the **audit-fix
  A–D** cohort, the **role-file authoring suite** (#117–#132), and the forward **Phase F
  quality-tail / fastify-v5 dependency-migration** (this remediation cohort itself). Ruling:
  drift, not convention — establish the home and keep it current going forward.
- **Findings:** M-11.
- **Dependencies:** none (own files). Best authored late enough to reference this plan's own
  slices as the fastify-v5/Phase-F entries, but not blocking.
- **LOC:** **M** (two docs, several cohorts of history to reconstruct from handovers +
  execution-log + `git log`).
- **Deliverables:** ROADMAP phases/sequencing extended past Phase 22; CHECKLIST build-state
  sections for Phase E + audit-fix + role-file suite + this remediation cohort.
- **Verification:** gate green; every back-filled entry points at an artefact (PR/handover/
  anchor); no cohort between Phase 22 and today is missing.

#### B6 — README accuracy (gated on Group A)
- **Scope:** correct the stale test counts (500/182 → **610/204**) and remove/soften the
  "feature-complete and production-ready end-to-end" overclaim. Per the M-12 dependency
  ruling, the "production-ready" wording becomes honest only once Group A (and the M-2 deploy
  fix, D1) lands — so phrase the status to match the **then-true** state (e.g. "feature-
  complete; dependency-hardened; single-user local deploy").
- **Findings:** M-12.
- **Dependencies:** **after Group A** (and D1 for the deploy claim).
- **LOC:** **XS**.
- **Deliverables:** README status block with current counts + an honest readiness claim.
- **Verification:** counts match the live gate output; no claim outruns the actual deployable
  state.

### Group C — Build work

#### C1 — Per-session markdown export fast-path
- **Scope:** build the surface SPEC §7.20 (`:413`) already calls "the shipped v1 export
  surface": **copy a session as markdown to clipboard**, formatted for paste-back into
  Claude Code. Implementation shape (executor's call within the spec): assemble the session's
  items/notes into a markdown document and copy via `navigator.clipboard.writeText` from a
  per-session "Copy as markdown" affordance. Add a thin backend serializer/endpoint only if
  the session payload the frontend already holds is insufficient. Building this makes the
  §7.20 deferral justification honest **without** a spec edit (the claim becomes true).
- **Findings:** M-5.
- **Dependencies:** none (independent of A/B/D). Feeds M-10's "now built" note.
- **LOC:** **M** (markdown serializer + copy affordance + tests; **S** if pure-frontend
  assembly off already-loaded data).
- **Deliverables:** session→markdown serializer; "Copy as markdown" UI on the session view;
  unit tests for the serializer + a frontend interaction test; (optional) backend route.
- **Verification:** gate green; copying a session yields well-formed, paste-ready markdown;
  the §7.20 "shipped v1 export surface" claim is now true (grep finds the implementation).

### Group D — Bounded fixes

#### D1 — Deployment wiring (run the built artifact)
- **Scope:** point `start` at the **built artifact** — `start: node dist/index.js` — keeping
  `dev: tsx watch …` for development (M-2). The three OS auto-start units all invoke `start`,
  so they inherit the fix automatically; verify each (launchd, systemd, Task Scheduler) now
  runs `node dist/index.js` under production module resolution with `NODE_ENV=production`.
  Reconcile `auto-start.md` so its `:12-13` claim ("start runs the compiled `dist/index.js`
  after `pnpm build`") becomes **true**, and make the `pnpm build`-first requirement explicit
  in the install steps (since `node dist/index.js` requires a prior build — the systemd unit
  does not build).
- **DoD §11 single-command setup — resolved to a definite outcome (A-2):** the **primary path
  is _provide_ a real single-command setup** (e.g. a `scripts/setup.sh` or a root `package.json`
  script that runs `pnpm install && pnpm -r build` and prints/optionally-installs the OS unit),
  which makes the existing SPEC claim — `SPEC.md:601` "installs and runs via documented
  single-command setup" + `SPEC.md:51` "one command, scriptable on login" — **true with no spec
  edit** (mirrors C1's "make the claim true" approach). This is the committed outcome; do **not**
  ship "document the manual multi-step reality" alone, which would leave `SPEC.md:601` false and
  recreate the claimed-but-unbuilt drift this cohort exists to close. **Conditional fallback:**
  *only if* a genuine single-command setup proves infeasible at execution, fall back to a
  **SPEC §11 amendment** to match the manual reality — that path is a **class-(ii) spec
  amendment** (ratification flag added to D1 in §4 for the fallback case only).
- **Findings:** M-2 (incl. the DoD §11 single-command-setup sub-item).
- **Dependencies:** **after Group A** (shared `package.json`).
- **LOC:** **M** (scripts + the single-command setup script + doc reconciliation).
- **Deliverables:** corrected `start` script; verified OS-unit docs; `auto-start.md` made
  truthful with an explicit build-first step; **a single-command setup script** (primary path)
  *or* a flagged SPEC §11 amendment (fallback).
- **Verification:** `pnpm build` then `node dist/index.js` boots and serves on
  `127.0.0.1:47823` under `NODE_ENV=production` (prod module resolution, not the `development`
  condition); the single-command setup runs clean from a fresh clone; gate green; the
  auto-start doc no longer contradicts the script; SPEC §11's single-command claim is true
  (primary path) or amended to match reality (fallback).

#### D2 — IntelligenceView UUID picker
- **Scope:** replace the raw-UUID text inputs on the retro / stakeholder / chat surfaces
  (`IntelligenceView.tsx:282` session-id, `:391` item-id, + the chat input) with a picker
  (typeahead/dropdown over the project's sessions/items, surfacing human-readable labels and
  resolving to the UUID under the hood). SPEC §7.18 is silent on the selection mechanism, so
  this is a UX fix, not a spec change.
- **Findings:** M-3.
- **Dependencies:** none (frontend-only; independent).
- **LOC:** **M** (a reusable session/item picker component + three call-site swaps + tests).
- **Deliverables:** picker component; three call-sites converted; frontend tests covering
  selection → UUID resolution.
- **Verification:** gate green; no raw-UUID entry remains on these surfaces; selecting a
  session/item drives the same downstream call the manual UUID did.

#### D3 — Bootstrap sub-actions (HELD — pending OQ-1)
- **Scope:** execute the M-6 decision once OQ-1 (§2) is ruled. **Recommended default
  (defer-with-marker):** add a `*(deferred)*` qualifier to the `merge_fields` and `archive`
  actions in SPEC §7.27 (`:479`), matching the code reality (`BootstrapReviewModal.tsx:23,25`)
  and the M-4 treatment. If the ruling is *remove*: delete the two actions from §7.27. If
  *build*: a separate, larger feature build (per-field merge UI + an archive surface) — **out
  of this remediation cohort's scope**; it would need its own ROADMAP home (flag back to
  planning).
- **Findings:** M-6.
- **Dependencies:** **HELD until OQ-1 ruling**; **serialize with B4** (both edit SPEC.md).
- **LOC:** **XS** (defer-marker or removal); **L+** and out-of-cohort if "build".
- **Deliverables:** per the ruling — SPEC §7.27 markers/removal (defer/remove path) or a
  flagged-out new build (build path).
- **Verification:** gate green; SPEC §7.27 and the code agree (no claimed-but-deferred action
  without a marker).
- **Ratification:** class (ii) spec amendment + class (iii) scope decision.

#### (no slice) M-14 — positive baseline
- **No action.** The three-layer-green-gate baseline (610/204) is preserved as an audit
  record in the audit summary; this plan does not modify it. Listed here so the coverage
  set-diff (§7) shows it was consciously carried, not dropped.

---

## 6. Recommended execution sequence

The execution chain works these slices **linearly — one executor, three-party review per slice**
(executor / execution-auditor / execution-overseer); the order below respects every §3 dependency
and collision. Where two executors could run in parallel, the only safe parallel front is across
**non-colliding files** (noted). *(This says nothing about merge **method** — that is the
execution-overseer's governance lane; see §8.)*

```
1.  A1  fastify 4→5 + fast-uri          (priority; foundation)
2.  A2  embeddings stack (protobufjs)   (after A1; Critical cleared; C-D2 ratify)
3.  A3  residual sweep + posture        (after A2; Group A complete = deploy-unblocked)
4.  D1  deployment wiring               (after A3; shared package.json)
5.  B1  governance doctrine (M-7+M-8)   (owns AUTO_CONTINUE; class-iv ratify)
6.  B2  CI-enforcement (M-13)           (after B1; shared AUTO_CONTINUE)
7.  B3  REQUIRED_READING (M-9+M-8 ptr)  (after B1; §4 pointer dep)
8.  B4  mermaid markers (M-4)           (class-ii ratify; serialize w/ D3 on SPEC.md)
9.  D3  bootstrap sub-actions (M-6)     (HELD until OQ-1; after/before B4, not concurrent)
10. C1  markdown export build (M-5)
11. D2  UUID picker (M-3)
12. B5  ROADMAP/CHECKLIST back-fill (M-11)
13. B6  README accuracy (M-12)          (after Group A)
14. M-10 PLATFORM_STATUS full refresh   (LAST — captures all of A/B/C/D)
```

**Parallelism (only if multiple executors and only across non-colliding files):**
- C1 (markdown export), D2 (UUID picker) and B5 (ROADMAP/CHECKLIST) touch disjoint files
  from each other and from Group A/B-doc work → safe to run concurrently with the doc track.
- The Group-A chain is strictly serial (shared `package.json`/lockfile).
- D3 is gated on the OQ-1 ruling regardless of position; if the ruling is slow, the rest of
  the chain proceeds and D3 lands whenever the ruling arrives (it blocks nothing else except
  its SPEC.md serialization with B4).

**M-10 sequencing:** keep it last and **never** open it as an early standalone PLATFORM_STATUS
doc-PR — per the collision rule it would be churned redundant by every slice's sign-off touch.
The dedicated M-10 slice is the final, comprehensive refresh (Snapshot date, Recent Slice
History, the #117–#132 cohort, the dep-posture text from A3, the now-built M-5/M-4/M-2 state).

---

## 7. Coverage set-diff (baseline)

Every reconciled finding is accounted for — none silently dropped (planner §6 gate):

| Finding | Sev | Slice(s) | Disposition |
|---|---|---|---|
| M-1 | High | A1, A2, A3 | Remediate (fastify + embeddings/protobufjs + sweep) |
| M-2 | Med | D1 | Fix start script + OS units + docs + DoD §11 note |
| M-3 | Low | D2 | UUID picker |
| M-4 | Med | B4 | Deferral markers + remove Settings row |
| M-5 | Med | C1 | Build the fast-path |
| M-6 | Low | D3 (HELD) | OQ-1 ruling → defer/remove/build |
| M-7 | Med | B1 | AUTO_CONTINUE §D dual-context rewrite |
| M-8 | Med | B1 + B3 | Codify halt-4…9 (B1) + REQUIRED_READING §4 pointer (B3) |
| M-9 | Med | B3 | REQUIRED_READING §5 tree correction |
| M-10 | Med | (final) | PLATFORM_STATUS full refresh (after all) |
| M-11 | Med | B5 | ROADMAP/CHECKLIST back-fill |
| M-12 | Low | B6 | README counts + overclaim (after Group A) |
| M-13 | Low | B2 | CI-enforcement reconciliation (3 docs) |
| M-14 | Info | (none) | No action — preserved as audit record |

**Baseline:** `0 dropped / 0 added (baseline — no reviewer findings yet)`.

---

## 8. Notes for the execution chain

- **Merge method — the execution-overseer's governance lane; the planner does NOT bake it
  (A-1).** There is a genuine, contestable categorization question the plan must **not** resolve
  by fiat: under the dual-context doctrine (M-7 / REQUIRED_READING §7), **role-trio review loops
  → squash** and the **auto-continue build-slice chain → merge-commit**. REQUIRED_READING §7's
  literal enumeration lists the **execution-trio in the squash bucket** — yet these are
  product/code **build** slices (fastify, embeddings, markdown-export, UUID picker) that
  otherwise resemble the Phase-E build slices in the **merge-commit** bucket. The two readings
  point opposite ways, and merge-method is the **execution-overseer's** lane. So: the
  **execution-overseer sets the method** at execution time, applying the dual-context doctrine
  **as it stands after B1 lands** (B1 is itself rewriting §D — a further reason the planner does
  not pre-bake it); if the doctrine leaves it genuinely ambiguous, the execution-overseer
  **surfaces to the spec-author**. The plan's only method-**agnostic** structural requirement is
  the per-slice gate (three sign-offs + green CI + mergeable). **The plan-overseer has surfaced
  the underlying boundary as a class-(iv) durable-precedent question to the spec-author (OV-4;
  recorded as OQ-2, §2)** — does an execution-trio-reviewed auto-continue build-slice chain
  merge by squash or merge-commit, and is the axis review-topology or chain-automation? The
  determination is routed to **B1's codification + spec-author ratification**; the planner does
  not pre-judge it.
- **Gate-green-throughout:** every slice independently clears the three-layer gate
  (Gitar + CI + mergeable) at its own merge SHA. Group A slices additionally re-run
  `pnpm audit --prod` and record before/after counts in their handovers.
- **Verify-before-write at execution time:** the loci cited in §0 were true at planning;
  the executor re-verifies each against the live tree before editing (the tree may have
  moved). The M-9 §5 wording in particular must be matched to a fresh `ls` of
  `docs/_meta/throughline/`.
- **Surfaced decision OQ-1 (M-6)** is the only spec-author input this plan needs to begin;
  everything else proceeds on settled rulings + planner-scoped decisions. D3 is the only
  slice that blocks on it.
```
