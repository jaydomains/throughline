<!-- Historical artifact. Audit 4 of 5, conducted 2026-05-28 against the repo state of that date. Committed retroactively 2026-05-30 (see handover 2026-05-30-audit-backfill-five-audit-reports.md). Transcribed verbatim from the original session deliverable — NOT edited, summarized, or updated. Findings later closed by subsequent phases are still listed here as originally found; closure is recorded in PLATFORM_STATUS / handovers, not here. -->

# Throughline — Silent-Failure Audit (Audit 4 of 5)

**Date:** 2026-05-28 · Read-only; no fixes. Lens: what fails *now* without anyone noticing.
**Coverage:** 7 segments — bootstrap, methodology, github/intel/ai, core domains, background loops, frontend, and a full audit-log completeness matrix (~78 mutating actions mapped).

## Tally

| Severity | Count | IDs |
|---|---|---|
| **Critical** | 5 | SF1-01, SF3-01, SF5-03, SF6-01, SF6-02 |
| **High** | 15 | SF1-02, SF2-01, SF2-02, SF3-02, SF4-01, SF5-01, SF5-02, SF5-04, SF6-03, SF6-04, SF6-05, SF6-06, SF6-07, SF7-01, SF7-02 |
| **Medium** | ~18 | SF2-03/04/05/06, SF3-03, SF4-02/03/04, SF5-05/06/08/11, SF6-08/09/10/11/12, SF7-03 |
| **Low** | ~15 | SF1-03, SF2-07/08, SF3-04, SF4-05/06, SF5-07/09/10, SF6-13/14/15, SF7-04/05/06 |

**Re-examination verdicts:** S1-03 → **escalated to Critical** (SF1-01). S1-02 → **re-confirmed High** (SF1-02). S4-03 → **confirmed loud-on-reindex / silent-on-query**, the silent mirror filed as SF3-02. S8-04 → **split** into SF6-07 (Board create, High) + SF6-08 (DriftInbox actions, Medium). Audit-3's "bootstrap resolves unaudited" concern → **disproven** by the matrix (resolves *are* audited at service.ts:650/667/684/728).

---

## CRITICAL (5) — undetectable trust violations, fix-now

**SF1-01 — Quarantine failure is invisible; the file silently re-loops.** `worker.ts:113-127` + `:293`. When a quarantine's payload `copyFileSync` fails, only `.error.json` is written; `countOutputs` filters to `-bootstrap-output.json` (excludes `.error.json`), so `quarantineCount` stays 0 and the SettingsView alert (gated `quarantineCount > 0`) never renders. The user sees "no quarantine" while the file re-fails identically on every drain. Only trace: one `logger.warn`.

**SF3-01 — RAG silently runs on the meaningless hash-fallback embedder.** `embeddings.ts:109-112`. When `@xenova/transformers` is absent, a bare `catch {}` pins a 256-dim SHA1-bucketed bag-of-tokens embedder instead of MiniLM. `RagQueryResult` has no `embedder` field (only reindex exposes it), so every query returns semantically-garbage citations **indistinguishable from real retrieval**, with no signal anywhere.

**SF5-03 — The entire reminder feature is silently dead when `node-notifier` is absent.** `notifier/index.ts:36-42`. The no-op `notify()` always resolves, so `markFired` runs and one-shot reminders are consumed as "delivered." Worse, the "Test notifications" button calls the same no-op, returns `{ok:true}`, and sets `os_notifications_enabled = true` — **affirmatively telling the user notifications work while they're dead.**

**SF6-01 / SF6-02 — Item & session load errors render identical to an empty project.** `useItems.ts:29` / `useSessions.ts:20` set an `error` field that **every consumer ignores** (`HomeView`, `SessionView`, `TreeView`, `GraphView`, `CaptureView`, `LibraryView`). On a backend failure, `items`/`sessions` stay `[]` → HomeView shows "Nothing in progress," SessionsIndex shows "No sessions yet." The user concludes their work is gone and may re-create it.

## HIGH (15) — fix-now / next slice

- **SF2-01** — Drift scanner exception → `catch { return [] }`, and the engine then **dismisses every open signal** for that category as "no longer reproduces." A transient scanner fault silently clears real drift; reports "scan complete, no drift." `scanners.ts:198`.
- **SF2-02** — A bundle that breaks *after* binding flips `resolveBundle` to `error`; gates/companion/session-start/drift all degrade to empty-200, **indistinguishable from a legit freeform project**. Only communication-model fails loud. `runtime.ts:167`, etc.
- **SF3-02** — Query-embed yielding empty → `if (!qv) return []` → "no matches" when the embedding actually failed. `text-index.ts:235`.
- **SF4-01** — Semble subprocess crash/timeout → `catch { return [] }`, service reports `available:true` empty. "Search worked, nothing here" when it actually errored. `semble/client.ts:149`.
- **SF5-01 / SF5-02 / SF5-04** — Backup auto-copy, reminder fire, and GitHub poll failures are **log-only**: the tick survives and looks healthy while off-disk backups / reminders / PR-and-merge awareness silently rot. No state field or UI badge. A merged PR may never auto-reconcile.
- **SF6-03** — `useItemPolicy` error swallowed; `policy=null` hides the entire board (`{policy && …}`) or shows a permanent "Loading…".
- **SF6-04** — `useDirectives`/`useDriftInbox` `catch → setEmpty` with **no error field at all**; a failed load of the drift **safety surface** reads as "Inbox clear — no open drift signals."
- **SF6-05** — `LibraryView.refresh` (listLibrary) has no catch; list silently goes/stays stale on filter change during an outage.
- **SF6-06** — `ItemDetailPanel` edit cluster (title/description/status/tags/blocker/branch/methodology-context) — `void`/`onBlur` handlers with no catch; a failed edit snaps back to the old value with no error. User may believe a status change took.
- **SF6-07** — `Board` inline-create swallows failure; typed text stays, no card appears, no error. (S8-04 half.)
- **SF7-01** — **Secrets credential set/clear/rotate emits no audit row** — the only state-mutating domain with zero audit wiring, and it mutates API keys/PATs. (T-D24 forbids logging the value, not the event.)
- **SF7-02** — User-facing project `settings_json` edits (communication-model `contract_sources`/`module_tiers` via `PUT .../communication-model`) land silently — the audit field-loop enumerates sibling columns but **omits `settings_json`**. `projects/service.ts:304`.

## MEDIUM (~18) — queue

Methodology: SF2-03 (malformed gate/category lines silently dropped or retyped to wrong scanner; bundle loads green), SF2-04 (session-start unparseable AI → all-`medium` but reports `classifier_used_ai:true`), SF2-05 (install-shipped `bundle.md` unlink: no `notifyReloaded`, no log — = audit-2 S3-01), SF2-06 (external/per-repo bundle errors invisible to `/api/methodologies`, which lists only the install cache). · AI: SF3-03 (chat misattributes a failed AI call as "no key configured"). · Core: SF4-02 (md-ingest summariser AI-failure carries no `extractor_note`, unlike its reconcile/dump-zone twins), SF4-03 (md-ingest `skipped[]` conflates "too large"/"unreadable"/"deleted"), SF4-04 (dump-zone non-atomic apply → silent duplicates on retry — = audit-2 S5-01). · Background: SF5-05/06 (watcher `enqueue` throw drops the file/output, chokidar swallows), SF5-08 (loader `on('all')` unguarded), SF5-11 (SSE ping write unguarded, no global `unhandledRejection` handler). · Frontend: SF6-08 (DriftInbox actions), SF6-09 (PrBadges success-shaped swallow — **paired backend** `github/routes.ts:43-73`), SF6-10 (IntelligenceView panels vanish), SF6-11 (SettingsView loaders), SF6-12 (LibraryView edits). · Audit: SF7-03 (`projects.updateSettings` unaudited — generic path, debatable).

## LOW (~15) — accept / opportunistic
SF1-03, SF2-07 (companion `library.attach` swallowed; audit asserts success), SF2-08 (refused/invalid bundle regex → silent skip), SF3-04 (per-PR sub-fetch swallow can clear tier-1 as passing; tier-4 no-key→false; `unavailable`-served-as-304), SF4-05, SF4-06 (cost under-count on post-billing throw), SF5-07/09/10, SF6-13/14/15, SF7-04/05/06.

---

## Cross-cutting patterns (the headline of this audit)

1. **"empty == clean/healthy" conflation — the dominant, product-wide pattern.** A failure state and a benign-empty state render identically across *every* segment: failed item/session load → "empty project" (SF6-01/02); failed drift load → "all clear" (SF6-04); post-bind bundle error → "freeform, no gates" (SF2-02); scanner throw → "no drift" *and clears real signals* (SF2-01); Semble crash → `available:true` empty (SF4-01); RAG fallback → real-looking garbage (SF3-01); query-embed fail → "no matches" (SF3-02); quarantine fail → "no quarantine" (SF1-01); GitHub fetch fail → "PRs: none tracked" (SF6-09); refused regex → "no drift" (SF2-08). **This single pattern underlies 3 of 5 Criticals and most Highs.**

2. **Frontend: two mechanical root causes, huge blast radius.** (a) Five data hooks expose an `error` field **no consumer renders**; (b) a pervasive `void api.X().then(refresh)` mutation idiom with no catch. Fixing these two idioms resolves SF6-01/02/03/05/06/07/08/10/11/12 — one coherent slice clears 2 Criticals + 5 Highs.

3. **Background guarantees degrade to log-only — "looks alive, silently useless."** SF5-01/02/04 + SF5-03: the loop keeps ticking and appears healthy while backups/reminders/poll-awareness rot, with no state or UI signal. No global `unhandledRejection`/`uncaughtException` handler exists.

4. **create-loud vs apply/update-quiet asymmetry (the predicted pattern — confirmed).** reconcile apply (atomic, audited, AI-noted) vs dump-zone apply (non-atomic, dup-on-retry: SF4-04); reconcile/dump-zone extractor (AI-failure note) vs md-ingest summariser (no note: SF4-02). items create/update are symmetric and both loud (clean counter-example).

5. **Degradation dishonesty — the honesty signals themselves lie.** `used_ai`/`available`/`classifier_used_ai`/Test-button `ok` all report success on degraded paths: RAG embedder undisclosed (SF3-01), chat "no key" (SF3-03), classifier `used_ai:true` on unparsed (SF2-04), notifier Test `ok:true` (SF5-03).

6. **Audit matrix: strong baseline, two real gaps.** ~78 actions across 22 domains; entity CRUD and **all destructive deletes are uniformly audited** (→ zero Critical audit gaps). The blind spots: **secrets entirely un-instrumented** (SF7-01) and the **`settings_json` wholesale-JSON column** escaping per-field audit discipline in three places (SF7-02/03/05). The full matrix is preserved in the segment-7 working notes for future hardener reference.

## Cross-audit reconciliation
SF4-04 ↔ audit-2 S5-01 (now seen as silent dup-on-retry). SF2-05 ↔ audit-2 S3-01. SF3-04 ↔ audit-2 S4-02. SF7 matrix confirms audit-3 F1-02 (no `project_reinit` kind) and **disproves** the audit-3 "resolves unaudited" worry.

## Remediation — three natural workstreams
- **Workstream A — Frontend error-surfacing pass (highest value/effort):** render the five hooks' `error`; add catches that `setError` to the `void`-mutation handlers. Clears SF6-01/02/03/05/06/07/08/10/11/12 (2 Critical + 5 High + several Medium).
- **Workstream B — Degradation-honesty pass:** make degraded/failed states surface a *distinct* signal instead of masquerading as empty/healthy — fallback embedder disclosed (SF3-01), notifier degraded-state + honest Test (SF5-03), Semble `available:false` on crash (SF4-01), per-project bundle-health surface (SF2-02/06), scanner-throw doesn't dismiss signals (SF2-01), quarantine surfaced (SF1-01), background-guarantee health state (SF5-01/04).
- **Workstream C — Audit gaps:** instrument secrets (event, not value) + `settings_json` writes (SF7-01/02/03).
- **Queue / accept:** remaining Mediums and Lows.

---

### Audit-log completeness matrix — summary (full matrix in segment-7 working notes)

Audit primitive: `appendAudit(db, {projectId, entityType, entityId, actor, field, oldValue?, newValue?, triggerContext?})` (`audit/log.ts:17`). Records timestamp/project/entity/actor/field/old/new/JSON context. T-D24 redaction is the caller's responsibility (honored via `promptFingerprint` everywhere).

~78 mutating actions mapped across 22 domains; **6 audit GAPs** — 2 High (SF7-01 secrets credential write; SF7-02 project `settings_json` user-edit), 1 Medium (SF7-03 `projects.updateSettings`), 3 Low (SF7-04 chat-no-AI; SF7-05 session `settings_json`; SF7-06 verifier `last_status`) — plus known F1-02 (no `project_reinit` kind). **Zero Critical** — all destructive deletes are audited. Cross-cutting: entity CRUD uniformly well-audited; the `settings_json` wholesale-JSON column is the recurring blind spot (3 paths); secrets is the single un-instrumented mutation domain; background/AI/system actors consistently audited with `prompt_fingerprint`. Bootstrap resolves ARE audited (`runResolveTransaction` at service.ts:650/667/684/728).
