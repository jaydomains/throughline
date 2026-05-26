# Throughline v1 — Roadmap

Sequenced build plan. Each phase has a scope, dependencies, done criteria, and adopts §13 recommended defaults where it makes sense to fix the policy at the implementation point. Phases that depend on §13 questions without a recommended default are flagged.

The methodology runtime is load-bearing. Phase 1 delivers enough runtime substrate (datastore, project model, bundle loader, freeform bundle) that subsequent phases build against it. The freeform bundle lands early so Throughline is usable on real projects before rich-bundle wiring is complete.

§13 adoption legend at the bottom of this file lists every recommended default applied and the section reference.

---

## Phase 0 — Repo bootstrap & v5.1 documentation regeneration (this session)

**Scope.** Documentation regeneration against SPEC.md v5.1: DECISIONS.md updated with new T-D anchor bodies (T-D39–T-D48) and refinements on existing anchors; CODE_SPEC.md fully rewritten around the methodology-runtime reframe; ROADMAP.md (this file) resequenced; CHECKLIST.md regenerated; README.md reframed.

**Dependencies.** None.

**Done when:** five top-level docs (README, CODE_SPEC, DECISIONS, ROADMAP, CHECKLIST) regenerated against v5.1; T-D ledger has 48 entries matching SPEC §14; rationale-needed marked for unrecoverable cases.

**Sizing:** 1 session.

---

## Phase 1 — Backend skeleton, datastore, project model, bundle loader, freeform bundle

**Scope.** Backend bootstrap (T-D2, T-D19); SQLite + schema migrations with `project_id` foreign keys on per-project tables (T-D40, C-D5); audit log scaffolding scoped per T-D36 (items, library, projects, bundle bindings, gate firings, checklist steps); secrets file separation (T-D4); cost telemetry table (T-D29 placeholder); health endpoint; login auto-start documentation; bundle loader parsing the eleven-section markdown structure (T-D42, C-D3, C-D4); shipped `methodologies/freeform/bundle.md`; project create/switch/archive/delete (T-D40); live bundle reload on file change.

**Cites:** T-D2, T-D3, T-D4, T-D19, T-D31, T-D36, T-D40, T-D41, T-D42, T-D47, C-D1, C-D3, C-D4, C-D5.

**Dependencies.** Phase 0.

**Done when:**
- Backend starts on a documented single command and exposes `127.0.0.1:<port>`.
- Datastore file created on first run with all tables migrated.
- Settings round-trip via REST.
- Audit log records test mutations across all entity types.
- Login auto-start documented (not necessarily enabled by default).
- Bundle loader parses `methodologies/freeform/bundle.md` into a typed `LoadedBundle`.
- Project create defaults bundle binding to `freeform`.
- Project create / switch / archive / delete functional via REST + a minimal CLI (UI not required this phase).
- Bundle file change triggers re-load with an audit-log entry per affected project.

**Sizing:** large. The runtime substrate is the foundation; subsequent phases build against it.

---

## Phase 2 — Browser UI shell & nine view-mode plumbing

**Scope.** React app served by backend; routing for all nine view modes (home, projects, sessions, modules, tree, graph, library, directives, methodology-gates); conditional rendering of modules and methodology-gates based on bundle declarations; header (scratchpad placeholder, cost meter placeholder, backup indicator placeholder, view-mode toggle); command palette skeleton (`Cmd+K`); keyboard navigation primitives; SSE wiring for backend-pushed updates; project switcher in header.

**Cites:** T-D30, T-D40, T-D47, §7.11, §7.24, C-D1.

**Dependencies.** Phase 1.

**Done when:**
- All nine view modes route and render an empty stub.
- Modules and methodology-gates view modes hide for a freeform-bound project (which declares no primary unit / no gates).
- Project switcher in the header lists projects from Phase 1 and switches the active project.
- Command palette opens, closes, fuzzy-search infrastructure works.
- SSE channel established; ping/pong demonstrates connectivity.

**Sizing:** medium.

---

## Phase 3 — Items, sessions, manual entry, item detail panel

**Scope.** CRUD for items + sessions; bundle-defined item types from the active project's bundle (freeform: `task`); status lifecycles (freeform: `open`/`done`); blocker references (free-text + structured per T-D8); tags; parent/children; session memberships (T-D1); branch reference free-text field (T-D38); item detail panel (§7.17); stale yellow flag in detail panel header and in list rows (T-D46); bundle-defined boards (freeform: single board called "tasks").

**Cites:** T-D1, T-D8, T-D38, T-D46, §7.3, §7.4, §7.5, §7.17.

**Dependencies.** Phase 2.

**Done when:**
- Items + sessions CRUD via UI within a freeform-bound project.
- Status lifecycle enforced per the bundle's declaration.
- Blocker chain renders in detail panel.
- Manual entry inline form on each board, keyboard-driven.
- Stale yellow flag renders in list rows and detail-panel header.
- All lifecycle transitions audit-logged.

**Sizing:** medium.

**Note.** At end of Phase 3, a freeform-bound project tracks tasks usefully end-to-end. This is part of the minimum useful product.

---

## Phase 4 — Capture surfaces

**Scope.** Scratchpad (T-D20); session/library dump zone with bundle-aware AI extraction + review modal (T-D5); voice input (desktop-only, §7.6); Claude Code push via watched FS inbox (T-D16, T-D37); code TODO/FIXME import.

**Cites:** T-D5, T-D16, T-D20, T-D37, §7.6.

**§13 adoptions in this phase:**
- TODO/FIXME default patterns: `TODO:`, `FIXME:`, `XXX:`.
- TODO/FIXME trigger: manual invocation only in v1.

**§13 unresolved (no recommendation in spec):**
- Voice input language: English only vs browser-locale auto. Flagged in CODE_SPEC.md Questions for the spec author. Phase implementation will default to English only with a settings toggle, pending direction.

**Dependencies.** Phase 3.

**Done when:**
- All non-scratchpad surfaces route through review modal and apply cleanly.
- Scratchpad captures friction-free with no AI.
- Inbox watcher archives processed files; quarantines failures with error metadata.
- Voice input transcript pipes into dump zone flow with destination selection.
- Dump zone extraction parameterised by the active project's bundle (freeform: extractor told item type is `task`).

**Sizing:** large.

---

## Phase 5 — Reconcile engine

**Scope.** Six-category diff (T-D35): completed, new, edited (covers title and description under one row), blocker changes, contradicted, no-change. Apply flow. Review modal UI. Contradicted-as-drift hand-off (creates drift signal with `stream='code'`, does not auto-revert).

**Cites:** T-D5, T-D21, T-D35, §7.7.

**Dependencies.** Phase 3 (items exist), Phase 4 (capture provides input).

**Done when:**
- Reconcile against any session produces a faithful six-category diff.
- Apply mutates state and audit-logs every change.
- Contradicted spawns code-drift signal (tier-2 if PR associated, tier-3 otherwise).
- Edited row presents title and description changes together.

**Sizing:** medium.

---

## Phase 6 — Library, directives, repo `.md` ingestion

**Scope.** Four library content types (T-D10): notes, prompts, snippets, imported docs. Notes ↔ items many-to-many (T-D9). Three directive types (T-D12) with OS notification firing for reminders (T-D32). Directives view grouped by type (§7.10). Repo `.md` ingestion folder-opt-in (T-D11). Library entries scoped per project with cross-project toggle.

**Cites:** T-D9, T-D10, T-D11, T-D12, T-D32, §7.8, §7.9, §7.10.

**§13 adoptions in this phase:**
- Library prompt variable syntax: `{{var_name}}` (Mustache-conventional).
- Recurring reminders: persist until directive removed (user explicitly stops the recurrence).
- Repo `.md` re-ingest: snapshot by default with per-entry "track source" toggle for live mirror.
- Reminder semantics: relative + absolute + recurrence rule support.

**Dependencies.** Phase 3 (items exist), Phase 1 (audit log writes).

**Done when:**
- Library functional across all four content types.
- Notes attachable to multiple items; deletion removes attachment, not the item.
- Reminders fire OS notifications regardless of browser tab state.
- Pinned + include-in-prompt directives surface correctly.
- Folder-opt-in `.md` ingestion runs on demand.

**Sizing:** large.

---

## Phase 7 — Rich-bundle delivery & bundle-aware capture parameterisation

> **Superseded in part by the bundle-externalisation refactor (2026-05, C-D14).** This phase originally authored a business-internal rich bundle inside the repo. That bundle was later removed from the repo and replaced by a generic, business-neutral `test-bundle` grammar fixture; rich user-owned discipline now binds per-project via `bundle_path`. The done-criteria below are restated against the `test-bundle`. See `docs/_meta/throughline/handovers/2026-05-16-bundle-externalisation-refactor.md`.

**Scope.** Provide a non-trivial repo-shipped bundle (`methodologies/test-bundle/bundle.md`, eleven sections); wire bundle-defined item types into the existing UI from Phase 3 (parameterised by bundle, not hardcoded); confirm a rich-bundle-bound project's session boards render each item type as separate boards (§7.5); methodology-context fields on items (primary unit, phase, anchor citations, marker refs) populate from rich-bundle-bound projects; modules view comes alive for rich-bundle-bound projects (§7.11).

The freeform path from Phase 1–6 establishes that the runtime is methodology-agnostic; this phase proves it under a non-trivial bundle.

**Cites:** T-D39, T-D41, T-D42, T-D47, T-D48, C-D14, §7.3, §7.5, §7.11.

**§13 partially-blocking (recommendation present):**
- Bundle versioning: SPEC §13 commits to "v1 ships with no bundle-versioning mechanism; bundles are always-current; bundle change events audit-logged." Phase 1 already lands the audit-logging of bundle changes; nothing additional in Phase 7.

**Dependencies.** Phase 3, Phase 6.

**Done when:**
- `methodologies/test-bundle/bundle.md` parses successfully through the bundle loader.
- A new rich-bundle-bound project shows its item types on separate boards.
- Item creation in a rich-bundle-bound project shows methodology-context fields (primary unit, phase, anchors, markers).
- Modules view renders for rich-bundle-bound projects with primary-unit grouping, tier classification, phase indicators, anchor/marker counts.
- No code path uses bundle-specific terminology unmediated by the bundle.

**Sizing:** large.

---

## Phase 8 — Methodology gate runtime (four phase moments + PR-open)

**Scope.** Implement the gate dispatcher per C-D6: pre-write, per-commit, plan-mode, post-commit, pr-open moments. Multi-gate-per-phase-moment support (T-D42). Independent findings streams per gate. Gate failures as proposals never blocks (T-D44). Audit-logged overrides. The `test-bundle`'s two per-commit gates (a structure check and a banned-string sweep) run as the per-commit moment's two independent gates. Methodology-gates view comes alive for projects whose bundle declares gates.

**Cites:** T-D42, T-D44, T-D36, §7.12.

**§13 partially-blocking (recommendation present, calibrate during build):**
- Confidence threshold values are not directly relevant here; flagged for Phase 10 (GitHub auto-apply).

**Spec-author gaps (CODE_SPEC.md Questions for the spec author 1–4):** four moment-trigger detection mechanisms unspecified in SPEC.md v5.1 — pre-write, per-commit, plan-mode, post-commit. Build proceeds with the provisional v1 mechanisms in CODE_SPEC.md §7 (signal-file conventions + UI actions + git-hook options); final per-moment trigger choice awaits spec-author confirmation. PR-open trigger via GitHub poller is fully specified.

**Dependencies.** Phase 7 (a non-trivial bundle exists with gate specs to fire against — the `test-bundle`).

**Done when:**
- All five moments dispatch gates correctly when triggered (some via provisional triggers, see above).
- Multi-gate moments produce independent findings streams.
- Gate failures surface in the methodology-gates view with override + fix-and-retry actions.
- Override entries write to the audit log with reason + original findings reference.
- The `test-bundle`'s per-commit moment runs its structure check and banned-string sweep as two independent gates.

**Sizing:** large.

---

## Phase 9 — Discipline-drift engine

**Scope.** Bundle-defined discipline-drift category scanners per C-D7. File-watcher-driven triggers on project doc files. Shared `drift_signals` table with `stream='discipline'`. Surfacing in methodology-gates view and as badges on affected primary units in the modules view. Items associated with affected primary units inherit a methodology-drift indicator.

**Cites:** T-D21, T-D42, §7.14.

**Dependencies.** Phase 7 (the `test-bundle` declares the categories to scan for); Phase 8 (shares the pre-write moment dispatcher for write-time scanners).

**Done when:**
- Discipline-drift scanners instantiate from the bundle's validation-rules section.
- File changes in declared project doc paths fire relevant scanners.
- Signals surface in methodology-gates view, modules view (primary-unit badges), and item-level indicators.
- Freeform-bound projects: no scanners, no signals (verified no-op).

**Sizing:** medium.

---

## Phase 10 — GitHub integration & code-drift detection

**Scope.** GitHub polling (T-D7) at documented cadence; PR state surfacing (badges, timestamps, links); auto-reconcile on merge with confidence-thresholded behaviour (T-D6, T-D18); manual item-to-PR linking (T-D34); code-drift tiers 1–4 (T-D21 code-drift stream); orphaned rule lifecycle (T-D33); PR-open methodology gate enforcement (§7.13) via the gate dispatcher from Phase 8.

**Cites:** T-D6, T-D7, T-D18, T-D21, T-D26, T-D33, T-D34, T-D37 (where archives apply), §7.13, §7.14, §7.16.

**§13 adoptions in this phase:**
- Tier-4 dedup similarity: cosine ≥ 0.80, AI confirmation pass for borderline 0.70–0.80.

**§13 partially-blocking (recommendation present, calibrate during build):**
- Confidence threshold values for GitHub auto-apply. Per T-D6 implication, log confidence scores from day 1; revisit thresholds after first 10 and 50 PR-merge auto-reconcile runs.

**Dependencies.** Phase 5 (reconcile engine), Phase 6 (orphaned rule UI surfaces), Phase 8 (PR-open gate dispatch).

**Note on tier-3:** Tier-3 detection requires Semble code refs to be populated on items. Phase 10 wires the pipeline; tier-3 only produces signals once Phase 11 lands and items have refs.

**Done when:**
- Polling runs at documented cadences with ETag caching.
- PR badges render correctly per state.
- Auto-reconcile on merge takes the high/medium/low branch.
- Manual item-to-PR linking works end-to-end (auto-detect + override + skip).
- Tiers 1, 2, 4 produce signals and badge or inbox correctly.
- Tier-4 stale auto-dismissal records audit reason after 7 days.
- Orphaned rule cleanup PR-draft action works.
- PR-open methodology gate enforcement fires per Phase 8 dispatcher with `moment='pr-open'`.

**Sizing:** large.

---

## Phase 11 — Semble integration

**Scope.** Per-query keyless Semble invocation via `execFile` (T-D27, C-D17 — no backend-managed long-lived service; lifecycle revised at Phase-11 spec clarification); auto-link items to code at done-time (§7.15); plain-English code Q&A; item creation enrichment in dump zone review; tier-3 drift signals fire as items accumulate code refs.

**Cites:** T-D13, T-D27, §7.15, C-D17.

**Dependencies.** Phase 4 (dump zone exists for enrichment), Phase 3 (items have code-ref slots), Phase 1 (backend can shell one-shot children).

**Done when:**
- Semble is invoked per query against the configured per-project repo (Semble owns its per-session index cache).
- Done-time code linking shows top results for confirmation.
- Code Q&A returns plain-English answer with source links.
- Dump zone review modal shows code-ref suggestions.
- Tier-3 code-drift signals begin firing as items accumulate code refs.

**Sizing:** medium.

---

## Phase 12 — Companion review runtime

**Scope.** Workflow engine for bundle-declared review checklists (T-D45, C-D8). Mechanical vs judgement step dispatch. Step state machine. Companion-review judgement steps use Anthropic per SPEC §9. Run summary as optional library note attached to items discussed.

**Cites:** T-D45, T-D10, §7.18, §9.

**Dependencies.** Phase 7 (bundle declares checklists), Phase 6 (library notes for run summaries), Phase 8 (mechanical step execution shares infrastructure with mechanical gates).

**Done when:**
- Bundle-declared checklists instantiate as `ChecklistRun` records.
- Mechanical steps execute and write results to the audit log.
- Judgement steps open the panel; user or AI judgement captured.
- Run summary saves as a library note attached to discussed items when chosen.

**Sizing:** medium.

---

## Phase 13 — Session-start scaffolding

**Scope.** Context-assembly pipeline per C-D9. Bundle-driven companion-mode selection. Anthropic Haiku relevance classification (per SPEC §9). Bundle templates section provides the prompt template. Include-in-prompt directives (T-D12) auto-prepend. UI copy-to-clipboard.

**Cites:** T-D12, T-D45 (companion-runtime kin), §7.18, §9.

**Dependencies.** Phase 6 (include-in-prompt directives), Phase 7 (the `test-bundle` provides non-trivial templates and companion modes), Phase 12 (shares context-assembly idioms with companion-review judgement steps).

**Spec-author gap (CODE_SPEC.md Questions for the spec author 6):** companion modes ↔ review patterns relationship unspecified. Build proceeds with bundle-declared enum + default; spec confirmation tightens the contract.

**Done when:**
- Session-start prompt generation works for a rich-bundle-bound project across the bundle's declared companion modes.
- Include-in-prompt directives appear in generated prompts.
- Cost telemetry records every assembly call.

**Sizing:** medium.

---

## Phase 14 — RAG & intelligence layer

**Scope.** Personal RAG router with three substrates (T-D25): text (local embeddings, C-D2), code (Semble), audit (structured queries). End-of-session retro (§7.18). Periodic review (T-D22) with hygiene queries spanning both drift streams + orphaned rules + bundle-defined hygiene categories. Dependency-aware sequencing ("Do next" view) — methodology-aware: items in primary units failing gates are deprioritised. Stakeholder view toggle (T-D17). Chat history persisted per context (T-D23). Per-list chat panel reading session items + methodology context as input (§7.19).

**Cites:** T-D17, T-D22, T-D23, T-D25, §7.18, §7.19.

**§13 adoptions in this phase:**
- RAG router: keyword heuristics first pass + user-overridable per-query toggle; AI classification deferred.
- Stakeholder view: invalidate cache on item edit.
- Home view "this week" = rolling 7 days from now; "since last visit" = persisted on view exit.
- End-of-session retro: user-initiated only.

**Dependencies.** Phase 6 (library/notes for retros), Phase 8 (gate firings populate audit history), Phase 10 (audit log populated with PR events), Phase 11 (Semble for code substrate), Phase 9 (discipline-drift signals available for periodic review hygiene).

**Done when:**
- Each intelligence feature triggers human-initiated AI calls.
- RAG router produces answers across substrates with citations, scoped per active project.
- Periodic review surfaces hygiene questions spanning code-drift, discipline-drift, orphaned rules, and bundle-declared hygiene categories.
- Stakeholder toggle re-renders content with cache invalidation on edit.
- Per-list chat reads session items + methodology context as input.

**Sizing:** large.

---

## Phase 15 — Backup, cost meter, settings polish, hygiene

**Scope.** Single-file datastore backup with header indicator (T-D28); optional auto-copy target; manual timestamped export; cost meter (T-D29) wired live with per-feature breakdown and daily threshold warning; orphaned rules panel (T-D33) in settings; settings panel covers every knob in §7.25.

**Cites:** T-D28, T-D29, T-D33, §7.25.

**§13 unresolved (no recommendation in spec):**
- Cost meter daily threshold default value: no recommendation in spec. Phase implementation will default to "no threshold / never warn" with a settings toggle, pending direction.

**Dependencies.** Phase 1 (datastore file), Phase 14 (cost telemetry from real AI calls).

**Done when:**
- Header backup indicator turns red after threshold days without backup.
- Manual export downloads timestamped file.
- Auto-copy works when target path set.
- Cost meter shows live spend with per-feature breakdown across day/week/month.
- Orphaned rules panel functional.
- Settings panel exposes every knob in §7.25, including per-project methodology bundle binding.

**Sizing:** small.

---

## Phase 16 — Definition-of-Done walkthrough & v1 cut

**Scope.** Walk every bullet of SPEC §11. Close gaps. Cut release.

**Dependencies.** Phases 1–15 substantially complete.

**Done when:** every §11 bullet is checkable.

**Sizing:** small.

---

## Phase 19 — `.throughline/` config and CLI init

**Scope.** Per-repo `.throughline/project.json` and optional `.throughline/bundle.md`; the bundle loader's third resolution arm (explicit external path → per-repo `.throughline/bundle.md` → install-shipped default); the `throughline init` CLI subcommand against the running backend.

**Dependencies.** Phases 1–18 substantially complete; bundle loader and SettingsView present.

**Done when:** a fresh clone of a repo carrying `.throughline/bundle.md` binds the bundle without manual `bundle_path` setup; `throughline init` writes via the existing HTTP endpoint with the backend running; auto-detection of `github_owner` / `github_repo` from git remote works when absent.

**Sizing:** medium.

---

## Phase 20 — Bootstrap import file shape and idempotent re-run

**Scope.** Bootstrap file schema (items, sessions, library entries per source type per T-D53); deterministic `bootstrap_id` derivation per source type plus the universal `@bootstrap-id:` override (T-D54); idempotent upsert on `(project_id, bootstrap_id)` with three row states (new, reimported, conflicted); bundle-aware ingest validation that rejects shapes violating the bound bundle's declarations; explicit exclusions of secrets, audit history, embeddings, settings, methodology bindings.

**Dependencies.** Phase 19 complete (`.throughline/` config available).

**Done when:** a bootstrap file produces an equivalent-state import on re-run; user-edited rows surface to a conflict queue rather than silent overwrite; bundle-aware validation rejects shapes that violate the bound bundle's item declarations; stale rows are flagged but never auto-deleted.

**Sizing:** large.

---

## Phase 21 — Bootstrap prompt template and Claude Code invocation contract

**Scope.** Repo-owned generic prompt template at `packages/backend/src/bootstrap/prompt-template.md` (T-D55); render endpoint that prepends the fixed parameter block and writes `.throughline/bootstrap-prompt.md`; file-mediated Claude Code invocation (T-D56) — Throughline writes the prompt, the user invokes Claude Code in their normal environment, Claude Code writes `.throughline/bootstrap-output.json`; chokidar watcher on the output file mirroring the inbox/watcher.ts pattern; archive-on-success / quarantine-on-failure worker; SettingsView init UX block surfacing bootstrap state.

**Dependencies.** Phase 20 complete (bootstrap import pipeline ready).

**Done when:** rendering a prompt and manually invoking Claude Code produces a valid `bootstrap-output.json` that ingests cleanly via the Phase 20 endpoint; archive captures successful ingests; failures land in quarantine with a sibling `.error.json` carrying the validator error.

**Sizing:** medium.

---

## Phase 22 — Discipline-drift scan-on-demand for bootstrapped projects

**Scope.** Discipline-scan state tracking on projects (pre-scan / running / complete, with a last-run timestamp); SettingsView "Run discipline scan" trigger surfaced prominently for bootstrap-imported projects pre-first-scan and as a re-scan affordance afterward; periodic-review scheduling gating on first-scan completion; on-bind scanner behaviour for non-bootstrapped projects unchanged.

**Dependencies.** Phase 21 complete (bootstrap pipeline produces bootstrap-imported projects with the relevant state).

**Done when:** projects created via the bootstrap pipeline do not auto-run discipline-drift scanners on bind; the user-invoked first scan flips the project's state to complete and re-enables periodic-review scheduling; on-bind scanning for non-bootstrapped projects continues unchanged.

**Sizing:** small.

The Phase 19–22 chain is linear — each phase depends on the prior phase's surfaces (Phase 22 on Phase 21's bootstrap-imported-project state; Phase 21 on Phase 20's ingest endpoint; Phase 20 on Phase 19's `.throughline/` directory contract). No parallelisation across the chain is intended; each phase ships before the next opens.

---

## §13 adoption summary

Recommended defaults from SPEC §13 adopted into the build at the phase level:

| § Open question | Recommendation | Adopted in |
|---|---|---|
| Reminder semantics | Relative + absolute + recurrence rules | Phase 6 |
| Recurring reminders | Persist until directive removed | Phase 6 |
| Stakeholder view caching | Invalidate on item edit | Phase 14 |
| Code TODO/FIXME patterns | Defaults `TODO:`, `FIXME:`, `XXX:` | Phase 4 |
| Library prompt variable syntax | `{{var_name}}` | Phase 6 |
| Tier-4 dedup similarity threshold | Cosine ≥ 0.80, AI confirmation 0.70–0.80 | Phase 10 |
| Home view semantics | "This week" = rolling 7d; "since last visit" = persisted on exit | Phase 14 |
| RAG router | Keyword heuristics first; user-overridable | Phase 14 |
| Repo `.md` re-ingest | Snapshot + per-entry track-source toggle | Phase 6 |
| TODO/FIXME import trigger | Manual invocation in v1 | Phase 4 |
| End-of-session retro trigger | User-initiated only | Phase 14 |
| Confidence threshold values | Calibrate during build; instrument from day 1 | Phase 10 (pinning), §11 (DoD) |
| Bundle versioning | None in v1; bundles always-current; bundle change events audit-logged | Phase 1 |

Recommended values were adopted as-is unless implementation revealed an issue. Any deviation requires a SPEC.md amendment.

---

## §13 unresolved (no recommendation in spec)

These do not block phases at the build level (defaults can be chosen for the implementation), but the policy itself is for the spec author to settle:

| § Open question | Phase impacted | Build-time default proposed |
|---|---|---|
| Voice input language | Phase 4 | English only with settings toggle, pending direction |
| Cost meter daily threshold default | Phase 15 | No threshold / never warn, with settings toggle, pending direction |

Both are flagged in CODE_SPEC.md's Questions for the spec author.

---

## Spec-author gaps surfaced during regeneration (CODE_SPEC.md Questions for the spec author)

These are not §13 open questions but gaps in SPEC.md v5.1 that surfaced during the regeneration. None hard-block a phase; each carries a provisional v1 mechanism that may need confirmation or change:

| Gap | Phase impacted | Provisional v1 approach |
|---|---|---|
| Pre-write gate trigger mechanism | Phase 8 | Signal file in Throughline inbox + UI action |
| Per-commit gate detection | Phase 8 | Watch `.git/COMMIT_EDITMSG` or user-installed pre-commit hook |
| Plan-mode gate detection | Phase 8 | Plan-mode marker file in Claude Code inbox |
| Post-commit detection | Phase 8 | Git log poll on active branch or user-installed post-commit hook |
| Bundle markdown convention | Phase 1 | H2 headings (`## 1. Identity` etc.) per C-D3 |
| Companion modes ↔ review patterns relationship | Phase 13 | Bundle-declared enum with default per C-D9 |
| Verifier-tool plurality | Phase 10 | Semgrep only in v1; bundle declares conventions per T-D26 |

Confirmation tightens the contract; if spec direction differs from a provisional approach, the affected phase absorbs the change.

---

## Sequencing notes

### Hard-sequential dependencies

- Phase 1 → Phase 2 (UI needs backend + bundle loader).
- Phase 2 → Phase 3 (CRUD needs view shell).
- Phase 3 → Phase 5 (reconcile mutates items).
- Phase 3 → Phase 7 (rich-bundle wiring depends on item infrastructure being bundle-parameterisable).
- Phase 7 → Phase 8 (gates need a non-trivial bundle to fire against; freeform declares no gates).
- Phase 7 → Phase 9 (discipline-drift needs a bundle that declares categories).
- Phase 8 → Phase 10 (PR-open gate uses the gate dispatcher).
- Phase 11 → tier-3 of Phase 10 (code refs required for tier-3 signals).
- Phase 12 → Phase 13 (session-start shares context-assembly idioms with companion-review).
- Phase 8 → Phase 12 (mechanical step execution shares infrastructure with mechanical gates).
- Phase 14 depends on Phases 6, 8, 9, 10, 11 for substrate coverage.

### Parallelism opportunities

- **Phase 6 ‖ Phase 5**: library + directives land alongside reconcile once Phase 4 lands.
- **Phase 11 (Semble) ‖ Phase 10**: Semble track is independent until tier-3 wiring.
- **Phase 9 (discipline-drift) ‖ Phase 10 (code-drift)**: streams land independently.
- **Phase 12 ‖ Phase 13**: companion review and session-start scaffolding can land in either order once Phase 7 lands.
- **Templates** (`templates/github-actions/throughline-semgrep.yml`, session-start prompt, `test-bundle` markdown drafting): can be drafted at any time; the `test-bundle` drafting is the long pole for Phase 7.

### Minimum useful product

The smallest slice of Throughline that delivers the core promise:

- **Phase 1** (backend + datastore + project model + bundle loader + freeform bundle)
- **Phase 2** (UI shell with nine view modes routing)
- **Phase 3** (items, sessions, manual entry, detail panel; works under freeform bundle)
- **Phase 4** (capture: at minimum scratchpad, session dump zone, Claude Code push)
- **Slim Phase 10** (GitHub PR state surfacing only — badges + manual link; no auto-reconcile yet)
- **Slim Phase 15** (manual export + backup-stale header indicator)

At this point a freeform-bound project tracks tasks across parallel sessions with capture surfaces and knows about PRs at a glance. Skips reconcile-engine niceties, drift detection, library, directives, Semble, RAG, methodology gates, rich-bundle wiring, companion review, session-start scaffolding. The user can start using it for parallel-session tracking on lightweight projects and accept that the rich-discipline path isn't wired in yet.
