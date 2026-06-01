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
- **PR:** #95 (squash-merged)
- **Merge SHA:** `327949b`
- **Closed:** S7-02 (High — SSE `reply.hijack()` sockets + un-`unref`'d ping; `app.close()` never ended them), SF5-11 (unguarded SSE ping write + no global `unhandledRejection`/`uncaughtException` handler), S7-03 residual (`backup`/`directives` scheduler `stop()` cleared the timer without awaiting an in-flight tick). Poller was already drained — not re-touched.
- **Fix (no anchor):**
  - **S7-02:** SSE ping `setInterval` is `unref`'d; the `SSEHub` gains `closeAll()` (each connection registers its `cleanup` as a teardown) and the server shutdown calls `sseHub.closeAll()` before `app.close()` to end the hijacked sockets.
  - **SF5-11:** the SSE `send` raw writes are wrapped in try/catch → a broken pipe tears down that connection instead of escaping the ping interval; global `unhandledRejection`/`uncaughtException` log handlers added in `index.ts` (the real process entry — *not* `startServer`, which the test suite builds repeatedly).
  - **S7-03:** both schedulers track the interval-driven tick promise and expose `drain()`; the server shutdown awaits `reminderScheduler.drain()` + `backupScheduler.drain()` (mirroring the existing poller drain) before closing the DB.
- **Anchor:** none. **Deps:** rebase coupling with E5 on both schedulers (E5 merged; clean on updated `main`).
- **Verification:** `events.ts:65` ping not `unref`'d + unguarded `send`; both schedulers' `stop()` clear-timer-only; poller already drained (`server.ts` `await githubPoller.drain()`). All matched current `main`.
- **LOC:** ~240 insertions across 8 files; production-side ~135 (E8 band 120–170, within band), remainder test code. One coherent unit ("shutdown lifecycle").
- **Tests:** events (`closeAll` ends every connection + empties the registry; tolerates a no-close-fn connection) + backup & directives (`drain()` does not resolve until a gated in-flight tick completes — fake timers, deterministic). The global handler + SSE-route `unref`/guard are integration/process-level (covered by inspection + the existing `server.test.ts` startup/shutdown path).
- **Fix-rounds:** 2 (two *distinct* findings — not circuit-breaker, which is 3 rounds on the *same* finding).
  - **Round 1 — Gitar "approved with suggestions":** a real minor edge — if the first `send('welcome')` write fails, `cleanup` ran but the dead connection was still `hub._add`'d, lingering in the client set until `closeAll`. Folded an `if (cleaned) return;` guard before registration. The SSE-route socket path is integration-tested per the established convention; the guard is inspection-verified.
  - **Round 2 — CI `gate` flake, root-caused (per the "flake is a finding" discipline):** the `gate` failed intermittently (commits `cec923a` then `ec2ac2e`). Root cause: this slice's new `drain()` tests used `vi.useFakeTimers()`, which **also fakes `setImmediate`** — the primitive better-sqlite3's async `db.backup()` relies on. Under the full parallel suite that fake-timer state interacted with the *unrelated* backup-snapshot test's `db.backup`, so `existsSync(snap.path)` came back false. **Confirmed E8-introduced:** full backend suite — `main` 0/12, this branch ~33% (backup-snapshot). **Fix:** rewrote both drain tests **without fake timers** (real 5ms interval + an explicit "entered" signal — deterministic), and added an `if (running) return` guard to both schedulers' interval callbacks so a fast cycle can't overwrite `inFlight` with a re-entrant no-op tick (a latent bug the fake-timer test had masked; benign at the 30s/1h production cadence). **Stress-verified:** 0 backup-snapshot failures across 12 full-suite runs post-fix.
- **Out-of-scope flake flagged (halt-class 8 — flag, do NOT absorb into E8):** `rag.test.ts` (real Transformers.js embedder) flaked **1/12** under the full post-fix suite but **0/8 in isolation** and **0/12 on `main`** — a pre-existing load-sensitivity of the heavy embedder under parallel contention, *not* an E8 logic regression (E1–E7's gate ran 14/14 clean). **Carried to the Phase-F seed register** for stabilisation (e.g. a generous embedder-test timeout) outside this slice. Not expanded into E8 per the discipline.
- **Halt-class fires:** none. (Round 2 was one finding root-caused and fixed once — not 3 rounds on the same finding; the rag flake is out-of-scope, flagged not fixed.)
- **Surfaces to spec author:** none (the rag flake is flagged for the Phase-F register, not a halt).

### E9 — Loader robustness
- **Branch:** `claude/phase-e-e9-loader-robustness`
- **PR:** #96 (squash-merged)
- **Merge SHA:** `437f576`
- **Closed:** S3-01/SF2-05 (the methodology watcher's install-unlink and external-unlink branches deleted the cache entry but did **not** `notifyReloaded`, so projects bound to a deleted install/external bundle were never told to reload — only the per-repo arm-2 branch notified), S3-03 (`discoverBundleIds` `statSync` threw on a dangling symlink and aborted the whole startup hydration), SF5-08 (the `watcher.on('all')` handler was the one unguarded watch site — a throw inside chokidar's emit silently dropped the event).
- **Fix (no anchor):** add `notifyReloaded` to the install-unlink (`projectsBoundToBundle`) and external-unlink (`projectsBoundToPath(dirname)`) branches; guard `discoverBundleIds`'s per-entry `statSync` in try/catch (skip a dangling entry, don't abort the scan); wrap the whole `on('all')` handler body in try/catch + `logger.error`.
- **Anchor:** none. **Deps:** none. **Files:** `methodology/loader.ts` only.
- **Verification:** `loader.ts` watcher install-unlink (`cache.delete(id); return`) and external-unlink lacked notify while repo-unlink had it; `discoverBundleIds` `statSync` unguarded; `on('all')` unguarded — all matched current `main`.
- **LOC:** ~86 insertions across 2 files; production-side ~75 (much is re-indent from wrapping the handler in try/catch; net new logic ~40 — within the 80–130 band).
- **Tests:** `loader.test.ts` — **S3-03 deterministic lock** (a dangling symlink is skipped, freeform still loads, hydration doesn't abort). S3-01/SF2-05 (watcher unlink-notify) and SF5-08 (handler guard) are **chokidar-internal** — inspection-verified per the established "chokidar event-delivery is unreliable to assert in CI" convention (`loader.test.ts:82`, `bootstrap-watcher.test.ts:219`), consistent with how E7's `onWrite` guard and E8's SSE socket teardown were handled.
- **Out-of-scope flake observed (halt-class 8 — flag, not fix):** during E9's gate, `directives.test.tsx` (frontend) flaked once but passed 4/4 on retry — a *second* pre-existing flake (after E8's `rag.test.ts`), unrelated to E9 (backend-only). Both carried to the Phase-F register: the repo has latent test flakiness (real-embedder `rag.test.ts` under parallel load; the frontend `directives` group test) that a Phase-F stabilisation pass should address (timeouts / determinism). Not absorbed into E9.
- **Fix-rounds:** 0 (Gitar approved first pass; both gate runs green first try).
- **Halt-class fires:** none.
- **Surfaces to spec author:** none.

### E10 — Background-loop correctness (+ §7.10 SPEC clause)
- **Branch:** `claude/phase-e-e10-background-loop-correctness`
- **PR:** #97 (squash-merged)
- **Merge SHA:** `2338c64`
- **Closed:** S4-02 (the GitHub poller persisted the new list ETag *before* the snapshot-upsert loop, so a mid-loop throw left the ETag advanced while snapshots were never written → every later poll got a 304 and reused permanently-stale snapshots), S5-05 (`markFired` advanced a recurring reminder one interval from the old `next_fire_at`, which after downtime still landed in the past → the reminder refired every tick to catch up — a catch-up storm).
- **Fix (no anchor; sanctioned SPEC amendment):** move `cache.setListEtag` to *after* the snapshot loop (a mid-loop throw now retains the old ETag → next poll re-fetches and self-heals); coalesce missed recurrence occurrences in `markFired` (advance past `now` so a gap collapses to a **single** catch-up fire and the cadence re-anchors to the future). Added the one-line **§7.10 missed-occurrence-coalesce clause** to `SPEC.md` (the spec-author-ruled-in clause — the code and spec land together; mints no anchor, per the base plan's E10 note).
- **Anchor:** none. **Deps:** rebase-coupled with E5 (poller) + E4 (`directives/service.ts`) — both merged; clean on updated `main`.
- **Verification:** `poller.ts` `setListEtag` at line 167 (before the loop); `directives/service.ts` `advanceRecurrence(base, …)` single-interval advance — both matched current `main`.
- **LOC:** ~96 insertions / 3 deletions across 5 files; production-side ~25 (+ the §7.10 SPEC line), rest test code — within the 90–140 band.
- **Tests:** `directives.test.ts` — **S5-05 deterministic lock** (a daily reminder 12 days past coalesces to a *single* fire with `next_fire_at` the first occurrence strictly after `now`, not 11 days in the past). `github.test.ts` — **S4-02 deterministic lock** (a cache whose `upsertSnapshot` throws mid-loop leaves the list ETag at its prior value, not advanced — so the next poll re-fetches). The existing "advances one interval" recurring test still passes (the in-future case doesn't coalesce).
- **Fix-rounds:** 0 (Gitar approved first pass; both gate runs green first try).
- **Halt-class fires:** none.
- **Surfaces to spec author:** none.

### E11 — Transaction atomicity
- **Branch:** `claude/phase-e-e11-transaction-atomicity`
- **PR:** #98 (squash-merged)
- **Merge SHA:** `9482629`
- **Closed:** S5-04 (`items.update` wrote the scalar UPDATE + methodology-context + mentions + audit rows **unwrapped**, unlike `create` — a throw partway left a half-written item), S6-03 (md-ingest batch loop: a file's library entry + audit + cost were separate writes), S6-04 (`writeSecrets` did a read-modify-`writeFileSync` — a crash mid-write could truncate/corrupt the secrets file and lose both keys).
- **Fix (no anchor):** wrap `items.update`'s write block in a `db.transaction` (mirrors `create`; the status hook + final read stay outside); commit each md-ingest file's entry + audit + cost in a **per-file** `db.transaction` (the AI `summarise` is awaited *before* the txn — whole-batch atomicity is infeasible/undesirable across N per-file AI calls and a sqlite txn can't span an `await`); write secrets atomically via write-temp + `renameSync` (atomic within a filesystem), with temp cleanup on failure.
- **Anchor:** none. **Deps:** rebase-coupled with E12 on `items/service.ts` (E12 not yet landed — E11 lands first). **Files:** `items/service.ts`, `md-ingest/service.ts`, `secrets/store.ts`.
- **Verification:** `items.update` write block unwrapped (vs `create`'s `db.transaction`); md-ingest per-file `library.create/update` + `appendAudit` + `recordCost` separate; `writeSecrets` RMW + bare `writeFileSync` — all matched current `main`.
- **LOC:** diff stat ~218/136 across 5 files, **but inflated by re-indentation** — wrapping a block in `db.transaction(() => {…})` re-indents every line. Net new logic is small (the two txn wrappers + the atomic-write); test code ~48. One coherent unit; the overage is re-indent, not scope — non-halting.
- **Tests:** `items.test.ts` — **S5-04 deterministic rollback lock** (fault-inject a throw on the in-transaction audit insert → the scalar UPDATE rolls back, item unchanged). `backup.test.ts` — **S6-04** (atomic write leaves no stray `.tmp`, preserves the untouched key, JSON stays well-formed). **S6-03** (md-ingest per-file txn) is inspection-verified — rollback-on-crash isn't deterministically unit-testable without the same fault-injection seam, and the existing md-ingest tests (10/10) confirm the per-file commit behaviour is preserved.
- **Fix-rounds:** 0 (Gitar approved first pass; both gate runs green first try).
- **Halt-class fires:** none.
- **Surfaces to spec author:** none.

### E12 — Error→HTTP-status mapping
- **Branch:** `claude/phase-e-e12-error-status-mapping`
- **PR:** #99 (squash-merged)
- **Merge SHA:** `0303c39`
- **Closed:** S5-03 (a stale `session_id` in `items.create`'s `session_ids` loop / `addSessionMembership` hit an `INSERT OR IGNORE` that does **not** suppress FK violations → raw `SQLITE_CONSTRAINT_FOREIGNKEY` surfaced as a 500), S6-01 (`reconcile.apply` iterated `req.diff.rows` — a client-round-tripped payload — with no shape guard → `TypeError` → 500). **Records S6-02 closed** (the reconcile route no longer hand-maps; `ItemPolicyError` etc. propagate to the Phase-B central handler) → its regression test is E18's.
- **Fix (no anchor):** an `insertSessionMembership` helper in the items service catches `SQLITE_CONSTRAINT_FOREIGNKEY` and rethrows `SessionNotFoundError` (used at both insert sites; the central handler serialises it); a `ReconcileDiffShapeError` (400, code `invalid_diff`) guards `apply` when `req.diff?.rows` is not an array.
- **S5-03 status judgment (flagged):** the plan framed the fix as "→ 400 not 500". I mapped the stale session reference to **`SessionNotFoundError` (404)** — the codebase's consistent classification for a missing referenced entity (`ProjectNotFoundError`/`ItemNotFoundError`/`SessionNotFoundError` all 404), and it's a `DomainError` the central handler serialises. The substantive requirement (a proper 4xx, not a 500) is met; 404 is the more honest status than a generic 400 here. Judgment call, not a halt. (S6-01 is a genuine bad-payload → 400.)
- **Anchor:** none (reused the shared `SessionNotFoundError`; minted no T-D/C-D — a new `DomainError` *subclass*, `ReconcileDiffShapeError`, is not an anchor). **Deps:** Phase-B `mapDomainError` (on `main`); rebase-coupled with E11 on `items/service.ts` (E11 merged).
- **Verification:** `items/service.ts` `INSERT OR IGNORE` into `item_session_memberships` at the create loop + `addSessionMembership`; `reconcile/service.ts` `apply` iterates `req.diff.rows` unguarded; FK enforcement is on (`db.pragma('foreign_keys = ON')`) so the violation genuinely throws — all matched current `main`.
- **LOC:** ~86 insertions across 4 files; production-side ~42 — within the 70–110 band.
- **Tests:** `items.test.ts` — **S5-03** (create with a stale session_id throws `SessionNotFoundError` and the item is rolled back; `addSessionMembership` likewise). `reconcile.test.ts` — **S6-01** (apply with a non-array `diff.rows` throws `ReconcileDiffShapeError`, not a TypeError).
- **Fix-rounds:** 0 (Gitar approved first pass; both gate runs green first try).
- **Halt-class fires:** none.
- **Surfaces to spec author:** the S5-03 404-vs-400 status choice above (recorded, not a halt).

### E13 — Methodology-parsing robustness
- **Branch:** `claude/phase-e-e13-methodology-parsing`
- **PR:** #100 (squash-merged)
- **Merge SHA:** `4f16792`
- **Closed:** S2-02 (the gate-side `anchor-resolution` check raw-`new RegExp`'d the bundle-authored `format_regex` and interpolated un-escaped vocabulary — the unhardened twin of the now-fixed drift-side S2-01), S3-02 (`state-machine.ts` item-type parse used `slice.slice(slice.indexOf('\n') + 1)` — at EOF `indexOf` is -1, so `slice(0)` fed the heading back in), SF2-03 (a drift category's malformed `trigger:`/`check:` line was silently coerced to the default — for `check` that means the category runs the **wrong scanner** — and the bundle loaded green).
- **Fix (no anchor):**
  - **S2-02:** reuse the Phase-D `safe-regex` guard — `safeCompile(format_regex)` (refuses catastrophic patterns → null = no format check), `safeTest` for the match, and `escapeRegExp` on the interpolated vocab term. Mirrors `scanners.ts` (the tested S2-01 fix) exactly.
  - **S3-02:** guard the EOF case (`indexOf('\n') === -1` → empty body).
  - **SF2-03:** a non-fatal **warnings channel** — `parseDriftCategories` flags a `trigger:`/`check:` line that is *present but unrecognised*; `parseValidationRules` returns warnings; `parseBundle` attaches them to `LoadedBundle.warnings` (new optional shared field); the registry `logger.warn`s them at load. The bundle still loads (default applies) but the typo is **visible**.
- **Anchor:** none (added `LoadedBundle.warnings?` — a field, not an anchor). **Deps:** Phase-D `safe-regex` (on `main`).
- **Verification:** `checks.ts:154/179` raw `new RegExp` + un-escaped vocab; `state-machine.ts:37` EOF `indexOf`; `validation-rules.ts` `parseDriftCategories` silent default — all matched current `main`.
- **Verification finding (recorded):** **S3-02 was a *masked* off-by-one** — `parseKeyValueLines` skips `#`-prefixed lines, so the EOF `slice(0)` (which includes the `### Item type:` heading) produced no wrong output today. The fix is a **defensive correctness** improvement (correct independent of the downstream `#`-skip); behaviourally indistinguishable, so its test locks the EOF-heading *behaviour* (sensible defaults) rather than a pre/post diff.
- **Test scope:** S2-02 is **inspection-verified** — its guard (`safeCompile`/`safeTest`/`escapeRegExp`) is already tested in `safe-regex.test.ts` (8 tests, refuses catastrophic patterns) and the gate-side application is the identical pattern to the tested S2-01 drift-side fix; a gate-runtime ReDoS-timing test would be heavy/flaky and redundant.
- **Note:** **SF2-08** (refused-regex silent skip — the *visibility sibling*) is **NOT** pulled into E13; it stays an E17 wrong-belief-Low decision item per the base plan (only pulled in if the spec author rules the wrong-belief Lows ride the chain).
- **LOC:** ~107 insertions across 7 files; production-side ~57 — *under* the 130–190 band (surgical: S2-02 reused the tested guard, S3-02 was a one-line defensive guard). Under-estimate is not a halt; all three findings closed.
- **Tests:** `bundle-parser.test.ts` — **SF2-03** (unrecognised `check` kind → warning + default; well-formed → no warning, declared kinds kept) and **S3-02** (EOF item-type heading → sensible defaults, not a mis-parsed heading). S2-02 inspection-verified (above).
- **Fix-rounds:** 0 (Gitar approved first pass; both gate runs green first try).
- **Halt-class fires:** none.
- **Surfaces to spec author:** none.

### E14 — Audit-trail wiring
- **Branch:** `claude/phase-e-e14-audit-trail-wiring`
- **PR:** #101 (squash-merged)
- **Merge SHA:** `9647dbc`
- **Closed:** SF7-01 (credential set/clear/rotate via `PUT /api/secrets` left **no** audit row), SF7-02 (`projects.update({ settings })` — the path the communication-model route uses — wrote `settings_json` but the field-loop omitted it), SF7-03 (`projects.updateSettings` generic writer unaudited), SF7-05 (session `update` wrote `settings_json` unaudited). Completes the 3-of-3 `settings_json` audit discipline.
- **Fix (no anchor):** secrets routes take `db` and emit an **event-only** audit row per touched key (`field: credential:<key>`, `new_value: set|cleared`, **never the value** — T-D24 / T-D4); `settings_json` added to the projects `update` field-loop and the session `update` field-loop; `updateSettings` audits the change when it actually changes.
- **Anchor:** none. **Deps:** rebase-coupled with E16 on `projects/service.ts` (E16 not yet landed — E14 first). **Files:** `secrets/routes.ts` (+ `server.ts` call site passes `db`), `projects/service.ts`, `sessions/service.ts`.
- **Verification:** `secrets/routes.ts` PUT had no audit (and no `db`); `projects/service.ts` field-loop omitted `settings_json`; `updateSettings` wrote silently; session `update` field-loop omitted `settings_json` — all matched current `main`. `AuditEntityType` already includes `'settings'` (used for the secrets row).
- **Note:** **SF7-04** (chat-no-AI unaudited) and **SF7-06** (verifier `last_status` unaudited) are **NOT** here — audit-trail-only with no operational misbelief → deferred-tail register (per the base plan).
- **LOC:** ~123 insertions across 7 files; production-side ~48 — within the 110–160 band.
- **Tests:** `backup.test.ts` — **SF7-01** (set then clear → two event-only rows `credential:anthropic_api_key=set|cleared`; the secret value appears **nowhere** in the audit trail). `projects.test.ts` — **SF7-02/03** (`update({settings})` and `updateSettings` each add one `settings_json` row; a no-op `updateSettings` adds none). `sessions.test.ts` — **SF7-05** (session settings change → one row).
- **Fix-rounds:** 0 (gate green; squash-merged as #101 at `9647dbc`).
- **Halt-class fires:** none.
- **Surfaces to spec author:** none.

### E15 — Frontend races & error surfacing
- **Branch:** `claude/phase-e-e15-frontend-races`
- **PR:** #102 (squash-merged)
- **Merge SHA:** `56236f7`
- **Closed:** S8-01 (`ItemDetailPanel.refresh` ran 6 sequential `await`s each `setState`ing, with no stale guard — a sibling-cycle / linked-item click that swapped `itemId` mid-flight let a slow earlier fetch overwrite the new item's data), S8-02 (`LibraryView` debounced search **cleared the pending timer** but not an already-in-flight request — a stale result resolving late overwrote the current query's), S8-03 (the copy toast's `setTimeout(setCopyToast(null))` was never cleared → setState-after-unmount + leaked overlapping timers on rapid copies), S8-04 (**Board** inline-create had `try/finally(setBusy)` with **no `catch`** → a failed `createItem` cleared the spinner, kept the draft, and told the user nothing), SF6-09 (`PrBadges` `.catch(()=>setPrs([]))` rendered a fetch failure as the healthy "none tracked"; the backend `GET /github/prs` served the poller's cache success-shaped, so an empty list on a *failing* poller was indistinguishable from a genuine absence).
- **Records S8-04-DriftInbox already closed:** the `DriftInbox` half of S8-04 was **closed in Phase C** — `DriftInbox.tsx`'s `act` helper already has the SF6 `catch` → `setActionError` → `<LoadError>` render. Only the **Board** half was open. Recorded here, not re-fixed (consistent with E12's S6-02 closed-record).
- **Fix (no anchor):**
  - **S8-01:** a `useRef` generation counter, bumped at the start of every `refresh`; each of the 12 `setState`s is gated on `current()` (gen still latest) so a superseded run drops its results.
  - **S8-02:** a `searchSeq` ref bumped on every search-effect run (keystroke / filter / scope change); the `.then`/`.catch` setState is gated on the seq still being current → stale in-flight results dropped.
  - **S8-03:** hold the toast timer in a ref; a `showToast` helper clears any prior timer before scheduling, and an unmount effect clears the last.
  - **S8-04:** `Board` inline-create gains a `catch` → `createError` state rendered inline (`column-create-error-<board>-<status>`).
  - **SF6-09:** the github-poller's `JobHealth` (C-D26 / E5) is threaded into `registerGitHubRoutes` and surfaced on the wire — `ProjectPrsResult` gains `poll_healthy` + `poll_error` (T-D60: a degraded capability is disclosed on the shared contract, not rendered as healthy-empty). `PrBadges` consumes them to distinguish three states: **fetch-fail** (`pr-badges-error`), **poller-failing/stale** (`pr-badges-stale` with the poller's `last_error` as the title), and a genuine healthy **"none tracked"**. An unconfigured project still renders nothing.
- **Anchor:** none. Reuses **T-D60** (SF6-09 wire-disclosure) and **C-D26** (the github-poller JobHealth, threaded — not re-minted). `ProjectPrsResult.poll_healthy/poll_error` are fields, not anchors.
- **Deps:** soft pattern dep on E5 (C-D26 poller health) — satisfied (E5 merged). `github/routes.ts` rebase-coupling with E14/E16 noted in the plan; E14 merged first, no overlap (E14 touched `secrets/routes.ts`/`projects`/`sessions`, not `github/routes.ts`).
- **Verification:** `ItemDetailPanel.tsx:67-104` (6 awaits, no abort flag); `LibraryView.tsx:88-118` (timer cleared, request not guarded) + the two toast `setTimeout`s (167/170); `Board.tsx:90-105` (try/finally, no catch); `DriftInbox.tsx:22-35` (**already** has the catch — closed); `PrBadges.tsx:21-27` (`.catch(()=>setPrs([]))` → "none tracked" at 40-41); `github/routes.ts:40-73` (success-shaped `{configured,prs}`) — all matched current `main`.
- **SF6-09 visual judgment (recorded):** the degraded indicator in `PrBadges` is a **compact inline** element, not the C-D25 `<HealthStatus>` `<p>` block — PrBadges is a horizontal badge strip, and C-D25's intent (a degraded capability reads distinctly from an absence) is honoured by consuming the wire `poll_healthy`/`poll_error` and the three distinct states. Judgment call (in-context tri-state surfacing without forcing the block layout), not a deviation from LBD-2.
- **LOC:** diff stat ~140 insertions / 29 deletions across 8 src/fixture files + 2 new test files (~300 incl. tests); production-side ~110 — within the 170–240 band (the band counts tests). All 5 findings closed; SF6-09 **not** peeled (the backend signal was a clean ~21-line thread of the existing E5 JobHealth, no breach).
- **Tests:** `frontendRaces.test.tsx` (new, 8 tests) — **SF6-09** PrBadges (healthy-empty ⇒ "none tracked"; fetch-fail ⇒ distinct error, not "none"; failing poller ⇒ stale warning carrying `last_error`; unconfigured ⇒ renders nothing); **S8-04** Board (rejected `createItem` ⇒ inline error); **S8-01** ItemDetailPanel (deferred getItem per item; cycle A→B; B resolves then A resolves late ⇒ panel shows Item B, A's stale result dropped); **S8-02** LibraryView (deferred searchLibrary; type "old" then "new"; new resolves then old resolves late ⇒ RESULT NEW shown, RESULT OLD dropped); **S8-03** toast (copy ⇒ toast shown; unmount clean, no console error). `github-prs-health.test.ts` (new, 4 tests, backend) — **SF6-09 wire**: healthy poller ⇒ `poll_healthy:true`; failing poller ⇒ `poll_healthy:false` + `poll_error` contains the message, recovers on a clean tick; unconfigured ⇒ `configured:false`, healthy poll (doesn't borrow another project's failure); unknown project ⇒ 404.
- **Fix-rounds:** 1 (Gitar "approved with suggestions" → 2 edge-case findings: PrBadges stale-request guard on projectId-change + clarify pollHealthFields is intentionally per-loop; both addressed in one push `3cc85c3`, re-review ✅ "2 resolved / 2 findings", both gate runs green).
- **Halt-class fires:** none.
- **Surfaces to spec author:** none (the SF6-09 visual-treatment and S8-04-DriftInbox-closed notes are recorded, not halts).

### E16 — Audit-3 spec-contradiction bugs
- **Branch:** `claude/phase-e-e16-spec-contradictions`
- **PR:** #103 (squash-merged)
- **Merge SHA:** `95b3673`
- **Closed (3 of 4):** **F6-01** (SPEC §7.14 — code-drift tiers 1-3 badged *any* matching item, omitting the done-item filter tier-4 already enforced → non-done items got tier-1/2/3 badges), **SF3-04** (refuse-rather-than-fallback / SF2-01 precedent — a failed per-PR annotation sub-fetch was swallowed to `[]`, which tier-1 read as "every rule passed" and silently *cleared* real open signals), **F1-03** (T-D51 / C-D19 — project *create* never validated `.throughline/project.json`; a `bundle_id_mismatch` was caught only on update(reinit) + the CLI).
- **F4-04 NOT closed — re-classified to E17 (spec-author ruling 2026-06-01).** The E16 plan tagged F4-04 a "clean bug" (enforce per-type transitions), but audit-3's own §load-bearing list flags **C-D12 transitions** as a wording ambiguity ("one-line says enforce, body says status-only" → "spec edits, not code fixes"). The code already enforces status **membership** (the body's reading) at create + update (`items/service.ts:528-533/605-609`); only transition **adjacency** is unenforced, and reconcile/auto-reconcile/dump-zone all set `open→done` directly (`reconcile/engine.ts:190`), so enforcing it would force a C-D12 amendment + 3-caller cascade into a bug-fix slice. The spec author ruled **defer to E17** as a C-D12-wording decision item (next to F3-01). Plan updated (audit table row + E16 §note + E17 spec-silent bullet). **Hardener lesson recorded in the plan:** an audit finding tagged "bug" may be wording-ambiguity in disguise — verify the spec body agrees with its one-line summary before treating as a code defect.
- **Fix (no anchor):**
  - **F6-01:** new `Tier4Service.doneStatuses(projectId): string[] | null` returns the **per-type** terminal statuses (deduped) — per-type, not the union terminal, because a multi-type bundle's union ends at one type's done (test-bundle's union ends at note's `published`, not task's `done`). The poller resolves it once per project and threads it into `runTier1/2/3`, which now filter `i.status IN (<terminals>)`. A null set (bundle not loaded) makes the tiers refuse to badge.
  - **SF3-04:** the poller wraps the annotation fetch as `{ ok, data }` (`.then`→ok:true / `.catch`→ok:false) and passes `annotationsAvailable` to `runTier1`; when false, tier-1 leaves existing signals + `last_status` untouched (no evidence ⇒ no clear). A *successful* empty fetch still clears (genuine pass).
  - **F1-03:** `projects.create` now calls `readProjectConfig(repoPath)` (mirrors update(reinit)/CLI) — a present-but-mismatched/malformed `project.json` is a hard 400; absent config is a no-op (creating against a not-yet-init'd repo stays allowed).
- **Anchor:** none. **Deps:** `github/tiers.ts`/`tier4.ts`/`poller.ts` (no cross-slice coupling outstanding); `projects/service.ts` rebase-coupled with E14 (E14 merged first, no overlap — E14 touched the audit field-loop, F1-03 touches the create guard).
- **Verification:** `github/tiers.ts` tiers 1-3 queried items by `project_id` only (no status filter) vs `tier4.ts` done filter; `poller.ts:205-207` annotation `.catch(()=>[])` swallow feeding `runTier1`; `projects/routes.ts:48-77` POST → `projects.create` with no `readProjectConfig` call — all matched current `main`. **Verification finding (recorded):** the existing `semble.test.ts` tier-3 test asserted a badge on a **non-done** item (default status) — itself an instance of the F6-01 bug; corrected to a done item as part of the fix.
- **Per-type-vs-union note (recorded):** the cited reference `tier4.ts:82-85` uses the **union** terminal for its dedup scan; mirroring that for tiers 1-3 would have mis-filtered multi-type bundles (and broken the existing test-bundle tier tests, whose done-tasks are not the union terminal). Tiers 1-3 use per-type terminals (more correct); `tier4.doneItems` is left on the union (unchanged behaviour, freeform-tested) — out of F6-01 scope.
- **LOC:** ~diff stat across 4 src + 3 test files; production-side small (3 SQL filters + 1 poller wrap + 1 method + 1 create-guard line). 3-of-4 findings closed (F4-04 deferred); under the 130–190 band because F4-04's would-be transition-enforcement (the largest piece) was correctly routed out.
- **Tests:** `github.test.ts` — **F6-01** (tiers 1-3 do NOT badge a non-done item; flipping it to done makes the same signals fire; a null done-set refuses), **SF3-04** (a failed-fetch tier-1 run leaves an open signal intact; a successful empty run clears). `projects.test.ts` — **F1-03** (create rejects a mismatched `project.json` with `BundleIdMismatchError`; a repo with no config still creates). `semble.test.ts` — tier-3 test corrected to a done item (F6-01).
- **Fix-rounds:** 0 (Gitar ✅ approved no findings; both gate runs green first try; merged at `95b3673`).
- **Halt-class fires:** none. (F4-04 surfaced as a verification-gap / spec-wording decision → spec author ruled "defer to E17"; the chain continued at 3-of-4 per the ruling, not a halt.)
- **Surfaces to spec author:** **F4-04** (C-D12 transitions wording ambiguity) — surfaced 2026-06-01, ruled "defer to E17" (above).

### E17 — Product-decision gate (spec-author ruling encoded)
- **Branch:** `claude/phase-e-e17-decision-gate`
- **PR:** #pending (draft → ready on green)
- **Merge SHA:** pending
- **Class:** product-decision gate (LBD-4, halt-class 9, blessed). The chain halted here for the spec author (2026-06-01); this slice **encodes the full ruling**. **No code; no tests** (per the base plan's E17 contract). Durable ruling record: `handovers/phase-e-E17-decision-record.md`.
- **Deliverable (lands in this slice):**
  - **4 descope SPEC amendments:** F5-02 (§7.11 tree drag-retag → deferred), F7-01 (§7.20 multi-list AI export → deferred; per-session md + `/api/backup/export` remain the v1 surface), F7-06 (§7.24 command palette → narrowed to shipped subset), F7-07 (§7.24 keyboard nav → deferred; focusability + Esc retained).
  - **F4-04 C-D12 amendment** (CODE_SPEC): one-line summary aligned to the body — *validate status **membership** against the type lifecycle, **not** transition adjacency* (reconcile/auto-reconcile/dump-zone set status directly). F4-04 → **verified-closed in E18**.
  - **Phase-G register seeded:** F5-01, F5-03, F7-02 (scheduled features, named not dropped).
  - **Accepted-advisory register:** W1 fastify v5 accepted (LBD-5); in-range protobufjs/vite/esbuild → E17a.
  - **Accepted-minors register:** F1-05, F1-06, F2-01, F2-02, F3-02, F4-02, F4-03, F5-05, F7-05, S1-04, I2 (documented, no action).
- **Routing of build/ride rulings to appended slices:** F7-04 → **E22** (BUILD: audit-log filters); SF2-07/SF2-08 → **E23** (RIDE: methodology-parsing visibility); SF5-07/SF5-09/SF5-10/SF6-13/SF6-14/SF6-15 → **E24** (RIDE: frontend swallows); F6-02 + F1-02 → **E25** (cluster-B bugs); F1-04 + F8-01 + I8 → **E26** (doc-fix); F7-03/F4-01/F5-04 → **E19/E20/E21** (augmentation builds). **New roster floor: 27.**
- **Deferred (no slice):** F3-01 (§7.14-vs-T-D57 scan-gate layer) → re-surfaced to the spec author as a separate decision after E17; SF4-05/SF4-06 (cost under-count) → Phase F.
- **Anchor:** none (descopes narrow existing prose; the C-D12 amendment is a wording alignment, no new anchor — consistent with "SPEC.md only for ratified descopes").
- **Backfill:** E16 merge SHA `95b3673` + fix-rounds 0 recorded above (established next-branch backfill pattern).
- **Fix-rounds:** TBD.
- **Halt-class fires:** none (this *is* the blessed halt-class-9 gate; resolved by the ruling).
- **Surfaces to spec author:** F3-01 re-surfaced as a separate post-E17 decision (above).
