# Throughline Handover — Phase 19 Slice 4: frontend NewProjectModal `bundle_path` + SettingsView missing-config block

**Generated:** 2026-05-27
**Last commit SHA:** pending — 2026-05-27
**Previous handover:** `2026-05-27-phase-19-slice-3-cli-init-subcommand.md` (Slice 3 — PR #49, merged 2026-05-27)

Fourth and final slice of the Phase 19 clone-and-go chain (tracking issue [#46](https://github.com/jaydomains/throughline/issues/46)). Chain closes when this PR merges.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| C-D19 surface 5 — NewProjectModal surfaces the existing C-D14 `bundle_path` column as an optional field on the create form | built | `packages/frontend/src/components/NewProjectModal.tsx` (new bundle_path state + form row); `packages/frontend/test/newProjectModal.test.tsx` (2 new tests: bundle_path passes through; absent when empty) | Empty/whitespace input omits the field from the create payload; non-empty value is sent verbatim. Backend already validates `bundle_path` (Slice 1) — invalid paths surface as 400 `invalid_bundle_path`. |
| C-D19 surface 6 — SettingsView gains a per-project block surfacing whether `.throughline/` is absent, partial, or complete | built | `packages/frontend/src/views/SettingsView.tsx` `ThroughlineStatusBlock` (new component, rendered inside `ProjectSection`); `packages/frontend/test/settingsView.test.tsx` (2 new tests: complete state renders block; legacy responses without the field render nothing) | Reads `project.throughline_status` from the backend response. Three message templates explain each state and point at `throughline init`. Component returns null when the field is `undefined` (back-compat with pre-Phase-19 callers). |
| C-D19 surface 6 — Backend extends `GET /api/projects` and `GET /api/projects/:id` with `throughline_status` computed at request time; never persisted | built | `packages/backend/src/projects/routes.ts` `computeThroughlineStatus()` (exported helper) + `withStatus()` wrapper applied to list / get / create / update responses; `packages/shared/src/project.ts` `Project.throughline_status?: ThroughlineStatus`; `packages/backend/test/projects.test.ts` "throughline_status (C-D19 surface 6)" describe block (4 tests covering absent / partial / complete / malformed) | The wrapper is also applied to POST 201 and PATCH 200 responses so the create / re-init flows return the same shape as GETs. Cheap filesystem stat + parse attempt; safe to call per-request. |
| C-D19 surface 5 — SettingsView `bundle_path` field on the per-project binding row | built | `packages/frontend/src/views/SettingsView.tsx` `ProjectSection` (new bundlePath state + form row + null-on-empty in the PATCH payload); `packages/frontend/test/settingsView.test.tsx` ("sends bundle_path through updateProject") | Empty input is sent as `null` to clear the column; non-empty sends the literal string. Same validation path as create. |

---

## Last Decision Minted

No new decisions minted. Implementation followed C-D19 surfaces 5 and 6, plus the implicit decision in plan-mode "Slice 4 needs a way to compute `.throughline/` partial/complete status" — resolved by extending the project response shape with `throughline_status` (the plan's option (a)).

Implementation-shape choices recorded inline:

- **Three-state status taxonomy.** `absent` (no `.throughline/` directory), `partial` (directory exists but `project.json` is missing or unparseable), `complete` (`project.json` present and valid). The "partial" bucket swallows three sub-failures (missing file in a present directory; malformed JSON; schema violation) because the user-facing remediation is the same: re-run `throughline init`. Drilling deeper would over-specify what is essentially a "looks wrong; re-init it" signal.
- **`withStatus` wrapper.** Applied to all four response paths (list, get, create, update) so the frontend can read `throughline_status` uniformly regardless of which endpoint produced the payload. The wrapper is cheap (one `existsSync` + at most one JSON parse) and runs per-request; no caching needed at this slice's scope.
- **Optional field, back-compat.** `Project.throughline_status?: ThroughlineStatus` — optional, so pre-Phase-19 unit tests and any caller that constructs `Project` objects directly (without going through the routes layer) compile without modification. The frontend component returns null when the field is undefined, hiding the block on legacy responses.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `docs/_meta/throughline/handovers/2026-05-27-phase-19-slice-4-frontend-modal-and-settings-view.md` — this handover.

**Modified:**
- `packages/shared/src/project.ts` — `ThroughlineStatus` type; `Project.throughline_status?: ThroughlineStatus`.
- `packages/backend/src/projects/routes.ts` — `computeThroughlineStatus(repoPath)` exported helper; `withStatus(project)` wrapper applied to list / get / create / update responses.
- `packages/frontend/src/components/NewProjectModal.tsx` — `bundle_path` state + form row; sent on submit when non-empty; reset on modal open.
- `packages/frontend/src/views/SettingsView.tsx` — `bundlePath` state + form row in `ProjectSection`; sent on save (null when empty); `ThroughlineStatusBlock` component renders the status when present.
- `packages/backend/test/projects.test.ts` — 4 new tests in a "throughline_status (C-D19 surface 6)" describe block: absent, partial, complete, partial-on-malformed.
- `packages/frontend/test/newProjectModal.test.tsx` — 2 new tests: bundle_path passes through to create; omitted when empty.
- `packages/frontend/test/settingsView.test.tsx` — 3 new tests: bundle_path sent through updateProject; status block renders when field present; status block hidden on legacy responses.
- `.claude-code/auto-continue-state.json` — Slice 3 marked merged (PR #49, 0 fix-rounds); Slice 4 opened (PR pending); `currentIndex: 3`.
- `docs/_meta/throughline/PLATFORM_STATUS.md` — Snapshot, Current Phase updated for Slice 4 in flight (final slice).
- `CHECKLIST.md` §19 — Slice 3 ticked; Slice 4 marked PR-pending.

---

## Drift Flags

_none_

---

## Open Questions

- [ ] **Auto-refresh of `throughline_status`** — the field is computed at request time, so a `GET /api/projects/:id` always returns fresh state. The settings view loads projects once per mount via the existing flow and does not re-poll. If a user runs `throughline init` from another window while the settings panel is open, the displayed status will be stale until the next reload. Landing site: a future slice (or out-of-scope polish) could add an SSE event or a periodic refresh; not in C-D19 scope.

---

## Recently Resolved

- **Slice 3 (Phase 19) merged** — was flagged in Slice 3's handover as "PR pending"; resolved by PR #49 merge with 0 fix-rounds.
- **Gitar informational note — sync I/O per project in list endpoint** — Gitar review on PR #50 flagged that `computeThroughlineStatus` runs synchronous `existsSync` + (optional) small `readFileSync` per project on `GET /api/projects`. Gitar's own conclusion: "no immediate fix required unless project counts scale significantly" — the cost is microseconds per project for a local-first desktop app with few projects per user. PR status remained `👍 Approved with suggestions`; no code change. Captured here for forensic completeness. If project counts grow, the fix is either pagination or async fs + a small cache; landing site would be a future polish slice, not Phase 19.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- Slice 2's `readProjectConfig` — invoked by `computeThroughlineStatus` to distinguish `partial` from `complete`. Soft-throws on malformed input fold into `partial` cleanly because the existing reader throws `InvalidProjectConfigError` / `BundleIdMismatchError`.
- Slice 1's `bundle_path` validation — the new `bundle_path` form rows on the frontend send strings the backend already validates via `validateBundlePath` (existing 400 `invalid_bundle_path` mapping).
- C-D14 `bundle_path` column on `projects` — surfaced in this slice's UI; persisted since Phase 15.

**Downstream (consumes this slice's work):**
- No subsequent slices. Phase 19 chain closes on merge of this PR.

---

## Reference

- `DECISIONS.md` T-D51, T-D52 — chain spec anchors.
- `CODE_SPEC.md` C-D19 — surfaces 5 + 6 (this slice).
- `SPEC.md` §7.26 — clone-and-go functional behaviour.
- `docs/.throughline-schema.md` — per-repo config schema.
- Chain plan: `/root/.claude/plans/plan-mode-phase-19-build-vast-sutherland.md` (session-local).
- Chain state: `.claude-code/auto-continue-state.json` (Phase 19 chain closes when this slice merges; tracking issue #46 closes accordingly).
- Tracking issue: [#46](https://github.com/jaydomains/throughline/issues/46).
- PR: pending.
