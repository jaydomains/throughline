# Phase E — Full Audit-Fix Close: Implementation Plan

- **Date:** 2026-05-30
- **Author session:** Phase E planning (session 1 of 3-session pipeline)
- **Status:** proposed — Session-2 audit (rev 2) + spec-author triage (rev 3) incorporated; pending one focused re-audit of the changed regions
- **Scope:** every still-open finding across committed audits 1–5
- **Chain shape:** one PR per slice (canonical `AUTO_CONTINUE_WORKFLOW.md` rhythm; per PR #82 9c absorption)
- **Source of truth:** `docs/_meta/throughline/audits/` (audit-1..5 + synthesis), verified against current `main`

> **Rev 3 (spec-author triage, OQ1–OQ7):** OQ5 re-classified the E16/E17 boundary *by principle*
> (F6-02 flips to product-decision — spec is silent); OQ6 promoted three findings to build slices
> (F7-03, F4-01, F5-04), formalized four descopes as spec amendments, scheduled three to a Phase G
> register, accepted the fastify advisory, and handed W3 to the owner; OQ7 pulled the
> wrong-belief-about-state audit-4 Lows into the chain (SF2-07/08, SF4-05/06, SF5-07/09/10,
> SF6-13/14/15) and kept the audit-trail-only Lows deferred (SF7-04/06). Roster 20 → **23 slices**
> (the growth is a deliberate spec-author scope addition, not estimate drift). OQ1–OQ4 confirmed the
> anchor and halt-class postures. The former "Open Questions" section is now "Spec-author triage
> decisions (resolved)".
>
> **Rev 2 (post Session-2 audit):** seven findings + a severity note incorporated (SF6-09→E14;
> audit-4 Lows named; audit-3 code-fix split out; E7/E9 pre-split; E15 re-scoped; provenance fixed;
> independence softened). See git history for detail.
>
> **Rev 3.1 (coverage-gate fix):** restored **F7-04** (dropped again in the rev-3 E16→E20 rework —
> its *third* drop across the run: dropped rev-2, restored `eb60198`, dropped rev-3) and **F7-05**
> (first dropped in rev-3). **Meta-finding (durable):** three F7-04 drops across two revisions is a
> *mechanical pattern, not isolated mistakes* — "remember to preserve coverage" loses to "reshuffle
> for clarity" under revision pressure. **Process control adopted (see Revision Discipline below):**
> every revision now runs an audit-ID set-diff gate before commit. Running it on rev-2→rev-3
> confirmed F7-04/F7-05 as the only true drops (the SF6-10/11/12, I2–I9, I4-B0x, I6-0x set-diff hits
> are notation-compression false positives — still covered by range notation).

## Revision discipline — audit-ID set-diff gate (mandatory before every commit)

Coverage drops under revision are this artifact's demonstrated failure mode (F7-04 dropped three
times). Before committing any revision N, run a mechanical set-diff against revision N-1:

1. Extract all `F#-##`, `S#-##`, `SF#-##`, `W#`, `I#`/`I#-##` IDs from both revisions (de-duplicated).
2. Set-diff N-1 vs N. For every dropped ID, classify: **intentional** (record the rationale and where
   it moved) or **accidental** (re-add with the minimal pattern, as for F7-04/F7-05 here).
3. Account for false positives from range/compression notation (e.g. `SF6-08/10/11/12`, `I2–I9`)
   before declaring a true drop.
4. Only commit once every dropped ID is explained. The gate is cheap; the silent coverage hole is not.

## Context — why this chain exists

Five read-only audits (2026-05-28) catalogued ~145 findings across build-readiness, bugs,
functional-correctness, silent-failure, and improvements. Phases A–D closed a first cohort. The
remaining open set is dominated by one anti-pattern: **degradation that masquerades as a healthy
empty state** — RAG on a garbage fallback embedder, quarantine failures reporting "no quarantine,"
background jobs that log-and-die while looking alive, scanner faults dismissing real drift, a GitHub
fetch failure rendering identically to "no PRs." These are trust-critical: the user concludes work
is gone, or that a dead feature works.

Phase E closes that set under a one-PR-per-slice rhythm chosen for high rollback-value (silent-failure
fixes touch diverse subsystems where a bad fix is itself a silent regression), cleaner
discrete-audit-after-merge verification, and per-PR Gitar attention. It is also a **workflow stress
test** of the three-session plan→audit→execute pipeline at full scope.

## How findings were dispositioned (read this first)

Every audit finding falls into exactly one bucket:

| Bucket | Meaning | Handling |
|---|---|---|
| **bug-fix** | Current behaviour contradicts what the spec says or logically requires | Code + paired regression test, in one slice |
| **feature-build** | Spec-declared-but-unbuilt feature the spec author **chose to build** (OQ6) | Build slice + tests (E17–E19) |
| **product-decision / spec-reconciliation** | Spec is silent or the choice is a value judgment; or a chosen descope/schedule | E20: descopes formalized as spec amendments, schedules to the Phase G register, residual minors tagged |
| **already-closed** | Incidentally closed by Phase A–D work | E21 closure appendix with code evidence; verify-test only if a lock is missing |
| **deferred-tail** | Quality-of-implementation findings + audit-4 Lows that are audit-trail-only (no wrong-belief-about-state) | Deferral register (named individually); seeded to "Phase F" |

**The classification rule (OQ5, applied throughout):** a finding is a **bug** if current behaviour
contradicts what the spec *says* or *logically requires*; it is a **product-decision** if the spec
is *silent* or the choice is a *value judgment*. The list of bugs falls out of the rule, not the
reverse. **The silent-failure test (OQ7):** an audit-4 Low rides in the chain if it *produces a
wrong belief about operational state*; it stays deferred if it is audit-trail/observability-only.

## Verified prior-phase closures (excluded — do NOT re-plan)

- **Phase A:** F1, I1, W2, W4
- **Phase B:** I5-01 / I5-02 / I5-03, F1-01
- **Phase C:** **SF6-01/02** + **SF6-03..07** + **SF6-08/10/11/12** (`handovers/2026-05-30-phase-c-slice-2-error-surfacing.md:7`); **SF6-09 deliberately skipped** (backend half) → carried by **E14**. I3-01.
- **Phase D:** I1 Gap 2 (T-D59), S2-01, SF2-01, S5-01, S4-01, S7-01, F1-01 arm-2 lock, + 7 regression tests

## Load-bearing architectural decisions (resolved in triage)

### LBD-1 — Refuse-rather-than-fallback principle (→ T-D60, minted in E1)

Brief-confirmed split-by-cause: **failure** → refuse + surface; **capability-absent** → honest
distinct response shape that names the degraded mode; **no-results** → honest empty (the only
legitimate empty). **OQ1 resolved:** `embedder` / capability fields **are added to shared
wire-contract response types** (T-D59's intent is that the contract expresses truth; side-channel
headers defeat it). Reach: SF3-02, S4-03, SF3-03, SF2-04, SF4-02, SF4-03 (E2); SF4-01 (E3); SF5-03
(E4); the drift-side SF2-01 precedent (Phase D) is retro-anchored by T-D60.

### LBD-2 — System-state visibility surface (→ C-D25, minted in E5; reused E6, E7a)

One shared C-D25 component + shared `ResourceState` tri-state (healthy / degraded / absent).
**OQ2 resolved:** render **per-subsystem, in context alongside the feature each concerns — NOT as a
consolidated "system health" panel.** For an epistemic tool you should encounter health state where
you're working, not hunt for it in an overview; aggregated dashboards solve the wrong problem. So:
quarantine status renders in the bootstrap block (E5), bundle-health beside the methodology surface
(E6), each job's health beside the feature it powers (E7a) — all from the one C-D25 component.

### LBD-3 — Background-job health-state model (→ C-D26, minted in E7a)

`lastRunAt` / `lastError` / `healthy` per scheduled loop. **OQ3 resolved:** C-D26 is a **distinct
anchor** (frontend rendering convention C-D25 vs backend data model C-D26 are different layers with
different evolution pressures; anchor count is not a metric to minimize).

### LBD-4 — Audit-3 disposition by principle (E16 bugs / E20 decisions)

Applied the OQ5 rule with spec citations (see E16's classification table). Bugs → E16; the genuine
spec-silent/value-judgment item (F6-02) → E20's decision register.

## Halt classes for this chain

**Standard three** (codified): spec drift; circuit breaker (3 fix-rounds); explicit user pause.
**Four Phase C+D extensions** (operating practice): estimate breach; unplanned anchor; test
regression; doc-PR collision. **Phase E scope-bounded (new):** out-of-audit silent-failure → flag
for next audit cycle, do not expand the slice.

> **OQ4 resolved — halt-class codification:** extensions 4–8 are **not** modified into
> `AUTO_CONTINUE_WORKFLOW.md` during Phase E execution. Phase E runs under them as documented
> operating practice (this section). The **Phase E cohort hardener at chain close** absorbs 4–8 into
> the canonical doc — same pattern as Phases A–D → PR #82. Editing the workflow doc while a chain
> runs against it is the recursive doc-PR-collision problem; the hardener avoids it.

## Anchor-minting plan

| Anchor | Slice | Topic |
|---|---|---|
| **T-D60** | E1 | Refuse-rather-than-fallback principle (split-by-cause) |
| **C-D25** | E5 | System-state visibility frontend pattern (component + `ResourceState`, rendered in-context) |
| **C-D26** | E7a | Background-job health-state backend model (`lastRunAt`/`lastError`/`healthy`) |

T-D59 / C-D24 are the live highest; T-D60 / C-D25 / C-D26 are free. No other anchors planned (OQ6
builds reuse existing surfaces; an unplanned anchor would trip halt-class 5).

## Slice roster (23 slices)

| # | Slice | Class | Findings | Anchor | Est. LOC |
|---|---|---|---|---|---|
| E1 | RAG embedder honesty + refuse principle | bug-fix | SF3-01 | T-D60 | 120–160 |
| E2 | AI/capability degradation honesty | bug-fix | SF3-02, S4-03, SF3-03, SF2-04, SF4-02, SF4-03 | — | 190–260 |
| E3 | Semble degradation honesty | bug-fix | SF4-01 | — | 80–120 |
| E4 | Reminder capability honesty | bug-fix | SF5-03 | — | 100–140 |
| E5 | Quarantine visibility | bug-fix | SF1-01, S1-03 | C-D25 | 140–190 |
| E6 | Bundle-health visibility | bug-fix | SF2-02, SF2-06 | (uses C-D25) | 150–200 |
| E7a | Background-job health visibility | bug-fix | SF5-01, SF5-02, SF5-04, SF5-07, SF5-09, SF5-10 | C-D26 | 180–240 |
| E7b | Background-loop correctness | bug-fix | S4-02, S5-05 | — | 90–130 |
| E8 | Shutdown lifecycle completion | bug-fix | S7-02, SF5-11, S7-03 | — | 130–180 |
| E9a | Loader robustness | bug-fix | S3-01/SF2-05, S3-03, SF5-08 | — | 90–130 |
| E9b | Bootstrap worker/watcher robustness | bug-fix | S1-01, S1-02 (High), SF5-05, SF5-06 | — | 110–150 |
| E10 | Atomic writes & recording | bug-fix | S5-04, S6-03, S6-04, SF4-05, SF4-06 | — | 140–190 |
| E11 | Error→HTTP-status mapping | bug-fix | S5-03, S6-01, S6-02 | — | 90–130 |
| E12 | Methodology-parsing robustness | bug-fix | S2-02, S3-02, SF2-03, SF2-08 | — | 140–200 |
| E13 | Audit-trail wiring | bug-fix | SF7-01, SF7-02, SF7-03, SF7-05 | — | 120–160 |
| E14 | Frontend error-surfacing & races | bug-fix | S8-01, S8-02, S8-03, S8-04, SF6-09, SF6-13, SF6-14, SF6-15, SF2-07, F8-01 | — | 210–280 |
| E15 | Dependency advisory remediation (range-bumps; fastify accepted) | bug-fix | W1 partial | — | 40–80 |
| E16 | Audit-3 code-fix deltas (by principle) | bug-fix | F6-01, F1-03, F4-04, SF3-04 | — | 140–190 |
| E17 | Build: per-entry semantic search | feature-build | F7-03 | — | 150–220 |
| E18 | Build: session-start full input set | feature-build | F4-01 | — | 110–160 |
| E19 | Build: dump-zone primary-unit re-route | feature-build | F5-04 | — | 120–170 |
| E20 | Audit-3 spec reconciliation & residual register | spec-reconciliation (doc) | descopes F5-02/F7-01/F7-06/F7-07; schedules F5-01/F5-03/F7-02; decisions F6-02/F1-02 + tagged minors | — | doc + small spec edits |
| E21 | Closure-verification appendix + verify tests | already-closed (doc + test) | S5-02, SF4-04, I6-01/02/03 | — | 60–120 |

**Chain total:** ~2,500–3,400 LOC across 21 code/test slices + 2 doc slices. Calendar ~16–21 working
days (~3–4 weeks). **23 slices exceeds the brief's original 12–20 envelope** — by deliberate
spec-author scope addition in triage (3 OQ6 builds + the OQ7 pull-forwards), not estimate drift.
Flagged for transparency; the spec author owns the envelope.

### Sequencing & dependency reality

- **Hard build-order deps:** E6 and E7a **import the C-D25 component built in E5** — E5 must merge
  first. (T-D60 is a *principle* anchor — E2–E4 carry only a pattern dep on E1.)
- **Shared-file rebase coupling (don't run in parallel):** `directives/service.ts` (E4 + E7b),
  `items/service.ts` (E10 + E11), `backup/scheduler.ts` + `directives/scheduler.ts` (E7a + E8),
  `intelligence/embeddings.ts` (E1 + E2), `SettingsView.tsx` (E5 + E6), `github/poller.ts` (E7a +
  E7b), `github/tiers.ts` (E16 + the SF3-04 work), `github/routes.ts` (E14). Second slice into a
  shared file inherits a rebase.

---

## Per-slice detailed plans

> Convention: paired regression test in the same slice; backend tests mirror
> `packages/backend/src/<path>` under `test/<path>`; frontend tests under `packages/frontend/test/`.
> Wire-contract types land in `packages/shared/src/` and are verified, not cast (T-D59).

### E1 — RAG embedder honesty + refuse-rather-than-fallback principle
- **Closes:** SF3-01 (CRITICAL). **Class:** bug-fix.
- **Current (verified):** `intelligence/embeddings.ts:109-112` bare `catch {}` pins the SHA1 fallback; `RagQueryResult` exposes no embedder field → garbage citations indistinguishable from real.
- **Fix:** LBD-1 split-by-cause; capability-absent surfaces `embedder:'fallback'` (OQ1: on the shared response type), unexpected resolution failure refuses.
- **Files:** `intelligence/embeddings.ts`, `intelligence/rag.ts`, `packages/shared/src/` (RAG response + `embedder`).
- **Tests:** `test/intelligence/embeddings.test.ts`, `rag.test.ts`. **Anchor:** T-D60. **Deps:** chain head.

### E2 — AI/capability degradation honesty
- **Closes:** SF3-02, S4-03, SF3-03, SF2-04, SF4-02, SF4-03. **Class:** bug-fix.
- **Concern:** *"Make every AI/capability-degradation path report honestly instead of masquerading as success or empty."*
- **Fix:** T-D60 — embed-failure refuses; runtime extractor failure degrades honestly; chat distinguishes "no key" from "call failed"; session-start reports `classifier_used_ai:false` on fallback; ingest emits `extractor_note` + typed skip-reason.
- **Files:** `intelligence/text-index.ts`, `embeddings.ts`, `intelligence/routes.ts`, `session-start/engine.ts`, `ingest/service.ts`. **Deps:** T-D60 (E1). **Halt:** estimate-breach watch (6 findings); peel ingest if it breaches.

### E3 — Semble degradation honesty
- **Closes:** SF4-01 (HIGH). `semble/client.ts:149` swallows subprocess crash to empty, reports `available:true`. **Fix:** T-D60 distinct degraded shape. **Files:** `semble/client.ts` + caller. **Deps:** T-D60.

### E4 — Reminder capability honesty
- **Closes:** SF5-03 (CRITICAL). `notifier/index.ts:36-42` no-op resolves; test button sets `os_notifications_enabled=true`. **Fix:** capability-absent honesty; `markFired` only on real delivery; honest disabled UI. **Files:** `notifier/index.ts`, `directives/service.ts`, settings route, frontend settings. **Deps:** T-D60.

### E5 — Quarantine visibility
- **Closes:** SF1-01 (CRITICAL), S1-03. **Current (verified):** `bootstrap/worker.ts:113-127` copy-fail writes only `.error.json`; `countOutputs` (`worker.ts:290-299`) filters `-bootstrap-output.json`, excluding `.error.json` → `quarantineCount` stays 0, alert never fires.
- **Fix:** count quarantine error markers; render a tri-state quarantine status **in the bootstrap block** (OQ2 in-context, not a dashboard) via the C-D25 component.
- **Files:** `bootstrap/worker.ts`, `views/SettingsView.tsx`, `packages/shared/src/` (`ResourceState`). **Anchor:** C-D25. **Deps:** none (E6/E7a import it).

### E6 — Bundle-health visibility
- **Closes:** SF2-02 (HIGH), SF2-06 (MED). `methodology/runtime.ts:167` error degrades silently; methodologies route lists only the install cache. **Fix:** surface bundle-health (bound-but-broken vs legit-freeform vs healthy) **beside the methodology surface** via C-D25; widen `/api/methodologies`. **Files:** `methodology/runtime.ts`, methodologies route, `SettingsView.tsx`, `packages/shared/src/`. **Deps:** **E5 merged** (imports C-D25).

### E7a — Background-job health visibility
- **Closes:** SF5-01, SF5-02, SF5-04 (HIGH) + **SF5-07, SF5-09, SF5-10** (OQ7 pulled — background loops that rot silently → wrong belief the task ran). **Class:** bug-fix.
- **Concern:** *"Give every scheduled background loop an honest health surface."*
- **Fix:** uniform `lastRunAt`/`lastError`/`healthy` per loop; expose via route; render **beside each feature the loop powers** (OQ2). The SF5-07/09/10 scope is confirmed at execution against the exact loops.
- **Files:** `backup/scheduler.ts`, `directives/scheduler.ts`, `github/poller.ts`, health route, frontend surfaces, `packages/shared/src/`. **Anchor:** C-D26. **Deps:** **E5 merged**.

### E7b — Background-loop correctness
- **Closes:** S4-02 (poller ETag-before-upsert → permanent stale), S5-05 (recurrence catch-up storm). **Concern:** *"Make the poller and recurrence loops self-heal on a mid-loop throw / downtime."* **Files:** `github/poller.ts`, `directives/service.ts`. **Deps:** rebase coupling w/ E7a, E4.

### E8 — Shutdown lifecycle completion
- **Closes:** S7-02 (HIGH SSE not closed on shutdown), SF5-11 (ping unguarded + no global `unhandledRejection`), S7-03 (scheduler stop doesn't await in-flight). **Fix:** end SSE conns on close, `unref` pings, guard writes + global handler, await in-flight ticks. **Files:** `routes/events.ts`, `server.ts`, `backup/scheduler.ts`, `directives/scheduler.ts`. **Deps:** rebase w/ E7a.

### E9a — Loader robustness
- **Closes:** S3-01/SF2-05 (no `notifyReloaded` on deletion), S3-03 (statSync on dangling symlink aborts startup), SF5-08 (`on('all')` unguarded). **Concern:** *"Make the methodology loader robust to deletion and bad filesystem entries."* **Files:** `methodology/loader.ts`. **Deps:** none.

### E9b — Bootstrap worker/watcher robustness
- **Closes:** S1-01 (timestamp collision), S1-02/SF1-02 (**High** per audit-4 re-exam — arm TOCTOU restart-data-loss), SF5-05/06 (enqueue throw drops file). **Concern:** *"Close the bootstrap watcher/worker data-loss gaps."* **Files:** `bootstrap/watcher.ts`, `bootstrap/worker.ts`. **Deps:** rebase w/ E5.

### E10 — Atomic writes & recording
- **Closes:** S5-04 (`items.update` non-transactional), S6-03 (ingest batch non-atomic), S6-04 (secrets RMW non-atomic) + **SF4-05, SF4-06** (OQ7 pulled — cost under-count on post-billing throw → wrong belief about spend state).
- **Concern:** *"Make multi-step writes atomic so a mid-operation throw can't leave partial or under-counted state."*
- **Fix:** wrap in `better-sqlite3` transactions (mirror `items.create` / Phase D S5-01); make cost telemetry increment atomic with the billing step. **Files:** `items/service.ts`, `ingest/service.ts`, secrets module, cost-telemetry recording path. **Deps:** rebase w/ E11.

### E11 — Error→HTTP-status mapping
- **Closes:** S5-03 (FK violation → 400), S6-01 (`diff.rows` array-guard → 400), S6-02 (`ItemPolicyError` → 4xx). **Fix:** extend Phase B `mapDomainError`. **Files:** `items/service.ts`, `reconcile/routes.ts`, `reconcile/service.ts`, shared handler. **Deps:** Phase B handler (on main).

### E12 — Methodology-parsing robustness
- **Closes:** S2-02 (gate-side ReDoS twin of S2-01), S3-02 (EOF `indexOf`), SF2-03 (malformed lines silently dropped/retyped) + **SF2-08** (OQ7 pulled — refused/invalid bundle regex → silent skip → wrong belief the rule is active).
- **Concern:** *"Make bundle/gate parsing fail loudly instead of silently dropping or mis-typing rules."*
- **Fix:** gate-side `safe-regex` guard + cap; guard EOF `indexOf`; surface malformed-line and refused-regex as parse warnings, not silent skips. **Files:** `methodology/gates/checks.ts`, `state-machine.ts`, bundle parser. **Deps:** Phase D `safe-regex` (on main).

### E13 — Audit-trail wiring
- **Closes:** SF7-01 (HIGH secrets unaudited), SF7-02 (HIGH settings_json field-loop omission), SF7-03 (updateSettings), SF7-05 (session-path settings_json — completes the 3-of-3 discipline). **Concern:** *"Emit an audit row for every state-mutating path that currently mutates silently."* **Fix:** event-only secrets audit (value excluded per T-D24); add `settings_json` to the field-loop; audit updateSettings + session path. **Files:** secrets module, `projects/service.ts` (+ session path). **Deps:** none.
- **Note:** SF7-04 (chat-no-AI) and SF7-06 (verifier `last_status`) are **not** here — they are audit-trail-only with no operational misbelief, so OQ7 keeps them deferred.

### E14 — Frontend error-surfacing & races
- **Closes:** S8-01/02 (stale-data races), S8-03 (toast unmount), S8-04 (action-error swallow), **SF6-09** (PrBadges success-shaped swallow + backend half `github/routes.ts:43-73`) + OQ7 pulls **SF6-13, SF6-14, SF6-15** (frontend error-swallow — appears empty/healthy on failure; spec author explicitly included all still-open SF6-class) and **SF2-07** (companion `library.attach` swallow asserts success — frontend action + backend surfacing, like SF6-09) + **F8-01** (companion pending/in-progress badge renders red "error" color; text correct — cosmetic bug).
- **Concern:** *"Make frontend failures visible instead of snapping back to a healthy-looking empty/success state."*
- **Current (verified):** `PrBadges.tsx:26` `.catch(()=>setPrs([]))` + lines 40-41 "none tracked" — failure == healthy.
- **Fix:** abort/ignore-stale guards (panel cycle, library search); clear toast timers on unmount; surface swallowed action + load errors; honest-degraded PrBadges (consume E7a poll-health where available, else local error); honest companion-attach failure; correct StepBadge color.
- **Files:** `components/ItemDetailPanel.tsx`, `views/LibraryView.tsx`, toast component(s), `components/DriftInbox.tsx`, `Board.tsx`, `components/PrBadges.tsx`, companion view/components, `components/StepBadge`; backend `github/routes.ts` (error signal), companion attach path.
- **Deps:** soft pattern dep on E7a (PrBadges degraded render). **Halt:** estimate-breach watch (10 findings) — split-fallback peels the OQ7 pulls (SF6-13/14/15 + SF2-07) into a sibling slice if it breaches.

### E15 — Dependency advisory remediation (range-bumps only)
- **Closes:** **W1 partial** — protobufjs (optional `@xenova` chain critical) + in-range vite/esbuild.
- **OQ6 — fastify advisory ACCEPTED:** the fastify v4→v5 major migration is **not** done here and is **not** a Phase E slice; the advisory is formally accepted (a v5 migration is its own future phase). Recorded in the accepted-advisories note (E20 register).
- **Fix:** bump the range-closeable advisories; re-run `pnpm audit`; CI stays green. **Files:** `package.json`/`pnpm-lock.yaml`. **Tests:** the gate is the test.

### E16 — Audit-3 code-fix deltas (classified by principle)
- **Closes (bugs — current behaviour contradicts spec/logic):**

  | Finding | Spec citation | Current behaviour | Verdict |
  |---|---|---|---|
  | **F6-01** | SPEC §7.14: all four drift tiers apply to "a done item" | tiers 1-3 omit the done-item filter tier-4 has → badge non-done items | **BUG** (contradicts §7.14) |
  | **F1-03** | T-D51 + C-D19: `bundle_id_mismatch` is a create/update validation error | enforced on update + CLI, **not** on `POST /api/projects` create | **BUG** (contradicts T-D51) |
  | **F4-04** | C-D12: "Item create/update validate the status against the item type's lifecycle" | per-type transitions parsed but not enforced at create/update | **BUG** (contradicts C-D12) |
  | **SF3-04** | LBD-1 / SF2-01 precedent: a fetch failure must not clear a real signal | per-PR sub-fetch swallow clears tier-1 as passing | **BUG** (silent-clear of real signal) |

- **Reclassified out (OQ5):** **F6-02** (tier-1 path-stem-vs-message-substring) — SPEC/CODE_SPEC are **silent**; only a code comment documents path-stem intent. Code-vs-comment mismatch with no spec mandate = value judgment → **product-decision, moved to E20.**
- **Concern:** *"Fix the audit-3 behaviours that contradict the spec — tier done-item filtering, create-time bundle validation, transition enforcement, and the tier silent-clear."*
- **Files:** `github/tiers.ts` (F6-01, SF3-04), `projects/service.ts` (F1-03, F4-04).
- **Tests:** done-item-filter; create-mismatch-rejected; transition-enforcement; sub-fetch-failure-doesn't-clear.

### E17 — Build: per-entry semantic search (OQ6 build-now)
- **Builds:** F7-03 — §7.8 per-entry semantic search currently returns the permanent stub `{entries:[], via:'semantic-stub'}`. **Class:** feature-build.
- **Scope:** real per-entry semantic search over library entries (reuse the E1 embedder + text-index substrate). **Files:** `library/routes.ts`, library search service, `packages/frontend/src/views/LibraryView.tsx`. **Tests:** semantic-search returns ranked entries. **Deps:** pattern dep on E1 embedder honesty (use the real embedder + honest degraded shape).

### E18 — Build: session-start full input set (OQ6 build-now)
- **Builds:** F4-01 — session-start retrieval omits 2 of 7 declared inputs ("project spec excerpts" + "execution-plan slice for chosen mode"). **Class:** feature-build.
- **Scope:** add the two missing inputs to the context assembly. **Files:** `session-start/engine.ts` (+ any context-source modules). **Tests:** assembled context includes all 7 inputs. **Deps:** rebase coupling w/ E2 (same file; E2's SF2-04 honesty fix lands first or rebases).

### E19 — Build: dump-zone primary-unit re-route (OQ6 build-now)
- **Builds:** F5-04 — §7.3 capture proposal models `target_session_id` re-route but not "different primary unit" re-route (`ProposedItem` has no primary-unit target). **Class:** feature-build.
- **Scope:** add a primary-unit target to the proposal model + apply path. **Files:** dump-zone models + `dump-zone/service.ts`, proposal UI. **Tests:** primary-unit re-route proposes + applies. **Deps:** none.

### E20 — Audit-3 spec reconciliation & residual register (doc + small spec edits)
- **Class:** spec-reconciliation (doc-only + targeted SPEC amendments).
- **Descopes — formalize as marked-in-spec (OQ6):** amend SPEC so it stops claiming what won't be built, closing the spec-vs-shipped gap by correcting the spec:
  - **F5-02** tree drag-drop-retag (§7.11) → mark descoped.
  - **F7-01** §7.20 multi-list + AI consolidation export → mark descoped.
  - **F7-06** §7.24 full command-palette surface → mark the unbuilt targets/actions descoped (keep the shipped subset).
  - **F7-07** §7.24 list keyboard nav → mark descoped.
- **Schedules — Phase G (or later) register (OQ6):** F5-01 (tree grouping: remaining 3 of 5 dimensions), F5-03 (item-detail verifier-rules + git-context sections), F7-02 (§7.21 mermaid generation).
- **Decisions surfaced (spec silent / value judgment):** **F6-02** (tier-1 match: ratify path-stem-as-spec vs accept message-substring), **F1-02** (re-init audit: single `project_reinit` row vs per-field — needs a spec call on the intended semantic), **F7-04** (§7.22 audit log declared "searchable by time range, actor, or trigger type"; `/api/audit` accepts only `entity_type`/`entity_id`/`project_id`/`limit` — build the three filters vs descope the §7.22 claim).
- **Residual audit-3 minors, tagged (non-blocking micro-triage):** F1-04 (`/health` vs `/api/health` — spec-staleness doc-fix), F1-05/F1-06 (`InitConfigError` union / `cli/init` structure — minor), F2-01 (validator silently ignores excluded fields — validation-semantic decision), F2-02 (`merge_fields` — already v1-carved-out), F3-01 (scan-on-demand gate layer — spec-delta decision), F3-02 (no on-bind scan trigger — missing-feature decision), F4-02 (gate concurrency/ordering unimpl — decision), F4-03 (C-D4 illustrative stubs — decision), F5-05 (undeclared "Intelligence" 10th view — accept-or-document), F7-05 (voice capture is click-toggle not hold-to-talk; no overlay destination toggle — incomplete-feature decision).
- **Accepted-advisories note:** fastify advisory accepted (OQ6); fastify v5 migration is a future phase. **W3** (CI required status check) is **owner-handled directly**, out of plan scope (noted for the record).
- **Files:** `SPEC.md` (descope marks), this plan's registers / handover. **Tests:** none.

### E21 — Closure-verification appendix + verification tests
- **Documents (already-closed):** S5-02 (verified on main: all four former `resolveBundle` omission sites now call `resolveProjectBundle(registry, project)`), SF4-04 (=S5-01, Phase D), I6-01/02/03 (Phase D tests) + any incidental closure surfaced during E1–E19.
- **Deliverable:** appendix with code evidence per closure; one verification test only where a lock is missing. **Files:** docs + `test/...` if needed. **Deps:** runs last.

---

## Schedule register — Phase G (or later)

Scheduled by spec-author triage (OQ6), not deferred-as-low: these are genuine feature builds the
spec author chose to **schedule** rather than build in Phase E.

- **F5-01** — tree grouping: build the remaining 3 of 5 declared dimensions (session, primary-unit, blocker).
- **F5-03** — item-detail panel: build the verifier-rules (pass/fail from latest Actions run) + git-context (PR/commit/branch) sections.
- **F7-02** — §7.21 mermaid generation (`.mmd`/SVG generator).

## Deferred-tail register (Phase F seed — NOT executed)

Per the in-session decision (defer-the-tail = quality-of-implementation, not silent-failure):

- **Audit-4 Lows kept deferred (OQ7 — audit-trail-only, no wrong-belief-about-state):** **SF7-04**
  (chat-no-AI unaudited) and **SF7-06** (verifier `last_status` unaudited). *Why acceptable to defer:*
  both leave a forensic-trail gap only — neither makes the user believe a wrong *operational* state;
  contrast SF7-05, which completes an active audit-discipline and so was pulled into E13.
  *(SF2-07/08, SF4-05/06, SF5-07/09/10, SF6-13/14/15 were pulled into the chain — they each produce
  a wrong belief about state.)*
- **Audit-5 improvement refactors (dedup, not silent-failure — explicitly deferred):** I5-04
  (`recordAiCost` shared), I5-05 (AI/heuristic router shared), I1-seg1 (project-digest dedup),
  I4-B01 (React.lazy split), I2-01, I2-03, I3-05, I3-03, I2-02, I3-02, I3-04, I3-06..08, I2-04..07.
- **Audit-5 a11y:** I4-A01..A08, I4-R01..R07, I4-A05.
- **Audit-5 bundle/font:** I4-B02..B06. **Audit-5 type-safety:** I7-01..05.
- **Audit-1 "accept"-marked informationals:** I2–I9. **Audit-2 accept:** S1-04.

## Bug / build / decision / already-closed split (explicit)

- **Bug-fix slices (code + paired test):** E1–E16 (E7a/b, E9a/b counted) = **18 slices.**
- **Feature-build slices (OQ6 build-now):** E17, E18, E19 = **3 slices.**
- **Spec-reconciliation / decision (doc + spec edits):** E20 = **1 slice.**
- **Already-closed (doc + verify-test):** E21 = **1 slice.**
- **Scheduled (Phase G register, not slices):** F5-01, F5-03, F7-02.
- **Deferred (Phase F register, not slices):** the tail above.

## Tracking issue (ready — not opened by this session)

- **Title:** `Auto-continue: phase-e-full-audit-close`
- **Body:** chain plan path, chain-state file `.claude-code/auto-continue-state.json`, roster E1–E21,
  kill-switch signals, per-merge progress log. **Open it** at chain-open (Session 3 start).

## Verification (Session 3)

Per slice: three-layer gate (Gitar + CI `pnpm -r typecheck/test/lint/build` + GitHub-mergeable) →
merge-commit → next slice off updated main. Discrete-audit-after-merge per finding. Chain close:
every closed finding has a regression test; T-D60 in `SPEC.md §14`; C-D25 + C-D26 in `CODE_SPEC.md`;
SPEC descope marks landed; `PLATFORM_STATUS.md` rolled; handover per PR; halt-class extensions 4–8
absorbed into `AUTO_CONTINUE_WORKFLOW.md` by the cohort hardener (OQ4); Phase G + Phase F registers
carried forward; tracking issue closed.

## Spec-author triage decisions (resolved 2026-05-30)

- **OQ1 — Yes:** add `embedder`/capability fields to shared wire-contract response types (T-D59 intent; no side-channel).
- **OQ2 — In-context, per-subsystem:** one shared C-D25 component, rendered beside each feature; no consolidated health dashboard.
- **OQ3 — Distinct anchor (C-D26):** frontend rendering vs backend data model are different layers.
- **OQ4 — Hardener at chain close:** Phase E runs under halt-extensions 4–8 as operating practice; the cohort hardener absorbs them into the canonical doc (avoids recursive doc-PR collision).
- **OQ5 — Re-classified by principle:** E16 bugs = F6-01, F1-03, F4-04, SF3-04 (each contradicts a cited spec/decision); F6-02 → product-decision (spec silent) → E20.
- **OQ6 — Build F7-03/F4-01/F5-04 (E17–E19); descope F5-02/F7-01/F7-06/F7-07 (spec marks); schedule F5-01/F5-03/F7-02 (Phase G); accept the fastify advisory; W3 owner-handled.**
- **OQ7 — Pull the wrong-belief-about-state Lows** (SF2-07/08, SF4-05/06, SF5-07/09/10, SF6-13/14/15) into the chain; keep audit-trail-only Lows (SF7-04/06) and dedup (I5-04/05) deferred.

**Residual (non-blocking, for E20 micro-triage):** F6-02 and F1-02 decisions + the tagged audit-3
minors. None blocks chain-open.
