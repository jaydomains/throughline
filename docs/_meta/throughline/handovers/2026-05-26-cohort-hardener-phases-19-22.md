# Throughline Handover — Cohort-level heavy hardener (Phases 19–22 doc prerequisites)

**Generated:** 2026-05-26
**Last commit SHA:** _to be filled at merge_ — 2026-05-26
**Previous handover:** `handovers/2026-05-26-platform-discipline-polish.md` (Platform discipline polish, PR #41)

---

## Build State vs Spec

This slice is the first cohort-level heavy hardener pass under the two-cadence model codified in `AUTHORING_DISCIPLINE.md` (PR #41). Scope is the Phases 19–22 doc prerequisites cohort (PRs #32–#40) plus the in-flight Phase 18 decisions T-D49 / T-D50 that share the cycle. Output: cohort promoted from `pre-work-doc-complete` / `feature-complete` to `production-ready`.

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Stale anchor counts in narrative prose refreshed (`CODE_SPEC.md §1`) | built | `CODE_SPEC.md:9` — "(currently 57 entries; see `SPEC.md §14` for the canonical live index)" replaces stale "remain canonical at 48" | Self-refreshing wording chosen over fixed count to slow re-drift; pointer to §14 names the canonical live source. |
| ROADMAP phase backfill (Phases 17, 18) | upstream | PR #42 `9155e29` already appended Phase 17 / Phase 18 sections | No further backfill needed. |
| Vocabulary drift audit across cohort | built (scoped) | `SPEC.md §7.27` (lines 474), `CODE_SPEC.md` C-D20 endpoint description, `docs/.throughline-schema.md` transient-files paragraph + See-also row | "bootstrap import file" canonicalised on first mention in SPEC.md §7.27 and CODE_SPEC.md C-D20; `@bootstrap-id:` override cross-referenced from schema doc. Items 3.iii/3.iv/3.v deferred to Drift Flags / accepted — see below. |
| Forward-pointer resolution audit | audited clean | `DECISIONS.md` WN-clone-Q1..Q7 (lines 1323–1349) | All seven `WN-clone-Q*` already resolved (Q1–Q6 back-references, Q7 design-principle reframe) by per-slice hardeners in Sessions 2–5. Four `<!-- RATIONALE NEEDED -->` markers (T-D10, T-D15, T-D17, T-D23) and two explicit deferrals in CODE_SPEC.md "Questions for the spec author" (items 8, 9) are pre-existing explicit gaps, not closeable in this pass. |
| Handover-chain completeness — Session 1 / PR #32 absence | accepted | `PLATFORM_STATUS.md` Recent Slice History row for PR #32; this handover's Recently Resolved section | Acceptance documented in three durable docs. |
| `SESSION_START.md` "Known spec-author gaps" refresh | built | `SESSION_START.md:93–94` | Stale "seven items 1–7" claim replaced with the two actually-open items (8, 9). Four RATIONALE NEEDED markers line unchanged. |
| `SPEC.md §14` anchor index audit | audited clean | `SPEC.md:634–694` | §14 is T-D-only by design (`SPEC.md:634` "Anchor format: `T-D{n}`"). All 57 T-D rows present in mint order, no duplicates, no stale subject lines, sections cited resolve. |
| Build-prerequisite stress test for Phase 19 | passes | T-D51, T-D52 (`DECISIONS.md:1057–1112`); C-D19 (`CODE_SPEC.md:524–550`); SPEC §7.26 (`SPEC.md:452–468`); ROADMAP §19 (`ROADMAP.md:413–421`); CHECKLIST §19 (`CHECKLIST.md:577–581`); `docs/.throughline-schema.md` | Every anchor cited resolves; ROADMAP §19 names concrete Scope / Dependencies / Done-when / Sizing; no Phase-19-relevant question remains open. Verdict: Phase 19 build session can open immediately after this PR merges. |
| `PLATFORM_STATUS.md` cohort-roll | built | `docs/_meta/throughline/PLATFORM_STATUS.md` | Snapshot updated; Locked Decisions kept visible with `production-ready` annotation; Queued Work cleaned; Open Spec-Author Gaps mirrored from SESSION_START; Recent Slice History extended through PR #43 with PR #32 acceptance note; first-cycle exception note removed; cycle-reset semantics clarified. |

---

## Last Decision Minted

No new decisions minted. This is a hardener pass — it audits and refreshes the existing decision corpus rather than adding to it. Implementation followed `AUTHORING_DISCIPLINE.md`'s cohort-level heavy hardener checklist.

One process clarification surfaced (see Open Questions below): the Update Protocol's cycle-reset rule did not pin *when* the Locked-Decisions-This-Cycle table rolls. Practice established by this pass — roll-off fires when the *next* cohort's first new T-D / C-D anchor lands, not at hardener close — needs encoding in `AUTHORING_DISCIPLINE.md` and `PLATFORM_STATUS.md` by a future small process-doc slice.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `docs/_meta/throughline/handovers/2026-05-26-cohort-hardener-phases-19-22.md` — this handover.

**Modified:**
- `CODE_SPEC.md` — §1 anchor-count line reworded to self-refresh; C-D20 endpoint description first-mention canonicalised to "bootstrap import file".
- `SPEC.md` — §7.27 first-mention canonicalised to "bootstrap import file" (line 474).
- `docs/.throughline-schema.md` — transient-files trailing paragraph extended with T-D54 cross-reference for `bootstrap_id` derivation and `@bootstrap-id:` override; T-D54 added to See-also.
- `SESSION_START.md` — "Known spec-author gaps" line refreshed (seven → two; items 1–7 closed, items 8, 9 named).
- `docs/_meta/throughline/PLATFORM_STATUS.md` — Snapshot, Locked Decisions This Cycle (production-ready annotation + cycle-reset rule clarified), Queued Work (closed items removed), Open Spec-Author Gaps (mirrored), Recent Slice History (extended through PR #43; PR #32 acceptance note added), Update Protocol (first-cycle exception removed; cycle-reset rule clarified).

**Deleted:**
_none_ — no single-use prompt artefact for this pass.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Fixed in this pass | `CODE_SPEC.md:9` | Narrative said T-D anchors "remain canonical at 48"; live count was 57. Drifted across Sessions 2–5 because per-slice hardener does not catch cross-cohort narrative-prose anchor counts. | Reworded to "(currently 57 entries; see `SPEC.md §14` for the canonical live index)". Self-refreshing wording reduces the drift class from "stale and misleading" to "slightly stale snapshot with authoritative pointer." |
| Fixed in this pass | `SPEC.md §7.27`, `CODE_SPEC.md` C-D20 | "bootstrap file" used informally where "bootstrap import file" is the formal term per T-D53. | Canonicalised first mention per subsection; shortened "bootstrap file" remains acceptable as back-reference once introduced (per the agreed scope). |
| Fixed in this pass | `docs/.throughline-schema.md` | Schema doc did not surface T-D54's `bootstrap_id` derivation rules or the universal `@bootstrap-id:` override syntax, leaving anyone hand-authoring a bootstrap output file without a pointer to the override mechanism. | Trailing paragraph in the transient-files section extended; T-D54 added to See-also. |
| Observed but intentionally not fixed | `CODE_SPEC.md` C-D19 / C-D20 / C-D21 | "Clone-and-go" — the cohort's unifying user-facing concept — does not appear in CODE_SPEC.md. SPEC §7.26 title, T-D51 narrative, schema doc, and ROADMAP §19 all use the term. | Correct under T-D48 (CODE_SPEC stays implementation-shape-only, methodology-agnostic voice). Importing the user-facing product term into CODE_SPEC would violate that discipline. Surfaced here for visibility; no fix. |
| Accepted, not drift | various | "Discipline-drift scanners" (agent noun, T-D57) vs "Run discipline scan" (UI verb, SettingsView button label per T-D57). | Both canonical in their own grammatical role; not drift. No glossary entry needed. |
| Accepted, not drift | various | `<repo_path>/.throughline/bundle.md` (path-context formal) vs `.throughline/bundle.md` (prose-context informal). | Both correct in context; context-dependent precision is intentional. |

The first three rows are the cohort-hardener's substantive work. The last three rows record findings the audit surfaced but explicitly does not fix — they are recorded here for cohort audit completeness so future hardener passes do not re-discover them as fresh "drift".

---

## Open Questions

- [ ] **Cycle-reset semantics encoding.** The Update Protocol in `PLATFORM_STATUS.md` and the cohort-hardener checklist in `AUTHORING_DISCIPLINE.md` do not pin *when* the Locked-Decisions-This-Cycle table rolls off. Practice established by this pass: **roll-off fires when the next cohort's first new T-D / C-D anchor lands, not at hardener close.** This keeps the just-promoted cohort visible across the immediately-next session. PR #43 updated `PLATFORM_STATUS.md` Update Protocol to reflect this; the parallel rule in `AUTHORING_DISCIPLINE.md` is queued as a future small process-doc slice. Out of scope for this PR.
- [ ] **CODE_SPEC.md "Questions for the spec author" items 8 and 9** — voice input language default (`lang` parameter) and cost meter daily threshold default value. Pre-existing explicit deferrals; surfaced in `SESSION_START.md` and `PLATFORM_STATUS.md`. Both await a spec-author recommendation, not closeable by hardener work.
- [ ] **Four `<!-- RATIONALE NEEDED -->` markers in `DECISIONS.md`** — T-D10, T-D15, T-D17, T-D23. Pre-existing; explicitly tracked as known spec-author gaps. Not in any cohort's scope.

---

## Recently Resolved

- **Session 1 / PR #32 handover absence — accepted as stream-opening exception.** PR #32 (merge `c6b9b2c`, working commit `1da08b2`) shipped seven `WN-clone-Q*` working notes to `DECISIONS.md` and landed without a handover. The absence was surfaced in `PLATFORM_STATUS.md:71`, `AUTHORING_DISCIPLINE.md:91`, and `handovers/2026-05-26-platform-discipline-polish.md:57–60` for adjudication by this pass. Acceptance rationale: (i) the work is retroactively well-covered in Session 2's Phase 19 handover (`handovers/2026-05-25-phase-19-clone-and-go-doc-prereqs.md`) which back-references both Q1 and Q4; (ii) a 9-day-old retrospective handover would fabricate session context (state-of-mind, observed drift, ambiguities) rather than recover it, risking more drift than it resolves; (iii) `HANDOVER_TEMPLATE.md` rule 8's immutability framing makes after-the-fact entries pollute the chain's truth-claim. The discipline already learned from the gap: `AUTHORING_DISCIPLINE.md`'s pre-work doc prep gate now requires a handover for the doc session itself, preventing recurrence. Acceptance is captured in three places: this handover; `PLATFORM_STATUS.md` Recent Slice History row for PR #32; the existing Phase 22 handover's Drift Flag entry stays as the original surfacing record.
- **WN-clone-Q1 → T-D51** — flipped to back-reference by per-slice hardener in Session 2 (PR #34). Re-listed here for cohort audit completeness.
- **WN-clone-Q2 → T-D53** — flipped to back-reference by per-slice hardener in Session 3 (PR #36).
- **WN-clone-Q3 → T-D54** — flipped to back-reference by per-slice hardener in Session 3 (PR #36).
- **WN-clone-Q4 → T-D52** — flipped to back-reference by per-slice hardener in Session 2 (PR #34).
- **WN-clone-Q5 → T-D55** — flipped to back-reference by per-slice hardener in Session 4 (PR #38).
- **WN-clone-Q6 → T-D57** — flipped to back-reference by per-slice hardener in Session 5 (PR #40).
- **WN-clone-Q7** — reframed by per-slice hardener in Session 5 (PR #40) from forward-pointer question to durable design principle informing T-D51, T-D53, T-D54, T-D55, T-D57 across the cohort. Status tag changed from `*(resolved 2026-05-24)*` to `*(design principle, 2026-05-24)*`; body unchanged.
- **CODE_SPEC.md anchor-count drift (Sessions 2–5 cumulative)** — surfaced in the Phase 22 handover's Drift Flags as "observed but not fixed"; resolved by this pass.
- **CODE_SPEC.md "Questions for the spec author" items 1–7** — all resolved by SPEC amendments and corresponding C-D anchors (C-D3, C-D9, C-D16, and the SPEC §7.12 gate-trigger amendments). `SESSION_START.md` and `PLATFORM_STATUS.md` were carrying stale "seven items still open" wording; refreshed by this pass to reflect that only items 8 and 9 remain open.

---

## Cross-Module Dependencies

**Upstream (this module consumes):** _none_ — doc-only pass; reads SPEC.md, CODE_SPEC.md, DECISIONS.md, ROADMAP.md, CHECKLIST.md, `docs/.throughline-schema.md`, `AUTHORING_DISCIPLINE.md`, `SESSION_START.md`, `PLATFORM_STATUS.md`, every cohort handover.

**Downstream (consumes this module):**
- **Phase 19 build session** — now unblocked. Doc prerequisites at `production-ready`; build-prerequisite stress test passes.
- **Cohort promotion record.** The following anchors are promoted to `production-ready` by this pass:
  - **T-D anchors:** T-D49, T-D50 (Phase 18); T-D51, T-D52 (Phase 19); T-D53, T-D54 (Phase 20); T-D55, T-D56 (Phase 21); T-D57 (Phase 22).
  - **C-D anchors:** C-D19 (Phase 19); C-D20 (Phase 20); C-D21 (Phase 21).
  - **Phases:** 18 (`feature-complete` → `production-ready`); 19, 20, 21, 22 (`pre-work-doc-complete` → `production-ready` for their doc prerequisites — code surfaces remain to be built).

---

## Reference

- Spec / decisions / build-state docs this slice operates against: `SESSION_START.md`, `SPEC.md` §7.26 / §7.27 / §7.28 / §14, `CODE_SPEC.md` §1 / C-D19 / C-D20 / C-D21 / "Questions for the spec author", `DECISIONS.md` T-D49–T-D57 and WN-clone-Q1–Q7, `ROADMAP.md` §§17–22, `CHECKLIST.md` §§19–22, `docs/.throughline-schema.md`, `docs/_meta/throughline/AUTHORING_DISCIPLINE.md` (cohort-level heavy hardener checklist), `docs/_meta/throughline/PLATFORM_STATUS.md`, all eight prior cohort handovers in `docs/_meta/throughline/handovers/` (Sessions 2–5 plus Phase 18 plus the platform-discipline-polish and ROADMAP backfill PRs).
- PR: #43 _(opens non-draft post-push per `AUTO_CONTINUE_WORKFLOW.md`)_
