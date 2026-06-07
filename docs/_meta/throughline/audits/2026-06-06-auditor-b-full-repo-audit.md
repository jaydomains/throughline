# Auditor-B — Full-Repo End-to-End Audit

*Independent parallel-discovery audit (Session 2 of 3). Written to Auditor-B's own
branch as the durable, independence-preserved record **before** any read of Auditor-A's
findings. Pushed to Auditor-A's PR as comments once that PR opens.*

**Date:** 2026-06-06
**Auditor:** Auditor-B
**Scope:** entire repo
**HEAD audited:** `5d489ea` (main) / `claude/bold-cannon-S1V32` (= main, no code delta)

---

## Method

- Read REQUIRED_READING, SESSION_START, PLATFORM_STATUS, AUTO_CONTINUE_WORKFLOW,
  SPEC/CODE_SPEC/DECISIONS/ROADMAP/CHECKLIST (consulted), the audit/handover trees.
- Installed deps fresh (`pnpm install`, exit 0) and ran the full three-layer CI gate.
- Verified governance/doc claims against live git history and the live tree, not against
  the docs' own prose (per AUTO_CONTINUE "Pre-Flight State Verification").
- Ran `pnpm audit --prod` for dependency exposure.
- Spot-checked security posture (secrets store, bind address) and the deployment path.

---

## Green-gate result (positive baseline)

The code itself is in good shape at HEAD. Verified locally:

| Layer | Result |
|---|---|
| `pnpm -r typecheck` | PASS (shared, backend, frontend) |
| `pnpm -r test` | PASS — backend **610** tests / 63 files, frontend **204** tests / 32 files |
| `pnpm -r lint` | PASS (clean, no warnings) |
| `pnpm -r build` | PASS (shared → frontend → backend; dist emitted) |

The two PLATFORM_STATUS-flagged flakes (`rag.test.ts`, `directives.test.tsx`) both passed
this run. Source has only 13 TODO/HACK/`as any`-class markers across 7 files (most in the
`code-todo` scanner, which legitimately handles TODO strings). The code layer is not where
the gap to "deployable" lives — the gaps are in deployment wiring, dependency exposure, and
doc/governance accuracy.

---

## Findings

### B-1 — Codified merge-method norm is contradicted by 100% of recent practice
- **Severity:** Medium
- **Location:** `docs/_meta/throughline/AUTO_CONTINUE_WORKFLOW.md §D` (line 44); mirrored in
  `PLATFORM_STATUS.md` Snapshot and `.claude/REQUIRED_READING.md §7`.
- **Evidence:** §D states: *"the runner merges … using a **merge commit** (Throughline's repo
  norm — every prior PR on `main` lands as a two-parent merge commit; see `git log main
  --merges --first-parent`). Squash and rebase strategies are not used."* The doc's own cited
  command disproves it: `git log main --merges` returns **6** merge commits out of **66** total
  on `main`. Every Phase-E build slice — the exact chain §D governs — is single-parent:
  `#115 d633bd1`, `#113 b3c54f0`, `#111 117e25e`, `#110 818fed3` all `parents=1` (squash).
  Every role-file PR (`#121 f895b07` … `#132 5d489ea`) is also `parents=1`. The only
  two-parent commit in the recent set is the Phase-E *plan* PR `#85 b215a05`.
- **Gap:** REQUIRED_READING §7 already records two *different* merge methods (squash for the
  role-trio, merge-commit for the chain) "never reconciled in a single doc" — but the deeper
  problem is that the chain itself squash-merged, so even the chain-specific rule is not what
  ran. Prior Phase-E execution-audit-2 flagged this as **G-1b (squash norm — spec-author)**;
  still unreconciled at HEAD. A reader who trusts §D will mis-model the repo's history shape
  and the `--first-parent` log it tells them to rely on.
- **Confidence:** High (git topology is dispositive).

### B-2 — Halt-class set referenced by all six role files is only ⅓ codified
- **Severity:** Medium
- **Location:** `.claude/REQUIRED_READING.md §4`; `AUTO_CONTINUE_WORKFLOW.md` "The Three Halt
  Classes"; all six `.claude/roles/*.md` (each delegates to "the project's **blessed
  halt-class set**").
- **Evidence:** The six role prompts refer work-stoppage decisions to "the blessed halt-class
  set … in your required reading," by category. REQUIRED_READING §4 codifies **three**
  (spec-drift, circuit-breaker, explicit-pause) and then states the rest are not codified:
  *"additional halt-class extensions ('halt-4…9') were blessed by the spec author during
  Phase E but have not been codified into AUTO_CONTINUE_WORKFLOW.md."* PLATFORM_STATUS itself
  cites an uncodified one in passing ("**halt-8**" for pre-existing flakes). Prior audits
  flagged this: `2026-06-02-phase-e-execution-audit-2-wake-log.md:28` — "G-1 (halt-classes 4–9
  never codified into AUTO_CONTINUE_WORKFLOW.md) — confirmed at HEAD; MEDIUM";
  `2026-05-31-phase-e-execution-audit-1.md:30` calls it a chain-close hardener omission
  "contradicting an explicit plan commitment."
- **Gap:** The role files' authority floor (the *only* sanctioned reasons to stop) points at a
  set that is partly undefined and lives un-canonicalised in Phase-E wake-logs. Any role that
  hits a halt-4..9 condition has no authoritative definition to act on — exactly the
  re-litigation REQUIRED_READING exists to prevent. Open since Phase E.
- **Confidence:** High.

### B-3 — Deferred dependency set includes a Critical RCE + 7 High advisories
- **Severity:** High (for deployability)
- **Location:** `packages/backend/package.json` (fastify 4, @xenova/transformers optional →
  protobufjs), `packages/frontend/package.json` (react-router-dom 6.30.3); deferral recorded
  in PLATFORM_STATUS as "E17a — DEFERRED-MAJOR (Option 1)".
- **Evidence:** `pnpm audit --prod`: **1 critical / 7 high / 6 moderate / 1 low**.
  Critical: `protobufjs <7.5.5` — *arbitrary code execution* (transitive via
  `@xenova/transformers@2.17.2 > onnxruntime-web > onnx-proto`). High: `fastify` content-type
  body-validation bypass (direct dep, `fastify@4.29.1`); `fast-uri` path-traversal +
  host-confusion; four more `protobufjs` (code injection, prototype-pollution gadget, DoS×2).
  Moderate incl. `react-router` open-redirect (direct dep) and fastify proto/host spoofing.
- **Gap:** E17a deferred *all* dep remediation into a "future fastify-v5 migration phase," but
  PLATFORM_STATUS describes the deferred set only as version bumps ("vite 5→6, esbuild,
  protobufjs 6→7, fastify 4→5, fast-uri") and does **not** flag that a Critical RCE sits inside
  it. The protobufjs path is only reachable when the optional embeddings model is installed,
  which narrows blast radius — but the severity is mis-represented in the status doc, and a
  "production-ready / deployable" claim while a Critical advisory is knowingly deferred is the
  kind of gap this audit exists to surface. The fastify advisory's patched range is `>=5.7.2/5.8.3`,
  so the planned "fastify 4→5" target does not by itself clear it unless pinned to a fixed 5.x.
- **Confidence:** High (advisory data is current as of audit run; reachability caveat noted).

### B-4 — Documented "production" auto-start does not run the built artifact
- **Severity:** Medium (for deployability)
- **Location:** `packages/backend/package.json` (`start` script) vs `docs/install/auto-start.md`.
- **Evidence:** `start` is `tsx --conditions=development src/index.ts`. `auto-start.md` line
  12–13 says: *"`start` runs the compiled `dist/index.js` after `pnpm build`."* That is false —
  `start` runs the **TypeScript source** through `tsx`, with `--conditions=development`, which
  also resolves `@throughline/shared` to its `src/index.ts` (the package's `development` export
  condition) rather than its built `dist`. The Linux systemd unit in the same doc sets
  `Environment=NODE_ENV=production` but its `ExecStart` invokes that same `start` script — so the
  documented production deployment runs uncompiled TS in *development* module-resolution mode.
  `backend build` (`tsc && copy-migrations`) does emit `dist/index.js` (the package's declared
  `main`), but no runtime path uses it.
- **Gap:** Either the doc is wrong about `start`, or `start` should be `node dist/index.js` for
  the long-lived/auto-start path (with `dev` keeping the `tsx watch` variant). As written, the
  build step is dead weight for the run path, and "production" deployments ship the dev resolver.
- **Confidence:** High.

### B-5 — PLATFORM_STATUS is stale by an entire cohort despite "refresh every sign-off"
- **Severity:** Medium (doc accuracy / onboarding)
- **Location:** `docs/_meta/throughline/PLATFORM_STATUS.md` (Snapshot dated **2026-06-01**).
- **Evidence:** PLATFORM_STATUS's stated contract: *"the living doc; read it on startup … To
  understand the present, read this file,"* refreshed "as the final write of every slice's
  session." Since its 2026-06-01 snapshot, **15+ PRs merged to main** — the entire role-file
  governance suite and its supporting work: `#117` counterpart-change-detector skill, `#118`,
  `#119`/`#121`/`#122`/`#125`–`#130` (the six role prompts + §8 back-ports), `#124` revert,
  `#128` persistence amendment, `#131` artifact consolidation, `#132` REQUIRED_READING. None of
  this appears in PLATFORM_STATUS. Its "Recent Slice History" table still ends at Phase-E `#103`
  and its "_this PR_" row still points at E17.
- **Gap:** The document designated "where the project is right now / read first" omits the
  largest recent body of work (the whole audit/governance role system a new session is told to
  operate under). A session following SESSION_START's reading order would not learn the role
  suite exists from the doc that's supposed to tell it. This is the cross-cohort drift the
  two-cadence hardener is meant to catch, un-caught.
- **Confidence:** High.

### B-6 — README status block is stale (test counts + "production-ready" date)
- **Severity:** Low
- **Location:** `README.md` "Status".
- **Evidence:** README: *"500 backend + 182 frontend tests pass"* and *"bootstrap-and-clone-and-go
  arc is feature-complete and production-ready end-to-end (as of 2026-05-28)."* Actual at HEAD:
  **610 backend + 204 frontend**. The 2026-05-28 date predates the entire Phase-E audit-fix
  close (which the README's own prose does not reflect).
- **Gap:** Honest dating mitigates this, but the headline numbers are wrong and the "production-
  ready end-to-end" claim is now read against B-3/B-4. Low because README is explicitly a
  point-in-time public-facing doc, not the living status file.
- **Confidence:** High.

### B-7 — CI-enforcement state is described three ways across three docs
- **Severity:** Low
- **Location:** `.github/workflows/ci.yml` (header comment), `README.md` Status, `PLATFORM_STATUS.md`
  Queued Work.
- **Evidence:** Live state: `main` is **protected** (GitHub `list_branches`: `"protected":true`).
  PLATFORM_STATUS Queued Work: *"Branch-protection required-check — **DONE**. The `gate` workflow
  … is now a required status check on `main`."* But `ci.yml`'s own header still says: *"it gates
  merges only if the spec author sets it as a required status check … Until that repo-admin action
  lands the workflow is advisory,"* and AUTO_CONTINUE §"Three-Layer Green Gate" carries the same
  "advisory until … required status check" hedge.
- **Gap:** If branch protection now requires `gate` (PLATFORM_STATUS says so, and `main` is
  protected), the workflow-file and AUTO_CONTINUE "still advisory" language is stale and should be
  reconciled. I could not confirm from here *which specific* checks branch-protection requires
  (only that `main` is protected), so this is flagged as an unreconciled tri-doc contradiction
  rather than a definite error in any one of them.
- **Confidence:** Medium (protection is confirmed; the specific required-check list is not visible
  to me).

### B-8 — REQUIRED_READING (#132) denies the existence of dirs added by the immediately-prior commit (#131)
- **Severity:** Medium
- **Location:** `.claude/REQUIRED_READING.md §5` (lines 124–125).
- **Evidence:** §5: *"There are **no** `experiments/`, `reconciliations/`, or
  `docs/_meta/<area>/handovers/` directories — do not assume them. The only other subdirectory is
  `mockups/`."* Live tree, git-tracked: `docs/_meta/throughline/experiments/dormancy-push-test/`
  (PROTOCOL/README/RESULTS.md) and `docs/_meta/throughline/archive/2026-06-06-branch-consolidation-index.md`
  both exist. `git log --diff-filter=A` shows both were added in **`aea28e2` (#131,
  "Consolidate durable session artifacts")** — the commit *immediately before*
  REQUIRED_READING's own **`5d489ea` (#132)**.
- **Gap:** The newest doc in the repo — the addressing layer that every role file's §1 is
  **BLOCKING** on, and which is the single source of truth for path conventions — asserts a
  tree shape that its own parent commit had already falsified. It also omits `archive/`
  entirely. This is a direct violation of AUTO_CONTINUE's "Pre-Flight State Verification" rule
  (*verify "X dir is missing/absent" claims against the live tree, never from a prior context*),
  committed into the very governance file that future sessions will trust for paths. A role
  session told "there is no `experiments/`" will mis-handle the dormancy-push-test artifacts.
- **Confidence:** High (git-dispositive).

---

## Areas checked that are NOT findings (scope-negative, for the Overseer)

- **Secrets at rest** (`secrets/store.ts`): plaintext JSON at mode `0600`, atomic write, never
  backed up / never returned to browser — matches **T-D4** as the deliberate local-single-user
  decision. Not a finding (documented + correct to spec).
- **Bind address** (`config.ts`): defaults to `127.0.0.1` per **T-D31**; no `0.0.0.0` path.
  Matches spec. Not a finding.
- **Spec-author gaps** (CODE_SPEC Q8/Q9 voice-lang + cost-threshold defaults; four
  `RATIONALE NEEDED` markers T-D10/15/17/23): all *tracked* in SESSION_START + PLATFORM_STATUS,
  not silently resolved. Working-as-intended (open-but-surfaced). Not a finding.

---

## Halt-condition note

No halt-class condition was hit during this audit. B-2 (halt-class codification) and B-1/B-7
(doc contradictions) are **surfaced findings for the Overseer**, not audit-halts.
