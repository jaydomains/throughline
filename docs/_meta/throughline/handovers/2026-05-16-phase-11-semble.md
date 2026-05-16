<!-- Template version: 1.0 -->

# Throughline — Phase 11 (Semble integration) Handover

**Generated:** 2026-05-16 (UTC)
**Last commit SHA:** see PR head — branch `claude/throughline-phase-11-semble-n86yl` (PR not yet merged; update to merge SHA on merge)
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-16-spec-clarification-semble-wire-auth-lifecycle.md` (Spec Clarification — Semble wire / auth / lifecycle)

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Per-query `execFile` Semble invocation, keyless (C-D17, T-D27, SPEC §7.15) | built | `packages/backend/src/semble/client.ts`; `test/semble.test.ts` "semble client" | One-shot child, injectable exec; mirrors `ai/anthropic.ts` |
| Command from non-secret config (`THROUGHLINE_SEMBLE_CMD`, default `semble`) | built | `packages/backend/src/config.ts` `sembleCmd` | Joins `THROUGHLINE_*` family; not `secrets.json` |
| Done-time code linking (search by item title+description) | built | `semble/service.ts` `searchForItem`; route `POST .../items/:itemId/code-search`; `ItemDetailPanel.tsx` | Top results → confirm checklist |
| Confirmed locations stored as `item_code_refs` | built | `semble/service.ts` `confirmRefs`; `test/semble.test.ts` "confirm → item_code_refs row + audit" | Audit-logged, `source: semble` |
| Plain-English code Q&A (Semble + Anthropic summarisation, source links) | built | `semble/service.ts` `codeQa`; route `POST .../code-qa`; `LibraryView.tsx` `CodeQaPanel` | Library surface (spec-author decision); scratchpad stays AI-free per T-D20 |
| Dump-zone item-creation enrichment | built | `dump-zone/service.ts` `enrichItems`; `DumpZoneReviewModal.tsx`; `test/dumpZone.test.ts` "Phase 11 Semble enrichment" | Best-effort, never blocks extraction |
| Tier-3 code-drift fires as items accumulate refs | built | no tier-3 code change (`github/tiers.ts` already wired); `test/semble.test.ts` "tier-3 then fires" | Dormant→live once `confirmRefs` populates refs |
| Graceful degradation (SPEC §15) | built | `client.available()`/`search()` ENOENT→inert; `codeQa` no-key path; `test/semble.test.ts` degradation cases | No Semble ⇒ inert; no key ⇒ sources w/o summary |

---

## Last Decision Minted

> No new decisions minted. Implementation followed C-D17 (per-query `execFile`, keyless,
> capability-gated), T-D27, T-D13. Implementation-shape choices (assumed Semble CLI argv
> contract, library-only Q&A surface, code substrate served by a dedicated `code-qa`
> endpoint rather than folded into `library/service.ts` `semanticSearch()`) are recorded
> in code headers and this handover; none contradict C-D17 and none warrant a new anchor.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/shared/src/semble.ts` — wire types (`SembleHit`, `CodeSearchCandidate`, `ItemCodeRef`, `CodeQaResult`, request shapes).
- `packages/backend/src/semble/client.ts` — keyless per-query `execFile` client, injectable exec, tolerant JSON parser.
- `packages/backend/src/semble/service.ts` — done-time linking, code-ref persistence, code Q&A, repo-search helper.
- `packages/backend/src/semble/routes.ts` — code-search / code-refs CRUD / code-qa endpoints.
- `packages/backend/test/semble.test.ts` — client + service + tier-3 + degradation coverage.
- `docs/_meta/throughline/handovers/2026-05-16-phase-11-semble.md` — this handover.

**Modified:**
- `packages/shared/src/index.ts`, `capture.ts` — export semble types; `ProposedItem.suggested_code_refs`.
- `packages/backend/src/config.ts` — `sembleCmd` / `THROUGHLINE_SEMBLE_CMD`.
- `packages/backend/src/server.ts` — construct client+service, wire dump-zone `enrichItems`, register routes.
- `packages/backend/src/dump-zone/service.ts` — best-effort `enrichItems` hook.
- `packages/backend/src/library/service.ts` — `semanticSearch` stub comment clarifies code substrate served by `code-qa`.
- `packages/backend/test/dumpZone.test.ts` — enrichment test.
- `packages/frontend/src/api.ts` — `codeSearchItem` / `listItemCodeRefs` / `confirmItemCodeRefs` / `removeItemCodeRef` / `codeQa`.
- `packages/frontend/src/components/ItemDetailPanel.tsx` — Code references section.
- `packages/frontend/src/views/LibraryView.tsx` — "Ask the code" `CodeQaPanel`.
- `packages/frontend/src/components/DumpZoneReviewModal.tsx` — read-only suggested-code-refs row.
- `packages/frontend/src/styles.css` — Phase 11 surface styles.
- `CHECKLIST.md` — Phase 11 rows ticked with evidence.
- `ROADMAP.md` — Phase 11 wording reconciled to the execFile/keyless model (drift, below).

**Deleted:** _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| ROADMAP §Phase 11 residual "backend-managed local service" / "backend can spawn Semble" | `ROADMAP.md` | The prior spec-clarification corrected SPEC/CODE_SPEC/DECISIONS/CHECKLIST but its Files-Changed list did not include ROADMAP, leaving stale lifecycle wording | Reconciled Scope/Dependencies/Done-when to per-query `execFile` keyless model + cite C-D17; same drift class as that session's CHECKLIST fix; functional truth (SPEC §7.15) unchanged so within spec-drift policy |
| Code Q&A not folded into `library/service.ts` `semanticSearch()` | `library/service.ts` | C-D17 Implications name `semanticSearch()` as the code-Q&A plug-point, but its result type is `LibraryEntry[]`; Semble returns code chunks, not library rows | Code Q&A served by a dedicated `POST .../code-qa` endpoint; `semanticSearch` stays a Phase-14 text stub with a clarifying comment. Implementation-shape choice, no functional change |

---

## Open Questions

- [ ] Assumed Semble CLI contract (`<cmd> search --json --path <repo> --limit <n> -- <query>`, JSON/JSON-lines output) is based on public docs, not hands-on use. Verify against real MinishLab/semble before this surface is dogfooded; if it differs, the `THROUGHLINE_SEMBLE_CMD` override + a localised tweak to `parseHits`/argv in `semble/client.ts` absorb it — no SPEC change. Landing site: a follow-up verification slice or first dogfood session.
- [ ] `enrichItems` uses an unbounded `Promise.all` fan-out across Semble child processes (one `execFile` per proposed item). Acceptable at current scale (typical 1–3 items per extraction); flagged by Gitar review as "minor for future scale". Revisit with a concurrency cap if dogfooding surfaces a high-volume extraction case. Landing site: a perf pass or Phase 14.
- [ ] Dump-zone enrichment currently runs inline within `propose()` (best-effort, capped, never blocking) rather than truly post-return background; SPEC §7.15 says "background". Acceptable for v1 (suggestions are present when the modal opens); revisit if propose latency becomes an issue. Landing site: Phase 14 or a perf pass.

---

## Recently Resolved

- Semble client module shape & `THROUGHLINE_SEMBLE_CMD` wiring — both flagged Open in `2026-05-16-spec-clarification-semble-wire-auth-lifecycle.md`; resolved here (`semble/client.ts` + `config.ts`).
- Tier-3 dormancy — flagged across Phase 9/10 handovers as "dormant until Phase 11 populates refs"; tier-3 now fires once `confirmRefs` writes `item_code_refs` (test-verified).

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- `ai/anthropic.ts` — `AnthropicClient` for code-Q&A summarisation (capability-gated, cost telemetry + prompt fingerprint per T-D24/T-D29).
- `projects` / `items` services — repo path + item title/description for done-time search.
- External: MinishLab/semble CLI (assumed contract; see Open Questions).

**Downstream (consumes this slice):**
- `github/tiers.ts` tier-3 — now live once items have `item_code_refs` (no code change; consumer pre-built).
- Phase 14 (periodic review / personal RAG) — code substrate router will point at the `code-qa` endpoint; consumer pending.

---

## Reference

- Spec / decisions / build-state docs this slice operates against: `SPEC.md` (§7.15, §15, §10), `CODE_SPEC.md` (C-D17, §1, §4), `DECISIONS.md` (T-D27, T-D13, T-D24, T-D29), `CHECKLIST.md` (Phase 11), `ROADMAP.md` (Phase 11).
- PR: <link or number — fill on PR open>
