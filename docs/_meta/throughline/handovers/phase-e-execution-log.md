# Phase E — Execution Log

*Append-only durable record of the Phase E slice chain (`phase-e-full-audit-close`, 22-slice floor). One row per slice: branch · PR # · merge SHA · fix-rounds · halt-class fires · surfaces to the spec author. This is the record the post-execution audit reads.*

*Authoritative plans (on `main`):*
- *Base:* `docs/_meta/throughline/plans/2026-05-30-phase-e-full-audit-close.md` (E1–E16, E17a, E17, E18 — 19-slice floor)
- *Augmentation (OQ6):* `docs/_meta/throughline/plans/2026-05-31-phase-e-augmentation-feature-builds.md` (appends E19/E20/E21; revises E1 anchor-amendment mechanism → 22-slice floor)

*Chain rhythm: one PR per slice; full three-layer green gate (Gitar + CI + GitHub-mergeable) before merge; next slice branches off updated `main`. Squash merge (matches the E1/E2 precedent — `#88`/`#89` landed as single squashed commits).*

*Convention: each slice's PR commits its own row with branch + PR #. The `merge SHA` is backfilled by the **next** slice's first commit (after `git pull` of fresh `main`), since the squash SHA is not known until merge. The current in-flight slice carries `merge SHA: pending`.*

---

## Slices

### E1 — RAG embedder & query honesty + T-D60 mint (C-D2 narrowing)
- **Branch:** _(prior run — not recorded by that session)_
- **PR:** #88
- **Merge SHA:** `397d17b`
- **Closed:** SF3-01 (Crit), SF3-02 (High), S4-03 (Med)
- **Anchor:** minted **T-D60** (`DECISIONS.md` + `SPEC.md §14`; `CODE_SPEC.md:9` count 59→60); C-D2 narrowed via the T-D60 supersession-note mechanism (augmentation OQ6 §"Anchor amendment" — **not** a C-D2 body edit), with a one-line non-normative C-D2 status pointer. Verified live on `main` (`DECISIONS.md:1337`).
- **Fix-rounds:** _(prior run — not recorded)_
- **Halt-class fires:** none recorded.
- **Surfaces:** none recorded.
- **Note:** merged via a prior multi-session execution run. No per-slice handover was written and `PLATFORM_STATUS.md` was not rolled by that run; backfilled here from the merge commit (`git show 397d17b`).

### E2 — AI/capability degradation honesty
- **Branch:** _(prior run — not recorded)_
- **PR:** #89
- **Merge SHA:** `29a331f`
- **Closed:** SF3-03, SF2-04, SF4-02, SF4-03 (cites T-D60; no new anchor)
- **Fix-rounds:** _(prior run — not recorded)_
- **Halt-class fires:** none recorded.
- **Surfaces:** none recorded.
- **Note:** prior run; no per-slice handover written. Backfilled from `git show 29a331f`.

### E3 — Semble degradation honesty
- **Branch:** `claude/phase-e-e3-semble-honesty`
- **PR:** #90 (squash-merged)
- **Merge SHA:** `3ba20f3`
- **Closed:** SF4-01 (High) — a present-but-broken Semble binary reported `available:true` and `search()` swallowed the crash to `[]`, surfacing to the user as "no code matches found" (a crash masquerading as healthy-empty).
- **Fix:** introduced a tri-state `SembleStatus` (`available` / `unavailable` / `degraded`) disclosed **on the shared wire contract** (T-D60, on-contract per LBD-1b — no new anchor). `client.available()` → `probe()` returning the tri-state; `client.search()` → a discriminated `SembleSearchOutcome` (`{status:'ok',hits}` vs `{status:'degraded'}`); threaded through `searchForItem` / `codeQa` onto `CodeSearchResponse.status` / `CodeQaResult.status`; both frontend surfaces (ItemDetailPanel code-search, LibraryView code-Q&A) render the degraded state distinctly from absence.
- **Anchor:** none (cites T-D60, minted in E1).
- **Verification:** all cited file:line claims matched current `main` before implementation (`semble/client.ts:149` catch→`[]`; `available()` true on non-ENOENT at `:130`).
- **LOC:** ~233 insertions / 51 deletions across 7 files; production-code delta ~90–110 net (within the 70–110 band), remainder test code. One coherent unit — test-driven overage, non-halting per the E1/E3 estimate-breach precedent (halt-class 4).
- **Halt-class fires:** none.
- **Surfaces to spec author:** none. (Noted for the audit, not a halt: the prior run left `PLATFORM_STATUS.md` un-rolled to Phase E and wrote no E1/E2 handovers; this slice rolls `PLATFORM_STATUS.md` and establishes this execution log as the durable record.)
- **Fix-rounds:** 0 (Gitar approved first pass, no findings; CI green first run).

### E4 — Notifier capability honesty
- **Branch:** `claude/phase-e-e4-notifier-honesty`
- **PR:** #91 (squash-merged)
- **Merge SHA:** `b61e0e8`
- **Closed:** SF5-03 (Crit) — when `node-notifier` was absent, `createOsNotifier` fell back to a no-op whose `notify()` resolved as if delivered; the test endpoint returned `{ok:true}` + flipped `os_notifications_enabled=true`, and the reminder scheduler called `markFired` regardless. A non-delivery masqueraded as a delivery (the reminder was silently consumed and never surfaced).
- **Fix (T-D60, on-contract; no new anchor):** `notify()` now returns a disclosed `NotifyResult` (`outcome: 'delivered' | 'unavailable' | 'failed'`) and `Notifier` carries a `kind` (`'os' | 'unavailable'`). The old `createNoopNotifier` is split into `createRecordingNotifier` (test double that delivers) and `createUnavailableNotifier` (the honest capability-absent production fallback `createOsNotifier` now returns). The test endpoint returns a shared `NotificationTestResult` and sets the setting **only** on `delivered`; the scheduler calls `markFired` **only** on `delivered`, leaving the directive armed otherwise; the settings panel renders an honest "no backend" warning on `unavailable`.
- **Anchor:** none (cites T-D60).
- **Verification:** cited claims matched `main` — `notifier/index.ts` no-op resolves; `routes.ts` `{ok:true}` + setting flip; `scheduler.ts:83` unconditional `markFired`.
- **LOC:** ~287 insertions / 55 deletions across 11 files; production-side delta ~120–140 net (E4 band 100–150), remainder test code. One coherent unit ("notifier capability honesty") — non-halting per the E1/E3 estimate-breach precedent.
- **Tests:** notifier unit (recording delivers / unavailable never delivers / OS degrades to unavailable / OS failure disclosed-not-thrown) + route-honesty (delivered enables setting; unavailable & failed do not) + scheduler (unavailable notifier leaves the reminder armed, not fired — the SF5-03 lock) + frontend (unavailable surfaces the warning).
- **Fix-rounds:** 1 (Gitar "approved with suggestions" — one readability finding on the scheduler warn-log split-paren template, a false positive Gitar self-marked "no fix needed"; folded a clarity refactor `38a3586` anyway. Re-review: ✅ approved, resolved).
- **Halt-class fires:** none.
- **Surfaces to spec author:** none.

### E5 — Background-job health model
- **Branch:** `claude/phase-e-e5-background-job-health`
- **PR:** #92 (squash-merged)
- **Merge SHA:** `e9c5299`
- **Closed:** SF5-01, SF5-02, SF5-04 (High) — the backup scheduler, reminder scheduler, and GitHub poller each caught-and-logged with **no health/state field**, so a loop failing every tick was indistinguishable from a healthy idle loop.
- **Fix (mints C-D26):** a per-loop `JobHealth` tracker (`{ last_run_at, last_error, healthy }`) + a `JobHealthRegistry`; each loop records success/failure per tick; `GET /api/background-jobs/health` exposes the snapshot as the shared `BackgroundJobsHealthResponse`. The reminder loop's health reflects only a *thrown* tick failure — a graceful non-delivery (notifier `unavailable`/`failed`, E4) is the notifier's capability state, not a loop fault. The poller records in `pollProject` (the public poll op, so manual refreshes + the loop both update health, and it is directly testable).
- **Anchor:** **C-D26** minted in `CODE_SPEC.md` (backend health data model; distinct from the C-D25 frontend convention per LBD-3). No T-D count change (C-D, not T-D).
- **Sequencing decision (flagged for the audit — judgment call, not a halt):** the base plan's E5 lists "frontend surfaces / rendered per-feature in-context (LBD-2)", but the C-D25 visibility component mints in **E6** ("the first visibility slice" per LBD-2) which is *after* E5 — E5 cannot consume a component that doesn't exist yet. SF5-01/02/04 are purely backend ("no health/state field"), so **E5 closes them backend-side** (health observable via the route + test-locked) and the **in-context rendering is folded into E6** (which mints C-D25 and renders both bundle-health and this job-health). This keeps each anchor in its planned slice and avoids building an E5 frontend E6 would immediately refactor. LBD-2's "C-D25 reused by E5" is satisfied by E6 rendering E5's route.
- **Verification:** the three cited catch-and-log sites matched current `main` before implementation (`backup/scheduler.ts` nested try/catch, `directives/scheduler.ts` per-reminder catch, `github/poller.ts` tick `.catch`).
- **LOC:** ~403 insertions across 13 files; production-side ~155 (E5 band 150–210, within band), remainder test code + the C-D26 anchor body. One coherent unit.
- **Tests:** `job-health.test.ts` (tracker optimistic→success→failure→recover; registry order/idempotency; route snapshot) + per-loop locks: backup throwing tick → healthy:false (`backup.test.ts`), reminder thrown-fire → healthy:false but graceful non-delivery stays healthy (`directives-scheduler.test.ts`), poller failed poll → healthy:false + recovers (`github.test.ts`).
- **Fix-rounds:** 1 (Gitar "approved with suggestions" — `backup/scheduler` comment said "first sub-op failure" but `tickError` was overwritten; folded `tickError ??= err` at all three sites in `1c7c924` to keep the root error. Re-review: ✅ approved, resolved).
- **Halt-class fires:** none (C-D26 is the planned E5 anchor — no halt-class 5).
- **Surfaces to spec author:** the E5/E6 C-D25 sequencing decision above (recorded, not a halt).

### E6 — Bundle-health visibility (mints C-D25; also renders E5 job-health)
- **Branch:** `claude/phase-e-e6-bundle-health-visibility`
- **PR:** #93 (squash-merged)
- **Merge SHA:** `5beadc4`
- **Closed:** SF2-02 (High), SF2-06 (Med) — `runGates` emitted no firings when `loaded.status !== 'loaded'`, so a bound-but-broken bundle was indistinguishable from a legitimate freeform project; and `GET /api/methodologies` listed only the install cache, so external/per-repo bundle errors were invisible.
- **Fix (mints C-D25):** `GET /api/projects/:id/methodology-health` resolves the project's **actual** bundle through the C-D14/C-D19 precedence (external → per-repo → install) → tri-state `MethodologyHealthResult` (`degraded` for a bound-but-broken bundle + errors, `absent` for freeform, `healthy` for a methodology bundle). Because it resolves the project's real bundle, an external/per-repo bundle error is surfaced here per-project (closing SF2-06 — see interpretation note). The shared **`HealthStatus`** component (C-D25, tri-state healthy/degraded/absent, rendered **in-context** per LBD-2) renders bundle-health beside the project binding **and** the E5 background-job health (the E5-deferred visibility) in a "Background jobs" section.
- **Anchor:** **C-D25** minted in `CODE_SPEC.md` (frontend visibility component; distinct from C-D26 backend model per LBD-3). Inserted before C-D26 for numeric order. No T-D count change.
- **SF2-06 interpretation (flagged for the audit):** the base plan says "widen `/api/methodologies` to include external/per-repo bundle errors." I closed it instead via the per-project `methodology-health` endpoint, which resolves the project's actual (possibly external/repo) bundle and surfaces its error — the user-facing outcome SF2-06 asks for (external/per-repo errors are no longer invisible), at the per-project surface where external bundles inherently live. The global `/api/methodologies` list stays install-shipped by design. Judgment call, not a halt.
- **Verification:** `runtime.ts:166` (`if (loaded.status !== 'loaded') return []`) and the install-cache-only `registry.list()` (`loader.ts:436`) matched current `main`. Discovered during impl: `resolveBundle` *throws* `BundleNotLoadedError` for a never-existed bundle (create-time validation blocks binding to one) and returns `{status:'error'}` only for a bundle that exists but fails to parse — so the degraded test breaks a *bound* bundle via `reload`, the real SF2-02 scenario.
- **LOC:** ~352 insertions across 11 files; production-side ~207 (E6 band 150–210, at the ceiling — including the E5 job-health rendering did not breach), remainder test code + the C-D25 anchor body. One coherent unit ("system-state visibility").
- **Tests:** `methodology-health.test.ts` (healthy / absent / degraded-via-reload / 404) + frontend (`HealthStatus` renders a degraded job distinctly via `data-state`, healthy job too).
- **Fix-rounds:** 0 (Gitar approved first pass, no findings; CI green first run).
- **Halt-class fires:** none (C-D25 is the planned E6 anchor).
- **Surfaces to spec author:** the SF2-06 interpretation above (recorded, not a halt).

### E7 — Bootstrap worker/watcher robustness (imports C-D25)
- **Branch:** `claude/phase-e-e7-bootstrap-robustness`
- **PR:** #94 (squash-merged)
- **Merge SHA:** `bea03ca`
- **Closed:** SF1-01 residual = SF1-03 = S1-03 (copy-failure quarantine uncounted), S1-01 (1-second timestamp collision), S1-02/SF1-02 (watcher scan-vs-arm TOCTOU), SF5-05/06 (watcher enqueue throw drops the file).
- **Fix (cites/uses C-D25; no new anchor):**
  - **SF1-03:** `countOutputs`→`countBySuffix`; quarantine now counts the **`.error.json` marker** (written on *every* quarantine, before the payload copy that may fail) instead of the payload copy — so a copy-failure (only the marker on disk) is counted, not invisible. The SettingsView quarantine surface now renders via the shared **`HealthStatus`** component (C-D25, `degraded`), preserving the existing testid/text.
  - **S1-01:** `timestampPrefix` keeps ISO + appends a `nanoid(6)` suffix → two ingests in the same tick get distinct archive/quarantine filenames (no clobber).
  - **S1-02/SF1-02:** `register` arms the chokidar watcher **before** the startup scan (was scan→arm) — a write landing between scan and arm is now caught by chokidar (`ignoreInitial:true` means a pre-arm file never emits, so the post-arm scan catches it; `enqueue` is idempotent, so the overlap is safe).
  - **SF5-05/06:** the chokidar `onWrite` handler guards `worker.enqueue` in try/catch + log, so a throw inside chokidar's emit no longer silently drops the detected write.
- **Anchor:** none. Imports C-D25 (the first slice to consume the E6 component). **Deps:** E6 merged (C-D25). **Note:** SF1-01 *bulk* closure recorded in E18.
- **Verification:** all cited file:line sites matched current `main` (`worker.ts` `timestampPrefix` strips to ~1s; `quarantine()` copy-failure leaves only `.error.json`; `countOutputs` `endsWith('-bootstrap-output.json')`; `watcher.ts` scan-then-arm). Verified no code parses the filename timestamp format (only `endsWith` for counts), so changing it is safe.
- **LOC:** ~120 insertions across 5 files; production-side ~74 (surgical — *under* the 130–190 band; under-estimate is not a halt, all 5 findings closed coherently), remainder test code.
- **Tests:** worker (copy-failure `.error.json` counted; S1-01 distinct filenames same clock tick via fake timers) + watcher (throwing `enqueue` doesn't crash `register`; existing present-file-enqueue test confirms the arm-before-scan reorder preserves the scan) + frontend (existing quarantine-alert tests pass against the `HealthStatus` rendering).
- **Fix-rounds:** 0 (Gitar approved first pass, no findings; CI green first run).
- **Halt-class fires:** none.
- **Surfaces to spec author:** none.

### E8 — Shutdown lifecycle completion
- **Branch:** `claude/phase-e-e8-shutdown-lifecycle`
- **PR:** #95 (draft → ready on green)
- **Merge SHA:** pending
- **Closed:** S7-02 (High — SSE `reply.hijack()` sockets + un-`unref`'d ping; `app.close()` never ended them), SF5-11 (unguarded SSE ping write + no global `unhandledRejection`/`uncaughtException` handler), S7-03 residual (`backup`/`directives` scheduler `stop()` cleared the timer without awaiting an in-flight tick). Poller was already drained — not re-touched.
- **Fix (no anchor):**
  - **S7-02:** SSE ping `setInterval` is `unref`'d; the `SSEHub` gains `closeAll()` (each connection registers its `cleanup` as a teardown) and the server shutdown calls `sseHub.closeAll()` before `app.close()` to end the hijacked sockets.
  - **SF5-11:** the SSE `send` raw writes are wrapped in try/catch → a broken pipe tears down that connection instead of escaping the ping interval; global `unhandledRejection`/`uncaughtException` log handlers added in `index.ts` (the real process entry — *not* `startServer`, which the test suite builds repeatedly).
  - **S7-03:** both schedulers track the interval-driven tick promise and expose `drain()`; the server shutdown awaits `reminderScheduler.drain()` + `backupScheduler.drain()` (mirroring the existing poller drain) before closing the DB.
- **Anchor:** none. **Deps:** rebase coupling with E5 on both schedulers (E5 merged; clean on updated `main`).
- **Verification:** `events.ts:65` ping not `unref`'d + unguarded `send`; both schedulers' `stop()` clear-timer-only; poller already drained (`server.ts` `await githubPoller.drain()`). All matched current `main`.
- **LOC:** ~240 insertions across 8 files; production-side ~135 (E8 band 120–170, within band), remainder test code. One coherent unit ("shutdown lifecycle").
- **Tests:** events (`closeAll` ends every connection + empties the registry; tolerates a no-close-fn connection) + backup & directives (`drain()` does not resolve until a gated in-flight tick completes — fake timers, deterministic). The global handler + SSE-route `unref`/guard are integration/process-level (covered by inspection + the existing `server.test.ts` startup/shutdown path).
- **Fix-rounds:** TBD.
- **Halt-class fires:** none.
- **Surfaces to spec author:** none.
