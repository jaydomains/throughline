<!-- Template version: 1.0 -->

# Throughline — Phase 17 (Item mentions) Handover

**Generated:** 2026-05-18 (UTC, pre-merge — planned merge date)
**Last commit SHA:** see PR #30 head — branch `claude/throughline-phase-17-items-kJJNB` (PR not yet merged; update to merge SHA on merge). This handover is part of the Slice-5 commit, per authoring rule 1.
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-18-spec-clarification-q5-q6-q7-closeout.md` (Spec clarification — Q5/Q6/Q7 close-out)

ROADMAP Phase 17. Builds the cross-session-mention edge deferred by Pass 1b (DECISIONS WN-1b-a). Chunked-execution PR #30 — single branch, five slice commits + one inline Gitar fold-in. No SPEC.md functional change; no new T-D/C-D anchors. SPEC §7.11/§7.17 ratification is a deliberately separate follow-up clarification PR.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Mentions as a first-class relation (SPEC §7.11/§7.17; WN-1b-a) | built | `packages/shared/src/items.ts` `Item.mentions`; migration `0011_phase17_mentions.sql` | Join table `item_mentions`, mirrors `item_blockers` |
| Capture: a user references another item by ID in description text | built | `packages/backend/src/items/mentions.ts` `parseMentionRefs`; `items/service.ts` `syncMentions` in create+update | Explicit `@item:<id>` token; same-project resolution, self-ref dropped; unchanged-set short-circuit (no spurious write/audit) |
| All capture surfaces covered | built | `items/service.ts` create/update are the single chokepoint for all §7.6 surfaces (manual, dump-zone, voice, inbox, code-TODO, reconcile) | No per-surface code needed |
| Detail panel "Linked items" §7.17 (children/parents/mentioning/mentioned) | built | `ItemDetailPanel.tsx` four-group render; `GET …/items/:itemId/links` (`items.links()`); `api.getItemLinks` | Replaces the prior parent+sessions one-liner; clickable rows cycle the panel |
| GraphView mention edges (third edge type, SPEC §7.11) | built | `views/graph/layout.ts` `EdgeKind` +`'mentions'`, `buildGraph`; `graph.css` `.gv-edge.mentions`; `GraphView.tsx` legend | Non-structural — excluded from layering and "Show chains" |
| No SPEC.md functional edits this phase | built | `git diff` — SPEC.md untouched | §7.11/§7.17 ratification = separate follow-up PR |
| Suite green | built | backend 276/276, frontend 123/123; `pnpm -r lint`/`typecheck`/`build` clean | CHECKLIST §"Phase 17" |

CHECKLIST §"Phase 17 — Item mentions": all rows ticked. Pass-1b "Deferred — cross-session-mention edge" row flipped to resolved with a back-reference.

---

## Last Decision Minted

> No new T-D/C-D anchors minted (SESSION_START anchor convention). Phase 17 is the spec-author's resolution of working note **WN-1b-a** (option 1 — build mentions as a first-class relation). Two plan-mode decisions, user-approved before execution: (a) **data model** = `item_mentions` join table as a derived projection of description text (vs. JSON column / fully-derived); (b) **reference convention** = explicit `@item:<id>` token (vs. bare-id match / both). Implementation-shape detail recorded in `CODE_SPEC.md` §18 and `DECISIONS.md` WN-1b-a Resolution per the spec-drift policy. SPEC §7.11/§7.17 wording ratification deferred to a separate follow-up clarification PR (implementation settled first; not silently edited).

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/backend/src/db/migrations/0011_phase17_mentions.sql` — `item_mentions` join table + reverse index.
- `packages/backend/src/items/mentions.ts` — `parseMentionRefs` (`@item:<id>` regex, deduped).
- `packages/backend/test/mentions.test.ts` — parser + capture + `links()` cases.
- `packages/frontend/test/linkedItems.test.tsx` — detail-panel four-group + cycle.
- `docs/_meta/throughline/handovers/2026-05-18-phase-17-item-mentions.md` — this file.

**Modified:**
- `packages/shared/src/items.ts` — `Item.mentions`; `ItemLinkSummary`/`ItemLinks`.
- `packages/backend/src/items/service.ts` — `resolveMentions`/`currentMentions`/`syncMentions`; create+update wiring; `loadItemChildren`+`rowToItemWithChildren` hydration; `links(id)` (batched after Gitar fold-in).
- `packages/backend/src/items/routes.ts` — `GET …/items/:itemId/links`.
- `packages/frontend/src/api.ts` — `getItemLinks`.
- `packages/frontend/src/components/ItemDetailPanel.tsx` — four-group "Linked items".
- `packages/frontend/src/views/graph/layout.ts` — `'mentions'` edge kind; emission; layering skip.
- `packages/frontend/src/views/GraphView.tsx` / `views/graph/graph.css` — mention edge class + legend.
- `packages/frontend/src/styles.css` — `.linked-*` / `button.linkish`.
- Frontend test fixtures (`mockApi.ts`, `graphLayout`/`graphView`/`disciplineDriftItem`/`codeDrift` tests) — `mentions` field + `getItemLinks` mock + new cases.
- `CHECKLIST.md`, `CODE_SPEC.md` §18, `DECISIONS.md` WN-1b-a — docs.

**Deleted:** _none_.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Slice-2 N+1 in `links()` | `items/service.ts` | Plan's `links()` used per-id `getRow` + JS re-sort; Gitar flagged the N+1 | Folded inline: batched `WHERE id IN (...) ORDER BY created_at, id` (loadItemChildren convention); redundant child-id ORDER BY dropped. Resolved on PR #30 |
| `ItemDetailPanel` title is an `<input>` | `test/linkedItems.test.tsx` | Post-cycle assertion used `getByText` on the title; title renders in an input | Switched to `getByDisplayValue` |
| CODE_SPEC §18 stale `--gv-*` clause | `CODE_SPEC.md` | The §18 bullet still describes scoped `--gv-*` tokens, superseded by the UI-redesign WN-1b-c reconciliation | Left as-is — out of Phase 17 scope (no scope creep); noted here for a future docs-hygiene slice |

---

## Open Questions

- [ ] **`@item:<id>` discoverability.** The token convention has **no in-app discoverability** this phase — users learn it from the §7.17 SPEC ratification (the separate follow-up clarification PR). UI helpers (description-editor tips, autocomplete) are deliberately **deferred to v1.x**. Landing site: SPEC §7.17 ratification PR (convention text) + a v1.x UI slice (helpers).
- [ ] **SPEC §7.11/§7.17 wording ratification.** SPEC.md was not functionally edited this phase by instruction. The follow-up clarification PR ratifies the mention model + `@item:<id>` convention into §7.11/§7.17. Landing site: spec-author follow-up PR.
- [ ] **WN-1b-b — communication-model graph layer.** Still deferred (separate Phase 18). Untouched here. Landing site: Phase 18.
- [ ] CODE_SPEC §18 stale `--gv-*` clause (see Drift Flags) — docs-hygiene, out of scope here.

---

## Recently Resolved

- **WN-1b-a — cross-session-mention edge has no data model** — flagged in `2026-05-17-pass-1b-graphview.md` Open Questions and carried through the Pass-2 / Q5-Q7 handovers; resolved here (spec-author option 1, built in Phase 17). DECISIONS WN-1b-a Status flipped to "implemented in Phase 17"; CHECKLIST Pass-1b deferred row flipped.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):** `items.create`/`items.update` (the §7.6 capture chokepoint); `nanoid` id shape (parser regex); `ItemDetailPanel`/`onCycle`/`GraphView`/`buildGraph` existing contracts; `appendAudit`. All read-only/additive.

**Downstream (consumes this slice):** SPEC-author follow-up clarification PR (ratifies §7.11/§7.17 + `@item:<id>`); a v1.x UI slice (mention authoring helpers); any consumer reading `Item.mentions` or `…/items/:itemId/links`. No breaking API change — purely additive (`Item.mentions`, new endpoint, new edge kind).

---

## Reference

- Docs operated against: `SPEC.md` (§7.11, §7.17 — read-only, not edited), `CODE_SPEC.md` (§18), `DECISIONS.md` (WN-1b-a), `CHECKLIST.md` (Phase 17, Pass 1b), `SESSION_START.md`, `HANDOVER_TEMPLATE.md`.
- PR: #30 — https://github.com/jaydomains/throughline/pull/30
