# Session 3 — Phase 20 doc prerequisites (bootstrap server-side ingest)

## Mission

You are the Session 3 instance of the Throughline doc-authoring stream. This slice is **doc-only** — no code, no migrations, no schema changes, no fixtures. You will introduce three anchors (T-D53, T-D54, C-D20), add a SPEC bootstrap capability subsection (likely §7.27 — verify against live SPEC structure before placing), update the SPEC §14 anchor index with two new rows, flip the trailing forward-pointers on `WN-clone-Q2` and `WN-clone-Q3` to back-references now that the anchors they point to exist, and delete this very prompt file as part of the same commit.

Session 2 (merged 2026-05-25) added T-D51, T-D52, C-D19, `docs/.throughline-schema.md`, SPEC §7.26, and flipped WN-clone-Q1 / WN-clone-Q4. Two of the remaining five working-note forward-pointers (Q2, Q3) realise in Phase 20 — this session realises them. The other three (Q5/Q6/Q7) realise in Phases 21–22 and stay as forward-pointers untouched.

## Self-delete contract

This prompt file lives at `docs/_meta/throughline/prompts/2026-05-25-doc-session-3-bootstrap-server-prereqs.md`. As part of your single doc-work commit, **delete this file**. After Session 3 merges, the prompt is gone from `main`; only git history retains it. Do not move it, do not archive it, do not soft-delete — `git rm` it in the same commit as the rest of the doc work.

## Authority and reading order

Before you draft anything, read in this order:

1. `SESSION_START.md` — the discipline floor. The "anchor convention" rule says don't invent anchors mid-session — but **T-D53, T-D54, and C-D20 are pre-authorised by the spec author in this prompt**. The exact anchor IDs and bodies you are about to write are below; you transcribe them.
2. The most recent handover (the Phase 19 clone-and-go-doc-prereqs handover from Session 2, dated 2026-05-25 in `docs/_meta/throughline/handovers/`). This is the live state at the end of Session 2.
3. `SPEC.md` §7.26 and §14. §7.26 is the existing subsection that Session 2 added; the new bootstrap subsection lands immediately after it. §14 carries the anchor index whose row format you must match — read the T-D51 / T-D52 rows in particular (also Session-2-dated 2026-05-25) so the two rows you add fit existing tone.
4. `CODE_SPEC.md` C-D18 and C-D19. C-D19 is the format precedent for C-D20 (multi-surface implementation anchor); C-D19 is the current last anchor. C-D20 lands immediately after C-D19 in the sequence.
5. `DECISIONS.md` T-D4, T-D24, T-D36, T-D51, T-D52, `WN-clone-Q2`, `WN-clone-Q3`. T-D51 / T-D52 (both Session-2-dated 2026-05-25) are the closest precedent for an anchor that resolves a working note and points forward to an implementation — they put "resolves WN-…" in the Status line and "Implementation in C-D…" in the trailing sentence. Match that shape exactly. T-D4 is the secrets-stay-in-backend-config decision (cited by T-D53). T-D24 / T-D36 frame the audit-log conventions referenced by C-D20.
6. `packages/backend/src/md-ingest/service.ts`, `packages/backend/src/audit/log.ts`, `packages/backend/src/ai/fingerprint.ts`, and `packages/backend/src/intelligence/text-index.ts` — the existing precedents cited by C-D20. Read them for shape only; you are not editing them.

If you discover that any live file has shifted such that the placements named in this prompt no longer fit (e.g. the §14 table no longer ends at T-D52, T-D53 is already taken, C-D19 is no longer the last C-D anchor, §7.26 has been renumbered), **halt and surface** before drafting anything. Do not silently adapt.

## Constraints and discipline

- **Branch:** `claude/throughline-doc-session-3-bootstrap-server-prereqs`. Create on a fresh branch from `main` after fetching.
- **Single commit** on the slice's branch. The handover file (see file-touch manifest) lands in the same commit, per `HANDOVER_TEMPLATE.md`'s authoring rule. The deletion of this prompt file is part of the same commit.
- **No code, no migrations, no schema, no fixtures.** This PR is doc-only.
- **Verbatim transcription is literal.** The three pre-drafted blocks below (T-D53 body, T-D54 body, C-D20 body) are transcribed character-for-character. If during transcription you spot a factual or phrasing concern, **halt and surface to the spec author** — do not adapt silently.
- **Outline-only content is yours to draft.** The new SPEC bootstrap subsection prose is specified by content beats; you draft it to fit the existing terse, decision-oriented, methodology-agnostic tone (T-D48). Match §7.23 / §7.25 / §7.26 voice. ~200–300 words.
- **Confirm live placements before drafting prose.** SPEC §14 row position (after T-D52), T-D53/T-D54 sequencing in DECISIONS.md (after T-D52), C-D20 sequencing in CODE_SPEC.md (after C-D19), the new bootstrap subsection sequencing in SPEC.md (working assumption §7.27 — verify against live SPEC structure).
- **Use the run-date convention.** Every `<session-3-run-date>` placeholder in the pre-drafted blocks and back-reference flips below is replaced with the calendar date you actually commit and merge. Same convention Sessions 1 and 2 used.
- **Auto-continue on green CI + clean Gitar review** per the established workflow. Open the PR at slice close; do not pre-announce.
- **No file outside the file-touch manifest below is modified.**

## File-touch manifest (closed list)

You may modify only:

- `DECISIONS.md` — append T-D53 body; append T-D54 body; flip `WN-clone-Q2` trailing sentence to back-reference T-D53; flip `WN-clone-Q3` trailing sentence to back-reference T-D54.
- `SPEC.md` — insert the new bootstrap prose subsection after §7.26 (working assumption §7.27; verify); add two new rows to the §14 table after T-D52.
- `CODE_SPEC.md` — append C-D20 body after C-D19.
- `docs/_meta/throughline/handovers/<merge-date>-phase-20-bootstrap-server-prereqs.md` — new handover, written per `HANDOVER_TEMPLATE.md`, in the same commit.
- `docs/_meta/throughline/prompts/2026-05-25-doc-session-3-bootstrap-server-prereqs.md` — **delete this file** (`git rm`) in the same commit. The prompt is single-use; once Session 3 merges, it should not exist on `main`.

**Observed but do not fix:** if the line at `CODE_SPEC.md:9` still says T-D anchors "remain canonical at 48" (or any other count below 54 after your additions), surface it in the PR description as observed — Session 2 already noted this is a separate-slice cleanup, scoped out of this PR.

---

## 1. Pre-drafted verbatim block — T-D53

Append to `DECISIONS.md` immediately after T-D52, in the same shape and tone as T-D51 / T-D52. Transcribe character-for-character. Halt and surface if anything reads off.

**BEGIN T-D53 (verbatim transcription) ↓**

### T-D53 — Bootstrap import file shape: structured per-source rows for items, sessions, and decision/note library entries; bundle-aware validation; secrets and runtime state excluded *(introduced <session-3-run-date>)*

*Status:* resolves WN-clone-Q2.

The bootstrap import file is a structured artifact produced by Phase 21's Claude Code session against a user-owned repo's existing state (handover files, DECISIONS.md, ROADMAP.md, CHECKLIST.md and equivalents). It carries three entity types — items (work units), sessions (one per discovered handover), and library entries (each DECISIONS-style anchor tagged `decision`, narrative notes tagged otherwise). Every row carries a deterministic `bootstrap_id` (T-D54) and names its `source_type` (`decision`, `roadmap`, `handover`, `checklist`, `override`) so re-import can resolve identity per type.

Required fields per row: `bootstrap_id`, `source_type`, plus entity-type-specific identity (`title` + `type` + `status` for items; `name` + optional `branch_ref` for sessions; `type` + `title` + `body` + `tags` for library entries). Optional fields are entity-shaped and validated against existing entity schemas. Bundle-awareness validation is mandatory: item `type` values must appear in the bound bundle's `ItemPolicy.types`; status values must appear in the bound bundle's `status_lifecycles` for that type; library tags including `decision` are accepted unconditionally. A bootstrap file landing against a project with no bundle bound is rejected up-front with a clear error pointing the user at clone-and-go init (§7.26).

DECISIONS-style anchored rationale (`T-D…`, `WN-…`, equivalents in user bundles) is imported as library entries of type `note` tagged `decision`, never as items (WN-clone-Q2). Items are work units with status lifecycles; decisions are rationale records with anchor IDs. Conflating the two would inflate work counts and corrupt every items-based metric.

Explicitly excluded from the bootstrap file: API keys and secrets (T-D4 — stay in backend config, never on disk under the repo), audit log (rebuilt from re-import as `bootstrap_import` / `bootstrap_reimport` events per T-D54), embeddings and intelligence caches (regenerated lazily through existing indexing paths), telemetry and prompt fingerprints (per-install cache layer), settings, gate-firing history, methodology bindings (those come from clone-and-go init per T-D51 / T-D52). Phase 21's Claude Code invocation is the *producer* of this file; bootstrap ingest is the *consumer* — the two are separately phased and independently testable. Implementation in C-D20.

**END T-D53 ↑**

---

## 2. Pre-drafted verbatim block — T-D54

Append to `DECISIONS.md` immediately after T-D53. Transcribe character-for-character. Halt and surface if anything reads off.

**BEGIN T-D54 (verbatim transcription) ↓**

### T-D54 — Bootstrap re-run is idempotent upsert on `(project_id, bootstrap_id)`; three row states; bootstrap_id derived per source type with a universal `@bootstrap-id:` override *(introduced <session-3-run-date>)*

*Status:* resolves WN-clone-Q3.

Bundles evolve post-launch; users will re-bootstrap as their methodology firms up. Every row in the bootstrap import file (T-D53) carries a deterministic `bootstrap_id` and re-import upserts on `(project_id, bootstrap_id)`. The format is `<source-type>:<stable-key>` — the prefix prevents accidental cross-source collision and is human-readable for debugging. Each affected entity table (`items`, `sessions`, `library_entries`) gains a nullable `bootstrap_id TEXT` column with a unique partial index on `(project_id, bootstrap_id)` where non-null. Existing creation paths (manual `POST /api/projects/:id/items`, manual library/session creation, md-ingest at `(project_id, source_path)`) are unaffected — only bootstrap-imported rows carry a `bootstrap_id`.

Derivation rules per source type:

- `decision:<anchor-id>` — DECISIONS-style anchored rationale (`T-D…`, `WN-…`, equivalents in user bundles). Anchor ID is the stable key. Body edits and section moves preserve identity; anchor renames create new identity, which is correct because renames are semantically meaningful.
- `roadmap:phase-<n>` — ROADMAP phase entries. Phase number is the stable key.
- `handover:<filename>` — One identity per handover file. Where the bootstrap parser detects in-file session anchors, `handover:<filename>#<in-file-anchor>` disambiguates sub-sessions. Handover filenames are dated, append-only artifacts in practice; renames are rare and treated as new identity.
- `checklist:<sha256-16-of-normalized-text>` — Normalized text is lowercase, whitespace collapsed, trailing punctuation stripped. Casing/whitespace/punctuation typo-fixes preserve identity for free; word-level semantic edits create new identity, and the stale-flag (below) surfaces the prior row for user ack.
- `override:<user-slug>` — Any source row may carry `<!-- @bootstrap-id: my-slug -->`; the override wins over every derivation rule.

`@bootstrap-id:` is the universal escape hatch for any case where the natural key shifts — CHECKLIST row word-level edits, ROADMAP phase renumbering, handover file renames or splits, anchor renames that should preserve identity. Costs ~10 lines in the parser; the user is expected to add overrides pre-emptively before a refactor they know will move natural keys, or to ack-stale the orphaned rows afterward.

Hash convention: sha256, 16-char hex prefix, unsalted — distinct from the privacy-salted `promptFingerprint` (T-D24) and the change-detection `contentHash` / `hashContent`. Three named functions, three named purposes; the new `bootstrapId` helper lives in `packages/backend/src/bootstrap/derive-id.ts` (C-D20) with one resolver per source type. Two rows resolving to the same `bootstrap_id` in a single import file are rejected up-front with an error citing both source rows — the parser never silently collapses duplicates.

Three row states at import time:

1. **New** — `bootstrap_id` absent in `(project_id, bootstrap_id)`. Insert. Audit `bootstrap_import` with `source_type` and `bootstrap_id` in `trigger_context`.
2. **Existing, no user edits since last import** — `bootstrap_id` present, and no non-`bootstrap_*` audit entries touch this entity since the prior `bootstrap_import` / `bootstrap_reimport`. Update in place. Audit `bootstrap_reimport`.
3. **Existing, user edits since last import** — `bootstrap_id` present, and the user has touched the entity since the prior import. Do not auto-overwrite. Queue a per-row conflict in the review queue (C-D20). User picks `keep_mine` (drop incoming), `take_theirs` (overwrite, audit trail preserved), or `merge_fields` (per-field choice).

Rows whose `bootstrap_id` appeared in a prior import but is absent from the current one are flagged `bootstrap_stale=true` on the entity; never auto-deleted. Stale entities surface in the review queue with `keep` / `archive` / `delete` actions. Implementation in C-D20.

**END T-D54 ↑**

---

## 3. Pre-drafted verbatim block — C-D20

Append to `CODE_SPEC.md` immediately after C-D19, before whatever immediately follows it (verify live structure). Match C-D19's heading format and section organisation. Transcribe character-for-character. Halt and surface if anything reads off.

**BEGIN C-D20 (verbatim transcription) ↓**

### C-D20 — Bootstrap ingest path: `bootstrap_id` columns + partial indices on items/sessions/library_entries, `POST /api/projects/:id/import` endpoint, transactional upsert with per-row conflict surfacing, review queue UI *(introduced <session-3-run-date>)*

*Status:* implements T-D53, T-D54.

**Schema.** A new migration adds `bootstrap_id TEXT` (nullable) and a unique partial index `(project_id, bootstrap_id) WHERE bootstrap_id IS NOT NULL` to `items`, `sessions`, and `library_entries`. The nullable column preserves existing creation paths — manual `POST /api/projects/:id/items` (`packages/backend/src/items/routes.ts`), manual session and library creation, and the md-ingest path at `(project_id, source_path, type='imported_doc')` (`packages/backend/src/md-ingest/service.ts`) — only bootstrap-imported rows carry a `bootstrap_id`. The md-ingest upsert at `(project_id, source_path)` and the bootstrap upsert at `(project_id, bootstrap_id)` coexist on `library_entries` without collision because they key on different columns.

**Endpoint.** `POST /api/projects/:id/import` accepts the bootstrap file as a JSON body (schema per T-D53), validates it against the project's bound methodology bundle, runs the upsert in a single SQLite transaction, and returns a per-row result classification (`new` / `reimported` / `conflict` / `stale_flagged`). Validator structure mirrors `packages/backend/src/md-ingest/service.ts`: a stateless parser/validator layer feeds a stateful upsert layer that calls existing `items.create` / `sessions.create` / `library.create` for inserts and new `…upsertByBootstrapId` methods for updates. Audit entries are appended per row via existing `appendAudit` (`packages/backend/src/audit/log.ts`) with `field: 'bootstrap_import'` or `'bootstrap_reimport'` and `trigger_context_json` carrying `bootstrap_id`, `source_type`, and result status. Audit entity identity is the existing polymorphic `(entity_type, entity_id)` tuple (T-D36) — no schema change to `audit_log`.

**Derivation module.** `packages/backend/src/bootstrap/derive-id.ts` exports `bootstrapId(sourceType, key)` returning the `<source-type>:<stable-key>` form. One resolver per source type (`decision`, `roadmap`, `handover`, `checklist`, `override`). Content-hashed types (currently `checklist`) reuse `createHash('sha256').update(...).digest('hex').slice(0, 16)`; non-hashed types pass the stable key through. Unit-test heavy, runtime-light; lives adjacent to (not inside) `packages/backend/src/ai/fingerprint.ts` so the three hashing conventions remain readable as siblings.

**Conflict-detection predicate.** A service-layer helper `hasUserEditsSinceLastBootstrap(entityType, entityId)` is the single source of truth for "user-edited since last import" — both the API and the review queue UI consult it so they cannot disagree. The helper scans `audit_log` filtered by `(entity_type, entity_id)` (covered by the existing `idx_audit_entity` per `0001_init.sql`) and the row's prior `bootstrap_import` / `bootstrap_reimport` timestamp, excluding `field` values prefixed `bootstrap_`. The per-row scan runs once per imported row inside the import transaction; Phase 20 build may benefit from a covering index on `(entity_type, entity_id, timestamp, field)` if benchmarks show the predicate dominates import latency at realistic row counts, but the existing `idx_audit_entity` should suffice for v1.

**Review queue UI.** A new client surface lists conflicted rows from `POST /api/projects/:id/import` results with per-row resolution actions (`keep_mine` / `take_theirs` / `merge_fields` for conflicts; `keep` / `archive` / `delete` for stale rows). UI surface placement and visual treatment are deliberately not pinned here — the Phase 20 build slice owns those calls.

**END C-D20 ↑**

---

## 4. Outline-only content — new SPEC bootstrap subsection

Draft this yourself, ~200–300 words, matching §7.26's voice (terse, decision-oriented, methodology-agnostic — T-D48 tone). Placement working assumption: `§7.27 — Bootstrap`. **Verify against live SPEC structure first**; if §7.27 is already taken or the numbering scheme has shifted, halt and surface placement before drafting.

Required content beats (order is a suggestion; structure to fit):

- **What bootstrap is, as a user-facing capability.** Importing pre-processed state from a structured file into a Throughline project. Idempotent and re-runnable. Distinct from clone-and-go init (§7.26): init binds a repo to a bundle; bootstrap populates that project with the repo's existing items, sessions, and decisions.
- **What the import file represents.** Structured per-source rows produced by Phase 21's Claude Code session against the user's existing repo (handover files, DECISIONS.md anchors, ROADMAP phases, CHECKLIST rows). Carries items, sessions, and library entries (decisions as `note` tagged `decision`). Bundle-aware validation per T-D53.
- **What re-run does.** Idempotent upsert on `(project_id, bootstrap_id)` per T-D54. Three row states (new / existing-no-edits / existing-with-edits). Stale flag on rows that drop out of a later import. Never auto-deletes.
- **What the review queue is.** User-facing surface for per-row conflicts (when user edits and incoming import disagree) and for stale rows. Per-row actions named.
- **What bootstrap does NOT do.** Claude Code invocation (producing the import file) is Phase 21 and separately phased — bootstrap ingest is the *consumer*; the *producer* is documented in the (forthcoming) Phase 21 bootstrap-prompt section. Secrets and runtime state are excluded (T-D4, T-D53).
- **Cross-references** to T-D53, T-D54, T-D4 (secrets), the (unchanged) `docs/.throughline-schema.md` (config schema is adjacent but unaffected), and a forward-pointer to the bootstrap-prompt section in the future Phase 21 docs.

---

## 5. SPEC §14 anchor-index row additions

Add two new rows to the §14 table after the existing T-D52 row. Match the existing row format (the three-column shape `| Anchor | Subject | Section |`). The `Section` cell points to the section number you confirmed in step 4 above (working assumption `7.27`).

**BEGIN row additions (verbatim transcription) ↓**

| T-D53 | Bootstrap import file shape: structured per-source rows for items, sessions, and decision/note library entries; bundle-aware validation; secrets and runtime state excluded | 7.27 |
| T-D54 | Bootstrap re-run is idempotent upsert on `(project_id, bootstrap_id)`; three row states; bootstrap_id derived per source type with a universal `@bootstrap-id:` override | 7.27 |

**END row additions ↑**

If the bootstrap subsection landed at a number other than 7.27, edit the `Section` column on both rows to match before transcribing.

---

## 6. Back-reference flips

Two trailing-sentence rewrites in `DECISIONS.md`. The current text in each working note ends with a forward-pointer (`Resolved by → T-D53 (Phase 20).` / `Resolved by → T-D54 (Phase 20).`). Flip both to back-references, matching the shape Session 2 used for WN-clone-Q1 / WN-clone-Q4.

**BEGIN flip 1 (WN-clone-Q2) ↓**

Find: `Resolved by → T-D53 (Phase 20).`
Replace with: `Resolved by T-D53 (introduced <session-3-run-date>).`

**END flip 1 ↑**

**BEGIN flip 2 (WN-clone-Q3) ↓**

Find: `Resolved by → T-D54 (Phase 20).`
Replace with: `Resolved by T-D54 (introduced <session-3-run-date>).`

**END flip 2 ↑**

Leave `WN-clone-Q5`, `WN-clone-Q6`, `WN-clone-Q7` untouched — those forward-pointers (T-D55, T-D57, and the cross-cutting Q7) realise in Phases 21–22, future doc-sessions.

---

## 7. PR description template

Open the PR at slice close (auto-continue on green CI + clean Gitar review). Title:

```
Doc session 3 — Phase 20 doc prerequisites (bootstrap server-side ingest)
```

Body (adapt; the spec author reads this as plain-language future-self review):

```
Introduces three anchors (T-D53, T-D54, C-D20) covering the Phase 20 (bootstrap
server-side ingest) doc prerequisites. Adds a SPEC bootstrap subsection at §7.27,
two §14 index rows, the C-D20 entry, and flips WN-clone-Q2 / WN-clone-Q3 trailing
sentences to back-references now that T-D53 / T-D54 exist. Deletes the single-use
prompt artifact.

Doc-only — no code, no migrations, no schema, no fixtures.

Key decision recorded by T-D54: bootstrap_id is derived per source type, with a
universal `@bootstrap-id:` override as the escape hatch for any case where the
natural key shifts (CHECKLIST text edits, phase renumbering, handover renames,
anchor renames). The hash convention (sha256, 16-char, unsalted) is documented
as a third named function alongside the existing privacy-salted promptFingerprint
and the unsalted contentHash for embeddings.

Observed but not fixed: [if the CODE_SPEC.md:9 "remain canonical at N" line is
still stale, name it here — same as Session 2 noted].
```

---

## 8. Verification checklist

Run before opening the PR:

- `grep -c '^### T-D' DECISIONS.md` returns the prior count + 2.
- `grep -c '^### C-D' CODE_SPEC.md` returns the prior count + 1.
- `grep '| T-D53 |' SPEC.md` and `grep '| T-D54 |' SPEC.md` each return one row in the §14 table.
- `grep 'Resolved by → T-D53' DECISIONS.md` and `grep 'Resolved by → T-D54' DECISIONS.md` each return zero matches (forward-pointers gone).
- `grep 'Resolved by T-D53' DECISIONS.md` and `grep 'Resolved by T-D54' DECISIONS.md` each return one match (back-references in place).
- `git status` shows `docs/_meta/throughline/prompts/2026-05-25-doc-session-3-bootstrap-server-prereqs.md` as `deleted`.
- `git diff --stat main...HEAD` shows exactly the files in the manifest above and nothing else.
- The new handover file exists under `docs/_meta/throughline/handovers/` with the merge date in its filename.

---

## 9. End-of-session signal

When CI is green and Gitar review is clean, the PR merges automatically per the established workflow. Do not pre-announce. The spec author reviews the PR description as plain-language future-self review.
