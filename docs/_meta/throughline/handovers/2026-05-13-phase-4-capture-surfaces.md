<!-- Template version: 1.0 -->

# Throughline — Phase 4 Handover

**Generated:** 2026-05-13 (pre-merge)
**Last commit SHA:** see PR head — 2026-05-13
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-13-phase-3-5-projects-create-ui.md` (Phase 3.5 — projects create UI)

Phase 4 lands the six capture surfaces (scratchpad, session dump zone, library dump zone, voice input, Claude Code push, code TODO/FIXME import) per SPEC §7.6 and the CHECKLIST §Phase 4 row set. It also brings the AI integration plumbing online (Anthropic SDK-free HTTPS client, cost telemetry per call, prompt fingerprint per T-D24) so Phase 5 reconcile, Phase 12 companion review, and Phase 13 session-start scaffolding inherit a working AI path. The minor library service shipped here is the smallest slice that lets the library dump zone apply; the full library surface lands in Phase 6.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Scratchpad always-visible in header, no AI, no review (T-D20) | built | `packages/frontend/src/components/Scratchpad.tsx`; `packages/backend/src/scratchpad/service.ts`; `test/scratchpad.test.ts`; `test/scratchpad.test.tsx` | Project-scoped jots; Cmd+Enter saves. No `propose`/`apply` calls. |
| Session dump zone (paste + file drop, bundle-aware AI extraction, review modal) | built | `packages/frontend/src/components/DumpZone.tsx`; `DumpZoneReviewModal.tsx`; `packages/backend/src/dump-zone/extractor.ts`; `service.ts`; `routes.ts`; `test/dumpZone.test.ts`; `test/dumpZone.test.tsx` | Anthropic Sonnet when key present; heuristic fallback otherwise (SPEC §15 degrade-gracefully). |
| Library dump zone (same paradigm) | built | `DumpZone` with `target='library'`; `packages/backend/src/library/{service,routes}.ts`; `LibraryView` in `views/stubs.tsx` | Minimal library: create + list only. Full library surface (attach-to-item, prompts/snippets editors, search) lands in Phase 6. |
| Bundle-aware extraction parameterised by active project's bundle | built | `dump-zone/extractor.ts` injects `policy.types` / `policy.statuses` into the Anthropic system prompt; heuristic uses `policy.types[0]` / `policy.statuses[0]`; apply re-validates via `bundleItemPolicy` | Freeform-bound projects extract as `task` / `open`. SiteMesh wiring (Phase 7) extends the policy without changing this path. |
| Review modal shows proposed-items + cross-session re-route | built | `DumpZoneReviewModal.tsx` per-row target session select; `test/dumpZone.test.tsx` case "lets the user cross-route an item" | Re-route is a `target_session_id` field on each `ProposedItem`. |
| Voice input (browser-native, desktop-only, destination toggle, dump-zone pipe) | built | `packages/frontend/src/components/VoiceCapture.tsx` | Destination ("session vs library dump zone" per §7.6) is resolved by mounting one `VoiceCapture` per `DumpZone` instance; the surface the user opens determines destination. Single-pane voice overlay with surface toggle is deferred — flagged below. |
| Claude Code push: inbox dir, watcher, queue, project routing, archive, quarantine (T-D16, T-D37) | built | `packages/backend/src/inbox/{watcher,worker,routes}.ts`; `test/inbox.test.ts` covers prefix-routing, last-active fallback, orphan-quarantine, empty-file quarantine, idempotent enqueue | Filename-prefix routing per `<projectId>__<rest>` convention (per AskUserQuestion decision). 30-day archive retention policy is declared but the cleanup job lands with Phase 15 hygiene per CODE_SPEC §17. |
| Code TODO/FIXME import: manual trigger, default `TODO:`/`FIXME:`/`XXX:` | built | `packages/backend/src/code-todo/{scanner,service,routes}.ts`; `HomeView` button in `views/stubs.tsx`; `test/codeTodo.test.ts` | Scanner walks the repo honouring a small ignore list (`node_modules`, `.git`, `dist`, `build`, etc.); proposes one item per match via the same dump-zone pipeline. |
| All non-scratchpad surfaces apply only after review (T-D5) | built | All capture sources funnel through `dump-zone/service.propose` → `proposed_extractions` row in `pending`; only `apply` mutates `items` / `library_entries` | Inbox worker writes a `pending` proposal and surfaces it via `GET /api/projects/:id/dump-zone/proposals`; user opens the review modal and applies. |
| Cost telemetry + audit fingerprint when AI is used (T-D24, T-D29) | built | `dump-zone/service.ts` writes `cost_telemetry` + audit-log row with `prompt_fingerprint` on every Anthropic-backed propose; `test/dumpZone.test.ts` "Anthropic extractor records cost telemetry" case | Heuristic path writes neither (zero-token + non-AI actor). |

---

## Last Decision Minted

No new T-D / C-D anchors. Implementation followed existing decisions: T-D5 (review-before-apply), T-D16 (CC push), T-D20 (scratchpad friction-free), T-D24 (prompt fingerprint, never full prompts), T-D29 (cost telemetry), T-D37 (autonomous archive/quarantine carve-out), T-D47 (every project binds to a bundle). C-D anchors not minted; this slice is implementation-shape against the existing C-D ledger.

Conventions adopted (apply going forward):

- **All capture surfaces share one extraction pipeline.** Paste, voice, inbox, and code-todo all call `dump-zone/service.propose(...)` with a different `source` value. The review modal is the single applying chokepoint. New capture surfaces (future Slack import, etc.) extend the `ProposalSource` enum and route through the same path. This is the contract that makes "all non-scratchpad surfaces apply only after review" enforceable rather than aspirational.
- **AI integrations follow `Extractor`-style interfaces with heuristic fallbacks.** Pattern: define a typed interface (input → output), build the Anthropic-backed implementation that records cost telemetry + audit fingerprint, build a heuristic fallback that returns the same shape, route via a `RoutingExtractor` that checks `client.available()` at call time so settings changes don't require a restart. Phase 5 (reconcile), Phase 12 (companion review), Phase 13 (session-start) follow the same shape.
- **Anthropic talked to directly over `fetch`, not via `@anthropic-ai/sdk`.** `packages/backend/src/ai/anthropic.ts` is a thin HTTPS wrapper. The SDK adds 200kb of types + a complete generator we don't need yet — the surface we use is tiny (messages.create). Promotable to the SDK in one file when Phase 5+ pulls in features (streaming, prompt caching) that warrant it.
- **Library entry creation is the minimum-needed slice.** Library UI lives in Phase 6. Phase 4 lands `create + list + get` and nothing else so the library dump zone can apply. Phase 6 extends the same service with `update`, `delete`, `attachToItem`, search, repo `.md` ingestion — same convention as Phase 3 expanding items beyond Phase 1's bare CRUD.
- **Form-row / form-actions / form-error styles promoted to a shared block.** The Phase 3.5 handover flagged that scoping these under `.new-project-modal` was a single-modal scope. Phase 4 lands the second modal-bearing form (dump-zone review) so the styles now live in `:where(.new-project-modal, .dump-zone-modal)` plus a top-level `.form-actions` / `.form-error` / `.form-hint`. Future modals extend the `:where(...)` list, or if four modals coexist, promote `.form-row` to a bare class.

---

## Active Blockers

_none_

Provisional / parked items:
- **Voice input language toggle** — voice capture defaults to `en-US`. The ROADMAP §13-unresolved row for voice input language remains open: SPEC §13 has no recommendation. Setting toggle lands when a non-English speaker needs it.
- **Inbox archive retention cleanup** — 30-day retention is declared in `CODE_SPEC.md §5` but the periodic cleanup job that prunes old archived files lands with Phase 15 hygiene (alongside the cost meter + orphaned-rules panel). Disk fills slowly; not a blocker.
- **Single voice overlay with destination toggle** — §7.6 describes a "voice capture overlay" with a "toggle in the voice capture overlay" for destination. Phase 4 resolves this by mounting one `VoiceCapture` per `DumpZone` instance (session or library) so the destination is implicit. The literal "toggle inside one overlay" lands if the UX is felt insufficient in real use.

---

## Files Changed Since Last Handover

**New (backend):**
- `packages/backend/src/db/migrations/0002_capture.sql` — `proposed_extractions` + `code_todo_scans` tables.
- `packages/backend/src/ai/anthropic.ts` — fetch-based Anthropic client; lazy availability check.
- `packages/backend/src/ai/fingerprint.ts` — SHA-256 prompt fingerprint (T-D24).
- `packages/backend/src/ai/pricing.ts` — USD-per-million-token table for Sonnet/Haiku/Opus.
- `packages/backend/src/dump-zone/extractor.ts` — `Extractor` interface, `createAnthropicExtractor`, `createHeuristicExtractor`, `createRoutingExtractor`.
- `packages/backend/src/dump-zone/service.ts` — propose / apply / discard / listRecent; cost telemetry + audit fingerprint on Anthropic path.
- `packages/backend/src/dump-zone/routes.ts` — REST surface.
- `packages/backend/src/library/{service,routes}.ts` — minimal library service for Phase 4 (Phase 6 expands).
- `packages/backend/src/scratchpad/{service,routes}.ts` — append-only jots, no AI.
- `packages/backend/src/inbox/{worker,watcher,routes}.ts` — chokidar watcher → serial queue drain → archive/quarantine.
- `packages/backend/src/code-todo/{scanner,service,routes}.ts` — repo walk + manual scan endpoint.

**New (frontend):**
- `packages/frontend/src/components/Scratchpad.tsx` — real header scratchpad replacing the Phase 2 placeholder.
- `packages/frontend/src/components/DumpZone.tsx` — paste + file-drop capture surface.
- `packages/frontend/src/components/DumpZoneReviewModal.tsx` — review modal with cross-session re-route.
- `packages/frontend/src/components/VoiceCapture.tsx` — browser SpeechRecognition wrapper; unsupported-fallback button.
- `packages/frontend/src/components/InboxStatus.tsx` — header pill + popover for inbox state.

**New (tests):**
- Backend: `dumpZone.test.ts`, `scratchpad.test.ts`, `inbox.test.ts`, `codeTodo.test.ts`, `library.test.ts` (16 new tests; 50 backend tests pass).
- Frontend: `dumpZone.test.tsx`, `scratchpad.test.tsx`, `inboxStatus.test.tsx`, `homeView.test.tsx` (12 new tests; 37 frontend tests pass).

**Modified:**
- `packages/backend/src/server.ts` — wired new services + watcher; threaded through `ServerHandle`; new `watchInbox` option for tests.
- `packages/frontend/src/api.ts` — Phase 4 endpoints (propose/apply, library, scratchpad, inbox, code-todo).
- `packages/frontend/src/components/Header.tsx` — swapped placeholder for real `Scratchpad`; mounted `InboxStatus`.
- `packages/frontend/src/views/SessionView.tsx` — mounted `DumpZone` with `target='session'`.
- `packages/frontend/src/views/stubs.tsx` — `HomeView` gained the code-todo scan section; `LibraryView` mounts the library dump zone + lists entries.
- `packages/frontend/src/styles.css` — Phase 4 styles (scratchpad jots, inbox popover, dump zone modal, proposal table, home section, library entries). Form-row/form-actions/form-error promoted out of the `.new-project-modal` scope.
- `packages/frontend/test/fixtures/mockApi.ts` — state-backed mocks for proposals, library entries, scratchpad jots, inbox queue, code-todo scans. `seedInbox` helper added.
- `packages/shared/src/index.ts` + new `packages/shared/src/capture.ts` — shared types: `ProposedItem`, `ProposalPayload`, `DumpZoneProposal`, `ScratchpadJot`, `LibraryEntry`, `InboxQueueEntry`, `CodeTodoScanResult`, etc.
- `CHECKLIST.md` — Phase 4 §all-rows ticked with evidence pointers.

**Deleted:**
- `packages/frontend/src/components/ScratchpadPlaceholder.tsx` — replaced by `Scratchpad.tsx`.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Voice destination toggle ↔ §7.6 wording | `packages/frontend/src/components/VoiceCapture.tsx` | §7.6 reads "the user picks the destination (session dump zone or library dump zone) via a toggle in the voice capture overlay." Phase 4 implementation mounts one `VoiceCapture` per `DumpZone`, so the destination is determined by which dump zone the user opened, not by a toggle inside the overlay. Functionally equivalent (user picks destination before recording), but literally a different UX shape. | Accepted as-is; flagged in Active Blockers as "single voice overlay with destination toggle" for future revisit if needed. The decision lets every capture surface use the same `VoiceCapture` component without a destination-selection layer on top. |
| Anthropic SDK vs raw fetch | `packages/backend/src/ai/anthropic.ts` | Provisional plan in CODE_SPEC §4 names `@anthropic-ai/sdk` as the integration mechanism. Phase 4 ships a thin `fetch`-based client instead — the SDK pulls in a complete generator we don't need yet, and the surface we use (one POST endpoint) is small. | Accepted; convention added to "Last Decision Minted" — promotable to the SDK in one file when streaming / prompt caching / batch features become useful (Phases 12+). |
| Cost telemetry test row count | `packages/backend/test/dumpZone.test.ts` "Anthropic extractor records cost telemetry" | First draft expected exactly one cost row; the Anthropic-path propose also runs through `recordCost`, but the heuristic fallback in the mock-client path didn't, which initially surfaced a confusing "row count was 0" failure when the test ran the heuristic branch by accident (mock client `available()` returning false before the test set it true). | Test now uses an explicit `available: () => true` mock client and a JSON-returning `call`; the assertion is for one row with input_tokens=100 / output_tokens=50, mirroring the mock response. |

---

## Open Questions

- [ ] **Single voice overlay with destination toggle vs per-dump-zone voice button.** Lands in a future capture-UX slice if real-use feedback shows the per-surface model adds friction (e.g., user wants to record once and then pick destination).
- [ ] **Voice input language default beyond `en-US`.** Tracks SPEC §13 open question; needs spec author direction.
- [ ] **Inbox archive retention cleanup job.** Lands with Phase 15 hygiene; not a blocker for any current feature.
- [ ] **Cost meter UI surfacing.** `cost_telemetry` rows write per AI call from this phase onward; the actual cost meter pill currently shows `$0.00 today`. Wiring to live spend lands in Phase 15.
- [ ] **AI-key configuration UI.** Backend reads from `~/.throughline/secrets.json` per T-D4. There's no UI yet for writing the key; manual edit only. Settings UI for keys lands with Phase 15.
- [ ] **Frontend tests for `VoiceCapture`.** Browser `SpeechRecognition` is absent in jsdom; testing the recognition flow needs a mocked global. Skipped this slice — the unsupported-fallback branch is exercised implicitly via every test that mounts `DumpZone`.

---

## Recently Resolved

- **"Phase 2 ScratchpadPlaceholder shown as not-yet-persisted."** — flagged in the Phase 2 handover and Phase 3.5 handover. Real `Scratchpad` now persists to `scratchpad_jots`; placeholder deleted.
- **"Stub writes for cost_telemetry; producers wire up when AI features land in Phase 4+."** — Phase 1 row that was annotated "producers wire up when AI features land in Phase 4+." Producers now write real rows on every Anthropic-backed dump-zone extraction.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- Phase 1 backend: project + bundle loader + audit log + cost telemetry helpers + items + sessions services. SQLite migrations chain.
- Phase 2 frontend substrate: `useModalRegistration` for the dump-zone review modal; `Header` slot for `Scratchpad` + `InboxStatus`; `.modal-backdrop` / `.modal` shared styles.
- Phase 3 backend: `ItemsService.create` is the apply-time write target for session-target proposals; the bundle policy (`bundleItemPolicy`) is re-validated at apply time.
- Phase 3.5 conventions: state-refresh-then-navigate pattern (still observed in the dump-zone modal's `onApplied` → `refresh()`); modal-component-owns-submitting-lifecycle (review modal resets `applying` on both success and error).

**Downstream (consumes this slice's work):**
- **Phase 5 reconcile engine.** The `Extractor` interface + heuristic-fallback + cost-telemetry + audit-fingerprint pattern is the template Phase 5's `ReconcileEngine` follows. The six-category diff (T-D35) routes through a similar review-modal flow.
- **Phase 6 library + directives.** Extends the minimal `library/service.ts` with update/delete/attach-to-item + the four content types' editors. Directives + repo `.md` ingestion are independent.
- **Phase 8 methodology gates.** Pre-write moment dispatcher can re-use the inbox signal-file convention if/when spec author confirms `pre-write` trigger mechanism (CODE_SPEC §7 unresolved item 1).
- **Phase 11 Semble integration.** Dump-zone review modal will show Semble code-ref suggestions per CHECKLIST §Phase 11 "Dump zone item creation enrichment: Semble suggestions appear in review modal" — extends `ProposedItem` with an optional `code_refs` field. The shape already exists on `ProposedItem.code_ref` for the code-todo source; Phase 11 generalises.
- **Phase 14 RAG.** Cost telemetry rows are now real; the cost meter visualisation in §7.25 has data to display from this phase forward. Audit-log audit-substrate queries can filter on `actor='ai'` and the `dump_zone_extraction` feature label.
- **Phase 15 hygiene.** Archive retention pruning + cost meter UI + secrets-file UI all consume artefacts landed here.

---

## Reference

- Specs operated against: `SPEC.md` §7.6 (capture surfaces); §9 (AI roles); §15 (degrade-gracefully); §7.25 (settings); `CODE_SPEC.md` §5 (capture surfaces), §14 (AI integration), §16 (audit log); T-D5, T-D16, T-D20, T-D24, T-D29, T-D37, T-D47; ROADMAP §Phase 4 §13-adoptions (TODO defaults, manual scan trigger).
- Previous handover: `docs/_meta/throughline/handovers/2026-05-13-phase-3-5-projects-create-ui.md`.
- PR: filled in at PR open.
