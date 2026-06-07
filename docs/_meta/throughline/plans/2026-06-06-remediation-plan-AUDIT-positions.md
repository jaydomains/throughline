# Remediation-Plan Audit — Pre-Registered Positions

**Role:** plan-auditor (content correctness)
**Counterpart:** planner (author of the remediation plan)
**Overseer:** plan-overseer (workflow-governance correctness + merge executor)
**Audit branch:** `claude/stoic-keller-jSY5K`
**Pre-registered (timestamped):** 2026-06-06T20:36Z
**Base:** `main` @ `4980dfd` (PR #134 — end-to-end audit summary)
**Status:** final — approved by plan-auditor
**Cleared at (content-SHA):** planner `db5befd` (PR #135) — content-bound; re-verify if the plan changes.
  *(Refreshed from `f097b39` after the OV-6 fold: a role-label fix "plan-overseer"→"execution-overseer" in §2/B1, re-verified as correct and non-disturbing to A-1/A-3; A-2 untouched.)*

---

## Anti-anchoring declaration

These positions are derived **only** from the requirements — the 13 actionable
findings (M-1…M-13) in the PR #133 RECONCILED FINDINGS comment, the
2026-06-06 end-to-end audit summary, the seven settled spec-author rulings, and the
project's spec/anchor/discipline records (REQUIRED_READING, SPEC, CODE_SPEC,
DECISIONS, AUTHORING_DISCIPLINE, AUTO_CONTINUE_WORKFLOW) — and are committed **before
reading any planner draft**. They are what I expect a *correct* remediation plan to
contain, decide, and avoid. A draft that satisfies a position becomes a Confirm; one
that fails it becomes a finding.

---

## Scope baseline

- **Actionable set = M-1…M-13** (13 findings). The plan must cover all 13 with **no
  silent drops**.
- **M-14 is Info / positive baseline (three-layer green gate verified 3×)** — *not*
  actionable. A slice spent "remediating" M-14 would be scope creep; its correct
  treatment is exclusion (or a one-line "no action — positive baseline" note).
- **No scope creep beyond M-1…M-13.** The Slice-2 audit-plan "deferred-tail register"
  items (SF4-05/06, SF6-12, F3-01, etc.) are *not* in the actionable set; pulling them
  in is scope creep unless they are genuinely the same work as a listed finding.
- **All seven open questions are now ruled** (Mermaid, markdown export, post-22 tracking,
  merge-method, halt-class, CI required-check, dep-deferral severity). The plan must
  **not** re-open any as an open question, and must **not** re-litigate a settled ruling.

---

## Settled rulings — must be honored EXACTLY (no re-litigation, no scope drift)

### P-M1 · M-1 (High, deps) — accelerate dependency remediation as priority
- **Expect:** dependency remediation is the **lead / priority group (Group A)**,
  sequenced first.
- The remediation must actually **clear the advisories**, not merely bump versions:
  - **fastify** pinned **`>=5.7.2`** (the 4→5 bump alone does *not* clear the
    content-type-bypass advisory) — a real breaking-change migration (v4→v5 plugin/hook
    API). Likely warrants **its own slice** given the breaking-change surface.
  - the **`@xenova/transformers → onnxruntime-web → onnx-proto → protobufjs`** chain
    remediated so **protobufjs `>=7.5.5`** (clears the Critical RCE). Note CODE_SPEC
    **C-D2** describes transformers as an *optional first-launch download*, not a hard
    direct dep (audit gap #3) — if remediation changes that posture, it touches an
    anchor (ratification class (i)).
  - **fast-uri** path-traversal/host-confusion remediated (may ride the fastify bump
    since fastify pulls fast-uri).
- **Verification expected:** `pnpm audit --prod` shows **0 critical / 0 high** (or a
  consciously-documented, spec-author-accepted residual) **and** the three-layer green
  gate (typecheck/test/lint/build) stays green after the fastify migration.
- **Must NOT:** characterize the fix as "mere version bumps" (the exact mischaracter-
  ization M-1 flags); leave PLATFORM_STATUS still calling the deferred set version bumps.

### P-M4 · M-4 (Medium, Mermaid) — deferred: add markers, remove orphaned Settings row
- **Expect:** add `*(deferred)*` markers to SPEC §7.21 / §13 / §9 AI-feature table for
  Mermaid generation (T-D14), **and** remove the orphaned `'mermaid'` Settings
  model-override row.
- **Verification expected:** grep confirms no orphaned `'mermaid'` Settings row remains;
  SPEC carries the deferral markers.
- **Must NOT:** build Mermaid generation (ruled **deferred** — building it is scope drift).
- **Ratification:** SPEC edit = scope-class (ii) spec amendment.

### P-M5 · M-5 (Medium) — build per-session markdown export
- **Expect:** a real **feature build** of the per-session markdown export ("the shipped
  v1 export surface," SPEC §7.20) — copy/route + frontend wiring, with tests.
- **Verification expected:** a session-markdown export path exists and is exercised by
  tests; the §7.20 deferral of the *larger* export feature now rests on a *built* fallback.
- **Must NOT:** re-justify the §7.20 deferral instead of building (ruled **build it**).

### P-M7 · M-7 (Medium, merge-method) — dual-context, reconcile both docs
- **Expect:** AUTO_CONTINUE §D rewritten so it no longer asserts the self-disproving
  "every PR is a two-parent merge commit; squash not used" invariant; both AUTO_CONTINUE
  §D **and** REQUIRED_READING §7 state the **dual-context** rule consistently:
  **squash for the role-trio review loops**, **merge-commit for the auto-continue
  build-slice chain**.
- **Verification expected:** neither doc contradicts observed practice (6 merges/68
  commits; build slices squashed); the two docs agree.
- **Ratification:** governance-doctrine change = durable precedent, scope-class (iv).

### P-M8 · M-8 (Medium) — codify halt classes 4–9
- **Expect:** halt classes **4 through 9** written into the canonical
  AUTO_CONTINUE_WORKFLOW.md halt-class section (so the set is fully defined, not ⅓);
  REQUIRED_READING §4's "known gap / owed work" note updated to reflect codification;
  the set the six role files delegate to is now complete.
- **Verification expected:** AUTO_CONTINUE lists the full halt-class set; the "owed work"
  caveat in REQUIRED_READING §4 is resolved.
- **Source of truth for 4–9:** the Phase-E wake-logs where they were blessed-but-
  uncodified. **Must NOT** invent new halt semantics — codify the *blessed* ones.
- **Ratification:** durable precedent / authority-floor change, scope-class (iv).

### P-M11 · M-11 (Medium) — back-fill ROADMAP & CHECKLIST post-Phase-22
- **Expect:** ROADMAP and CHECKLIST back-filled with the post-Phase-22 work: Phase E,
  the audit-fix A–D cohort, Phase F / fastify-v5, **and a home for this remediation
  cohort itself**. (Ruling resolved the open question toward back-fill, not "deliberate
  convention.")
- **Verification expected:** ROADMAP/CHECKLIST carry sequencing/build-state for those
  cohorts; if a convention note belongs in SESSION_START, it is added.
- **Sequencing:** the ROADMAP entry for the remediation cohort should reflect the slice
  groups this very plan defines.

### P-M13 · M-13 (Low) — gate IS required on main; reconcile three docs
- **Expect:** ruling is **the `gate` check IS a required check on `main`**; reconcile the
  three contradicting docs to that — `ci.yml` header ("advisory until set as required
  check") and AUTO_CONTINUE's hedge updated to "required"; PLATFORM_STATUS ("required —
  DONE") already correct.
- **Verification expected:** all three docs consistently state the gate is required.
- **Must NOT:** soften to "advisory" (contradicts the ruling).

---

## Unruled findings — planner scopes; I audit scoping for reasonableness

A scope decision the planner makes here is class (iii); if a scoping choice needs
spec-author input I **surface** it rather than inventing a standard.

### P-M2 · M-2 (Medium) — deployment-wiring defect
- **Expect coverage of:** (a) the run-path defect — `start` runs
  `tsx --conditions=development src/index.ts` while `auto-start.md` claims it runs built
  `dist/index.js`; fix is point `start` at `node dist/index.js` (keep `dev` on
  `tsx watch`) **or** correct the docs; (b) all **three** OS units (launchd / Task
  Scheduler / systemd), incl. the systemd `NODE_ENV=production` mismatch; (c) the DoD §11
  **single-command setup** gap — *either* provide it *or* amend the DoD to match the
  manual reality (a scope decision).
- **Verification expected:** the documented prod deploy runs the built artifact;
  auto-start.md matches reality.

### P-M3 · M-3 (Low) — IntelligenceView raw-UUID entry
- **Expect:** covered — either a picker for retro/stakeholder/chat session/item IDs, or a
  conscious deferral with rationale (SPEC §7.18 is silent on selection mechanism, so a
  defer-with-marker is defensible). A bounded fix.

### P-M6 · M-6 (Low) — bootstrap merge_fields/archive SPEC drift
- **Expect:** SPEC §7.27 reconciled to code reality — add deferral markers for
  `merge_fields` / stale `archive` (working alternatives exist), or build them. Most
  likely a doc reconciliation. SPEC edit = scope-class (ii).

### P-M9 · M-9 (Medium) — REQUIRED_READING §5 denies existing dirs
- **Expect:** REQUIRED_READING §5 corrected so it matches the live tree — it currently
  denies `experiments/` and `archive/` (both added in #131, the commit immediately before
  REQUIRED_READING's #132). Fix = acknowledge the dirs (or, if they should not exist,
  remove them — a scope decision). This is inside the **BLOCKING** addressing layer.
- **Verification expected:** §5's directory claims match `ls` of the tree.

### P-M10 · M-10 (Medium) — PLATFORM_STATUS stale by a cohort
- **Expect:** PLATFORM_STATUS refreshed — the ~15 PRs (#117–#132, the role-file
  governance suite) reflected; "Recent Slice History" advanced past #103; "_this PR_"
  no longer pointing at E17.
- **Sequencing (load-bearing):** the PLATFORM_STATUS refresh must come **AFTER Group A
  (dep remediation)** — ideally near-last — so the snapshot reflects **post-remediation**
  state (the living doc is refreshed at sign-off). A PLATFORM_STATUS slice sequenced
  *before* the code/doc changes it must describe would be stale on arrival.

### P-M12 · M-12 (Low) — README stale counts + production-ready overclaim
- **Expect:** README test counts corrected (500/182 → **610/204**) and the
  "feature-complete and production-ready end-to-end" claim reconciled with actual
  deployability.
- **Sequencing (load-bearing):** the README slice **depends on M-1** — the
  "production-ready" line reads against M-1/M-2, so the README can only honestly state
  status *after* the dep remediation lands. M-12 must be sequenced after Group A.

---

## Cross-cutting plan-quality positions

- **P-COV — Coverage.** All 13 actionable findings (M-1…M-13) mapped to slices, no silent
  drops; M-14 correctly excluded.
- **P-SEQ — Sequencing.** M-1/Group A first; behavior/code changes (M-1, M-2, M-3, M-5)
  before the currency docs describing them; **M-10 after Group A**; **M-12 depends on M-1**;
  M-11 ROADMAP reflects the remediation cohort. No doc-reconciliation slice sequenced
  before the code change it must describe.
- **P-SIZE — Slice sizing.** No slice too big to verify in one pass (esp. the fastify v4→v5
  migration should not be lumped with the transformers chain + fast-uri + unrelated work);
  none so trivial it should have been batched. (Task framing: ~15–25 slices expected.)
- **P-DEP — Dependencies.** Inter-slice dependencies stated **explicitly**, not implied.
- **P-VERIF — Verification per slice.** Every slice names its verification: code slices →
  three-layer green gate + the finding-specific check (`pnpm audit --prod` for M-1;
  run-path/`dist` check for M-2; tests for M-5/M-3); doc slices → the concrete
  reconciliation check (grep / doc-consistency / tree-match).
- **P-EXEC — Executable via the existing chain.** Each slice = one PR runnable by the
  executor/execution-auditor/execution-overseer trio under the auto-continue build-slice
  chain (merge-commit method). The plan itself lives at
  `docs/_meta/throughline/plans/2026-06-06-<scope>.md`.
- **P-RATIF — Ratification flags.** Slices that amend SPEC/CODE_SPEC/DECISIONS (M-4, M-5,
  M-6) or change a canonical anchor (possible C-D2 for M-1) or set durable governance
  precedent (M-7, M-8) are ratification scope-classes (i)/(ii)/(iv) — they do **not**
  auto-merge on the three-sign-off gate. The plan should flag which slices carry
  ratification-class changes so the chain handles them correctly.
- **P-CONFLATE — No conflation.** A single slice must not bundle unrelated findings
  (e.g. a dep bump + a README refresh + a halt-class codification in one slice).

---

*Pre-registered before reading any planner draft. Finding-set baseline: 0 findings.*

---

## Round-2 resolution log (final-marker)

Re-verified against planner `f097b39` ("round-1 folds — all 8 reviewer findings"):

- **A-1 (merge-method §6/§8) — RESOLVED.** §6 rewritten to decouple execution-rhythm from
  merge-method; §8 rewritten so the planner does not bake the method (defers to the
  execution-overseer's lane); the categorization surfaced as **OQ-2** (class-iv, via overseer
  OV-4), with B1's merge gated on the authenticated-channel ruling. The §6/§8 contradiction is
  gone; the ruling-application question is correctly surfaced, not asserted.
- **A-2 (M-2 DoD §11) — RESOLVED.** D1 commits to a definite primary outcome — *provide* a
  single-command setup, keeping `SPEC.md:601`/`:51` true with no spec edit — and flags the
  conditional SPEC §11 amendment fallback as **class-(ii)** in §4.
- **A-3 (M-8 halt-class sourcing) — RESOLVED.** B1 confirms the **4–9** blessed set, widens
  sourcing across the Phase-E artifact set with per-class provenance anchors (verified real:
  halt-4 `execution-audit-1.md:61`, halt-5 `full-audit-close.md:194,350`, halt-8
  `execution-audit-1.md:51`, halt-9 `full-audit-close.md:342,403`), and makes the don't-invent
  guard explicit (surface halt-7 if untraceable).

Plus Confirm **A-4c** (M-4 locus §13→§9 verified accurate) from the prior wake.

**Content verdict:** all 13 actionable findings covered; M-14 correctly no-action; every
settled ruling honored; the two genuinely-unruled decisions (OQ-1/M-6, OQ-2/merge-method)
correctly held + routed to the authenticated channel; sequencing, slice-sizing, dependencies,
and per-slice verification sound; no scope creep, no silent drops. Cleared for content
correctness at `f097b39`.

**Final-marker:** `Status: final — approved by plan-auditor` (above), content-bound to the plan
at `f097b39`. This is one of the three independent sign-offs convergence rests on; I do not flip
draft→ready and do not execute the merge (plan-overseer's actions, after the override window).
