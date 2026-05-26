# Session 5 — Phase 22 doc prerequisites and Phase 19–22 ROADMAP/CHECKLIST scaffolding

## Mission

You are the Session 5 instance of the Throughline doc-authoring stream — the closing session. This slice is **doc-only** — no code, no migrations, no schema changes, no fixtures. You will introduce one new anchor (T-D57) covering the Phase 22 producer-side prerequisite (discipline-drift scanners do not auto-run on bind for bootstrap-imported projects; the user invokes the first scan from SettingsView). You will add a SPEC discipline-drift scan-on-demand mini-section under §7.14 (working assumption — verify against live SPEC structure before placing), append one new row to the SPEC §14 anchor index (T-D57), flip the trailing forward-pointer on `WN-clone-Q6` to a back-reference now that T-D57 exists, **reframe `WN-clone-Q7` from a question to a durable design principle** (status tag and trailing prose update; not a back-reference flip), add four new phase sections to ROADMAP.md (Phases 19, 20, 21, 22) matching the established four-field convention, add four new phase scaffolds to CHECKLIST.md (Phases 19, 20, 21, 22) — phase header + preamble only, no slice rows — and delete this very prompt file as part of the same commit.

Session 4 (merged 2026-05-26) added T-D55, T-D56, C-D21, SPEC §7.28, and flipped WN-clone-Q5. Of the two remaining working-note forward-pointers (Q6, Q7), Q6 realises in Phase 22 — this session realises it. Q7 is the cross-cohort principle that informed T-D51, T-D53, T-D54, T-D55, and T-D57 — this session reframes it (it does not flip to a back-reference; see §3 below for why and the verbatim replacement). After Session 5 merges, all doc work for Phases 19–22 is complete and the four build phases can begin.

## Self-delete contract

This prompt file lives at `docs/_meta/throughline/prompts/2026-05-26-doc-session-5-phase-22-and-scaffolding.md`. As part of your single doc-work commit, **delete this file**. After Session 5 merges, the prompt is gone from `main`; only git history retains it. Do not move it, do not archive it, do not soft-delete — `git rm` it in the same commit as the rest of the doc work. Same convention Sessions 2, 3, and 4 used.

## Authority and reading order

Before you draft anything, read in this order:

1. `SESSION_START.md` — the discipline floor. The "anchor convention" rule says don't invent anchors mid-session — but **T-D57 is pre-authorised by the spec author in this prompt**. The exact anchor ID and body you are about to write are below; you transcribe them.
2. The most recent handover (`docs/_meta/throughline/handovers/2026-05-26-phase-21-bootstrap-prompt-and-invocation-prereqs.md`). This is the live state at the end of Session 4.
3. `SPEC.md` §7.14 and §14. §7.14 is the existing discipline-drift section; the new scan-on-demand mini-section lands inside it. The mini-section sits after the "Discipline drift (bundle-defined)" prose and before "Manual item-to-PR linking" (working assumption — verify against live §7.14 structure). §14 carries the anchor index whose row format you must match — read the T-D55 / T-D56 rows in particular (both Session-4-dated 2026-05-26) so the row you add fits existing tone.
4. `DECISIONS.md` T-D49 through T-D56, `WN-clone-Q1` through `WN-clone-Q7`. T-D51–T-D56 are the closest precedents for the T-D57 anchor shape — they use the `## T-D<n> — Title` h2 heading with three metadata bullets (`Date`, `Status`, `Sections affected`), then `### Decision`, `### Context`, `### Rationale`, `### Implications` h3 subsections. **Match that shape exactly.** WN-clone-Q1 through WN-clone-Q5 carry the back-reference convention (`Resolved by T-D<n> (introduced YYYY-MM-DD).`) that Q6 will flip to in §2 below. WN-clone-Q6 is the working note T-D57 resolves; WN-clone-Q7 is the cross-cohort principle reframed in §3 below.
5. `ROADMAP.md` Phase 14, Phase 15, Phase 16 — the closest precedents for the four-field convention (`**Scope.** … **Dependencies.** … **Done when:** … **Sizing:** …`). Phase 16 currently ends the document; you append after it. **Note:** Phases 17 and 18 are complete in CHECKLIST but were never backfilled into ROADMAP. That gap is out of scope for this session — do not fix it here, but observe it in the PR description.
6. `CHECKLIST.md` Phase 17 and Phase 18 — they show the live convention for completed phases (filled-in slice rows). Phase 18 currently ends the document; you append after it. The new Phase 19–22 scaffolds are **deliberately empty of slice rows**; the convention is established here by the closing italic line `_Slice splits land when this phase's build session opens._`.
7. `packages/backend/src/methodology/scanners/` (if present) and the discipline-drift scanner code — read for shape only; you are not editing it. The scan-on-demand activation is a gating change, not a scanner-internals change.

If you discover that any live file has shifted such that the placements named in this prompt no longer fit (e.g. the §14 table no longer ends at T-D56, T-D57 is already taken, §7.14 has been restructured such that the proposed mini-section placement no longer makes sense, ROADMAP no longer ends at Phase 16, CHECKLIST no longer ends at Phase 18, the WN-clone-Q6 trailing forward-pointer reads differently than what §2 expects, the WN-clone-Q7 body reads differently than what §3 expects), **halt and surface** before drafting anything. Do not silently adapt.

## Constraints and discipline

- **Branch:** `claude/throughline-doc-session-5-phase-22-and-scaffolding`. Create on a fresh branch from `main` after fetching.
- **Single commit** on the slice's branch. The handover file (see file-touch manifest) lands in the same commit, per `HANDOVER_TEMPLATE.md`'s authoring rule. The deletion of this prompt file is part of the same commit.
- **No code, no migrations, no schema, no fixtures.** This PR is doc-only.
- **Verbatim transcription is literal.** The pre-drafted blocks below (T-D57 body, Q6 back-reference flip, Q7 reframe, ROADMAP §§19–22, CHECKLIST §§19–22, SPEC §14 row) are transcribed character-for-character. If during transcription you spot a factual or phrasing concern, **halt and surface to the spec author** — do not adapt silently.
- **Outline-only content is yours to draft.** The new SPEC §7.14 scan-on-demand mini-section prose is specified by content beats (§4 below); you draft it to fit the existing terse, decision-oriented, methodology-agnostic tone (T-D48). Match §7.14's existing voice. ~150–200 words; this is a mini-section, not a full subsection.
- **Confirm live placements before drafting prose.** SPEC §14 row position (after T-D56), T-D57 sequencing in DECISIONS.md (after T-D56), the §7.14 mini-section's placement inside §7.14, the ROADMAP append point (after Phase 16), the CHECKLIST append point (after Phase 18).
- **Use the run-date convention.** Every `<session-5-run-date>` placeholder in the pre-drafted blocks below is replaced with the calendar date you actually commit and merge. Same convention Sessions 2, 3, and 4 used.
- **Auto-continue on green CI + clean Gitar review** per the established workflow. Open the PR at slice close; do not pre-announce.
- **No file outside the file-touch manifest below is modified.**

## File-touch manifest (closed list)

You may modify only:

- `DECISIONS.md` — append T-D57 body after T-D56; flip `WN-clone-Q6` trailing sentence to back-reference T-D57 (§2 below); reframe `WN-clone-Q7` from question to durable design principle (§3 below).
- `SPEC.md` — insert the new scan-on-demand mini-section inside §7.14 (between the "Discipline drift (bundle-defined)" prose and "Manual item-to-PR linking" — verify); add one new row to the §14 table after T-D56.
- `ROADMAP.md` — append four new phase sections (Phases 19, 20, 21, 22) after Phase 16, matching the established four-field convention. See §5 below for the verbatim blocks and §6 below for the closing sequencing note.
- `CHECKLIST.md` — append four new phase scaffolds (Phases 19, 20, 21, 22) after Phase 18. See §7 below for the verbatim blocks. **No slice rows; no checkbox rows.**
- `docs/_meta/throughline/handovers/<merge-date>-phase-22-and-scaffolding.md` — new handover, written per `HANDOVER_TEMPLATE.md`, in the same commit.
- `docs/_meta/throughline/prompts/2026-05-26-doc-session-5-phase-22-and-scaffolding.md` — **delete this file** (`git rm`) in the same commit.

**Observed but do not fix:**
- ROADMAP.md ends at Phase 16; Phases 17 and 18 (complete in CHECKLIST) were never backfilled. This is a separate cleanup, scoped out of this PR. Note it in the PR description as observed.
- If the line at `CODE_SPEC.md:9` still says T-D anchors "remain canonical at" some count below the post-Session-5 total, surface it in the PR description as observed — Sessions 2, 3, and 4 already noted this is a separate-slice cleanup, scoped out of this PR. **CODE_SPEC.md is NOT modified in this session** (no C-D anchor in scope; see §1 Implications below for why Phase 22 carries no companion C-D).

---

## 1. Pre-drafted verbatim block — T-D57

Append to `DECISIONS.md` immediately after T-D56, in the same shape and tone as T-D51–T-D56 (h2 heading, three metadata bullets, four h3 subsections). Transcribe character-for-character, with `<session-5-run-date>` replaced by the actual commit / merge date. Halt and surface if anything reads off.

**BEGIN T-D57 (verbatim transcription) ↓**

## T-D57 — Discipline-drift scanners do not auto-run on bind for projects imported via bootstrap; SettingsView gains a "Run discipline scan" trigger

- **Date:** <session-5-run-date>
- **Status:** active — to be implemented in Phase 22, resolves WN-clone-Q6
- **Sections affected:** 7.14, 14

### Decision
Discipline-drift scanners do not auto-run on bind for projects that were imported via the bootstrap pipeline (T-D53 / T-D54 / C-D20). Such projects surface in SettingsView with a "Run discipline scan" trigger that the user invokes once they have triaged the bootstrap-imported items. Periodic-review scheduling is gated on the first user-invoked scan: until that scan completes, scheduled re-scans are suppressed for the project. On-bind discipline-scan behaviour for ongoing (non-bootstrapped) projects is unchanged.

### Context
Bootstrap brings months — sometimes years — of project history into Throughline in a single transaction: DECISIONS anchors, ROADMAP phases, CHECKLIST items, handover directories. The bootstrap-imported rows are what the user wants to look at first. Discipline-drift scanners running automatically against a months-old repo on bind would produce hundreds of signals — stale CHECKLIST ticks, handovers that no longer match the current bundle's discipline declarations, drifted anchor references — and bury the imported items behind a wall of drift-inbox noise on day one of adoption. The clone-and-go bootstrap posture (WN-clone-Q7) explicitly accepts that day-one state is partial-knowledge: the user has imported their history but hasn't yet decided what they want Throughline to draw attention to. Auto-run-on-bind contradicts that posture.

### Rationale
- **Trigger ownership belongs to the user, not the bind event.** Auto-run-on-bind is appropriate when a project's discipline state is known to be current (ongoing projects whose drift was triaged yesterday). For bootstrapped projects the discipline state is unknown — the bundle may have moved since the imported sources were authored, or the imported sources may pre-date the project's adoption of the bundle entirely. Gating the first scan behind explicit user action ensures the drift inbox is meaningful from the moment the user looks at it.
- **Periodic-review gating prevents background re-flooding.** Without gating periodic-review on the first user-invoked scan, the next periodic-review tick would produce the same flood the auto-run would have caused. Tying the periodic-review enable to the first user-invoked scan keeps the bootstrap-day-one inbox quiet without permanently disabling scanning for bootstrapped projects.
- **Non-bootstrapped projects keep current behaviour.** On-bind discipline-scan behaviour for ongoing (non-bootstrapped) projects is unchanged — those projects have a known-current discipline state and benefit from immediate scanning. T-D57 does not alter the existing scanner behaviour; it only gates the *first scan* for bootstrap-imported projects.
- **One trigger, two surfaces.** The "Run discipline scan" trigger in SettingsView serves both the bootstrap-day-one case (initial scan, prominent affordance) and the user-driven re-scan case (any project, any time; less prominent affordance once the project has completed its first scan). One UX surface, two contexts.

### Implications
- The project record gains discipline-scan state tracking with three distinct states: **pre-scan** (bootstrap default, applied to projects created via the bootstrap pipeline), **running** (a scan is in flight), and **complete** (with a last-run timestamp tracked alongside). The exact column shape — enum + nullable timestamp, single discriminated value, or other — is an implementation-shape choice for the build session; the requirement is the three-state distinction and the last-run timestamp. Ongoing (non-bootstrapped) projects skip the pre-scan state.
- The bootstrap import pipeline (Phase 20, per T-D53 / T-D54 / C-D20) sets the new project's discipline-scan state to pre-scan as part of project creation.
- SettingsView renders the "Run discipline scan" trigger conditionally: prominently when the project is in pre-scan; as a less prominent re-scan affordance once the project has reached complete.
- Periodic-review scheduling reads the project's discipline-scan state and skips bootstrapped projects until they reach complete. From the first user-invoked scan onward, periodic-review behaves identically to ongoing projects.
- **No companion C-D anchor for Phase 22.** Phase 22 is small enough (Sizing: small in ROADMAP) that the implementation-shape detail lives directly in T-D57's Implications rather than a separate C-D anchor. The other producer-side phases (19, 20, 21) each carry a companion C-D (C-D19, C-D20, C-D21) because their build surfaces are larger and benefit from a separate implementation-rationale layer; Phase 22 does not.
- Existing discipline-drift scanners, the drift inbox, the audit log, and on-bind behaviour for non-bootstrapped projects are unchanged. This anchor only changes the *activation* of the first scan for bootstrap-imported projects, not the scan internals.

**END T-D57 ↑**

---

## 2. Back-reference flip — WN-clone-Q6

One trailing-sentence rewrite in `DECISIONS.md`. The current text in WN-clone-Q6 ends with a forward-pointer (`Resolved by → T-D57 (Phase 22).`). Flip it to a back-reference, matching the shape Sessions 2, 3, and 4 used for WN-clone-Q1 / WN-clone-Q2 / WN-clone-Q3 / WN-clone-Q4 / WN-clone-Q5.

**BEGIN flip (WN-clone-Q6) ↓**

Find: `Resolved by → T-D57 (Phase 22).`
Replace with: `Resolved by T-D57 (introduced <session-5-run-date>).`

**END flip ↑**

If the live WN-clone-Q6 trailing sentence reads differently than the find target, **halt and surface** — do not silently adapt.

---

## 3. Reframe — WN-clone-Q7 from question to durable design principle

WN-clone-Q7 is **not** a normal working note that resolves to a single anchor. It is a durable design principle that emerged from clone-and-go thinking and informs design decisions across multiple anchors (T-D51, T-D53, T-D54, T-D55, T-D57) without any single one resolving it. The Q1–Q5 back-reference template (`Resolved by T-D<n>`) does not fit Q7's shape, and forcing it into that template would either overstate weak draws (T-D52, T-D56 are orthogonal to Q7's framing) or create a visually heavy multi-anchor line with a date-list spanning three days.

The reframe: change the status tag from `(resolved 2026-05-24)` to `(design principle, 2026-05-24)` and drop the `Resolved by →` prefix on the trailing sentence so the existing forward-pointer language reads as plain prose. Everything else in Q7's body stays exactly as it is.

This is an in-place edit of two pieces of WN-clone-Q7. Read the live WN-clone-Q7 carefully before editing — if either the status tag or the trailing-sentence text differs from the find targets below, **halt and surface**.

**BEGIN reframe (WN-clone-Q7) ↓**

Edit 1 — status tag:

Find: `**WN-clone-Q7 — Clone-and-go shapes every future adoption, not just the spec author's SiteMesh adoption** *(resolved 2026-05-24)*`
Replace with: `**WN-clone-Q7 — Clone-and-go shapes every future adoption, not just the spec author's SiteMesh adoption** *(design principle, 2026-05-24)*`

Edit 2 — trailing sentence:

Find: `Resolved by → informs design decisions across T-D51 through T-D57 (Phases 19–22) rather than a single anchor.`
Replace with: `Informs design decisions across T-D51 through T-D57 (Phases 19–22) rather than resolving to a single anchor.`

**END reframe ↑**

The body paragraph between the heading and the trailing sentence is unchanged.

---

## 4. Outline-only content — new SPEC §7.14 scan-on-demand mini-section

Draft this yourself, ~150–200 words, matching §7.14's voice (terse, decision-oriented — the existing "Code drift" and "Discipline drift" prose blocks set the tone). Placement: inside §7.14, between the "Discipline drift (bundle-defined)" prose paragraph (with its bulleted example list of categories) and the "Manual item-to-PR linking" paragraph. **Verify against live §7.14 structure first**; if §7.14 has been restructured such that this placement no longer makes sense, halt and surface before drafting.

Suggested mini-section title (h4 or bolded paragraph lead — match §7.14's existing sub-structure): **"Scan-on-demand for bootstrapped projects"** or **"Discipline-drift scanner activation"**. Pick whichever fits §7.14's existing sub-headings; if §7.14 uses bolded paragraph leads rather than h4 sub-headings, use a bolded paragraph lead.

Required content beats (order is a suggestion; structure to fit):

- **Bootstrapped projects do not auto-run discipline-drift scanners on bind.** Such projects surface in SettingsView with a user-invoked "Run discipline scan" trigger.
- **Periodic-review scheduling is gated on the first user-invoked scan.** Until that scan completes, scheduled re-scans for the project are suppressed.
- **Non-bootstrapped projects retain on-bind scanner behaviour.** This activation gate applies only to projects created via the bootstrap pipeline (per §7.27).
- **Cross-references** to T-D57 (the decision), §7.27 (the bootstrap pipeline that creates bootstrapped projects), and §14 → T-D57.

This is functional spec voice — what Throughline does and does not do, not why. The why lives in T-D57's Rationale.

---

## 5. SPEC §14 anchor-index row addition

Add one new row to the §14 table after the existing T-D56 row. Match the existing row format (the three-column shape `| Anchor | Subject | Section |`).

**BEGIN row addition (verbatim transcription) ↓**

| T-D57 | Discipline-drift scanners do not auto-run on bind for projects imported via bootstrap; SettingsView gains a "Run discipline scan" trigger; periodic-review scheduling is gated on the first user-invoked scan; non-bootstrapped projects keep current on-bind behaviour | 7.14 |

**END row addition ↑**

---

## 6. Pre-drafted verbatim blocks — ROADMAP §§19–22

Append four new H2 sections to `ROADMAP.md` immediately after Phase 16's section. Each section uses the established four-field convention (`**Scope.** … **Dependencies.** … **Done when:** … **Sizing:** …`) demonstrated by Phase 16 and earlier. Transcribe character-for-character.

**BEGIN ROADMAP additions (verbatim transcription) ↓**

## Phase 19 — `.throughline/` config and CLI init

**Scope.** Per-repo `.throughline/project.json` and optional `.throughline/bundle.md`; the bundle loader's third resolution arm (explicit external path → per-repo `.throughline/bundle.md` → install-shipped default); the `throughline init` CLI subcommand against the running backend.

**Dependencies.** Phases 1–18 substantially complete; bundle loader and SettingsView present.

**Done when:** a fresh clone of a repo carrying `.throughline/bundle.md` binds the bundle without manual `bundle_path` setup; `throughline init` writes via the existing HTTP endpoint with the backend running; auto-detection of `github_owner` / `github_repo` from git remote works when absent.

**Sizing:** medium.

## Phase 20 — Bootstrap import file shape and idempotent re-run

**Scope.** Bootstrap file schema (items, sessions, library entries per source type per T-D53); deterministic `bootstrap_id` derivation per source type plus the universal `@bootstrap-id:` override (T-D54); idempotent upsert on `(project_id, bootstrap_id)` with three row states (new, reimported, conflicted); bundle-aware ingest validation that rejects shapes violating the bound bundle's declarations; explicit exclusions of secrets, audit history, embeddings, settings, methodology bindings.

**Dependencies.** Phase 19 complete (`.throughline/` config available).

**Done when:** a bootstrap file produces an equivalent-state import on re-run; user-edited rows surface to a conflict queue rather than silent overwrite; bundle-aware validation rejects shapes that violate the bound bundle's item declarations; stale rows are flagged but never auto-deleted.

**Sizing:** large.

## Phase 21 — Bootstrap prompt template and Claude Code invocation contract

**Scope.** Repo-owned generic prompt template at `packages/backend/src/bootstrap/prompt-template.md` (T-D55); render endpoint that prepends the fixed parameter block and writes `.throughline/bootstrap-prompt.md`; file-mediated Claude Code invocation (T-D56) — Throughline writes the prompt, the user invokes Claude Code in their normal environment, Claude Code writes `.throughline/bootstrap-output.json`; chokidar watcher on the output file mirroring the inbox/watcher.ts pattern; archive-on-success / quarantine-on-failure worker; SettingsView init UX block surfacing bootstrap state.

**Dependencies.** Phase 20 complete (bootstrap import pipeline ready).

**Done when:** rendering a prompt and manually invoking Claude Code produces a valid `bootstrap-output.json` that ingests cleanly via the Phase 20 endpoint; archive captures successful ingests; failures land in quarantine with a sibling `.error.json` carrying the validator error.

**Sizing:** medium.

## Phase 22 — Discipline-drift scan-on-demand for bootstrapped projects

**Scope.** Discipline-scan state tracking on projects (pre-scan / running / complete, with a last-run timestamp); SettingsView "Run discipline scan" trigger surfaced prominently for bootstrap-imported projects pre-first-scan and as a re-scan affordance afterward; periodic-review scheduling gating on first-scan completion; on-bind scanner behaviour for non-bootstrapped projects unchanged.

**Dependencies.** Phase 21 complete (bootstrap pipeline produces bootstrap-imported projects with the relevant state).

**Done when:** projects created via the bootstrap pipeline do not auto-run discipline-drift scanners on bind; the user-invoked first scan flips the project's state to complete and re-enables periodic-review scheduling; on-bind scanning for non-bootstrapped projects continues unchanged.

**Sizing:** small.

**END ROADMAP additions ↑**

---

## 6a. Closing sequencing note for ROADMAP

After the Phase 22 block, append the following sentence (or fit it into the existing "Sequencing notes" section if one is present and accepts an addendum — verify):

**BEGIN sequencing note (verbatim transcription) ↓**

The Phase 19–22 chain is linear — each phase depends on the prior phase's surfaces (Phase 22 on Phase 21's bootstrap-imported-project state; Phase 21 on Phase 20's ingest endpoint; Phase 20 on Phase 19's `.throughline/` directory contract). No parallelisation across the chain is intended; each phase ships before the next opens.

**END sequencing note ↑**

If ROADMAP already has a "Sequencing notes" section at the end and folding the addendum into that section reads more naturally than appending a new standalone paragraph, do so; otherwise append as a standalone paragraph after Phase 22.

---

## 7. Pre-drafted verbatim blocks — CHECKLIST §§19–22

Append four new H2 sections to `CHECKLIST.md` immediately after Phase 18's section. Each section is **deliberately minimal** — phase header + 1–2-sentence preamble naming the anchors landed and the doc prerequisites already on `main` + a closing italic line that makes the empty-scaffold convention explicit. **No slice rows. No checkbox rows.** Each phase's build session populates its own slice splits when that phase opens.

Transcribe character-for-character.

**BEGIN CHECKLIST additions (verbatim transcription) ↓**

## Phase 19 — `.throughline/` config and CLI init

Phase 19 doc prerequisites landed in Session 2 of the doc-authoring stream (T-D51, T-D52, C-D19 minted; SPEC §7.26 + §14 amended; `docs/.throughline-schema.md` introduced). Build prerequisites are complete and this phase is ready to open.

_Slice splits land when this phase's build session opens._

## Phase 20 — Bootstrap import file shape and idempotent re-run

Phase 20 doc prerequisites landed in Session 3 of the doc-authoring stream (T-D53, T-D54, C-D20 minted; SPEC §7.27 + §14 amended; `docs/.throughline-schema.md` extended). Build prerequisites are complete and this phase is ready to open once Phase 19 lands.

_Slice splits land when this phase's build session opens._

## Phase 21 — Bootstrap prompt template and Claude Code invocation contract

Phase 21 doc prerequisites landed in Session 4 of the doc-authoring stream (T-D55, T-D56, C-D21 minted; SPEC §7.28 + §14 amended; `docs/.throughline-schema.md` Throughline-managed transient files section added). Build prerequisites are complete and this phase is ready to open once Phase 20 lands.

_Slice splits land when this phase's build session opens._

## Phase 22 — Discipline-drift scan-on-demand for bootstrapped projects

Phase 22 doc prerequisites landed in Session 5 of the doc-authoring stream (T-D57 minted; SPEC §7.14 scan-on-demand mini-section + §14 row added; WN-clone-Q6 back-referenced; WN-clone-Q7 reframed as a durable design principle). Build prerequisites are complete and this phase is ready to open once Phase 21 lands.

_Slice splits land when this phase's build session opens._

**END CHECKLIST additions ↑**

---

## 8. PR description template

Open the PR at slice close (auto-continue on green CI + clean Gitar review). Title:

```
Doc session 5 — Phase 22 doc prerequisites and Phase 19–22 ROADMAP/CHECKLIST scaffolding
```

Body (adapt; the spec author reads this as plain-language future-self review):

```
Closes the five-session doc-authoring stream. Introduces one anchor (T-D57)
covering the Phase 22 (discipline-drift scan-on-demand for bootstrapped
projects) doc prerequisite. Adds a SPEC §7.14 scan-on-demand mini-section,
one §14 index row, the Q6 back-reference flip, and the Q7 reframe (from
question to durable design principle). Scaffolds ROADMAP.md with four new
phase sections (19, 20, 21, 22) matching the established four-field
convention, and scaffolds CHECKLIST.md with four new phase headers + preamble
paragraphs (deliberately empty of slice rows; build sessions populate their
own splits). Deletes the single-use prompt artifact.

Doc-only — no code, no migrations, no schema. CODE_SPEC.md is NOT modified
in this session (no C-D anchor in scope; Phase 22 is small enough to absorb
implementation-shape detail directly into T-D57's Implications).

Key decisions recorded:
- T-D57 pins discipline-drift scanner activation as user-driven for
  bootstrap-imported projects, with periodic-review scheduling gated on the
  first user-invoked scan. Non-bootstrapped projects keep current on-bind
  behaviour. The three-state distinction (pre-scan / running / complete with
  last-run timestamp) is required; the column shape is an implementation-
  shape choice for the build session.
- WN-clone-Q6 flips to a back-reference (`Resolved by T-D57 (introduced
  <date>)`) per the established Q1-Q5 convention.
- WN-clone-Q7 is reframed from a question to a durable design principle —
  status tag flips to `(design principle, 2026-05-24)`, trailing sentence
  drops the `Resolved by →` prefix and reads as plain prose. Q7's role is to
  inform the cohort (T-D51, T-D53, T-D54, T-D55, T-D57), not to resolve to
  a single anchor.
- ROADMAP gains Phases 19-22 with the established four-field convention.
  Phases 17 and 18 (complete in CHECKLIST) were never backfilled into
  ROADMAP — observed but not fixed here (separate-slice cleanup).
- CHECKLIST gains Phase 19-22 scaffolds with phase headers + preamble only.
  No slice rows; each phase's build session populates its own splits from
  reality.

After this PR merges, all doc prerequisites for Phases 19-22 are complete on
main and the build phases can begin (Phase 19 first; linear chain to Phase
22).

Observed but not fixed:
- ROADMAP.md ends at Phase 16 prior to this PR; Phases 17 and 18 were never
  backfilled. Separate-slice cleanup, scoped out.
- [if the CODE_SPEC.md:9 "remain canonical at N" line is still stale, name
  it here — same as Sessions 2, 3, and 4 noted.]
```

---

## 9. Verification checklist

Run before opening the PR:

- `grep -c '^## T-D' DECISIONS.md` returns the prior count + 1.
- `grep -c '^## C-D' CODE_SPEC.md` returns the prior count (unchanged — no C-D added).
- `grep '| T-D57 |' SPEC.md` returns one row in the §14 table.
- `grep 'Resolved by → T-D57' DECISIONS.md` returns zero matches (forward-pointer gone).
- `grep 'Resolved by T-D57' DECISIONS.md` returns one match (back-reference in place).
- `grep -c 'Resolved by → T-D' DECISIONS.md` returns zero (Q6 was the last forward-pointer; Q7 was reframed, not flipped).
- `grep '*(resolved 2026-05-24)*' DECISIONS.md` — should still appear for WN-clone-Q6 (its status is unchanged); should NOT appear for WN-clone-Q7 (reframed to design principle).
- `grep '*(design principle, 2026-05-24)*' DECISIONS.md` returns one match (WN-clone-Q7's new status).
- `grep 'Resolved by → informs design decisions' DECISIONS.md` returns zero matches (Q7 trailing sentence rewritten).
- `grep 'Informs design decisions across T-D51 through T-D57' DECISIONS.md` returns one match (Q7's new trailing sentence).
- `grep -c '^## Phase ' ROADMAP.md` returns the prior count + 4 (Phase 19, 20, 21, 22 added).
- `grep -c '^## Phase ' CHECKLIST.md` returns the prior count + 4 (Phase 19, 20, 21, 22 added).
- `grep -c '_Slice splits land when this phase' CHECKLIST.md` returns exactly 4.
- `git status` shows `docs/_meta/throughline/prompts/2026-05-26-doc-session-5-phase-22-and-scaffolding.md` as `deleted`.
- `git diff --stat main...HEAD` shows exactly the files in the manifest above and nothing else.
- The new handover file exists under `docs/_meta/throughline/handovers/` with the merge date in its filename.
- **CODE_SPEC.md is unchanged** (zero diff lines against main for that file).

---

## 10. End-of-session signal

When CI is green and Gitar review is clean, the PR merges automatically per the established workflow. Do not pre-announce. The spec author reviews the PR description as plain-language future-self review.

After Session 5 merges, the five-session doc-authoring stream is complete. All doc prerequisites for Phases 19, 20, 21, 22 are on `main`; the four build phases can begin in linear order (Phase 19 → Phase 20 → Phase 21 → Phase 22).
