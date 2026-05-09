# Throughline v1 — Roadmap

Sequenced build plan. Each phase has a scope, dependencies, done criteria, and adopts §13 recommended defaults where it makes sense to fix the policy at the implementation point. Phases that depend on §13 questions without a recommended default are flagged.

§13 adoption legend at the bottom of this file lists every recommended default applied and the section reference.

---

## Phase 0 — Repo bootstrap & decision freeze (this session)

**Scope.** Repo skeleton, SPEC.md placement, README, full T-D ledger in DECISIONS.md, CODE_SPEC.md, this roadmap, empty CHECKLIST.md.

**Dependencies.** None.

**Done when:** all six top-level docs (README, SPEC, CODE_SPEC, DECISIONS, ROADMAP, CHECKLIST) exist; SPEC.md edits limited to §16/§14/TL;DR carve-out; T-D ledger has 39 entries; rationale-needed marked for unrecoverable cases.

**Sizing:** 1 session.

---

## Phase 1 — Backend skeleton & datastore

**Scope.** Backend process bootstrap, SQLite datastore, schema migrations, settings load/save, secrets file separation (T-D4), audit log scaffolding (T-D37), cost telemetry table (T-D30 placeholder), health endpoint, login auto-start documentation.

**Cites:** T-D2, T-D3, T-D4, T-D20, T-D32, T-D37, C-D1.

**Dependencies.** Phase 0.

**Done when:**
- Backend starts on a documented single command and exposes `127.0.0.1:<port>`.
- Datastore file created on first run with all tables migrated.
- Settings round-trip via REST.
- Audit log records test mutations.
- Login auto-start documented (not necessarily enabled by default).

**Sizing:** small.

---

## Phase 2 — Browser UI shell & view-mode plumbing

**Scope.** React app served by backend; routing for six view modes (home, sessions, tree, graph, library, directives); header with view-mode toggle, scratchpad placeholder, cost meter placeholder; command palette skeleton (`Cmd+K`); keyboard navigation primitives; SSE wiring for backend-pushed updates.

**Cites:** T-D31, §7.9, §7.21, §7.22, C-D1.

**Dependencies.** Phase 1.

**Done when:**
- All six view modes route and render an empty stub.
- Command palette opens, closes, fuzzy-search infrastructure works.
- SSE channel established; ping/pong demonstrates connectivity.

**Sizing:** medium.

---

## Phase 3 — Items, sessions, manual entry, item detail panel

**Scope.** CRUD for items + sessions; status lifecycle (todo: 4 states; decision: 3 states); blocker references (free-text + structured per T-D8); tags; parent/children; session memberships (T-D1); branch reference (T-D39); item detail panel (§7.14); todos/decisions boards (§7.3).

**Cites:** T-D1, T-D8, T-D39, §7.2, §7.3, §7.14.

**Dependencies.** Phase 2.

**Done when:**
- Items + sessions CRUD via UI.
- Lifecycle transitions audit-logged.
- Blocker chain renders in detail panel.
- Manual entry inline form on each board, keyboard-driven.

**Sizing:** medium.

---

## Phase 4 — Capture surfaces

**Scope.** Scratchpad (T-D21); session/library dump zone with AI extraction + review modal (T-D5); voice input (desktop-only, §7.4); Claude Code push via watched FS inbox (T-D17, T-D38); code TODO/FIXME import.

**Cites:** T-D5, T-D17, T-D21, T-D38, §7.4.

**§13 adoptions in this phase:**
- TODO/FIXME default patterns: `TODO:`, `FIXME:`, `XXX:`.
- TODO/FIXME trigger: manual invocation only in v1.

**§13 unresolved (no recommendation in spec):**
- Voice input language: English only vs browser-locale auto. Flagged in CODE_SPEC.md Questions for the spec author. Phase implementation will default to English only with a settings toggle, pending direction.

**Dependencies.** Phase 3 (items must exist before capture targets them).

**Done when:**
- All five non-scratchpad surfaces route through review modal and apply cleanly.
- Scratchpad captures friction-free with no AI.
- Inbox watcher archives processed files; quarantines failures with error metadata.
- Voice input transcript pipes into dump zone flow.

**Sizing:** large.

---

## Phase 5 — Reconcile engine

**Scope.** Six-category diff (T-D36): completed, new, edited, blocker changes, contradicted, no-change. Apply flow. Review modal UI. Contradicted-as-drift hand-off (creates drift signal, does not auto-revert).

**Cites:** T-D5, T-D36, T-D22, §7.5.

**Dependencies.** Phase 3 (items exist), Phase 4 (capture provides input).

**Done when:**
- Reconcile against any session produces a faithful six-category diff.
- Apply mutates state and audit-logs every change.
- Contradicted spawns drift signal (tier-2 if PR associated, tier-3 otherwise).

**Sizing:** medium.

---

## Phase 6 — Library, directives, repo `.md` ingestion

**Scope.** Four library content types (T-D10): notes, prompts, snippets, imported docs. Notes ↔ items many-to-many (T-D9). Three directive types (T-D12) with OS notification firing for reminders (T-D33). Directives view grouped by type (§7.8). Repo `.md` ingestion folder-opt-in (T-D11).

**Cites:** T-D9, T-D10, T-D11, T-D12, T-D33, §7.6, §7.7, §7.8.

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

## Phase 7 — GitHub integration & drift detection (tiers 1–4)

**Scope.** GitHub polling (T-D7) at documented cadence; PR state surfacing (badges, timestamps, links); auto-reconcile on merge with confidence-thresholded behaviour (T-D6, T-D19); manual item-to-PR linking (T-D35); tier-1 Semgrep drift via GitHub API (T-D27); tier-2 revert events; tier-3 file-touched (uses Semble code refs from Phase 8 once available); tier-4 dedup with 7-day auto-dismissal (T-D22); orphaned rule lifecycle (T-D34).

**Cites:** T-D6, T-D7, T-D19, T-D22, T-D27, T-D34, T-D35, T-D38 (where archives apply).

**§13 adoptions in this phase:**
- Tier-4 dedup similarity: cosine ≥ 0.80, AI confirmation pass for borderline 0.70–0.80.

**§13 partially-blocking (recommendation present, calibrate during build):**
- Confidence threshold values for GitHub auto-apply. Per T-D6 implication, log confidence scores from day 1; revisit thresholds after first 10 and 50 PR-merge auto-reconcile runs.

**Dependencies.** Phase 5 (reconcile engine), Phase 6 (orphaned rule UI surfaces).

**Note on tier-3:** Tier-3 detection requires Semble code refs to be populated on items. Phase 7 wires the pipeline; tier-3 only produces signals once Phase 8 lands and items have refs.

**Done when:**
- Polling runs at documented cadences with ETag caching.
- PR badges render correctly per state.
- Auto-reconcile on merge takes the high/medium/low branch.
- Manual item-to-PR linking works end-to-end (auto-detect + override + skip).
- Tiers 1, 2, 4 produce signals and badge or inbox correctly.
- Tier-4 stale auto-dismissal records audit reason after 7 days.
- Orphaned rule cleanup PR-draft action works.

**Sizing:** large.

---

## Phase 8 — Semble integration

**Scope.** Backend-managed Semble local service (T-D28); auto-link items to code at done-time (§7.12); plain-English code Q&A; item creation enrichment in dump zone review.

**Cites:** T-D13, T-D28, §7.12.

**Dependencies.** Phase 4 (dump zone exists for enrichment), Phase 3 (items have code-ref slots), Phase 1 (backend can spawn Semble).

**Done when:**
- Semble starts and indexes the configured repo.
- Done-time code linking shows top results for confirmation.
- Code Q&A returns plain-English answer with source links.
- Dump zone review modal shows code-ref suggestions.
- Tier-3 drift signals begin firing as items accumulate code refs.

**Sizing:** medium.

---

## Phase 9 — RAG & intelligence layer

**Scope.** Personal RAG router with three substrates (T-D26): notes (local embeddings, C-D2), code (Semble), audit (structured queries). End-of-session retro (§7.15). Periodic review (T-D23) with hygiene queries. Dependency-aware sequencing ("Do next" view). Stakeholder view toggle (T-D18). Chat history persisted per context (T-D24). Per-list chat panel (§7.16).

**Cites:** T-D18, T-D23, T-D24, T-D26, §7.15, §7.16.

**§13 adoptions in this phase:**
- RAG router: keyword heuristics first pass + user-overridable per-query toggle; AI classification deferred.
- Stakeholder view: invalidate cache on item edit.
- Home view "this week" = rolling 7 days from now; "since last visit" = persisted on view exit.
- End-of-session retro: user-initiated only.

**Dependencies.** Phase 6 (library/notes), Phase 7 (audit log populated with state transitions and PR events), Phase 8 (Semble for code substrate).

**Done when:**
- Each intelligence feature triggers human-initiated AI calls.
- RAG router produces answers across substrates with citations.
- Periodic review surfaces hygiene questions including orphaned rules.
- Stakeholder toggle re-renders content with cache invalidation on edit.
- Per-list chat reads session items as context.

**Sizing:** large.

---

## Phase 10 — Backup, cost meter, hygiene polish

**Scope.** Single-file datastore backup with header indicator (T-D29); optional auto-copy target; manual timestamped export; cost meter (T-D30) wired live with per-feature breakdown and daily threshold warning; orphaned rules panel (T-D34) in settings; settings panel covers every knob in §7.22.

**Cites:** T-D29, T-D30, T-D34, §7.22.

**§13 unresolved:**
- Cost meter daily threshold default value: no recommendation in spec. Phase implementation will default to "no threshold / never warn" with a settings toggle, pending direction.

**Dependencies.** Phase 1 (datastore file), Phase 9 (cost telemetry from real AI calls).

**Done when:**
- Header backup indicator turns red after threshold days without backup.
- Manual export downloads timestamped file.
- Auto-copy works when target path set.
- Cost meter shows live spend with per-feature breakdown across day/week/month.
- Orphaned rules panel functional.
- Settings panel exposes every knob.

**Sizing:** small.

---

## Phase 11 — Definition-of-Done walkthrough & v1 cut

**Scope.** Walk every bullet of §11. Close gaps. Cut release.

**Dependencies.** Phases 1–10 substantially complete.

**Done when:** every §11 bullet is checkable.

**Sizing:** small.

---

## §13 adoption summary

Recommended defaults from §13 adopted into the build at the phase level:

| § Open question | Recommendation | Adopted in |
|---|---|---|
| Reminder semantics | Relative + absolute + recurrence rules | Phase 6 |
| Recurring reminders | Persist until directive removed | Phase 6 |
| Stakeholder view caching | Invalidate on item edit | Phase 9 |
| Code TODO/FIXME patterns | Defaults `TODO:`, `FIXME:`, `XXX:` | Phase 4 |
| Library prompt variable syntax | `{{var_name}}` | Phase 6 |
| Tier-4 dedup similarity threshold | Cosine ≥ 0.80, AI confirmation 0.70–0.80 | Phase 7 |
| Home view semantics | "This week" = rolling 7d; "since last visit" = persisted on exit | Phase 9 |
| RAG router | Keyword heuristics first; user-overridable | Phase 9 |
| Repo `.md` re-ingest | Snapshot + per-entry track-source toggle | Phase 6 |
| TODO/FIXME import trigger | Manual invocation in v1 | Phase 4 |
| End-of-session retro trigger | User-initiated only | Phase 9 |
| Confidence threshold values | Calibrate during build; instrument from day 1 | Phase 7 (pinning), §11 (DoD) |

Recommended values were adopted as-is unless implementation revealed an issue. Any deviation requires a SPEC.md amendment.

## §13 unresolved (no recommendation in spec)

These do not block phases at the build level (defaults can be chosen for the implementation), but the policy itself is for the spec author to settle:

| § Open question | Phase impacted | Build-time default proposed |
|---|---|---|
| Voice input language | Phase 4 | English only with settings toggle, pending direction |
| Cost meter daily threshold default | Phase 10 | No threshold / never warn, with settings toggle, pending direction |

Both are flagged in CODE_SPEC.md's Questions for the spec author.

---

## Sequencing notes

### Hard-sequential dependencies

- Phase 1 → Phase 2 (UI needs backend).
- Phase 2 → Phase 3 (CRUD needs view shell).
- Phase 3 → Phase 5 (reconcile mutates items).
- Phase 5 → Phase 6 (review modal pattern reused; library mutations also reconcile-eligible).
- Phase 7 → Phase 8 effective tier-3 signals (need Semble code refs).
- Phase 8 → Phase 9 code substrate of RAG.

### Parallelism opportunities

- **Phase 6 ‖ Phase 5**: library + directives can land alongside reconcile once Phase 4 lands. Library doesn't need reconcile to be useful.
- **Phase 10 incremental**: cost meter, settings panel polish, and backup tooling can accumulate from Phase 1 onward. Pieces that land early reduce the Phase 10 scope.
- **Templates** (`templates/github-actions/throughline-semgrep.yml`, session-start prompt): can be drafted at any time; no code dependency.
- **Phase 8 (Semble)** can begin in parallel with Phase 7 if the Semble process integration is treated as an isolated track. Tier-3 wiring on the Phase 7 side waits for Phase 8 to land.

### Minimum useful product

The smallest slice of Throughline that delivers the core promise:

- **Phase 1** (backend + datastore)
- **Phase 2** (UI shell)
- **Phase 3** (items, sessions, manual entry, detail panel)
- **Phase 4** (capture: at minimum scratchpad, session dump zone, Claude Code push)
- **Slim Phase 7** (PR state surfacing only — badges + manual link, no auto-reconcile yet)
- **Slim Phase 10** (manual export + backup-stale header indicator)

This captures items, runs sessions, reconciles via the dump zone, and knows about PRs at a glance. Skips reconcile-engine niceties, drift detection beyond manual review, library, directives, Semble, RAG. A user could start using it for parallel-session tracking at this point and accept that drift hasn't been wired in yet.
