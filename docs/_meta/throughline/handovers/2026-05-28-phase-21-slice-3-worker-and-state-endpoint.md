# Throughline Handover — Phase 21 Slice 3: bootstrap archive/quarantine worker + GET /bootstrap/state + server.ts wiring

**Generated:** 2026-05-28
**Last commit SHA:** pending — 2026-05-28
**Previous handover:** `2026-05-28-phase-21-slice-2-bootstrap-output-watcher.md` (PR #60 — Phase 21 Slice 2)

Third slice of the Phase 21 chain (tracking issue [#58](https://github.com/jaydomains/throughline/issues/58), `Auto-continue: phase-21-build-immutable-riddle`).

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| C-D21 surface 4 — `packages/backend/src/bootstrap/worker.ts` mirrors `inbox/worker.ts`; routes detected output file to Phase 20 ingest path via direct call to `BootstrapImportService.importBootstrap`; archive on success to `bootstrap-archive/<ISO-ts>-bootstrap-output.json`; quarantine on failure to `bootstrap-quarantine/` + sibling `.error.json` | built | `packages/backend/src/bootstrap/worker.ts`; `packages/backend/test/bootstrap-worker.test.ts` (15 tests) | Direct service call (not HTTP self-call) matches inbox precedent (`dumpZone.propose()` direct call). Lazy `mkdirSync(recursive: true)` for both archive and quarantine dirs (inbox.worker.ts:84,132 pattern). |
| Error classification: every quarantine carries a sibling `.error.json` with one of `parse_failed` / `read_failed` / `validation_failed` / `no_bundle_bound` / `project_not_found` / `ingest_failed` envelopes | built | `bootstrap-worker.test.ts` "quarantine on failure" describe block (5 tests, one per failure mode); each test inspects the sibling `.error.json` payload | `BootstrapValidationFailedError.errors` array preserved verbatim in the `.error.json` so the user has the exact validator diagnostics. Worker does NOT re-raise — the watcher's serial drain catches all errors, but surfacing quarantine + `.error.json` gives a recoverable surface vs a silent dropped file. |
| Vanished-file (rapid manual `.throughline/` cleanup between watcher event and drain) is a logged warning, not a quarantine | built | `bootstrap-worker.test.ts` "tolerates a file that vanished between enqueue and drain (no quarantine, no throw)" | Nothing to move; the worker logs and returns. Mirrors inbox's `existsSync(row.original_path)` guard at quarantine time. |
| Last-ingest result cached in-memory per project for slice 4's status display | built | `worker.ts` `lastIngest = new Map<string, LastIngest>()`; `bootstrap-worker.test.ts` "moves a successfully-ingested file..." asserts `getLastIngest('proj-a').counts` | Persistence across backend restart is not a v1 requirement; the user re-renders or queries the archive directly for historical state. |
| C-D21 surface 5 — re-bootstrap is the same flow re-run; T-D54's idempotent upsert handles row classification | built | `bootstrap-worker.test.ts` "drains multiple distinct projects sequentially in enqueue order" exercises the multi-write scenario; T-D54 idempotency is covered by Phase 20's `bootstrap/service.ts` tests | No new code per C-D21; the worker simply re-runs `importBootstrap` per drain pass and each call is a fresh transactional upsert. |
| `GET /api/projects/:id/bootstrap/state` read-only fs probe + worker last-ingest cache for slice 4 consumption | built | `bootstrap/routes.ts` route registration; `worker.ts` `readBootstrapState(repoPath, lastIngest)`; `bootstrap-worker.test.ts` "readBootstrapState" describe block (5 tests) | Returns `throughlineDir` presence, `promptRendered`, `pendingOutput`, `lastIngest` (timestamp + counts), `archiveCount`, `quarantineCount` (counts only `-bootstrap-output.json` suffix — `.error.json` siblings excluded), `promptPath`, `outputPath`. 404 for project_not_found; degrades gracefully for repo-less projects (returns `absent` + all-zero counts). |
| server.ts wiring resolves the construction cycle (watcher needs worker, worker needs import service, import service needs projects); production now arms the watcher on first render and on backend boot | built | `server.ts`: `let bootstrapWatcher: BootstrapWatcherRegistry \| null = null;` + callback into `createProjectsService`; later `bootstrapWorker` + `bootstrapWatcher` constructed; threaded into `BootstrapRenderDeps.watcher`; `await bootstrapWatcher.startupScan(projects)` before `app.listen` | The callback closes over the let-bound `bootstrapWatcher`; projects is constructed before watcher; cycle resolved without restructuring existing services. `startupScan` fires after schedulers start but before `app.listen` so restart-recovery ingest completes before HTTP requests can race against it (spec-author Q2 at chain-open). |
| `projects/service.ts` callback refactor (slice 2's `bootstrapWatcher?: BootstrapWatcherRegistry` direct param replaced with `onBootstrapUnregister?: (projectId: string) => void`) | built | `projects/service.ts` `BootstrapWatcherUnregisterHook` type + `delete()` calls `onBootstrapUnregister?.(id)` | Existing call sites that omit the parameter remain unchanged (`undefined` → no callback fires). The signature change is an implementation-shape refinement within slice 2's API — slice 2's direct-reference shape couldn't accommodate the construction cycle, slice 3's callback can. Per spec-drift policy: no T-D change, no C-D21 change (the contract "unregister on project delete" is preserved). |
| Graceful shutdown closes the bootstrap watcher | built | `server.ts` `close` returns `await bootstrapWatcher!.stop()` alongside `inboxWatcher.stop()` and `mdIngestWatcher.stop()` | Idempotent stop on the registry handles repeated invocations safely (slice 2 lifecycle test). |

---

## Last Decision Minted

No new decisions minted. Implementation followed C-D21 surface 4, the inbox/worker.ts shape precedent, and the spec-author Q2 + slice-3-server-wiring locks from chain-open. Implementation-shape choices recorded inline at the worker site:

- **In-memory `lastIngest` Map for the GET /bootstrap/state endpoint.** Alternatives considered: dedicated `bootstrap_state` DB table, audit_log aggregation, on-disk `.last-import.json` in `.throughline/`. The Map is simplest and matches the v1 requirement: slice 4 wants the last-ingest counts as a UI affordance, not a forensic surface. The archive directory itself remains the durable record (the GET endpoint reports its file count). Backend restart loses the in-memory cache; the user sees "last ingest unknown" until the next render → ingest cycle, which is a reasonable v1 degradation.
- **ISO-timestamp filename prefix (`2026-05-28T10-32-15Z-bootstrap-output.json`).** Replaces colons with hyphens for Windows compatibility; matches the schema doc's `<timestamp>-bootstrap-output.json` notation. The inbox precedent uses `YYYY-MM-DD/<row.id>__<originalName>` (dated subdir + ID prefix) because multiple files per day per project are expected; bootstrap has at most one output file per render per project so a single flat archive dir with timestamped filenames is sufficient.
- **Constructor-cycle resolution via callback, not holder ref.** The callback `(projectId) => void bootstrapWatcher?.unregister(projectId)` closes over a let-bound variable populated after construction. Cleaner than a `{ current: BootstrapWatcherRegistry | null }` holder object because it doesn't leak the indirection into the projects service's API. Slice 2's optional direct-reference param is replaced; existing call sites that omit the parameter are unchanged.
- **Worker writes the `.error.json` BEFORE the source copy.** Per Gitar finding fix-round 1: if `copyFileSync` fails, the user still sees what the worker observed via the sibling `.error.json` (even though the payload itself wasn't moved). Mirrors the inbox precedent's "audit + move attempt" sequencing.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/backend/src/bootstrap/worker.ts` — `createBootstrapWorker()` factory implementing the slice 2 `BootstrapWorker` interface; `readBootstrapState()` helper for the GET endpoint.
- `packages/backend/test/bootstrap-worker.test.ts` — 15 tests covering archive on success (2 tests), quarantine on each failure mode (5 tests: parse, validation, no_bundle_bound, project_not_found, generic ingest_failed), edge cases (3 tests: file-vanished tolerance, enqueue idempotency, multi-project sequential drain order), and `readBootstrapState` (5 tests: absent / promptRendered / pendingOutput / counts / lastIngest pass-through).
- `docs/_meta/throughline/handovers/2026-05-28-phase-21-slice-3-worker-and-state-endpoint.md` — this handover.

**Modified:**
- `packages/backend/src/bootstrap/routes.ts` — `GET /api/projects/:id/bootstrap/state` route added; `registerBootstrapRoutes` signature gains optional `worker?: BootstrapWorkerWithState` parameter.
- `packages/backend/src/projects/service.ts` — `bootstrapWatcher?: BootstrapWatcherRegistry` parameter replaced with `onBootstrapUnregister?: BootstrapWatcherUnregisterHook` callback (resolves the construction cycle).
- `packages/backend/src/server.ts` — worker + watcher constructed in the resolved order; `projects` re-wired to fire the unregister callback; watcher threaded into `BootstrapRenderDeps`; `startupScan` awaited before `listen`; `watcher.stop()` awaited on close.
- `.claude-code/auto-continue-state.json` — slice 2 marked merged (PR #60 merge timestamp); slice 3 open (PR #61, 1 fix-round); slice 4 still pending; `currentIndex: 2`.
- `CHECKLIST.md` §21 — slice 3 ticked with evidence.
- `docs/_meta/throughline/PLATFORM_STATUS.md` — Snapshot + Current Phase + Recent Slice History rolled.

**Deleted:** _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| `throughline:pause` label still absent (carried forward from slices 1 + 2) | `jaydomains/throughline` repo settings | Persistent gap; spec-author committed at chain-open to create the label manually out-of-band. Phase 21 chain operates on the two fallback signals as planned. | Documented in `PLATFORM_STATUS.md` Queued Work as the fourth-pass entry. Phase 21 will close on fallback signals if the label hasn't appeared by then. |

---

## Open Questions

- [ ] **Slice 4 unified Bootstrap block — exact UI consolidation.** The slice plan specifies replacing `ThroughlineStatusBlock` + `BootstrapReviewBlock` with a single `BootstrapBlock` that polls `GET /bootstrap/state`. Open: where the conflict-resolution modal trigger (currently `BootstrapReviewBlock`'s "Open bootstrap review" button) sits in the unified block — inline button vs collapsed section vs separate header bar. Lands in slice 4's PR.
- [ ] **Slice 4 retained-behaviour test coverage.** Carry-forward from chain-open + slice 2 handover: slice 4's `BootstrapBlock.test.tsx` must cover status banner accuracy across the three `.throughline/` states, the review-queue link still navigating to the conflict resolution UI, and the stale-row count still displayed — not just the new init affordance.
- [ ] **Chain-close handover.** Slice 4 is the chain's final slice; its handover closes the chain with the standard four-slice summary table (PR / merged / fix-rounds / lines) per the AUTO_CONTINUE_WORKFLOW chain-close convention. Slice 4 should also overwrite `.claude-code/auto-continue-state.json` with `chainClosedAt` populated.

---

## Recently Resolved

- **Slice 2 BootstrapWorker interface activation.** Slice 2 shipped against an injected interface stub; this slice lands the real `createBootstrapWorker()` and threads it through `createBootstrapWatcherRegistry({ worker: bootstrapWorker })`. The slice-2 optional `BootstrapRenderDeps.watcher` field is now populated in production.
- **Spec-author Q2 startup-scan wiring** — slice 2 defined `startupScan` on the registry; this slice calls it after schedulers start but before `app.listen` so restart-recovery ingest completes before HTTP requests can race against it.
- **Gitar finding on PR #61** — `quarantine()` deleted the source file even when `copyFileSync` failed; payload + recovery surface both lost. Folded inline in commit `72fe972` by restructuring quarantine to write `.error.json` first, then copy+rm in a guarded try (mirrors inbox/worker.ts:92-101 exactly). +0 regression tests (portably simulating `copyFileSync` failure requires fs mocking infrastructure the test suite doesn't currently use; same justification as slice 2's chokidar smoke-only tests).

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- `packages/backend/src/inbox/worker.ts` — archive/quarantine pattern precedent (try-block grouping copy+rm; sibling error file with `received_at`).
- `packages/backend/src/bootstrap/service.ts` — `BootstrapImportService.importBootstrap` direct-call target; `BootstrapImportResult` shape for the last-ingest cache; the three named error classes for classification.
- `packages/backend/src/bootstrap/watcher.ts` — `BootstrapWorker` interface (slice 2); registry threading.

**Downstream (consumes this slice's work):**
- **Slice 4** (unified Bootstrap block) — polls `GET /api/projects/:id/bootstrap/state`; surfaces last-ingest counts + quarantine count + render state; copy-paste invocation command panel.

---

## Reference

- `DECISIONS.md` T-D55, T-D56 — single repo-owned generic template; file-mediated invocation contract.
- `CODE_SPEC.md` C-D21 — six implementation surfaces; this slice lands surfaces 4 and 5 (re-bootstrap is the same flow re-run, no new code).
- `SPEC.md` §7.28 — bootstrap prompt and Claude Code invocation.
- `ROADMAP.md` §21 — Scope / Dependencies / Done when / Sizing (medium).
- `docs/.throughline-schema.md` — transient-files section (`bootstrap-archive/<timestamp>-bootstrap-output.json`, `bootstrap-quarantine/<timestamp>-bootstrap-output.json` + sibling `.error.json`).
- `docs/_meta/throughline/AUTO_CONTINUE_WORKFLOW.md` — chain mechanics, halt classes, kill switch.
- Plan: `/root/.claude/plans/plan-mode-phase-21-build-immutable-riddle.md` (session-local, not in repo).
- Tracking issue: [#58](https://github.com/jaydomains/throughline/issues/58) — `Auto-continue: phase-21-build-immutable-riddle`.
- Chain state: `.claude-code/auto-continue-state.json`.
- Prior handover (Phase 21 slice 2): `docs/_meta/throughline/handovers/2026-05-28-phase-21-slice-2-bootstrap-output-watcher.md`.
- PR: [#61](https://github.com/jaydomains/throughline/pull/61) — Phase 21 / Slice 3.
