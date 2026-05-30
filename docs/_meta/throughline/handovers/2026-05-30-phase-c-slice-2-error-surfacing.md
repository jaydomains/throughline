# Throughline — Phase C / Slice 2 Handover

**Generated:** 2026-05-30 (UTC)
**Last commit SHA:** _filled at merge_ — 2026-05-30
**Previous handover:** `handovers/2026-05-30-phase-c-slice-1-useresource.md` (Phase C / Slice 1, PR #77)

Chain `audit-fix-phase-c-d`. Slice 2 (C-2) — completes the Phase C half: the C-D24 error slot now reaches the UI, clearing the SF6 swallow-as-empty findings. Closes the Phase C scope (SF6-01/02 Criticals + SF6-03..07 Highs + SF6-08/10/11/12 Mediums).

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| `useDirectives` / `useDriftInbox` expose `error` | built | both hooks add an `error` slot in-place (async `refresh` kept) | No longer silently reset to `[]` / `EMPTY`. |
| `useCostMeter` / `useBackupStatus` on `usePolledResource` | built | both rebuilt on the C-D24 polled primitive | Gain `error`; `useBackendHealth` is the documented exception (failed `/health` = `healthy:false`, not an error). |
| Consumers render the error | built | new `components/LoadError.tsx` dropped into TreeView, GraphView, SessionView (items, SF6-01); SessionsIndex, SessionView (sessions, SF6-02); HomeView (items/inbox/directives); DriftInbox | SessionsIndex empty-state suppressed when a load error is present. |
| Mutation handlers catch | built | ItemDetailPanel (detach-note, delete-directive → inline "Action failed"); DriftInbox `act()` (added catch); SettingsView `getSettings()` (added catch); LibraryView `refresh()` bare `await` wrapped | Were fire-and-forget / unhandled-rejection paths. |
| Lock SF6-01/02 with a regression test | built | `test/hooks.test.tsx` (5 tests) | Hook-level (`renderHook`) + rendered-view level for both useItems/useSessions, plus a success-path assertion. |

Green gate (local + CI on PR): typecheck, **187** frontend tests (+5 from 182), lint, full `pnpm -r build` all green. Test count strictly increased (no test-count regression).

---

## Last Decision Minted

_none_ — executes C-D24 (minted slice 1). One small correctness edit to the C-D24 Implications in `CODE_SPEC.md` records `useBackendHealth` as a deliberate non-adopter.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/frontend/src/components/LoadError.tsx` — shared inline load-error banner (renders nothing when `error` is null).
- `packages/frontend/test/hooks.test.tsx` — SF6-01/02 regression lock.

**Modified:**
- Hooks: `useDirectives.ts`, `useDriftInbox.ts` (error slot in-place); `useCostMeter.ts`, `useBackupStatus.ts` (rebuilt on `usePolledResource`); `useBackendHealth.ts` (exception comment).
- Views: `TreeView.tsx`, `GraphView.tsx`, `SessionView.tsx`, `SessionsIndex.tsx`, `HomeView.tsx`, `DriftInbox.tsx`, `LibraryView.tsx`, `SettingsView.tsx` (render error / add catch).
- `components/ItemDetailPanel.tsx` — mutation-error banner + catches on detach-note / delete-directive.
- `CODE_SPEC.md` — C-D24 Implications correction.
- `PLATFORM_STATUS.md` — Snapshot / Current Phase / Recent Slice History roll (handover+status commit).

**Deleted:** _none_.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Polling-hook scope | `useBackendHealth.ts` | C-D24's slice-1 Implications said all three polled hooks adopt `usePolledResource`; on build, `useBackendHealth`'s failure-as-`healthy:false` semantics are the opposite of an error slot. | Recorded as a deliberate exception in both the hook and the C-D24 Implications, rather than forcing an unnatural conversion. |

---

## Open Questions

- [ ] Slice 3 (D-1) — wire-contract response types → `@throughline/shared` + contract test (mints T-D59); flip AUTHORING_DISCIPLINE Gap 2 → Closed.
- [ ] Slices 4–5 (D-2/D-3) — backend regression locks + small paired fixes (S2-01 ReDoS bypass, SF2-01 scanner-throw, S5-01 dump-zone atomicity, S4-01 drift dismissal, S7-01 shutdown ordering, F1-01 loader lock).

---

## Cross-Module Dependencies

**Upstream (this slice consumes):** C-D24 hook pair (slice 1); `@throughline/shared` entity types.

**Downstream (consumes this slice):** Phase D is backend-only and independent of these frontend changes, except that the SF6-01/02 lock test (`test/hooks.test.tsx`) is the frontend half of the seven Phase-D regression locks.

---

## Reference

- Decisions: `CODE_SPEC.md` C-D24 (executed, not re-minted).
- Chain: `audit-fix-phase-c-d` — #76 (absorption) → #77 (C-1) → C-2 (this) → D-1 → D-2 → D-3.
- PR: _Phase C / Slice 2 (this PR)_.
