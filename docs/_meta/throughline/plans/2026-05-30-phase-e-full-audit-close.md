# Phase E — Full Audit-Fix Close: Implementation Plan

- **Date:** 2026-05-30
- **Author session:** Phase E planning — independent track (branch `claude/hopeful-carson-aX0Uw`)
- **Status: revised (rev 3) per spec-author triage 2026-05-30 — prior markers VOIDED, awaiting Session-2 re-audit of changed regions.** The prior planner final-marker (`86415e7`) and the auditor's prior approval are superseded: the LBD-1..5 rulings, the halt-class 4–9 bless, the §7.10 clause, and the E17a split changed required plan content. All five LBDs now encoded as settled; audit-ID set-diff gate held (0 dropped). Fresh planner final-marker follows; Session 2 re-audits the changed regions before re-approving. *Draft→ready conversion remains the overseer session's gate.*
- **Scope:** every still-open finding across committed audits 1–5 (`docs/_meta/throughline/audits/`).
- **Chain shape:** one PR per slice — the canonical `AUTO_CONTINUE_WORKFLOW.md` rhythm (Premise "a slice = one PR"; the 9c sharpening absorbed in PR #82). Rationale specific to this chain: high rollback-value (a bad silent-failure fix is itself a silent regression, across diverse subsystems); cleaner discrete-audit-after-merge per finding; per-PR Gitar attention against a specific change.
- **Source of truth:** the five committed audit reports + synthesis, **re-verified against current `main`** by this session (file:line evidence cited per slice). Verification diverged from the audit text in three load-bearing places — see *Verification divergences* below.

> **Provenance note.** A parallel planning track exists at **PR #84** (branch `claude/gifted-meitner-chJQE`), same title/path, already through a Session-2 audit loop. This artifact is an **independent plan authored on the assigned branch at the spec author's explicit direction** (deliberate parallel-comparison stress-test of the three-session pipeline). It is grounded in this session's own code verification, not copied from #84; where the two diverge, the divergences are called out so the spec author can compare. The doc-PR collision is accepted by spec-author decision, not overlooked.

---

## Verification divergences (read first — independent re-verification vs the 2026-05-28 audit text)

Three findings the audit text records as open were re-checked against current `main` and found materially different. Each changes a slice's class:

1. **SF1-01 (quarantine-invisible) — mostly incidentally closed; only a narrow residual is open.** The audit text says "only `.error.json` is written; `countOutputs` excludes it → `quarantineCount` stays 0." Current `bootstrap/worker.ts:103-127` writes the `.error.json` **and** copies the original `${stamp}-bootstrap-output.json` into the quarantine dir; `countOutputs` (`worker.ts:290-294`, `endsWith('-bootstrap-output.json')`) **does** count that copy. So the *common* quarantine path is now surfaced and the `SettingsView` `quarantineCount > 0` alert fires. The **only residual** is the copy-*failure* branch (`worker.ts:113-124`): when `copyFileSync` throws, just the `.error.json` remains, which `countOutputs` still excludes → that one file stays invisible. **Reclass:** SF1-01 is *verify-mostly-closed* with a small residual fix, **not** a full CRITICAL bug. (PR #84's E5 treats it as a full still-open CRITICAL — an over-classification.)

2. **S6-02 (reconcile `ItemPolicyError` → 500) — effectively closed by the Phase-B central handler.** `reconcile/routes.ts` no longer hand-maps a 4-error subset; `service.apply` throws now propagate to the Fastify `setErrorHandler` (`http/error-handler.ts:14-31`), which maps any `DomainError` (incl. `ItemPolicyError`) to its canonical status. **Reclass:** *verify-already-closed* + a regression test; only **S6-01** (`diff.rows` non-array → `TypeError`, a *non*-`DomainError` → 500) and **S5-03** (FK violation → non-`DomainError` → 500) remain genuine error-mapping bugs.

3. **S7-03 (scheduler stop doesn't await in-flight) — half closed.** `github/poller.ts` is drained at shutdown (`server.ts` awaits `githubPoller.drain()`). The residual is only **`backup/scheduler.ts`** and **`directives/scheduler.ts`**, whose `stop()` clears the timer with no drain/await. **Reclass:** scope S7-03 to those two schedulers; the poller is done.

These divergences are exactly why the brief mandates *verify-before-write*: the plan's class assignments follow current code, not the (now-stale-in-places) audit text.

---

## How findings are dispositioned (the classification rule)

Every open finding lands in exactly one bucket. **The rule is applied; the bucket falls out of it — not the reverse:**

| Bucket | Test | Handling |
|---|---|---|
| **bug-fix** | Current behaviour contradicts what the spec **says** or **logically requires** (incl. "a failure masquerades as a healthy/empty state" — a trust violation the product implicitly forbids). | Code **+ paired regression test, same slice.** |
| **product-decision** | The spec is **silent**, or the choice is a **value judgment** (build-vs-descope-vs-schedule; accept-vs-remediate). | A slice that **surfaces the decision** for the spec author. **No choice is baked in.** |
| **verify-already-closed** | Incidentally closed by Phase A–D work (or by current-`main` state the audit text predates). | Doc slice recording the closure **with code evidence**; a verification test only where a regression *lock* is missing. |
| **deferred-tail** | Quality-of-implementation (dedup, perf, a11y, bundle) or audit-trail-only gaps with **no wrong-belief-about-state**. | A named **register** (not slices); surfaced for spec-author triage, **not silently dropped**. |

**Discipline note (per brief + `SESSION_START.md`):** this session does **not** pre-resolve product decisions. Where the brief reports a decision the spec author already made (the SF3-01 split-by-cause posture), it is recorded as *given*; every other decision is left **open** in *Decisions for the spec author* and the dependent slices are marked decision-gated. Decisions are encoded as **plan revisions** after the spec author rules — not as the planner's own choices. (This is the principal structural difference from PR #84, which baked a full OQ1–OQ7 triage into the plan.)

---

## Verified prior-phase closures (excluded — do NOT re-plan)

Confirmed against current `main` this session:

- **Phase A:** F1 (dist-runtime → C-D22 dual-condition exports), I1 (backend `test/**` typecheck → `tsconfig.test.json`), W2 (Node pin → root `engines.node ">=22"`), W4 (RR v7 flags).
- **Phase B:** I5-01 / I5-02 / I5-03 (shared `DomainError` hierarchy + central `setErrorHandler`/`mapDomainError` + `resolveProjectBundle`); F1-01 structural closure (T-D51 amendment makes `repo_path` non-omittable).
- **Phase C:** SF6-01/02 + SF6-03..08/10/11/12 (data-hook `error` surfaced via `useResource`/`usePolledResource` + `<LoadError>`; verified `useDirectives.ts:38`, `useDriftInbox.ts:34`, consumers render `<LoadError>`); I3-01 (`useResource` extraction). **SF6-09 backend half deliberately skipped** in Phase C → carried here (E15).
- **Phase D:** I1 Gap 2 / T-D59 (wire-contract types), S2-01 (ReDoS guard), SF2-01 (scanner-throw no longer dismisses signals), S5-01 (dump-zone atomic apply), S4-01 (drift dismissal scoped by category+item), S7-01 (shutdown ordering + poller drain), F1-01 arm-2 lock, + 7 paired regression tests.

W3 (CI required status check) is recorded **done** in `PLATFORM_STATUS.md` Queued Work (`gate` is a required check on `main`) — owner-handled repo-admin, out of plan scope.

---

## Open-finding inventory (surveyed against current `main`)

Each row: audit ID · original severity · current behaviour (file:line) · open/closed · class. Bug-fix rows route to a slice; product-decision rows route to **E17**; already-closed rows to **E18**; deferred rows to the register.

### Audit 4 — silent failures

| ID | Sev | Current behaviour (verified file:line) | State | Class → slice |
|---|---|---|---|---|
| SF3-01 | Crit | `intelligence/embeddings.ts:101-112` bare `catch` pins SHA1 fallback; `RagQueryResult` (`shared/src/intelligence.ts:29-39`) has no `embedder` field (only `RagReindexResult:41-46` does) → garbage citations indistinguishable from real. | open | bug → **E1** |
| SF5-03 | Crit | `notifier/index.ts:36-66` no-op `notify()` always resolves; `notifier/routes.ts:15-29` test button returns `{ok:true}` + sets `os_notifications_enabled=true`; `directives` `markFired` runs as "delivered". | open | bug → **E4** |
| SF1-01 | Crit | **Mostly closed** — `countOutputs` (`worker.ts:294`) now counts the quarantine copy; alert fires. **Residual:** copy-*failure* branch (`worker.ts:113-124`) leaves only `.error.json`, still uncounted. | residual | bug (residual) → **E7**; bulk → **E18** |
| SF3-02 | High | `intelligence/text-index.ts:235` `if (!qv) return []` — embed-failure reads as "no matches". | open | bug → **E1** |
| SF4-01 | High | `semble/client.ts:149` `catch { return [] }`; `available()` returns `true` on any non-ENOENT failure (`:130`) → "search worked, nothing here" on crash. | open | bug → **E3** |
| SF2-02 | High | `methodology/gates/runtime.ts:159-169` returns empty `GateFiring[]` when `loaded.status !== 'loaded'`; no per-project bundle-health field anywhere → post-bind bundle break == legit freeform. | open | bug → **E6** |
| SF2-06 | Med | `/api/methodologies` lists only the install cache → external/per-repo bundle errors invisible. | open | bug → **E6** |
| SF5-01/02/04 | High | `backup/scheduler.ts:54-58`, `directives/scheduler.ts:84-88`, `github/poller.ts:239-241` catch-and-log only; no health/state field. | open | bug → **E5** |
| SF5-05/06 | Med | watcher `enqueue` throw drops the file/output; chokidar swallows. | open | bug → **E9** |
| SF5-08 | Med | loader `on('all')` handler unguarded (the only watch site with no try/catch). | open | bug → **E9** |
| SF5-11 | Med | SSE ping write unguarded; **no global `unhandledRejection`/`uncaughtException` handler**. | open | bug → **E8** |
| SF3-03 | Med | chat misattributes a failed AI call as "no key configured". | open | bug → **E2** |
| SF2-03 | Med | malformed gate/category lines silently dropped or retyped to the wrong scanner; bundle loads green. | open | bug → **E13** |
| SF2-04 | Med | session-start unparseable AI → all-`medium` but reports `classifier_used_ai:true`. | open | bug → **E2** |
| SF2-05 | Med | install-shipped `bundle.md` unlink: no `notifyReloaded`, no log (= S3-01 family). | open | bug → **E9** |
| SF4-02 | Med | md-ingest summariser AI-failure carries no `extractor_note` (unlike reconcile/dump-zone twins). | open | bug → **E2** |
| SF4-03 | Med | md-ingest `skipped[]` conflates too-large / unreadable / deleted. | open | bug → **E2** |
| SF7-01 | High | `secrets/routes.ts:12-22` + `secrets/store.ts:27-38` — credential set/clear/rotate emits **no** `appendAudit` row. | open | bug → **E14** |
| SF7-02 | High | `routes/communication-model.ts:89` updates `settings_json` silently; `projects/service.ts:313-333` field-loop omits `settings_json`. | open | bug → **E14** |
| SF7-03 | Med | `projects.updateSettings` generic path unaudited. | open | bug → **E14** |
| SF6-09 | Med | `PrBadges.tsx:26` `.catch(()=>setPrs([]))` + "none tracked" — degrades gracefully but failure renders as healthy-empty; backend half `github/routes.ts:43-73`. | open (Phase-C-skipped) | bug → **E15** |
| SF7-05 | Low | session-path `settings_json` unaudited (completes the 3-of-3 `settings_json` discipline with SF7-02/03). | open | bug → **E14** |
| SF7-04, SF7-06 | Low | chat-no-AI / verifier `last_status` unaudited — **audit-trail-only, no operational misbelief**. | open | deferred-tail |
| SF1-02 | High | startup-scan/chokidar arm TOCTOU restart-data-loss (`bootstrap/watcher.ts`). | open | bug → **E7** |
| SF1-03 | Low | `quarantineCount` under-reports on a quarantine **copy-failure** — the audit-4 Low that *is* the SF1-01 copy-failure residual (audit-2 twin: S1-03). Not a generic wrong-belief Low; it's the same residual E7 fixes. | open | bug → **E7** (closure → E18) |
| SF2-07/08, SF3-04, SF4-05/06, SF6-13/14/15 | Low | wrong-belief-about-state lows (companion attach asserts success; refused regex silent skip; sub-fetch clears tier-1; cost under-count; frontend swallows). | open | **product-decision (pull-in?)** → **E17** decision item |

### Audit 2 — bugs (open subset; the 6 High and several Med were closed in Phases B/D)

| ID | Sev | Current behaviour (verified) | State | Class → slice |
|---|---|---|---|---|
| S7-02 | High | `routes/events.ts:44-84` `reply.hijack()`; ping `setInterval` not `unref`'d; `app.close()` never ends hijacked sockets. | open | bug → **E8** |
| S2-02 | Med | `methodology/gates/checks.ts:153-179` raw `new RegExp(bundle…format_regex)` + un-escaped vocab interpolation, no `safe-regex` guard (the unhardened twin of the now-fixed S2-01). | open | bug → **E13** |
| S1-01 | Med | `bootstrap/worker.ts:69-70` 1-second-resolution timestamp → two ingests/second collide. | open | bug → **E7** |
| S1-03 | Low | `quarantineCount` under-reports on copy-failure — the audit-2 twin of the SF1-01 residual (= audit-4 SF1-03). | open | bug → **E7** (closure → E18) |
| S1-02 | Med | watcher TOCTOU (= SF1-02). | open | bug → **E7** |
| S3-01 | Med | `methodology/loader.ts:293-335` no `notifyReloaded` on arm-1/arm-3 bundle deletion (arm-2 only). | open | bug → **E9** |
| S3-03 | Low | loader `discoverBundleIds` `statSync` throws on dangling symlink → aborts startup hydration. | open | bug → **E9** |
| S4-02 | Med | `github/poller.ts:147-223` persists list ETag before snapshot upserts → mid-loop throw leaves ETag ahead → permanent 304/stale. | open | bug → **E10** |
| S4-03 | Med | `intelligence/embeddings.ts` runtime extractor throw (post-resolution) unhandled → crashes RAG (fallback only covers import). | open | bug → **E1** |
| S5-03 | Med | `items/service.ts:540-543` `INSERT OR IGNORE` doesn't suppress FK violation → 500 not 400. | open | bug → **E12** |
| S5-04 | Med | `items/service.ts:561-688` `update` not transactional though `create` is. | open | bug → **E11** |
| S5-05 | Med | `directives/service.ts:373-380` recurrence advances one interval/fire → catch-up storm after downtime. | open | bug → **E10** |
| S6-01 | Med | `reconcile/service.ts:241` no `Array.isArray(diff.rows)` guard → `TypeError` → 500. | open | bug → **E12** |
| S6-02 | Med | reconcile `ItemPolicyError` — **now caught by central handler**; route-layer fragile. | mostly closed | verify → **E18** |
| S6-03 | Low | md-ingest batch loop non-atomic (`md-ingest/` service exists). | open | bug → **E11** |
| S6-04 | Low | secrets read-modify-write non-atomic (single-user → rare). | open | bug → **E11** |
| S7-03 | Med | **poller drained**; residual `backup/scheduler.ts` + `directives/scheduler.ts` `stop()` don't await. | half-open | bug → **E8** |
| S8-01 | Med | `components/ItemDetailPanel.tsx:67-104` sibling-cycle refresh, 6 awaits, no abort flag → stale overwrite. | open | bug → **E15** |
| S8-02 | Med | `views/LibraryView.tsx:88-118` debounce clears timer not in-flight request → stale results. | open | bug → **E15** |
| S8-03 | Low | toast `setTimeout` not cleared → setState-after-unmount. | open | bug → **E15** |
| S8-04 | Low | DriftInbox/Board action errors swallowed → silent no-op. | open | bug → **E15** |
| S1-04, S3-02 | Low/accept | re-import bump within T-D54 spirit; `state-machine.ts:37` EOF `indexOf`. | S3-02 open / S1-04 accept | S3-02 → **E13**; S1-04 → deferred |

### Audit 3 — functional-correctness deltas

| ID | Sev | Spec basis / current behaviour | State | Class → slice |
|---|---|---|---|---|
| F6-01 | Major | SPEC §7.14 — all four drift tiers apply to a *done* item; `github/tiers.ts` tiers 1-3 omit the done-item filter `tier4.ts:82-85` enforces → badges non-done items. **Contradicts spec.** | open | **bug → E16** |
| F1-03 | Major→Mod | T-D51 / C-D19 — `bundle_id_mismatch` is a create/update validation error; `projects/routes.ts:48-77` `POST` omits it (enforced on update + CLI only). **Contradicts spec.** | open | **bug → E16** |
| F4-04 | Minor | C-D12 — create/update validate status against the type's lifecycle; per-type transitions parsed but not enforced. **Contradicts C-D12.** | open | **bug → E16** |
| SF3-04 | Low | refuse-rather-than-fallback / SF2-01 precedent — per-PR sub-fetch swallow clears tier-1 as passing (silent-clear of a real signal). | open | **bug → E16** |
| F1-01 | Major | wrong methodology bundle. | **closed** (Phase B/D) | verify → **E18** |
| F1-02 | Mod | re-init emits per-field audit rows, no `project_reinit` kind (`projects/service.ts:313-333`). Spec semantic intent is a **value judgment** (single-row vs per-field). | open | decision → **E17** |
| F3-01 | Mod | T-D57 scan gate at the periodic-review layer (`intelligence/periodic-review.ts:96-146`), not the drift-inbox/scanner layer. **§7.14-vs-T-D57 ambiguity** (audit-3 flagged it). | open | decision → **E17** |
| F4-01 | Mod | session-start omits 2 of 7 inputs (`session-start/engine.ts:196-246`): project-spec excerpts + execution-plan slice. Build-or-descope. | open | decision → **E17** |
| F5-01 | Major | tree grouping ships 3 of 5 dims (`TreeView.tsx:10`). | open | decision → **E17** |
| F5-02 | Major | tree drag-drop-retag absent. | open | decision → **E17** |
| F5-03 | Major | item-detail omits verifier-rules + git-context (`ItemDetailPanel.tsx:691` "Phase 10" placeholder). | open | decision → **E17** |
| F5-04 | Mod | dump-zone proposal has no primary-unit re-route (`shared/src/capture.ts:25`). | open | decision → **E17** |
| F6-02 | Minor | tier-1 path-stem match documented (code comment) but message-substring used; **spec silent** → value judgment. | open | decision → **E17** |
| F7-01 | Major* | §7.20 multi-list + AI consolidation export unimplemented (only `/api/backup/export`). | open | decision → **E17** |
| F7-02 | Major* | §7.21 mermaid generation unimplemented. | open | decision → **E17** |
| F7-03 | Mod | §7.8 per-entry semantic search returns stub (`library/routes.ts:202-212`). | open | decision → **E17** |
| F7-04 | Mod | §7.22 audit-log filters (time-range/actor/trigger-type) missing (`audit/routes.ts:36-66`). | open | decision → **E17** |
| F7-06 | Major* | §7.24 command palette partial (`CommandPalette.tsx:40-86`). | open | decision → **E17** |
| F7-07 | Mod | §7.24 list keyboard nav not bound (`TreeView.tsx`). | open | decision → **E17** |
| F1-04/05/06, F2-01/02, F3-02, F4-02/03, F5-05, F7-05, F8-01 | Minor | spec-staleness + small deltas (see E17 minors register). | open | decision/minor → **E17** |

\* roadmap-scope caveat per audit-3's boxed note — spec-author's bucket call.

### Audit 1 — build readiness

| ID | Current state (verified) | Class → slice |
|---|---|---|
| W1 | `fastify ^4.27.0` (advisory wants v5 major); `@xenova/transformers ^2.17.2` present (optional-chain criticals). Root `engines.node ">=22"`, no `.nvmrc`. | decision → **E17** (accept-vs-schedule fastify major; range-bumps are a small optional remediation) |
| I2 | `shared` test = `echo 'no tests' && exit 0`; zero test files. | deferred-tail |
| I8 | `ci.yml` has no `concurrency` / `timeout-minutes`. | deferred-tail (optional cheap hardening) |
| I3..I9 | accept-by-design (resolved-by-F1 / drift / conventional). | deferred-tail |

### Audit 5 — improvements (all quality-of-implementation → deferred register)

I1-seg1 (project-digest dedup), I5-04 (`recordAiCost`), I5-05 (AI/heuristic router), I4-B01 (`React.lazy` split), I4-B02..B06 (fonts/chunks/sourcemap), I2-01 (`tiers.ts` N+1), I2-03 (md-ingest N+1), I3-03 (IntelligenceView shared-busy), I3-05 (panel serial awaits — same site as S8-01; the *race* is fixed in E15, the `Promise.all` perf is deferred), I7-02 (typed `Settings` schema), I4-A01..A08 + I4-R01..R07 (a11y static + runtime), and the Low extraction/perf tail. None is a silent failure; all deferred to the **Phase F seed register**.

---

## Decisions from the spec author (RESOLVED 2026-05-30 — settled, not open)

These were load-bearing open questions; the spec author has now **ruled on all five** (relayed via Session 3 / direct engagement, 2026-05-30). They are encoded here as settled resolutions and threaded into the affected slices. *(Both the prior planner final-marker `86415e7` and the auditor's prior approval are **voided** by these rulings — they change required plan content; fresh markers follow this revision, and Session 2 re-audits the changed regions before re-approving.)*

**LBD-1 — Refuse-rather-than-fallback: reach + wire-shape — RESOLVED.**
- **(a) Reach: BROAD.** T-D60 applies across the **entire dishonest-degradation pattern**, not just RAG. Minted **once** in E1 and **cited downstream** by E2/E3/E4 (and retro-anchors the Phase-D SF2-01 drift-side precedent). No narrow-to-RAG scoping.
- **(b) Wire-shape: ON the shared wire-contract types**, extending T-D59. Capability/`embedder` fields are added to the `@throughline/shared` response types; **side-channel metadata is rejected** (it defeats T-D59's "the contract expresses truth" intent).
- **(c) C-D2 reframe: T-D60 SUPERSEDES the offline-fallback sanction.** C-D2 is **narrowed to "capability-absent honest-distinct mode" only**; the offline *silent* fallback is **removed**. This is a real **C-D2 amendment** — landed cleanly in E1 with the spec-amendment markdown (amend the C-D2 body in `CODE_SPEC.md`; T-D60 in `DECISIONS.md`/`SPEC.md §14` records the superseding principle).

→ Mints **T-D60** in **E1** (accepted). Broad reach; on-contract wire-shape; C-D2 amended.

**LBD-2 — System-state visibility surface — RESOLVED.**
**One shared component**, rendered **per-subsystem in-context** (beside each feature it concerns — *not* a consolidated "system health" panel). Tri-state vocabulary: **healthy / degraded / absent**. → Mints **C-D25** in the first visibility slice (**E6**), reused by E5/E7.

**LBD-3 — Background-job health: distinct anchor — RESOLVED.**
**Distinct C-D26** (backend data model `lastRunAt`/`lastError`/`healthy` per loop) — kept separate from the C-D25 frontend convention; the two layers have independent evolution pressure. → Mints **C-D26** in **E5**.

**LBD-4 — Audit-3 product-decision posture — RESOLVED: stays a mid-chain gate at E17.**
The audit-3 build/descope/schedule batch is **not** ruled pre-seed; it remains an explicit **mid-chain decision gate at E17** where the spec author rules and any "build" rulings append new slices. (Confirms the Finding-3 precondition split: LBD-1/2/3/5 pre-seed; LBD-4 mid-chain.) This gate is **named in the halt-class bless (halt-9)** below, per the auditor flag.

**LBD-5 — W1 fastify v5 — RESOLVED: accept the advisory.**
The fastify v5 advisory is **accepted**; the v5 migration is **its own future phase**, not a Phase E slice. The in-range **protobufjs / vite / esbuild bumps remain as a small remediation slice (E17a)** — see roster. Surfaced + recorded in E17's accepted-advisories register.

---

## Anchor-minting plan

| Anchor | Slice | Topic | Status |
|---|---|---|---|
| **T-D60** | E1 | Refuse-rather-than-fallback principle (split-by-cause; **broad reach**; supersedes the C-D2 offline-fallback sanction) | **accepted** — mint in E1 |
| **C-D25** | E6 | System-state visibility frontend pattern (one shared component, `ResourceState` tri-state healthy/degraded/absent, in-context) | **accepted** — mint in E6 |
| **C-D26** | E5 | Background-job health-state backend model (`lastRunAt`/`lastError`/`healthy`) — distinct from C-D25 | **accepted** — mint in E5 |

T-D59 / C-D24 are the live highest (verified `DECISIONS.md`, `CODE_SPEC.md:9` "59 entries"). T-D60 / C-D25 / C-D26 are free. **All three are spec-author-accepted (2026-05-30)** as working-note proposals and are minted in their gating slices (E1 / E6 / E5). E1 additionally lands the **C-D2 amendment** (narrowing it to capability-absent honest-distinct mode; the offline silent fallback removed — T-D60 supersedes). **Any anchor needed beyond these three trips halt-class 5 (unplanned anchor).**

---

## Halt classes for this chain

**Standard three** (codified in `AUTO_CONTINUE_WORKFLOW.md`): spec drift; circuit breaker (3 fix-rounds on one finding); explicit user pause (marker file / `/pause` comment).

**Six extensions — SPEC-AUTHOR-BLESSED (2026-05-30) as sanctioned operating practice for this chain:** (4) **estimate breach** — a slice's actual diff exceeds its LOC band by >50% → halt, re-slice; (5) **unplanned anchor** — a slice needs a T-D/C-D beyond the three planned → halt, surface; (6) **test regression** — a slice reds a previously-green test it didn't intend to touch → halt; (7) **doc-PR collision** — `main` carries an open PR touching a rolling shared doc at a slice boundary → halt (the very condition this planning session hit against PR #84); (8) **out-of-audit silent-failure** — a silent-failure pattern outside audits 1–5 surfaced mid-slice → flag it for the *next* audit cycle, do **not** expand the slice to absorb it; (9) **E17 product-decision gate** — the chain **halts at E17** for the spec author to rule the audit-3 build/descope/schedule batch (LBD-4); any "build" rulings append new slices. (9) is a *planned* decision-halt, named here per the auditor flag so it sits in the same blessed set rather than reading as an ad-hoc stop.

> **Provenance + codification note.** Extensions 4–9 were *proposed by this planning track* (the repo's canonical doc codifies only three + an "only legitimate reasons" clause; a grep of handovers/process-docs for these classes returned empty; PR #82 records only the spec-drift class firing). The spec author has now **blessed 4–9 as sanctioned operating practice before chain-open** — so the chain no longer runs under uncodified rules that contradict the canonical doc; the bless *is* the authority. **`AUTO_CONTINUE_WORKFLOW.md` codification is deferred to the chain-close cohort hardener** (not now): editing the workflow doc *while the chain runs against it* is the recursive doc-PR-collision problem, so the hardener absorbs 4–9 into the canonical doc at close — the same pattern by which Phases A–D's process findings landed in PR #82. (This is the one place "evidence over instruction" corrected the brief's "Phase C+D extensions" framing; now resolved by an explicit bless rather than an inherited-practice claim.)

---

## Slice roster (16 bug-fix + 1 dep-remediation + 1 decision + 1 closure = 19 slices, floor)

| # | Slice | Class | Findings closed/surfaced | Anchor | Est. LOC |
|---|---|---|---|---|---|
| E1 | RAG embedder & query honesty + C-D2 amendment | bug | SF3-01, SF3-02, S4-03 | T-D60 (+ C-D2 amend) | 140–200 |
| E2 | AI/capability degradation honesty | bug | SF3-03, SF2-04, SF4-02, SF4-03 | (cites T-D60) | 160–230 |
| E3 | Semble degradation honesty | bug | SF4-01 | (cites T-D60) | 70–110 |
| E4 | Notifier capability honesty | bug | SF5-03 | (cites T-D60) | 100–150 |
| E5 | Background-job health model | bug | SF5-01, SF5-02, SF5-04 | C-D26 | 150–210 |
| E6 | Bundle-health visibility | bug | SF2-02, SF2-06 | C-D25 | 150–210 |
| E7 | Bootstrap worker/watcher robustness | bug | SF1-01 (residual), S1-01, S1-02/SF1-02, SF5-05, SF5-06 | (uses C-D25) | 130–190 |
| E8 | Shutdown lifecycle completion | bug | S7-02, SF5-11, S7-03 (backup+directives) | — | 120–170 |
| E9 | Loader robustness | bug | S3-01/SF2-05, S3-03, SF5-08 | — | 80–130 |
| E10 | Background-loop correctness | bug | S4-02, S5-05 | — | 90–140 |
| E11 | Transaction atomicity | bug | S5-04, S6-03, S6-04 | — | 120–180 |
| E12 | Error→HTTP-status mapping | bug | S5-03, S6-01 | — | 70–110 |
| E13 | Methodology-parsing robustness | bug | S2-02, S3-02, SF2-03 | — | 130–190 |
| E14 | Audit-trail wiring | bug | SF7-01, SF7-02, SF7-03, SF7-05 | — | 110–160 |
| E15 | Frontend races & error surfacing | bug | S8-01, S8-02, S8-03, S8-04, SF6-09 | — | 170–240 |
| E16 | Audit-3 spec-contradiction bugs | bug | F6-01, F1-03, F4-04, SF3-04 | — | 130–190 |
| E17a | Dependency range-bump remediation | bug (dep) | W1 partial (protobufjs / vite / esbuild in-range bumps; **fastify v5 accepted, not here**) | — | 30–70 |
| E17 | Product-decision triage (surface only; **blessed decision-gate**) | product-decision | F-cluster + audit-4 wrong-belief Lows + W1 fastify-accept note + minors | — | doc + targeted spec edits |
| E18 | Closure-verification appendix | verify-already-closed | SF1-01 bulk, S6-02, F1-01/S5-02, SF6-01..12, Phase-D locks | — | doc + verify tests |

**Chain total:** ~2,050–2,970 LOC across 17 code/test slices + 2 doc slices. **Calendar ~15–20 working days (~3–4 weeks).** **Sizing honesty (Session-2 Finding 3):** the brief's "12–20 envelope" budgets *slices*. **19 is a floor, not the committed total** — decision-pending on LBD-4 (resolved as a mid-chain gate). LBD-4 (the E17 product-decision batch) is *different in kind* from LBD-1/2/3/5: those *unblocked planned slices* (now ruled); LBD-4 *spawns new ones*. If LBD-4 yields any "build" rulings at E17, each chosen build is appended as a new slice, so the committed roster is `19 + N(builds)` and may breach 20. That N is **knowable only after the E17 ruling** — the blessed decision-gate (halt-class 9), not auto-continue. The figure is therefore reported as a floor with an explicitly unbounded-until-ruled tail. The calendar (~3–4 weeks) is already at the 4-week ceiling at the floor.

### Sequencing & dependency reality (data-shape / code-pattern — not commit-order)

- **C-D25 build-order:** E6 mints the C-D25 component; **E7 imports it** → E6 merges before E7.
- **T-D60 pattern dep:** E2/E3/E4 carry the *principle* established in E1; they don't import E1 code, so they're independently mergeable but should land after the T-D60 ruling.
- **Shared-file rebase coupling (don't run in parallel; second slice into a file inherits a rebase):** `intelligence/embeddings.ts` (E1+E2); `directives/service.ts` (E4+E10); `directives/scheduler.ts` + `backup/scheduler.ts` (E5+E8); `github/poller.ts` (E5-health vs E10-correctness); `items/service.ts` (E11+E12); `bootstrap/worker.ts` (E7 + the SF1-01-residual); `projects/service.ts` (E14+E16); `methodology/gates/checks.ts` (E13); `github/tiers.ts` (E16); `SettingsView.tsx` (E6+E7 health surfaces); `github/routes.ts` (E15).
- **On-main deps (already merged):** E12 extends the Phase-B `mapDomainError`; E13 reuses the Phase-D `safe-regex` guard; all wire-shape changes target T-D59 types.

---

## Per-slice detailed plans

> Convention: paired regression test in the **same** slice. Backend tests mirror `packages/backend/src/<path>` under `packages/backend/test/<path>`. Frontend tests under `packages/frontend/test/`. Wire-shape changes land in `packages/shared/src/` and are verified, not cast (T-D59).

### E1 — RAG embedder & query honesty
- **Closes:** SF3-01 (Crit), SF3-02 (High), S4-03 (Med). **Class:** bug.
- **Verified current:** `intelligence/embeddings.ts:101-112` bare `catch` pins SHA1 fallback (import-failure only; a *runtime* extractor throw at `:103` is unhandled → S4-03 crash); `shared/src/intelligence.ts` `RagQueryResult` (`:29-39`) has no `embedder` field; `text-index.ts:235` `if (!qv) return []`.
- **Fix (LBD-1 split-by-cause, RESOLVED):** capability-absent → surface a distinct degraded shape (`embedder:'fallback'`) **on the shared `RagQueryResult`** (LBD-1b ruled: on-contract, not side-channel); unexpected resolution/runtime failure → refuse + surface (catch the runtime extractor path too); query-embed failure → distinguish "embed failed" from honest empty. **The offline *silent* SHA1 fallback is removed** (LBD-1c: T-D60 supersedes the C-D2 offline-fallback sanction; the embedder may still operate as an *honestly-disclosed* capability-absent mode, never as an undisclosed substitute).
- **C-D2 amendment (lands in this slice):** edit the C-D2 body in `CODE_SPEC.md` to narrow it to "capability-absent honest-distinct mode" only, with a `> Amendment (2026-05-30, Phase E / E1): superseded-in-part by T-D60` block; mint **T-D60** in `DECISIONS.md` + `SPEC.md §14` (refresh `CODE_SPEC.md:9` count 59→60). This is the clean spec-amendment, not a silent code change.
- **Files:** `intelligence/embeddings.ts`, `intelligence/text-index.ts`, `intelligence/rag.ts` (or the query assembler), `packages/shared/src/intelligence.ts`, **`CODE_SPEC.md` (C-D2 amend), `DECISIONS.md` + `SPEC.md §14` (T-D60)**.
- **Tests:** `test/intelligence/embeddings.test.ts` (fallback disclosed; runtime-throw refuses; no silent substitution), `test/intelligence/rag.test.ts` (query result carries `embedder`; embed-fail ≠ empty).
- **Anchor:** **T-D60** (spec-author-accepted; minted here) + **C-D2 amendment**. **Deps:** chain head. **Halt:** LBD-1c is now *resolved* — no spec-drift halt; the C-D2 amendment is the sanctioned landing.

### E2 — AI/capability degradation honesty
- **Closes:** SF3-03, SF2-04, SF4-02, SF4-03. **Class:** bug. **Concern:** *"Every AI/capability path reports honestly instead of masquerading as success/empty."*
- **Fix (cites T-D60):** chat distinguishes "no key" from "call failed" (SF3-03); session-start reports `classifier_used_ai:false` on the unparsed-fallback path (SF2-04); md-ingest summariser emits `extractor_note` on AI failure (SF4-02) and a typed skip-reason replacing the conflated `skipped[]` (SF4-03).
- **Files:** `intelligence/routes.ts` (chat), `methodology/session-start/engine.ts`, `md-ingest/service.ts`, relevant `packages/shared/src/` response types.
- **Tests:** chat-failed-vs-no-key; classifier honesty; md-ingest extractor-note + typed skip-reason.
- **Deps:** T-D60 (E1); rebase coupling w/ E1 on `embeddings.ts` if touched. **Halt:** estimate-breach watch (4 findings, 2 subsystems) — peel md-ingest if it breaches.

### E3 — Semble degradation honesty
- **Closes:** SF4-01 (High). **Verified:** `semble/client.ts:149` `catch { return [] }`; `available()` (`:121-131`) returns `true` on any non-ENOENT failure.
- **Fix (cites T-D60):** crash/timeout → distinct degraded shape (not `available:true` empty); `available()` reflects real capability. **Files:** `semble/client.ts` + caller (`intelligence` or `library` consumer). **Tests:** `test/semble/client.test.ts` crash→degraded, ENOENT→unavailable. **Deps:** T-D60 pattern.

### E4 — Notifier capability honesty
- **Closes:** SF5-03 (Crit). **Verified:** `notifier/index.ts:36-66` no-op resolves; `notifier/routes.ts:15-29` test button → `{ok:true}` + `os_notifications_enabled=true`; `directives` `markFired` runs regardless.
- **Fix (cites T-D60):** capability-absent honest shape; test endpoint reports the real backend (no-op ≠ ok); `markFired` only on *real* delivery; frontend shows an honest disabled/degraded state.
- **Files:** `notifier/index.ts`, `notifier/routes.ts`, `directives/service.ts` (fire path), settings frontend. **Tests:** no-op→test-honest; reminder not consumed when undelivered. **Deps:** T-D60; rebase w/ E10 on `directives/service.ts`.

### E5 — Background-job health model
- **Closes:** SF5-01/02/04 (High). **Verified:** `backup/scheduler.ts:54-58`, `directives/scheduler.ts:84-88`, `github/poller.ts:239-241` catch-and-log only.
- **Fix:** uniform `lastRunAt` / `lastError` / `healthy` per loop (backend model), exposed via a health route; rendered **per-feature in-context** (LBD-2). **Anchor:** **C-D26** (proposed, if LBD-3 = distinct). **Files:** `backup/scheduler.ts`, `directives/scheduler.ts`, `github/poller.ts`, a health route, `packages/shared/src/` (health shape), frontend surfaces. **Tests:** loop failure flips `healthy:false` + surfaces `lastError`. **Deps:** LBD-2/LBD-3 ruling. **Halt:** unplanned-anchor if a fourth anchor is tempted.

### E6 — Bundle-health visibility
- **Closes:** SF2-02 (High), SF2-06 (Med). **Verified:** `methodology/gates/runtime.ts:159-169` empty firings on `status !== 'loaded'`; `/api/methodologies` lists only the install cache; no per-project bundle-health field.
- **Fix:** surface bundle-health (bound-but-broken vs legit-freeform vs healthy) **beside the methodology surface** (LBD-2) via the C-D25 component; widen `/api/methodologies` to include external/per-repo bundle errors. **Anchor:** **C-D25** (proposed; minted here). **Files:** `methodology/gates/runtime.ts`, methodologies route, `SettingsView.tsx` (or methodology view), `packages/shared/src/` (`ResourceState`). **Tests:** broken-post-bind bundle → degraded (not freeform); external bundle error listed. **Deps:** LBD-2 ruling. (E7 imports C-D25 → E6 first.)

### E7 — Bootstrap worker/watcher robustness
- **Closes:** SF1-01 **residual** = **SF1-03** = **S1-03** (all three IDs name the one behaviour: copy-failure-only `.error.json` uncounted → `quarantineCount` under-reports), S1-01 (timestamp collision), S1-02/SF1-02 (watcher arm TOCTOU — **High** per audit-4 re-exam), SF5-05/06 (enqueue throw drops file).
- **Verified:** `worker.ts:107-124` (copy-failure leaves only `.error.json`), `worker.ts:294` (`countOutputs` excludes `.error.json`), `worker.ts:69-70` (1-s timestamp), `watcher.ts` arm/scan TOCTOU.
- **Fix:** count `.error.json` markers (or leave a counted marker) so a copy-failure quarantine is **visible** via the C-D25 surface; sub-second/uniqueness-suffixed timestamp; close the scan-vs-arm TOCTOU; guard `enqueue` throws. **Files:** `bootstrap/worker.ts`, `bootstrap/watcher.ts`, `SettingsView.tsx` (quarantine surface). **Tests:** copy-failure → `quarantineCount > 0`; same-second ingests don't collide; TOCTOU write between scan/arm is caught. **Deps:** **E6 merged** (C-D25). **Note:** SF1-01 *bulk* closure is recorded in E18.

### E8 — Shutdown lifecycle completion
- **Closes:** S7-02 (High SSE), SF5-11 (unguarded ping + no global handler), S7-03 (residual `backup`+`directives` schedulers).
- **Verified:** `routes/events.ts:44-84` (`reply.hijack()`, ping not `unref`'d), `server.ts` shutdown, `backup/scheduler.ts` + `directives/scheduler.ts` `stop()` no drain. (Poller already drained — do not re-touch.)
- **Fix:** end SSE connections on `close`, `unref` pings, guard ping writes, add a global `unhandledRejection`/`uncaughtException` handler, drain backup+directives schedulers at shutdown (mirror the poller `drain()`). **Files:** `routes/events.ts`, `server.ts`, `backup/scheduler.ts`, `directives/scheduler.ts`. **Tests:** `app.close()` returns to quiescence (no hanging pings); in-flight tick awaited. **Deps:** rebase w/ E5 on the two schedulers.

### E9 — Loader robustness
- **Closes:** S3-01/SF2-05 (no `notifyReloaded` on arm-1/arm-3 deletion), S3-03 (dangling-symlink `statSync` aborts hydration), SF5-08 (`on('all')` unguarded).
- **Verified:** `methodology/loader.ts:293-335` (arm-2 notifies, arm-1/3 don't), `discoverBundleIds` `statSync`, the unguarded `on('all')`.
- **Fix:** `notifyReloaded` on all-arm deletion; guard `statSync` (skip dangling entries, don't abort); wrap `on('all')` in try/catch. **Files:** `methodology/loader.ts`. **Tests:** arm-1/3 unlink notifies downstream; dangling symlink skipped not fatal; handler throw contained. **Deps:** none.

### E10 — Background-loop correctness
- **Closes:** S4-02 (poller ETag-before-snapshot → permanent stale), S5-05 (recurrence catch-up storm).
- **Verified:** `github/poller.ts:147-223` (ETag persisted at `:156` before snapshot upserts at `:223`), `directives/service.ts:373-380` (advance one interval/fire).
- **Fix:** persist the list ETag only after snapshots commit (or make the pair atomic) so a mid-loop throw self-heals; coalesce missed recurrence fires (advance past now, fire once). **Files:** `github/poller.ts`, `directives/service.ts`. **Tests:** mid-loop throw → ETag not advanced → next poll re-fetches; downtime → single catch-up fire. **Deps:** rebase w/ E5 (poller) and E4 (`directives/service.ts`). **Note (RESOLVED):** S5-05's "missed-occurrence semantics" was flagged in audit-3 as a §7.10 *ambiguity*; the spec author has **ruled it in** — **add the one-line §7.10 missed-occurrence-coalesce clause** to `SPEC.md` in this slice (coalesce missed fires to a single catch-up fire), so the code and spec land together. **Files (incl. spec):** `github/poller.ts`, `directives/service.ts`, **`SPEC.md §7.10`**.

### E11 — Transaction atomicity
- **Closes:** S5-04 (`items.update` non-transactional), S6-03 (md-ingest batch non-atomic), S6-04 (secrets RMW non-atomic).
- **Verified:** `items/service.ts:561-688` (update writes scalar + context + mentions + audit unwrapped, vs `create` at `:522-548` wrapped), `md-ingest/service.ts` batch loop, secrets store RMW.
- **Fix:** wrap each in a `better-sqlite3` transaction (mirror `items.create` / the Phase-D S5-01 dump-zone fix). **Files:** `items/service.ts`, `md-ingest/service.ts`, `secrets/store.ts`. **Tests:** mid-update throw rolls back (no half-written context/mentions); batch partial-failure atomic; secrets RMW atomic. **Deps:** rebase w/ E12 on `items/service.ts`.

### E12 — Error→HTTP-status mapping
- **Closes:** S5-03 (FK violation → 400), S6-01 (`diff.rows` array-guard → 400). **Records S6-02 closed** by the central handler (→ E18 verify test).
- **Verified:** `items/service.ts:540-543` (`INSERT OR IGNORE` doesn't suppress FK), `reconcile/service.ts:241` (no `Array.isArray` guard).
- **Fix:** map FK violation → a `DomainError` (400) the Phase-B handler already serialises; guard `diff.rows` shape → 400. **Files:** `items/service.ts`, `reconcile/service.ts`, `reconcile/routes.ts`, shared error types if a new code is needed. **Tests:** stale `session_id` → 400; non-array `diff.rows` → 400. **Deps:** Phase-B `mapDomainError` (on main); rebase w/ E11.

### E13 — Methodology-parsing robustness
- **Closes:** S2-02 (gate-side ReDoS twin), S3-02 (EOF `indexOf`), SF2-03 (malformed lines silently dropped/retyped).
- **Verified:** `methodology/gates/checks.ts:153-179` (raw `new RegExp` + un-escaped vocab, no guard), `state-machine.ts:37` (unguarded `indexOf('\n')`), bundle parser malformed-line drop.
- **Fix:** apply the Phase-D `safe-regex` guard + length cap on the gate side; escape interpolated vocab; guard the EOF `indexOf`; surface malformed/refused lines as **parse warnings** (visible) instead of silent drops/retypes. **Files:** `methodology/gates/checks.ts`, `methodology/state-machine.ts`, bundle parser. **Tests:** catastrophic `format_regex` refused (gate side); EOF heading safe; malformed line → warning not silent drop. **Deps:** Phase-D `safe-regex` (on main). **Note:** SF2-08 (refused-regex silent skip) is the *visibility* sibling — pulled here **only if** LBD-4/OQ-equivalent says the wrong-belief Lows ride the chain; otherwise it stays an E17 decision item.

### E14 — Audit-trail wiring
- **Closes:** SF7-01 (High secrets), SF7-02 (High `settings_json`), SF7-03 (`updateSettings`), SF7-05 (session-path `settings_json`).
- **Verified:** `secrets/routes.ts:12-22` + `secrets/store.ts:27-38` (no `appendAudit`), `projects/service.ts:313-333` (field-loop omits `settings_json`), `routes/communication-model.ts:89` (silent update).
- **Fix:** emit an **event-only** secrets audit row (value excluded per T-D24); add `settings_json` to the field-loop; audit `updateSettings` + the session path — completing the 3-of-3 `settings_json` discipline. **Files:** `secrets/store.ts` (or routes), `projects/service.ts`, session settings path. **Tests:** credential set/clear/rotate audited (no value); `settings_json` edit audited on all three paths. **Deps:** rebase w/ E16 on `projects/service.ts`. **Note:** SF7-04/SF7-06 are **not** here — audit-trail-only, no operational misbelief → deferred register.

### E15 — Frontend races & error surfacing
- **Closes:** S8-01 (panel-cycle stale overwrite), S8-02 (search debounce stale results), S8-03 (toast unmount), S8-04 (action-error swallow), SF6-09 (PrBadges healthy-on-failure + backend half).
- **Verified:** `ItemDetailPanel.tsx:67-104` (6 awaits no abort), `LibraryView.tsx:88-118` (timer cleared not request), `PrBadges.tsx:26` (`.catch(()=>setPrs([]))`), `github/routes.ts:43-73` (success-shaped swallow).
- **Fix:** abort/ignore-stale guard on panel-cycle + search; clear toast timers on unmount; surface swallowed action errors; honest-degraded PrBadges (distinguish "no PRs" from "fetch failed"; consume E5 poll-health if available, else local error) + backend error signal. **Files:** `components/ItemDetailPanel.tsx`, `views/LibraryView.tsx`, toast component, `components/DriftInbox.tsx`, `components/Board.tsx`, `components/PrBadges.tsx`, `github/routes.ts`. **Tests:** rapid-cycle no stale overwrite; stale search dropped; toast no setState-after-unmount; PrBadges fetch-fail ≠ "none tracked". **Deps:** soft pattern dep on E5 (PrBadges health); rebase w/ E14/E16 only if `github/routes.ts` overlaps. **Halt:** estimate-breach watch (5 findings) — peel SF6-09 if it breaches.

### E16 — Audit-3 spec-contradiction bugs
- **Closes (bugs — current behaviour contradicts a cited spec/decision):**

  | Finding | Spec basis | Current | Verdict |
  |---|---|---|---|
  | F6-01 | SPEC §7.14 (all tiers → done item) | `tiers.ts` tiers 1-3 omit done-filter `tier4.ts:82-85` has | bug |
  | F1-03 | T-D51 / C-D19 (create validation) | `projects/routes.ts:48-77` `POST` omits `bundle_id_mismatch` | bug |
  | F4-04 | C-D12 (validate status vs lifecycle) | per-type transitions parsed, not enforced | bug |
  | SF3-04 | refuse-rather-than-fallback / SF2-01 precedent | per-PR sub-fetch swallow clears tier-1 as passing | bug |

- **Files:** `github/tiers.ts` (F6-01, SF3-04), `projects/routes.ts` + `projects/service.ts` (F1-03, F4-04). **Tests:** done-item filter on tiers 1-3; create rejects mismatch; transition enforced at create/update; sub-fetch failure doesn't clear. **Deps:** rebase w/ E14 (`projects/service.ts`). **Note:** **F6-02 is explicitly NOT here** — SPEC/CODE_SPEC are silent (only a code comment documents path-stem intent), so it's a value judgment → E17.

### E17a — Dependency range-bump remediation
- **Closes:** **W1 partial** (LBD-5 RESOLVED). **Class:** bug (dependency hygiene).
- **Scope:** bump the **in-range / range-closeable** advisories only — protobufjs (optional `@xenova` chain criticals), vite, esbuild. **fastify v5 is NOT here** — the v5 advisory is *accepted* and its major migration is a separate future phase (LBD-5). **Files:** `package.json` / `pnpm-lock.yaml`. **Tests:** the green gate is the test (`pnpm audit` delta + CI). **Deps:** none; independently mergeable. **Halt:** if a "range" bump turns out to require a major (estimate/scope breach) → halt, re-scope (don't silently pull in a major).

### E17 — Product-decision triage (surface only; no choice baked in) — *blessed decision-gate (halt-9)*
- **Class:** product-decision. **Deliverable:** a decision table the spec author rules on; chosen "build" items become *new appended slices*, "descope" items become targeted SPEC amendments, "schedule" items go to a Phase G register, "accept" items are documented. **This slice implements nothing functional until the spec author rules** (per `SESSION_START.md` spec-drift policy + the brief's "surface the decision; do not bake a choice"). The chain **halts here** for the ruling (halt-class 9, blessed). The fastify-accept note (LBD-5) is recorded in this slice's accepted-advisories register.
- **Surfaces:**
  - **Feature-completeness (build / descope / schedule):** F5-01, F5-02, F5-03, F5-04, F7-01, F7-02, F7-03, F7-04, F7-06, F7-07, F4-01.
  - **Spec-silent / value-judgment:** F6-02 (path-stem vs message-substring), F1-02 (single `project_reinit` row vs per-field), F3-01 (§7.14-vs-T-D57 scan-gate-layer ambiguity).
  - **Audit-4 wrong-belief Lows (ride-the-chain vs defer):** SF2-07, SF2-08, SF3-04*, SF4-05, SF4-06, SF5-07, SF5-09, SF5-10, SF6-13, SF6-14, SF6-15. (\*SF3-04 is already an E16 bug; listed for completeness of the wrong-belief set.) Each *does* produce a wrong belief about state, so it's a candidate to pull into the chain — but pulling them grows the roster past 20, so it's a spec-author scope call, not a planner default.
  - **Dependency posture:** W1 — accept the fastify v5 advisory vs schedule the major migration; the in-range protobufjs/vite/esbuild bumps are a separable small remediation.
  - **Minors register (accept / doc-fix / decide):** F1-04 (`/health` vs `/api/health` doc-staleness), F1-05, F1-06, F2-01, F2-02, F3-02, F4-02, F4-03, F5-05, F7-05, F8-01, S1-04, audit-1 I2/I8, S3-02 (if not folded to E13).
- **Files:** this plan's decision registers + `SPEC.md` only for ratified descopes (after the ruling). **Tests:** none. **Halt:** if a "build" ruling lands, the appended build slice mints no new anchor (else halt-class 5).

### E18 — Closure-verification appendix + verification tests
- **Class:** verify-already-closed. **Documents (with code evidence):**
  - **SF1-01 bulk** — common quarantine path surfaced (`worker.ts:107/294`, `SettingsView` alert); only the copy-failure residual was open (fixed in E7). **Alias closure:** the residual is also tracked as **SF1-03** (audit-4 Low) and **S1-03** (audit-2 Low) — same behaviour, three IDs; all three close via E7.
  - **S6-02** — reconcile `ItemPolicyError` now mapped by the central handler (`http/error-handler.ts:14-31`); add a regression test asserting the 4xx.
  - **F1-01 / S5-02** — all four former `resolveBundle`-omission sites call `resolveProjectBundle` (T-D51 amendment); Phase-D arm-2 lock present.
  - **SF6-01..12** — Phase C closure (`useResource`/`<LoadError>`; `useDirectives.ts:38`, `useDriftInbox.ts:34`).
  - **Phase-D locks** — S2-01, SF2-01, S5-01 (**alias: SF4-04** — the audit-4 silent-dup-on-retry view of the same dump-zone non-atomic apply), S4-01, S7-01 (reference the existing regression tests; no new test unless a lock is missing).
- **Deliverable:** appendix doc + a verification test **only where a lock is missing** (S6-02 is the likely one). **Files:** this plan / a closure note + `test/...` as needed. **Deps:** runs last (absorbs any incidental closure surfaced during E1–E16).

---

## Deferred-tail register (Phase F seed — NOT executed; surfaced for triage)

- **Audit-4 audit-trail-only Lows (no operational misbelief):** SF7-04 (chat-no-AI unaudited), SF7-06 (verifier `last_status` unaudited). *(Contrast SF7-05, pulled into E14 because it completes an active audit discipline.)*
- **Audit-5 improvement refactors (dedup/perf — not silent failures):** I1-seg1 (project-digest), I5-04 (`recordAiCost`), I5-05 (AI/heuristic router), I2-01 (`tiers.ts` N+1), I2-03 (md-ingest N+1), I3-03 (IntelligenceView shared-busy), I3-05 (panel `Promise.all` perf — the *race* is fixed in E15), I3-02/04/06..08, I2-02/04..07.
- **Audit-5 frontend/build:** I4-B01 (`React.lazy`), I4-B02..B06 (fonts/chunks/sourcemap), I7-02 (typed `Settings`).
- **Audit-5 a11y:** I4-A01..A08 (static), I4-R01..R07 (runtime pass).
- **Audit-1 accept-class:** I2 (shared no-op test), I8 (CI `concurrency`/`timeout-minutes`), I3..I9.
- **Audit-2 accept:** S1-04.

These are **named individually, not dropped** — that's what arms the next cohort hardener / Phase F to find them.

---

## Bug / product-decision / already-closed split (explicit)

- **Bug-fix (code + paired test):** E1–E16 = **16 slices.**
- **Product-decision (surface; spec author decides build/descope/schedule/accept):** E17 = **1 slice.** Chosen builds append as new slices.
- **Already-closed (doc + verify test where a lock is missing):** E18 = **1 slice.**
- **Deferred (register, not slices):** the tail above.

Each class is handled differently and the boundary is the OQ5-style rule: *contradicts spec → bug; spec silent / value judgment → decision; already closed → verify.* The SF1-01 reclass and the S6-02 reclass (both *verify*, not *bug*) are the concrete payoffs of applying the rule against current code rather than the audit text.

---

## Tracking issue (ready — opened at chain-open by Session 3, not by this session)

- **Title:** `Auto-continue: phase-e-full-audit-close`
- **Body:** link to this plan; chain-state file `.claude-code/auto-continue-state.json`; roster E1–E18; kill-switch signals (marker file `.claude-code/auto-continue-pause`, `/pause` comment); per-merge progress log (slice ID · PR # · merge ts · fix-round count); halt-class set incl. extensions 4–8; the three gating LBDs that must be ruled before E1/E5/E6 open.

---

## Chain-open readiness

This plan is **ready to seed a chain.** The pre-open preconditions are now **met**: (a) Session-2 round-1/2 audit converged (re-audit of these changed regions pending before the final re-approval); (b) the spec author has **ruled all five LBDs** (2026-05-30) — see *Decisions from the spec author (RESOLVED)*; (c) the three anchors (T-D60, C-D25, C-D26) are **accepted** as working-note proposals, minted in their gating slices; (d) halt-class extensions 4–9 are **blessed**. **Chain-open is NOT proposed by this session** — the deliverable is this committed plan. Session 3 executes from the merged artifact.

**Precondition split (Session-2 Finding 3) — now all resolved.** The LBDs were not uniform preconditions:
- **Ruled before seed (these unblocked planned slices/anchors — DONE):** **LBD-1** (E1 + T-D60 + C-D2 amendment: broad/on-contract/supersede), **LBD-2** (E5/E6/E7 + C-D25: one component, in-context, healthy/degraded/absent), **LBD-3** (distinct C-D26), **LBD-5** (fastify accepted; E17a range-bumps). The **19-slice floor** can now open cleanly.
- **Mid-chain scope gate at E17 (this *spawns* slices — RULED to remain a gate):** **LBD-4** stays a mid-chain decision gate (halt-class 9, blessed). The chain does **not** auto-continue past E17 without a human ruling on the audit-3 build/descope/schedule batch; any "build" rulings append new slices, so the roster total is a floor until E17 resolves (see Sizing-honesty). A priced-in decision gate, not an ad-hoc halt.

## Verification (Session 3, per slice)

Three-layer gate (Gitar + CI `pnpm -r typecheck/test/lint/build` + GitHub-mergeable) → merge-commit → next slice off updated `main`. Discrete-audit-after-merge per finding. **Chain close:** every closed finding has a regression test; T-D60 in `SPEC.md §14`; C-D25 + C-D26 in `CODE_SPEC.md` (+ the `CODE_SPEC.md:9` count refreshed 59→60); any SPEC descope marks (E17 rulings) landed; `PLATFORM_STATUS.md` rolled; handover per PR; halt-class extensions 4–8 absorbed into `AUTO_CONTINUE_WORKFLOW.md` by the cohort hardener; Phase F / Phase G registers carried forward; tracking issue closed.
