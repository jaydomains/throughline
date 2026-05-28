# Throughline Handover — Phase 21 Slice 2: bootstrap-output chokidar watcher (refcounted registry + startup-scan)

**Generated:** 2026-05-28
**Last commit SHA:** pending — 2026-05-28
**Previous handover:** `2026-05-28-phase-21-slice-1-prompt-template-render-endpoint-path-guard.md` (PR #59 — Phase 21 Slice 1)

Second slice of the Phase 21 chain (tracking issue [#58](https://github.com/jaydomains/throughline/issues/58), `Auto-continue: phase-21-build-immutable-riddle`).

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| C-D21 surface 3 — `packages/backend/src/bootstrap/watcher.ts` chokidar watcher mirroring inbox/watcher.ts; refcounted per project: registered on render-endpoint first call, unregistered on project delete; watches `<repo_path>/.throughline/bootstrap-output.json`; on detected write completion, hands off to worker | built | `packages/backend/src/bootstrap/watcher.ts`; `packages/backend/test/bootstrap-watcher.test.ts` (11 tests) | Watches the `.throughline/` directory with chokidar `depth: 0` + filename filter, not the single file path. Watching a non-existent file polls slowly and unreliably; the inbox precedent's directory + depth-0 + filename filter is more robust. Render endpoint mkdirs `.throughline/` before the first watcher registration; startup-scan lazy-creates it for projects that have never rendered. |
| Watcher serial drain via promise chain (single in-flight ingest at a time) | built | `watcher.ts` `scheduleDrain()` (chains `draining = draining.then(...)` — same shape as `inbox/watcher.ts:43–49`) | Matches Phase 20's `bootstrap/service.ts` transactional upsert semantics: one transaction per ingest, no overlapping writes on the same project_id. |
| Startup-scan via existing-file enqueue (SPEC §7.6 "Backend down behaviour"); spec-author Q2 at chain-open — startup-scan + render-call refcount belt-and-braces | built | `watcher.ts` `startupScan(projects)`; `enqueueIfPresent(projectId, repoPath)` called synchronously inside `register()` before chokidar arms | Closes the restart-mid-wait data-loss gap C-D21 left implicit. The synchronous existing-file enqueue inside `register()` also closes the file-pre-ready race (an existing `bootstrap-output.json` at register time is enqueued before any chokidar event could fire). |
| Spec-author decision at chain-open — accept the abandonment leak ("user renders prompt then never runs Claude Code") | documented | `watcher.ts` module header comment; `register()` comment: `// idempotent — accept the leak`; chain-state `notes.slice2WatcherCleanup` from chain-open carried forward | Chokidar `depth: 0` on a single directory is near-free; backend restart self-clears the registry; render is a rare action — over-engineering self-clearing cleanup is the wrong cost trade. The watcher sits live until project delete or backend restart. |
| Render endpoint auto-arms the watcher on first call | built | `render.ts` `BootstrapRenderDeps.watcher?: BootstrapWatcherRegistry`; `renderBootstrapPrompt` calls `deps.watcher?.register(projectId, project.repo_path)` after writing the prompt. Optional so existing tests can omit it. | Production wiring (server.ts injects the real registry) lands in slice 3 alongside the real worker. |
| Project delete unregisters the watcher | built | `projects/service.ts` `createProjectsService(db, registry, bootstrapWatcher?)`; `delete()` fires `void bootstrapWatcher?.unregister(id)` (fire-and-forget; preserves the existing synchronous delete surface) | Backward-compatible: existing unit-test callers omit the new optional parameter. Production wiring lands in slice 3. |
| Watcher's `BootstrapWorker` interface defined here; stubbed in tests; slice 3 lands the real implementation | built | `watcher.ts` `export interface BootstrapWorker { enqueue, drain }`; `bootstrap-watcher.test.ts` `createStubWorker()` exposes `enqueued: RecordedEnqueue[]` + `drains: number` for assertions | Mirrors inbox's `InboxWorker` interface shape. Slice 3's worker will satisfy this interface; server.ts in slice 3 instantiates the real worker and threads it through `createBootstrapWatcherRegistry`. |

---

## Last Decision Minted

No new decisions minted. Implementation followed T-D56 (file-mediated invocation contract; chokidar watches `<repo>/.throughline/bootstrap-output.json`; subprocess-spawning deferred), C-D21 surface 3 (refcounted-per-project watcher mirroring inbox precedent), and the spec-author Q2 + watcher-cleanup decisions locked at Phase 21 chain-open. Implementation-shape choices recorded inline at the watcher site:

- **Directory-watch with filename filter, not file-watch.** chokidar watches the `.throughline/` directory with `depth: 0`; the event handler filters on `basename(filePath) === 'bootstrap-output.json'`. Watching a non-existent file path polls slowly and unreliably across filesystems (especially layered FS in CI containers); the inbox precedent's directory + depth-0 shape is the same trade-off — robust delivery in exchange for one filename check.
- **Optional `BootstrapWatcherRegistry` parameter on both render and projects services.** Slice 2 ships against an injected interface alone (server.ts wiring lands in slice 3 with the real worker). Optional parameters keep the slice self-contained and the existing test callers untouched — no orphan code on main because the new code is reachable from tests.
- **Fire-and-forget `unregister` in `projects.service.delete()`.** `unregister` returns a Promise (it awaits `chokidar.close()`), but `delete` has always been synchronous. `void bootstrapWatcher?.unregister(id)` preserves the existing service surface without forcing every caller (and there are many) into async/await. The close happens asynchronously; correctness doesn't depend on it completing before delete returns.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/backend/src/bootstrap/watcher.ts` — `createBootstrapWatcherRegistry()` factory; `BootstrapWorker` interface (`enqueue(projectId, filePath)` + `drain()`); `BootstrapWatcherRegistry` interface (`register` / `unregister` / `stop` / `startupScan`); module-header documents the locked lifecycle and the abandonment-leak acceptance.
- `packages/backend/test/bootstrap-watcher.test.ts` — 11 tests covering lifecycle without chokidar (8 tests: idempotent `register`, no-enqueue when no existing file, **synchronous enqueue when existing file present** — file-pre-ready race, unregister of unknown project is no-op, unregister-then-re-register treats project as fresh, idempotent `stop`, `startupScan` iterates + skips projects without `repo_path`, `startupScan` over empty project set, **register after stop is a no-op — Gitar #60 regression**); chokidar smoke (3 tests: attach without throw + clean stop, unregister-with-watch is awaitable + re-register allowed). Event-delivery assertions intentionally omitted: containerised CI inotify is unreliable, mirroring the existing methodology loader and md-ingest watcher test conventions.
- `docs/_meta/throughline/handovers/2026-05-28-phase-21-slice-2-bootstrap-output-watcher.md` — this handover.

**Modified:**
- `packages/backend/src/bootstrap/render.ts` — `BootstrapRenderDeps` gains optional `watcher` field; `renderBootstrapPrompt` calls `deps.watcher?.register(projectId, project.repo_path)` after writing the prompt.
- `packages/backend/src/projects/service.ts` — `createProjectsService` gains optional `bootstrapWatcher` parameter; `delete()` fires `void bootstrapWatcher?.unregister(id)`.
- `.claude-code/auto-continue-state.json` — slice 1 marked merged (PR #59 merge timestamp); slice 2 open (PR #60, 1 fix-round); slices 3–4 still pending; `currentIndex: 1`.
- `CHECKLIST.md` §21 — slice 2 ticked with evidence.
- `docs/_meta/throughline/PLATFORM_STATUS.md` — Snapshot + Current Phase + Recent Slice History rolled.

**Deleted:** _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| `throughline:pause` label still absent (fourth consecutive chain-open without it; carried over from Phase 21 chain-open at slice 1) | `jaydomains/throughline` repo settings | Persistent gap surfaced in slice 1 handover and `PLATFORM_STATUS.md` Queued Work. Phase 21 chain operates on the two fallback signals as planned (marker file + `/pause` comments); Phase 19, Phase 20, and Phase 21 slice 1 all ran clean on these. | Spec author confirmed at Phase 21 chain-open they will create the label manually out-of-band; not a blocker. Tracked in `PLATFORM_STATUS.md` Queued Work as the fourth-pass entry. |

---

## Open Questions

- [ ] **Slice 3 worker error-classification: which errors quarantine vs which re-raise?** The validator's `BootstrapValidationFailedError` clearly quarantines (the file is malformed). A `BootstrapNoBundleBoundError` thrown mid-ingest is more ambiguous — the project lost its bundle binding between render and write. Quarantine? Re-raise and let the user notice via SettingsView? Worker (slice 3) decides; predicate is "any `service.importBootstrap` throw → quarantine + `.error.json`" (mirrors inbox `dumpZone.propose` failure path), but the decision lands then.
- [ ] **Slice 3 `GET /bootstrap/state` response shape — exact fields for slice 4 consumption.** Slice 4 needs: `.throughline/` state (absent / partial / complete), last-ingest summary (timestamp + new/reimported/conflict counts), quarantine count + path. Exact JSON shape lands in slice 3.
- [ ] **Slice 4 retained-behaviour test coverage.** Carry-forward from Phase 21 chain-open: slice 4 replaces working components (`ThroughlineStatusBlock`, `BootstrapReviewBlock`) rather than landing greenfield UI. Slice 4's `BootstrapBlock.test.tsx` must explicitly cover retained behaviour — status banner across `.throughline/` states, review-queue link still navigates correctly, stale-row count still displayed — not only the new init affordance.

---

## Recently Resolved

- **Phase 21 slice 1 merge** — PR #59 merged 2026-05-28T10:21Z; the slice 1 handover's "Slice 2 next" carry-forward is now this slice.
- **Spec-author Q2 watcher-cleanup decision documentation** — the "accept the leak" decision locked at chain-open was carried forward through slice 1's chain-state notes; slice 2 documents it explicitly in `watcher.ts`'s module header + the `register()` idempotency comment, closing the carry-forward.
- **Gitar finding on PR #60** — `register()` after `stop()` could leak a chokidar instance (the trailing `entries.clear()` drops the map reference but the FSWatcher keeps running un-closed). Folded inline in commit `dba1d4f` via a `stopping` flag guard at `register()` entry. +1 regression test (`"register after stop is a no-op"`).

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- `packages/backend/src/inbox/watcher.ts` — chokidar lifecycle precedent (serial drain via promise chain, idempotent stop, ignoreInitial + enqueueExistingFiles).
- `packages/backend/src/projects/service.ts` — `ProjectsService.list()` signature (consumed by `startupScan`).
- `packages/backend/src/bootstrap/render.ts` — render endpoint is the watcher's primary register caller (auto-arms on first render).

**Downstream (consumes this slice's work):**
- **Slice 3** (worker) — implements the `BootstrapWorker` interface defined here; creates the real worker; threads `createBootstrapWatcherRegistry({ worker })` into server.ts; calls `bootstrapWatcher.startupScan(projects)` after server.listen; threads the registry into `createProjectsService(db, registry, bootstrapWatcher)` and `BootstrapRenderDeps.watcher` so the optional fields become populated in production.
- **Slice 4** (unified SettingsView block) — surfaces watcher-driven state (last-ingest summary, quarantine count) via the `GET /bootstrap/state` endpoint slice 3 adds.

---

## Reference

- `DECISIONS.md` T-D56 — file-mediated invocation contract; subprocess-spawning deferred.
- `CODE_SPEC.md` C-D21 — six implementation surfaces; this slice lands surface 3.
- `SPEC.md` §7.28 — bootstrap prompt and Claude Code invocation.
- `SPEC.md` §7.6 — "Backend down behaviour" (the startup-scan precedent).
- `ROADMAP.md` §21 — Scope / Dependencies / Done when / Sizing (medium).
- `docs/.throughline-schema.md` — transient-files section (bootstrap-output.json under Throughline-managed transient files).
- `docs/_meta/throughline/AUTO_CONTINUE_WORKFLOW.md` — chain mechanics, halt classes, kill switch.
- Plan: `/root/.claude/plans/plan-mode-phase-21-build-immutable-riddle.md` (session-local, not in repo).
- Tracking issue: [#58](https://github.com/jaydomains/throughline/issues/58) — `Auto-continue: phase-21-build-immutable-riddle`.
- Chain state: `.claude-code/auto-continue-state.json`.
- Prior handover (Phase 21 slice 1): `docs/_meta/throughline/handovers/2026-05-28-phase-21-slice-1-prompt-template-render-endpoint-path-guard.md`.
- PR: [#60](https://github.com/jaydomains/throughline/pull/60) — Phase 21 / Slice 2.
