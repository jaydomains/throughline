# Throughline Handover — Cohort-level heavy hardener pass over Phases 19–22 build outputs

**Generated:** 2026-05-28
**Last commit SHA:** pending — 2026-05-28
**Previous handover:** `2026-05-28-phase-22-slice-2-discipline-scan-block.md` (PR #65 — Phase 22 Slice 2, chain-close)

Second cohort-level heavy hardener pass under the two-cadence model encoded in
`docs/_meta/throughline/AUTHORING_DISCIPLINE.md`. The first pass (PR #43) covered the
Phases 19–22 **doc prerequisites**; this pass covers the Phases 19–22 **build outputs** —
the four implementation chains (PRs #47-50, #53-56, #59-62, #64-65) plus boundary-cleanup
PRs #51 and #57. Closes the bootstrap-and-clone-and-go arc: after merge, Phases 19–22 are
production-ready and the full feature is shippable end-to-end.

---

## Build State vs Spec

This pass runs the cohort-level heavy hardener checklist in
`AUTHORING_DISCIPLINE.md` against the build cohort. Each row reports the checklist item's
finding and what the pass did about it.

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Item 1 — Stale anchor counts in narrative prose (CODE_SPEC §1) refreshed | built | `CODE_SPEC.md:9` ("currently 57 entries"); verified `DECISIONS.md` carries 57 T-D, `CODE_SPEC.md` carries 21 C-D, `SPEC.md` §14 indexes 57 rows | No drift. PR #43 already refreshed §1 from the old "canonical at 48" to "currently 57"; new build-cohort anchors (T-D51…T-D57) folded in cleanly. |
| Item 2 — ROADMAP phase backfill for §§19–22 | built | `ROADMAP.md:413-459` (four-field convention on each phase); cross-checked against the cohort's handovers | No drift. Phase 22's no-migration outcome is not a ROADMAP gap — ROADMAP describes behaviour; the storage shape (flat scalars in `settings_json`) was explicitly an implementation-shape choice per T-D57 Implications (line 1274) and locked at chain-open as Q1A. The unified-BootstrapBlock consolidation is a C-D anchor drift, not a ROADMAP drift (see C-D amendments below). |
| Item 3 — Vocabulary drift audit across cohort code and docs | built | Grep audit across eight cohort terms (`discipline_scan_state`, `BootstrapBlock`, `DisciplineScanBlock`, `bootstrap-output.json`, `quarantine`, `pre-scan`, `bootstrap_id`, `bootstrap_stale`) across `packages/` + the cohort docs + the cohort handovers | No drift. Snake_case at DB layer, PascalCase for React components, lowercase for prose — all consistent. No `bootstrap.json` variant exists; no aliases needing collapse. |
| Item 4 — Forward-pointer resolution audit | built | Grep audit for `(forthcoming)` / `deferred to Phase` / `Resolved by →` / `WN-*` across the cohort docs and handovers | No drift. T-D56 (subprocess-spawning Claude Code) genuinely still deferred — codebase confirms no Claude Code `execFile`. T-D57 (auto-run-on-bind) fully shipped Phase 22. C-D21 surface 5 (re-bootstrap) fully shipped via the unified `BootstrapBlock`'s "Render"↔"Re-render" label toggle. All seven working notes (WN-clone-Q1…Q7) correctly flipped to back-references or reframed. |
| Item 5 — Handover-chain completeness audit | built | `docs/_meta/throughline/handovers/` 14 files for the 14 PRs in the cohort | No drift. All 14 PRs have handover files. 7 fix-rounds across 14 PRs; zero halt-class triggers. |
| Item 6 — `SESSION_START.md` "Known spec-author gaps" refresh | built | `SESSION_START.md:91-96`; cross-checked against `CODE_SPEC.md` Questions §§8-9 (open), four `<!-- RATIONALE NEEDED -->` markers in `DECISIONS.md` (T-D10, T-D15, T-D17, T-D23) | No drift. List matches live state. |
| Item 7 — `SPEC.md §14` anchor index audit | built | `SPEC.md` §14 contains all 57 T-D rows, contiguous, no duplicates; T-D51…T-D57 all present | No drift. |
| Item 8 — Production-readiness stress test (spec-vs-shipped) | partial → fixed this pass | `CODE_SPEC.md` C-D19 surface 6 / C-D20 surface 5 / C-D21 surface 6 — pre-amendment all described sibling SettingsView blocks; shipped reality is one unified `BootstrapBlock` per Phase 21 Slice 4 spec-author Q3 decision. Plus three smaller drifts found while reading the cohort end-to-end: `CHECKLIST.md:586` Phase 19 Slice 4 still `[ ]` despite PR #50 merged; `PLATFORM_STATUS.md:67` `_this PR_` reference; `PLATFORM_STATUS.md:11` `#TBD` Snapshot reference | Fixed: inline parenthetical amendments on the three C-D anchors per T-D57 precedent (DECISIONS.md:1275); CHECKLIST tick backfilled with PR/handover evidence; PLATFORM_STATUS rolls applied. |
| Item 9 — `PLATFORM_STATUS.md` cohort transition | built | `PLATFORM_STATUS.md` Snapshot rewritten; Current Phase rolls to "none in flight; cohort hardener closed"; Recent Slice History rolls (PRs #59 and #60 fall off; this PR + #65 prepend); Queued Work rebuilt around the two carry-forwards and the new branch-protection entry; Locked Decisions This Cycle table notes the seven build-cohort T-D + three C-D anchors promoted to `production-ready` (table itself retained per Update Protocol cycle-reset rule — rolls when the next phase mints its first anchor, not in this pass) | Done. |

---

## Last Decision Minted

No new T-D / C-D anchors minted. The pass applied amendments to three existing C-D
anchors per the T-D57 amendment precedent (inline parenthetical naming the change date
and pointing at the originating handover), and made two workflow-doc shape changes that
record reality without changing any active decision:

- **AUTO_CONTINUE_WORKFLOW.md — kill switch demotion of `throughline:pause` label.** The
  label was the original primary mechanism but across the Phases 19–22 build cohort it
  was never created in `jaydomains/throughline` (five passes through the gap in
  successive PLATFORM_STATUS rolls). All four chains ran end-to-end clean on the marker
  file + `/pause` comment signals alone. The label is now documented as
  optional/future; the marker file and `/pause` comments are documented as the two
  canonical signals. The label remains a valid third signal if the repo carries it.
- **AUTHORING_DISCIPLINE.md — anchor-scaffolding-for-small-phases note.** One-sentence
  note capturing the Phase 22 / T-D57 precedent: small-sized phases may use a T-D
  anchor's Implications block as the implementation spec in lieu of a companion C-D
  anchor. Both Phase 22 slices ran first-Gitar-review-clean with this minimal-scaffolding
  approach.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `.github/workflows/ci.yml` — minimal CI workflow on `pull_request` and on push to `main` / `claude/**` branches; runs `pnpm install --frozen-lockfile` then `pnpm -r typecheck && pnpm -r test && pnpm -r lint && pnpm -r build`. Per AUTO_CONTINUE_WORKFLOW's green-gate CI layer. **Advisory until set as a required status check in branch protection** (see Drift Flags).
- `docs/_meta/throughline/handovers/2026-05-28-cohort-hardener-phases-19-22-build.md` — this handover.

**Modified:**
- `packages/shared/src/project.ts` — `throughline_status?: ThroughlineStatus | undefined` (explicit `| undefined` for `exactOptionalPropertyTypes` compatibility; comment expanded to name the strictness flag and the legacy-undefined test path the change preserves).
- `packages/frontend/test/fixtures/mockApi.ts` — `getBootstrapState` mock retyped as `Promise<{ result: BootstrapState }>` and `as const` narrowings removed; `BootstrapState` added to the type-only import. Closes 4 of 6 strict-tsc errors.
- `packages/frontend/test/gatesView.test.tsx` — inline `mockApi.rescanDisciplineDrift.mockResolvedValue({ groups: [] })` extended to carry `discipline_scan_state: 'complete'` + `discipline_scan_last_run_at` per the Phase 22 Slice 1 retyping of `DisciplineDriftRescanResult`. Closes the sixth strict-tsc error (the one surfaced by this pass's CI-hole sweep — Phase 22 Slice 1 retyping missed this inline override).
- `CODE_SPEC.md` — three inline parenthetical amendments on C-D19 surface 6 / C-D20 surface 5 / C-D21 surface 6, all dated 2026-05-28, each pointing at handover `2026-05-28-phase-21-slice-4-unified-bootstrap-block.md`. Records the unified-BootstrapBlock consolidation per spec-author Q3 decision at Phase 21 Slice 4 chain-open.
- `CHECKLIST.md` — Phase 19 Slice 4 row flipped from `[ ]` "PR pending" to `[x]` with PR #50 / handover evidence per the neighbouring slice rows. Backfill of a per-slice light hardener miss.
- `docs/_meta/throughline/AUTO_CONTINUE_WORKFLOW.md` — Three-Layer Green Gate's CI layer rewritten to name the four `pnpm -r …` commands explicitly and to flag the workflow-vs-required-check distinction (advisory until repo-admin sets required-check). Kill Switch section restructured: marker file + `/pause` comment promoted to the two canonical signals; `throughline:pause` label demoted to optional/future with explicit reference to the five-pass run-clean evidence and the PR #43 precedent for formal acceptance.
- `docs/_meta/throughline/AUTHORING_DISCIPLINE.md` — one-paragraph note under Status Taxonomy capturing the small-phase / T-D-Implications-in-lieu-of-companion-C-D precedent (Phase 22 / T-D57). Larger phases (Phase 19/20/21) still mint companion C-D anchors per the existing convention.
- `docs/_meta/throughline/PLATFORM_STATUS.md` — Snapshot rewritten to mark cohort production-ready and record the pass's deliverables; Current Phase rolls; Recent Slice History rolls (PRs #59 and #60 fall off; this PR and #65 prepend); Queued Work rebuilt (`throughline:pause` slot now records the formal acceptance instead of carrying the gap forward; new branch-protection required-check entry added as the next out-of-band repo-admin action). Locked Decisions This Cycle table's intro line names the production-ready promotion date; table itself retained per the Update Protocol cycle-reset rule.

**Deleted:** _none_.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Branch-protection required-check enforcement for `.github/workflows/ci.yml` is a manual repo-admin step still pending | `jaydomains/throughline` repo settings | This hardener pass adds the CI workflow file, but until the spec author sets the workflow as a required status check in Settings → Branches → protection rule it runs advisory — auto-merge could still proceed without it passing. Same out-of-band action class as `throughline:pause` label creation. | Recorded — **not** declared "fixed". The gate's status is "automated; enforcement pending spec-author repo-settings action". The chain runner's local `pnpm -r typecheck && pnpm -r test && pnpm -r lint && pnpm -r build` pass remains the load-bearing check until the required-check setting lands. Surfaces in `PLATFORM_STATUS.md` Queued Work as the next out-of-band repo-admin action. |
| Auto-subscribe-on-non-draft-open is not happening — harness asks for PR-activity subscription rather than auto-subscribing per `AUTO_CONTINUE_WORKFLOW.md` step A | claude-code harness / agent runtime, not a repo file | Third time observed (this pass, plus two prior PRs whose handovers noted the same friction in passing). The intent encoded in `AUTO_CONTINUE_WORKFLOW.md` step A ("As soon as the slice's primary work is committed, the PR is opened non-draft. Non-draft is the explicit signal that polling begins") implies auto-subscription on PR open; the actual harness behaviour requires the user (or a subsequent agent turn) to explicitly subscribe via `subscribe_pr_activity`. Workflow doc edits cannot fix this — the auto-subscription mechanism is structural to the harness. | Recorded — not resolvable in this pass. Joins the carry-forward list alongside branch-protection enforcement and the demoted-but-not-created `throughline:pause` label. Tracked here for future workflow refinement; not a build-blocker because the post-open subscription is a single tool call and the workflow doc's polling contract is honoured once subscribed. |

---

## Open Questions

- [ ] **Branch-protection required-check.** The spec author sets `.github/workflows/ci.yml` as a required status check in Settings → Branches → protection rule. Out-of-band repo-admin action — landing site for the gate's enforcement step.

---

## Recently Resolved

- **`throughline:pause` label slot — formally accepted-and-stop-surfacing after five passes.** Was open in `PLATFORM_STATUS.md` Queued Work across PRs that closed Phases 19/20/21/22 (five successive passes); never created in `jaydomains/throughline`; all four chains ran end-to-end clean on the marker file + `/pause` comment fallback signals. Per the PR #43 Session-1-handover-gap adjudication precedent, this hardener pass demoted the label in `AUTO_CONTINUE_WORKFLOW.md` to optional/future rather than carrying the gap to a sixth pass. The label remains a valid third signal if the spec author later creates it.
- **Pre-existing `bootstrapBlock.test.tsx` strict-typecheck errors.** Was flagged in handovers `2026-05-28-phase-22-slice-1-discipline-scan-state-lifecycle.md` and `2026-05-28-phase-22-slice-2-discipline-scan-block.md` as Drift Flag carry-forward. Resolved this pass via two minimal type-level edits (`packages/shared/src/project.ts:27` explicit `| undefined`; `packages/frontend/test/fixtures/mockApi.ts:1179` mock retyped to return `BootstrapState`).
- **`gatesView.test.tsx:276` strict-typecheck error.** **Surfaced this pass** by running `pnpm -r typecheck` as part of the CI-hole sweep — was not previously flagged. Phase 22 Slice 1 retyped `api.rescanDisciplineDrift` from `DisciplineDriftResult` to `DisciplineDriftRescanResult` and updated the `mockApi.ts` fixture, but missed this inline mock override. Resolved by extending the inline mock with `discipline_scan_state` + `discipline_scan_last_run_at`. Confirms the user's hypothesis that the CI-shaped hole let through more than just the bootstrapBlock errors — though blast radius across four chains was bounded to six type errors in test code only, zero in shipped non-test code.
- **`CHECKLIST.md:586` Phase 19 Slice 4 row missing tick.** Was `[ ]` "PR pending" despite PR #50 merged 2026-05-27. The per-slice light hardener for Phase 19 Slice 4 missed it. Backfilled this pass with PR / handover evidence and an explicit comment naming the backfill.
- **C-D19 surface 6 / C-D20 surface 5 / C-D21 surface 6 sibling-block descriptions.** Diverged from shipped reality when Phase 21 Slice 4 consolidated the three SettingsView blocks into one unified `BootstrapBlock` per spec-author Q3 decision. Anchors not amended at slice close; spec-author decision recorded only in the Phase 21 Slice 4 handover. Resolved this pass via inline parenthetical amendments on each anchor (T-D57 precedent).

---

## Cross-Module Dependencies

**Upstream (this pass consumes):**
- All four cohort chains and their handovers — read end-to-end to drive the production-readiness stress test.
- `docs/_meta/throughline/AUTHORING_DISCIPLINE.md` cohort-level heavy hardener checklist — the rubric this pass executes against.

**Downstream (consumes this pass):**
- Next build phase (whatever the spec author queues next). The CI workflow + the load-bearing local-pre-PR pass language in `AUTO_CONTINUE_WORKFLOW.md` apply to every subsequent slice in any subsequent chain.
- Spec-author repo-admin action setting the new workflow as a required status check (Queued Work).

---

## Reference

- `docs/_meta/throughline/AUTHORING_DISCIPLINE.md` — the cohort-level heavy hardener checklist this pass executes.
- `docs/_meta/throughline/AUTO_CONTINUE_WORKFLOW.md` — Three-Layer Green Gate (CI layer rewritten this pass) + Kill Switch (label demoted this pass).
- `docs/_meta/throughline/PLATFORM_STATUS.md` — current state surface; Snapshot rewritten this pass; Recent Slice History rolled.
- `CODE_SPEC.md` — C-D19 / C-D20 / C-D21 amended this pass.
- `CHECKLIST.md` §19 — Slice 4 row backfilled this pass.
- `DECISIONS.md` T-D51…T-D57 — promoted to `production-ready` this pass.
- Prior cohort-hardener handover: `docs/_meta/throughline/handovers/2026-05-26-cohort-hardener-phases-19-22.md` (PR #43, doc prerequisites cohort).
- Cohort handovers consumed by this pass:
  - `2026-05-27-phase-19-slice-1-loader-third-arm-and-repo-path-normalisation.md` … `2026-05-27-phase-19-slice-4-frontend-modal-and-settings-view.md`
  - `2026-05-27-carry-forwards-cleanup-pre-phase-20.md`
  - `2026-05-27-phase-20-slice-1-schema-migration.md` … `2026-05-27-phase-20-slice-4-review-ui-and-resolve-endpoint.md`
  - `2026-05-27-carry-forwards-cleanup-pre-phase-21.md`
  - `2026-05-28-phase-21-slice-1-prompt-template-render-endpoint-path-guard.md` … `2026-05-28-phase-21-slice-4-unified-bootstrap-block.md`
  - `2026-05-28-phase-22-slice-1-discipline-scan-state-lifecycle.md` … `2026-05-28-phase-22-slice-2-discipline-scan-block.md`
- PR: pending — opens non-draft, single commit on branch `claude/phases-19-22-hardener-uPKwI`.
