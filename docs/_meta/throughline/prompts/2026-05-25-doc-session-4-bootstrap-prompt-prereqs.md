# Session 4 — Phase 21 doc prerequisites (bootstrap prompt and Claude Code invocation)

## Mission

You are the Session 4 instance of the Throughline doc-authoring stream. This slice is **doc-only** — no code, no migrations, no schema changes, no fixtures. You will introduce three anchors (T-D55, T-D56, C-D21) covering the Phase 21 producer-side prerequisites (where the bootstrap prompt template lives in the repo, how Throughline invokes Claude Code, and the implementation surfaces for both). You will add a SPEC bootstrap-prompt subsection (working assumption §7.28 — verify against live SPEC structure before placing), update the SPEC §14 anchor index with two new rows (T-D55, T-D56), append C-D21 to CODE_SPEC.md, amend `docs/.throughline-schema.md` with a Throughline-managed transient files section, flip the trailing forward-pointer on `WN-clone-Q5` to a back-reference now that T-D55 exists, update the trailing forward-pointer in §7.27 to name §7.28, and delete this very prompt file as part of the same commit.

Session 3 (merged 2026-05-25) added T-D53, T-D54, C-D20, SPEC §7.27, and flipped WN-clone-Q2 / WN-clone-Q3. Of the remaining three working-note forward-pointers (Q5, Q6, Q7), Q5 realises in Phase 21 — this session realises it. The other two (Q6, Q7) realise in Phase 22 / cross-phase and stay as forward-pointers untouched.

## Self-delete contract

This prompt file lives at `docs/_meta/throughline/prompts/2026-05-25-doc-session-4-bootstrap-prompt-prereqs.md`. As part of your single doc-work commit, **delete this file**. After Session 4 merges, the prompt is gone from `main`; only git history retains it. Do not move it, do not archive it, do not soft-delete — `git rm` it in the same commit as the rest of the doc work.

## Authority and reading order

Before you draft anything, read in this order:

1. `SESSION_START.md` — the discipline floor. The "anchor convention" rule says don't invent anchors mid-session — but **T-D55, T-D56, and C-D21 are pre-authorised by the spec author in this prompt**. The exact anchor IDs and bodies you are about to write are below; you transcribe them.
2. The most recent handover (`docs/_meta/throughline/handovers/2026-05-25-phase-20-bootstrap-server-prereqs.md`). This is the live state at the end of Session 3.
3. `SPEC.md` §7.26, §7.27, and §14. §7.27 is the existing bootstrap subsection that Session 3 added; the new bootstrap-prompt subsection lands immediately after it (working assumption §7.28). §14 carries the anchor index whose row format you must match — read the T-D53 / T-D54 rows in particular (both Session-3-dated 2026-05-25) so the two rows you add fit existing tone. §7.27 carries a trailing forward-pointer that you will update — see §8 below.
4. `CODE_SPEC.md` C-D19 and C-D20. C-D20 is the closest format precedent for C-D21 (multi-surface implementation anchor that cites multiple T-D and prior C-D anchors); C-D20 is the current last anchor. C-D21 lands immediately after C-D20 in the sequence.
5. `DECISIONS.md` T-D4, T-D49, T-D51, T-D52, T-D53, T-D54, and `WN-clone-Q5`. T-D51–T-D54 (Session-2 and Session-3 dated 2026-05-25) are the closest precedents for the anchor shape — they use the `## T-D<n> — Title` h2 heading with three metadata bullets (`Date`, `Status`, `Sections affected`), then `### Decision`, `### Context`, `### Rationale`, `### Implications` h3 subsections. **Match that shape exactly.** T-D4 is the secrets-stay-in-backend-config decision (cited by T-D55 / T-D56 / C-D21). T-D49 is the bundle §6 grammar decision referenced by T-D55. WN-clone-Q5 is the working note T-D55 resolves; you flip its trailing pointer.
6. `docs/.throughline-schema.md` — the existing schema doc Session 2 introduced. You will amend it with a "Throughline-managed transient files" section per §11 below. Read it for tone and section structure before drafting the amendment.
7. `packages/backend/src/inbox/watcher.ts`, `packages/backend/src/inbox/worker.ts`, `packages/backend/src/methodology/loader.ts`, `packages/backend/src/dump-zone/extractor.ts`, and `packages/backend/src/bootstrap/derive-id.ts` (if present from C-D20's Phase 20 build) — the existing precedents cited by T-D55 / T-D56 / C-D21. Read them for shape only; you are not editing them.

If you discover that any live file has shifted such that the placements named in this prompt no longer fit (e.g. the §14 table no longer ends at T-D54, T-D55 or T-D56 are already taken, C-D20 is no longer the last C-D anchor, §7.27 has been renumbered, the WN-clone-Q5 trailing forward-pointer reads differently than what §10 expects), **halt and surface** before drafting anything. Do not silently adapt.

## Constraints and discipline

- **Branch:** `claude/throughline-doc-session-4-bootstrap-prompt-prereqs`. Create on a fresh branch from `main` after fetching.
- **Single commit** on the slice's branch. The handover file (see file-touch manifest) lands in the same commit, per `HANDOVER_TEMPLATE.md`'s authoring rule. The deletion of this prompt file is part of the same commit.
- **No code, no migrations, no schema, no fixtures.** This PR is doc-only.
- **Verbatim transcription is literal.** The three pre-drafted blocks below (T-D55 body, T-D56 body, C-D21 body) are transcribed character-for-character. If during transcription you spot a factual or phrasing concern, **halt and surface to the spec author** — do not adapt silently.
- **Outline-only content is yours to draft.** The new SPEC bootstrap-prompt subsection prose is specified by content beats (§7 below); you draft it to fit the existing terse, decision-oriented, methodology-agnostic tone (T-D48). Match §7.26 / §7.27 voice. ~250–300 words.
- **Schema-doc amendment is yours to draft.** The Throughline-managed transient files section in `docs/.throughline-schema.md` is specified by content beats (§11 below); you draft it to fit the existing schema-doc voice.
- **Confirm live placements before drafting prose.** SPEC §14 row position (after T-D54), T-D55 / T-D56 sequencing in DECISIONS.md (after T-D54), C-D21 sequencing in CODE_SPEC.md (after C-D20), the new bootstrap-prompt subsection sequencing in SPEC.md (working assumption §7.28 — verify against live SPEC structure), the §7.27 trailing forward-pointer update target.
- **Use the run-date convention.** Every `<session-4-run-date>` placeholder in the pre-drafted blocks and back-reference flips below is replaced with the calendar date you actually commit and merge. Same convention Sessions 2 and 3 used.
- **Auto-continue on green CI + clean Gitar review** per the established workflow. Open the PR at slice close; do not pre-announce.
- **No file outside the file-touch manifest below is modified.**

## File-touch manifest (closed list)

You may modify only:

- `DECISIONS.md` — append T-D55 body; append T-D56 body; flip `WN-clone-Q5` trailing sentence to back-reference T-D55.
- `SPEC.md` — insert the new bootstrap-prompt prose subsection after §7.27 (working assumption §7.28; verify); add two new rows to the §14 table after T-D54; update the §7.27 trailing forward-pointer to name the new subsection.
- `CODE_SPEC.md` — append C-D21 body after C-D20.
- `docs/.throughline-schema.md` — amend with a new "Throughline-managed transient files" section per §11 below.
- `docs/_meta/throughline/handovers/<merge-date>-phase-21-bootstrap-prompt-and-invocation-prereqs.md` — new handover, written per `HANDOVER_TEMPLATE.md`, in the same commit.
- `docs/_meta/throughline/prompts/2026-05-25-doc-session-4-bootstrap-prompt-prereqs.md` — **delete this file** (`git rm`) in the same commit. The prompt is single-use; once Session 4 merges, it should not exist on `main`.

**Observed but do not fix:** if the line at `CODE_SPEC.md:9` still says T-D anchors "remain canonical at" some count below the post-Session-4 total, surface it in the PR description as observed — Sessions 2 and 3 already noted this is a separate-slice cleanup, scoped out of this PR.

---

## 1. Pre-drafted verbatim block — T-D55

Append to `DECISIONS.md` immediately after T-D54, in the same shape and tone as T-D51–T-D54 (h2 heading, three metadata bullets, four h3 subsections). Transcribe character-for-character, with `<session-4-run-date>` replaced by the actual commit / merge date. Halt and surface if anything reads off.

**BEGIN T-D55 (verbatim transcription) ↓**

## T-D55 — Bootstrap prompt is a repo-owned generic template at `packages/backend/src/bootstrap/prompt-template.md`; bundle-aware via runtime bundle-read, not Throughline-side templating

- **Date:** <session-4-run-date>
- **Status:** active — to be implemented in Phase 21, resolves WN-clone-Q5
- **Sections affected:** 7.28, 14

### Decision
The bootstrap prompt template is a single repo-owned markdown file at `packages/backend/src/bootstrap/prompt-template.md`. The Throughline repo ships and maintains exactly one prompt template; per-bundle prompts are explicitly rejected — they would shift maintenance burden onto every external bundle author for a feature most users run once (WN-clone-Q5).

The template is generic. Bundle-awareness is achieved at run time by the prompt instructing Claude Code to read the project's resolved bundle file directly (at the path Throughline supplies as part of the prompt's parameter block) and walk its §2–§11 itself. The template does NOT carry `{{section-N}}`-style placeholders, and Throughline does NOT run a bundle-section extractor that inlines bundle sections into the prompt; the bundle grammar (T-D49 and predecessors) is plain h2/h3 markdown that an LLM with file-read access walks unaided. Mirrors the dump-zone extractor's per-bundle parameter-injection posture (`packages/backend/src/dump-zone/extractor.ts`), scaled to a larger payload where read-the-file beats extract-and-inline.

The prompt template carries:

- A preamble describing the bootstrap task (produce a structured import file matching the T-D53 shape against the bound bundle's policy).
- Instructions to read the bound bundle file and apply its §2 project layout, §5 lifecycle, §6 communication-model grammar, §7 items policy, etc. as extraction policy.
- The bootstrap-id derivation rules per source type (T-D54: `decision:<anchor-id>`, `roadmap:phase-<n>`, `handover:<filename>`, `checklist:<sha256-16-of-normalized-text>`, `override:<user-slug>`) and the `<!-- @bootstrap-id: my-slug -->` override convention.
- The bootstrap import file's required and optional fields per row, per entity type (T-D53), and the explicit exclusions (secrets per T-D4, audit history, embeddings, settings, methodology bindings).
- Graceful-degradation guidance: bundles without certain sections, repos without ROADMAP.md / CHECKLIST.md, handover directories absent — surface as fewer rows, not failure (informed by WN-clone-Q7).

The only Throughline-side templating is a small fixed parameter block prepended to the template body at render time: the resolved bundle file path (via the existing three-arm resolver in `packages/backend/src/methodology/loader.ts` per C-D14 / C-D19), the canonical repo root, and the declared output file path (`.throughline/bootstrap-output.json` per T-D56). No general-purpose templating engine is introduced; the parameter block is a fixed-shape header rendered by string-substitution.

### Context
WN-clone-Q5 already settled the high-level shape — one prompt, bundle parameterises at run time, mirroring the dump-zone extractor pattern. The implementation surfaces — where the file lives in the repo, how the bundle is incorporated, what specifically the template carries vs what it pushes onto Claude Code's bundle-reading — were deferred to this phase. Pinning those choices ahead of the Phase 21 build prevents the prompt template landing in an arbitrary location and prevents Throughline shipping a templating engine the spec does not require.

### Rationale
- **Co-located with bootstrap code.** The prompt template is a runtime artefact loaded by Throughline at init time. `packages/backend/src/bootstrap/derive-id.ts` (per C-D20) already lives at this path; co-location follows Throughline's pattern of placing resource files next to the code that loads them — the bundle-parser modules adjacent to their grammar code is the nearest precedent.
- **Not in `docs/_meta/throughline/prompts/`.** That directory is ephemeral by convention — session prompts self-delete after each session, and the directory does not exist on main between sessions. A durable template alongside ephemeral session prompts would mix two lifecycles in one directory and dilute the "this directory is for session prompts that get cleaned up" signal.
- **Runtime bundle-read over Throughline-side section extraction.** The bundle's narrative sections (§2 project layout, §5 lifecycle, §6 communication model, §7 items) are many KB of prose. Templating those in would mean Throughline ships a bundle-section extractor for a single consumer, and the prompt template churns whenever the bundle grammar evolves. Pointing Claude Code at the file is simpler and stable; the bundle grammar is plain markdown that an LLM with file access walks unaided.
- **Fixed parameter header is the right templating dose.** The bundle file path, repo root, and output file path vary per project and cannot be hard-coded into the template. Prepending them as a small fixed-shape parameter block at render time is the minimum templating that delivers the use case without growing a general-purpose engine.

### Implications
- Implementation surfaces (the template loader, the render endpoint, the parameter-block injection point, the chokidar watcher, the archive / quarantine convention, the SettingsView init block) live in C-D21.
- Bundle evolution does not churn the prompt template — only the bundle file does. The template's only coupling to the bundle is the instruction "read the bundle at this path and apply its sections as extraction policy."
- A future per-bundle prompt override (a bundle author wishing to ship their own prompt template) is explicitly out of scope — it would re-introduce the maintenance burden WN-clone-Q5 rejected. If a future user need surfaces, it lands as a separate decision.
- The template ships under version control like any other code artefact; edits to the prompt are reviewable diffs against `packages/backend/src/bootstrap/prompt-template.md`.

**END T-D55 ↑**

---

## 2. Pre-drafted verbatim block — T-D56

Append to `DECISIONS.md` immediately after T-D55. Transcribe character-for-character, with `<session-4-run-date>` replaced by the actual commit / merge date. Halt and surface if anything reads off.

**BEGIN T-D56 (verbatim transcription) ↓**

## T-D56 — Claude Code invocation contract: user-driven invocation, Throughline watches `.throughline/bootstrap-output.json` via chokidar; subprocess-spawning explicitly deferred

- **Date:** <session-4-run-date>
- **Status:** active — to be implemented in Phase 21
- **Sections affected:** 7.28, 14

### Decision
Throughline does not spawn Claude Code as a subprocess. The invocation contract between Throughline and Claude Code is file-mediated: Throughline writes the rendered prompt to a known path under the project's `.throughline/` directory and declares the expected output path in the prompt's parameter block; the user invokes Claude Code against the prompt in their normal environment; Claude Code writes the bootstrap import file to the declared output path; Throughline detects the file via a chokidar watcher and hands it to the Phase 20 ingest endpoint.

Concretely:

- Throughline's render endpoint (C-D21) renders the prompt template (T-D55) against the project's resolved bundle and writes `<repo_path>/.throughline/bootstrap-prompt.md`. The expected output path `<repo_path>/.throughline/bootstrap-output.json` is declared in the prompt's parameter block; Claude Code is instructed to write its result there.
- The user invokes Claude Code in their normal CLI / IDE environment, passing it the rendered prompt — the prompt itself includes the read-the-bundle instructions and the write-here output path.
- A backend-side chokidar watcher (refcounted per project, mirroring the existing `packages/backend/src/inbox/watcher.ts` and `packages/backend/src/md-ingest/watcher.ts` idiom) detects `bootstrap-output.json` write completion and routes the file to the Phase 20 ingest path (`POST /api/projects/:id/import` per C-D20).
- After successful ingest, the file is archived to `.throughline/bootstrap-archive/<timestamp>-bootstrap-output.json`, mirroring the inbox worker's archive-on-success pattern (`packages/backend/src/inbox/worker.ts`). Failures move the file to `.throughline/bootstrap-quarantine/<timestamp>-bootstrap-output.json` with a sibling `<timestamp>-bootstrap-output.error.json` carrying the validation error so the user can fix and re-run.
- Re-bootstrap is the same flow re-run: regenerating the rendered prompt is a no-op for identity (the template is unchanged); writing a new `bootstrap-output.json` triggers the same watcher path; T-D54's idempotent upsert handles row classification across new / reimported / conflicted / stale states.

Subprocess-spawning Claude Code from the backend is explicitly deferred. Every existing subprocess invocation in the backend — `packages/backend/src/github/local-git.ts`, `packages/backend/src/semble/client.ts`, `packages/backend/src/methodology/gates/checks.ts`, `packages/backend/src/methodology/gates/hook-installer.ts` — targets short-running deterministic-output tools with one-shot `execFile` + `promisify`. Claude Code is a long-running interactive agent with the user's auth context, tool-use approvals, and streaming output that does not fit this idiom; bridging it would be a phase of work in its own right and is not required for the v1 invocation contract.

Manual paste is the floor and is NOT the contract — the file-watch path is the contract, and clone-and-go's UX cost is exactly one extra command for the user to run.

### Context
The producer side of the bootstrap pipeline — Phase 21's "Claude Code emits an import file against a user-owned repo" — needs a fixed invocation contract before Throughline's init flow can render a prompt with a known output path, and before the prompt itself can instruct Claude Code where to write. WN-clone-Q5 settled the prompt shape (one generic template, bundle-aware at run time) but did not address invocation; this anchor settles the invocation half of the producer side. No prior working note covers invocation, so T-D56 stands on its own without a `resolves` line.

### Rationale
- **Direct precedent in the repo.** `packages/backend/src/inbox/watcher.ts` + `packages/backend/src/inbox/worker.ts` is the existing "Claude Code writes a file, Throughline ingests" pattern — already in production for transcript ingestion via the `~/.throughline-inbox` directory. Bootstrap-output is the same shape with a different output path and a different downstream consumer (Phase 20's ingest endpoint instead of the transcript router).
- **User's Claude Code, not Throughline's.** The user's local Claude Code install carries their auth, their model entitlements, their tool permissions. Subprocess-spawning from the backend would either inherit the user's environment fragilely or require re-doing auth on the backend side. File-mediated handoff respects the boundary cleanly.
- **Bootstrap runs rarely.** Bootstrap fires once per fresh bind, occasionally on re-bootstrap when the bundle evolves. The UX gap between "click a button" and "run one command in your normal Claude Code environment" is small relative to the engineering cost of bridging it.
- **`.throughline/` is the right surface.** Per T-D51, `.throughline/` carries config; secrets stay out (T-D4). Bootstrap prompt and output land in `.throughline/` because they are init-time transient artefacts adjacent to project configuration — the rendered prompt is regenerated each invocation, and the output file is archived after ingest.

### Implications
- The `.throughline/` directory's contract extends to carry bootstrap-init transient files (`bootstrap-prompt.md`, `bootstrap-output.json`, `bootstrap-archive/`, `bootstrap-quarantine/`). The `docs/.throughline-schema.md` schema doc gains a transient-files section documenting these as Throughline-managed (not user-authored), with a Throughline-managed `.throughline/.gitignore` so transient ingest state never enters the user's git history.
- The watcher refcounts per project (mirroring the existing `inbox/watcher.ts` and `md-ingest/watcher.ts` idiom). Watcher lifecycle ties to project lifecycle: registered on render-endpoint first call for a project, unregistered on project delete.
- Subprocess-spawning Claude Code remains a future polish path; should Throughline later grow that infrastructure, T-D56 is amended, not contradicted — the file-watch contract is the v1 floor.
- Implementation surfaces (the render endpoint, the watcher, the worker, the archive / quarantine convention, the init UX block) live in C-D21.

**END T-D56 ↑**

---

## 3. Pre-drafted verbatim block — C-D21

Append to `CODE_SPEC.md` immediately after C-D20, before whatever immediately follows it (verify live structure). Match C-D20's heading format and section organisation (h2 heading, `Status` + `Cites` metadata bullets, `### Decision`, `### Rationale`, `### Implications` h3 subsections; no `Context` subsection on C-D anchors per C-D14–C-D20 precedent). Transcribe character-for-character. Halt and surface if anything reads off.

**BEGIN C-D21 (verbatim transcription) ↓**

## C-D21 — Bootstrap producer surfaces: prompt template, render endpoint, file watcher, archive/quarantine worker, re-bootstrap, init UX block

- **Status:** active (implementation-only)
- **Cites:** T-D55, T-D56; T-D4, T-D51, T-D53, T-D54; C-D14, C-D19, C-D20

### Decision
Phase 21 builds six surfaces that together realise the bootstrap producer side. The split is template / render / watcher / worker / re-bootstrap / UX — six named pieces with one canonical location each.

- **Prompt template.** `packages/backend/src/bootstrap/prompt-template.md` (per T-D55). Single repo-owned generic markdown file. Loaded at run time by the render endpoint; never edited per-bundle. Sits adjacent to `packages/backend/src/bootstrap/derive-id.ts` (per C-D20).
- **Render endpoint.** `POST /api/projects/:id/bootstrap/render` reads the prompt template, prepends a small fixed parameter block (resolved bundle file path via the existing three-arm resolver in `packages/backend/src/methodology/loader.ts` per C-D14 / C-D19, canonical repo root, declared output path `<repo_path>/.throughline/bootstrap-output.json`), writes the rendered prompt to `<repo_path>/.throughline/bootstrap-prompt.md`, and returns the file path plus a copy-pasteable invocation command for the user. Repo root is repo-canonicalised (per C-D19's normalisation) before injection so the output file cannot be redirected outside the project's repo.
- **Bootstrap-output watcher.** `packages/backend/src/bootstrap/watcher.ts` is a chokidar watcher mirroring the inbox watcher's shape (`packages/backend/src/inbox/watcher.ts`). Refcounted per project: registered on render-endpoint first call for a project, unregistered on project delete. Watches `<repo_path>/.throughline/bootstrap-output.json`. On detected write completion, hands off to the worker.
- **Archive / quarantine worker.** `packages/backend/src/bootstrap/worker.ts` mirrors `packages/backend/src/inbox/worker.ts`. Routes the detected output file to the Phase 20 ingest path (`POST /api/projects/:id/import` per C-D20). On successful ingest, moves the file to `<repo_path>/.throughline/bootstrap-archive/<timestamp>-bootstrap-output.json`. On ingest failure, moves to `<repo_path>/.throughline/bootstrap-quarantine/<timestamp>-bootstrap-output.json` and writes a sibling `<timestamp>-bootstrap-output.error.json` carrying the validator error.
- **Re-bootstrap.** Re-running the render endpoint regenerates `bootstrap-prompt.md`; the user re-invokes Claude Code; a new `bootstrap-output.json` write triggers the same watcher path. T-D54's idempotent upsert handles row classification (new / reimported / conflicted / stale); no special re-bootstrap code path is required.
- **Init UX block.** SettingsView gains a per-project bootstrap block (alongside the C-D19 `.throughline/` missing-config component) surfacing bootstrap state: "no bootstrap output yet" / "ingested at `<timestamp>`: N new, M reimported, K conflicts" with a copy-paste invocation command. The block also surfaces quarantine state when present, linking the user to the error file.

### Rationale
Six surfaces is the minimum that delivers a bootstrap-producer cycle end-to-end against the existing backend without introducing a second AnthropicClient call site (Throughline does not call Anthropic for the bootstrap prompt; the user's Claude Code does), a backend-side subprocess for Claude Code (T-D56 explicitly defers), or any new persistence layer. The render endpoint, watcher, and worker each mirror an existing precedent: render reuses the bundle-resolver from C-D14 / C-D19; watcher mirrors `inbox/watcher.ts`; worker mirrors `inbox/worker.ts`. The `.throughline/` directory surface extension is additive — the directory already carries `project.json` and `bundle.md` per T-D51; bootstrap transient files (prompt, output, archive, quarantine) land alongside without renaming or restructuring.

### Implications
- The `docs/.throughline-schema.md` schema doc gains a "Throughline-managed transient files" section documenting `bootstrap-prompt.md`, `bootstrap-output.json`, `bootstrap-archive/`, `bootstrap-quarantine/`, and a Throughline-managed `.throughline/.gitignore` covering the transient paths so they never enter the user's git history.
- The bootstrap watcher and worker share the `appendAudit` audit pattern (`packages/backend/src/audit/log.ts`); per-row audit entries land via the ingest endpoint per C-D20. The producer side adds no new audit field shape.
- Quarantine files persist until the user clears them; the SettingsView init block is the user's surface for noticing and clearing them.
- Render-endpoint security: both the rendered prompt path and the declared output path live under `<repo_path>/.throughline/`; the repo root is canonicalised before injection so the output file cannot be redirected outside the project's repo. The render endpoint never writes outside `<repo_path>/.throughline/`.
- Future polish (subprocess-spawning Claude Code) lands as additional C-D anchors when T-D56 is amended; the file-watch path stays as the v1 floor either way.

**END C-D21 ↑**

---

## 4. Outline-only content — new SPEC bootstrap-prompt subsection

Draft this yourself, ~250–300 words, matching §7.26 / §7.27's voice (terse, decision-oriented, methodology-agnostic — T-D48 tone). Placement working assumption: `§7.28 — Bootstrap prompt and Claude Code invocation`. **Verify against live SPEC structure first**; if §7.27 is no longer the current last subsection under §7, or the numbering scheme has shifted, halt and surface placement before drafting.

Required content beats (order is a suggestion; structure to fit):

- **What the bootstrap prompt is, as a user-facing capability.** The producer side of bootstrap (§7.27 is the consumer side). A repo-owned generic markdown template at `packages/backend/src/bootstrap/prompt-template.md` (T-D55) that Throughline renders against the project's bound methodology bundle and writes to `.throughline/bootstrap-prompt.md`. The user invokes Claude Code against the rendered prompt; Claude Code emits the import file that §7.27 ingests.
- **How invocation works at the UX level.** User-driven, file-mediated (T-D56). Throughline renders the prompt and surfaces a copy-pasteable invocation command; the user runs Claude Code in their normal environment; Claude Code writes the bootstrap import file to `.throughline/bootstrap-output.json`; Throughline detects the file via a chokidar watcher and routes it to the Phase 20 ingest endpoint. Subprocess-spawning Claude Code from Throughline is explicitly deferred (T-D56).
- **Bundle-awareness mechanism.** The template is generic; bundle-awareness happens at run time by the prompt instructing Claude Code to read the resolved bundle file directly and walk its sections itself (T-D55). The only Throughline-side templating is a small fixed parameter block (bundle path, repo root, output path) prepended at render time.
- **Archive and quarantine.** Successful ingest archives the output file under `.throughline/bootstrap-archive/`; failed ingest quarantines under `.throughline/bootstrap-quarantine/` with a sibling `.error.json` (C-D21). The SettingsView init UX block surfaces both states.
- **What the prompt section does NOT do.** Carry per-bundle prompts (one prompt for all bundles per WN-clone-Q5). Spawn Claude Code (deferred per T-D56). Touch secrets (T-D4 — secrets stay in backend config, never under `.throughline/`).
- **Cross-references** to T-D55, T-D56, T-D4 (secrets stay out), T-D53 (the import file the prompt produces), T-D54 (re-run idempotency that re-bootstrap relies on), C-D20 (the ingest endpoint), C-D21 (implementation surfaces), and `docs/.throughline-schema.md` (the schema doc's new transient-files section).
- **Update §7.27's trailing forward-pointer** in the same edit pass — see §8 below.

---

## 5. SPEC §14 anchor-index row additions

Add two new rows to the §14 table after the existing T-D54 row. Match the existing row format (the three-column shape `| Anchor | Subject | Section |`). The `Section` cell points to the section number you confirmed in step 4 above (working assumption `7.28`).

**BEGIN row additions (verbatim transcription) ↓**

| T-D55 | Bootstrap prompt is a repo-owned generic template at `packages/backend/src/bootstrap/prompt-template.md`; bundle-aware via runtime bundle-read, not Throughline-side templating | 7.28 |
| T-D56 | Claude Code invocation contract: user-driven invocation, Throughline watches `.throughline/bootstrap-output.json` via chokidar; subprocess-spawning explicitly deferred | 7.28 |

**END row additions ↑**

If the bootstrap-prompt subsection landed at a number other than 7.28, edit the `Section` column on both rows to match before transcribing.

---

## 6. Back-reference flip

One trailing-sentence rewrite in `DECISIONS.md`. The current text in WN-clone-Q5 ends with a forward-pointer (`Resolved by → T-D55 (Phase 21).`). Flip it to a back-reference, matching the shape Sessions 2 and 3 used for WN-clone-Q1 / WN-clone-Q2 / WN-clone-Q3 / WN-clone-Q4.

**BEGIN flip (WN-clone-Q5) ↓**

Find: `Resolved by → T-D55 (Phase 21).`
Replace with: `Resolved by T-D55 (introduced <session-4-run-date>).`

**END flip ↑**

Leave `WN-clone-Q6` and `WN-clone-Q7` untouched — those forward-pointers (T-D57, and the cross-cutting Q7) realise in Phase 22 / cross-phase, future doc-session work.

---

## 7. SPEC §7.27 forward-pointer update

§7.27 currently ends with a trailing sentence that forward-points to a future bootstrap-prompt section. Update that sentence to name the new §7.28 subsection now that it exists.

**BEGIN §7.27 trailing-pointer update ↓**

Find: `The producer side — Phase 21's Claude Code session against the user-owned repo — is separately phased and documented in the (forthcoming) bootstrap-prompt section.`
Replace with: `The producer side — Phase 21's Claude Code session against the user-owned repo — is documented in §7.28 (bootstrap prompt and Claude Code invocation).`

**END update ↑**

If the live §7.27 text reads differently (e.g. the trailing sentence was already reworded in a later edit), halt and surface — do not silently adapt the find/replace target.

---

## 8. Outline-only content — `docs/.throughline-schema.md` transient-files amendment

Append a new section to `docs/.throughline-schema.md`, matching the existing schema-doc voice. Working title: **"Throughline-managed transient files"**. Place it after the existing `.throughline/project.json` and `.throughline/bundle.md` schema sections, before any closing matter.

Required content beats:

- **Distinction.** `.throughline/project.json` and `.throughline/bundle.md` are user-authored config files. The transient files documented in this section are Throughline-managed — written by Throughline's bootstrap-render endpoint or by Claude Code's bootstrap invocation, never edited by the user.
- **`bootstrap-prompt.md`** — written by Throughline's bootstrap-render endpoint (C-D21). The rendered prompt (T-D55) with the parameter block prepended. Regenerated on each render; not persistent state.
- **`bootstrap-output.json`** — written by Claude Code's bootstrap invocation (T-D56). The structured import file (per T-D53). Consumed and removed (archived) by Throughline's bootstrap watcher.
- **`bootstrap-archive/<timestamp>-bootstrap-output.json`** — Throughline moves successfully-ingested output files here for forensic reference (C-D21). Named with the ingest timestamp.
- **`bootstrap-quarantine/<timestamp>-bootstrap-output.json`** + sibling **`<timestamp>-bootstrap-output.error.json`** — Throughline moves failed-ingest output files here with the validator error as a sibling file (C-D21). User clears these manually after fixing the underlying issue.
- **`.throughline/.gitignore`** — Throughline-managed `.gitignore` that covers `bootstrap-prompt.md`, `bootstrap-output.json`, `bootstrap-archive/`, and `bootstrap-quarantine/` so transient ingest state never enters the user's git history. The user-authored config files (`project.json`, `bundle.md`) are explicitly NOT gitignored — they belong in git.

Cross-references: T-D55, T-D56, T-D53, C-D21. Note that this section documents file paths and ownership, not field schemas; the structured shape of `bootstrap-output.json` itself is documented by T-D53.

---

## 9. PR description template

Open the PR at slice close (auto-continue on green CI + clean Gitar review). Title:

```
Doc session 4 — Phase 21 doc prerequisites (bootstrap prompt and Claude Code invocation)
```

Body (adapt; the spec author reads this as plain-language future-self review):

```
Introduces three anchors (T-D55, T-D56, C-D21) covering the Phase 21 (bootstrap
producer side) doc prerequisites. Adds a SPEC bootstrap-prompt subsection at
§7.28, two §14 index rows, the C-D21 entry, and amends docs/.throughline-schema.md
with a Throughline-managed transient files section. Flips WN-clone-Q5 trailing
sentence to a back-reference now that T-D55 exists, and updates §7.27's trailing
forward-pointer to name the new §7.28 subsection. Deletes the single-use prompt
artifact.

Doc-only — no code, no migrations, no schema (datastore-schema-wise; the
docs/.throughline-schema.md amendment is doc-only).

Key decisions recorded:
- T-D55 pins the bootstrap prompt template at packages/backend/src/bootstrap/
  prompt-template.md (co-located with the C-D20 derive-id.ts module). Bundle-
  awareness is at run time via the prompt instructing Claude Code to read the
  bound bundle directly; Throughline does not run a bundle-section extractor.
  Only a small fixed parameter block (bundle path, repo root, output path) is
  templated in at render time.
- T-D56 pins the invocation contract as user-driven and file-mediated, with a
  chokidar watcher on `.throughline/bootstrap-output.json` mirroring the existing
  inbox/watcher.ts + inbox/worker.ts pattern. Subprocess-spawning Claude Code
  from the backend is explicitly deferred — every existing backend subprocess
  invocation targets short-running deterministic-output tools, and Claude Code
  doesn't fit that idiom.
- C-D21 names six implementation surfaces (prompt template, render endpoint,
  watcher, archive/quarantine worker, re-bootstrap path, SettingsView init UX
  block) with one canonical location each. Each surface either reuses an
  existing precedent (bundle-resolver, inbox watcher/worker pattern) or is
  additive to the existing `.throughline/` directory contract.

Observed but not fixed: [if the CODE_SPEC.md:9 "remain canonical at N" line is
still stale, name it here — same as Sessions 2 and 3 noted].
```

---

## 10. Verification checklist

Run before opening the PR:

- `grep -c '^## T-D' DECISIONS.md` returns the prior count + 2.
- `grep -c '^## C-D' CODE_SPEC.md` returns the prior count + 1.
- `grep '| T-D55 |' SPEC.md` and `grep '| T-D56 |' SPEC.md` each return one row in the §14 table.
- `grep 'Resolved by → T-D55' DECISIONS.md` returns zero matches (forward-pointer gone).
- `grep 'Resolved by T-D55' DECISIONS.md` returns one match (back-reference in place).
- `grep -c 'Resolved by → T-D' DECISIONS.md` returns exactly 2 (Q6, Q7 forward-pointers remain).
- `grep '(forthcoming) bootstrap-prompt section' SPEC.md` returns zero matches (§7.27 forward-pointer updated).
- `grep '§7.28' SPEC.md` returns at least one match (the updated §7.27 forward-pointer, plus any cross-references in the new §7.28 prose).
- `git status` shows `docs/_meta/throughline/prompts/2026-05-25-doc-session-4-bootstrap-prompt-prereqs.md` as `deleted`.
- `git diff --stat main...HEAD` shows exactly the files in the manifest above and nothing else.
- The new handover file exists under `docs/_meta/throughline/handovers/` with the merge date in its filename.

---

## 11. End-of-session signal

When CI is green and Gitar review is clean, the PR merges automatically per the established workflow. Do not pre-announce. The spec author reviews the PR description as plain-language future-self review.

After Session 4 merges, the doc-authoring stream is four of five sessions deep. Session 5 (Phase 22 doc prerequisites — discipline-drift on-bind / WN-clone-Q6, plus T-D57 minting) is the remaining slice.
