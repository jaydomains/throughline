<!-- Historical artifact. Audit 2 of 5, conducted 2026-05-28 against the repo state of that date. Committed retroactively 2026-05-30 (see handover 2026-05-30-audit-backfill-five-audit-reports.md). Transcribed verbatim from the original session deliverable — NOT edited, summarized, or updated. Findings later closed by subsequent phases are still listed here as originally found; closure is recorded in PLATFORM_STATUS / handovers, not here. -->

# Throughline — Bug Audit (Audit 2 of 5)

**Date:** 2026-05-28 · **Branch:** `claude/zealous-archimedes-hYx5s` · Read-only; no fixes made.
**Coverage:** 129 backend src files + 53 backend tests + frontend (28 components / 19 views / 12 hooks) + 24 shared modules, across 8 parallel segments.

## Tally

| Severity | Count | IDs |
|---|---|---|
| **Critical** | 0 | — |
| **High** | 6 | S2-01, S4-01, S5-01, S5-02, S7-01, S7-02 |
| **Medium** | 13 | S1-01, S1-02, S3-01, S4-02, S4-03, S5-03, S5-04, S5-05, S6-01, S6-02, S7-03, S8-01, S8-02 |
| **Low** | 8 (several collapsed) | S1-03, S1-04, S3-02, S3-03, S6-03, S6-04, S8-03, S8-04 |

**Invariant verdicts:** T-D54 idempotency core ✅ · T-D57 two-suppression-sites-share-one-condition ✅ · T-D52 single-write-path ✅ · T-D51 3-arm bundle precedence ✅ · C-D7 late-bound `disciplineEngine` ✅ (optional-chained, no read-before-assign). The invariants the audit was told to scrutinise mostly **hold** — the High findings are elsewhere.

---

## HIGH findings (recommend fix-now)

**S2-01 — ReDoS bypass in the discipline safe-regex guard.** `methodology/drift/discipline/safe-regex.ts:52-86`. `looksCatastrophic` only refuses quantified *groups* `(…)+`; it passes adjacent ungrouped quantifiers like `a*a*a*…$`. Verified live: `'a*'.repeat(15)+'$'` against ~18 chars exceeded a 25s timeout. `category.details` is bundle-supplied (`scanners.ts:157`), run against every line of every doc surface — a shared/public bundle hangs the scan and blocks the event loop. This is exactly the threat the module exists to stop. *(security/DoS)*

**S4-01 — Drift signals over-dismissed → false "still done".** `github/tiers.ts:61-77`. `listOpenCodeSignals` is scoped by `item_id` only (no rule_id/PR discriminator). When an item has >1 verifier rule, or a rule differs across open PRs, one rule passing dismisses **every** open tier-1 signal for the item — clearing a genuine regression badge while it still holds. Reachable on every normal poll where an item has multiple rules. *(state-machine / trust-critical)*

**S5-01 — Non-atomic dump-zone apply duplicates rows on retry.** `dump-zone/service.ts:252-306`. N `items.create` + M `library.create` + proposal status-flip run with **no enclosing transaction**. If item *k* throws (`ItemPolicyError` on a user-edited field, or FK on a bad session), items 1..k-1 are committed but the proposal stays `pending`; the user fixes and re-applies → 1..k-1 created **again as duplicates**.

**S5-02 — `resolveBundle` missing `repo_path` arg → wrong bundle resolved.** `dump-zone/service.ts:134`. Omitting the 3rd arg skips bundle-resolution **arm 2** (`.throughline/bundle.md`), so repo-bundle projects silently fall through to the install-shipped default — wrong item policy injected. **Cross-cutting:** the identical omission exists at `reconcile/service.ts:124` and `routes/communication-model.ts:49,100`; every *correct* call site passes all three args. Mechanical fix, but wrong data. *(straddles audit 3/4)*

**S7-01 — Shutdown writes to a closed DB.** `server.ts:704-715` + `github/poller.ts:228-239`. `githubPoller.stop()` / scheduler `stop()` only clear the timer; an in-flight `void pollProject().catch()` keeps running. `close()` proceeds to `db.close()` (line 714); when the awaited network call resolves, its synchronous DB writes hit a closed better-sqlite3 handle → throw. Reachable whenever SIGTERM/SIGINT lands during an active poll.

**S7-02 — SSE connections + ping intervals never closed on shutdown.** `routes/events.ts:62-84` + `server.ts:707`. `/events` calls `reply.hijack()`, so `app.close()` never ends those sockets or fires their cleanup; the per-connection ping `setInterval` is **not `unref`'d** and is cleared only on client disconnect. Production masks it with `process.exit(0)`, but `handle.close()` never returns the loop to quiescence — any close-without-exit (tests, graceful restart) hangs while pings write to closing sockets.

---

## MEDIUM findings (recommend queue)

- **S1-01** — Archive/quarantine filename uses 1-second-resolution timestamp; two ingests in the same second silently overwrite the prior archived file (loss of ingest history). `bootstrap/worker.ts:69-92`.
- **S1-02** — Startup-scan/chokidar-arming TOCTOU: a `bootstrap-output.json` write landing between `enqueueIfPresent` and watch-arm is caught by neither (`ignoreInitial:true`). Re-opens the restart-data-loss gap the scan exists to close. `bootstrap/watcher.ts:144-148`. *(straddles audit 4)*
- **S3-01** — Loader doesn't call `notifyReloaded` on arm-1/arm-3 bundle **deletion**, so downstream scanners keep running against the removed ruleset. `loader.ts:293-305`. *(watcher-consistency)*
- **S4-02** — Poller persists the list ETag **before** the snapshot upserts (non-atomic); a mid-loop throw/crash leaves ETag ahead of data → next poll gets 304 → serves stale snapshots permanently, no self-heal. `github/poller.ts:152-221`.
- **S4-03** — transformers embed **runtime** failure (after successful backend resolution) is unhandled → crashes the RAG request instead of degrading; the fallback only covers import/construction. `intelligence/embeddings.ts:101-105`. *(cross-ref W1/F1)*
- **S5-03** — `INSERT OR IGNORE` does **not** suppress FK violations; a stale/foreign `session_id` throws `SQLITE_CONSTRAINT_FOREIGNKEY` → unmapped → 500 not 400. `items/service.ts:552`.
- **S5-04** — `items.update` is **not** transactional though `items.create` is; a throw in `writeContext`/`syncMentions` after the scalar UPDATE leaves half-rewritten context/mentions, no rollback. `items/service.ts:616-669`.
- **S5-05** — Recurring-reminder catch-up storm: `advanceRecurrence` adds one interval, so an overdue reminder re-fires once per tick until it catches up → burst of duplicate OS notifications after downtime. `directives/service.ts:373-380`. *(straddles audit 3)*
- **S6-01** — Reconcile apply never checks `diff.rows` is an array; `{diff:{}}` passes the object guard → `for…of undefined` → 500 not 400. `reconcile/routes.ts:95` + `service.ts:244`.
- **S6-02** — Reconcile apply's catch maps only 4 named errors; an out-of-policy edited row throws `ItemPolicyError` → unmapped → 500 not 4xx (no corruption — tx rolls back). `reconcile/routes.ts:98-117`.
- **S7-03** — The `stop()`-clears-timer-but-doesn't-await-in-flight defect, replicated across `backup/scheduler`, `directives/scheduler`, `github/poller` (the mechanism behind S7-01).
- **S8-01** — `ItemDetailPanel` arrow-key sibling cycling fires 6 sequential awaits with no abort/ignore flag; slow earlier item's responses overwrite the panel with stale data. `components/ItemDetailPanel.tsx:64-105`.
- **S8-02** — `LibraryView` search debounce clears the timer but not the in-flight request; slow earlier query resolves after a faster later one → stale results shown. `views/LibraryView.tsx:88-105`.

## LOW findings (recommend accept / opportunistic)

S1-03 (quarantineCount under-reports on copy-fail) · S1-04 (re-import bumps `updated_at` + emits audit each run — within T-D54 spirit) · S3-02 (state-machine.ts:37 unguarded `indexOf('\n')` on EOF heading) · S3-03 (loader `discoverBundleIds` `statSync` throws on dangling symlink → aborts startup hydration) · S6-03 (md-ingest batch loop non-atomic) · S6-04 (secrets read-modify-write non-atomic; single-user → rare) · S8-03 (toast `setTimeout` not cleared → setState-after-unmount, 3×) · S8-04 (DriftInbox/Board action errors swallowed → silent no-op, 2× — *straddles audit 4*).

---

## Cross-cutting patterns (the aggregation-only view)

1. **Transaction-boundary asymmetry.** The codebase has *good* transaction discipline where it counts (migrations, `items.create`, `library.delete`) — but the **sibling apply/update/batch paths aren't wrapped**: S5-01 (dump-zone apply), S5-04 (items.update vs create), S6-03 (md-ingest batch), S6-04 (secrets), and S4-02 (ETag-before-snapshot). Recurring shape: *"the create path is atomic; its apply/update twin isn't."* Worth a focused transaction-boundary sweep.

2. **Error-class → HTTP-status mapping gaps.** S5-03, S6-01, S6-02 all share the same defect: route catches map a named subset of domain errors, everything else → opaque 500 on normal-but-invalid client input. No data corruption (txns roll back), but wrong status + poor UX. A shared error-mapping helper would close all three.

3. **`resolveBundle(...)` 3rd-arg omission** (S5-02): same one-line defect at **4 call sites** (dump-zone, reconcile, communication-model ×2), silently resolving the wrong bundle. Highest fix-value-per-effort item in the audit.

4. **Background-loop teardown** (S7-01/02/03): timers cleared but in-flight runs not awaited; SSE never server-closed. One lifecycle theme, several sites.

5. **Untrusted-bundle regex, two surfaces** (S2-01 + S2-02): the drift side was hardened with `safe-regex` but the guard has a bypass (S2-01); the **gate side never adopted the guard at all** (S2-02, raw `new RegExp` + un-escaped vocab). Both consume the same bundle-supplied input.

6. **Watcher inconsistency** (Segment 7's comparison table + S3-01): 5 watch sites diverge on idempotent-stop, startup-scan presence, per-event error guarding, and notify-on-unlink. No single watcher is broken, but the inconsistency is the risk — notably **loader's chokidar `on('all')` handler is the only one with no try/catch**, and arm-1/arm-3 unlink doesn't notify downstream.

7. **Frontend async-state races** (S8-01, S8-02): fetch-in-effect without an abort/ignore guard → stale overwrite. Otherwise frontend effect-cleanup and API error handling are **notably strong** (all intervals/SSE/listeners clean up correctly).

## Notable additional findings recorded during the sweep

- **S2-02 (Medium, Segment 2)** — Gate side compiles bundle regex raw: `methodology/gates/checks.ts:153-155,177-179` build `new RegExp(bundle.anchor_system.format_regex)` and interpolate an un-escaped vocab term, with no `safe-regex` guard and no input cap — the unhardened twin of the drift side. A catastrophic-but-valid `format_regex` hangs the gate run; a metacharacter vocab term malforms the matcher.

## Audit-handoff straddles
- **→ Audit 4 (silent failure):** S1-02, S1-03, S4-03 (partial), S8-04.
- **→ Audit 3 (functional):** S1-04, S5-02, S5-05.
- **→ Audit 1 cross-refs confirmed:** F1 (dist-runtime) did **not** surface new reachable bugs on the bootstrap path (render.ts reads its template from the copied `dist/` asset; run paths use tsx). W1 (optional `@xenova` chain) connects to S4-03.

## Recommendation buckets
- **fix-now:** the 6 High — prioritise **S5-02** (trivial, wrong data, 4 sites), **S4-01** (trust-critical false-clear), **S7-01** (shutdown corruption window), **S2-01** (security).
- **queue (PLATFORM_STATUS):** the 13 Medium, plus the three sweeps (transaction-boundary, error-status-mapping, watcher-consistency normalisation incl. S2-02).
- **accept / opportunistic:** the Lows, with S1-04 and S6-04 explicitly accept-by-design candidates.

---

### Per-segment verdicts (captured during the audit)

- **Seg 1 Bootstrap (T-D54/T-D56):** 0 Crit, 0 High, 2 Medium (S1-01, S1-02), 2 Low (S1-03, S1-04). Core upsert idempotency, conflict predicate, validator, path-guard, watcher/worker lifecycle, migration, type-mirror all clean.
- **Seg 2 Gate semantics (T-D57):** 1 High (S2-01), 1 Medium (S2-02). T-D57 two-suppression-sites-share-one-condition: **PASS**. State machine PASS. rescan retype PASS.
- **Seg 3 Bundle/loader (T-D51):** 0 Crit, 0 High, 1 Medium (S3-01), 2 Low (S3-02, S3-03). 3-arm precedence PASS; bundle-parser malformed-input safety clean. Straddle note: `bootstrap-output.json` written under `.throughline/` (T-D51 namespace) → flagged to bootstrap/functional.
- **Seg 4 github/intel/ai:** 1 High (S4-01), 2 Medium (S4-02, S4-03). auto-reconcile/state-cache/pr-linking transaction + idempotency invariants hold; AI/intelligence degradation discipline sound except the post-resolution embed path.
- **Seg 5 core domains/db:** 2 High (S5-01, S5-02), 3 Medium (S5-03, S5-04, S5-05). Migrations + migration runner verified clean and transactional.
- **Seg 6 ingest/cli/routes:** 0 Crit, 0 High, 2 Medium (S6-01, S6-02), 2 Low (S6-03, S6-04). **T-D52 single-write-path: PASS** (CLI/init touch the datastore only via HTTP; down-backend handled cleanly).
- **Seg 7 lifecycle/leaks:** 2 High (S7-01, S7-02), 1 Medium (S7-03). C-D7 late-bound `disciplineEngine` + `bootstrapWatcher`: verified safe (optional-chained). No background loop dies silently.
- **Seg 8 frontend:** 0 Crit, 0 High, 2 Medium (S8-01, S8-02), 2 Low (S8-03, S8-04). Effect cleanup + api error handling notably strong.
