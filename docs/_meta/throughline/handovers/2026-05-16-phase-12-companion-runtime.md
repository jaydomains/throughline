<!-- Template version: 1.0 -->

# Throughline — Phase 12 (Companion review runtime) Handover

**Generated:** 2026-05-16 (UTC)
**Last commit SHA:** see PR head — branch `claude/throughline-phase-12-Z58Fa` (PR not yet merged; update to merge SHA on merge)
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-16-phase-11-semble.md` (Phase 11 — Semble integration)

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Bundle-declared checklists instantiate as `ChecklistRun` (C-D8, T-D45, SPEC §7.18) | built | `packages/backend/src/methodology/companion/engine.ts` `startRun`; `test/companion.test.ts` "instantiate as a ChecklistRun" | Steps inserted `pending`; checklist resolved from bundle `review_patterns` |
| Step state machine pending → in-progress → passed \| failed \| skipped | built | `engine.ts` `transition`; shared `companion.ts` `ChecklistStepState`; test "shared check pipeline … audits each transition" | |
| Mechanical steps execute via shared mechanical-execution infra | built | reuses Phase-8 `gates/checks.ts` `runMechanicalCheck`/`resolveCheckKind`/`CheckContext`; test "mechanical step runs the shared check pipeline" | C-D8 "same pipeline as mechanical gates" — zero duplication |
| Mechanical step findings + every transition audit-logged (T-D36) | built | `transition` appends `entity_type='checklist_step'`; test asserts `mechanical_started`/`mechanical_resolved` rows | |
| Judgement step opens a UI panel | built | `packages/frontend/src/views/GatesView.tsx` `CompanionReview`; `test/gatesView.test.tsx` "companion review surface" | Embedded in methodology-gates view (approved) |
| Judgement step accepts user call with rationale | built | `engine.resolveJudgementStep`; route `.../judgement`; test "user call with rationale" | |
| Judgement step optionally hands to AI-via-Anthropic (default Sonnet, SPEC §9) | built | `companion/judgement.ts` `createAnthropicCompanionJudge` (default `claude-sonnet-4-6`); `engine.aiJudgeStep` | AI returns a *proposal*; user commits (C-D8 path b) |
| AI-judgement carries prompt fingerprint + model in audit (T-D24) | built | `aiJudgeStep` writes `ai_judgement_model` w/ `prompt_fingerprint` + cost telemetry; test "records model + fingerprint + cost" | Raw prompt never stored (asserted) |
| Run completion offers optional library-note summary attached to discussed items (T-D10) | built | `engine.completeRun` → `library.create({type:'note'})` + `library.attach`; test "saves an optional library note attached to discussed items" | Best-effort attach; bad item id never fails completion |
| Failed mechanical step does not halt; override audit-logged, run continues (T-D44 kin) | built | `engine.overrideStep`; test "failed mechanical step does not halt the run; override is audit-logged and continues" | |
| Freeform no-op | built | `test/companion.test.ts` "freeform-bound project declares no checklists" | `listChecklists` empty; UI surface hidden |

CHECKLIST §Phase 12: all eleven rows ticked with evidence.

---

## Last Decision Minted

> No new decisions minted. Implementation followed C-D8 (step state machine, mechanical/judgement
> dispatch), T-D45 (companion review as structured workflow), T-D10 (run-summary library note),
> T-D36 (audit), T-D24/T-D29 (AI telemetry). Implementation-shape choices (AI judgement is a
> *proposal* the user commits per C-D8 path b; step kind/description/order re-derived from the
> bundle ChecklistSpec rather than persisted; companion_mode + summary-note id recovered from the
> audit trail rather than new columns) are recorded in code headers and the Drift Flags below;
> none contradict C-D8 and none warrant a new anchor.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/shared/src/companion.ts` — wire types (`ChecklistRun`, `ChecklistRunStep`, `ChecklistStepFindings`, request shapes).
- `packages/backend/src/methodology/companion/engine.ts` — workflow engine: run/step lifecycle, mechanical dispatch (reuses gates/checks), judgement, override, completion.
- `packages/backend/src/methodology/companion/judgement.ts` — Anthropic companion-judge (default Sonnet), returns a reviewable proposal.
- `packages/backend/src/methodology/companion/routes.ts` — `/api/projects/:id/companion/...` endpoints.
- `packages/backend/test/companion.test.ts` — engine + state-machine + audit + AI-telemetry + override + completion + freeform coverage.
- `docs/_meta/throughline/handovers/2026-05-16-phase-12-companion-runtime.md` — this handover.

**Modified:**
- `packages/shared/src/index.ts` — export companion types.
- `packages/backend/src/server.ts` — construct companion judge + engine; register routes.
- `packages/frontend/src/api.ts` — companion API methods.
- `packages/frontend/src/views/GatesView.tsx` — `CompanionReview` section on the methodology-gates surface.
- `packages/frontend/src/styles.css` — companion-review styles (reuse gate vocabulary).
- `packages/frontend/test/fixtures/mockApi.ts` — companion mock methods.
- `packages/frontend/test/gatesView.test.tsx` — companion-surface test.
- `CHECKLIST.md` — Phase 12 rows ticked with evidence.

**Deleted:** _none_ (a draft `0010_phase12.sql` migration was written then removed — the checklist tables already ship from `0001_init.sql`).

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Phase-12 schema already exists | `0001_init.sql` | Plan assumed a new migration; `checklist_runs`/`checklist_run_steps` already ship from 0001 (CODE_SPEC §3 schema sketch) and are deliberately minimal (no `companion_mode`, `summary_entry_id`, `kind`, `description`, `ordinal`, no per-step `id`) | No migration. Step kind/description/order re-derived from the bundle ChecklistSpec (bundle is source of truth); `companion_mode` + `summary_entry_id` recovered from the run's audit trail (T-D45 — companion output is the audit RAG substrate). Step-level audit `entity_id` = `<runId>:<stepId>`. Implementation-shape choice within CODE_SPEC §3; no functional change, no SPEC change |
| AI judgement does not auto-resolve the step | `companion/engine.ts` `aiJudgeStep` | C-D8 path (b) says AI "returns a structured judgement that the user reviews before committing"; naive reading could auto-set state | AI result stored as `findings.ai_proposal`; step stays `in-progress`; user commits via `resolveJudgementStep`. Faithful to C-D8 path b; recorded in code header + shared-type comment |

---

## Open Questions

- [ ] Companion modes ↔ review-patterns relationship (CODE_SPEC "Questions for the spec author" #6) remains a Phase-13 spec gap. Phase 12 treats checklist + mode as a parameter pair at run-start with no behavioural coupling; default mode is the bundle's first-declared mode (C-D9 idiom). If a worked-example surfaces a coupling need, it lands in Phase 13 (session-start scaffolding) per ROADMAP. Not silently resolved.
- [ ] Parallel-eligible steps: C-D8 notes "the bundle can declare parallel-eligible steps"; the bundle grammar (`ChecklistSpec`) carries no parallel flag today, so all steps are user-sequenced via the UI (engine imposes no ordering constraint). Landing site: a bundle-grammar extension if/when a bundle needs it; no current consumer.

---

## Recently Resolved

- Tier-3 / companion-runtime dormancy: Phase 12 is the last of the methodology-runtime subsystems flagged across Phase 8–11 handovers as "pending"; the companion workflow engine (C-D8) is now live. (Session-start scaffolding C-D9 remains Phase 13.)

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- `methodology/gates/checks.ts` — `runMechanicalCheck`/`resolveCheckKind`/`CheckContext` for mechanical step execution (Phase 8).
- `ai/anthropic.ts` — `AnthropicClient` for judgement-step AI proposals (capability-gated; no key ⇒ proposal unavailable).
- `library/service.ts` — `create` + `attach` for the run-summary note (T-D10, Phase 6).
- `methodology/loader.ts` — bundle `review_patterns` (Phase 7 / bundle loader).
- `audit/log.ts`, `cost/telemetry.ts`, `ai/fingerprint.ts`, `ai/pricing.ts` — audit + cost (T-D36, T-D24, T-D29).

**Downstream (consumes this slice):**
- Phase 13 (session-start scaffolding, C-D9) — shares context-assembly idioms (`stateDigest`) and the companion-mode parameter; consumer pending.
- Phase 14 (periodic review / audit RAG, T-D25) — companion run/step audit rows (`entity_type='checklist_step'`) are queryable hygiene input; consumer pending.

---

## Reference

- Spec / decisions / build-state docs this slice operates against: `SPEC.md` (§7.18, §9), `CODE_SPEC.md` (C-D8, §3 schema sketch), `DECISIONS.md` (T-D45, T-D10, T-D36, T-D24, T-D29, T-D44), `CHECKLIST.md` (Phase 12), `ROADMAP.md` (Phase 12).
- PR: <link or number — fill on PR open>
