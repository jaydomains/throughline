# Session 2 — Phase 19 doc prerequisites (clone-and-go)

## Mission

You are the Session 2 instance of the Throughline doc-authoring stream. This slice is **doc-only** — no code, no migrations, no schema changes, no fixtures. You will introduce three anchors (T-D51, T-D52, C-D19), add a SPEC clone-and-go capability subsection, ship a new `docs/.throughline-schema.md` schema file, update the SPEC §14 anchor index with two new rows, flip the trailing forward-pointers on `WN-clone-Q1` and `WN-clone-Q4` to back-references now that the anchors they point to exist, and delete this very prompt file as part of the same commit.

Session 1 (merged 2026-05-24) added `WN-clone-Q1` through `WN-clone-Q7` to `DECISIONS.md` recording resolutions surfaced by the bootstrap-and-onboarding diagnostic. Two of those forward pointers (Q1, Q4) realise in Phase 19 — this session realises them. The other five (Q2/Q3/Q5/Q6/Q7) realise in Phases 20–22 and stay as forward pointers untouched.

## Self-delete contract

This prompt file lives at `docs/_meta/throughline/prompts/2026-05-24-doc-session-2-clone-and-go-prereqs.md`. As part of your single doc-work commit, **delete this file**. After Session 2 merges, the prompt is gone from `main`; only git history retains it. Do not move it, do not archive it, do not soft-delete — `git rm` it in the same commit as the rest of the doc work.

## Authority and reading order

Before you draft anything, read in this order:

1. `SESSION_START.md` — the discipline floor. The "anchor convention" rule says don't invent anchors mid-session — but **T-D51, T-D52, and C-D19 are pre-authorised by the spec author in this prompt**. The exact anchor IDs and bodies you are about to write are below; you transcribe them.
2. The most recent handover: `docs/_meta/throughline/handovers/2026-05-24-phase-18-communication-model.md`. This is the live state at the end of Session 1.
3. `SPEC.md` §7.25 and §14. §7.25 is the existing subsection before §7.26 (which you will add). §14 carries the anchor index whose row format you must match — read T-D49 and T-D50 rows in particular (also dated 2026-05-24) so the two rows you add fit existing tone.
4. `CODE_SPEC.md` C-D14 and C-D18. C-D14 is the format precedent for C-D19; C-D18 is the current last anchor. C-D19 lands immediately after C-D18 in the sequence.
5. `DECISIONS.md` T-D4, T-D49, T-D50, `WN-clone-Q1`, `WN-clone-Q4`. T-D49 / T-D50 (both 2026-05-24) are the closest precedent for an anchor that resolves a working note and points forward to an implementation — they put "resolves WN-…" in the Status line and "implementation in C-D…" in the trailing Implications sentence. Match that shape exactly.

If you discover that any live file has shifted such that the placements named in this prompt no longer fit (e.g. §7.26 already exists for an unrelated reason, T-D51 is already taken, the §14 table no longer ends at T-D50), **halt and surface** before drafting anything. Do not silently adapt.

## Constraints and discipline

- **Branch:** `claude/throughline-doc-session-2-clone-and-go-prereqs`. Create on a fresh branch from `main` after fetching.
- **Single commit** on the slice's branch. The handover file (see file-touch manifest) lands in the same commit, per `HANDOVER_TEMPLATE.md`'s authoring rule. The deletion of this prompt file is part of the same commit.
- **No code, no migrations, no schema, no fixtures.** This PR is doc-only.
- **Verbatim transcription is literal.** The four pre-drafted blocks below (T-D51 body, T-D52 body, C-D19 body, schema file content) are transcribed character-for-character. If during transcription you spot a factual or phrasing concern, **halt and surface to the spec author** — do not adapt silently.
- **Outline-only content is yours to draft.** The SPEC §7.26 prose is specified by content beats; you draft it to fit the existing terse, decision-oriented, methodology-agnostic tone (T-D48). Match §7.23 / §7.25 voice. ~200–300 words.
- **Confirm live placements before drafting prose.** SPEC §14 row position (after T-D50), T-D51/T-D52 sequencing in DECISIONS.md (after T-D50), C-D19 sequencing in CODE_SPEC.md (after C-D18), §7.26 sequencing in SPEC.md (after §7.25).
- **Use the run-date convention.** Every `<session-2-run-date>` placeholder in the pre-drafted blocks and back-reference flips below is replaced with the calendar date you actually commit and merge. Same convention Session 1 used (2026-05-24 was its actual run date).
- **Auto-continue on green CI + clean Gitar review** per the established workflow. Open the PR at slice close; do not pre-announce.
- **No file outside the file-touch manifest below is modified.**

## File-touch manifest (closed list)

You may modify only:

- `DECISIONS.md` — append T-D51 body; append T-D52 body; flip `WN-clone-Q1` trailing sentence at line 1099; flip `WN-clone-Q4` trailing sentence at line 1111.
- `SPEC.md` — insert §7.26 prose subsection after §7.25; add two new rows to the §14 table after T-D50.
- `CODE_SPEC.md` — append C-D19 body after C-D18 (before `## 1. Process model`).
- `docs/.throughline-schema.md` — new file.
- `docs/_meta/throughline/handovers/<merge-date>-phase-19-clone-and-go-doc-prereqs.md` — new handover, written per `HANDOVER_TEMPLATE.md`, in the same commit.
- `docs/_meta/throughline/prompts/2026-05-24-doc-session-2-clone-and-go-prereqs.md` — **delete this file** (`git rm`) in the same commit. The prompt is single-use; once Session 2 merges, it should not exist on `main`.

**Observed but do not fix:** the line at `CODE_SPEC.md:9` that says T-D anchors "remain canonical at 48" is stale (was already stale after T-D49 / T-D50). Surface this in the PR description as observed, but do not touch it — that cleanup is a separate slice.

---

## Pre-drafted verbatim content

The four blocks below are transcribed verbatim into the destination files. Each block is delimited by explicit BEGIN / END markers; what lies between is the literal file content. Replace `<session-2-run-date>` with the actual calendar date you run.

---

### Block 1 — T-D51 anchor body

Destination: `DECISIONS.md`, appended after T-D50.

`==== BEGIN VERBATIM (T-D51) ====`

## T-D51 — `.throughline/` per-repo config convention; third bundle-resolution arm

- **Date:** `<session-2-run-date>`
- **Status:** active — to be implemented in Phase 19, resolves WN-clone-Q1
- **Sections affected:** 7.1, 7.2, 7.26

### Decision
A user-owned repo may carry a `.throughline/` directory at its root that holds the project's Throughline configuration alongside the repo's own code. The directory's v1 contents are documented in `docs/.throughline-schema.md`: a required `.throughline/project.json` (project config) and an optional `.throughline/bundle.md` (per-repo bundle). `.throughline/` is config only; no secrets (T-D4), no items, no sessions, no library, no audit log, no embeddings.

The bundle loader gains a third resolution arm. For a project's bound `bundle_id`, the resolution order is now:

1. `<bundle_path>/bundle.md` — explicit external path, when `bundle_path` is set on the project (current C-D14).
2. `<repo_path>/.throughline/bundle.md` — per-repo carve-out, when the project's repo carries one and `bundle_path` is unset.
3. `<install-root>/methodologies/<bundle_id>/bundle.md` — install-shipped default fallback (freeform, test-bundle).

The third arm is what makes a user-owned repo's discipline travel with the repo: a fresh clone of a repo carrying `.throughline/bundle.md` resolves to that bundle without the user manually setting `bundle_path` after binding. Arm 1 retains precedence so an explicitly-configured external path (e.g. a shared bundle directory across multiple repos) keeps overriding the in-repo file.

Out of scope for this decision: writing into `.throughline/` from Throughline (bootstrap-style imports, audit logs, item exports) is not part of `.throughline/`'s contract — that surface lives in later phases and uses different files outside `.throughline/`. The schema doc documents this explicitly.

### Context
The bundle externalisation refactor (handover `2026-05-16-bundle-externalisation-refactor.md`) removed user-owned bundles from Throughline's repo so the public codebase stays methodology-neutral. That convention bound Throughline's repo, not the user's. A user repo electing to keep its own discipline alongside its own code is a different concern — and is the path that makes clone-and-go work for any future user.

### Rationale
A repo-local convention with a fixed directory name lets a freshly-cloned repo carry enough configuration to bind to Throughline on first run without bespoke setup. Putting it at `.throughline/` (dotted, single name) matches established conventions (`.github/`, `.vscode/`) and signals tooling-config-not-source. The three-arm resolution preserves the existing two arms unchanged — externalisation (C-D14) and install-fallback (C-D3) — and inserts the new arm in the natural priority slot between them.

### Implications
A repo with `.throughline/bundle.md` and `bundle_path` set sees `bundle_path` win — explicit configuration overrides the carve-out, by design. A repo carrying `.throughline/bundle.md` whose bound `bundle_id` does not match the in-repo bundle's declared id is a project-create / project-update validation error (`bundle_id_mismatch`) so silent divergence cannot accrue. Implementation shape lives in C-D19.

`==== END VERBATIM (T-D51) ====`

---

### Block 2 — T-D52 anchor body

Destination: `DECISIONS.md`, appended after T-D51.

`==== BEGIN VERBATIM (T-D52) ====`

## T-D52 — `throughline init` requires the running backend; CLI does not write the datastore directly

- **Date:** `<session-2-run-date>`
- **Status:** active — to be implemented in Phase 19, resolves WN-clone-Q4
- **Sections affected:** 7.26, 10

### Decision
The `throughline init` CLI subcommand has a single write path: existing HTTP endpoints against the running backend (project create / update, secrets, future bootstrap). It does not open the SQLite datastore directly, does not import any backend modules that do, and does not embed schema knowledge.

On invocation the CLI probes `GET /api/health` against the configured local-loopback port. On any probe failure (connection refused, timeout, non-2xx) the CLI prints exactly:

> `Start the backend first: pnpm --filter @throughline/backend start`

and exits non-zero. On probe success the CLI reads the repo's `.throughline/project.json`, auto-detects `github_owner` / `github_repo` from the git remote if absent, and issues the bootstrap calls against the backend.

Out of scope for this decision: a `--start-backend` flag that would spawn the backend process itself is polish and is deferred — adding it later does not change this decision's shape, because the auto-spawn would only stand in for the manual `pnpm` command without altering the single-write-path invariant.

### Context
The clone-and-go shape (T-D51) requires a CLI surface for the first-touch bind step. The temptation to let the CLI write SQLite directly — "the backend is just a Node process, the CLI can be too" — would create a second write path that has to track every schema change. Discipline-drift between the two paths is the failure mode this avoids.

### Rationale
A single write path means every project carrying a Throughline binding lands through one set of validators (the HTTP endpoint handlers). A schema migration touches one writer; the CLI does not need to know SQLite, migration versions, or any backend-internal type. The `/health` probe with a fixed error string keeps the failure mode legible to the user: the next instruction is on screen, copy-paste runnable.

### Implications
The CLI subcommand lives in the backend package (`packages/backend/src/cli/`), so the backend's HTTP client is in-process — no extra dependency. The `init` flow's audit-log entries are written by the backend handlers it calls, not by the CLI; `actor` reflects the handler, with the CLI's invocation surfaced via the `trigger_context_json` shape the backend already supports (T-D24, T-D36). Implementation shape lives in C-D19.

`==== END VERBATIM (T-D52) ====`

---

### Block 3 — C-D19 anchor body

Destination: `CODE_SPEC.md`, appended after C-D18 and before `## 1. Process model`.

`==== BEGIN VERBATIM (C-D19) ====`

## C-D19 — Clone-and-go runtime: `.throughline/` reader, third bundle-resolution arm, `throughline init` CLI

- **Status:** active (implementation-only)
- **Cites:** T-D51, T-D52, T-D4; T-D41, T-D47; C-D3, C-D14

### Decision
Phase 19 builds eight surfaces that together realise clone-and-go. The split is bundle-resolution / per-repo config / CLI / UI / lifecycle — eight named pieces with one canonical location each.

- **Bundle loader third arm.** `packages/backend/src/methodology/loader.ts` (and the registry's `resolveBundle` / `hasBundle`) gain a `repo_path` parameter and try `<repo_path>/.throughline/bundle.md` between the `bundle_path` arm (C-D14) and the install-shipped fallback. The chokidar watcher refcounts the per-repo file the same way it refcounts external `bundle_path` files. The cached key for an in-repo bundle is its absolute resolved path, so the same repo opened twice resolves to one watch target.
- **`.throughline/project.json` init config reader.** `packages/backend/src/init/config-reader.ts` reads and validates the file against the schema documented in `docs/.throughline-schema.md`. Validation rejects unknown top-level keys (forward-compat by explicit version-bump, not silent acceptance), trims paths, and surfaces a structured `InitConfigError` discriminated union the CLI and UI both consume.
- **Git-remote auto-detection.** `packages/backend/src/init/git-remote.ts` shells `git remote get-url origin` under `repo_path` and parses `github_owner` / `github_repo` from the URL (SSH and HTTPS forms). Used by the CLI and the project-create endpoint when `.throughline/project.json` omits `github_owner` / `github_repo`. An unrecognised remote is a soft failure: the user fills the fields in the UI.
- **CLI `init` subcommand.** `packages/backend/src/cli/init/` is wired into `packages/backend/src/cli/index.ts`. Its only side effects are HTTP calls against the running backend (T-D52). The `/health` probe and the error string are hard-coded constants; the port reads from the backend's local-loopback config.
- **NewProjectModal `bundle_path` field.** The existing modal in `packages/frontend/src/components/NewProjectModal.tsx` surfaces the existing C-D14 column as an optional field. No new endpoint — the field rides the existing project-create payload.
- **SettingsView missing-config component.** `packages/frontend/src/views/SettingsView.tsx` gains a per-project block that surfaces whether `.throughline/` is absent, partial, or complete, with an explicit "re-read .throughline/" action. The block is the user's view of init state after the first bind.
- **Re-init flow.** The project-update endpoint accepts a `reinit_throughline: true` flag that re-reads `.throughline/project.json`, re-runs git-remote auto-detection, and updates only the fields the file supplies — never overwriting items, sessions, library entries, secrets (T-D4), or audit history. Re-init writes a single audit row of kind `project_reinit` with the diff.
- **Repo-path normalisation.** Project create and update normalise `repo_path` to an absolute, symlink-resolved canonical form before persisting. A second create attempt against an equivalent path collides on the existing project-id uniqueness check rather than producing two projects bound to the same repo.

### Rationale
Eight surfaces is the minimum that delivers a clone-and-go cycle (`git clone … && throughline init`) end-to-end against the existing backend, without introducing a second write path or migrating any existing convention. Putting all init-side code under `packages/backend/src/init/` and `packages/backend/src/cli/init/` keeps the new code one directory move away from removal if the spec author later reshapes init. Reusing the existing project-create / project-update endpoints means no new persistence layer learns about clone-and-go.

### Implications
- The bundle loader's existing `resolveBundle` signature gains an optional `repo_path` argument; callers without a repo context still resolve via arms 1 and 3. Project-create / project-update pass the project's `repo_path` through.
- `repo_path` normalisation runs once on write; the canonical form is what subsequent code sees. Existing rows are not back-filled by the migration-less Phase 19 — they normalise lazily on next update.
- The CLI ships inside the backend package (`packages/backend`), invocable via `pnpm --filter @throughline/backend exec throughline init`. A standalone install vector (e.g. `npm i -g`) is out of scope here; it can be added later without re-shaping the subcommand.
- Audit entries for init-side writes ride the existing handler audit paths (T-D36). The CLI never writes audit rows; the backend handlers do.
- Secrets (T-D4) remain backend-config only — `.throughline/` carries no key material, so `git diff .throughline/` is never a key-leak surface.

`==== END VERBATIM (C-D19) ====`

---

### Block 4 — `docs/.throughline-schema.md` (new file, complete content)

Destination: new file `docs/.throughline-schema.md`. Transcribe the content between BEGIN/END verbatim. The block contains a fenced JSON example; render it as a normal triple-backtick fenced block in the destination file.

`==== BEGIN VERBATIM (docs/.throughline-schema.md) ====`

# `.throughline/` directory schema

Per-repo configuration for clone-and-go. A user-owned repo carries a `.throughline/` directory at its root; Throughline reads it when the project is created or re-initialised against that repo.

Anchors: T-D51 (convention + third bundle-resolution arm), T-D52 (CLI write contract), T-D4 (secrets stay out), T-D41 / T-D47 (bundle binding), C-D3 (eleven-section bundle grammar), C-D14 (`bundle_path`), C-D19 (implementation surfaces).

---

## What `.throughline/` carries

Configuration only. No state, no secrets, no derived data.

| File | Required? | Purpose |
|---|---|---|
| `.throughline/project.json` | required | Project config — bundle id, optional bundle path, optional GitHub coordinates, optional project name. |
| `.throughline/bundle.md` | optional | Per-repo bundle file in the eleven-section grammar (C-D3). Resolves as the second arm of the bundle loader (T-D51). |

The directory may contain other files Throughline does not read; Throughline ignores them. A future minor version may declare additional files; unknown files are not an error.

---

## `.throughline/project.json` — fields

| Field | Required | Type | Default | Notes |
|---|---|---|---|---|
| `bundle_id` | required | string | — | Must match the `bundle_id` declared in `.throughline/bundle.md`'s §1 Identity, when that file is present. Mismatch fails project create/update with `bundle_id_mismatch` (C-D19). |
| `bundle_path` | optional | string (absolute or repo-relative) | unset | When set, takes precedence over `.throughline/bundle.md` (arm 1 of the loader, C-D14). Relative paths resolve against `repo_path`. |
| `github_owner` | optional | string | git-remote auto-detect | Auto-detected from `git remote get-url origin` if absent (C-D19). |
| `github_repo` | optional | string | git-remote auto-detect | Same as above. |
| `project_name` | optional | string | derived from repo directory name | Display name in the UI; never used as an identifier. |

Unknown top-level keys are rejected. Forward-compat is by deliberate version-bump, not silent acceptance.

Example:

[Render this as a triple-backtick fenced block with language `json` in the destination file:]

    {
      "bundle_id": "freeform",
      "project_name": "Acme widget service"
    }

---

## `.throughline/bundle.md` — when present

Same grammar as install-shipped bundles (C-D3): eleven canonical H2 sections, parser-dispatched, structural validation at load. The repo-local bundle file is fully equivalent to a `bundle_path`-resolved external file, except that it lives inside the repo and travels with it.

---

## What `.throughline/` does NOT carry

The following do not live in `.throughline/`:

- **Secrets** — Anthropic API keys, GitHub PATs, future credentials. Per T-D4 these live in backend configuration, never on disk under the repo. Putting secrets in `.throughline/` would make `git diff` and any repo backup a leak path.
- **Items, sessions, library entries** — these are state, persisted in the Throughline datastore (T-D3). The bootstrap surface for importing existing repo state into the datastore is a separate feature (Phase 20+) and uses different files outside `.throughline/`.
- **Audit log entries** — append-only state in the datastore (T-D36); never serialised to the repo.
- **Local embeddings, cost telemetry, drift signals, chat history, GitHub state cache** — all datastore-resident; not part of the config surface.

If a future surface needs a per-repo file that is not pure config (e.g. a bootstrap-import manifest), it lives outside `.throughline/` so the no-state invariant here is unconditional.

---

## See also

- T-D51 — `.throughline/` convention and third bundle-resolution arm
- T-D52 — CLI write contract (`throughline init` requires running backend)
- T-D4 — Secrets isolated from primary state
- T-D41, T-D47 — Repo-shipped bundles, freeform default, single bundle binding per project
- C-D3 — Eleven-section bundle grammar
- C-D14 — Per-project `bundle_path`
- C-D19 — Phase 19 implementation surfaces
- SPEC §7.26 — Clone-and-go (functional description)

`==== END VERBATIM (docs/.throughline-schema.md) ====`

Note on the JSON example in the schema file: in the destination file render it as a real fenced code block with language `json`:

    ```json
    {
      "bundle_id": "freeform",
      "project_name": "Acme widget service"
    }
    ```

The indented form above (inside the BEGIN/END markers) is presentation-only in this prompt; the destination uses the fenced form.

---

## Outline-only content — SPEC §7.26 prose

You draft this section to fit the existing tone of `SPEC.md` §7. Match §7.23 / §7.25 voice: terse, decision-oriented, methodology-agnostic (T-D48), parenthetical anchor citations, no marketing voice. Target ~200–300 words.

**Placement.** Insert a new `### 7.26 Clone-and-go` subsection after the end of §7.25 in `SPEC.md`. Verify §7.26 is not already taken before inserting; halt if so.

**Required content beats** (in order):

1. One-sentence definition: clone-and-go is the path by which a user-owned repo carrying a `.throughline/` directory binds to Throughline on first run without bespoke setup.
2. What `.throughline/` carries — short list (the required `project.json`, the optional `bundle.md`), pointing to `docs/.throughline-schema.md` for field detail rather than duplicating it.
3. The three bundle-resolution arms — list verbatim in the same order T-D51's Decision section uses, no reordering, no renaming. The list reads: explicit `bundle_path` arm (C-D14); per-repo `.throughline/bundle.md` carve-out (new in T-D51); install-shipped default fallback.
4. Re-init behaviour — one sentence: re-reads `.throughline/` and updates only the fields it supplies; never overwrites items, sessions, library entries, secrets, or audit history.
5. CLI write contract — one sentence referencing T-D52: `throughline init` requires the backend running and writes only via existing HTTP endpoints.
6. Explicit out-of-scope clause — one sentence: "Importing existing repo state (handovers, decisions, CHECKLIST rows) into a freshly-cloned project is the bootstrap surface, defined in a later phase." No section number — say "a later phase" since the bootstrap section is not yet drafted.
7. Cross-references — parenthetical citations to T-D51, T-D52, T-D4, C-D14, and `docs/.throughline-schema.md` placed where they belong in the prose, in the style of existing §7 subsections.

Do not invent additional content beyond these beats. If a beat reads awkwardly when integrated, surface to the spec author rather than expanding scope.

---

## Index updates — SPEC §14 (verbatim rows)

Append the two rows below to the SPEC §14 table after the existing T-D50 row. Match the table's column shape (`| Anchor | Subject | Section |`) exactly.

`==== BEGIN VERBATIM (SPEC §14 rows) ====`

| T-D51 | `.throughline/` is the per-repo config convention; bundle loader gains a third resolution arm (`<repo_path>/.throughline/bundle.md`) between the explicit `bundle_path` arm and the install-shipped fallback | 7.1, 7.2, 7.26 |
| T-D52 | `throughline init` CLI requires the backend running; probes `/api/health` and prints `Start the backend first: pnpm --filter @throughline/backend start` on failure; CLI writes only via existing HTTP endpoints, never the datastore directly | 7.26, 10 |

`==== END VERBATIM (SPEC §14 rows) ====`

---

## Back-reference flips — DECISIONS.md

Replace `<session-2-run-date>` with the actual calendar date you commit. Only the trailing sentence of each working note changes; title-tag and body prose stay untouched.

### `WN-clone-Q1` (line 1099)

- **Find (current trailing sentence):** `Resolved by → T-D51 (Phase 19).`
- **Replace with:** `Resolved by T-D51 (introduced <session-2-run-date>).`

### `WN-clone-Q4` (line 1111)

- **Find (current trailing sentence):** `Resolved by → T-D52 (Phase 19).`
- **Replace with:** `Resolved by T-D52 (introduced <session-2-run-date>).`

`WN-clone-Q2`, `WN-clone-Q3`, `WN-clone-Q5`, `WN-clone-Q6`, `WN-clone-Q7` remain untouched — their forward pointers resolve in later phases (T-D53–T-D57).

---

## PR description template

Open the PR at slice close. Use the template below — plain language for spec-author future-self review. Replace placeholders.

`==== BEGIN PR DESCRIPTION TEMPLATE ====`

Phase 19 doc prerequisites — clone-and-go (no code)

This PR is doc-only. It introduces three anchors and one new doc file, places the clone-and-go feature in the spec, flips two working notes whose forward-pointers this session realises, and removes the single-use prompt artefact from `docs/_meta/throughline/prompts/`.

**Artefacts:**

- **T-D51** (`DECISIONS.md`) — anchors `.throughline/` as the per-repo config convention and names the third bundle-resolution arm (`<repo_path>/.throughline/bundle.md`).
- **T-D52** (`DECISIONS.md`) — contracts the `throughline init` CLI: backend must be running, CLI never writes the datastore directly. The exact error string (`Start the backend first: pnpm --filter @throughline/backend start`) is fixed.
- **C-D19** (`CODE_SPEC.md`) — names the eight implementation surfaces Phase 19 will build (loader third arm, init config reader, git-remote auto-detect, CLI init subcommand, NewProjectModal field, SettingsView missing-config block, re-init flow, repo-path normalisation).
- **`docs/.throughline-schema.md`** (new) — schema for `.throughline/project.json` and the optional `.throughline/bundle.md`, plus an explicit "what `.throughline/` does NOT carry" section (secrets, items, sessions, library, audit log).
- **SPEC §7.26** — short functional section for clone-and-go, citing T-D51, T-D52, the schema doc, and pointing forward to the bootstrap surface in a later phase.
- **SPEC §14** — two new rows for T-D51 and T-D52.
- **`DECISIONS.md` WN-clone-Q1 and WN-clone-Q4** trailing sentences flipped from forward-pointer to back-reference form. Q2/Q3/Q5/Q6/Q7 untouched (resolve in later phases).
- **`docs/_meta/throughline/prompts/2026-05-24-doc-session-2-clone-and-go-prereqs.md`** — deleted. The prompt was single-use; git history retains it.

**Observed but not fixed:** `CODE_SPEC.md:9` has a stale "T-D anchors … canonical at 48" reference (already stale at T-D49/T-D50; would be stale at 52 after this PR). Surfaced here rather than touched, to keep this PR scoped to the spec author's brief.

No code, no migrations, no schema changes. Phase 19 implementation lands in a separate PR against C-D19's named surfaces.

Closes `WN-clone-Q1` / `WN-clone-Q4` functionally (the anchors they pointed to now exist).

`==== END PR DESCRIPTION TEMPLATE ====`

---

## Verification checklist

Run each check before opening the PR. Surface failures in chat before merging.

- `grep -n 'T-D51\|T-D52\|C-D19' SPEC.md CODE_SPEC.md DECISIONS.md docs/.throughline-schema.md` returns hits in all four files and no stray references elsewhere.
- SPEC §14 row count grew by exactly two; the two new rows sit immediately after the T-D50 row.
- `DECISIONS.md` `## T-D` heading count grew by exactly two; T-D51 and T-D52 sit immediately after T-D50.
- `CODE_SPEC.md` `## C-D` heading count grew by exactly one; C-D19 sits between C-D18 and `## 1. Process model`.
- `docs/.throughline-schema.md` renders cleanly under the repo's markdown preview / lint.
- `WN-clone-Q1` / `WN-clone-Q4` title-tag (`### WN-clone-Qn — … *(resolved 2026-05-24)*`) and body prose are byte-identical to pre-PR; only the trailing sentence changed.
- `git diff DECISIONS.md` shows changes only at: the T-D50/T-D51 boundary, T-D52, the Q1 trailing-sentence line, and the Q4 trailing-sentence line. Q2/Q3/Q5/Q6/Q7 untouched.
- `git status` shows `docs/_meta/throughline/prompts/2026-05-24-doc-session-2-clone-and-go-prereqs.md` as deleted (staged via `git rm`).
- No file outside the file-touch manifest is modified.
- `pnpm -r lint` (or the repo's live doc-lint target) and typecheck both pass.
- The handover file exists in the same commit, at `docs/_meta/throughline/handovers/<merge-date>-phase-19-clone-and-go-doc-prereqs.md`, written per `HANDOVER_TEMPLATE.md`.

---

## End-of-session signal

When CI is green and Gitar review is clean, the PR is mergeable. Open it with the description above. Per the established workflow, auto-continue on green; do not pre-announce.
