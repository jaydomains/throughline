<!-- Template version: 1.0 -->

# Throughline — Phase 14 (RAG & intelligence layer) Handover

**Generated:** 2026-05-17 (UTC)
**Last commit SHA:** see PR #22 head — branch `claude/phase-14-rag-intelligence-ZBTY5` (PR not yet merged; update to merge SHA on merge)
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-17-phase-13-session-start.md` (Phase 13 — Session-start scaffolding)

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Personal RAG: text/code/audit substrates + keyword router + per-query override (T-D25, C-D2, SPEC §7.18) | built | `intelligence/rag.ts`, `intelligence/text-index.ts`, `intelligence/embeddings.ts`; `test/rag.test.ts` | Router heuristic + override; project-scoped + cross-project |
| Text substrate local embeddings, incremental on edit (C-D2) | built | `embeddings.ts` (Transformers.js lazy import + deterministic fallback), `text-index.ts` content-hash staleness; migration `0010` | Fallback used when `@xenova/transformers` / model absent |
| RAG citations across substrates; capability-gated synthesis | built | `rag.ts` `RagCitation[]`; tests "degrades to retrieval-only…" | No Anthropic key ⇒ retrieval-only, no cost |
| End-of-session retro, user-initiated, library note, optional attach/append (SPEC §7.18) | built | `intelligence/retro.ts`; `test/retro-review.test.ts` | Sonnet + deterministic fallback; appends `<repo>/session-start.md` |
| Periodic review: configurable interval, no-AI hygiene, AI on open (T-D22) | built | `intelligence/periodic-review.ts`; `test/retro-review.test.ts` | Interval: project settings → global → 14d default |
| Dependency-aware sequencing + "Do next" + gate deprioritisation (SPEC §7.18) | built | `intelligence/sequencing.ts`; `test/sequencing-stakeholder.test.ts` | No AI; gate→unit attribution interpreted (Open Questions) |
| Stakeholder view, plain language, cache invalidates on edit (T-D17) | built | `intelligence/stakeholder.ts`; `test/sequencing-stakeholder.test.ts` | Audit-trail-as-cache keyed by content fingerprint |
| Chat (per-list + dump-zone), history per context, propose-through-review (SPEC §7.19, T-D23) | built | `intelligence/chat.ts`; `test/chat.test.ts` | `chat_history` per `(project,context_type,context_id)`; propose → `dumpZone.propose` |
| Frontend Intelligence surface | built | `views/IntelligenceView.tsx`; `test/intelligenceView.test.tsx` | RAG / retro / periodic-review / Do-next / stakeholder / chat panels |

CHECKLIST §Phase 14: all 25 rows ticked with evidence (slice tags 14a–14d).

---

## Last Decision Minted

> No new decisions minted. Implementation followed T-D17, T-D22, T-D23, T-D25, C-D2;
> SPEC §7.18/§7.19/§9; CODE_SPEC §14/§15. Implementation-shape choices (migration 0010
> schema-sketch deviation; deterministic embedder fallback; freshness-sweep TTL throttle;
> audit-trail-as-cache for stakeholder; chat `ProposalSource:'paste'` reuse; gate→unit
> attribution via finding refs) are recorded in code headers + Drift Flags + Open
> Questions below; none contradict an anchor, none warrant a new one.

---

## Active Blockers

_none_

Capability-gated (not blockers): text substrate uses the deterministic embedder until
`@xenova/transformers` (optionalDependency) + its first-launch model are present; all AI
synthesis is inert without an Anthropic key (retrieval/structured fallbacks, no cost).

---

## Files Changed Since Last Handover

**New:**
- `packages/shared/src/intelligence.ts` — RAG/retro/periodic-review/sequencing/stakeholder/chat wire types.
- `packages/backend/src/intelligence/{embeddings,text-index,rag,retro,periodic-review,sequencing,stakeholder,chat,routes}.ts` — the intelligence layer.
- `packages/backend/src/db/migrations/0010_phase14_intelligence.sql` — `text_embeddings` += `project_id`/`content_hash`/`chunk_text` + index.
- `packages/backend/test/{rag,retro-review,sequencing-stakeholder,chat}.test.ts` — coverage.
- `packages/frontend/src/views/IntelligenceView.tsx`, `packages/frontend/test/intelligenceView.test.tsx` — Intelligence surface + test.
- `docs/_meta/throughline/handovers/2026-05-17-phase-14-rag-intelligence.md` — this handover.

**Modified:**
- `packages/shared/src/index.ts` — export intelligence types.
- `packages/backend/src/server.ts` — construct + register the six intelligence services.
- `packages/backend/package.json` — `@xenova/transformers` optionalDependency.
- `packages/frontend/src/api.ts`, `test/fixtures/mockApi.ts` — intelligence API + mocks.
- `packages/frontend/src/views/modes.ts`, `src/App.tsx`, `src/styles.css` — Intelligence nav/route/styles.
- `CHECKLIST.md` — Phase 14 rows ticked.

**Deleted:** _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Embeddings dependency reality | `intelligence/embeddings.ts` | C-D2 mandates Transformers.js; package not installed, model needs first-launch download | Lazy dynamic import + deterministic offline fallback (capability-gating discipline, user-approved). C-D2 honoured when dep+model present |
| `text_embeddings` schema sketch | `migrations/0010_*.sql` | CODE_SPEC §3 sketch had only `(entity_type,entity_id,chunk_index,embedding_blob)` | Added `project_id`/`content_hash`/`chunk_text` for scoping + incremental staleness. Implementation-shape only; real index table ⇒ a migration is appropriate |
| Freshness sweep on search hot path | `intelligence/text-index.ts` | Gitar (PR #22): O(n) sweep per query | TTL-throttled (4s/scope) rather than removed — preserves the C-D2 "incremental on edit" contract; reindex forces |
| Retro transcript bodies | `intelligence/retro.ts` | SPEC §7.18 says "Claude Code transcripts" | v1 references processed `cc_inbox_queue` rows (path+count); full-body inclusion deferred |
| Chat proposal source | `intelligence/chat.ts` | `ProposalSource` union has no `chat` | Reused `source:'paste'` (a chat refinement is functionally a paste into review) to avoid widening the Phase-4 union |

---

## Open Questions

- [ ] **Gate→primary-unit attribution for sequencing deprioritisation** — SPEC v5.1 doesn't define how a gate failure maps to a primary unit (gate findings carry optional `ref`s, not unit ids). Interpreted: a unit is "failing gates" when a latest non-overridden fail/error firing has a finding `ref` resolving to an in-unit item; a project-wide failure naming no in-unit item does not blanket-deprioritise. Landing site: a spec clarification slice, or Phase 15/16 if a worked example forces it.
- [ ] **Companion-modes ↔ review-patterns relationship** (CODE_SPEC Q#6) — still an explicit spec gap; carried unchanged from Phase 13. Landing site: spec clarification slice.
- [ ] **GatesView/IntelligenceView multi-surface sprawl** — Phase-13 open question persists; `IntelligenceView` now also aggregates six sub-surfaces. Landing site: a UI-polish slice.

---

## Recently Resolved

- Phase-13 handover downstream note "Phase 14 (end-of-session retro / periodic review, §7.18, T-D22/T-D25) — consumer pending" — closed: retro + periodic-review consume the `session_start`/gate/drift audit + state substrates as anticipated.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- `items/`, `library/`, `sessions/`, `projects/`, `directives/` — entity reads for substrates/retro/sequencing.
- `drift/`, `github/orphan-rules`, `methodology/gates/runtime` — periodic-review hygiene + sequencing gate deprioritisation.
- `dump-zone/service` — chat propose-through-review.
- `semble/service` — RAG code substrate (Phase 11).
- `ai/anthropic`, `cost/telemetry`, `ai/fingerprint`, `ai/pricing`, `audit/log` — AI + cost + T-D24.

**Downstream (consumes this slice):**
- Phase 15 (cost meter) — `cost_telemetry` rows now produced by `rag_text`/`rag_audit`/`session_retro`/`periodic_review`/`stakeholder_view`/`chat`/`code_qa`.
- Phase 16 DoD — §11 RAG/intelligence bullets now checkable.

---

## Reference

- Spec / decisions / build-state docs: `SPEC.md` (§7.18, §7.19, §9), `CODE_SPEC.md` (C-D2, §14, §15), `DECISIONS.md` (T-D17, T-D22, T-D23, T-D25), `CHECKLIST.md` (Phase 14), `ROADMAP.md` (Phase 14).
- PR: #22 — https://github.com/jaydomains/throughline/pull/22
