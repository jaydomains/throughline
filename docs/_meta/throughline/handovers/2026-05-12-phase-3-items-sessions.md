<!-- Template version: 1.0 -->

# Throughline — Phase 3 Handover

**Generated:** 2026-05-12 (pre-merge)
**Last commit SHA:** see PR head — 2026-05-12
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-12-phase-2-ui-shell.md` (Phase 2 — UI shell)

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Item create / read / update / delete via UI | built | `packages/backend/src/items/{service,routes}.ts`; `packages/frontend/src/components/{Board,ItemRow,ItemDetailPanel}.tsx`; `test/items.test.ts`, `test/sessionView.test.tsx` | Full CRUD round-trip exercised in both backend and frontend tests. |
| Session create / read / update / delete | built | `packages/backend/src/sessions/{service,routes}.ts`; `packages/frontend/src/views/SessionsIndex.tsx`; `test/sessions.test.ts`, `test/sessionView.test.tsx` | Rename + delete audit-logged via the new `entity_type='session'`. |
| Item-session many-to-many membership | built | `item_session_memberships` table; `addSessionMembership` / `POST /api/projects/:id/items/:itemId/sessions/:sessionId`; `GET /items?session_id=` filter | Verified by `test/items.test.ts` "lists items filtered by session membership". |
| Bundle-derived item types and statuses | built | `packages/backend/src/items/policy.ts`; `GET /api/projects/:id/policy` | Freeform → type=`task`, statuses=`['open','done']`, single board `Tasks`. SiteMesh Phase 7 plugs into the same helper. |
| Status lifecycle enforced per bundle | built | `ItemsService.update` validates against `bundleItemPolicy`; rejects unknown with `ItemPolicyError` | UI surfaces statuses via the policy fetch; the cycle-status button stays within bundle vocabulary. |
| Free-text + structured blockers coexist (T-D8) | built | `items.blocker_text` column + `item_blockers` join table; detail panel renders both; cycle and self-block guards in `addBlocker` | `test/items.test.ts` "honours free-text blocker description and structured blockers together (T-D8)". |
| Tags add/remove | built | `item_tags` table; `addTag`/`removeTag` with audit; detail panel `.tag.removable` UI | Tag-add and tag-remove each audit-logged with `tag_add`/`tag_remove` fields. |
| Parent/child nesting | built | `items.parent_id`; `BlockerCycleError` thrown on parent-cycle attempts; tree view groups by parent | Phase 3 ships rendering; in-row reparent UI (Tab/Shift-Tab indent) still pending. |
| Branch reference free-text on items (T-D38) | built | `items.branch_ref` column; detail panel input | Auto-populate from active session left as a follow-up; the UI hook is in place. |
| Bundle-defined boards | built | `bundleItemPolicy` returns `boards`; `Board.tsx` renders per board; freeform yields `[{id:'tasks',label:'Tasks',type:'task'}]` | SiteMesh Phase 7 will extend the policy to return todo + decision boards. |
| Item detail panel slides in from right | built | `packages/frontend/src/components/ItemDetailPanel.tsx` + `.detail-panel.open` transform CSS | Title / description inline-editable; status cycle button. |
| Detail panel arrow-key navigation through parent list | built | `useHotkey('arrowdown'|'arrowup')` cycles `siblings`; `test/sessionView.test.tsx` "opens the detail panel on item click and cycles via arrow keys" | Resolves the Phase 2 carry-over note about arrow-key consumers landing in Phase 3. |
| Detail panel placeholder rows for code refs / verifier rules / directives / methodology context / git context | built (placeholders) | `ItemDetailPanel.tsx` sections | Each labelled with its landing phase (6, 8, 10, 11). |
| Stale yellow flag in detail panel header (T-D46) | built | `isStale` helper + `useStaleThreshold` (default 14d) | Header `.stale` glyph appears when `updated_at` is older than threshold. |
| Stale yellow flag in list rows (T-D46) | built | `ItemRow.tsx` `.stale` glyph; `TreeView.tsx` row glyph; `test/sessionView.test.tsx` stale-flag test | Same isStale helper used in both views. |
| Manual entry inline form, keyboard-driven | built | `Board.tsx` inline form: focus → type → Enter creates; Esc clears draft | Submission is form-level (Enter); Esc resets the draft. |
| All lifecycle transitions audit-logged | built | `appendAudit` on every item + session mutation; `entity_type='session'` extension; `test/items.test.ts`, `test/sessions.test.ts` | Audit list endpoint `GET /api/audit?entity_type=&entity_id=` powers the detail panel's activity log. |
| SPEC T-D36 + DECISIONS.md updated to include sessions | built | `SPEC.md` §14 T-D36 row + §7.22 §8 prose; `DECISIONS.md` T-D36 body | Two-line spec update + body paragraph extension per Phase 3 plan amendment. |
| AuditEntityType enum extended | built | `packages/shared/src/audit.ts` adds `'session'` | Backend uses the new variant when writing session lifecycle entries. |

If a deliverable is `partial`, the Notes column names what's outstanding. None in this slice.

---

## Last Decision Minted

No new T-D or C-D anchors minted. The Phase 3 PR includes a clarifying *body extension* to existing **T-D36** so SPEC §14, DECISIONS.md, and the `AuditEntityType` enum agree: the audit log scope explicitly covers **items, sessions, library entries, projects, methodology bindings, and gate firings**. The extension is descriptive — it does not change behaviour, it brings the spec text into alignment with the existing intent (T-D1 already names sessions as views with their own lifecycle; T-D36's literal phrasing had simply omitted them). No new anchor number consumed.

Conventions adopted during this slice (apply going forward):

- **Bundle-derived item policy as a single helper.** `bundleItemPolicy(bundle): { types, statuses, boards }` is the only place that derives "what items / statuses / boards apply to this project." Frontend never reads bundle internals to make those decisions; it consumes the helper's output via `GET /api/projects/:id/policy`. SiteMesh Phase 7 extends the helper, not its callers.
- **Stale threshold default = 14 days.** SPEC §7.25 says "configurable" without picking a number. `SETTINGS_DEFAULTS.stale_threshold_days = 14` lands in `packages/backend/src/settings/routes.ts` and surfaces through `/api/settings`. The settings UI (Phase 15) consumes it; users override via PUT `/api/settings`.
- **Audit list endpoint is filter-only.** `GET /api/audit` accepts `entity_type`, `entity_id`, `project_id`, `limit` (capped at 200). No pagination cursor in v1 — the detail panel queries by entity and 50 rows comfortably covers the activity-log use case.
- **List-row keyboard contract lives on the detail panel.** Phase 2 registered the arrow-key bindings globally with no consumer; Phase 3 wires the consumer inside `ItemDetailPanel.tsx` so ↑/↓ advance through the parent list while the panel stays open. Future list-row consumers (tree-view inline ops, board column moves) reuse the same pattern.
- **Editable text inputs use local state + onBlur persist, never onChange persist.** Every editable text input in a detail-panel-style surface (title, description, free-text blocker, branch ref, future fields) holds a local `editingX` state, falls back to `item.x` while not editing, and writes through `api.updateItem` only on blur (and only when the value actually changed). The onChange-persist pattern from the first draft of the blocker_text and branch_ref inputs is **not** the standard — it fires an API call per keystroke and corrupts the input on slow networks. Reference shape lives in `ItemDetailPanel.tsx`.
- **List-shape query methods batch their child queries via `WHERE item_id IN (...)`, not per-row loops.** `ItemsService.list` and the single-row `get` path both go through `loadItemChildren(db, ids)` which fetches tags, structured blockers, and session memberships in three batched queries regardless of how many items the caller asked for. The N+1 pattern would have spread to sessions list, library list, and every future list-row-render path; fixing it at the items service is the reference shape. Reference: `packages/backend/src/items/service.ts`, the `loadItemChildren` + `rowToItemWithChildren` pair.

---

## Active Blockers

_none_

Provisional / parked items future phases must revisit:
- **Tab/Shift-Tab indent (in-row reparent UI)** — still registered globally with no consumer. The data path (`items.parent_id` with cycle guard) is in place; the in-row UI lands when the tree-view or board-row "indent under preceding sibling" interaction is wired.
- **Branch-ref auto-populate from active session** — the column is on `items` and the detail panel renders it as a free-text input. Setting a session's branch and having new-in-session items pick it up automatically is a one-line wiring that lands when sessions get their own settings panel (Phase 5/6 area).
- **SPEC author confirmation** — the T-D36 wording change is a body extension. If the spec author later disagrees, the row is one edit away.

---

## Files Changed Since Last Handover

**New (`packages/backend/`):**
- `src/items/policy.ts` — bundle → item policy helper (types, statuses, boards).
- `src/items/service.ts` — `ItemsService` CRUD + tags + blockers + memberships.
- `src/items/routes.ts` — REST surface under `/api/projects/:id/items/...`.
- `src/sessions/service.ts` — `SessionsService` CRUD with `entity_type='session'` audit.
- `src/sessions/routes.ts` — REST surface under `/api/projects/:id/sessions`.
- `src/audit/routes.ts` — `GET /api/audit` filter-only endpoint.
- `test/items.test.ts` — policy / create / status / tags / blockers / memberships / parent-cycle / cascade.
- `test/sessions.test.ts` — create / rename / branch-ref / delete + audit.

**New (`packages/frontend/`):**
- `src/views/SessionsIndex.tsx`, `src/views/SessionView.tsx`, `src/views/TreeView.tsx` — replace Phase 2 stubs.
- `src/components/Board.tsx`, `src/components/ItemRow.tsx`, `src/components/ItemDetailPanel.tsx`.
- `src/hooks/{useSessions,useItems,useItemPolicy,useStaleThreshold}.ts`.
- `test/sessionView.test.tsx`, `test/fixtures/mockApi.ts`.

**New (`packages/shared/`):**
- `src/items.ts`, `src/sessions.ts` — types for the new endpoints.

**Modified:**
- `SPEC.md` — §14 T-D36 row + §7.22 §8 prose extended to include sessions.
- `DECISIONS.md` — T-D36 body paragraph extended with the sessions rationale.
- `packages/shared/src/audit.ts` — `AuditEntityType` adds `'session'`.
- `packages/shared/src/index.ts` — re-exports new modules.
- `packages/backend/src/server.ts` — wires sessions + items + audit routes.
- `packages/backend/src/settings/routes.ts` — `SETTINGS_DEFAULTS.stale_threshold_days = 14`.
- `packages/backend/test/server.test.ts` — smoke routes for items / sessions / policy / audit / settings defaults.
- `packages/frontend/src/App.tsx` — imports the live views from their own modules.
- `packages/frontend/src/api.ts` — items / sessions / policy / audit / per-action helpers.
- `packages/frontend/src/views/stubs.tsx` — removes `SessionView`/`SessionsIndex`/`TreeView` (now live).
- `packages/frontend/src/styles.css` — board / column / item-row / detail-panel / tree-view styles.
- `packages/frontend/test/stubs.test.tsx` — drops moved-into-live-views cases.
- `CHECKLIST.md` — every Phase 3 row ticked with evidence/notes; Phase 2 keyboard partial updated to reflect arrow-key consumer landing.
- `README.md` — phase status updated to "Phase 3 in progress".

**Deleted:** _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| `INNER JOIN` parameter ordering in `items.list` | `packages/backend/src/items/service.ts` | Initial implementation appended the session_id param after project_id but the JOIN clause comes before WHERE in the SQL, so the placeholders bound to the wrong columns and the session filter returned an empty list. | Split into `joinParams` and `filterParams`, spread in order: `db.prepare(sql).all(...joinParams, ...filterParams)`. Verified by `test/items.test.ts` "lists items filtered by session membership". |
| `exactOptionalPropertyTypes` caught a dead helper | `packages/frontend/src/views/SessionView.tsx` | `createItemForBoard` passed `status: policy.statuses[0]` (`string \| undefined`) to `Omit<CreateItemInput, 'project_id'>` which expects `string`. The helper was unused — `Board.tsx` calls `api.createItem` directly. | Removed the dead helper rather than widening the type. Build path uses the production tsconfig which enforces `exactOptionalPropertyTypes`. |
| `useModalStack` vs `useModalRegistration` | `packages/frontend/src/components/ItemDetailPanel.tsx` | First draft called `useModalStack(true, onClose)` (the ctx accessor, not the registration helper). The actual API is `useModalRegistration(id, open, onClose)`. | Swapped to `useModalRegistration` with a stable id `item-detail-${itemId}`. Esc-close test in `sessionView.test.tsx` exercises the path. |
| Initial PR body overclaimed blocker cycle guard | `packages/backend/src/items/service.ts` `addBlocker` | The first draft only rejected self-blocking (`id === blockedById`); the PR description said "cycle + self-block guards", which was incorrect. A transitive cycle (A→B, B→C, C→A) would have slipped through. | Implemented BFS walk from `blockedById` following its own blockers; reaching `id` along the chain throws `BlockerCycleError`. Mirrors the parent-walk pattern earlier in the file. Verified by `test/items.test.ts` "rejects a transitive blocker cycle via BFS walk". PR description corrected. |
| N+1 child-row queries in `rowToItem` | `packages/backend/src/items/service.ts` | Each item ran three SELECTs (tags / blockers / session_ids), so a 50-item list cost 150 child queries. Acceptable for Phase 3's freeform demo size, but the pattern would have spread to sessions list and library list in future phases. | Introduced `loadItemChildren(db, ids)` that batches the three child queries with `WHERE item_id IN (...)` and indexes the result by item_id. `list()` calls it once per call; the single-row `get` path also goes through it. Convention documented in handover. |
| `onChange` keystroke API calls on free-text blocker + branch ref | `packages/frontend/src/components/ItemDetailPanel.tsx` | First draft of those two inputs called `api.updateItem` on every keystroke (`onChange={(e) => setBlockerText(e.target.value)}`), which the title/description fields had already corrected to local-state + onBlur. | Swapped to the same `editingX` local state + onBlur persist + skip-if-unchanged pattern used by title and description. Convention documented in handover. |

---

## Open Questions

- [ ] **Tab/Shift-Tab indent UI for list rows** — the keybindings register globally with the registered description "Indent / outdent in lists"; the in-row UI consumer lands when the first reparent-from-row interaction is built (tree view bulk-move or a board-row context action — likely Phase 6 alongside the directives view).
- [ ] **Active-session branch ref propagation to new items** — items carry `branch_ref` (T-D38); sessions carry `branch_ref`. A new item created from a session view does not yet auto-fill its branch from the session. One line in `Board.tsx`'s `create` once a session-level settings UI lands.
- [ ] **Audit log pagination** — current endpoint hard-caps at 200 rows. Periodic review (Phase 14) is the first surface that wants more; revisit then.

---

## Recently Resolved

- **"Tab/Shift-Tab indent + arrow-key list nav consumers — registered as global bindings in the help modal but no consumer renders yet. Phase 3 (list rows) is the first consumer site."** — flagged in `2026-05-12-phase-2-ui-shell.md` Active Blockers (Provisional). Resolved (arrow keys): `ItemDetailPanel.tsx` consumes ↑/↓ to cycle through siblings while the panel stays open. Tab/Shift-Tab indent still has no consumer; carried forward into Open Questions above.

---

## Cross-Module Dependencies

**Upstream (this module consumes):**
- Phase 1 substrate: `audit_log`, `items`, `item_*`, `sessions`, `item_session_memberships`, `settings` tables; `appendAudit`; `MethodologyRegistry`; `ProjectsService`; `SettingsService`.
- Phase 2 substrate: `keyboard/useHotkey`, `keyboard/modalStack`, `views/modes`, `ProjectBundleGuard`, `useProjects`, `useMethodologies`.

**Downstream (consumes this module):**
- Phase 4 (capture surfaces): dump zone proposed-items land via `createItem`; review modal applies through the items endpoints.
- Phase 5 (reconcile engine): six-category diff applies edits / blocker changes through the same item endpoints; contradicted spawns drift signals (Phase 9/10 stream).
- Phase 6 (library, directives): library notes attach to items via `item_attached_notes`; directives parent onto items (parent_id + parent_type already in schema).
- Phase 7 (SiteMesh bundle): `bundleItemPolicy` extends to declare multi-board layouts (todo + decision) and per-type statuses. No changes needed in any of the existing callers — they consume the policy as data.
- Phase 8 (gates) + Phase 10 (GitHub) + Phase 11 (Semble): each phase fills the placeholder sections in `ItemDetailPanel.tsx` (verifier rules / git context / code refs).
- Phase 13 (session-start scaffolding): consumes session memberships + items as context.

---

## Reference

- Specs operated against: `SPEC.md` §7.3–§7.5, §7.17, §7.24, §14 (T-D1, T-D8, T-D36 extended, T-D38, T-D46, T-D47); `CODE_SPEC.md` §3 (schema), §18 (frontend), C-D5; `ROADMAP.md` Phase 3; `CHECKLIST.md` Phase 3.
- PR: filled in at PR open.
