# Throughline — Phase 2 Handover

**Generated:** 2026-05-12 (pre-merge)
**Last commit SHA:** see PR head — 2026-05-12
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-12-phase-1-runtime-substrate.md` (Phase 1 — runtime substrate)

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| React app served by backend at `/` | built | `packages/backend/src/routes/web.ts`; smoke test served `index.html` + hashed `/assets/*.js` + SPA fallback on `/projects/abc` | Dev path uses Vite on `5173` with proxy to backend; prod path resolves `packages/frontend/dist`. |
| Project switcher in header lists and switches projects | built | `packages/frontend/src/components/ProjectSwitcher.tsx`; `POST /api/projects/:id/switch` in `packages/backend/src/projects/routes.ts` | Writes `last_active_project_id` to settings; navigation is URL-driven. |
| All nine view-mode routes render an empty stub under `/projects/:id/...` | built | `packages/frontend/src/App.tsx` routes; `src/views/stubs.tsx` | Stubs intentionally label themselves as placeholders for downstream phases. |
| Modules view mode hidden when bundle declares no primary unit | built | `src/views/modes.ts` `visibleFor`; `ViewToggle.tsx`; `ModulesView` guard | Verified by `test/viewToggle.test.tsx`, `test/stubs.test.tsx`. |
| Methodology-gates view mode hidden when bundle declares no gates | built | same mechanism | Same. |
| Header view-mode toggle | built | `src/components/ViewToggle.tsx` | NavLink per visible mode, URL is source of truth. |
| Header scratchpad / cost meter / backup indicator placeholders | built | `src/components/Header.tsx`, `ScratchpadPlaceholder.tsx` | Cost + backup are inert pills; real behaviour wires up in Phases 4 / 15. |
| Command palette `Cmd+K` / `Ctrl+K` open/close + fuzzy + cross-project | built | `src/components/CommandPalette.tsx`; `useHotkey('mod+k')` in `App.tsx`; `fuse.js` | Indexes every project + every visible view mode + a "go to projects" action. Verified by `test/commandPalette.test.tsx`. |
| Keyboard navigation primitives (Esc, `?`, Tab/Shift-Tab indent, arrow nav) | built (global subset) | `src/keyboard/{useHotkey.ts,modalStack.tsx,registry.tsx}` | Esc / `?` / Cmd+K wired; Tab + arrow consumers register in the help modal but the list-row consumers land in Phase 3 (no lists exist yet). |
| SSE channel established + ping/pong | built | `packages/backend/src/routes/events.ts`; `packages/frontend/src/hooks/useSSE.ts`; live-channel pill in header | 15s ping cadence; `welcome` on connect. Verified by `test/server.test.ts`. |
| Backend-down state shows a banner rather than crashing | built | `src/hooks/useBackendHealth.ts` (10s `/health` poll); `src/components/DownBanner.tsx` | Banner appears when `/health` fails; clears on recovery. |
| Last-active-project resolved (Phase 1 open question) | built | `POST /api/projects/:id/switch` writes settings; `App.tsx` reads `last_active_project_id` on boot, redirects `/` accordingly | Phase 1's open question on this is closed. |
| `/api/methodologies` exposes `has_primary_unit` / `has_gates` | built | `packages/backend/src/routes/methodologies.ts` | Frontend uses these to filter view toggle and palette. |

If a deliverable is `partial`, the Notes column names the next-phase consumer that will activate it.

---

## Last Decision Minted

> No new T-D or C-D anchors minted. Implementation followed T-D30, T-D40, T-D47, C-D1, and SPEC §7.11 / §7.24 / CODE_SPEC §18.

Conventions adopted during this slice (apply going forward):

- **Library choices within the established C-D1 stack are not separately anchored unless they have architectural implications.** `react-router-dom`, `fuse.js`, `@vitejs/plugin-react`, and the React 18 + Vite + TypeScript pairing are conventional ecosystem defaults at the C-D1 level — they don't merit individual C-D anchors. A new C-D is only warranted when a library choice locks in an architectural shape (e.g. a state-management or persistence engine).
- **Active-project state is URL state.** The browser URL (`/projects/:id/...`) is the source of truth for which project the user is on. `POST /api/projects/:id/switch` records `last_active_project_id` as a hint for next-session default only — not a server-enforced active-project lock. This avoids the need for any global "active project" data model.
- **SPA fallback for client routes.** The backend's static-serve route returns `index.html` for any non-API, non-`/events`, non-`/health` path that doesn't resolve to a real asset under `dist/`. This is the standard SPA serving idiom and is centralised in `packages/backend/src/routes/web.ts`.
- **SSE is the backend-push channel.** All backend-pushed updates (drift signals, gate firings, cost meter, polling state, bundle reloads, etc.) will multiplex through `GET /events` per CODE_SPEC §1. Phase 2 only proves the channel with `welcome` + `ping`; producers land in later phases.
- **Multi-event cleanup handlers must be idempotent by default.** When the same cleanup function is registered on more than one event (e.g. `close` + `error` on the same socket; `SIGINT` + `SIGTERM`; or any analogous pair), the second invocation must be a no-op. Use a `cleaned` boolean guard at the top of the function. The cost of forgetting this — double `clearInterval`, double `reply.raw.end()`, double DB close — is silent corruption later. Lands in `packages/backend/src/routes/events.ts` as the reference shape.
- **Async I/O for per-request file reads.** Per-request file reads use `fs/promises.readFile`; sync reads are reserved for one-shot startup work. The single-user deployment context makes the perf delta negligible, but the pattern matters once any phase introduces concurrent I/O (file watchers + request handlers + child-process integrations). Lands in `packages/backend/src/routes/web.ts`.

---

## Active Blockers

_none_

Provisional / parked items future phases must revisit:
- **Tab/Shift-Tab indent + arrow-key list nav consumers** — registered as global bindings in the help modal but no consumer renders yet. Phase 3 (list rows) is the first consumer site.

---

## Files Changed Since Last Handover

**New (`packages/frontend/`):**
- `package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`, `vitest.setup.ts`, `index.html`
- `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/api.ts`
- `src/components/{CommandPalette,DownBanner,Header,HelpModal,ProjectSwitcher,ScratchpadPlaceholder,ViewToggle}.tsx`
- `src/hooks/{useBackendHealth,useMethodologies,useProjects,useSSE}.ts`
- `src/keyboard/{modalStack.tsx,registry.tsx,useHotkey.ts}`
- `src/views/{modes.ts,stubs.tsx}`
- `test/{commandPalette,stubs,viewToggle}.test.tsx`

**New (`packages/backend/`):**
- `src/routes/events.ts` — SSE channel.
- `src/routes/web.ts` — static-serve + SPA fallback.
- `test/server.test.ts` — methodology flags, `/switch`, `/events` smoke.

**Modified:**
- `packages/backend/src/server.ts` — wires `events` + `web` routes; derives bound port from listening socket (port 0 → random for tests); accepts `serveFrontend` option.
- `packages/backend/src/projects/routes.ts` — adds `POST /api/projects/:id/switch`; takes a `SettingsService` so it can persist `last_active_project_id`.
- `packages/backend/src/routes/methodologies.ts` — exposes `has_primary_unit` + `has_gates` derived from the parsed bundle.
- `package.json` — adds `dev:web` script; rewires `build` to build shared → frontend → backend in order.
- `pnpm-lock.yaml` — frontend deps + dev tooling.
- `README.md` — Phase 2 status; two-terminal dev flow documented.
- `CHECKLIST.md` — every Phase 2 box ticked with evidence/notes.

**Deleted:** _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| `<Navigate to="..">` did not resolve as expected in test routing | `src/views/stubs.tsx` `ModulesView` / `GatesView` | `to=".."` resolves relative to the matched *route* in react-router v6 — from a flat `<Routes>` block, that ends up at `/` instead of the project home. | Switched to `to=".." relative="path" replace />` so the segment-based URL resolution wins. |
| Vitest + Testing Library cleanup | `packages/frontend/vitest.setup.ts` | Without `globals: true`, `@testing-library/react`'s auto-cleanup doesn't register. DOM from earlier tests bled into later ones. | Registered `afterEach(cleanup)` in `vitest.setup.ts`. |
| Fastify port 0 binding | `packages/backend/src/server.ts` | Tests requested port 0 (random) but `server.url` used `config.port`, so smoke fetches hit `:0`. | Read the bound port from `app.server.address()` after `listen`. |
| Fastify SSE response framing | `packages/backend/src/routes/events.ts` | Without `reply.hijack()`, Fastify may try to serialise a response after we write SSE headers directly. | Called `reply.hijack()` before `writeHead` so Fastify hands the socket over cleanly. |

---

## Open Questions

- [ ] Should structural-validation errors in `/api/methodologies` carry line numbers for the offending H2 heading? Carried over from Phase 1; the UI banner that would consume them lands when project create + bundle-error state surfaces in Phase 3 or later.
- [ ] Should the live-channel pill in the header surface the seq counter from the last ping for debug, or stay reduced to a binary indicator? Resolves when a Phase 4+ producer (drift signal / cost meter / etc.) needs richer header status.

---

## Recently Resolved

- **"How will the eventual frontend distinguish the 'last-active project' so it can default the project switcher?"** — flagged in `2026-05-12-phase-1-runtime-substrate.md` Open Questions. Resolved by `POST /api/projects/:id/switch` writing `last_active_project_id` into settings, and the app reading it on boot to redirect `/` to that project's home.
- **`POST /api/projects/:id/switch` deferred from Phase 1** — flagged in Phase 1 Drift Flags. Landed this phase as described above.

---

## Cross-Module Dependencies

**Upstream (this module consumes):**
- Phase 1 endpoints: `GET /health`, `GET /api/projects`, `GET /api/methodologies`, `GET /api/settings`, `POST /api/projects/:id/switch` (this slice), `GET /events` (this slice).
- `react`, `react-dom`, `react-router-dom`, `fuse.js`, `@vitejs/plugin-react`, `vite`, `vitest`, `@testing-library/*`, `jsdom` — conventional C-D1 stack defaults, not separately anchored per the convention adopted this phase.

**Downstream (consumes this module):**
- Phase 3 (items + sessions): consumes the routing shell, the view stubs (replaces SessionView / TreeView / etc. with real content), the keyboard primitives' list-row contract (Tab/Shift-Tab indent, arrow nav), and the SSE channel for item-change notifications.
- Phase 4 (capture surfaces): replaces `ScratchpadPlaceholder` with the real scratchpad; adds dump-zone surfaces.
- Phase 6 / 7 / 8 / 9 / 10 / 13 / 14: each phase's producer pushes through the SSE channel and lands content in the matching view stub.
- Phase 15: replaces the cost meter + backup indicator header pills with live values.

---

## Reference

- Specs operated against: `SPEC.md` §7.2, §7.11, §7.24 (T-D30, T-D40, T-D47); `CODE_SPEC.md` §1, §18, §19, C-D1; `ROADMAP.md` Phase 2; `CHECKLIST.md` Phase 2.
- PR: filled in at PR open.
