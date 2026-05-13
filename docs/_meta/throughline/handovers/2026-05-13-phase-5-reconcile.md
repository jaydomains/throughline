<!-- Template version: 1.0 -->

# Throughline — Phase 5 Handover

**Generated:** 2026-05-13 (pre-merge)
**Last commit SHA:** see PR head — 2026-05-13
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-13-phase-4-capture-surfaces.md` (Phase 4 — capture surfaces)

Phase 5 lands the reconcile engine per SPEC §7.7 and the CHECKLIST §Phase 5 row set. The engine turns free-form input (Claude Code transcripts, PR descriptions, session notes, manual paste) into a six-category diff (T-D35) against an existing item set, and the apply path mutates items + spawns code-drift signals for contradicted rows (T-D21). The Anthropic-backed engine + heuristic fallback + routing wrapper follow the Phase 4 `Extractor` convention exactly, making this the second consumer of that pattern (companion review in Phase 12 and session-start in Phase 13 follow the same shape).

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Six-category diff: completed, new, edited (title + description), blocker, contradicted, no-change (T-D35) | built | `packages/shared/src/reconcile.ts` discriminated `ReconcileRow` union; `packages/backend/src/reconcile/engine.ts` Anthropic + heuristic engines; `packages/backend/test/reconcile.test.ts` per-category cases | Heuristic produces all categories except `edited` — telling "refine title/description" apart from "new item" needs an LLM. AI path produces all six. |
| Edited row covers title and description under one row | built | `ReconcileRowEdited.next_title` + `next_description`; service apply issues a single `items.update({ title, description })`; backend test "applies edited rows by updating title and description" | Per T-D35; UI shows current vs next side-by-side for both fields in one section. |
| Apply mutates state and audit-logs every change | built | `packages/backend/src/reconcile/service.ts` apply dispatches per category through `items.update` / `items.create` (re-using their audit producers); top-level `reconcile_apply` + per-noop `reconcile_review_noop` audit rows | Mutation lives in `items` service so bundle policy + structured audit fields stay consistent with manual edits. |
| Contradicted spawns code-drift signal (not state revert) (T-D35) | built | `packages/backend/src/drift/service.ts` `createCodeSignal` called from contradicted branch in service; backend test "contradicted rows spawn tier-2 drift signals when item has a PR association" asserts both signal-row insert and unchanged item status | Item status remains unchanged on contradicted — verified by re-fetch in the test. |
| Drift signal tier reflects PR association (tier-2 if associated, tier-3 otherwise) | built | `drift.hasPrAssociation(item_id)` decides category at apply time; both tier-2 and tier-3 backend cases verified | Tier-2 / tier-3 badge rendering ships in Phase 10. Phase 5 only writes the signal. |
| User can accept / reject per category before applying (T-D5) | built | `ReconcileModal.tsx` per-row accept checkbox + inline editable next_title/next_description/next_blocker_text; reject routes `decisions[row_id]='reject'` into apply payload; backend respects rejections (no item mutation, no drift signal for rejected contradicted rows) | T-D5 review-before-apply enforced — apply mutates state only when user clicks Apply. |
| Review modal renders the six-category structure | built | `ReconcileModal.tsx` `CATEGORY_ORDER` constant; sections render in fixed order: completed / new / edited / blocker / contradicted / no_change; contradicted section red-bordered + carries spawn-drift-signal hint | Frontend test verifies sections render only for categories present in the diff. |
| Cost telemetry + audit fingerprint when AI is used (T-D24, T-D29) | built | `service.ts` writes `cost_telemetry` row + audit-log row with `prompt_fingerprint` on every Anthropic-backed propose; backend test "records cost telemetry + audit fingerprint when the model returns valid JSON" | Heuristic path writes neither (zero-token + non-AI actor). Mirrors the Phase 4 cost-telemetry shape exactly. |

---

## Last Decision Minted

No new T-D anchors. Implementation followed existing decisions: T-D5 (review-before-apply), T-D21 (drift streams + tier semantics), T-D24 (prompt fingerprint, never full prompts), T-D29 (cost telemetry), T-D35 (six-category diff, contradicted-as-drift), T-D36 (audit across items + drift firings), T-D47 (every project binds to a bundle). C-D anchors not minted; the slice is implementation-shape against C-D6/C-D7 (drift signals share a table with stream discriminator; reconcile is the first producer for `stream='code'`).

Conventions adopted (apply going forward):

- **Reconcile follows the Phase 4 Extractor convention.** Anthropic-backed implementation + heuristic fallback + routing wrapper that checks `client.available()` per call. This is the second consumer of the shape; Phase 12 (companion review judgement) and Phase 13 (session-start scaffolding) follow it as well. Net effect: every AI feature in the codebase has a runs-without-a-key fallback, and toggling the secrets file flips behaviour without a restart.
- **"Done"-equivalent status is the bundle policy's last declared status.** `bundleDoneStatus(policy)` in `packages/backend/src/items/policy.ts` returns `policy.statuses[policy.statuses.length - 1]`. Works for freeform (`['open','done']`) and SiteMesh's todo lifecycle whose terminal state is `done`. Flagged as an open question below — if a future bundle declares a terminal status with a different name (e.g. `closed`, `archived`), this convention may need a T-D anchor to formalise.
- **Reconcile source taxonomy is an exhaustive enumerated string union.** `ReconcileSource = 'claude-code-transcript' | 'pr-description' | 'session-note' | 'manual'` plus a `RECONCILE_SOURCES` const array, both exported from `packages/shared/src/reconcile.ts`. The dropdown in `ReconcileComposer.tsx` maps over `RECONCILE_SOURCES`, the route validates against the array via `isReconcileSource()`. Convention: surface taxonomies that have a small fixed set live in the shared types as `string | union` + readonly array so they can't drift into ad-hoc strings before SPEC formalises them.
- **State-transition endpoints are idempotent for terminal states.** `reconcile.discard()` is a no-op when the run is missing or already resolved; the backend test `"discard is idempotent"` enforces this. Mirrors the dump-zone discard pattern from Phase 4. Convention: state-transition endpoints (discard, apply-when-pending, archive-when-active) should be idempotent on terminal states so cancel-while-applying races don't surface as errors to the user.
- **Drift-signal production lives in a dedicated `drift/service.ts`.** Phase 5 is the first producer (contradicted-as-drift from reconcile). Phase 9 (discipline-drift) and Phase 10 (code-drift tiers 1/3/4) extend the same helper. The helper writes the row + audit-log entry in one call so producers don't have to remember both. `hasPrAssociation(item_id)` lives here because the tier decision is drift-substrate logic, not reconcile-engine logic.
- **Reconcile mutations go through `items` service, not direct SQL.** Apply dispatches `completed` → `items.update({ status })`, `new` → `items.create(...)`, `edited` → `items.update({ title, description })`, `blocker` → `items.update({ blocker_text })`. Bundle-policy validation and per-field audit-log rows come for free, and the reconcile path stays consistent with manual edits. Phase 10's GitHub-auto-apply path should do the same.
- **Two-surface capture vs reconcile is deliberate in v1.** Dump zone creates new items / library entries; reconcile produces a diff against existing items. A paste that contains both new items and updates to existing items would force the user to choose. Acceptable for v1; flagged as an open UX question below — a future phase may consolidate (reconcile-as-superset-of-dump-zone) or auto-route based on content classification.

---

## Active Blockers

_none_

Provisional / parked items:
- **Reconcile composer UX consolidation with dump zone.** Two-surface design is the v1 shape. If real-use feedback shows users routinely paste mixed content (new items + updates to existing items), a single composer that classifies and routes belongs in a later UX slice. Not blocking any current feature.
- **Done-equivalent status convention.** `bundleDoneStatus()` uses `policy.statuses[last]` as a heuristic. Holds for freeform + SiteMesh; if a future bundle declares a non-`done` terminal status, this needs a T-D anchor to formalise the contract. Surface it via the bundle policy's section rather than a string-last hack.
- **Drift-signal surfacing UI.** Phase 5 writes `drift_signals` rows for contradicted reconcile rows; the badges + drift inbox + re-verify-via-AI actions land with Phase 10 (code-drift) and Phase 9 (discipline-drift). The signals are queryable from the table today but invisible in the UI until then.
- **Frontend ReconcileComposer SSE refresh.** When the apply succeeds we call `onApplied` which triggers `useItems.refresh()`. The drift signals don't propagate any further today; once Phase 10 lands SSE drift updates, those will flow back to the relevant detail panels automatically.

---

## Files Changed Since Last Handover

**New (backend):**
- `packages/backend/src/db/migrations/0003_reconcile.sql` — `reconcile_runs` table (id, project_id, session_id, source, status, raw_text, diff_json, timestamps).
- `packages/backend/src/reconcile/engine.ts` — `ReconcileEngine` interface, `createAnthropicReconcileEngine`, `createHeuristicReconcileEngine`, `createRoutingReconcileEngine`. Anthropic system prompt parameterised by bundle policy + existing items; heuristic uses token-overlap matching + keyword classification.
- `packages/backend/src/reconcile/service.ts` — `propose / get / listRecent / apply / discard`. Apply iterates rows by category and dispatches through `items` service (or `drift` service for contradicted). Writes cost telemetry + prompt fingerprint on the AI path.
- `packages/backend/src/reconcile/routes.ts` — REST surface (`POST .../reconcile/propose`, `GET .../runs[/:id]`, `POST .../apply`, `DELETE .../runs/:id`).
- `packages/backend/src/drift/service.ts` — `DriftService` with `createCodeSignal` + `hasPrAssociation`. First producer landing here; Phase 9/10/11 extend.

**New (frontend):**
- `packages/frontend/src/components/ReconcileModal.tsx` — six-category review modal with per-row accept/reject + inline edits for new/edited/blocker rows + read-only contradicted display with drift-signal hint.
- `packages/frontend/src/components/ReconcileComposer.tsx` — composer modal (textarea + source dropdown) that triggers propose and opens the review modal.

**New (tests):**
- Backend: `packages/backend/test/reconcile.test.ts` (17 new tests; 69 backend tests pass).
- Frontend: `packages/frontend/test/reconcile.test.tsx` (6 new tests; 46 frontend tests pass).

**Modified:**
- `packages/shared/src/reconcile.ts` (new) — discriminated `ReconcileRow` union; `ReconcileDiff`, `ReconcileRun`, request/response types; enumerated `RECONCILE_SOURCES`.
- `packages/shared/src/index.ts` — exports reconcile types.
- `packages/backend/src/items/policy.ts` — adds `bundleDoneStatus(policy)`.
- `packages/backend/src/server.ts` — wires drift service + reconcile engine + reconcile service + reconcile routes.
- `packages/frontend/src/api.ts` — `proposeReconcile / applyReconcile / getReconcileRun / listReconcileRuns / discardReconcileRun`.
- `packages/frontend/src/views/SessionView.tsx` — mounts `ReconcileComposer` next to the dump zone.
- `packages/frontend/src/styles.css` — promotes shared `:where(...)` modal form-row selector to include `.reconcile-composer-modal` and `.reconcile-modal`; appends Phase 5 styles (composer button, section + row layout, evidence pre-block, contradicted-section red-bordered).
- `packages/frontend/test/fixtures/mockApi.ts` — state-backed mocks for reconcile runs + heuristic mock engine that classifies blocks via title-substring + keyword sniff.
- `CHECKLIST.md` — Phase 5 §all-rows ticked with evidence pointers.

**Deleted:** _none_.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Heuristic `edited` blind spot | `packages/backend/src/reconcile/engine.ts` | The heuristic engine cannot produce `edited` rows reliably — telling "refine title/description on an existing item" apart from "new item with similar wording" requires an LLM. The naive heuristic of "matched-by-token + not a status/blocker change → edited" produces false positives that aren't worth the breakage. | Heuristic produces `no_change` instead. Edited rows arrive only via the AI path. Frontend test covers an explicitly-constructed edited row to verify apply works regardless of source. Convention flagged: heuristic engines may legitimately omit categories that don't degrade gracefully without a model. |
| Two-surface UX (dump zone vs reconcile composer) | `packages/frontend/src/views/SessionView.tsx` | SPEC §7.7 talks about reconcile updating an existing list; §7.6 talks about dump zone creating new items. Real-use input may contain both. v1 mounts both surfaces side-by-side and requires the user to pick which to use. | Accepted; flagged in Active Blockers + as a Phase 5 convention note. Future UX slice may consolidate or auto-route. The two services are already orthogonal — dump-zone produces `proposed_extractions` rows, reconcile produces `reconcile_runs` rows — so consolidating the UI doesn't require backend rework. |
| "Done"-equivalent status convention | `packages/backend/src/items/policy.ts` | Bundle policy declares a `statuses` array but doesn't designate which member is "done". v1 takes the last entry. This works for freeform + SiteMesh but assumes terminal status is always last in the bundle's declared order. | `bundleDoneStatus(policy)` helper added with the convention documented inline. Flagged in Active Blockers for a future T-D anchor when a bundle exposes a counter-example. Alternative would be a `terminal_status` field on the bundle policy; that's a SPEC change rather than a code change, so deferred. |
| Reconcile run survives session deletion | `packages/backend/src/db/migrations/0003_reconcile.sql` | `reconcile_runs.session_id` is a foreign key with `ON DELETE SET NULL`. If a user deletes the session a reconcile run targets between propose and apply, the run becomes project-scoped on apply (new rows attach to no session). | Accepted as the v1 behaviour; the alternative (cascade delete the run when session is deleted) would silently lose review work. The propose-time validation in `service.ts` clears `session_id` to `NULL` when the session doesn't exist at propose-time as well, so the column is honest about which session (if any) the run is anchored to. |
| `reconcile_review_noop` audit entries on `item` rather than `project` | `packages/backend/src/reconcile/service.ts` | A no-change row is, by definition, a non-mutation. Logging it under `entity_type='item'` could be considered noise. | Accepted: the per-noop audit row is the only signal that the user actually reviewed-then-skipped this item. Phase 14 periodic-review hygiene queries can count it to surface "items mentioned but never decided on". Top-level `reconcile_apply` row carries the run-level summary so the audit log doesn't lose the wood for the trees. |

---

## Open Questions

- [ ] **Reconcile composer + dump zone consolidation.** v1 ships two surfaces. Decide after real-use feedback whether to merge into one composer that classifies new vs reconcile vs mixed, or keep separate.
- [ ] **Done-equivalent status formalisation.** If/when a bundle declares a terminal status with a different name, `bundleDoneStatus(policy)` needs to be replaced with a bundle-policy `terminal_status` field. T-D anchor would lock the contract.
- [ ] **GitHub-auto-apply reconcile (T-D6, T-D18).** Phase 10 wires this up; reconcile-engine + drift-signal substrate is already in place from this phase, so Phase 10 only needs the GitHub poller + confidence-thresholded branching.
- [ ] **Drift-signal re-verify UI.** Tier-2/3 signals from contradicted reconcile rows are queryable but invisible. Phase 9/10 surfaces them.
- [ ] **Heuristic `edited` row support.** Out of scope for v1. If a user reconciles without a Sonnet key configured and expects edits to be detected, they'll see only `no_change` instead. Document in user-facing help when Phase 13/14 settings UI lands.
- [ ] **Multi-row decisions UI.** Per-row accept/reject is in. "Reject all in section" or "accept only the contradicted rows" bulk operations aren't. Land if real-use signals friction.

---

## Recently Resolved

- **Phase 4 open question: "Stub writes for cost_telemetry; producers wire up when AI features land in Phase 4+"** — already resolved by the dump-zone path in Phase 4; Phase 5 adds the second producer (`feature='reconcile_diff'`).
- **CODE_SPEC §6 placeholder** — reconcile engine architecture sketch was implementation-light in CODE_SPEC; Phase 5 fills it in with a concrete `ReconcileEngine` interface + `ReconcileRun` row + apply dispatch.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- Phase 1 backend: project + bundle loader + audit log + cost telemetry helpers + items + sessions services. SQLite migration chain.
- Phase 3 backend: `items.create / items.update` are the apply-time write targets; bundle policy (`bundleItemPolicy`) is re-validated at apply. `item_pr_associations` is consulted for the tier-2/3 decision.
- Phase 4 conventions: `Extractor`-style routing engine + heuristic-fallback + cost-telemetry + audit-fingerprint pattern (Phase 5 is the second consumer); review-modal contract (per-row decisions + `useModalRegistration`).

**Downstream (consumes this slice's work):**
- **Phase 9 discipline-drift engine.** `drift/service.ts` extends with `createDisciplineSignal` (or generic `create({ stream, ... })`); the bundle-declared-categories enumeration will live alongside the `CodeDriftCategory` type.
- **Phase 10 GitHub integration & code-drift.** Auto-reconcile on PR merge calls `reconcile.propose` + `reconcile.apply` with the confidence-thresholded bypass per T-D6/T-D18. Code-drift tier-1/3/4 producers reuse `drift.createCodeSignal`.
- **Phase 11 Semble integration.** Tier-3 signal payloads can include Semble code-ref overlap data once items have refs; the payload-json column is already open-ended.
- **Phase 12 companion review.** Mechanical-step dispatch can re-use the bundle-policy-validation contract from `items.update`; companion-review judgement steps follow the same Anthropic/heuristic/routing engine pattern.
- **Phase 14 RAG + periodic review.** `reconcile_review_noop` audit rows surface in periodic-review hygiene queries ("items mentioned but never decided on"). `reconcile_diff` cost-telemetry rows feed the cost meter.
- **Phase 15 hygiene.** Cost meter visualisation now has data from two AI features (dump-zone + reconcile).

---

## Reference

- Specs operated against: `SPEC.md` §7.7 (reconciliation); §15 (degrade-gracefully); `CODE_SPEC.md` §6 (reconcile engine), §3 (drift_signals shared table), §14 (AI integration), §16 (audit log); T-D5, T-D21, T-D24, T-D29, T-D35, T-D36, T-D47; ROADMAP §Phase 5.
- Previous handover: `docs/_meta/throughline/handovers/2026-05-13-phase-4-capture-surfaces.md`.
- PR: filled in at PR open.
