# Throughline — Authoring Discipline

*Status taxonomy and doc gates. The four states a deliverable passes through, and the gates that bookend every build session.*

*Read alongside `SESSION_START.md` (discipline floor), `AUTO_CONTINUE_WORKFLOW.md` (the rhythm that runs between the two gates), `PLATFORM_STATUS.md` (where current taxonomy state surfaces).*

---

## Why this file exists

"Feature complete" and "production ready" are not synonyms. Treating them as one is how stale anchor counts, missing ROADMAP sections, and orphan vocabulary accumulate across sessions.

The Phase 22 close (2026-05-26) surfaced two cross-session drifts that had silently grown across five sessions: `CODE_SPEC.md §1` narrative said "canonical at 48" while the live total had reached 57, and `ROADMAP.md` was missing prose sections for Phases 17 and 18 even though both were complete on disk. Both drifts existed because no doc gate ran cohort-wide checks — every individual slice was "feature complete" but none of them was "production ready" by any explicit standard. Those same drifts are why Phase 18 sits at `feature-complete` rather than `production-ready` today; the five-session doc-authoring stream that just closed (PRs #32–#40) moved Phases 19–22 from `spec-anchored` to `pre-work-doc-complete` but consciously did not promote earlier phases further, because that promotion requires the cohort-level hardener pass this file codifies.

This file names four status tiers and two doc gates so that distinction stops being implicit.

---

## Status Taxonomy

A deliverable progresses through four explicit states:

1. **`spec-anchored`** — SPEC subsection exists; T-D and/or C-D anchor(s) minted; `SPEC.md §14` index row in place. The decision is recorded but no further doc scaffolding exists.

2. **`pre-work-doc-complete`** — spec-anchored, *plus*:
   - `ROADMAP.md` phase section authored (four-field convention: Scope, Dependencies, Done when, Sizing)
   - `CHECKLIST.md` scaffold authored (header + 1–2-sentence preamble; slice rows deliberately empty until build opens)
   - Working-note forward-pointers either planted (new questions) or resolved (back-references to the new anchor)
   - Any single-use prompt artefact in place
   - Handover written for the doc session itself

   This is the gate to *open* a build session. A build session that opens against a deliverable below this tier is opening against incomplete prep.

3. **`feature-complete`** — pre-work-doc-complete, *plus*:
   - Code lands on `main`
   - Tests pass (full suite; not just the new ones)
   - `CHECKLIST.md` rows ticked with concrete evidence (file paths, test names, migration files)
   - Handover written using `HANDOVER_TEMPLATE.md`
   - Per-slice light hardener pass complete (see Post-Work Gate below)

   The build session has shipped. The feature works. But cohort-wide drift may still exist.

4. **`production-ready`** — feature-complete, *plus* cohort-level heavy hardener pass complete. Drift across the cohort is cleaned: anchor counts current, narrative references refreshed, ROADMAP backfilled, vocabulary consistent across docs, SESSION_START gap list refreshed, forward-pointers all resolved or explicitly carried forward. The cohort is shippable to a public audience.

Per-deliverable current tier is tracked in `PLATFORM_STATUS.md`, not enumerated here — this file owns the rules; `PLATFORM_STATUS.md` owns the live state.

**Anchor scaffolding for small phases.** Small-sized phases (Sizing: `small` in `ROADMAP.md`) may use a T-D anchor's Implications block as the implementation spec in lieu of a companion C-D anchor. Phase 22 / T-D57 is the canonical precedent: T-D57's Implications named the four implementation surfaces directly, no C-D anchor was minted, and both slices ran first-Gitar-review-clean. Larger phases that exceed the small-sizing threshold should mint a companion C-D anchor so the implementation-rationale layer stays separable from the functional-decision layer (Phases 19, 20, 21 — each medium or larger — followed this convention via C-D19 / C-D20 / C-D21).

---

## Pre-Work Doc Prep Gate

Run **before** a build session opens. Output is `pre-work-doc-complete` status.

The five-session doc-authoring stream demonstrated this gate; this is the codification.

- [ ] T-D and/or C-D anchors authored in `DECISIONS.md` / `CODE_SPEC.md`
- [ ] `SPEC.md` subsection authored (functional prose; methodology-agnostic voice)
- [ ] `SPEC.md §14` anchor index row appended
- [ ] `ROADMAP.md` phase section authored (Scope / Dependencies / Done when / Sizing)
- [ ] `CHECKLIST.md` scaffold authored (header + preamble; slice rows empty)
- [ ] Working-note forward-pointers planted (new questions) or resolved (back-reference to new anchor)
- [ ] Single-use prompt artefact in place if one is used (to be `git rm`'d at session close)
- [ ] Handover written for the doc session itself, named per the standard `<YYYY-MM-DD>-<slice-id>-<short-summary>.md` convention

A build session that opens without all eight is opening against incomplete prep and should be deferred or scoped down to "close the prep gaps first".

---

## Post-Work Doc Hardening Gate (two cadences)

The hardener pass runs at two cadences. The CODE_SPEC "canonical at 48" drift across Sessions 2–5 is the canonical motivating example of why both cadences are necessary: per-slice doesn't catch cross-cohort drift, and cohort-level alone leaves in-slice drift sitting on `main` between cohorts.

### Per-slice light hardener

Runs in every slice's post-work close. Output is `feature-complete` status for the slice. Scope: in-slice and this-slice-only drift.

- [ ] `CHECKLIST.md` rows ticked with concrete evidence (file paths, test names, migration files)
- [ ] Handover written using `HANDOVER_TEMPLATE.md`; Drift Flags section honest (`_none_` if genuinely none; explicit table rows if drift was observed)
- [ ] Working-note trailing sentences flipped from forward-pointer (`Resolved by → T-Dn (Phase m).`) to back-reference (`Resolved by T-Dn (introduced YYYY-MM-DD).`)
- [ ] Single-use prompt artefacts deleted via `git rm` in the same commit (git history retains them)
- [ ] Handover manifest accuracy verified — every file in the manifest exists at the named path with the described change
- [ ] `PLATFORM_STATUS.md` current-state sections refreshed (Snapshot, Current Phase, Recent Slice History, Locked Decisions This Cycle) — written before the handover commit, per `AUTO_CONTINUE_WORKFLOW.md` supporting rules

### Cohort-level heavy hardener

Runs after a coherent cohort closes (phase complete, multi-session stream complete, multi-slice workstream complete). Output is `production-ready` status for everything in the cohort. Scope: cross-slice, cross-cohort, cross-doc drift.

- [ ] Stale anchor counts in narrative prose refreshed (`CODE_SPEC.md §1` "canonical at N" — verify against live `DECISIONS.md` total)
- [ ] `ROADMAP.md` phase backfill — every phase complete on disk and in `CHECKLIST.md` has a corresponding ROADMAP prose section (Phases 17 and 18 are the current outstanding examples)
- [ ] Vocabulary drift audit across the cohort's docs — terms introduced mid-cohort applied consistently; terms quietly dropped removed; aliases collapsed
- [ ] Forward-pointer resolution audit — every `WN-*` working note's trailing sentence either resolves to a real anchor or is explicitly carried forward as a known unresolved question
- [ ] Handover-chain completeness — every merged PR in the cohort has a handover, or the absence is explicitly explained (Session 1 / PR #32 is the current known absence to either backfill or accept)
- [ ] `SESSION_START.md` "Known spec-author gaps" list refreshed against current `DECISIONS.md` / `CODE_SPEC.md` state
- [ ] `SPEC.md §14` anchor index audited for stale or duplicate rows
- [ ] **Build-prerequisite stress test** — read the cohort's docs as if opening a fresh build session cold against the next phase, and surface anything that would block it. Specifically: are all cited anchors resolvable in `DECISIONS.md` / `CODE_SPEC.md`? Are all `WN-*` forward-pointers either closed (back-reference form) or explicitly carried forward as known unresolved? Does the next phase's `ROADMAP.md` entry name a concrete Done-when, not a placeholder? Are the named Dependencies actually satisfied by prior-phase state? Are there spec-author gaps that would block build but aren't surfaced in `PLATFORM_STATUS.md`'s Open Spec-Author Gaps section?
- [ ] `PLATFORM_STATUS.md` cohort transition prepared — Snapshot updated to mark the cohort `production-ready`; Recent Slice History rolls per Update Protocol. The Locked Decisions This Cycle table does **not** roll in this pass: per the Update Protocol "Cycle reset" rule, the table retains the just-promoted cohort entries and only rolls when the next cohort's first T-D / C-D anchor lands.

A cohort that closes without the heavy hardener is `feature-complete` but not `production-ready`. Carrying multiple `feature-complete`-but-not-`production-ready` cohorts is permitted but accrues debt; the unpaid debt is exactly what produced the "canonical at 48" drift.

---

## Drift Surfacing Discipline

When drift is observed mid-slice that the current slice's scope does not cover:

- Surface it in the slice's handover under **Drift Flags** with the explicit "observed but not fixed" marking, naming the file, what drifted, and where it will be resolved (cohort hardener pass, next slice, separate small PR).
- Do **not** silently absorb the drift via an unscoped patch in the current slice. That trades visible drift for invisible drift.
- Do **not** defer the surfacing because "the next cohort hardener will catch it" — the surfacing is what arms the next cohort hardener to find it.

The Phase 22 handover's two "observed but not fixed" Drift Flags (CODE_SPEC anchor count; ROADMAP 17/18 backfill) are the canonical examples of this discipline working as intended.

---

## Green-Gate Coverage — Known Gaps (this cohort)

The green gate — `pnpm -r typecheck && pnpm -r test && pnpm -r lint && pnpm -r build`, per `AUTO_CONTINUE_WORKFLOW.md` — proves less than its four-command breadth implies. The 2026-05 audit cycle surfaced two gaps between what the gate runs and what it actually verifies. Both are being closed within the current audit-fix cohort (Phases A–D); this section names them honestly while they are open and is revised as the closing work lands.

1. **Backend `test/**` was excluded from typecheck.** `packages/backend/tsconfig.json` carried `exclude: ["test/**/*", …]`, so ~12.8k LOC of backend test code never passed `tsc`. The gate's `typecheck` step stayed green while a large fraction of the backend's typed surface went unchecked — and regression tests added by later hardening would have inherited that blind spot. **Closed by Phase A** (this cohort) via a dedicated `packages/backend/tsconfig.test.json` (src + test, `noEmit`) wired into the backend `typecheck` script.

2. **Wire-contract response types are partially frontend-local, and the fetch boundary casts unsafely.** Response shapes for several endpoints are declared in the frontend rather than sourced from `@throughline/shared`, and `jsonFetch<T>(…) as T` performs an unvalidated cast at the network boundary — the compiler trusts the annotation, but nothing checks the runtime payload against it. The gate's `typecheck` proves the frontend is internally consistent with its *assumptions* about the wire, not that those assumptions match what the backend sends. **To be closed by Phase D** (this cohort): response types move to `@throughline/shared` and a wire-contract test asserts the agreement.

Until Phase D lands, read a green gate as: "the code the gate sees is type-consistent, tested, lint-clean, and builds" — not "every typed surface is checked" and not "the client/server wire contract is verified end-to-end." Even after Phase D, the gate proves the contract at compile time *and* via a wire-contract test — not runtime omniscience over every payload. This section is revised when Phase D closes, at which point the gate's coverage matches what its four-command shape promises.

(The same Phase A pass also records the monorepo's source-vs-built export-resolution convention as **C-D22** in `CODE_SPEC.md` — the dual-condition exports map that makes a TS-source package's `dist` runnable under plain `node` while dev tooling stays on source. That convention is implementation hygiene rather than a gate-coverage gap, but C-D22 is its durable home.)

---

## Cross-references

- `SESSION_START.md` — discipline floor; this file's gates sit inside that floor.
- `AUTO_CONTINUE_WORKFLOW.md` — the slice-chain rhythm that runs between the pre-work and post-work gates.
- `PLATFORM_STATUS.md` — current taxonomy state per deliverable surfaces here; refreshed at every session sign-off.
- `HANDOVER_TEMPLATE.md` — the handover format the post-work gate's first checkbox produces.
- `DECISIONS.md` / `CODE_SPEC.md` / `ROADMAP.md` / `CHECKLIST.md` — the four files the pre-work gate scaffolds and the cohort hardener pass audits.
