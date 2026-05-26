# Throughline Handover — Phase 22 doc prerequisites and Phase 19–22 ROADMAP/CHECKLIST scaffolding

**Generated:** 2026-05-26
**Last commit SHA:** _to be filled at merge_ — 2026-05-26
**Previous handover:** `2026-05-26-phase-21-bootstrap-prompt-and-invocation-prereqs.md` (Phase 21 — bootstrap prompt and Claude Code invocation doc prerequisites)

---

## Build State vs Spec

Doc-only slice. No code, no migrations, no schema, no fixtures. Closes the five-session doc-authoring stream. One anchor introduced (T-D57); one new SPEC §7.14 mini-section; one §14 index row added; WN-clone-Q6 flipped from forward-pointer to back-reference; WN-clone-Q7 reframed from question to durable design principle; ROADMAP scaffolded with four new phase sections (19, 20, 21, 22) plus a closing sequencing-note paragraph; CHECKLIST scaffolded with four new phase headers + preamble paragraphs (deliberately empty of slice rows); single-use prompt artefact removed.

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| T-D57 — discipline-drift scanners do not auto-run on bind for bootstrap-imported projects; SettingsView gains a "Run discipline scan" trigger; periodic-review scheduling gated on first user-invoked scan; non-bootstrapped projects keep current on-bind behaviour | built | `DECISIONS.md` (after T-D56) | Content verbatim per pre-authorised block; wrapper matches T-D51–T-D56 precedent (h2 + Date/Status/Sections + Decision/Context/Rationale/Implications). `Status` line names WN-clone-Q6 as the working note resolved. Implications bullet explicitly records the "no companion C-D for Phase 22" choice so future readers do not look for one. |
| SPEC §7.14 scan-on-demand mini-section (functional prose) | built | `SPEC.md` §7.14 (between the discipline-drift block and the manual item-to-PR linking paragraph) | ~190 words, single paragraph, bolded paragraph lead (`**Scan-on-demand for bootstrapped projects.**`) — matches §7.14's existing sub-structure (`**Code drift (four tiers):**`, `**Discipline drift (bundle-defined).**`, `**Manual item-to-PR linking**`). T-D48 voice (methodology-agnostic, runtime-first); cites T-D57, §7.27, §14 → T-D57. |
| SPEC §14 anchor index — one new row | built | `SPEC.md` §14 table (after T-D56 row) | Row count grew by exactly 1 (T-D57 → 7.14). |
| `WN-clone-Q6` trailing sentence flipped from forward-pointer to back-reference | built | `DECISIONS.md` WN-clone-Q6 | Title-tag and body prose byte-identical to pre-PR; only trailing sentence changed (`Resolved by → T-D57 (Phase 22).` → `Resolved by T-D57 (introduced 2026-05-26).`). Matches the WN-clone-Q1 through Q5 convention. |
| `WN-clone-Q7` reframed from question to durable design principle | built | `DECISIONS.md` WN-clone-Q7 | Two-edit reframe: (a) status tag flipped from `*(resolved 2026-05-24)*` to `*(design principle, 2026-05-24)*`; (b) trailing sentence rewritten from `Resolved by → informs design decisions across T-D51 through T-D57 (Phases 19–22) rather than a single anchor.` to `Informs design decisions across T-D51 through T-D57 (Phases 19–22) rather than resolving to a single anchor.` Body paragraph unchanged. **Adapted to live `### h3` heading** — the prompt's §3 Edit 1 find target showed a bold-paragraph form, but live Q7 (and Q1–Q6) all use the `### h3` heading convention. Halt-and-surface check resolved with spec author before edit: preserve the `### h3` structure, flip only the status tag. |
| ROADMAP §§19–22 scaffolds | built | `ROADMAP.md` (after Phase 16, before §13 adoption summary) | Four new phase sections matching the established four-field convention (`**Scope.** … **Dependencies.** … **Done when:** … **Sizing:** …`) demonstrated by Phase 16 and earlier. Content verbatim per pre-authorised block. Closing sequencing-note paragraph appended as a standalone paragraph after Phase 22 (no pre-existing "Sequencing notes" section to fold into). |
| CHECKLIST §§19–22 scaffolds | built | `CHECKLIST.md` (after Phase 18) | Four new H2 phase headers, each with a 1–2-sentence preamble naming the doc-authoring session that landed the prerequisites and a closing italic line `_Slice splits land when this phase's build session opens._`. **No slice rows; no checkbox rows.** Convention established here for empty-but-known-future phase scaffolds. |
| Single-use prompt artefact removed | built | `docs/_meta/throughline/prompts/2026-05-26-doc-session-5-phase-22-and-scaffolding.md` (deleted via `git rm`) | git history retains it. Same self-delete convention Sessions 2, 3, 4 used. |

CODE_SPEC.md is **unchanged** in this session (zero diff against main). Phase 22's implementation-shape detail lives in T-D57's Implications rather than a separate C-D anchor — Phase 22 is small enough to absorb it directly. Recorded explicitly in T-D57's "No companion C-D anchor for Phase 22" Implications bullet so future readers do not look for a C-D22.

---

## Last Decision Minted

- **T-D57** — Discipline-drift scanners do not auto-run on bind for projects imported via the bootstrap pipeline (T-D53 / T-D54 / C-D20). Such projects surface in SettingsView with a "Run discipline scan" trigger that the user invokes once they have triaged the bootstrap-imported items. Periodic-review scheduling is gated on the first user-invoked scan — until that scan completes, scheduled re-scans are suppressed; from the first user-invoked scan onward, periodic-review behaves identically to ongoing projects. The project record gains discipline-scan state tracking with three distinct states (pre-scan / running / complete) plus a last-run timestamp; the column shape is an implementation-shape choice for the build session. On-bind discipline-scan behaviour for ongoing (non-bootstrapped) projects is unchanged. No companion C-D anchor for Phase 22 (the phase is small enough that the implementation-shape detail lives directly in T-D57's Implications). Lands in: `DECISIONS.md`.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `docs/_meta/throughline/handovers/2026-05-26-phase-22-and-scaffolding.md` — this handover.

**Modified:**
- `DECISIONS.md` — appended T-D57 anchor body after T-D56; flipped trailing sentence of `WN-clone-Q6` from forward-pointer to back-reference form; reframed `WN-clone-Q7` (status tag flipped to `(design principle, 2026-05-24)`; trailing sentence rewritten to drop the `Resolved by →` prefix and read as plain prose).
- `SPEC.md` — inserted scan-on-demand mini-section into §7.14 (between the discipline-drift block and the manual item-to-PR linking paragraph); appended T-D57 row to the §14 anchor index after the T-D56 row.
- `ROADMAP.md` — appended four new phase sections (Phases 19, 20, 21, 22) after Phase 16 matching the established four-field convention; appended a standalone closing sequencing-note paragraph after Phase 22 (the file does not carry a pre-existing "Sequencing notes" section to fold into).
- `CHECKLIST.md` — appended four new phase scaffolds (Phases 19, 20, 21, 22) after Phase 18. Each is a phase header + 1–2-sentence preamble naming the doc-authoring session that landed the prerequisites + a closing italic line `_Slice splits land when this phase's build session opens._`. Deliberately empty of slice rows.

**Deleted:**
- `docs/_meta/throughline/prompts/2026-05-26-doc-session-5-phase-22-and-scaffolding.md` — single-use prompt; deleted by `git rm` in the same commit. git history retains it.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Adapted to live structure | `DECISIONS.md` WN-clone-Q7 heading | Prompt's §3 Edit 1 find target used a `**bolded-paragraph**` form for the Q7 title line, but live Q7 (and Q1–Q6) all use the `### h3` heading convention. The prompt's halt-and-surface clause was triggered. | Surfaced to spec author before editing; spec author confirmed: preserve the `### h3` structure, flip only the status tag from `*(resolved 2026-05-24)*` to `*(design principle, 2026-05-24)*`. Edit 2 (trailing-sentence rewrite) was unaffected — the prompt's find target matched live text verbatim and proceeded as written. The intent of the reframe (status tag + trailing sentence rewrite) is fully preserved; only the heading-level wrapper differs from the prompt's verbatim target. |
| Observed but not fixed | `CODE_SPEC.md:9` | Anchor-convention paragraph still says T-D anchors "remain canonical at 48"; post-Session-5 total is 57. Stale across Sessions 2, 3, 4, 5 (cumulative drift from T-D49/T-D50 through T-D57). | Surfaced in the PR description. CODE_SPEC.md is not in this session's file-touch manifest (no C-D in scope) and Sessions 2, 3, 4 already noted this is a separate-slice cleanup. |
| Observed but not fixed | `ROADMAP.md` | Prior to this PR, ROADMAP ended at Phase 16; Phases 17 and 18 (complete in CHECKLIST and on disk in `packages/`) were never backfilled into ROADMAP. This PR appends Phases 19–22 but does not retroactively author Phase 17 / Phase 18 ROADMAP sections — they remain a separate-slice cleanup. | Surfaced in the PR description per the prompt's explicit "observed but do not fix" instruction. Worth a small backfill PR at some point but not Session 5's job. |

---

## Open Questions

_none_

The five-session doc-authoring stream is closed. All seven `WN-clone-Q*` working notes are accounted for: Q1 / Q4 resolved by Session 2 (Phase 19), Q2 / Q3 resolved by Session 3 (Phase 20), Q5 resolved by Session 4 (Phase 21), Q6 resolved this session (Phase 22), and Q7 reframed this session as a durable design principle informing the cohort (T-D51, T-D53, T-D54, T-D55, T-D57). No working-note forward-pointers remain in `DECISIONS.md`.

---

## Recently Resolved

- `WN-clone-Q6` — introduced as a forward-pointer working note in Session 1 of the doc-authoring stream (PR #32, "Doc session 1 — promote seven open questions to resolved working notes"). Trailing sentence flipped from `Resolved by → T-D57 (Phase 22).` to `Resolved by T-D57 (introduced 2026-05-26).` now that T-D57 exists. Same back-reference template Q1 / Q2 / Q3 / Q4 / Q5 use.
- `WN-clone-Q7` — introduced as a forward-pointer working note in Session 1 alongside Q1–Q6. Unlike Q1–Q6 it does not resolve to a single anchor; it informs design decisions across T-D51, T-D53, T-D54, T-D55, T-D57. Reframed this session from question to durable design principle: status tag changed from `*(resolved 2026-05-24)*` to `*(design principle, 2026-05-24)*`; trailing sentence rewritten from `Resolved by → informs design decisions across T-D51 through T-D57 (Phases 19–22) rather than a single anchor.` to `Informs design decisions across T-D51 through T-D57 (Phases 19–22) rather than resolving to a single anchor.` Body paragraph unchanged. Forcing Q7 into the Q1–Q5 back-reference template would either overstate weak draws (T-D52 and T-D56 are orthogonal to Q7's framing) or produce a visually heavy multi-anchor line; the reframe preserves Q7's actual shape as a cohort-informing principle.

---

## Cross-Module Dependencies

**Upstream (this module consumes):** _none_ (doc-only slice)

**Downstream (consumes this module):**
- Phase 22 implementation slice — consumes T-D57. Pending; builds the three-state discipline-scan column (pre-scan / running / complete + last-run timestamp), the bootstrap-pipeline integration that sets the initial pre-scan state, the SettingsView "Run discipline scan" trigger (prominent for pre-scan, less prominent for re-scan), and the periodic-review scheduling gate. No new code-spec anchor; the implementation-shape detail is recorded in T-D57's Implications.
- The five-session doc-authoring stream is closed. After Session 5 merges, all doc prerequisites for Phases 19, 20, 21, 22 are on `main`; the four build phases can begin in linear order (Phase 19 → Phase 20 → Phase 21 → Phase 22), per the closing sequencing note in ROADMAP.

---

## Reference

- Spec / decisions / build-state docs this slice operates against: `SESSION_START.md`, `SPEC.md` §7.14 / §7.27 / §14, `DECISIONS.md` T-D48 / T-D51 / T-D53 / T-D54 / T-D55 / T-D56 / WN-clone-Q1–Q7, `CODE_SPEC.md` C-D19 / C-D20 / C-D21 (consulted for shape; not modified), `ROADMAP.md` Phases 14–16 (precedent for the four-field convention), `CHECKLIST.md` Phases 17–18 (precedent for completed phases), `docs/_meta/throughline/HANDOVER_TEMPLATE.md`, prior handover `2026-05-26-phase-21-bootstrap-prompt-and-invocation-prereqs.md`, the single-use prompt artefact `docs/_meta/throughline/prompts/2026-05-26-doc-session-5-phase-22-and-scaffolding.md` (deleted in this commit).
- Precedent code (read for shape only; not edited): `packages/backend/src/methodology/scanners/` and the discipline-drift scanner code — the scan-on-demand activation gate is a project-state precondition, not a scanner-internals change.
- PR: _to be filled at open_
