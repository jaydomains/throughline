# Phase E — Full Audit-Fix Close: Implementation Plan

- **Date:** 2026-05-30
- **Author session:** Phase E planning (session 1 of 3-session pipeline)
- **Status:** proposed — pending Session-2 rubric audit + spec-author triage
- **Scope:** every still-open finding across committed audits 1–5
- **Chain shape:** one PR per slice (canonical `AUTO_CONTINUE_WORKFLOW.md` rhythm; per PR #82 9c absorption)
- **Source of truth:** `docs/_meta/throughline/audits/` (audit-1..5 + synthesis), verified against current `main`

## Context — why this chain exists

Five read-only audits (2026-05-28) catalogued ~145 findings across build-readiness, bugs,
functional-correctness, silent-failure, and improvements. Phases A–D closed a first cohort
(build-runtime, shared error infra, frontend error-surfacing, regression locks). The remaining
open set is dominated by a single recurring anti-pattern: **degradation that masquerades as a
healthy empty state** — RAG running on a garbage fallback embedder, quarantine failures that
report "no quarantine," background jobs that log-and-die while looking alive, scanner faults that
dismiss real drift. These are trust-critical: the user concludes work is gone, or that a dead
feature works.

Phase E closes that open set under a one-PR-per-slice rhythm chosen deliberately for this chain:
high rollback-value (silent-failure changes touch diverse subsystems where a bad fix is itself a
silent regression), cleaner discrete-audit-after-merge verification, and per-PR Gitar attention
against specific changes.

This is also a **workflow stress test**: full-scope rather than a bounded experiment, to reveal
whether the three-session plan→audit→execute pipeline scales to hard cases.

## How findings were dispositioned (read this first)

Every audit finding falls into exactly one bucket:

| Bucket | Meaning | Handling |
|---|---|---|
| **bug-fix** | Behaviour contradicts spec/intent; a fix exists | Code + paired regression test, in one slice |
| **product-decision** | Spec-declared-but-unbuilt, or behaviour the spec author must choose to build/descope/schedule | Surfaced in the single triage slice (E16); **no choice baked in** |
| **already-closed** | Incidentally closed by Phase A–D work | Documented in the closure appendix (E17) with code evidence; verify-test added only if a lock is missing |
| **deferred-tail** | Low-value quality findings (a11y-runtime, bundle/font, micro-perf, minor dedup, audit-1 "accept" informationals, audit-5 improvement refactors) | Recorded in the deferral register; seeded to a named follow-up chain ("Phase F: audit-5 improvements & a11y"). **Surfaced, not silently dropped** (spec-author Q1 = defer-the-tail) |

The deferral (bucket 4) is an explicit decision recorded here so Session 2's rubric can challenge
it and the spec author can pull any item forward.

## Verified prior-phase closures (excluded — do NOT re-plan)

Verified against current `main`; listed for completeness only.

- **Phase A:** F1 (dist-runtime), I1 (backend `test/**` typecheck), W2 (Node 20→22 pin), W4 (React Router v7 flags)
- **Phase B:** I5-01 / I5-02 / I5-03 (shared error infra + `resolveProjectBundle`), F1-01 (structural closure)
- **Phase C:** SF6-01..12 (frontend error-surfacing), I3-01 (`useResource` extraction)
- **Phase D:** I1 Gap 2 (wire-contract types, T-D59), S2-01 (drift-side ReDoS), SF2-01 (scanner-throw dismissal), S5-01 (dump-zone atomic), S4-01 (drift over-dismissal), S7-01 (poller shutdown ordering), F1-01 arm-2 lock, + 7 paired regression tests

## Load-bearing architectural decisions (surfaced for spec author)

These are the decisions the chain hinges on. Slices that mint anchors are flagged. The
spec author confirms posture in Session-2 triage; Session 3 executes.

### LBD-1 — Refuse-rather-than-fallback principle (→ T-D60, minted in E1)

The dominant audit-4 anti-pattern is *dishonest degradation*. The spec-author-confirmed posture is
**split-by-cause**, not a blanket "always refuse":

- **Failure** (an operation that should succeed throws/errors) → **refuse and surface the error.**
  Do not substitute an empty/zero result. (e.g. RAG embedder resolution throws unexpectedly;
  scanner throws; Semble subprocess crashes.)
- **Capability-absent** (an optional dependency/key is legitimately missing) → **honest distinct
  response shape** that names the degraded mode. Not an error, not a silent substitution.
  (e.g. `@xenova/transformers` not installed → response carries `embedder: 'fallback'`;
  `node-notifier` absent → "notifications unavailable", not "delivered.")
- **No-results** (operation succeeded, genuinely nothing matched) → **honest empty.** This is the
  only legitimate empty.

**Reach of the principle** (which findings LBD-1 governs beyond SF3-01): SF3-02, S4-03, SF3-03,
SF2-04 (E2); SF4-01 (E3); SF5-03 (E4). The drift-side scanner-throw (SF2-01) already landed this
posture in Phase D — E1's T-D60 retro-anchors that precedent.

**Surfaced question for spec author:** confirm the three-way split is correct and that
`embedder`/capability fields are acceptable additions to wire-contract response types (T-D59 says
wire types live in `@throughline/shared` and are verified, not cast).

### LBD-2 — System-state visibility surface (→ C-D25, minted in E5; reused E6, E7)

SF1-01 (quarantine), SF2-02 (bundle health), and SF5-01/02/04 (background-job health) all need the
same thing the product currently lacks: an **honest project/system-state visibility surface**.
C-D25 defines the frontend pattern (where the badge/alert renders, the shared state shape, the
"degraded vs absent vs healthy" tri-state). E5 mints it on the smallest case (quarantine); E6 and
E7 reuse it.

**Surfaced question for spec author:** single consolidated surface (one "system health" block in
SettingsView/HomeView) vs per-subsystem badges. Plan assumes **one shared pattern, rendered per
subsystem** — confirm.

### LBD-3 — Background-job health-state model (→ C-D26 candidate, E7)

SF5-01/02/04 need a backend state field (`lastRunAt` / `lastError` / `healthy`) on each scheduled
loop. That backend model is architectural (it's the data behind C-D25's job-health badge). Flagged
as a **likely** mint; if E7's decomposition confirms a distinct backend contract, C-D26 is minted
under the **unplanned-anchor halt-class watch** (see Halt classes).

### LBD-4 — Audit-3 product-decision posture (E16, no anchor)

Audit-3's missing/partial features (F5/F7 family) are not bugs — they are build/descope/schedule
decisions. E16 surfaces them in one register. **No build work is pre-committed.** The spec author
triages in Session-2 review; chosen builds become their own future slices/chain.

## Halt classes for this chain

**Standard three** (codified in `AUTO_CONTINUE_WORKFLOW.md`):
1. **Spec drift** — work touches behaviour the spec doesn't sanction → halt, surface; fix is SPEC
   update or rollback, never silent absorption.
2. **Circuit breaker** — three fix-rounds on the same finding/failure on one slice → halt, surface,
   no fourth round.
3. **Explicit user pause** — kill-switch signal at a slice boundary → halt, await resumption.

**Four Phase C+D extensions** (named in the Phase E brief):
4. **Estimate breach** — a slice exceeds its line estimate by a material margin → halt, re-size.
5. **Unplanned anchor** — a slice needs an anchor not planned here (beyond T-D60/C-D25/C-D26) →
   halt, surface for minting approval.
6. **Test regression** — a slice's change breaks an unrelated existing test → halt, surface.
7. **Doc-PR collision** — concurrent doc edits collide with an in-flight slice → halt, serialize.

**Phase E scope-bounded (new):**
8. **Out-of-audit silent-failure** — a silent-failure/dishonest-degradation pattern is discovered
   *outside* audits 1–5 during a slice → do **not** expand the slice; flag it for the next audit
   cycle and continue.

> **Drift flag (surfaced for spec author):** extensions 4–7 are **not currently codified as halt
> classes** in `AUTO_CONTINUE_WORKFLOW.md` — only the standard three are, and "doc-PR collision"
> exists there as a *rule*, not a halt class. They surfaced as Phase C+D operating practice. This
> plan adopts them per the brief, but recommends either (a) formalizing 4–8 into
> `AUTO_CONTINUE_WORKFLOW.md` as part of the next cohort hardener, or (b) explicitly demoting them
> to slice-level triggers. Session 2 / spec author to adjudicate.

## Anchor-minting plan

| Anchor | Slice | Topic | Status |
|---|---|---|---|
| **T-D60** | E1 | Refuse-rather-than-fallback principle (split-by-cause: refuse-on-failure / honest-distinct-shape-on-capability-absent / honest-empty-on-no-results) | planned mint |
| **C-D25** | E5 | System-state visibility frontend pattern (tri-state: healthy / degraded / absent) | planned mint |
| **C-D26** | E7 | Background-job health-state backend model (`lastRunAt` / `lastError` / `healthy` per scheduled loop) | candidate (unplanned-anchor watch) |

Next free numbers verified: T-D59 and C-D24 are the current highest (`DECISIONS.md`, `CODE_SPEC.md
§1`, `SPEC.md §14`). T-D60 / C-D25 / C-D26 are free. Minting follows the lifecycle in
`SESSION_START.md §Anchor conventions`: WN-note → formalize in anchor file → index in `SPEC.md §14`
(T-D) / present in `CODE_SPEC.md` (C-D) → record in handover → lock in `PLATFORM_STATUS.md` at chain
close.

## Slice roster (17 slices)

Sequencing note: each slice branches off the **most recent merged main** and is independently
mergeable (no slice requires an earlier *unmerged* slice's code). Where a dependency is listed it is
a **data-shape / code-pattern** dependency (the dependent reads cleaner once the anchor/pattern is
on main), not a commit-order lock. Recommended order keeps anchor-minting slices (E1, E5) ahead of
their consumers.

| # | Slice | Class | Findings | Anchor | Est. LOC |
|---|---|---|---|---|---|
| E1 | RAG embedder honesty + refuse principle | bug-fix | SF3-01 | T-D60 | 120–160 |
| E2 | AI/capability honesty reach | bug-fix | SF3-02, S4-03, SF3-03, SF2-04 | — | 160–220 |
| E3 | Semble degradation honesty | bug-fix | SF4-01 | — | 80–120 |
| E4 | Reminder capability honesty | bug-fix | SF5-03 | — | 100–140 |
| E5 | Quarantine visibility | bug-fix | SF1-01 (+S1-03) | C-D25 | 140–190 |
| E6 | Bundle-health visibility | bug-fix | SF2-02, SF2-06 | (uses C-D25) | 150–200 |
| E7 | Background-job health + loop correctness | bug-fix | SF5-01, SF5-02, SF5-04, S4-02, S5-05 | C-D26 cand. | 220–300 |
| E8 | Shutdown lifecycle completion | bug-fix | S7-02, SF5-11, S7-03 | — | 130–180 |
| E9 | Watcher/loader robustness | bug-fix | S3-01/SF2-05, S3-03, SF5-05, SF5-06, SF5-08, S1-01, S1-02 | — | 160–220 |
| E10 | Transaction boundaries | bug-fix | S5-04, S6-03, S6-04 | — | 110–150 |
| E11 | Error→HTTP-status mapping | bug-fix | S5-03, S6-01, S6-02 | — | 90–130 |
| E12 | Methodology-parsing robustness | bug-fix | S2-02, S3-02, SF2-03 | — | 120–170 |
| E13 | Audit-trail wiring | bug-fix | SF7-01, SF7-02, SF7-03, SF4-02, SF4-03 | — | 140–190 |
| E14 | Frontend stale-data races | bug-fix | S8-01, S8-02, S8-03, S8-04 | — | 120–170 |
| E15 | Dependency advisory remediation | bug-fix + decision | W1 (+ W3 surfaced) | — | 40–90 |
| E16 | Audit-3 product-decision triage | product-decision (doc) | F5-01/02/03, F7-01/02/03/04/06/07, F1-02/03, F3-01, F4-01, F5-04, F6-01, + audit-3 minors | — | doc-only |
| E17 | Closure-verification appendix + verify tests | already-closed (doc + test) | S5-02, SF4-04, I6-01/02/03, + incidental | — | 60–120 |

**Chain total estimate:** ~2,000–2,800 LOC across 15 code/test slices + 2 doc slices. Calendar:
12–17 working days at one-PR-per-slice cadence (each slice = branch → gate-clear → merge), i.e.
~2–3 weeks. Honest note: E2 and E7 are the largest and the most likely to trip the estimate-breach
halt class; both have a documented split-fallback below.

---

## Per-slice detailed plans

> Convention for every slice: paired regression test lands in the **same** slice; backend tests
> mirror `packages/backend/src/<path>` under `packages/backend/test/<path>`; frontend tests under
> `packages/frontend/test/`. Wire-contract type changes land in `packages/shared/src/` and are
> verified, not cast (T-D59).

### E1 — RAG embedder honesty + refuse-rather-than-fallback principle

- **Findings closed:** SF3-01 (CRITICAL — RAG silently runs on hash-fallback embedder)
- **Class:** bug-fix
- **Current behavior (verified):** `intelligence/embeddings.ts:109-112` — bare `catch {}` pins
  `fallbackEmbedder` (256-dim SHA1 bag-of-tokens) on any import/construction failure. `kind` getter
  reports `'fallback'` but `RagQueryResult` exposes no embedder field, so query citations are
  indistinguishable from real retrieval.
- **Fix shape:** Apply LBD-1 split-by-cause. (a) **Capability-absent** (`@xenova/transformers` not
  installed) → keep the deterministic fallback BUT surface `embedder: 'fallback'` (and a degraded
  flag) on the query response shape. (b) **Failure** (model present but resolution throws
  unexpectedly) → refuse: propagate an error rather than silently pinning fallback. Distinguish the
  two causes inside `resolve()`'s catch (module-not-found vs other).
- **Files:** `packages/backend/src/intelligence/embeddings.ts`,
  `packages/backend/src/intelligence/rag.ts`, `packages/shared/src/` (RAG response type +
  `embedder` field)
- **Tests:** `packages/backend/test/intelligence/embeddings.test.ts`,
  `.../rag.test.ts` — capability-absent surfaces `fallback`; injected resolution-failure refuses.
- **Anchor minted:** **T-D60** (refuse-rather-than-fallback, split-by-cause). Body cites SF3-01 +
  the Phase D SF2-01 precedent.
- **Decisions surfaced/resolved:** LBD-1 (resolved into T-D60 body).
- **Dependencies:** none (chain head). Mints the principle E2/E3/E4 reuse.
- **Slice-specific halt triggers:** unplanned-anchor if a second anchor is needed for the wire-shape
  (not expected — T-D59 covers wire types).

### E2 — AI/capability honesty reach

- **Findings closed:** SF3-02 (HIGH, query-embed-empty masquerade), S4-03 (MED, transformers
  *runtime* failure crashes instead of honest-degrade), SF3-03 (MED, chat misattributes AI failure
  as "no key"), SF2-04 (MED, session-start reports `classifier_used_ai:true` on unparseable AI)
- **Class:** bug-fix
- **Current behavior (verified via audit):** `text-index.ts:235` `if (!qv) return []` masks embed
  failure as "no matches"; `embeddings.ts:101-105` runtime extractor throw is unhandled (only
  import/construction is caught); chat path and session-start classifier report dishonest success
  flags.
- **Fix shape:** apply T-D60 — embed-failure refuses (not empty); runtime extractor failure degrades
  honestly per capability-absent shape; chat distinguishes "no key" from "call failed";
  session-start reports `classifier_used_ai:false` when it fell back to all-medium.
- **Files:** `packages/backend/src/intelligence/text-index.ts`,
  `.../embeddings.ts`, `.../routes.ts` (chat), `packages/backend/src/session-start/engine.ts`
- **Tests:** matching `test/intelligence/*` + `test/session-start/engine.test.ts`
- **Anchor:** none (consumes T-D60).
- **Dependencies:** T-D60 pattern (E1) — recommended after E1.
- **Halt triggers:** **estimate-breach watch** (4 findings/4 files). Split-fallback: peel SF2-04
  (session-start) into a sibling slice if it breaches.

### E3 — Semble degradation honesty

- **Findings closed:** SF4-01 (HIGH — Semble subprocess crash/timeout → `catch { return [] }`,
  service reports `available:true` empty)
- **Class:** bug-fix
- **Current behavior:** `semble/client.ts:149` swallows subprocess error to empty array; caller
  reports availability true.
- **Fix shape:** T-D60 — subprocess crash/timeout is a **failure** → surface a distinct
  error/degraded shape; genuine zero-results stays honest-empty.
- **Files:** `packages/backend/src/semble/client.ts` (+ caller surfacing the distinct shape)
- **Tests:** `packages/backend/test/semble/client.test.ts`
- **Anchor:** none.
- **Dependencies:** T-D60 pattern (E1).

### E4 — Reminder capability honesty

- **Findings closed:** SF5-03 (CRITICAL — entire reminder feature silently dead when
  `node-notifier` absent; "Test notifications" returns `{ok:true}` and sets
  `os_notifications_enabled=true`, affirmatively claiming it works)
- **Class:** bug-fix
- **Current behavior:** `notifier/index.ts:36-42` no-op `notify()` always resolves; `markFired`
  consumes one-shot reminders as delivered; test button lies.
- **Fix shape:** T-D60 capability-absent — `notify()` reports unavailability; the settings
  "test" path returns honest "notifications unavailable" and does **not** flip
  `os_notifications_enabled` true; `markFired` only marks on real delivery.
- **Files:** `packages/backend/src/notifier/index.ts`, `packages/backend/src/directives/service.ts`
  (markFired path), settings handler/route, frontend settings surface (honest disabled state)
- **Tests:** `packages/backend/test/notifier/*`, `.../directives/service.test.ts`
- **Anchor:** none.
- **Dependencies:** T-D60 pattern (E1).

### E5 — Quarantine visibility

- **Findings closed:** SF1-01 (CRITICAL — quarantine copy-fail invisible, file re-loops); S1-03
  (LOW, quarantineCount under-reports — same root)
- **Class:** bug-fix
- **Current behavior (verified):** `bootstrap/worker.ts:113-127` — on `copyFileSync` failure, only
  `.error.json` is written and source is left in place; `readBootstrapState.countOutputs`
  (`worker.ts:290-299`) filters names ending `-bootstrap-output.json`, **excluding** `.error.json`,
  so `quarantineCount` stays 0 and the SettingsView alert (gated `quarantineCount > 0`) never fires.
- **Fix shape:** count quarantine `.error.json` entries (or a copy-fail marker) so a failed
  quarantine is visible; surface a tri-state quarantine status via the new visibility pattern.
- **Files:** `packages/backend/src/bootstrap/worker.ts`,
  `packages/frontend/src/views/SettingsView.tsx`, `packages/shared/src/` (state shape if widened)
- **Tests:** `packages/backend/test/bootstrap/worker.test.ts` (copy-fail → quarantineCount > 0),
  `packages/frontend/test/SettingsView.test.tsx` (alert renders)
- **Anchor minted:** **C-D25** (system-state visibility frontend pattern; tri-state healthy /
  degraded / absent).
- **Decisions surfaced/resolved:** LBD-2 (resolved into C-D25 body — confirm single-pattern posture
  with spec author first).
- **Dependencies:** none (mints C-D25). E6/E7 consume it.
- **Halt triggers:** unplanned-anchor if visibility needs a second anchor.

### E6 — Bundle-health visibility

- **Findings closed:** SF2-02 (HIGH — bundle breaking after binding flips `resolveBundle` to
  `error`; gates/companion/session-start/drift degrade to empty-200, indistinguishable from a legit
  freeform project), SF2-06 (MED — external/per-repo bundle errors invisible to `/api/methodologies`)
- **Class:** bug-fix
- **Current behavior:** `methodology/runtime.ts:167` error state degrades silently; methodologies
  route lists only the install cache.
- **Fix shape:** surface bundle-health (bound-but-broken vs legit-freeform vs healthy) via C-D25
  pattern; widen `/api/methodologies` to report per-repo/external bundle errors.
- **Files:** `packages/backend/src/methodology/runtime.ts`, methodologies route,
  `packages/frontend/src/views/SettingsView.tsx` (or HomeView health block),
  `packages/shared/src/`
- **Tests:** backend runtime/methodologies tests + frontend health-surface test
- **Anchor:** consumes C-D25.
- **Dependencies:** C-D25 (E5) data-shape — recommended after E5.

### E7 — Background-job health + loop correctness

- **Findings closed:** SF5-01 (HIGH backup auto-copy log-only), SF5-02 (HIGH reminder-fire
  log-only), SF5-04 (HIGH github-poll log-only), S4-02 (MED poller persists list ETag before
  snapshot upserts → permanent stale on mid-loop throw), S5-05 (MED recurring-reminder catch-up
  storm)
- **Class:** bug-fix
- **Current behavior:** `backup/scheduler`, `directives/scheduler`, `github/poller.ts` ticks survive
  failures with log-only output, no state field or badge; `poller.ts:152-221` ETag-before-upsert is
  non-atomic; `directives/service.ts:373-380` `advanceRecurrence` re-fires once per tick after
  downtime.
- **Fix shape:** add a uniform health-state field (`lastRunAt`/`lastError`/`healthy`) to each
  scheduled loop, expose via endpoint, render badge via C-D25; reorder poller to upsert-before-ETag
  (or transaction) so a throw self-heals; clamp recurrence catch-up to a single fire.
- **Files:** `packages/backend/src/backup/scheduler.ts`,
  `packages/backend/src/directives/scheduler.ts`, `packages/backend/src/directives/service.ts`,
  `packages/backend/src/github/poller.ts`, a health route, `packages/frontend/src/...` health
  surface, `packages/shared/src/`
- **Tests:** scheduler/poller health tests; poller stale-self-heal test; recurrence-storm clamp test
- **Anchor minted:** **C-D26 candidate** (background-job health-state backend model).
- **Decisions surfaced/resolved:** LBD-3 (confirm C-D26 vs folding the field into C-D25).
- **Dependencies:** C-D25 (E5) for the badge.
- **Halt triggers:** **estimate-breach watch** (largest slice, 3 subsystems + 2 correctness bugs +
  anchor). Split-fallback: peel S4-02 + S5-05 (loop correctness) into a sibling slice, leaving E7 as
  health-visibility only.

### E8 — Shutdown lifecycle completion

- **Findings closed:** S7-02 (HIGH — SSE connections + ping intervals never closed on shutdown;
  pings not `unref`'d), SF5-11 (MED — SSE ping write unguarded; no global `unhandledRejection`
  handler), S7-03 (MED — `stop()` clears timer but doesn't await in-flight, across
  backup/directives schedulers; the poller arm was closed by Phase D S7-01)
- **Class:** bug-fix
- **Current behavior:** `routes/events.ts:62-84` hijacked replies never ended on `app.close()`;
  `server.ts:704-715` close path doesn't await scheduler in-flight work.
- **Fix shape:** track open SSE connections, end them on close; `unref` ping intervals; guard ping
  writes + add a global `unhandledRejection` handler; await in-flight scheduler ticks (mirror the
  Phase D poller-drain pattern) before `db.close()`.
- **Files:** `packages/backend/src/routes/events.ts`, `packages/backend/src/server.ts`,
  `packages/backend/src/backup/scheduler.ts`, `packages/backend/src/directives/scheduler.ts`
- **Tests:** `packages/backend/test/routes/events.test.ts` (sockets end on close),
  shutdown-ordering test extending the Phase D pattern
- **Anchor:** none.
- **Dependencies:** none. (Mechanically adjacent to Phase D S7-01 already on main.)

### E9 — Watcher/loader robustness

- **Findings closed:** S3-01 / SF2-05 (MED — loader doesn't `notifyReloaded` on arm-1/arm-3 bundle
  **deletion**; downstream scanners keep running against a removed ruleset), S3-03 (LOW — loader
  `discoverBundleIds` `statSync` throws on dangling symlink, aborting startup hydration), SF5-05 /
  SF5-06 (MED — watcher `enqueue` throw drops file/output, chokidar swallows), SF5-08 (MED — loader
  `on('all')` unguarded), S1-01 (MED — archive/quarantine 1-second timestamp collision overwrites),
  S1-02 (MED — startup-scan/chokidar-arming TOCTOU re-opens restart-data-loss gap)
- **Class:** bug-fix
- **Current behavior:** `loader.ts:293-305` deletion path skips `notifyReloaded`;
  `bootstrap/watcher.ts:144-148` arm gap; `bootstrap/worker.ts:69-92` timestamp resolution.
- **Fix shape:** fire `notifyReloaded` on deletion; guard `statSync`/`on('all')`/`enqueue` so a
  single bad entry doesn't abort/drop; widen the timestamp prefix (add counter/ms) to avoid
  same-second overwrite; close the arm TOCTOU (re-scan after arm).
- **Files:** `packages/backend/src/methodology/loader.ts`,
  `packages/backend/src/bootstrap/watcher.ts`, `packages/backend/src/bootstrap/worker.ts`
- **Tests:** loader deletion-notify + dangling-symlink tests; watcher arm-TOCTOU test; worker
  timestamp-collision test
- **Anchor:** none.
- **Dependencies:** none.
- **Halt triggers:** estimate-breach watch (7 findings); split-fallback peels S1-01/S1-02 (bootstrap
  worker/watcher) from the loader-side fixes.

### E10 — Transaction boundaries

- **Findings closed:** S5-04 (MED — `items.update` not transactional though `items.create` is; throw
  in `writeContext`/`syncMentions` leaves half-rewritten state), S6-03 (LOW — md-ingest batch loop
  non-atomic), S6-04 (LOW — secrets read-modify-write non-atomic)
- **Class:** bug-fix
- **Current behavior:** `items/service.ts:616-669` scalar UPDATE + side-writes with no enclosing
  transaction; ingest batch + secrets RMW likewise.
- **Fix shape:** wrap each in a `better-sqlite3` transaction (mirror the `items.create` precedent and
  the Phase D dump-zone S5-01 fix).
- **Files:** `packages/backend/src/items/service.ts`, `packages/backend/src/ingest/service.ts`,
  secrets handler module
- **Tests:** throw-mid-update rolls back (items); batch + secrets atomicity tests
- **Anchor:** none.
- **Dependencies:** none (pattern mirrors Phase D S5-01 on main).

### E11 — Error→HTTP-status mapping

- **Findings closed:** S5-03 (MED — `INSERT OR IGNORE` doesn't suppress FK violations; stale
  `session_id` → `SQLITE_CONSTRAINT_FOREIGNKEY` → unmapped 500 not 400), S6-01 (MED — reconcile
  apply never checks `diff.rows` is an array → `for…of undefined` → 500 not 400), S6-02 (MED —
  reconcile catch maps only 4 named errors; `ItemPolicyError` → unmapped 500 not 4xx; tx already
  rolls back, no corruption)
- **Class:** bug-fix
- **Current behavior:** `items/service.ts:552`, `reconcile/routes.ts:95-117`, `service.ts:244`.
- **Fix shape:** extend the Phase B central `setErrorHandler` / `mapDomainError` (already on main)
  with FK-violation → 400, array-guard on `diff.rows` → 400, and `ItemPolicyError` → 4xx mappings.
- **Files:** `packages/backend/src/items/service.ts`, `packages/backend/src/reconcile/routes.ts`,
  `packages/backend/src/reconcile/service.ts`, the shared error handler/`mapDomainError`
- **Tests:** route-level tests asserting 400/4xx (not 500) for each case
- **Anchor:** none.
- **Dependencies:** Phase B central handler (on main — satisfied).

### E12 — Methodology-parsing robustness

- **Findings closed:** S2-02 (MED — gate side compiles `bundle.anchor_system.format_regex` raw with
  no `safe-regex` guard or input cap; catastrophic-but-valid regex hangs gate — unhardened twin of
  the Phase-D-closed drift-side S2-01), S3-02 (LOW — `state-machine.ts:37` unguarded
  `indexOf('\n')` on EOF heading), SF2-03 (MED — malformed gate/category lines silently dropped or
  retyped to wrong scanner; bundle loads green)
- **Class:** bug-fix
- **Current behavior:** `methodology/gates/checks.ts:153-155,177-179` raw `new RegExp`;
  `state-machine.ts:37`; parser silently drops malformed lines.
- **Fix shape:** route gate-side regex through the same `safe-regex` guard + input cap used on the
  drift side; guard the EOF `indexOf`; make malformed-line handling honest (surface a parse warning
  rather than silent drop/retype).
- **Files:** `packages/backend/src/methodology/gates/checks.ts`,
  `packages/backend/src/methodology/state-machine.ts`, the bundle parser
- **Tests:** gate-side ReDoS guard test (reuse the drift-side adjacent-quantifier case from Phase D
  I6-01); EOF-heading test; malformed-line surfacing test
- **Anchor:** none.
- **Dependencies:** reuses Phase D `safe-regex` hardening (on main).

### E13 — Audit-trail wiring

- **Findings closed:** SF7-01 (HIGH — secrets set/clear/rotate emits **no** audit row; only
  state-mutating domain with zero audit wiring; T-D24 forbids logging the value, not the event),
  SF7-02 (HIGH — `settings_json` edits land silently; the projects field-loop omits `settings_json`),
  SF7-03 (MED — `projects.updateSettings` unaudited), SF4-02 (MED — md-ingest summariser AI-failure
  carries no `extractor_note`, unlike its reconcile/dump-zone twins), SF4-03 (MED — md-ingest
  `skipped[]` conflates too-large / unreadable / deleted)
- **Class:** bug-fix
- **Current behavior:** secrets handlers emit no audit; `projects/service.ts:304` field-loop omits
  `settings_json`; ingest lacks extractor_note + skip-reason classification.
- **Fix shape:** emit event-only audit rows for secrets mutations (value excluded per T-D24); add
  `settings_json` to the projects audit field-loop; audit `updateSettings`; add `extractor_note` to
  md-ingest AI-failure; classify `skipped[]` reasons.
- **Files:** secrets handler module, `packages/backend/src/projects/service.ts`,
  `packages/backend/src/ingest/service.ts`
- **Tests:** audit-row-emitted tests per mutation; skip-reason classification test
- **Anchor:** none.
- **Dependencies:** none.

### E14 — Frontend stale-data races

- **Findings closed:** S8-01 (MED — `ItemDetailPanel` arrow-key sibling cycling fires 6 sequential
  awaits with no abort/ignore flag; stale earlier response overwrites panel), S8-02 (MED —
  `LibraryView` search debounce clears timer but not in-flight request; stale results win), S8-03
  (LOW — toast `setTimeout` not cleared → setState-after-unmount, ×3), S8-04 (LOW — DriftInbox/Board
  action errors swallowed → silent no-op, ×2)
- **Class:** bug-fix
- **Current behavior:** `components/ItemDetailPanel.tsx:64-105`, `views/LibraryView.tsx:88-105`,
  toast components, DriftInbox/Board action handlers.
- **Fix shape:** add an abort/ignore-stale guard (request token or `AbortController`) to panel
  cycling + library search; clear toast timers on unmount; surface swallowed action errors.
- **Files:** `packages/frontend/src/components/ItemDetailPanel.tsx`,
  `packages/frontend/src/views/LibraryView.tsx`, toast component(s),
  `packages/frontend/src/components/DriftInbox.tsx`, `.../Board.tsx`
- **Tests:** `packages/frontend/test/` race tests (stale response ignored); unmount-no-setState test
- **Anchor:** none.
- **Dependencies:** none. (Note: confirm S8-04 isn't already covered by Phase C SF6-08 closure —
  E17 appendix cross-checks; if closed, drop from E14.)

### E15 — Dependency advisory remediation

- **Findings closed:** W1 (HIGH — 1 critical + 7 high + 7 moderate + 1 low advisories; critical
  `protobufjs <7.5.5` in the optional `@xenova/transformers` chain; `fastify`/`fast-uri`/vite/esbuild
  in the real path). **Surfaced:** W3 (CI is advisory, not a required status check).
- **Class:** bug-fix + decision
- **Current behavior:** `pnpm audit` advisories outstanding; `ci.yml` not a required check.
- **Fix shape:** bump `fastify`, `fast-uri`, vite/esbuild, and the protobufjs/transformers chain to
  patched ranges; re-run `pnpm audit` to confirm. **Surface** W3 (making CI a required status check
  is a GitHub branch-protection / repo-admin change, not code) for spec-author action — recorded in
  E16's register, not implemented here.
- **Files:** `package.json` / `pnpm-lock.yaml` (root + affected packages)
- **Tests:** none new; full `pnpm -r test` + `pnpm -r build` must stay green post-bump (the gate is
  the test).
- **Anchor:** none.
- **Dependencies:** none.
- **Halt triggers:** **spec-drift / estimate-breach** if a bump forces a breaking API change (e.g.
  fastify major) → halt, surface rather than absorbing a migration into this slice.

### E16 — Audit-3 product-decision triage (doc-only)

- **Findings surfaced (NOT decided):** F5-01 (tree grouping ships 2 of 5 dimensions), F5-02 (tree
  drag-drop-retag absent), F5-03 (item detail panel verifier-rules + git-context placeholder),
  F7-01\* (§7.20 multi-list + AI consolidation export unbuilt), F7-02\* (§7.21 mermaid generation
  unbuilt), F7-06\* (§7.24 command palette delivers a fraction), F7-03 (semantic-search permanent
  stub), F7-04 (audit log missing time/actor/trigger filters), F7-07 (list keyboard nav unbound),
  F1-02 (re-init per-field audit vs single `project_reinit` row), F1-03 (`bundle_id_mismatch` not
  enforced on `POST /api/projects` create), F3-01 (scan-on-demand gate at wrong layer), F4-01
  (session-start omits 2 of 7 declared inputs), F5-04 (dump-zone no primary-unit re-route), F6-01
  (code-drift tiers 1–3 omit done-item filter), + audit-3 minors (F1-04/05/06, F2-01/02, F3-02,
  F4-02/03/04, F5-05, F6-02, F7-05, F8-01). **Plus** W3 (CI-required-check, from E15).
- **Class:** product-decision (doc-only)
- **Deliverable:** a single decision register in the plan/handover that, per finding, states the
  spec delta, the cost-shape of building it, and the three options (build / descope-and-mark-spec /
  schedule-to-a-future-chain) — **with no option pre-selected.** Spec author triages in Session-2
  review; selected builds spawn their own future slices/chain.
- **Files:** docs only (handover + this plan's register section)
- **Tests:** none.
- **Anchor:** none.
- **Dependencies:** none.
- **Halt triggers:** spec-drift if any "finding" turns out to be already-built (move to E17) or
  already-spec-sanctioned-as-deferred (drop).

### E17 — Closure-verification appendix + verification tests

- **Findings closed (already-closed, documented):** S5-02 (resolveBundle 3-arg omission —
  incidentally closed by Phase B `resolveProjectBundle` making `repo_path` non-omittable; same root
  as F1-01), SF4-04 (= S5-01 dump-zone non-atomic, closed Phase D), I6-01 (safe-regex
  adjacent-quantifier test — added Phase D), I6-02 (scanner-throw test — added Phase D), I6-03
  (dump-zone re-apply test — added Phase D), + any further incidental closures surfaced during the
  E1–E15 survey.
- **Class:** already-closed (doc + targeted test)
- **Deliverable:** appendix documenting each incidental closure with code evidence (file:line +
  closing phase), following the F1-01 "found → structurally closed → regression-locked" precedent;
  **a single verification test** added only where a closure lacks a lock-in regression test.
- **Files:** docs + `packages/backend/test/...` (only if a lock is missing)
- **Tests:** verification test(s) for any unlocked closure (expected: few or none — Phase D added 7)
- **Anchor:** none.
- **Dependencies:** runs last (consumes survey findings from E1–E15).

---

## Deferred-tail register (Phase F seed — NOT executed in this chain)

Per spec-author Q1 (defer-the-tail), the following are **formally deferred** to a named follow-up
chain, **"Phase F: audit-5 improvements & a11y"**, surfaced here so they are not silently dropped
and so Session 2 / the spec author can pull any item forward:

- **Audit-5 improvement refactors (HIGH/MED, code-quality not correctness):** I5-04 (`recordAiCost`
  shared), I5-05 (AI/heuristic router shared), I1-seg1 (`methodology/project-digest` dedup), I4-B01
  (route-split via `React.lazy`), I2-01 (tiers N+1), I2-03 (md-ingest N+1), I3-05 (detail-panel
  `Promise.all`), I3-03 (IntelligenceView shared-busy flag), I2-02, I3-02, I3-04, I3-06..08,
  I2-04..07.
- **Audit-5 a11y:** I4-A01..A08 (static) + I4-R01..R07 (runtime checklist), I4-A05 modal focus-trap.
- **Audit-5 bundle/font:** I4-B02 (redundant woff), I4-B03 (unused Geist weights), I4-B04 (vendor
  manualChunks), I4-B05 (lazy fuse.js), I4-B06 (prod sourcemap intent).
- **Audit-5 type-safety:** I7-01..05.
- **Audit-1 "accept"-marked informationals:** I2 (shared no-op test), I3 (dead dist), I4 (TS version
  drift), I5 (no project refs), I6 (build order), I7 (PR trigger filter), I8 (CI hardening), I9
  (benign test logs).
- **Audit-2 accept/clarify:** S1-04 (re-import audit-emission — within T-D54 spirit).

**Rationale:** Phase E's rollback-value thesis is correctness/silent-failure. Bundling perf/dedup
refactors and cosmetic a11y dilutes per-PR Gitar attention and inflates calendar with low-rollback
changes. The deferral is a decision, not an omission.

## Bug / decision / already-closed split (explicit)

- **Bug-fix slices (code + paired test):** E1, E2, E3, E4, E5, E6, E7, E8, E9, E10, E11, E12, E13,
  E14, E15 (15 slices).
- **Product-decision slice (spec author decides; no choice baked):** E16 (1 slice).
- **Already-closed slice (documentation + verify-test only):** E17 (1 slice).
- **Deferred (register only, not a slice):** the Phase F seed above.

## Tracking issue (ready — not opened by this session)

- **Title:** `Auto-continue: phase-e-full-audit-close`
- **Body shape (standard chain-open):** chain plan path (this artifact), chain-state file
  `.claude-code/auto-continue-state.json`, slice roster E1–E17 with one-line each, kill-switch
  signals (`.claude-code/auto-continue-pause` marker + `/pause` comment), progress-log section
  updated per merge (slice ID, PR #, merge timestamp, fix-round count).
- **Open it:** at chain-open (Session 3 start), not now.

## Verification (how Session 3 confirms the chain)

- **Per slice:** the three-layer gate — Gitar review clean, CI green
  (`pnpm -r typecheck && pnpm -r test && pnpm -r lint && pnpm -r build`), GitHub-mergeable — then
  merge-commit to main; next slice branches off updated main.
- **Per slice, discrete-audit-after-merge:** re-run the specific audit probe for the closed
  finding(s) against merged main (the chain's stated verification advantage).
- **Chain close:** every closed finding has a paired regression test on main; T-D60 indexed in
  `SPEC.md §14`; C-D25 (+ C-D26 if minted) present in `CODE_SPEC.md`; `PLATFORM_STATUS.md` Locked
  Decisions + Recent Slice History rolled; handover per merged PR; deferral register carried to the
  Phase F seed; tracking issue closed.

## Open questions for Session-2 audit / spec-author triage

1. LBD-1 split-by-cause confirmation + acceptability of `embedder`/capability fields on wire types.
2. LBD-2 single-pattern-vs-per-subsystem visibility surface.
3. LBD-3 C-D26 (distinct anchor) vs folding job-health into C-D25.
4. Halt-class drift: formalize extensions 4–8 in `AUTO_CONTINUE_WORKFLOW.md`, or demote to
   slice-level triggers?
5. E16 register: which audit-3 decisions are build / descope / schedule.
6. Deferral register: pull any Phase F item forward into Phase E?
