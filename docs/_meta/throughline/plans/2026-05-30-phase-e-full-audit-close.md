# Phase E — Full Audit-Fix Close: Implementation Plan

- **Date:** 2026-05-30
- **Author session:** Phase E planning (session 1 of 3-session pipeline)
- **Status:** proposed — Session-2 audit incorporated (rev 2); pending spec-author triage
- **Scope:** every still-open finding across committed audits 1–5
- **Chain shape:** one PR per slice (canonical `AUTO_CONTINUE_WORKFLOW.md` rhythm; per PR #82 9c absorption)
- **Source of truth:** `docs/_meta/throughline/audits/` (audit-1..5 + synthesis), verified against current `main`

> **Rev 2 (post Session-2 audit):** seven findings incorporated — SF6-09 coverage hole closed
> (→ E14); audit-4 Lows named in the deferral register; audit-3 code-fix deltas split out of the
> product-decision triage (new E16); E7/E9 pre-split for coherence; E15 re-scoped (fastify v5 is a
> decision, not a range-bump); LBD-1 / defer-the-tail provenance corrected; independence claim
> softened. Roster grew 17 → 20 slices.

## Context — why this chain exists

Five read-only audits (2026-05-28) catalogued ~145 findings across build-readiness, bugs,
functional-correctness, silent-failure, and improvements. Phases A–D closed a first cohort
(build-runtime, shared error infra, frontend error-surfacing, regression locks). The remaining
open set is dominated by a single recurring anti-pattern: **degradation that masquerades as a
healthy empty state** — RAG running on a garbage fallback embedder, quarantine failures that
report "no quarantine," background jobs that log-and-die while looking alive, scanner faults that
dismiss real drift, a GitHub fetch failure that renders identically to "no PRs." These are
trust-critical: the user concludes work is gone, or that a dead feature works.

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
| **product-decision** | Spec-declared-but-unbuilt feature the spec author must choose to build/descope/schedule | Surfaced in the triage slice (E17); **no choice baked in** |
| **already-closed** | Incidentally closed by Phase A–D work | Documented in the closure appendix (E18) with code evidence; verify-test added only if a lock is missing |
| **deferred-tail** | Low-value quality findings + the audit-4/observability Lows that don't carry a correctness regression | Recorded in the deferral register (named individually); seeded to a follow-up chain ("Phase F"). **Surfaced, not silently dropped** |

**Provenance of the two load-bearing scope decisions (corrected in rev 2):**
- The **refuse-rather-than-fallback split-by-cause posture** (LBD-1) is **confirmed in the Phase E
  brief** ("SF3-01 split-by-cause confirmed by spec author: refuse-and-error on failure; honest
  distinct response shape on capability-absent; honest empty on no-results"). It is **not** an open
  question — only the wire-field shape detail is (Open Question 1).
- **Defer-the-tail** is a decision **made in this planning session** (spec-author answer Q1 = 1B:
  formally defer the low-value tail with a deferral register). It is **not** open — Open Question 6
  is reframed as a standing invitation to pull individual items forward, not a pending decision.

## Verified prior-phase closures (excluded — do NOT re-plan)

Verified against current `main`; listed for completeness only.

- **Phase A:** F1 (dist-runtime), I1 (backend `test/**` typecheck), W2 (Node 20→22 pin), W4 (React Router v7 flags)
- **Phase B:** I5-01 / I5-02 / I5-03 (shared error infra + `resolveProjectBundle`), F1-01 (structural closure)
- **Phase C:** **SF6-01/02** (Criticals) + **SF6-03..07** (Highs) + **SF6-08 / SF6-10 / SF6-11 / SF6-12** (Mediums) — frontend error-surfacing (`handovers/2026-05-30-phase-c-slice-2-error-surfacing.md:7`). **SF6-09 was deliberately skipped** (it has a paired backend half a frontend-only slice couldn't touch) — it is **open** and is carried by **E14** in this chain. I3-01 (`useResource` extraction).
- **Phase D:** I1 Gap 2 (wire-contract types, T-D59), S2-01 (drift-side ReDoS), SF2-01 (scanner-throw dismissal), S5-01 (dump-zone atomic), S4-01 (drift over-dismissal), S7-01 (poller shutdown ordering), F1-01 arm-2 lock, + 7 paired regression tests

## Load-bearing architectural decisions (surfaced for spec author)

These are the decisions the chain hinges on. Slices that mint anchors are flagged.

### LBD-1 — Refuse-rather-than-fallback principle (→ T-D60, minted in E1)

**Provenance: confirmed in the Phase E brief** (not pending). The posture is **split-by-cause**, not
a blanket "always refuse":

- **Failure** (an operation that should succeed throws/errors) → **refuse and surface the error.**
  Do not substitute an empty/zero result. (RAG embedder resolution throws unexpectedly; scanner
  throws; Semble subprocess crashes.)
- **Capability-absent** (an optional dependency/key is legitimately missing) → **honest distinct
  response shape** that names the degraded mode. Not an error, not a silent substitution.
  (`@xenova/transformers` not installed → response carries `embedder: 'fallback'`; `node-notifier`
  absent → "notifications unavailable", not "delivered.")
- **No-results** (operation succeeded, genuinely nothing matched) → **honest empty.** The only
  legitimate empty.

**Reach** (findings LBD-1 governs beyond SF3-01): SF3-02, S4-03, SF3-03, SF2-04, SF4-02, SF4-03
(E2); SF4-01 (E3); SF5-03 (E4). The drift-side scanner-throw (SF2-01) already landed this posture in
Phase D — E1's T-D60 retro-anchors that precedent.

**Open Question 1 (the only open part):** acceptability of `embedder`/capability fields on
wire-contract response types (T-D59 says wire types live in `@throughline/shared` and are verified,
not cast). The *principle* is settled.

### LBD-2 — System-state visibility surface (→ C-D25, minted in E5; reused E6, E7a)

SF1-01 (quarantine), SF2-02 (bundle health), and SF5-01/02/04 (background-job health) all need an
**honest project/system-state visibility surface** the product currently lacks. C-D25 defines the
frontend pattern (a reusable badge/alert component + shared `ResourceState` tri-state shape:
healthy / degraded / absent). E5 mints it on the smallest case (quarantine); E6 and E7a **import and
reuse the component** — a real build-order dependency (see Sequencing).

**Surfaced question for spec author:** single consolidated "system health" block vs per-subsystem
badges. Plan assumes **one shared component, rendered per subsystem** — confirm.

### LBD-3 — Background-job health-state model (→ C-D26, minted in E7a)

SF5-01/02/04 need a backend state field (`lastRunAt` / `lastError` / `healthy`) on each scheduled
loop — the data behind C-D25's job-health badge. Minted in E7a. (Promoted from "candidate" to
planned in rev 2 now that E7 is split and E7a's backend contract is isolated.)

**Surfaced question:** C-D26 as a distinct anchor vs folding the field into C-D25's state shape.

### LBD-4 — Audit-3 disposition: fix-now bugs vs product decisions (E16 / E17)

Audit-3's remediation section (audit-3 lines 85-90) splits its findings into **code-fix deltas**
("fix-now") and **feature-completeness backlog** (genuine build-or-descope). Rev 2 honours that
split: the clear correctness/validation bugs go to a **bug-fix slice (E16)** where "descope" is not
an option; the genuine missing-feature decisions go to the **product-decision triage (E17)**, where
each remaining item is additionally tagged bug / spec-staleness / product-choice so the triage is
never blind.

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
8. **Out-of-audit silent-failure** — a silent-failure/dishonest-degradation pattern discovered
   *outside* audits 1–5 during a slice → do **not** expand the slice; flag for the next audit cycle
   and continue.

> **Drift flag (surfaced for spec author):** extensions 4–7 are **not currently codified as halt
> classes** in `AUTO_CONTINUE_WORKFLOW.md` — only the standard three are, and "doc-PR collision"
> exists there as a *rule*, not a halt class. They surfaced as Phase C+D operating practice. This
> plan adopts them per the brief, but recommends either (a) formalizing 4–8 into
> `AUTO_CONTINUE_WORKFLOW.md` at the next cohort hardener, or (b) explicitly demoting them to
> slice-level triggers. Session 2 / spec author to adjudicate.
>
> **Coherence note (Session-2 F7):** the codified slice-sizing rule rejects multi-concern slices
> *regardless of LOC* ("a reviewer could describe it in one sentence without using 'and'").
> Estimate-breach (halt 4) catches size, not coherence — so rev 2 **pre-splits** the offending
> slices (E7→E7a/E7b, E9→E9a/E9b, ingest-honesty out of E13) up front rather than relying on a
> mid-chain halt.

## Anchor-minting plan

| Anchor | Slice | Topic | Status |
|---|---|---|---|
| **T-D60** | E1 | Refuse-rather-than-fallback principle (split-by-cause) | planned mint |
| **C-D25** | E5 | System-state visibility frontend pattern (component + `ResourceState` tri-state) | planned mint |
| **C-D26** | E7a | Background-job health-state backend model (`lastRunAt` / `lastError` / `healthy` per scheduled loop) | planned mint |

Next free numbers verified against live `main`: T-D59 and C-D24 are the current highest
(`DECISIONS.md`, `CODE_SPEC.md §1`, `SPEC.md §14`). T-D60 / C-D25 / C-D26 are free. Minting follows
the lifecycle in `SESSION_START.md §Anchor conventions`.

## Slice roster (20 slices)

| # | Slice | Class | Findings | Anchor | Est. LOC |
|---|---|---|---|---|---|
| E1 | RAG embedder honesty + refuse principle | bug-fix | SF3-01 | T-D60 | 120–160 |
| E2 | AI/capability degradation honesty | bug-fix | SF3-02, S4-03, SF3-03, SF2-04, SF4-02, SF4-03 | — | 190–260 |
| E3 | Semble degradation honesty | bug-fix | SF4-01 | — | 80–120 |
| E4 | Reminder capability honesty | bug-fix | SF5-03 | — | 100–140 |
| E5 | Quarantine visibility | bug-fix | SF1-01, S1-03 | C-D25 | 140–190 |
| E6 | Bundle-health visibility | bug-fix | SF2-02, SF2-06 | (uses C-D25) | 150–200 |
| E7a | Background-job health visibility | bug-fix | SF5-01, SF5-02, SF5-04 | C-D26 | 150–200 |
| E7b | Background-loop correctness | bug-fix | S4-02, S5-05 | — | 90–130 |
| E8 | Shutdown lifecycle completion | bug-fix | S7-02, SF5-11, S7-03 | — | 130–180 |
| E9a | Loader robustness | bug-fix | S3-01/SF2-05, S3-03, SF5-08 | — | 90–130 |
| E9b | Bootstrap worker/watcher robustness | bug-fix | S1-01, S1-02 (High), SF5-05, SF5-06 | — | 110–150 |
| E10 | Transaction boundaries | bug-fix | S5-04, S6-03, S6-04 | — | 110–150 |
| E11 | Error→HTTP-status mapping | bug-fix | S5-03, S6-01, S6-02 | — | 90–130 |
| E12 | Methodology-parsing robustness | bug-fix | S2-02, S3-02, SF2-03 | — | 120–170 |
| E13 | Audit-trail wiring | bug-fix | SF7-01, SF7-02, SF7-03, SF7-05 | — | 120–160 |
| E14 | Frontend error-surfacing & races | bug-fix | S8-01, S8-02, S8-03, S8-04, SF6-09 | — | 150–210 |
| E15 | Dependency advisory remediation (range-bumps only) | bug-fix | W1 partial (protobufjs/transformers chain, vite/esbuild) | — | 40–80 |
| E16 | Audit-3 code-fix deltas | bug-fix | F6-01, F1-03, F4-04, F6-02, SF3-04 | — | 150–210 |
| E17 | Audit-3 product-decision triage | product-decision (doc) | F5-01/02/03, F7-01/02/03/06/07, F4-01, F5-04, + tagged minors, + fastify-v5 decision (W1 residual) + W3 | — | doc-only |
| E18 | Closure-verification appendix + verify tests | already-closed (doc + test) | S5-02, SF4-04, I6-01/02/03, + incidental | — | 60–120 |

**Chain total estimate:** ~2,100–2,900 LOC across 18 code/test slices + 2 doc slices. Calendar:
~14–18 working days at one-PR-per-slice cadence, i.e. ~3 weeks. 20 slices sits at the top of the
brief's 12–20 envelope — the rev-2 coherence splits (Session-2 F7) traded three multi-concern slices
for five focused ones, which is the intended direction even though it consumes the remaining
headroom.

### Sequencing & dependency reality (Session-2 F6)

Each slice branches off the **most recent merged main**. Independence is **not absolute**:

- **Hard build-order dependencies (anchor-component reuse):** E6 and E7a **import the C-D25
  component/`ResourceState` shape built in E5** — they require E5 *merged*, not merely "cleaner on
  main." E5 must precede E6/E7a. (T-D60 is a *principle* anchor, so E2–E4 carry only a pattern
  dependency on E1 — they could restate the split-by-cause logic without importing E1's code.)
- **Shared-file rebase coupling — expect rebase commits, do NOT run these in parallel:**
  `directives/service.ts` (E4 markFired + E7b advanceRecurrence), `items/service.ts` (E10 update-tx
  + E11 FK-mapping), `backup/scheduler.ts` + `directives/scheduler.ts` (E7a health-field + E8
  await-in-flight), `intelligence/embeddings.ts` (E1 + E2), `SettingsView.tsx` (E5 + E6),
  `github/poller.ts` (E7a health + E7b ETag + github/routes.ts E14). The second slice into any
  shared file inherits a rebase.

Recommended order follows the roster top-to-bottom; the anchor-minting slices (E1, E5, E7a) precede
their consumers.

---

## Per-slice detailed plans

> Convention: paired regression test lands in the **same** slice; backend tests mirror
> `packages/backend/src/<path>` under `packages/backend/test/<path>`; frontend tests under
> `packages/frontend/test/`. Wire-contract type changes land in `packages/shared/src/` and are
> verified, not cast (T-D59).

### E1 — RAG embedder honesty + refuse-rather-than-fallback principle

- **Findings closed:** SF3-01 (CRITICAL — RAG silently runs on hash-fallback embedder)
- **Class:** bug-fix
- **Current behavior (verified):** `intelligence/embeddings.ts:109-112` — bare `catch {}` pins
  `fallbackEmbedder` (256-dim SHA1 bag-of-tokens) on any import/construction failure; `kind` getter
  reports `'fallback'` but `RagQueryResult` exposes no embedder field, so citations are
  indistinguishable from real retrieval.
- **Fix shape:** LBD-1 split-by-cause. (a) Capability-absent (`@xenova/transformers` not installed)
  → keep the deterministic fallback BUT surface `embedder: 'fallback'` + degraded flag on the query
  response. (b) Failure (model present but resolution throws unexpectedly) → refuse: propagate the
  error rather than silently pinning fallback. Distinguish the causes inside `resolve()`'s catch
  (module-not-found vs other).
- **Files:** `packages/backend/src/intelligence/embeddings.ts`, `.../rag.ts`,
  `packages/shared/src/` (RAG response type + `embedder` field)
- **Tests:** `packages/backend/test/intelligence/embeddings.test.ts`, `.../rag.test.ts`
- **Anchor minted:** **T-D60**. Body cites SF3-01 + the Phase D SF2-01 precedent.
- **Decisions:** LBD-1 (brief-confirmed) resolved into T-D60 body.
- **Dependencies:** none (chain head). Mints the principle E2/E3/E4 reuse.

### E2 — AI/capability degradation honesty

- **Findings closed:** SF3-02 (HIGH, query-embed-empty masquerade), S4-03 (MED, transformers
  *runtime* failure crashes vs honest-degrade), SF3-03 (MED, chat misattributes AI failure as "no
  key"), SF2-04 (MED, session-start reports `classifier_used_ai:true` on unparseable AI), SF4-02
  (MED, md-ingest summariser AI-failure carries no `extractor_note`, unlike reconcile/dump-zone
  twins), SF4-03 (MED, md-ingest `skipped[]` conflates too-large / unreadable / deleted)
- **Class:** bug-fix
- **One-sentence concern (coherence):** *"Make every AI/capability-degradation path report honestly
  instead of masquerading as success or empty."*
- **Current behavior:** `text-index.ts:235` `if (!qv) return []` masks embed failure;
  `embeddings.ts:101-105` runtime extractor throw unhandled; chat + session-start report dishonest
  success flags; `ingest/service.ts` omits `extractor_note` and conflates skip reasons.
- **Fix shape:** T-D60 — embed-failure refuses (not empty); runtime extractor failure degrades
  honestly; chat distinguishes "no key" from "call failed"; session-start reports
  `classifier_used_ai:false` on fallback; ingest emits `extractor_note` on AI failure and a typed
  skip-reason.
- **Files:** `packages/backend/src/intelligence/text-index.ts`, `.../embeddings.ts`, `.../routes.ts`
  (chat), `packages/backend/src/session-start/engine.ts`, `packages/backend/src/ingest/service.ts`
- **Tests:** `test/intelligence/*`, `test/session-start/engine.test.ts`, `test/ingest/service.test.ts`
- **Anchor:** none (consumes T-D60).
- **Dependencies:** T-D60 pattern (E1).
- **Halt triggers:** estimate-breach watch (6 findings). Split-fallback: peel ingest (SF4-02/03) into
  a sibling slice if it breaches.

### E3 — Semble degradation honesty

- **Findings closed:** SF4-01 (HIGH — Semble subprocess crash/timeout → `catch { return [] }`,
  reports `available:true` empty)
- **Class:** bug-fix
- **Current behavior:** `semble/client.ts:149` swallows subprocess error to empty; caller reports
  availability true.
- **Fix shape:** T-D60 — subprocess crash/timeout is a **failure** → surface a distinct
  error/degraded shape; genuine zero-results stays honest-empty.
- **Files:** `packages/backend/src/semble/client.ts` (+ caller)
- **Tests:** `packages/backend/test/semble/client.test.ts`
- **Anchor:** none. **Dependencies:** T-D60 pattern (E1).

### E4 — Reminder capability honesty

- **Findings closed:** SF5-03 (CRITICAL — reminder feature silently dead when `node-notifier`
  absent; "Test notifications" returns `{ok:true}` and sets `os_notifications_enabled=true`)
- **Class:** bug-fix
- **Current behavior:** `notifier/index.ts:36-42` no-op `notify()` always resolves; `markFired`
  consumes one-shot reminders as delivered; test button lies.
- **Fix shape:** T-D60 capability-absent — `notify()` reports unavailability; the settings test path
  returns honest "notifications unavailable" and does **not** flip `os_notifications_enabled`;
  `markFired` only marks on real delivery.
- **Files:** `packages/backend/src/notifier/index.ts`, `packages/backend/src/directives/service.ts`
  (markFired), settings handler/route, frontend settings surface
- **Tests:** `packages/backend/test/notifier/*`, `.../directives/service.test.ts`
- **Anchor:** none. **Dependencies:** T-D60 pattern (E1).

### E5 — Quarantine visibility

- **Findings closed:** SF1-01 (CRITICAL — quarantine copy-fail invisible, file re-loops); S1-03
  (LOW, quarantineCount under-reports — same root)
- **Class:** bug-fix
- **Current behavior (verified):** `bootstrap/worker.ts:113-127` — on `copyFileSync` failure only
  `.error.json` is written and the source is left in place; `readBootstrapState.countOutputs`
  (`worker.ts:290-299`) filters names ending `-bootstrap-output.json`, **excluding** `.error.json`,
  so `quarantineCount` stays 0 and the SettingsView alert (gated `quarantineCount > 0`) never fires.
- **Fix shape:** count quarantine `.error.json` entries (or a copy-fail marker) so a failed
  quarantine is visible; surface a tri-state quarantine status via the new C-D25 component.
- **Files:** `packages/backend/src/bootstrap/worker.ts`,
  `packages/frontend/src/views/SettingsView.tsx`, `packages/shared/src/` (`ResourceState` shape)
- **Tests:** `packages/backend/test/bootstrap/worker.test.ts` (copy-fail → count > 0),
  `packages/frontend/test/SettingsView.test.tsx` (alert renders)
- **Anchor minted:** **C-D25** (system-state visibility frontend pattern).
- **Decisions:** LBD-2 (confirm single-pattern posture first).
- **Dependencies:** none (mints C-D25). E6/E7a **import** it (hard dep).

### E6 — Bundle-health visibility

- **Findings closed:** SF2-02 (HIGH — bundle breaking after binding flips `resolveBundle` to
  `error`; gates/companion/session-start/drift degrade to empty-200, indistinguishable from a legit
  freeform project), SF2-06 (MED — external/per-repo bundle errors invisible to `/api/methodologies`)
- **Class:** bug-fix
- **Current behavior:** `methodology/runtime.ts:167` error state degrades silently; methodologies
  route lists only the install cache.
- **Fix shape:** surface bundle-health (bound-but-broken vs legit-freeform vs healthy) via the C-D25
  component; widen `/api/methodologies` to report per-repo/external bundle errors.
- **Files:** `packages/backend/src/methodology/runtime.ts`, methodologies route,
  `packages/frontend/src/views/SettingsView.tsx`, `packages/shared/src/`
- **Tests:** backend runtime/methodologies tests + frontend health-surface test
- **Anchor:** consumes C-D25.
- **Dependencies:** **E5 merged** (imports the C-D25 component) — hard build-order dep.

### E7a — Background-job health visibility

- **Findings closed:** SF5-01 (HIGH backup auto-copy log-only), SF5-02 (HIGH reminder-fire
  log-only), SF5-04 (HIGH github-poll log-only)
- **Class:** bug-fix
- **One-sentence concern:** *"Give every scheduled background loop an honest health surface."*
- **Current behavior:** `backup/scheduler`, `directives/scheduler`, `github/poller.ts` ticks survive
  failures with log-only output, no state field or badge.
- **Fix shape:** add a uniform health-state field (`lastRunAt`/`lastError`/`healthy`) to each
  scheduled loop, expose via a health route, render badge via C-D25.
- **Files:** `packages/backend/src/backup/scheduler.ts`,
  `packages/backend/src/directives/scheduler.ts`, `packages/backend/src/github/poller.ts`, a health
  route, frontend health surface, `packages/shared/src/`
- **Tests:** scheduler/poller health-state tests; frontend badge test
- **Anchor minted:** **C-D26** (background-job health-state backend model).
- **Decisions:** LBD-3 (confirm C-D26 vs folding into C-D25).
- **Dependencies:** **E5 merged** (C-D25 badge) — hard dep.

### E7b — Background-loop correctness

- **Findings closed:** S4-02 (MED — poller persists list ETag before snapshot upserts → permanent
  stale on mid-loop throw), S5-05 (MED — recurring-reminder catch-up storm)
- **Class:** bug-fix
- **One-sentence concern:** *"Make the poller and recurrence loops self-heal instead of corrupting
  on a mid-loop throw / downtime."*
- **Current behavior:** `poller.ts:152-221` ETag-before-upsert non-atomic; `directives/service.ts:373-380`
  `advanceRecurrence` re-fires once per tick after downtime.
- **Fix shape:** reorder poller to upsert-before-ETag (or wrap in a transaction) so a throw
  self-heals; clamp recurrence catch-up to a single fire.
- **Files:** `packages/backend/src/github/poller.ts`, `packages/backend/src/directives/service.ts`
- **Tests:** poller stale-self-heal test; recurrence-storm clamp test
- **Anchor:** none.
- **Dependencies:** shares `poller.ts` with E7a and `directives/service.ts` with E4 (rebase coupling).

### E8 — Shutdown lifecycle completion

- **Findings closed:** S7-02 (HIGH — SSE connections + ping intervals never closed on shutdown;
  pings not `unref`'d), SF5-11 (MED — SSE ping write unguarded; no global `unhandledRejection`
  handler), S7-03 (MED — `stop()` clears timer but doesn't await in-flight, across backup/directives
  schedulers; poller arm closed by Phase D S7-01)
- **Class:** bug-fix
- **Current behavior:** `routes/events.ts:62-84` hijacked replies never ended on `app.close()`;
  `server.ts:704-715` close path doesn't await scheduler in-flight work.
- **Fix shape:** track open SSE connections and end them on close; `unref` ping intervals; guard ping
  writes + add a global `unhandledRejection` handler; await in-flight scheduler ticks (mirror the
  Phase D poller-drain) before `db.close()`.
- **Files:** `packages/backend/src/routes/events.ts`, `packages/backend/src/server.ts`,
  `packages/backend/src/backup/scheduler.ts`, `packages/backend/src/directives/scheduler.ts`
- **Tests:** `packages/backend/test/routes/events.test.ts`; shutdown-ordering test
- **Anchor:** none. **Dependencies:** rebase coupling on schedulers with E7a.

### E9a — Loader robustness

- **Findings closed:** S3-01 / SF2-05 (MED — loader doesn't `notifyReloaded` on arm-1/arm-3 bundle
  **deletion**; downstream scanners keep running against a removed ruleset), S3-03 (LOW — loader
  `discoverBundleIds` `statSync` throws on dangling symlink, aborting startup hydration), SF5-08
  (MED — loader `on('all')` unguarded)
- **Class:** bug-fix
- **One-sentence concern:** *"Make the methodology loader robust to deletion and bad filesystem
  entries."*
- **Current behavior:** `loader.ts:293-305` deletion path skips `notifyReloaded`; `statSync` /
  `on('all')` unguarded.
- **Fix shape:** fire `notifyReloaded` on deletion; guard `statSync` and `on('all')` so a single bad
  entry doesn't abort/drop.
- **Files:** `packages/backend/src/methodology/loader.ts`
- **Tests:** loader deletion-notify + dangling-symlink + on('all')-guard tests
- **Anchor:** none. **Dependencies:** none.

### E9b — Bootstrap worker/watcher robustness

- **Findings closed:** S1-01 (MED — archive/quarantine 1-second timestamp collision overwrites),
  S1-02 / SF1-02 (**High** per audit-4 re-exam — startup-scan/chokidar-arming TOCTOU re-opens the
  restart-data-loss gap), SF5-05 / SF5-06 (MED — watcher `enqueue` throw drops file/output, chokidar
  swallows)
- **Class:** bug-fix
- **One-sentence concern:** *"Close the bootstrap watcher/worker data-loss gaps (arm TOCTOU,
  timestamp collision, dropped enqueue)."*
- **Severity note (Session-2 minor):** S1-02 is carried at **High** here — audit-4's re-exam
  escalated it from the audit-2 Medium.
- **Current behavior:** `bootstrap/watcher.ts:144-148` arm gap; `bootstrap/worker.ts:69-92`
  1-second timestamp resolution; `enqueue` throw drops the file.
- **Fix shape:** widen the timestamp prefix (counter/ms) to avoid same-second overwrite; close the
  arm TOCTOU (re-scan after arm); guard `enqueue`.
- **Files:** `packages/backend/src/bootstrap/watcher.ts`, `packages/backend/src/bootstrap/worker.ts`
- **Tests:** watcher arm-TOCTOU test; worker timestamp-collision test; enqueue-guard test
- **Anchor:** none. **Dependencies:** shares `worker.ts` with E5 (rebase coupling).

### E10 — Transaction boundaries

- **Findings closed:** S5-04 (MED — `items.update` not transactional though `items.create` is; throw
  in `writeContext`/`syncMentions` leaves half-rewritten state), S6-03 (LOW — md-ingest batch loop
  non-atomic), S6-04 (LOW — secrets read-modify-write non-atomic)
- **Class:** bug-fix
- **Current behavior:** `items/service.ts:616-669` scalar UPDATE + side-writes, no enclosing tx;
  ingest batch + secrets RMW likewise.
- **Fix shape:** wrap each in a `better-sqlite3` transaction (mirror `items.create` + Phase D
  dump-zone S5-01).
- **Files:** `packages/backend/src/items/service.ts`, `packages/backend/src/ingest/service.ts`,
  secrets handler module
- **Tests:** throw-mid-update rolls back; batch + secrets atomicity tests
- **Anchor:** none. **Dependencies:** shares `items/service.ts` with E11 (rebase coupling).

### E11 — Error→HTTP-status mapping

- **Findings closed:** S5-03 (MED — `INSERT OR IGNORE` doesn't suppress FK violations → 500 not
  400), S6-01 (MED — reconcile apply doesn't check `diff.rows` is an array → 500 not 400), S6-02
  (MED — reconcile catch maps only 4 named errors; `ItemPolicyError` → 500 not 4xx; tx already rolls
  back)
- **Class:** bug-fix
- **Current behavior:** `items/service.ts:552`, `reconcile/routes.ts:95-117`, `service.ts:244`.
- **Fix shape:** extend the Phase B central `setErrorHandler`/`mapDomainError` (on main) with
  FK-violation → 400, `diff.rows` array-guard → 400, `ItemPolicyError` → 4xx.
- **Files:** `packages/backend/src/items/service.ts`, `packages/backend/src/reconcile/routes.ts`,
  `.../reconcile/service.ts`, shared error handler
- **Tests:** route-level 400/4xx assertions
- **Anchor:** none. **Dependencies:** Phase B central handler (on main).

### E12 — Methodology-parsing robustness

- **Findings closed:** S2-02 (MED — gate side compiles `bundle.anchor_system.format_regex` raw, no
  `safe-regex` guard or input cap — unhardened twin of the Phase-D-closed drift-side S2-01), S3-02
  (LOW — `state-machine.ts:37` unguarded `indexOf('\n')` on EOF heading), SF2-03 (MED — malformed
  gate/category lines silently dropped or retyped; bundle loads green)
- **Class:** bug-fix
- **Current behavior:** `methodology/gates/checks.ts:153-155,177-179` raw `new RegExp`;
  `state-machine.ts:37`; parser silently drops malformed lines.
- **Fix shape:** route gate-side regex through the drift-side `safe-regex` guard + input cap; guard
  the EOF `indexOf`; make malformed-line handling honest (parse warning, not silent drop/retype).
- **Files:** `packages/backend/src/methodology/gates/checks.ts`,
  `.../methodology/state-machine.ts`, the bundle parser
- **Tests:** gate-side ReDoS guard test (reuse the Phase D adjacent-quantifier case); EOF-heading
  test; malformed-line surfacing test
- **Anchor:** none. **Dependencies:** reuses Phase D `safe-regex` (on main).

### E13 — Audit-trail wiring

- **Findings closed:** SF7-01 (HIGH — secrets set/clear/rotate emits **no** audit row; only
  state-mutating domain with zero audit wiring; T-D24 forbids the value, not the event), SF7-02
  (HIGH — `settings_json` edits via `PUT .../communication-model` land silently; projects field-loop
  omits `settings_json`), SF7-03 (MED — `projects.updateSettings` unaudited), **SF7-05** (LOW —
  session-path `settings_json` unaudited; pulled in from the deferral candidates because without it
  the "settings_json escapes per-field audit discipline" cross-cutting pattern is only 2-of-3 closed)
- **Class:** bug-fix
- **One-sentence concern:** *"Emit an audit row for every state-mutating path that currently
  mutates silently."*
- **Current behavior:** secrets handlers emit no audit; `projects/service.ts:304` field-loop omits
  `settings_json`; session path uninstrumented.
- **Fix shape:** event-only audit rows for secrets mutations (value excluded per T-D24); add
  `settings_json` to the projects audit field-loop; audit `updateSettings` and the session path.
- **Files:** secrets handler module, `packages/backend/src/projects/service.ts` (+ session path)
- **Tests:** audit-row-emitted tests per mutation (all three settings_json surfaces)
- **Anchor:** none. **Dependencies:** none.

### E14 — Frontend error-surfacing & races

- **Findings closed:** S8-01 (MED — `ItemDetailPanel` arrow-cycle stale-data race), S8-02 (MED —
  `LibraryView` search-debounce stale results), S8-03 (LOW — toast `setTimeout` not cleared →
  setState-after-unmount), S8-04 (LOW — DriftInbox/Board action errors swallowed), **SF6-09**
  (MED — `PrBadges` success-shaped swallow: `PrBadges.tsx:26` `.catch(() => setPrs([]))` renders
  identical to a healthy "none tracked"; **paired backend half** `github/routes.ts:43-73`)
- **Class:** bug-fix
- **One-sentence concern:** *"Make frontend mutation/fetch failures visible instead of snapping back
  to a healthy-looking empty state."*
- **Current behavior (verified):** `PrBadges.tsx:26` swallows the GitHub fetch error to `[]`; lines
  40-41 render "none tracked" — failure == healthy. Backend route surfaces no fetch-error signal.
- **Fix shape:** add an abort/ignore-stale guard (request token / `AbortController`) to panel
  cycling + library search; clear toast timers on unmount; surface swallowed action errors; render
  `PrBadges` honest-degraded (consuming E7a's poll-health signal where available, else a local error
  state) instead of empty.
- **Files:** `packages/frontend/src/components/ItemDetailPanel.tsx`,
  `.../views/LibraryView.tsx`, toast component(s), `.../components/DriftInbox.tsx`, `.../Board.tsx`,
  `.../components/PrBadges.tsx`; backend `packages/backend/src/github/routes.ts` (error signal)
- **Tests:** `packages/frontend/test/` race + honest-degrade tests (PrBadges renders error, not
  "none tracked"); unmount-no-setState test
- **Anchor:** none.
- **Dependencies:** soft pattern dep on E7a's poll-health signal for PrBadges' degraded render (E14
  ships a local error state if E7a hasn't merged — no hard block).

### E15 — Dependency advisory remediation (range-bumps only)

- **Findings closed:** **W1 partial** — the advisories closeable by an in-range/optional-chain bump:
  `protobufjs` (the critical, in the optional `@xenova/transformers` chain) and the in-range
  vite/esbuild advisories.
- **Explicitly NOT closed here (Session-2 F5):** the **fastify** advisory. Audit-1 W1 states the only
  fastify patch is in the **v5 line → remediation = a v4→v5 major migration**; `fast-uri` is pulled
  by fastify and moves with it. A 40–80 LOC range-bump slice cannot close these without tripping its
  own breaking-change halt. The fastify/`fast-uri` residual is routed to **E17 as a product decision**
  (accept-advisory-on-path vs fund-the-v5-migration-as-its-own-slice/chain).
- **Class:** bug-fix (the range-bump portion)
- **Fix shape:** bump `protobufjs`/transformers chain and vite/esbuild to patched ranges; re-run
  `pnpm audit`; confirm `pnpm -r test` + `pnpm -r build` stay green.
- **Files:** `package.json` / `pnpm-lock.yaml` (root + affected packages)
- **Tests:** none new; the gate is the test.
- **Anchor:** none.
- **Halt triggers:** spec-drift/estimate-breach if any *in-range* bump unexpectedly forces a breaking
  change → halt, surface (the known fastify major is already carved out, so this should not fire).

### E16 — Audit-3 code-fix deltas (bug-fix)

- **Findings closed (audit-3 "fix-now" correctness/validation, where "descope" is not an option):**
  F6-01 (MODERATE — code-drift tiers 1–3 omit the done-item status filter → badge non-done items as
  drifted), F1-03 (MODERATE — `bundle_id_mismatch` not enforced on `POST /api/projects` create;
  T-D51 mandates the validation error), F4-04 (MINOR — per-type transitions parsed but not enforced
  at create/update), F6-02 (MINOR — tier-1 path-stem match documented but not implemented;
  message-substring over-matches), **SF3-04** (audit-4 LOW — per-PR sub-fetch swallow can clear a
  tier-1 signal as passing; same silent-clear-of-real-signal class as SF2-01, so fixed here with the
  tier work rather than deferred)
- **Class:** bug-fix
- **One-sentence concern:** *"Fix the audit-3 code-fix deltas that audit-3 itself flagged fix-now —
  tier/done-item correctness and missing create-time validation."*
- **Rationale (Session-2 F3):** these were mis-bucketed into the E17 product-decision register in
  rev 1; audit-3 lines 85-90 class them as code-fix, not build/descope. Parking a correctness bug
  behind product triage is scope-drift in the deferral direction.
- **Files:** `packages/backend/src/github/tiers.ts` (F6-01, F6-02, SF3-04),
  `packages/backend/src/projects/service.ts` (F1-03 create validation, F4-04 transition enforcement)
- **Tests:** done-item-filter test; create-mismatch-rejected test; transition-enforcement test;
  tier-1 path-stem + sub-fetch-failure-doesn't-clear tests
- **Anchor:** none.
- **Dependencies:** none (independent of the E7a/E7b poller work; touches `tiers.ts`, not `poller.ts`).
- **Halt triggers:** estimate-breach watch (5 findings, 2 files); split-fallback peels the
  projects-service items (F1-03/F4-04) from the tiers items.

### E17 — Audit-3 product-decision triage (doc-only)

- **Genuine product decisions surfaced (NOT decided):** F5-01 (tree grouping 2 of 5 dimensions),
  F5-02 (tree drag-drop-retag absent), F5-03 (item-detail verifier-rules + git-context placeholder),
  F7-01\* (§7.20 multi-list + AI consolidation export unbuilt), F7-02\* (§7.21 mermaid unbuilt),
  F7-03 (semantic-search permanent stub), F7-04 (audit log missing the §7.22 time-range / actor /
  trigger-type filters; `/api/audit` accepts only `entity_type`/`entity_id`/`project_id`/`limit` —
  build the three filters vs descope the §7.22 claim), F7-06\* (§7.24 command palette fraction),
  F7-07 (list keyboard nav unbound), F4-01 (session-start omits 2 of 7 inputs), F5-04 (dump-zone no
  primary-unit re-route).
- **Residual decisions routed in (rev 2):** **fastify v4→v5 migration** (W1 residual from E15 —
  accept-advisory vs fund-migration), **W3** (make CI a required status check — a GitHub
  branch-protection change, not code).
- **Remaining audit-3 minors, each PRE-TAGGED so the triage is never blind (Session-2 F3 option b):**
  F1-02 (audit-semantic: single `project_reinit` row vs per-field — *spec-decision*), F1-04 (`/health`
  vs `/api/health` — *spec-staleness, doc-fix*), F1-05/F1-06 (`InitConfigError` union / `cli/init`
  structure — *minor type/structure, defer-or-fix*), F2-01 (validator silently ignores excluded
  fields — *validation-semantic, decision*), F2-02 (`merge_fields` v1 carve-out — *already
  spec-deferred*), F3-01 (scan-on-demand gate layer — *spec-delta, decision*), F3-02 (no on-bind
  scan trigger — *missing-feature, decision*), F4-02 (gate concurrency/ordering unimpl — *decision*),
  F4-03 (C-D4 illustrative stubs — *decision*), F5-05 (undeclared "Intelligence" 10th view —
  *scope-creep, accept-or-document*), F7-05 (voice click-toggle vs hold-to-talk — *decision*), F8-01
  (companion pending/in-progress badge color — *cosmetic bug, trivially fixable; tagged fix-now but
  cosmetic*).
- **Class:** product-decision (doc-only)
- **Deliverable:** one decision register stating, per finding, the spec delta, the cost-shape, the
  bug-vs-decision tag, and the options (build / descope-and-mark-spec / schedule) — **no option
  pre-selected** for the genuine product choices.
- **Files:** docs only. **Tests:** none. **Anchor:** none. **Dependencies:** none.

### E18 — Closure-verification appendix + verification tests

- **Findings closed (already-closed, documented):** S5-02 (resolveBundle 3-arg omission —
  incidentally closed by Phase B `resolveProjectBundle`; **verified on main: all four former
  omission sites now call `resolveProjectBundle(registry, project)`, no raw 2-arg calls remain**),
  SF4-04 (= S5-01 dump-zone non-atomic, Phase D), I6-01 (safe-regex adjacent-quantifier test, Phase
  D), I6-02 (scanner-throw test, Phase D), I6-03 (dump-zone re-apply test, Phase D), + any further
  incidental closures surfaced during the E1–E16 survey.
- **Class:** already-closed (doc + targeted test)
- **Deliverable:** appendix documenting each incidental closure with code evidence (file:line +
  closing phase), per the F1-01 "found → structurally closed → regression-locked" precedent; **one
  verification test** only where a closure lacks a lock-in regression test (expected: few/none —
  Phase D added 7).
- **Files:** docs + `packages/backend/test/...` (only if a lock is missing). **Anchor:** none.
- **Dependencies:** runs last (consumes survey findings from E1–E16).

---

## Deferred-tail register (Phase F seed — NOT executed in this chain)

Per the in-session decision (Q1 = 1B: formally defer the low-value tail), the following are deferred
to **"Phase F: audit-5 improvements & a11y"**, named individually so the plan's "surfaced, not
dropped" promise holds. Any item may be pulled forward in triage.

**Audit-4 Lows (Session-2 F2 — observability/correctness lows, not quality/perf).**
*Why deferring a correctness/observability low is acceptable here:* each is bounded, single-surface,
and does **not** silently clear or destroy user data on the main path — they degrade an edge signal
or an audit completeness corner. The two that *did* carry main-path silent-clear or
audit-discipline weight (**SF3-04** silent-clear-of-tier-signal, **SF7-05** settings_json audit
3-of-3) were **pulled into the chain** (E16, E13 respectively) rather than deferred. The remainder:
SF2-07 (companion `library.attach` swallow asserts success), SF2-08 (refused/invalid bundle regex →
silent skip), SF4-05, SF4-06 (cost under-count on post-billing throw), SF5-07 / SF5-09 / SF5-10,
SF6-13 / SF6-14 / SF6-15, SF7-04 (chat-no-AI unaudited), SF7-06 (verifier `last_status` unaudited).

**Audit-5 improvement refactors (HIGH/MED, code-quality not correctness):** I5-04 (`recordAiCost`
shared), I5-05 (AI/heuristic router shared), I1-seg1 (`methodology/project-digest` dedup), I4-B01
(route-split via `React.lazy`), I2-01 (tiers N+1), I2-03 (md-ingest N+1), I3-05 (detail-panel
`Promise.all`), I3-03 (IntelligenceView shared-busy flag), I2-02, I3-02, I3-04, I3-06..08,
I2-04..07.

**Audit-5 a11y:** I4-A01..A08 (static) + I4-R01..R07 (runtime checklist), I4-A05 modal focus-trap.

**Audit-5 bundle/font:** I4-B02 (redundant woff), I4-B03 (unused Geist weights), I4-B04 (vendor
manualChunks), I4-B05 (lazy fuse.js), I4-B06 (prod sourcemap intent).

**Audit-5 type-safety:** I7-01..05.

**Audit-1 "accept"-marked informationals:** I2 (shared no-op test), I3 (dead dist), I4 (TS version
drift), I5 (no project refs), I6 (build order), I7 (PR trigger filter), I8 (CI hardening), I9
(benign test logs).

**Audit-2 accept/clarify:** S1-04 (re-import audit-emission — within T-D54 spirit).

**Rationale:** Phase E's rollback-value thesis is correctness/silent-failure. Bundling perf/dedup
refactors and cosmetic a11y dilutes per-PR Gitar attention and inflates calendar with low-rollback
changes. The deferral is a decision, not an omission.

## Bug / decision / already-closed split (explicit)

- **Bug-fix slices (code + paired test):** E1, E2, E3, E4, E5, E6, E7a, E7b, E8, E9a, E9b, E10, E11,
  E12, E13, E14, E15, E16 (**18 slices**).
- **Product-decision slice (spec author decides; no choice baked):** E17 (1 slice).
- **Already-closed slice (documentation + verify-test only):** E18 (1 slice).
- **Deferred (register only, not a slice):** the Phase F seed above.

## Tracking issue (ready — not opened by this session)

- **Title:** `Auto-continue: phase-e-full-audit-close`
- **Body shape (standard chain-open):** chain plan path (this artifact), chain-state file
  `.claude-code/auto-continue-state.json`, slice roster E1–E18 with one-line each, kill-switch
  signals (`.claude-code/auto-continue-pause` marker + `/pause` comment), progress-log section
  updated per merge (slice ID, PR #, merge timestamp, fix-round count).
- **Open it:** at chain-open (Session 3 start), not now.

## Verification (how Session 3 confirms the chain)

- **Per slice:** the three-layer gate — Gitar review clean, CI green
  (`pnpm -r typecheck && pnpm -r test && pnpm -r lint && pnpm -r build`), GitHub-mergeable — then
  merge-commit to main; next slice branches off updated main.
- **Per slice, discrete-audit-after-merge:** re-run the specific audit probe for the closed
  finding(s) against merged main.
- **Chain close:** every closed finding has a paired regression test on main; T-D60 indexed in
  `SPEC.md §14`; C-D25 + C-D26 present in `CODE_SPEC.md`; `PLATFORM_STATUS.md` Locked Decisions +
  Recent Slice History rolled; handover per merged PR; deferral register carried to the Phase F seed;
  tracking issue closed.

## Open questions for spec-author triage

1. **LBD-1 wire-shape only:** acceptability of `embedder`/capability fields on wire-contract response
   types. *(The split-by-cause principle itself is brief-confirmed, not open.)*
2. **LBD-2:** single consolidated visibility surface vs per-subsystem badges.
3. **LBD-3:** C-D26 as a distinct anchor vs folding job-health into C-D25.
4. **Halt-class drift:** formalize extensions 4–8 in `AUTO_CONTINUE_WORKFLOW.md`, or demote to
   slice-level triggers?
5. **E16 vs E17 boundary:** confirm the fix-now set (F6-01, F1-03, F4-04, F6-02, SF3-04) is correct
   and nothing else in E17 is actually a non-discretionary bug.
6. **E17 product choices:** which of F5/F7-family + the fastify-v5 migration + W3 are build /
   descope / schedule.
7. **Deferral register (standing invitation, not open):** pull any named Phase F item forward into
   Phase E? *(Defer-the-tail itself is decided — Q1 = 1B.)*
