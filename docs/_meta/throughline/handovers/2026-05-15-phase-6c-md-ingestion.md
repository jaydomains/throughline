<!-- Template version: 1.0 -->

# Throughline — Phase 6c Handover

**Generated:** 2026-05-15 (pre-merge)
**Last commit SHA:** see PR #11 head — `28a0eba` 2026-05-15
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-13-phase-6b-directives-reminders-notifier.md` (Phase 6b — directives, reminders, notifier)

Phase 6 was sliced into 6a / 6b / 6c at the session author's direction. 6c (this slice) lands repo `.md` ingestion and **completes Phase 6**: per-project folder-opt-in (confined to `repo_path`, C-D10); a `.md` scanner that classifies new/changed/unchanged against existing imported-doc entries; AI summarisation + tag suggestion on import (anthropic/heuristic/routing mirroring the Phase 4 dump-zone extractor) with cost telemetry (T-D29) + prompt fingerprint (T-D24); snapshot-by-default with a per-entry track-source toggle (§13 adopted default); a chokidar watcher that re-ingests tracked entries on file change with a manual `syncOnce()` test seam; and the `MdFolderManager` UI + imported-doc source panel. No slices of Phase 6 remain.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Folder-opt-in: user points the backend at a directory; per-folder opt-in keeps noise out (T-D11, §7.9) | built | `packages/backend/src/md-ingest/service.ts` `addFolder/listFolders/removeFolder`; `0006_md_ingest.sql` `md_ingest_folders`; backend "adds a folder confined to repo_path and rejects escaping paths" | Folders confined to the `repo_path` subtree (C-D10) — lexical containment + no-symlink walk; absolute / `..` / outside paths rejected. |
| Backend scans for `.md` files, offers them as imported-doc entries (§7.9) | built | `md-ingest/service.ts` `scan()` walks `.md`-only, hashes, classifies new/changed/unchanged; `MdFolderManager.tsx` candidate checklist; backend "scans for .md files and classifies new / unchanged / changed"; frontend "lists opted-in folders, scans, and ingests selected docs" | `node_modules`/`.git`/build dirs skipped; scan capped at 500 candidates with a `truncated` flag. |
| AI generates summary + tag suggestions during import (§7.9; CHECKLIST 6c) | built | `md-ingest/summariser.ts` `createAnthropicSummariser` (STRICT-JSON `{summary,tags}`) + heuristic + routing; `service.ts` `ingest()` writes them, records cost T-D29 + fingerprint T-D24; backend "ingest creates an imported_doc entry with summary + tags and audits" + "records cost telemetry + prompt fingerprint…" + `md-ingest-summariser.test.ts` | Degrades to heuristic (first prose paragraph + filename/heading tags) when no API key (SPEC §15). |
| Default re-ingest = snapshot at import time (T-D11, §13) | built | `0006_md_ingest.sql` `source_tracked INTEGER NOT NULL DEFAULT 0`; `ingest()` creates entries with `source_tracked=false` | Snapshot entries never auto-update; re-ingest is an explicit user/watch action. |
| Per-entry "track source" toggle; tracked entries re-ingest on file change (T-D11, §13) | built | `service.ts` `setTracked` + hash-gated `reingestEntry`; `md-ingest/watcher.ts` chokidar over opted-in folders + manual `syncOnce()`; `LibraryView` `EntryEditor` track toggle + "Re-ingest now"; backend "setTracked toggles…; reingest is hash-gated" + `md-ingest-watcher.test.ts`; frontend "imported-doc entry exposes track-source toggle and re-ingest" | Tracked re-ingest re-summarises (C-D11); unchanged hash = no-op (no AI call). |
| Ingestion / folder ops audit-logged (T-D36) | built | `service.ts` `appendAudit` on folder add/remove (`md_ingest_folder_add/remove`), ingest (`md_ingest`), re-ingest (`md_reingest`); track toggle audited via `library.update` `source_tracked` field | Actor: `ai` when the AI summariser ran, `system` for heuristic/watch, `user` for manual re-ingest. |

---

## Last Decision Minted

No new T-D anchors. Implementation followed T-D11 (folder opt-in + snapshot/track-source), T-D24 (prompt fingerprint), T-D29 (cost telemetry), T-D36 (audit), §13 adopted defaults, SPEC §7.8/§7.9/§15.

Two new **C-D** anchors authored in `CODE_SPEC.md` (exactly two; CODE_SPEC and CHECKLIST references are consistent):

- **C-D10 — repo `.md` ingestion folders confined to the project's `repo_path` subtree.** Rationale: the REST surface takes a user-supplied path; an unbounded path is an arbitrary-filesystem-read hole. Enforced by lexical containment (reject absolute / `..`-escape; resolved path must equal or sit under `resolve(repo_path)`) + a no-symlink directory walk (the Phase 4 code-todo `withFileTypes` idiom). `realpath` deliberately avoided — `repo_path` is itself a symlinked tmpdir under test. Lands in `packages/backend/src/md-ingest/service.ts`.
- **C-D11 — `md_ingest_folders` table; tracked re-ingest re-summarises.** Rationale: a dedicated table (vs `projects.settings_json` blob) matches the table-per-feature convention (`code_todo_scans`), makes folder ops individually auditable, and FK-cascades with the project. Tracked re-ingest re-summarises via AI because "re-ingest" = "re-import" per §7.9 and tracking is an explicit per-entry opt-in, so the cost is user-chosen and flows through `cost_telemetry`; hash-gated so unchanged files are free; degrades to heuristic when no key. Lands in `0006_md_ingest.sql` + `md-ingest/service.ts`.

Conventions reused (no new ones minted): Phase 4 anthropic/heuristic/routing extractor shape (applied to the summariser); 6b "manual `tick()`/`syncOnce()` separate from `start()/stop()`" test seam (applied to the watcher); dump-zone telemetry→cost+fingerprint→audit write path.

---

## Active Blockers

_none_

Provisional / parked items:
- **`@anthropic-ai/sdk` still not adopted.** The summariser uses the existing thin JSON-over-HTTPS Anthropic client (`ai/anthropic.ts`), same as dump-zone/reconcile. Promoting to the SDK remains a one-file swap; not blocking.
- **Embedding hook for ingested docs (CODE_SPEC §line 56).** Phase 14 RAG is to embed "project doc files within ingested folders." 6c stores the doc body/summary but does not generate embeddings — that substrate is explicitly Phase 14. The `imported_doc` rows + `source_path`/`ingested_at` are the consumer surface; no wiring needed here.

---

## Files Changed Since Last Handover

**New (backend):**
- `packages/backend/src/db/migrations/0006_md_ingest.sql` — `md_ingest_folders` table + `library_entries` source-tracking columns + tracked-entry index.
- `packages/backend/src/md-ingest/summariser.ts` — anthropic/heuristic/routing summariser; STRICT-JSON `{summary,tags}`, telemetry for fingerprinting.
- `packages/backend/src/md-ingest/service.ts` — folder opt-in (C-D10 confinement), scan/classify, ingest, setTracked, hash-gated reingest; cost T-D29 + fingerprint T-D24 + audit T-D36.
- `packages/backend/src/md-ingest/watcher.ts` — chokidar over opted-in folders; serial resync; manual `syncOnce()` test seam.
- `packages/backend/src/md-ingest/routes.ts` — REST: folders CRUD, scan, ingest, track, reingest.

**New (shared):**
- `packages/shared/src/md-ingest.ts` — `MdIngestFolder / MdScanCandidate / MdScanResult / MdIngestRequest / MdIngestResult / MdTrackRequest`.

**New (frontend):**
- `packages/frontend/src/components/MdFolderManager.tsx` — collapsible folder-opt-in panel: add/remove/scan/ingest.

**New (tests):**
- `packages/backend/test/md-ingest.test.ts` (7 tests), `md-ingest-summariser.test.ts` (4), `md-ingest-watcher.test.ts` (2); `packages/frontend/test/md-ingest.test.tsx` (3).

**Modified (backend):**
- `packages/backend/src/library/service.ts` — round-trips `source_path/source_tracked/source_hash/ingested_at`; audits `source_tracked` changes.
- `packages/backend/src/server.ts` — wires summariser + md-ingest service + watcher; `mdIngestWatcher.start()` after listen, `stop()` in `close()`.

**Modified (shared):** `library.ts` (source-tracking fields on `LibraryEntry` + create/update inputs); `index.ts` (exports `./md-ingest.js`).

**Modified (frontend):** `api.ts` (md-ingest methods); `views/LibraryView.tsx` (mounts `MdFolderManager`; `EntryEditor` source panel + track toggle + re-ingest); `styles.css` (Phase 6c styles); `test/fixtures/mockApi.ts` (state-backed md mocks + `seedMdFolder`/`seedMdScan` + source-field defaults).

**Modified (docs):** `CODE_SPEC.md` (C-D10, C-D11); `CHECKLIST.md` (three 6c rows ticked).

**Deleted:** _none_.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Folder storage: table vs `settings_json` | `0006_md_ingest.sql` | T-D11 says "Settings carries a list of opted-in directories"; plan called this out as a possible `projects.settings_json` read. | Chose a dedicated `md_ingest_folders` table — recorded as C-D11 with rationale (table-per-feature convention, per-folder audit, FK cascade). Confirmed acceptable at plan approval. |
| Watcher scope: per-file vs per-folder | `packages/backend/src/md-ingest/watcher.ts` | Plan considered watching each tracked entry's individual source file. | Watch the opted-in folders and resync all tracked entries on any change; re-ingest is hash-gated so unchanged files are a cheap no-op. Simpler and correct as tracked toggles flip at runtime; noted in the watcher header. |
| `pnpm lint` is a no-op | repo | Expected lint to gate; each package's `lint` script is `echo 'no lint config'` and root eslint deps (`typescript-eslint`) aren't installed. | Relied on `pnpm typecheck` (clean across all three packages) as the static gate, consistent with prior slices. Flagged here so a future slice can decide whether to wire real lint. |

---

## Open Questions

- [ ] **Real lint wiring.** `pnpm lint` is a no-op and root eslint deps are absent. Decide whether to install/enable `typescript-eslint` or accept typecheck-only — repo-infra slice.
- [ ] **Phase 14 embedding of ingested docs.** CODE_SPEC §line 56 expects incremental embeddings on ingested folder doc edits. 6c leaves the `imported_doc` rows as the consumer surface; resolution lands in Phase 14 (RAG / C-D2 text substrate).
- [ ] **Ingested-doc title de-dup.** Two `.md` files with the same basename in different subfolders both get a basename title; `source_path` disambiguates but the sidebar shows duplicate titles. Cosmetic; revisit in a library-polish slice if it bites.
- [ ] **TagChipsEditor consolidation (carry-forward from 6a/6b).** Still not done; not blocking.

---

## Recently Resolved

- **Phase 6c (whole slice)** — was flagged "deferred" in `2026-05-13-phase-6b-directives-reminders-notifier.md`; delivered here. Phase 6 is now complete (6a library content, 6b directives/reminders/notifier, 6c repo `.md` ingestion all closed).
- **6a scaffolding: `library_entries.summary` column** — added empty in `0004_library_extensions.sql` "for the Phase 6c imported-doc AI summary"; now populated by the 6c ingest path.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- Phase 1 backend: `library_entries` table, audit substrate (T-D36), cost telemetry table (T-D29), projects service (`repo_path`).
- Phase 4 backend: thin Anthropic client (`ai/anthropic.ts`), `ai/fingerprint.ts`, `ai/pricing.ts`, the dump-zone extractor's anthropic/heuristic/routing convention, the code-todo scanner's no-symlink `withFileTypes` walk idiom, the inbox watcher's chokidar + serial-drain shape.
- Phase 6a frontend: `LibraryView` / `EntryEditor` (imported-doc readonly render, `summary` panel), library API conventions.
- Phase 6b: the "manual `tick()`/`syncOnce()` separate from `start()/stop()`" scheduler test-seam convention.

**Downstream (consumes this slice's work):**
- **Phase 13 session-start.** Ingested `imported_doc` entries carry directives like any library entry (parent-type agnostic, per the 6b handover) — `include_prompt` directives on imported docs flow into Phase 13's prompt assembly with no extra wiring.
- **Phase 14 RAG.** `imported_doc` rows + `source_path`/`ingested_at` are the text-substrate consumer surface; embeddings generated there, not here.
- **Phase 14 periodic-review hygiene.** `md_ingest`/`md_reingest` audit rows (actor `ai`/`system`/`user`) feed hygiene queries ("tracked docs that never changed", "ingested docs untouched since rebrand").

---

## Reference

- Specs operated against: `SPEC.md` §7.8 (library), §7.9 (repo `.md` ingestion), §15 (degrade-gracefully); `CODE_SPEC.md` §3 (`library_entries` row), §16 (audit), C-D10, C-D11; T-D11, T-D24, T-D29, T-D36; ROADMAP §Phase 6.
- Previous handover: `docs/_meta/throughline/handovers/2026-05-13-phase-6b-directives-reminders-notifier.md`.
- PR: #11 — https://github.com/jaydomains/throughline/pull/11
