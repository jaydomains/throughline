# Phase E — Execution Audit (Auditor 1)

- **Date:** 2026-06-02
- **Auditor:** Auditor 1 (primary audit document). Peer review by Auditor 2 via PR comments.
- **Posture:** adversarial post-execution audit of the Phase E full audit-fix close chain (22-slice floor → 28 merged PRs, #88–#115). Audit-only: no fixes proposed inline; findings become follow-up slices the spec author rules on.
- **Status:** DRAFT — open for the Auditor-2 peer-review loop. Not approved, not merged.
- **Ground truth:** verified against `main` at HEAD `d633bd1` (E18 closure) via direct `git`/file reads, not inherited context.

---

## Workspace map (what was read to ground this audit)

**Discipline floor:** `SESSION_START.md`, `AUTHORING_DISCIPLINE.md`, `AUTO_CONTINUE_WORKFLOW.md`, `PLATFORM_STATUS.md`, `DECISIONS.md` (T-D60 live), `CODE_SPEC.md` (C-D25/C-D26), `SPEC.md §14`.

**Plans:** base `plans/2026-05-30-phase-e-full-audit-close.md` (19-slice floor); augmentation `plans/2026-05-31-phase-e-augmentation-feature-builds.md` (E19/E20/E21 + descopes + T-D10 amendment → 22 floor).

**Execution record:** `handovers/phase-e-execution-log.md` (per-slice), `handovers/phase-e-closure-verification.md` (E18 cert), `handovers/phase-e-E17-decision-record.md` (gate ruling).

**Audit source-of-findings:** the five committed audits + synthesis under `docs/_meta/throughline/audits/` (`2026-05-28-audit-1..5` + `-synthesis`).

**Code:** spot-verified the highest-risk diffs across HEAD — E1 (RAG honesty + T-D60/C-D2), E5/E6 (JobHealth/HealthStatus, C-D25/C-D26), E16/E25 (tier filters, stem-match), E22 (audit-filter SQL), E20a (migration 0013 table rebuild), E20b (spec-assist), E24 (frontend swallows), plus the SF6 frontend cluster (`LibraryView`, `ItemDetailPanel`, `SettingsView`). Git history checked for merge-shape and chain provenance.

---

## Headline

The chain is **substantively sound**. Every audit-1..4 finding is fixed, verified-closed, descoped/scheduled, or deferred-with-a-home; the regression tests I sampled genuinely pin the new behavior (the E1 "test-passes-after-revert" anti-pattern was specifically checked for and not found in the slices I read). The T-D60 honesty principle, the C-D25/C-D26 split, and the E20b draft→accept pattern all landed cleanly. Anchor counts are accurate (T-D=60; no stale C-D count).

The real findings are at the **margins and the discipline layer**, not the core fixes:
- a **chain-close hardener omission** (halt-classes 4–9 never codified into the canonical workflow doc, contradicting an explicit plan commitment);
- a **mis-claimed prior closure** (SF6-12) that was correctly re-deferred but exposes a still-live silent failure;
- a **latent migration regression with no test lock** (the riskiest line in the riskiest migration is unexercised);
- two **visibility-surface honesty residuals** — the chain's marquee T-D60 principle landed cleanly *on the wire* but doesn't reach the user at the RAG query surface (the `embedder` field is never rendered) or the C-D25 methodology-health surface (its loader swallows its own fetch);
- and a set of **discipline divergences** (squash-merge throughout, no per-slice handovers, thin E1/E2 provenance) that were self-justified or acknowledged but never adjudicated by the spec author.

---

## Per-slice verification

Legend: ✅ shipped-as-promised, in-scope, paired test pins behavior · ⚠️ shipped but a finding attaches · 📋 doc/decision slice.

| Slice | PR | Promise | Verdict | Note |
|---|---|---|---|---|
| E1 | #88 | RAG honesty; mint T-D60; narrow C-D2 | ✅ wire | SHA1 fallback now *disclosed* (`embedder` on shared `RagQueryResult`), runtime-throw (S4-03) propagates as `EmbedError` not masked, embed-fail (`'unavailable'`) ≠ empty. Tests strong incl. infra-throw-not-swallowed. T-D60 carries both supersession clauses; C-D2 body untouched + status pointer. **Closure is wire-scoped** — the RAG *query* UI never renders `embedder`, so SF3-01/SF3-02 persist user-facing (→ G-7). Provenance thin (W-3). |
| E2 | #89 | AI/capability honesty | ✅ (not re-read in depth) | Cites T-D60; closes SF3-03/SF2-04/SF4-02/SF4-03 (SF3-03 *is* closed user-side — the distinction lives in the chat message body). Prior-run provenance gap (W-3). |
| E3 | #90 | Semble honesty | ✅ | Tri-state `SembleStatus` on wire; estimate-breach (halt-4) noted non-halting (test overage). |
| E4 | #91 | Notifier honesty | ✅ | `NotifyResult` outcome; `markFired` only on `delivered`; reminder left armed otherwise. |
| E5 | #92 | JobHealth model; mint C-D26 | ✅ | `{last_run_at,last_error,healthy}` per loop + `/api/background-jobs/health`. Graceful notifier non-delivery correctly stays `healthy`; only a *thrown* tick → unhealthy. |
| E6 | #93 | Bundle-health visibility; mint C-D25 | ✅ | Shared `HealthStatus` tri-state in-context. SF2-06 closed via per-project `methodology-health` endpoint (interpretation flagged in log; defensible). **But the loader for this surface swallows — see G-3.** |
| E7 | #94 | Bootstrap robustness; import C-D25 | ✅ | `.error.json` marker counted; nanoid timestamp suffix; arm-before-scan; enqueue guard. |
| E8 | #95 | Shutdown lifecycle | ✅ | SSE `closeAll`/`unref`, global handlers in `index.ts`, scheduler `drain()`. Fix-round 2 root-caused a fake-timer flake; flagged `rag.test.ts` flake (halt-8) not absorbed — correct. |
| E9 | #96 | Loader robustness | ✅ | notifyReloaded on all arms; statSync guard; on('all') guard. S3-01/SF2-05/SF5-08 chokidar-internal → inspection-verified per convention. |
| E10 | #97 | Background-loop correctness + §7.10 | ✅ | ETag-after-snapshot; recurrence coalesce; §7.10 clause landed with code. |
| E11 | #98 | Transaction atomicity | ✅ | items.update wrapped; per-file md-ingest txn; atomic secrets write. S6-03 inspection-verified (defensible). |
| E12 | #99 | Error→HTTP mapping | ✅ | FK→`SessionNotFoundError`(404, judgment over 400 — reasonable); `ReconcileDiffShapeError`(400). |
| E13 | #100 | Methodology-parsing robustness | ✅ | safe-regex on gate side; EOF guard; warnings channel. S3-02 noted as masked off-by-one (honest). |
| E14 | #101 | Audit-trail wiring | ✅ | event-only secrets row (no value); settings_json on all 3 paths. |
| E15 | #102 | Frontend races & SF6-09 | ✅ | gen-guards on panel/search; toast cleanup; Board catch; PrBadges tri-state via C-D26 wire. |
| E16 | #103 | Audit-3 contradictions | ✅ (3/4) | F6-01 per-type done-filter (correct, not union) + null-refusal; SF3-04 annotation refusal; F1-03 create-time validation. F4-04 correctly re-routed to E17. Strong tests. |
| E17 | #104 | Product-decision gate | 📋 | Encodes the ruling; 4 descope SPEC amendments, F4-04 C-D12 amendment, Phase-G/advisory/minors registers. Halt-9 resolved. |
| E17a | #109 | Dep remediation | 📋 | Halt-4 fired (stale in-range premise → all majors); ruled Option 1 (defer all to fastify-v5 phase). Doc-only deferral. Halt handled correctly. |
| E22 | #105 | Audit-log filters (F7-04) | ✅ | time/actor/trigger-type; SQL injection-safe (fixed key whitelist, bound params, clamped limit); JS/SQL precedence agree; unknown actor/type→400. |
| E23 | #106 | SF2-07/08 parse visibility | ✅ | companion attach reflects reality; refused regex → unevaluable (ok:false) / disclosed warning. |
| E24 | #113 | SF5/SF6 rides + accountability | ⚠️ | Accumulated `Error[]` banners (good). Accountability discharge transparent/reasoned. **But "useStaleThreshold is the only swallow left" is inaccurate — see G-3.** |
| E25 | #107 | F6-02 + F1-02 | ✅ | path-stem token-boundary match (3-char min, delimiter-bounded — no short/mid-word over-match); single `project_reinit` row. Strong over-match guard test. |
| E26 | #108 | F1-04/F8-01/I8 doc-fixes | ✅ | /health prose; badge colors; CI concurrency + timeout. |
| E19 | #110 | Semantic search (F7-03) | ✅ | Real `text-index` query, library-filtered; `via` discriminator honest (`semantic-fallback`/`semantic-unavailable`); lazy composition resolves the cycle. |
| E20a | #111 | Session-start inputs + T-D10 | ⚠️ | Migration 0013 verified correct (rowid preserved, FTS triggers ordered, no FK, full schema). project_spec read directly + fingerprinted on content. **But rowid-preservation untested (G-4) and uniqueness has no DB constraint (G-5).** |
| E20b | #114 | Spec-revision LLM-assist | ✅ | Draft-only (no persist), capability-gated (no fabricated draft), 2000-char cap at service boundary, audit by fingerprint `applied:false`, user-mediated Accept. Establishes the draft→accept pattern. |
| E21 | #112 | Dump-zone primary-unit (F5-04) | ✅ | suggested_primary_unit_ref; freeform-gated; apply routes via methodology_context (no items.ts change needed). |
| E18 | #115 | Closure-verification | 📋 | F4-04 non-adjacency lock + S6-02 lock added; verify-closed table; deferred tail with homes. Chain COMPLETE. |

**Per-slice summary:** all 28 PRs shipped their promised scope with paired regression tests (or a documented inspection-verified rationale where deterministic testing was infeasible — chokidar internals, process-level handlers). The anchors landed in their planned slices with correct bodies (T-D60/E1, C-D26/E5, C-D25/E6, T-D10 amendment/E20a). The halt-class fires (E3/E4 estimate, E17a halt-4, E20a halt-5, E17 halt-9) were handled per the blessed rules.

---

## Cross-cutting findings

### Coverage (audit-ID set-diff)

I re-derived the full ID inventory from all five audits and traced each to a disposition.

- **Audits 1–4: complete.** Every High/Major/Critical/Medium/Minor ID resolves to fixed / verified-closed / descoped / scheduled / deferred-with-home. No silent drop in 1–4. The set-diff gate genuinely held for these.
- **An unverified range-claim, wrong for 3 of 4 trailing IDs (one now a live finding): SF6-10/11/12.** Base plan §"Verified prior-phase closures" (line 49) sweeps `SF6-03..08/10/11/12` as Phase-C-closed. Per-ID (the verification the range-claim skipped): **SF6-12** is **not** closed — `LibraryView.tsx:206-210` `onPatchEntry` `await`s `updateLibraryEntry` with no catch, invoked via `void` at :349, so a failed library-entry edit is silently swallowed (the live SF6-12 pattern, at HEAD). **SF6-10 / SF6-11** *were* closed, but in **E24**, not Phase C (`closure-verification.md:65`; E24's own log: "two of those sites … are also what the audit Mediums SF6-10/11 describe, so this PR closes those Mediums too") — Phase C fixed the data *hooks*, not these view-level loaders, so line 49 **mis-attributed** them. So the range-claim was wrong for 3 of the 4 trailing IDs (10/11 wrong phase; 12 not closed). Chain-close (E24/E18) correctly re-dispositioned SF6-12 to Phase-F deferred and closed SF6-10/11 in E24, so nothing is silently dropped — but the prior-closure claim rested on a bulk range assertion that did not hold per-ID. → **G-2.** (Sibling SF6-06 in ItemDetailPanel *is* genuinely closed via `mutationError`/`role="alert"` — verified — so SF6-12 is a specific live straggler, not a cluster-wide miss.) This is the concrete instance of the per-ID-vs-bulk theme in W-2.
- **Audit 5 was bulk-deferred, not set-diffed per-ID.** The closure cert states the gate covers "audits 1–4." Audit-5 improvements (dedup/perf/a11y) were routed wholesale to the Phase-F seed register. Defensible (improvements ≠ bugs), but the consequence is that audit-5's *test-gap* series (I6-01..I6-06 — the "add the catching test" findings) has no explicit disposition; it is only *implicitly* closed by the Phase A–D regression tests. → **W-2.**

### Discipline adherence

- **Squash-merge throughout — divergence from the canonical norm.** `AUTO_CONTINUE_WORKFLOW.md §D` mandates merge commits: *"merges the PR … using a merge commit (Throughline's repo norm … every prior PR on main lands as a two-parent merge commit). Squash and rebase strategies are not used."* Verified at the git level: every Phase E PR (#88–#115) is a **single-parent** commit; every prior PR (Phases A–D) is a **two-parent** merge. The execution log normalizes this as "the E1/E2 precedent." This was self-justified by an *unrecorded prior run*, never surfaced as drift, never adjudicated. It also dissolves the "handover is the slice's final commit" rule (no per-slice commit survives the squash). → **G-1 (discipline).**
- **No per-slice handovers.** A single append-only execution log replaced per-PR handover files. This deviates from SESSION_START handover discipline and both plans' own close-list ("handover per PR"). Acknowledged in the log header, but not a spec-author-blessed substitution. The log is arguably *more* useful than 28 handover files — but the rule was changed, not followed. → **W-1.**
- **Halt classes handled correctly.** The E16 F4-04 surface (verification-gap → spec ruling), E17 halt-9 gate, E17a halt-4 (stale-premise → re-scope, no silent major pulled in), E20a halt-5 (anchor, pre-resolved by ruling) all fired and resolved per the blessed rules. The "flake is a finding" discipline held (E8 root-caused; `rag.test.ts`/`directives.test.tsx` flagged to Phase F, not re-run-until-green). This part of the discipline was exemplary.

### Architecture-level

- **T-D60 honesty principle landed cleanly *on the wire*, but the UI completion is incomplete.** E1 → cited by E2/E3/E4/E15(SF6-09)/E19/E20b; the disclosed-capability shape is uniformly *on the wire contract* (extending T-D59), not side-channel. That contract-level discipline is the strongest architectural outcome of the chain. **But the principle's payoff is user-facing distinguishability, and two surfaces don't reach it:** (a) the RAG *query* UI never renders the `embedder` field E1 added — `'fallback'`≡`'transformers'` and `'unavailable'`≡genuine-empty to the user, reproducing SF3-01/SF3-02 at the UI (→ **G-7**, success path); (b) the C-D25 methodology-health loader swallows its own fetch (→ **G-3**, swallow path). The contrast that sets the bar: SF3-03 (chat) *is* closed user-side because the distinction lives in the message body. So "broad reach" is true on the contract; the **visibility-surface honesty residuals (G-3 + G-7)** are where it stops short. **Edge for Phase F:** the principle is enforced by *authoring vigilance*, not structure — E24 hand-hunted swallows and missed one; nothing forces a wire-disclosed state to be *rendered*. A lint against bare catch-to-empty catches G-3 but not G-7. → **I-1 (lint guard + render-the-state rule).**
- **C-D25/C-D26 split is clean** (distinct anchors, distinct evolution pressure, correctly cross-referenced). No concerns.
- **draft→accept LLM-assist pattern (E20b) is sound but un-anchored.** User-mediated, capability-gated, never auto-writes — a good template. But it is flagged for reuse only by a *module comment*, with no C-D anchor home. Future LLM-assist features (the spec author has more planned per §9) will rediscover it by accident. → **I-2 (anchor the pattern).**
- **T-D10 amendment introduced the repo's first table-rebuild migration.** Correct, but it set a precedent (CHECK-relaxation via full rebuild preserving rowid for FTS5) that now has no regression lock (G-4) — a footgun for the next person who copies the pattern.

---

## Real gaps (follow-up slices) — severity-classified

**G-1 · MEDIUM (discipline/process integrity) · Halt-classes 4–9 never codified into `AUTO_CONTINUE_WORKFLOW.md`.**
The base plan committed explicitly: *"`AUTO_CONTINUE_WORKFLOW.md` codification is deferred to the chain-close cohort hardener … the hardener absorbs 4–9 into the canonical doc at close."* It did not happen. At HEAD the doc still reads *"The Three Halt Classes … These are the only legitimate reasons a chain stops. Anything else is a bug in the runner."* The chain ran under — and several slices fired — the blessed extensions (estimate-breach, unplanned-anchor, test-regression, doc-PR-collision, out-of-audit-silent-failure, product-decision-gate). The canonical doc now actively contradicts sanctioned practice, and the next chain opens blind to the very halt classes the spec author blessed. This is precisely the cross-cohort drift `AUTHORING_DISCIPLINE.md` exists to catch.
→ *Follow-up:* a small doc slice absorbing 4–9 into `AUTO_CONTINUE_WORKFLOW.md` (the deferred-to-close work, now overdue). Also note: squash-merge (G-1 below) should be reconciled in the same doc pass — either the norm is updated or the practice is corrected.

**G-1b · LOW–MEDIUM (discipline) · Squash-merge contradicts the documented merge-commit norm, never adjudicated.**
See Discipline above. Either `AUTO_CONTINUE_WORKFLOW.md §D` should be amended to bless squash (if that's the intended new norm) or the practice flagged for correction. Spec-author ruling needed — this is a norm change, not an auditor call.

**G-2 · LOW–MEDIUM (live silent failure + plan accuracy) · The line-49 prior-closure range-claim was unverified — wrong for 3 of 4 trailing SF6 IDs; SF6-12 is a live silent failure.**
Base plan §"Verified prior-phase closures" (line 49) swept `SF6-03..08/10/11/12` as Phase-C-closed without per-ID verification. Per-ID: **SF6-12** is **not** closed — `LibraryView.tsx:206-210` (`onPatchEntry`) `await`s `api.updateLibraryEntry` with no catch, called via `void` at :349; a failed title/body/tags edit shows the user nothing and snaps back silently (live SF6-12 pattern, at HEAD). **SF6-10/SF6-11** were closed in **E24**, not Phase C (`closure-verification.md:65`) — mis-attributed (Phase C fixed the data hooks, not these view loaders). So the range was wrong for 3/4 trailing IDs. Coverage is intact (chain-close re-dispositioned all three correctly), but the prior-closure claim was a bulk assertion that didn't hold per-ID — the concrete instance of W-2. The SF6-12 fix is genuinely outstanding.
→ *Follow-up:* surface the library-edit error (reuse the `<LoadError>`/mutation-error convention already in `ItemDetailPanel`). Trivial. (Credit: SF6-10/11 mis-attribution surfaced by Auditor 2 in peer review.)

**G-3 · LOW (net-new silent failure, out-of-audit) · The C-D25 methodology-health loader swallows its own fetch failure.** *(visibility-surface honesty residual, with G-7)*
`SettingsView.tsx:603-605`: `.catch(() => { if (alive) setHealth(null); })`, and `:676` renders `{health && <HealthStatus.../>}`. So a failed `getMethodologyHealth` fetch makes the whole bundle-health surface *vanish* — the empty==healthy pattern re-introduced at the exact surface E6 built to eliminate it. Not in the original audits (the endpoint postdates them), so it falls under halt-class-8 "flag for the next audit cycle." It also makes E24's "`useStaleThreshold` is the only best-effort swallow left" claim inaccurate.
→ *Follow-up:* render a degraded `HealthStatus` (or a `<LoadError>`) on health-fetch failure rather than hiding the surface. Aligns the surface with its own T-D60 principle.

**G-7 · LOW–MEDIUM (live user-facing residual of the SF3-01 Critical) · The RAG query surface never renders the `embedder` field E1 added — SF3-01/SF3-02 persist at the UI.** *(visibility-surface honesty residual, with G-3)*
E1 closed SF3-01/SF3-02 **on the wire** (`RagQueryResult.embedder`, verified, tests pin). But `embedder` is consumed in exactly one place — `IntelligenceView.tsx:100`, the *manual reindex* message. The RAG **query** result block (`IntelligenceView.tsx:247-274`) renders `substrate / routed_by / used_ai / answer / citations` and **omits `embedder`**. Consequence, on the exact surface SF3-01/SF3-02 named: `embedder:'fallback'` (SHA1 capability-absent mode) renders **identically** to `'transformers'` → SF3-01's "garbage citations indistinguishable from real" persists user-facing; `embedder:'unavailable'` (refused retrieval) renders as *"No synthesised answer … sources below"* with zero citations — **identical to a genuine empty** → SF3-02 reproduced at the UI. **Distinct from G-3**: here the query *succeeds* and returns the honest field; the UI just never paints it — a render omission, not a swallow, so a catch-to-empty lint (I-1) won't catch it. The closure bar elsewhere in this slice family is "the user can distinguish" (cf. SF3-03/chat, which meets it via the message body); the RAG query path does not. Whether wire-only disclosure discharges the original SF3-01 Critical is a spec-author call — either way it should be a named follow-up, not folded into a clean bill.
→ *Follow-up:* render the `embedder` state in the RAG query result block (a degraded/fallback/unavailable indicator), mirroring the reindex message and the C-D25 tri-state convention. (Credit: surfaced by Auditor 2 in peer review.)

**G-4 · MEDIUM (latent data-corruption, no test lock) · Migration 0013 rowid-preservation is unexercised by any test.**
The migration is *correct* (independently confirmed: `INSERT INTO library_entries_new (rowid, …) SELECT rowid, …` preserves rowids, so the FTS5 external-content index stays aligned). But every test runs migrations against a fresh/empty DB, so the row-copy path never executes against pre-existing rows. A future edit that drops `rowid` from the SELECT (the natural "cleanup") would silently desync FTS5 — search returns wrong/garbage rows — and **pass the entire suite green**. This is the E1 "test passes after revert" pattern: a test exists for the feature, but the load-bearing behavior is not pinned.
→ *Follow-up:* a migration-level test that seeds `library_entries` rows (with a rowid gap) *before* applying 0013, then asserts FTS alignment + rowid identity post-rebuild. Pins the precedent for all future table rebuilds.

**G-5 · LOW (defense-in-depth) · `project_spec` one-per-project has no DB-level constraint.**
`library/service.ts` does a check-then-insert (`create` is not wrapped in a transaction; no unique partial index on `(project_id) WHERE type='project_spec'`). In-process safe because better-sqlite3 is synchronous with no await between check and insert — but there is no defense if a second process ever shares the DB file, and no structural guarantee.
→ *Follow-up:* add a unique partial index in a follow-on migration (cheap, makes the invariant structural).

---

## Worth-knowing (recorded, no action required)

- **W-1 · Per-slice handovers replaced by a single execution log.** Acknowledged, arguably better, but an unblessed deviation from a stated rule. If the single-log model is the intended go-forward, SESSION_START/AUTHORING_DISCIPLINE should say so; otherwise it's recurring drift.
- **W-2 · Audit-5 disposition is bulk, not per-ID.** The "set-diff gate held" claim is scoped to audits 1–4 (correctly stated in the cert). Audit-5's I6-01..06 test-gap series is only implicitly closed by Phase A–D tests; no explicit row anywhere. Low risk, but a reader auditing audit-5 coverage will find no trail.
- **W-3 · E1/E2 provenance is thin.** Both ran in an unrecorded "prior run": no branch, no fix-rounds, no per-slice handover, `PLATFORM_STATUS` not rolled until E3 backfilled. The two foundational slices — including the T-D60 mint — have the weakest evidentiary trail in the chain. Backfilled from merge commits; nothing appears wrong, but it's the thinnest provenance.
- **W-4 · Roster counting.** "27-slice floor" vs 28 merged PRs — E20 split into E20a/E20b after the count was fixed. Cosmetic; the sizing-honesty narrative is otherwise faithful (22 floor openly breached the 12–20 envelope, stated plainly).
- **W-5 · Several "judgment calls" were surfaced not halted** (E5/E6 C-D25 sequencing, E6 SF2-06 interpretation, E12 404-vs-400, E15 PrBadges compact treatment, E24 accountability attribution). Each is reasoned and transparently recorded. I concur with all of them — noting them so Auditor 2 can independently agree or contest.

---

## Improvements (concrete follow-up worth scheduling)

- **I-1 · Structural guard for the T-D60 honesty principle (two-part — covers G-3 *and* G-7).** (a) A lint rule (or frontend convention test) banning bare `.catch(() => setX(null))` / `.catch(() => setX([]))` in data-load effects — catches the *swallow* class (G-3); E24's hand-hunt missed one, the next will too. (b) A "render-the-disclosed-state" rule/test: a wire field that exists to disclose a degraded capability (`embedder`, `poll_healthy`, `status`) must be consumed at its primary surface — catches the *render-omission* class (G-7), which the lint cannot. Together they convert authoring vigilance into a gate at both ends of the principle. Highest-leverage Phase-F item for durability of the chain's marquee principle.
- **I-2 · Anchor the draft→accept LLM-assist pattern (E20b).** It's the template for the spec author's planned AI-assist surfaces; a C-D anchor (or a note in an existing one) gives it a discoverable home instead of a module comment.
- **I-3 · Migration-rebuild test harness (covers G-4).** Generalize the seed-then-migrate test so every future table-rebuild migration inherits a rowid/FTS-alignment lock.
- **I-4 · Reconcile the halt-class and merge-shape docs (covers G-1/G-1b) in one workflow-doc pass** — the deferred-to-close hardener work, plus a ruling on whether squash is the new norm.

---

## Disposition summary

| Class | IDs |
|---|---|
| Gaps (follow-up slices) | G-1 (halt-class codification), G-1b (squash norm — spec-author ruling), G-2 (line-49 range-claim unverified; SF6-12 live edit swallow), G-3 (methodology-health loader swallow), G-4 (migration rowid test), G-5 (project_spec unique index), G-7 (RAG query surface omits `embedder`) |
| Worth-knowing | W-1..W-5 |
| Improvements | I-1 (lint + render-the-state, covers G-3/G-7), I-2..I-4 |

*Numbering note: there is no G-6 (G-7 was added in peer review as the next free number; the provenance item is W-3).*

**Visibility-surface honesty residuals (Phase-F grouping):** G-3 + G-7 are the same architectural shortfall by two mechanisms — a wire-disclosed honesty signal that never reaches the user (G-3 swallows it, G-7 never renders it). Bundle them so I-1's two parts land together.

**Spec-author judgment required (not auditor calls):** G-1b (is squash the new merge norm?); W-1 (is the single-log the go-forward handover model?); whether wire-only disclosure discharges the SF3-01 Critical (G-7). Everything else is mechanical follow-up.

---

## Peer-review log

- **Round 1 (Auditor 2):** independent audit, converged on the headline and core-slice clean bills. Confirmed G-1/G-3/G-5/W-2 at the cited lines; co-found G-1b/G-4/W-3/W-4. Surfaced **G-7** (RAG query surface omits `embedder`) — accepted and folded in (verified at `IntelligenceView.tsx:247-274`). Refined **G-2** from one straggler to a 3/4-wrong range-claim (SF6-10/11 mis-attributed to Phase C) — verified and folded. Severity converged: G-1/G-4 MEDIUM; G-2/G-3/G-7 LOW–MEDIUM. No core-slice clean bill contested.

---

*Auditor 1 — draft, revised round 1. G-7 + G-2 refine folded; awaiting Auditor 2 co-sign.*
