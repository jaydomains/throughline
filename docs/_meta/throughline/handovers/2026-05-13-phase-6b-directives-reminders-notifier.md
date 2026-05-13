<!-- Template version: 1.0 -->

# Throughline — Phase 6b Handover

**Generated:** 2026-05-13 (pre-merge)
**Last commit SHA:** see PR head — 2026-05-13
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-13-phase-6a-library-content.md` (Phase 6a — library content)

Phase 6 was sliced into 6a / 6b / 6c at session author's direction. 6b (this slice) lands the directives layer: three directive types (pin, reminder, include_prompt per T-D12); backend directives service with audit coverage; reminder scheduler with test-seam injection; OS notification capability layer (T-D32) with graceful no-op fallback when `node-notifier` is unavailable; frontend `DirectivesView` with three collapsible groups, count-per-group, reminder sort-by-next-firing; `DirectiveModal` covering all three kinds with absolute/relative reminder paths + optional recurrence; `DirectiveBadge` presence indicator; "Directives (n)" header hint; pin scope for Phase 6 = session board column + library sidebar list. Slice 6c (repo `.md` ingestion) remains deferred.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Three directive types: pin, reminder, include-in-prompt (T-D12) | built | `packages/shared/src/directives.ts` `DIRECTIVE_KINDS` + payload shapes; `packages/backend/src/directives/service.ts` CRUD validates per-kind; `packages/frontend/src/components/DirectiveModal.tsx` switches form fields per kind; backend "creates a pin directive on an item and audits the create" + "creates an absolute reminder and stores next_fire_at" + "list filters by kind and parent" | All three kinds first-class; payload shape determines scheduling vs surfacing semantics. |
| Pin: parent view shows pinned item sticky (Phase 6 pin scope = session board + library sidebar) | built | `packages/frontend/src/components/Board.tsx` partitions column items into pinned/unpinned with a `📌 pinned` divider; `packages/frontend/src/views/LibraryView.tsx` partitions the sidebar list; frontend "renders pinned entries above unpinned ones with a divider" + "adding a pin via the entry editor pushes the entry to the top" | Tree/graph/modules pin scope deferred per the 6a handover's parked-items note. |
| Reminder: relative + absolute + recurrence rules (§13 adopted defaults) | built | Shared helpers `parseRelativeReminder` + `computeNextFireAt` + `advanceRecurrence` in `packages/shared/src/directives.ts`; backend service validates + normalises payloads; frontend modal exposes mode radio + recurrence checkbox; backend "creates an absolute reminder and stores next_fire_at" + "creates a relative reminder and resolves next_fire_at via the shared parser" + "rejects an unrecognised relative_spec" and frontend "creates an absolute reminder from the library editor" + "creates a relative reminder with recurrence" | Relative-spec grammar (v1): `in N {minute|hour|day|week}s?`, `tomorrow [HH:MM]`. Unrecognised → 400/InvalidPayloadError; documented in Drift Flags. |
| Reminder fires OS notification regardless of browser tab state (T-D32) | built | `packages/backend/src/directives/scheduler.ts` polls `listDueReminders` on a configurable tick (default 30s) and dispatches via the T-D32 notifier capability layer in `packages/backend/src/notifier/index.ts`; scheduler started in `server.ts` and stopped in `close()`, lifecycle bound to the long-lived backend; backend "tick fires a past-due reminder via the notifier and marks it fired" | T-D32 abstraction lands today; `node-notifier` is an optional dep (lazy `createRequire` probe) — when absent the capability layer warns and degrades to the in-memory no-op notifier (SPEC §15 degrade-gracefully). |
| Recurring reminders persist until directive removed (§13 adopted default) | built | `markFired` advances `next_fire_at` from the previous schedule (not from `now`) to anchor the cadence; one-shot reminders set `next_fire_at=NULL` and the row remains; backend "markFired on recurring advances next_fire_at by the recurrence interval" + "one-shot reminder does not refire on the next tick" + "recurring reminder re-arms and fires again on a later tick" | Removal still costs the user one explicit delete; UI surfaces edit/delete affordances in the directives view + per-parent panel. |
| Include-in-prompt directive: session-start prompt auto-prepends flagged items (placeholder hook until Phase 13) | built (data side) | `kind='include_prompt'` directives stored + queryable via `service.list({ kind: 'include_prompt' })` and `listForParent`; UI surfaces the toggle in `DirectiveModal`; frontend "renders three collapsible groups with per-group counts" | The actual session-start prompt assembly is Phase 13 territory — 6b records the directive today so Phase 13 plugs in without route churn. |
| Directives view groups by type | built | `packages/frontend/src/views/DirectivesView.tsx` renders three sections (`directives-group-pin`, `…-reminder`, `…-include_prompt`); frontend "renders three collapsible groups with per-group counts" | Fixed ordering matches SPEC §7.10 (Pinned, Reminders, Include-in-prompt). |
| Directives view shows count per group, each collapsible | built | `directives-count-<kind>` test ids; header `role="button" aria-expanded` toggles per-group; frontend "renders three collapsible groups with per-group counts" + "collapses a group on header click" | Local UI state, not persisted — refresh resets to all-expanded. |
| Reminders sorted by next firing within their group | built | `sortDirectives('reminder', …)` uses `next_fire_at.localeCompare`; null next_fire_at (one-shots that already fired) sorts last; frontend "sorts reminders by next_fire_at within their group" | Pin and include_prompt groups stay in insertion (create-time) order — spec doesn't require sorting. |
| Directives audit-logged (T-D36) | built | `service.create / update / delete / markFired` all call `appendAudit` with `entity_type='directive'`; per-action fields (`create`, `payload`, `delete`, `fired`); backend "creates a pin directive on an item and audits the create" + "update recomputes next_fire_at and audit-logs the payload change" + "delete removes the directive and audits" | New `directive` value added to `AuditEntityType` in `packages/shared/src/audit.ts`. |
| Item detail panel surfaces directives | built | `packages/frontend/src/components/ItemDetailPanel.tsx` replaced the Phase 6 "(directives in Phase 6b)" placeholder with a live `Directives (n)` section + Add/Edit/Delete buttons that mount `DirectiveModal` | Co-located with the existing T-D9 "Attached notes" section; same pattern as 6a. |
| "Directives (n)" header hint | built | `packages/frontend/src/components/Header.tsx` mounts `useDirectives(activeProjectId)` and renders a `directives-hint` pill linking to the directives view; frontend "shows the active count and links to the directives view" | Per-project count; switches when `activeProjectId` changes. |
| Directives view: navigates to parent on row click | built | `navigateToParent` routes to `/projects/:id/tree?item=…` for items and `/projects/:id/library?entry=…` for library entries | Query-string consumers in tree/library views are out of scope for 6b (the URL works as a deep link; consumers can be wired in their own polish slices). |

---

## Last Decision Minted

No new T-D anchors. Implementation followed existing decisions: T-D12 (three directive types), T-D32 (single OS-notification capability layer), T-D36 (audit coverage), §13 adopted defaults (recurring-reminder persistence, relative + absolute + recurrence semantics).

Conventions adopted (apply going forward):

- **Capability layer for OS-platform integrations — lazy `createRequire` probe + no-op fallback.** First T-D32 consumer here (`packages/backend/src/notifier/index.ts`). The pattern: define the interface in the capability module; production factory probes for the platform module via `createRequire(import.meta.url)` inside a try/catch; if the dep is missing, log a one-time warn and hand back a recorded-calls no-op so dev/test/CI never break. Future capability layers (Phase 11 Semble child-process spawn, Phase 12 GitHub webhook signing, any external platform dep) should follow the pattern: optional dep, lazy probe, no-op fallback, callable-with-clear-warn when absent.
- **Test-seam injection via `now` factory + manual `tick()`.** First applied in `createReminderScheduler({ now, … }).tick()`. Tests pass a closure-captured `now` value and call `tick()` directly rather than relying on `setTimeout`-based fakes. Reused by `createDirectivesService({ now })` for deterministic `computeNextFireAt`. Future schedulers (Phase 9 periodic reviews, Phase 14 RAG re-index) should default to the same shape: factory accepts `now: () => Date`, lifecycle exposes `tick()` separately from `start()/stop()` so unit tests skip the interval machinery.
- **Shared-helper grammar for cross-package parsing.** Extends the Phase 6a convention (`extractPromptVariables` / `renderPromptBody`). `parseRelativeReminder` + `computeNextFireAt` + `advanceRecurrence` live in `packages/shared/src/directives.ts`; backend service uses them to validate + normalise payloads; frontend modal uses them indirectly via the backend's reject-on-invalid-spec behaviour. Future surfaces with structured grammars (Phase 13 session-start template tokens, Phase 12 companion-review marker syntax) should adopt the same pattern.
- **Anchor recurrence cadence to the previous schedule, not `now`.** `markFired` advances from `existing.next_fire_at` rather than from `now`. The implication: a late-firing recurring reminder doesn't drift the cadence forward by the delay. First lands here; periodic-review scheduling in Phase 14 (currently TBD) should follow the same convention.
- **Auditable systemic-actor mutations.** `markFired` writes an audit row with `actor='system'` and `field='fired'`. This is the first non-user mutation that's audit-logged (previous phases were all `actor='user'`). Future automated mutations (Phase 11 Semble code-ref updates, Phase 14 periodic-review nudges) should follow: actor identifies the subsystem, field names the action, trigger_context carries the next state.
- **Pin scope rolls out per parent-view, not per phase.** Phase 6 sets the contract that pin sticks an item/entry to the top of its parent view; the 6b release wires pin into the two parent views that already exist with stable list semantics (session board column, library sidebar). Tree/graph/modules pin surfacing waits for those views' own polish slices, when they own the partition logic. Future view authors landing a list-shaped surface should add pin partitioning at the same time, not as a follow-up.

---

## Active Blockers

_none_

Provisional / parked items:
- **Pin surfacing in tree/graph/modules views.** Deferred — see "Pin scope rolls out per parent-view" convention above. Tracked as a parked item to surface when those views' own slices land (Phase 7+ for modules/tree polish, Phase 11+ for graph).
- **`node-notifier` optional dep.** Not added to `packages/backend/package.json` — the lazy probe means dev/test/CI work without it. Adding the dep is a one-line change when a user wants native firing; the abstraction is in place. Documented as the operator-facing knob in the warn message ("install node-notifier to enable native firing").
- **Deep-link consumers for the directives row click-through.** `DirectivesView` navigates to `/projects/:id/tree?item=<id>` and `/projects/:id/library?entry=<id>`. The library view doesn't yet read `?entry` from the URL to auto-select; the tree view doesn't yet exist as a navigable surface. Both are polish-slice work for their respective views; the URLs are stable so consumers can wire up without churn.

---

## Files Changed Since Last Handover

**New (backend):**
- `packages/backend/src/db/migrations/0005_directives_extensions.sql` — `last_fired_at` column on `directives`; `(parent_type, parent_id)` and partial-NOT-NULL `(next_fire_at)` indices.
- `packages/backend/src/notifier/index.ts` — T-D32 OS notification capability layer; `createOsNotifier` + `createNoopNotifier`; lazy `node-notifier` probe via `createRequire(import.meta.url)`.
- `packages/backend/src/directives/service.ts` — `createDirectivesService` with CRUD, `listDueReminders`, `markFired`, `countByKind`; error classes (`DirectiveNotFoundError`, `ParentNotFoundError`, `CrossProjectDirectiveError`, `InvalidPayloadError`, `InvalidKindError`, `InvalidParentTypeError`).
- `packages/backend/src/directives/routes.ts` — REST endpoints (`GET /api/projects/:id/directives`, `POST`, `PATCH /:directiveId`, `DELETE /:directiveId`, parent-scoped listings).
- `packages/backend/src/directives/scheduler.ts` — `createReminderScheduler` with `now` factory injection + manual `tick()` test seam.

**New (shared):**
- `packages/shared/src/directives.ts` — `DIRECTIVE_KINDS / DIRECTIVE_PARENT_TYPES / REMINDER_UNITS` arrays + guards; `Directive / CreateDirectiveInput / UpdateDirectiveInput / PinPayload / ReminderPayload / IncludePromptPayload` types; `parseRelativeReminder / computeNextFireAt / advanceRecurrence / isReminderArmed` helpers.

**New (frontend):**
- `packages/frontend/src/views/DirectivesView.tsx` — three-group collapsible directives view; replaces the `views/stubs.tsx` stub.
- `packages/frontend/src/components/DirectiveModal.tsx` — create/edit modal covering all three kinds; reminder absolute + relative + recurrence + note fields.
- `packages/frontend/src/components/DirectiveBadge.tsx` — small presence-indicator glyph with kind-aware tooltip.
- `packages/frontend/src/hooks/useDirectives.ts` — directives loader + `byParent` map + `countByKind` + `directivesFor` + `isPinned` helpers.

**New (tests):**
- `packages/backend/test/directives.test.ts` — 13 tests covering CRUD per kind on both parent types, cross-project + parent-not-found guards, absolute + relative reminder resolution, update recomputes next_fire_at, list filtering, delete + audit, listDueReminders, markFired one-shot vs recurring, countByKind.
- `packages/backend/test/directives-scheduler.test.ts` — 4 tests covering tick-fires-due-reminder via notifier + markFired, one-shot non-refire, recurring re-arm, pin/include_prompt never picked up.
- `packages/backend/test/notifier.test.ts` — 3 tests covering noop-notifier records, createOsNotifier degrade-gracefully when probe returns null, createOsNotifier uses injected backend.
- `packages/frontend/test/directives.test.tsx` — 9 tests covering three-group render + counts + collapse + delete; reminder sorted by next_fire_at; library pin surfacing above unpinned with divider; pinning via editor lifts to top; reminder modal absolute + relative + recurrence paths; header `directives-hint` count.

**Modified (backend):**
- `packages/backend/src/server.ts` — wires `createDirectivesService` + `createOsNotifier` + `createReminderScheduler`; `start()` after listen, `stop()` on close; registers `registerDirectiveRoutes` before the catch-all web routes.

**Modified (shared):**
- `packages/shared/src/audit.ts` — adds `'directive'` to `AuditEntityType` so directive audit rows are first-class.
- `packages/shared/src/index.ts` — exports `./directives.js`.

**Modified (frontend):**
- `packages/frontend/src/App.tsx` — imports `DirectivesView` from `./views/DirectivesView.js` (no longer the stub).
- `packages/frontend/src/views/stubs.tsx` — removes the `DirectivesView` stub.
- `packages/frontend/src/components/Header.tsx` — adds the "Directives (n)" pill linking to the directives view; consumes `useDirectives`.
- `packages/frontend/src/components/Board.tsx` — accepts optional `pinnedIds: ReadonlySet<string>`; partitions each column into pinned/unpinned with a `📌 pinned` divider.
- `packages/frontend/src/views/SessionView.tsx` — passes `pinnedIds` (derived from `useDirectives` + `directivesFor`) into each Board.
- `packages/frontend/src/views/LibraryView.tsx` — partitions sidebar entries into pinned/unpinned; adds a `Directives (n)` section to the entry editor; mounts `DirectiveModal` for create/edit; renders `DirectiveBadge` next to each sidebar row.
- `packages/frontend/src/components/ItemDetailPanel.tsx` — replaces the Phase 6 placeholder with a live `Directives (n)` section + `DirectiveModal` mount.
- `packages/frontend/src/api.ts` — adds `listDirectives / listDirectivesForItem / listDirectivesForLibraryEntry / createDirective / updateDirective / deleteDirective`.
- `packages/frontend/src/styles.css` — appends Phase 6b styles (`.directive-badge`, `.pinned-divider`, `.pinned-list`, `.directives-view` group / row / actions, `.directive-modal`, detail-panel + library-editor directive sections, `.directives-hint`).
- `packages/frontend/test/fixtures/mockApi.ts` — state-backed directive mocks; `seedDirective` helper; `state.directives` partitioned, reset, and queried by the new mock methods.
- `packages/frontend/test/stubs.test.tsx` — drops the `DirectivesView` import (no longer a stub).

**Modified (docs):**
- `CHECKLIST.md` — ticks the eight 6b rows with evidence pointers.

**Deleted:** _none_.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Freeform bundle status policy doesn't accept `'todo'` | `packages/backend/test/directives.test.ts`, `packages/backend/test/directives-scheduler.test.ts` | First-draft test setup passed `status: 'todo'` to `items.create`; the freeform bundle's default policy uses `open` / `done`, so creation threw `ItemPolicyError`. Caught by the first run of the new backend test files. | Drop the explicit status; `items.create` defaults to the bundle's first status. Documented inline as a reminder that test data should let the bundle policy choose statuses rather than hard-coding bundle-specific values. |
| `exactOptionalPropertyTypes: true` rejects optional `ReadonlySet<string> \| undefined` prop spread | `packages/frontend/src/components/Board.tsx` | Passing `pinnedIds={pinnedIds}` directly through Board → BoardColumn failed under the strict optional-property rule because `pinnedIds` is optional at the call site. | Spread the prop conditionally: `{...(pinnedIds !== undefined ? { pinnedIds } : {})}`. Pattern mirrors the conditional-spread idiom already used elsewhere in Phase 6a (`...(input.tags !== undefined ? { tags: input.tags } : {})` in library service). Future authors landing optional props under strict TS should reach for this idiom rather than weakening the type. |
| `node-notifier` is not in the backend's declared deps | `packages/backend/package.json` | Per T-D32, `node-notifier` is the cross-platform path. Adding it as a hard dep would require a network install + would tie CI to its platform-specific build artefacts. | Made the dep optional: the capability layer probes via `createRequire(import.meta.url)`; when absent, warns once and falls back to the no-op notifier. The abstraction is the T-D32 value; the platform-specific firing is a one-line `pnpm add node-notifier` away when an operator wants it. Pattern recorded in Last Decision Minted ("Capability layer for OS-platform integrations"). |
| Relative-spec grammar v1 is intentionally small | `packages/shared/src/directives.ts` | The §13 adopted-defaults note says "relative + absolute + recurrence rule support" without naming a grammar. We ship `in N {minute\|hour\|day\|week}s?` and `tomorrow [HH:MM]`; anything else returns null. | Accepted as v1 surface area. Unrecognised input surfaces as `InvalidPayloadError` (400) with the spec text in the message ("try \"in 3 days\" or \"tomorrow 14:00\""). Future extension lives in the shared parser so backend + frontend pick up automatically. Flagged as an open question below. |
| `recurrence.every` default UI value is `1` | `packages/frontend/src/components/DirectiveModal.tsx` | The shared validator allows any `every >= 1`; the UI defaults to `every=1, unit=day` when the user toggles recurrence on. | Matches the most-common-case heuristic. Future polish slice can surface the "every N units" preview text inline. |

---

## Open Questions

- [ ] **Relative-spec grammar extension.** Should the parser support `next Monday`, `next Friday HH:MM`, `every weekday at HH:MM` (the last would also be a recurrence form)? Flag for spec-author confirmation in a future cycle; deferred until evidence demands it.
- [ ] **Pin sort within a column.** Multiple pinned items in the same column currently sort by `created_at` (the backend's `ORDER BY` on the directives list). Should pinned items have their own ordering (e.g., manual drag, alphabetical)? Probably manual drag eventually; deferred to a polish slice.
- [ ] **Directives view: should already-fired one-shot reminders auto-hide?** Currently they sort last but stay visible. Spec says "Recurring reminders persist until directive removed" — silent on one-shot post-fire. Flag for spec-author confirmation.
- [ ] **Notifier deep-link click-through.** `node-notifier` honours `open: <url>` on some platforms, ignores it on others. Click-through reliability is platform-specific; SPEC §10 doesn't require it. Documented as best-effort; revisit if a platform's behaviour becomes a complaint.
- [ ] **TagChipsEditor consolidation (carry-forward from 6a).** Still not done; not blocking. Picks up alongside an item-detail-panel polish slice.

---

## Recently Resolved

- **6a parked item: "Pinned-sticky rendering across all list views."** — partial resolution. Pin sticky lands for session board columns + library sidebar (Phase 6 pin scope per the 6a handover). Tree/graph/modules deferred to those views' own polish slices, per "Pin scope rolls out per parent-view" convention.
- **Phase 4 deferral: "Directives in Phase 6b."** — done. Item detail panel and library entry editor both surface live directive sections with add/edit/delete; the placeholder copy is gone.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- Phase 1 backend: `directives` table from `0001_init.sql` (this slice's migration only adds columns + indices, not the table itself); audit-log substrate (T-D36); project service for project lookup.
- Phase 3 backend: items service for parent resolution (`item` parent_type).
- Phase 6a backend: library service for parent resolution (`library` parent_type); modal + form-row CSS conventions.
- Phase 2 frontend: `useModalRegistration` for modal stack + Esc handling; header + view-toggle layout.
- Shared package: audit + project types; library types reused as `LibraryEntry` for the directives view's parent index.

**Downstream (consumes this slice's work):**
- **Phase 6c repo `.md` ingestion.** Imported docs from `.md` files can carry directives like any other library entry — no extra wiring required; the directives layer is parent-type agnostic.
- **Phase 13 session-start.** `listDirectives({ kind: 'include_prompt' })` is the consumer surface; Phase 13's prompt-assembly pipeline filters by `parent_type` to pull the right body text (item.title+description, or library entry body). The directive's optional `note` is editorial guidance the pipeline can include or ignore.
- **Phase 11 Semble + Phase 14 RAG.** The notifier capability layer is reusable — both phases need to surface async-discovered findings (Semble code-ref changes, RAG hygiene nudges) as notifications. They consume `createOsNotifier()` / `Notifier` directly.
- **Phase 14 periodic-review hygiene.** Audit-log rows from `directives` (created/updated/deleted/fired) feed hygiene queries ("reminders never fired", "include-prompt directives untouched since project rebrand"). The `actor='system' field='fired'` rows are already in place for the "reminders that fired but did no work" type of question Phase 14 will ask.
- **Phase 8 methodology gates / Phase 9 periodic reviews.** Both will use the scheduler shape — `now`-injected, manual `tick()` for tests — without re-inventing the wiring. The notifier path is the natural fire surface for gate failures and review prompts.

---

## Reference

- Specs operated against: `SPEC.md` §7.10 (directives), §10 (capability layers), §13 (adopted defaults: recurring-reminder persistence, reminder semantics), §15 (degrade-gracefully); `CODE_SPEC.md` §3 (directives row), §4 (OS notifications row), §16 (audit); T-D12, T-D32, T-D36; ROADMAP §Phase 6.
- Previous handover: `docs/_meta/throughline/handovers/2026-05-13-phase-6a-library-content.md`.
- PR: filled in at PR open.
