<!-- Template version: 1.0 -->

# Throughline — Phase 15 (Backup, cost meter, settings polish, hygiene) Handover

**Generated:** 2026-05-17 (UTC)
**Last commit SHA:** see PR #23 head — branch `claude/throughline-phase-15-FP7q7` (PR not yet merged; update to merge SHA on merge)
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-17-phase-14-rag-intelligence.md` (Phase 14 — RAG & intelligence layer)

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Single-file datastore backup; manual timestamped export (T-D28, CODE_SPEC §17) | built | `backend/src/backup/{service,routes}.ts`; `test/backup.test.ts`, `test/server.test.ts` | Online `db.backup()` snapshot (WAL-safe); `POST /api/backup/export` |
| API keys + `methodologies/` excluded from export (T-D4, C-D3) | built | `test/backup.test.ts` (asserts secret bytes absent) | Excluded by construction — both live outside the SQLite datastore |
| Header backup indicator red after threshold days (default 7) | built | `frontend/hooks/useBackupStatus.ts`, `components/Header.tsx`; `backup/service.ts` `status()` | Default `backup_threshold_days=7` (CODE_SPEC §17) |
| Optional configurable auto-copy target; fires on schedule | built | `backup/service.ts` `autoCopy()`, `backup/scheduler.ts`; `test/backup.test.ts` | Null target = local-only no-op; UI warns prominently |
| Archive-retention cleanup job (CHECKLIST §6c deferral) | built | `backup/service.ts` `pruneArchive()`, scheduler tick; `test/backup.test.ts` | `archive_retention_days` default 30 |
| Cost meter live with per-feature breakdown, day/week/month, header-visible (T-D29) | built | `backend/src/cost/{summary,routes}.ts`; `Header.tsx` cost pill; `test/cost-summary.test.ts` | day=UTC calendar day; week/month=rolling 7/30d (§13 rolling convention) |
| Cost scoped per project + global rollup | built | `cost/summary.ts` scope param; `test/cost-summary.test.ts` | Header uses active project; settings shows global |
| Daily threshold warning, configurable, default none | built | `cost_daily_threshold_usd` (default `null`); `test/cost-summary.test.ts` | ROADMAP §13 / CODE_SPEC Q#9 sanctioned default |
| Orphaned rules panel functional in settings (T-D33) | built | `frontend/views/SettingsView.tsx` `OrphanRulesSection`; backend `github/orphan-rules.ts` (Phase 10) | list / dismiss / draft-cleanup-PR wired |
| Settings panel exposes every knob in §7.25 (CODE_SPEC §19) | built | `frontend/views/SettingsView.tsx`, `/settings` route, header gear; `test/settingsView.test.tsx` | All 26 CHECKLIST rows; one caveat below |
| Secrets write path, presence-only readback (T-D4) | built | `backend/src/secrets/{store,routes}.ts`; `test/backup.test.ts`, `test/server.test.ts` | Key values never cross to the browser |
| Per-project methodology bundle binding rebindable | built | `shared/project.ts` `UpdateProjectInput.bundle_id`; `projects/service.ts` update | Re-registers external bundle watch; audit-logged |
| OS notification permission grant button | built | `backend/src/notifier/routes.ts`; `SettingsView.tsx` `NotificationsSection` | Fires through T-D32 layer; records `os_notifications_enabled` |

CHECKLIST §Phase 15: all 26 rows ticked with evidence.

---

## Last Decision Minted

> No new decisions minted. Implementation followed T-D28, T-D29, T-D33, T-D4, T-D32;
> SPEC §7.25; CODE_SPEC §13/§17/§19. The cost-threshold default (`null` = no threshold)
> and backup default (7d) are pre-sanctioned by ROADMAP §13 / CODE_SPEC §17/Q#9 — not
> new anchors. Implementation-shape choices (online `db.backup()` vs `VACUUM INTO`;
> cost windows = UTC-day + rolling-7/30d; archive prune folded into the backup scheduler;
> `bundle_id` added to `UpdateProjectInput`; OS-notification "grant" = fire-a-test-through
> -the-capability-layer) are recorded in code headers + Drift Flags below; none contradict
> an anchor.

---

## Active Blockers

_none_

Capability-gated (not blockers): auto-copy is a no-op until `auto_copy_target_path` is
set (the panel warns); OS-notification firing degrades to the no-op notifier when
`node-notifier` is absent (T-D32, unchanged).

---

## Files Changed Since Last Handover

**New:**
- `packages/shared/src/{backup,cost,secrets}.ts` — wire types; exported via `index.ts`.
- `packages/backend/src/backup/{service,scheduler,routes}.ts` — snapshot/status/auto-copy/prune.
- `packages/backend/src/cost/{summary,routes}.ts` — cost_telemetry aggregation.
- `packages/backend/src/secrets/routes.ts` — write-only secrets endpoints.
- `packages/backend/src/notifier/routes.ts` — OS-notification grant/test.
- `packages/backend/test/{backup,cost-summary}.test.ts` — coverage.
- `packages/frontend/src/views/SettingsView.tsx` — the §7.25 settings panel.
- `packages/frontend/src/hooks/{useCostMeter,useBackupStatus}.ts` — header pill polling.
- `packages/frontend/test/settingsView.test.tsx` — coverage.
- `docs/_meta/throughline/handovers/2026-05-17-phase-15-backup-cost-hygiene.md` — this file.

**Modified:**
- `packages/backend/src/secrets/store.ts` — `writeSecrets()`.
- `packages/backend/src/settings/routes.ts` — Phase-15 `SETTINGS_DEFAULTS`.
- `packages/backend/src/projects/{service,routes}.ts` — `bundle_id` rebind path.
- `packages/backend/src/server.ts` — construct + register backup/cost/secrets/notifier; backup scheduler lifecycle.
- `packages/backend/test/server.test.ts` — Phase-15 route integration block.
- `packages/shared/src/{index,project}.ts` — exports + `UpdateProjectInput.bundle_id`.
- `packages/frontend/src/{App.tsx,api.ts,styles.css}` — `/settings` route, API methods, styles.
- `packages/frontend/src/components/Header.tsx` — live cost + backup pills, settings gear.
- `packages/frontend/test/fixtures/mockApi.ts` — new mock methods.
- `CHECKLIST.md` — Phase 15 rows ticked.

**Deleted:** _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Snapshot mechanism | `backup/service.ts` | CODE_SPEC §17 says "single-file copy"; a plain `copyFile` under WAL would miss the WAL segment | Used better-sqlite3 online `db.backup()` — consistent, WAL-safe. Implementation-shape only; still a single-file snapshot |
| `UpdateProjectInput` widened | `shared/project.ts`, `projects/service.ts` | §7.25 says binding "defaults to freeform at create"; didn't define rebind, and update only carried `bundle_path` | Added `bundle_id` to update (re-register + audit) so the panel can expose the binding as a real knob per ROADMAP done-when. User-approved in plan |
| Model-override consumption | `frontend/views/SettingsView.tsx` `ModelSection` | §7.25/CODE_SPEC §14 say per-feature override "available"; the ~13 AI factories hardcode their §9 model defaults (noted in the Phase-14 handover) | Knob persisted + exposed in the panel (CODE_SPEC §19 "panel exposes" framing); **consumption deferred to Phase-16 DoD**. Honest limitation, surfaced in the UI hint + Open Questions, not silently claimed working |
| Inbox-directory knob | `frontend/views/SettingsView.tsx` | §7.25 lists "Claude Code inbox directory" as a settings knob; it is a `THROUGHLINE_*` env/config value (`config.ts`), not a `settings` row | Archive-retention (the mutable half) is a live setting + consumed by the prune; inbox-dir is config/env by design (set before boot) — documented here, not made a fake editable field |
| OS-notification "permission" | `notifier/routes.ts` | §7.25 says "one-time grant, mediated by backend"; no portable OS permission API exists | Grant = fire one notification through the T-D32 layer (this is what surfaces the OS dialog on macOS/Windows) + persist `os_notifications_enabled`. Minimal, honest |
| `auto_copy_target_path` null semantics | `SettingsView.tsx` `BackupSection` | Per the handover-note request: null = snapshots stay local-only; a laptop wipe loses everything | Surfaced as a prominent in-panel `⚠` warning when unset (tested: `settingsView.test.tsx` "laptop wipe"); also documented here. Not silently defaulted to a path |

---

## Open Questions

- [ ] **Per-feature model-override consumption** — values persist (`model_override_<feature>`) and the panel exposes them, but the ~13 AI factories still use their hardcoded SPEC §9 defaults (carried from the Phase-14 handover). Landing site: Phase 16 DoD (§11 "settings panel covers all required knobs" is satisfied for *exposure*; *consumption* wiring is a DoD-pass item or a dedicated AI-model-resolver slice).
- [ ] **`rag.test.ts` is not resilient to `@xenova/transformers` being present** — Phase 14 declared `@xenova/transformers` as an `optionalDependency` but `pnpm-lock.yaml` was never updated, so CI/installs don't pull it and the deterministic-fallback assertion holds. Running `pnpm install` in this container populated the lockfile + dep, flipping the embedder to the transformers path and failing `test/rag.test.ts:138` (`expected 'transformers' to be 'fallback'`). **Not Phase-15 code** — the `pnpm-lock.yaml` change was reverted to keep the PR scoped and CI green. Landing site: a Phase-14 follow-up or Phase-16 DoD — either lock the optional dep out of the test env or make the test assertion embedder-agnostic. Surfaced, not silently resolved (SESSION_START gap policy).
- [ ] **GatesView/IntelligenceView/SettingsView multi-surface sprawl** — Phase-13/14 open question persists; `SettingsView` is another large aggregate surface. Landing site: a UI-polish slice.

---

## Recently Resolved

- Phase-6c CHECKLIST deferral ("30-day retention policy documented but the cleanup job lands with Phase 15 hygiene per CODE_SPEC §17", CHECKLIST line 130) — closed: `backup/service.ts` `pruneArchive()` + scheduler tick, `archive_retention_days` default 30.
- Phase-14 handover downstream note "Phase 15 (cost meter) — `cost_telemetry` rows now produced by …" — closed: `cost/summary.ts` consumes those rows; verified end-to-end in `cost-summary.test.ts` via the real `recordCost` write path.
- Header cost/backup placeholders ("wires up in Phase 15") — replaced with live pills.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- `cost/telemetry.ts` `cost_telemetry` rows (every Phase 8/11/14 AI feature) — cost summary input.
- `settings/service.ts` — backup/cost/hygiene knobs + `last_backup_at` state.
- `secrets/store.ts` — T-D4 key file (write + presence).
- `github/orphan-rules.ts` (Phase 10) — orphaned-rules panel backend.
- `projects/service.ts`, `methodology/loader.ts` — per-project bundle rebind + re-register.
- `notifier/index.ts` (T-D32) — OS-notification grant.

**Downstream (consumes this slice):**
- Phase 16 DoD — §11 bullets "single-file backup with optional auto-copy", "settings panel covers all required knobs", "cost meter visible in header" now checkable; per-feature model-override consumption is the remaining DoD-pass item.

---

## Reference

- Spec / decisions / build-state docs: `SPEC.md` (§7.25), `CODE_SPEC.md` (§13, §17, §19, Q#9), `DECISIONS.md` (T-D28, T-D29, T-D33, T-D4, T-D32), `CHECKLIST.md` (Phase 15), `ROADMAP.md` (Phase 15, §13).
- PR: #23 — https://github.com/jaydomains/throughline/pull/23
