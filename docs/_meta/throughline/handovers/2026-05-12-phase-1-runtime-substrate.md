# Throughline — Phase 1 Handover

**Generated:** 2026-05-12 (pre-merge)
**Last commit SHA:** see PR head — 2026-05-12
**Previous handover:** _none_ (this is the first handover; Phase 0 closed without one)

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Backend bootstraps via single command, binds 127.0.0.1, exposes a port | built | `packages/backend/src/index.ts`, `src/server.ts`, `src/config.ts` | Default port `47823`, override via `THROUGHLINE_PORT`. |
| `/health` endpoint | built | `packages/backend/src/routes/health.ts` | Reports data dir, methodologies dir, secrets presence. |
| SQLite + migration runner + `_migrations` table | built | `packages/backend/src/db/migrate.ts`, `src/db/migrations/0001_init.sql` | Idempotent re-run verified by test. |
| All CODE_SPEC §3 tables present | built | `0001_init.sql` | Includes `projects`, items + 11 joins, sessions, library, directives, audit_log, chat_history, drift_signals, gate_firings, checklist_runs + steps, orphaned_rules, text_embeddings, cc_inbox_queue, cost_telemetry, github_state_cache, settings, scratchpad_jots. |
| `projects.bundle_id NOT NULL` (T-D47) | built | `0001_init.sql` + `test/migrate.test.ts` | Insert without bundle_id throws. |
| Per-project tables carry `project_id` FK with cascade | built | `0001_init.sql` | Cascade verified via `projects.test.ts` deletion test. |
| Audit log writer across entity types (T-D36) | built (table + helper + 4 producers) | `src/audit/log.ts` consumed by `projects/service.ts`, `settings/service.ts`, `methodology/loader.ts` | Items/library/gate-firings/checklist-step producers wire up in later phases. |
| Secrets file separation (T-D4) | built | `src/secrets/store.ts`, `~/.throughline/secrets.json` | Settings layer rejects secret-looking keys (`*_api_key`, `*_pat`, etc.). |
| Cost telemetry table + writer (T-D29 placeholder) | built | `src/cost/telemetry.ts` | Producers wire up when AI features land (Phase 4+). |
| Bundle discovery from `methodologies/` (C-D3) | built | `src/methodology/loader.ts` | `fs.readdir` + per-dir `bundle.md` check. |
| Eleven-section H2 parser (C-D4) | built | `src/methodology/bundle-parser/` | One file per section + a section walker + a dispatcher. |
| Typed `LoadedBundle` output | built | `packages/shared/src/bundle.ts` | Shared between backend + future UI. |
| Structural-validation errors fail loudly | built | parser returns `{status:'error', errors}`; loader logs at error level; `/api/methodologies` exposes per-bundle state | UI banner deferred to Phase 2 (no UI yet). |
| Freeform bundle ships and loads | built | `methodologies/freeform/bundle.md` | "None" declarations accepted for sections 2,3,4,6,7,8,10. |
| Project CRUD via REST + minimal CLI | built | `src/projects/{service,routes}.ts`, `src/cli/index.ts` | `switch` endpoint deferred to Phase 2 per plan amendment — no UI consumer yet. |
| Project create defaults `bundle_id='freeform'` | built | `projects/service.ts` `DEFAULT_BUNDLE_ID` + `projects.test.ts` | Verified in unit test + live smoke test. |
| Settings round-trip via REST | built | `src/settings/{service,routes}.ts` | GET/PUT `/api/settings`; per-key audit-log entry. |
| Bundle file change triggers re-load with audit-log entry per affected project | built | `methodology/loader.ts` chokidar wiring + `test/loader.test.ts` | Test creates two projects, edits the bundle, asserts an audit row per project. |
| Login auto-start documented per platform | built | `docs/install/auto-start.md` | launchd / systemd / Task Scheduler; not enabled by default. |
| Vitest suite | built | `packages/backend/test/*.test.ts` | 15 tests pass; covers parser, migrations, projects, loader, settings. |

If a deliverable is `partial`, the Notes column names the next-phase consumer that will activate it.

---

## Last Decision Minted

> No new T-D or C-D decisions minted. Implementation followed T-D2, T-D3, T-D4, T-D19, T-D31, T-D36, T-D40, T-D41, T-D42, T-D47 and C-D1, C-D3, C-D4, C-D5.

Plan-time amendments (not anchor-level):
- Secrets live at `~/.throughline/secrets.json` alongside the datastore (user direction). T-D4's "never copied by backup" rule will be enforced by backup-code exclusion (Phase 15), not by filesystem location.
- `POST /api/projects/:id/switch` deferred to Phase 2 (no UI consumer in Phase 1).
- Default port set to `47823` (no spec value).

---

## Active Blockers

_none_

Provisional / parked items that future phases must revisit:
- **Voice input language default** (§13, Phase 4) — no spec recommendation; Phase 4 plan defaults to English with toggle.
- **Cost meter daily threshold default** (§13, Phase 15) — no spec recommendation; Phase 15 plan defaults to "no threshold".
- **Four phase-moment trigger mechanisms** (CODE_SPEC.md Questions 1–4) — Phase 8 carries provisional mechanisms.

---

## Files Changed Since Last Handover

**New (top-level):**
- `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc` — workspace scaffolding.
- `methodologies/freeform/bundle.md` — shipped freeform bundle (T-D41, T-D47).
- `docs/install/auto-start.md` — login auto-start docs per platform.
- `docs/_meta/throughline/handovers/2026-05-12-phase-1-runtime-substrate.md` — this file.

**New (`packages/shared/`):**
- `package.json`, `tsconfig.json`
- `src/index.ts`, `src/bundle.ts`, `src/project.ts`, `src/audit.ts` — typed contracts used by backend and (later) UI.

**New (`packages/backend/`):**
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `scripts/copy-migrations.mjs`
- `src/index.ts`, `src/server.ts`, `src/config.ts`
- `src/db/index.ts`, `src/db/migrate.ts`, `src/db/migrations/0001_init.sql`
- `src/audit/log.ts`, `src/secrets/store.ts`, `src/cost/telemetry.ts`
- `src/methodology/loader.ts`
- `src/methodology/bundle-parser/{index,sections,identity,project-layout,anchor-system,marker-system,state-machine,communication-model,gating-model,review-patterns,templates,validation-rules,authority-hierarchy}.ts`
- `src/projects/{service,routes}.ts`
- `src/settings/{service,routes}.ts`
- `src/routes/{health,methodologies}.ts`
- `src/cli/index.ts`
- `test/{helpers,bundle-parser,migrate,projects,loader,settings}.test.ts`

**Modified:**
- `.gitignore` — added `node_modules/`, `dist/`, `*.tsbuildinfo`, `coverage/`, `.pnpm-store/`; uncommented SQLite ignore.
- `README.md` — status changed to "Phase 1 in progress"; install/run section now documents `pnpm dev` + `pnpm build && start` + CLI.
- `CHECKLIST.md` — every Phase 1 box ticked with evidence/notes.

**Deleted:** _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| `exactOptionalPropertyTypes` friction | `bundle-parser/{anchor-system,templates}.ts`, `cli/index.ts`, `projects/routes.ts` | Initial code assigned `undefined` to optional fields directly; strict mode rejected. | Switched to conditional assignment patterns; no contract change. |
| Migrations directory in dist | `packages/backend/scripts/copy-migrations.mjs` | `tsc` doesn't copy `.sql` assets; the runtime needs them next to the compiled JS. | Added a tiny post-tsc copy script; dev path uses tsx and reads source directly. |
| `switch` endpoint deferred | `packages/backend/src/projects/routes.ts` | Plan included `POST /api/projects/:id/switch`. User suggested deferring if non-trivial; the active-project concept needs UI state which Phase 2 introduces. | Deferred to Phase 2; not in routes. Phase-1 done-when reworded in CHECKLIST. |

---

## Open Questions

- [ ] How will the eventual frontend distinguish the "last-active project" so it can default the project switcher? Resolves in Phase 2 when the switcher lands.
- [ ] Should structural-validation errors in `/api/methodologies` carry line numbers for the offending H2 heading? Useful once the UI banner lands in Phase 2.

---

## Recently Resolved

_none_ — first build slice.

---

## Cross-Module Dependencies

**Upstream (this module consumes):**
- `better-sqlite3` (datastore), `fastify` (HTTP), `chokidar` (file watching), `nanoid` (IDs), `@anthropic-ai/sdk` (not yet pulled — Phase 4).

**Downstream (consumes this module):**
- Phase 2 (UI shell) — consumes `/health`, `/api/methodologies`, `/api/projects`, `/api/settings`.
- Phase 3 (items + sessions) — consumes the projects + audit-log + bundle-loader services directly.
- Phase 7 (SiteMesh bundle) — drops `methodologies/sitemesh/bundle.md` into the same loader path.

---

## Reference

- Specs operated against: `SPEC.md` §3, §7.1, §7.2, §7.4, §7.25, §11, §14 (T-D2/3/4/19/31/36/40/41/42/47); `CODE_SPEC.md` §1–§3, §19, C-D1/3/4/5; `ROADMAP.md` Phase 1; `CHECKLIST.md` Phase 1.
- PR: filled in at PR open.
