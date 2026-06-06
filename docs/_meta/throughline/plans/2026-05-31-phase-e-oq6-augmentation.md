# Phase E — OQ6 Augmentation: F-cluster build / descope / schedule resolution

- **Date:** 2026-05-31
- **Author session:** Phase E OQ6 planning — Session 1 / PLANNER (branch `claude/admiring-dijkstra-0hBh5`)
- **Status: DRAFT — under planner↔auditor review.** *(Draft→ready conversion is the overseer session's gate, not flipped here. The final-marker line is appended only after the auditor converges.)*
- **Base state:** `docs/_meta/throughline/plans/2026-05-30-phase-e-full-audit-close.md` (merged on `main` at `b215a05`, rev 3.1, 19-slice floor E1–E16 + E17a + E17 + E18). This artifact **appends** to that roster; it does not edit the merged base plan.
- **Scope (OQ6):** the spec author has ruled on a **subset of the E17 product-decision gate** (the audit-3 feature-completeness cluster). This plan encodes those rulings as: **3 build slices** (E19–E21), **4 descope spec-amendments** + **3 Phase-G-or-later register schedules** (E22), and **1 anchor-mechanism correction** to the base plan's E1 (the T-D60 ⊃ C-D2 supersession lands as a T-D60 note, **not** a C-D2 body edit).
- **Source of truth:** the five committed audit reports (`docs/_meta/throughline/audits/`), SPEC/CODE_SPEC/DECISIONS at `b215a05`, and **independent re-verification against current `main`** (file:line evidence cited per item below). Every code claim was read this session; none is inherited from the audit text or a compacted summary (per `AUTO_CONTINUE_WORKFLOW.md` § Pre-Flight State Verification).

> **Discipline note (per brief + `SESSION_START.md`).** This session does **not** make product decisions. OQ6 is the spec author's ruling, relayed via the overseer; it is encoded here as a **plan revision**, not a planner choice. Where this plan revises the base plan (the E1 C-D2 mechanism), the revision is the spec author's decision recorded — not the planner second-guessing the merged artifact.

---

## Relationship to the base plan's E17 gate

The base plan named E17 a **blessed mid-chain decision-gate (halt-class 9)**: the chain halts at E17 for the spec author to rule the audit-3 build/descope/schedule batch, and "any 'build' rulings append new slices." This plan **is** that append. It resolves **10 of the 11** feature-completeness items the base plan's E17 listed:

| Base-plan E17 item | Audit-3 sev | OQ6 ruling | Lands in |
|---|---|---|---|
| **F7-03** — §7.8 per-entry semantic search returns stub | Mod | **build** | **E19** |
| **F4-01** — session-start omits 2 of 7 declared inputs | Mod | **build** | **E20** |
| **F5-04** — dump-zone proposal has no primary-unit re-route | Mod | **build** | **E21** |
| **F5-02** — tree drag-drop-retag absent | Major | **descope** → SPEC amendment | **E22** |
| **F7-01** — §7.20 multi-list + AI consolidation export | Major\* | **descope** → SPEC amendment | **E22** |
| **F7-06** — §7.24 command palette partial | Major\* | **descope** → SPEC amendment | **E22** |
| **F7-07** — §7.24 list keyboard nav not bound | Mod | **descope** → SPEC amendment | **E22** |
| **F5-01** — tree grouping ships 3 of 5 dims | Major | **schedule** → Phase-G register | **E22** |
| **F5-03** — item-detail omits verifier-rules + git-context | Major | **schedule** → Phase-G register | **E22** |
| **F7-02** — §7.21 mermaid generation unimplemented | Major\* | **schedule** → Phase-G register | **E22** |

\* roadmap-scope caveat per audit-3's boxed note.

**Not covered by OQ6 (remains an open E17 decision item):** **F7-04** (§7.22 audit-log filters — time-range/actor/trigger-type, `audit/routes.ts:36-66`). OQ6 ruled the 10 items above; F7-04 is **not** ruled by OQ6 and stays in the base plan's E17 register awaiting a separate ruling. It is surfaced here, not silently dropped. (The audit-4 wrong-belief Lows, F6-02, F1-02, F3-01, and the minors register also remain open E17 items — OQ6 did not touch them.)

**Anchor-mechanism correction (separate from the 10):** OQ6 also corrects *how* the base plan's **E1** lands the T-D60 ⊃ C-D2 narrowing. See *Anchor-mechanism correction (E1)* below.

---

## Verification (independent re-check against `main` @ `b215a05`)

Each OQ6 build item and the anchor correction were read this session. Evidence:

### F7-03 → E19 (build the semantic-search stub)
- **Stub (verified):** `packages/backend/src/library/service.ts:396` — `semanticSearch(_request, _projectScope)` ignores both args and returns `{ entries: [], via: 'semantic-stub', truncated: false }`. The route (`library/routes.ts:202-212`, `POST /api/projects/:id/library/semantic-search`) is live and calls it. The stub comment ("lands Phase 14 (local embeddings via C-D2)") confirms the substrate it was always meant to bind to.
- **Spec basis (verified):** SPEC §7.8 — "All library entries support full-text search, **AI semantic search (routed to Semble for code-related queries, local embeddings for text-content queries)**, tag filtering, and pinning." Semantic search is spec-mandated, not advisory; the stub contradicts it → **bug-class** under the base plan's classification rule once the spec author rules "build."
- **Substrate already exists (verified):** `intelligence/text-index.ts` is the C-D2 text index — it gathers and embeds library entries (`entity_type:'library'`, `:97-101`, `gather()`), exposes `query(projectId, text, k): Promise<TextHit[]>` (`:42`) doing cosine top-k (`cosine` from `embeddings.ts`), and is incrementally fresh via `ensureFresh`. **E19 wires the stub to this existing index** — it does not build an embedding pipeline from scratch.

### F4-01 → E20 (wire the 2 missing session-start inputs)
- **Code (verified):** `methodology/session-start/engine.ts` `assemble()` produces `AssembledContext` with **5** context surfaces — `openItems`, `decisions`, `anchors`, `markers`, `dependencies`, `includeBlocks` (flagged include-blocks). It does **not** assemble project-spec excerpts or an execution-plan slice.
- **Spec basis (verified):** SPEC §7.34 (line 392) — "session-start scaffolding assembles the right context (**project spec** + relevant decisions + active anchors + open markers + **execution-plan slice** + cross-primary-unit dependencies)". Seven declared inputs; the code wires five. The **two missing** are exactly **project-spec excerpts** and the **execution-plan slice** — matching audit-3 F4-01 ("omits 2 of 7 inputs … project-spec excerpts + execution-plan slice", Seg 4).

### F5-04 → E21 (dump-zone primary-unit re-route)
- **Code (verified):** `packages/shared/src/capture.ts` — `ProposedItem` carries `target_session_id` (cross-**session** re-route) and `type`/`status`/`tags`, but **no primary-unit field**. `ProposalPayload` carries `suggested_session_id` but **no suggested-primary-unit**. There is no auto-routing of a proposal to a primary unit anywhere in the proposal contract.
- **Spec basis (verified):** SPEC §7.6 — "Session dump zone … AI extracts items, classifies according to the methodology's item types, suggests tags, asks clarifying questions, **suggests target session and primary unit**." The proposal wires "target session" but not "primary unit." Primary unit is the bundle's `project_layout.primary_unit` (`items/service.ts:371`); items already carry `primary_unit_refs` (`items/service.ts:201`, `item_primary_unit_refs` table). The wiring exists item-side; only the **proposal/re-route** is missing.

### Anchor-mechanism correction (E1) — T-D60 ⊃ C-D2
- **C-D2 body (verified):** `CODE_SPEC.md:43-57` — "C-D2 — Local embeddings via Transformers.js", Status `active (implementation-only)`. Its Implications sanction the offline substrate. The **silent SHA1 fallback** is at `intelligence/embeddings.ts:54` (`createHash('sha1')`, the `fallbackEmbedder` `kind:'fallback'`, `:63-64`) reached by the **bare `catch`** at `:108-111` (`catch { resolved = fallbackEmbedder; return fallbackEmbedder; }`).
- **The audit-3 blessing (verified):** `audits/2026-05-28-audit-3-functional-correctness.md:81` (§ "Intentional evolutions") — "**C-D2 offline deterministic embedding fallback when `@xenova/transformers` absent** (matches the codebase's capability-gating discipline) … tagged by Segment 7 as 'shipped exceeds/diverges-but-intentional.'" This is the blessing OQ6 directs T-D60 to **supersede**.
- **Base-plan E1 currently says (verified):** `2026-05-30-phase-e-full-audit-close.md:250` — E1's "C-D2 amendment" step: "**edit the C-D2 body in `CODE_SPEC.md`** … with a `> Amendment (…) superseded-in-part by T-D60` block." OQ6 **revises this mechanism** (see below).

---

## Anchor-mechanism correction (E1) — land the C-D2 narrowing as a T-D60 note, not a C-D2 body edit

**OQ6 ruling (spec author, relayed):** T-D60 supersedes **audit-3's blessing** (audit-3:81) of the C-D2 silent SHA1 embedding fallback. C-D2 is narrowed to **"capability-absent honest-distinct mode" only** (the embedder may operate as an *honestly-disclosed* capability-absent mode, never as an undisclosed silent substitute). **The narrowing lands as a T-D60 supersession note — NOT a direct C-D2 body edit.**

**Why this is a revision, not a fresh choice.** The base plan's E1 (line 250) directs E1 to *edit the C-D2 body* in `CODE_SPEC.md`. OQ6 changes the **landing mechanism**: the supersession is recorded in T-D60 (in `DECISIONS.md`, the canonical T-D home per `SESSION_START.md`), with C-D2's body left intact and pointed-at by the T-D60 note. Per `SESSION_START.md` anchor conventions ("T-D anchors live in `DECISIONS.md` … C-D anchors live in `CODE_SPEC.md`") and the supersession idiom ("anchors move `active → superseded`"), the cleaner record is a **superseding T-D60 note that names what it supersedes** (both the C-D2 offline-fallback sanction *and* the audit-3:81 blessing of it) rather than mutating a `(implementation-only)` C-D body in place.

**What E1 must do under this correction (replaces base-plan E1 line 250's "edit the C-D2 body" step):**
1. Mint **T-D60** in `DECISIONS.md` (+ `SPEC.md §14` index row; refresh `CODE_SPEC.md:9` count 59→60) as the broad refuse-rather-than-fallback principle (unchanged from LBD-1).
2. T-D60's body carries an explicit **supersession note**: *"T-D60 supersedes-in-part C-D2's offline-fallback sanction and the audit-3 (2026-05-28 §"Intentional evolutions", line 81) blessing of the silent SHA1 fallback. C-D2 is narrowed to capability-absent **honest-distinct** mode only: the fallback embedder may operate only when its `embedder:'fallback'` state is disclosed on the shared `RagQueryResult`/`RagReindexResult` contract (T-D59); the undisclosed silent substitution is removed."*
3. **C-D2's body is NOT edited.** Its `Status` line may carry a one-line pointer (`active — narrowed-in-part by T-D60; see DECISIONS.md`) **only if** the spec author wants the cross-reference discoverable from `CODE_SPEC.md`; the *substantive* narrowing text lives in the T-D60 note. *(This pointer is a status-line cross-reference, not a body edit. If the auditor reads even the pointer as a "body edit," drop it — the T-D60 note alone is sufficient and is the OQ6-mandated home.)*
4. The **code change is unchanged** from base-plan E1: remove the undisclosed silent fallback at `embeddings.ts:108-111`; surface `embedder:'fallback'` on the shared contract; refuse + surface on unexpected runtime/resolution failure (S4-03).

**Traceability:** this correction modifies only the **doc/anchor mechanism** of base-plan E1; the code surface, the regression tests, and the T-D60 reach/wire-shape (LBD-1a/b, broad/on-contract) are unchanged. Session 3 applies this correction when it executes E1. It is restated in **E22's deliverables** so a single OQ6 doc-slice carries the audit trail, but the actual landing is in E1.

---

## New slices (continuing from the roster tail E19)

> Convention (inherited from base plan): paired regression test in the **same** slice; backend tests mirror `packages/backend/src/<path>` under `packages/backend/test/<path>`; frontend tests under `packages/frontend/test/`; wire-shape changes land in `packages/shared/src/` and are **verified, not cast** (T-D59).

### E19 — Library per-entry semantic search (build F7-03)
- **Closes:** F7-03 (Mod). **Class:** bug (spec §7.8 mandates it; the stub contradicts the spec → bug once "build" is ruled).
- **Verified current:** `library/service.ts:396` returns `{entries:[],via:'semantic-stub',truncated:false}`; route live at `library/routes.ts:202-212`.
- **Fix:** wire `semanticSearch` to the existing C-D2 text index (`intelligence/text-index.ts`): embed the query, cosine top-k over `text_embeddings` rows scoped to `entity_type:'library'` for the active project, map the `TextHit[]` back to `LibraryEntry` rows, honour the request's `limit`/scope, and set `via:'semantic'` (replacing `'semantic-stub'`). Code-related queries stay on the dedicated Semble `code-qa` endpoint (per the stub comment) — E19 builds **only** the text-content path SPEC §7.8 names.
- **T-D60 dependency (honesty):** the index's embedder can be in capability-absent/fallback mode (E1). Semantic search must **not** silently return `[]` or fallback-quality hits as if real — it surfaces the embedder state honestly (e.g. `via:'fallback'` or a degraded marker on the result), per T-D60. **→ E19 lands after E1** (T-D60 + the `embedder` disclosure on the shared contract).
- **Files:** `library/service.ts`, `library/routes.ts` (if the result shape widens), `packages/shared/src/library.ts` (the `via` enum / degraded marker — verified, not cast), wiring to `intelligence/text-index.ts`. **Tests:** `test/library/semantic-search.test.ts` — query returns ranked library hits; embed-fail/ fallback-mode surfaces honestly (not silent empty); empty-corpus ≠ fallback.
- **Anchor:** none (reuses C-D2 substrate + cites T-D60). **Deps:** **E1 merged.** **Est. LOC:** 110–170.

### E20 — Session-start full inputs (build F4-01)
- **Closes:** F4-01 (Mod). **Class:** bug (SPEC §7.34 declares 7 inputs; the engine wires 5 → contradicts spec once "build" is ruled).
- **Verified current:** `session-start/engine.ts` `assemble()` yields `openItems`/`decisions`/`anchors`/`markers`/`dependencies`/`includeBlocks`; no project-spec excerpts, no execution-plan slice.
- **Fix:** assemble the two missing inputs into `AssembledContext` and the rendered prompt + the cache fingerprint (`fp.update(...)`):
  - **Project-spec excerpts** — pull relevant SPEC/CODE_SPEC excerpts for the active project (scoped to the open items' cited anchors / sections, so it is excerpt-not-dump). Source the project's spec docs through the existing project-doc surface (the same ingested-doc substrate the RAG layer reads), not a new ingestion path.
  - **Execution-plan slice** — surface the active execution-plan slice for the session (the current phase/slice context). Bind to whatever the bundle/methodology exposes as the execution-plan unit; for freeform/single-type bundles with none, the slice is empty (degrades cleanly, matches the decision-types `slice(1)` precedent at `engine.ts`).
  - Both new surfaces feed the `inputFingerprint` so a stale render can never be served from cache (mirror the existing `fp.update` discipline).
- **Honesty note:** if either source is unavailable for a project (no spec docs ingested; no execution-plan unit declared), the surface is **honestly empty**, not silently dropped — consistent with the base plan's E2 session-start honesty posture (`classifier_used_ai` truthfulness). No T-D60 anchor needed; the principle applies.
- **Files:** `methodology/session-start/engine.ts`, `packages/shared/src/` (the `AssembledContext` shape — verified, not cast), the session-start template(s) if the two surfaces render as named blocks. **Tests:** `test/methodology/session-start/full-inputs.test.ts` — both surfaces present when sources exist; absent-source → empty surface (not error, not silent omission); fingerprint changes when either surface changes.
- **Anchor:** none. **Deps:** independently mergeable; soft rebase coupling with base-plan E2 on `session-start/engine.ts` (E2 touches the classifier path) — **second slice into `engine.ts` inherits a rebase.** **Est. LOC:** 120–180.

### E21 — Dump-zone primary-unit re-route (build F5-04)
- **Closes:** F5-04 (Mod). **Class:** bug (SPEC §7.6 says the dump zone "suggests target session **and primary unit**"; only target-session is wired → contradicts spec once "build" is ruled).
- **Verified current:** `shared/src/capture.ts` `ProposedItem` has `target_session_id` but no primary-unit field; `ProposalPayload` has `suggested_session_id` but no suggested-primary-unit; no proposal→primary-unit routing exists.
- **Fix:** add a **primary-unit re-route** to the proposal contract and the review-modal apply path:
  - Extend `ProposedItem` with a `target_primary_unit_ref: string | null` (and `ProposalPayload` with a `suggested_primary_unit` analogous to `suggested_session_id`), defaulting to the extractor's suggestion or the bundle's `project_layout.primary_unit`-derived default.
  - The extractor (`md-ingest`/dump-zone service) **suggests** a primary unit by type; the review modal lets the user **re-route** before apply; apply writes the chosen primary unit to the created item's `primary_unit_refs` (`item_primary_unit_refs`, the table `items/service.ts:201` already reads).
  - **Bundle-agnostic:** the freeform bundle declares no primary unit (SPEC §85, `items/service.ts:371-372` already guards `if (!primaryUnit)`); for such bundles the re-route surface is absent/empty — no primary-unit vocabulary baked, consistent with the engine's existing bundle-agnostic posture.
- **Files:** `packages/shared/src/capture.ts` (the proposal contract — verified, not cast), the dump-zone extraction service (suggest), the apply path in `items`/dump-zone service (persist `primary_unit_refs`), `packages/frontend/` review-modal component (the re-route control). **Tests:** `test/` — proposal carries a suggested primary unit for a primary-unit bundle; re-route persists to `primary_unit_refs` on apply; freeform bundle → no re-route surface, apply still succeeds.
- **Anchor:** none. **Deps:** independently mergeable (touches the capture contract, not E1's surfaces). **Est. LOC:** 130–190.

### E22 — OQ6 scope-ruling ratification (descopes + Phase-G register + E1 correction record)
- **Class:** product-decision **resolution** (the spec author has ruled; this slice *ratifies* the rulings into SPEC + a register — it bakes no new choice). **Deliverable:** SPEC amendments + a Phase-G register + the E1 anchor-correction record. **No functional code.**
- **(a) Four descope SPEC amendments** — mark each feature **out-of-scope for v1**, with rationale and a deferral pointer, at its SPEC home (a `> Descoped (2026-05-31, OQ6): …` block, mirroring the spec-amendment idiom; do **not** delete the prose — meaning-preserving, so SPEC and code agree per `SESSION_START.md` spec-drift policy):
  - **F5-02** — tree drag-drop-retag (SPEC §7 tree surface). Descoped: retag is available via item edit; drag-retag is a v1.1 affordance.
  - **F7-01** — §7.20 multi-list + AI consolidation export. Descoped: `/api/backup/export` covers the export need for v1; multi-list AI consolidation deferred.
  - **F7-06** — §7.24 command palette (partial). Descoped: the partial palette (`CommandPalette.tsx:40-86`) is the v1 surface; full-command coverage deferred.
  - **F7-07** — §7.24 list keyboard navigation. Descoped: pointer navigation is the v1 surface; keyboard-nav binding deferred.
- **(b) Three Phase-G-or-later register schedules** — add to a new **"Phase G or later" register** (a section in this plan + a forward-pointer row in `ROADMAP.md §12`/deferred or `PLATFORM_STATUS.md`, per the base plan's "schedule items go to a Phase G register" mechanism). These are *scheduled, not descoped* — the spec prose stays as-is (the feature is still intended), only sequenced later:
  - **F5-01** — tree grouping (ships 3 of 5 dims, `TreeView.tsx:10`) → complete the remaining 2 dims in Phase G.
  - **F5-03** — item-detail verifier-rules + git-context sections (`ItemDetailPanel.tsx:691` "Phase 10" placeholder) → Phase G.
  - **F7-02** — §7.21 mermaid generation (unimplemented) → Phase G.
- **(c) E1 anchor-mechanism correction (record only)** — restate the *Anchor-mechanism correction (E1)* above so the OQ6 audit trail is in one doc slice. The actual T-D60-note landing happens in **E1** (Session 3), not here; E22 only records that base-plan E1 line 250's "edit the C-D2 body" step is **superseded** by "land a T-D60 supersession note; do not edit the C-D2 body."
- **(d) Residual surface** — record that **F7-04** and the other un-ruled E17 items remain open (not closed by OQ6).
- **Files:** `SPEC.md` (4 descope blocks + §14 untouched), `ROADMAP.md §12` or `PLATFORM_STATUS.md` (Phase-G register pointer), this plan (registers + E1 correction record). **Tests:** none (doc/spec slice; green gate = `build`/`lint` only). **Deps:** none functional; should land in the chain alongside or after E19–E21 so the "build" rulings and the "descope/schedule" rulings ratify together. **Est. LOC:** doc only.

---

## Roster reconciliation

| Segment | Slices | Count |
|---|---|---|
| Base plan (merged, `b215a05`) | E1–E16 + E17a + E17 + E18 | 19 (floor) |
| **OQ6 builds (this plan)** | **E19, E20, E21** | **+3** |
| **OQ6 ratification (this plan)** | **E22** | **+1** |
| **New floor** | E1–E22 | **23** |

- **E19–E21 are the "build" rulings the base plan's E17/halt-9 anticipated** ("any 'build' rulings append new slices"). They appear past the roster tail exactly as the base plan's Sizing-honesty section predicted: `19 + N(builds)`, here `N=3`, plus the E22 ratification doc-slice → 23. This **breaches the brief's 20-slice envelope** — which the base plan explicitly flagged as possible-and-acceptable ("the committed roster is `19 + N(builds)` and may breach 20 … knowable only after the E17 ruling"). The breach is the *expected* outcome of a 3-build ruling, not a sizing error.
- **No new anchors.** E19–E21 mint **zero** T-D/C-D anchors (E19 reuses C-D2 + cites T-D60; E20/E21 cite existing decisions). E22 mints none. Per the base plan's halt-class 5, any anchor a build slice turns out to need beyond the base plan's three (T-D60/C-D25/C-D26) **trips a halt** — surfaced, not minted silently. The E1 correction does not add an anchor; it changes T-D60's *landing*, and T-D60 was already planned.
- **Sequencing:** E19 depends on **E1 merged** (T-D60 honesty contract). E20/E21/E22 are independently mergeable; E20 has a soft rebase coupling with base-plan E2 on `session-start/engine.ts`. None of E19–E22 runs in parallel with a base-plan slice that writes the same file (the base plan's shared-file rebase-coupling rule extends to: `engine.ts` E2↔E20; `embeddings.ts`/`text-index.ts` E1↔E19; `capture.ts`/dump-zone E21 is independent).

---

## Halt classes (inherited)

This augmentation runs under the **same halt-class set** the base plan blessed (standard three + extensions 4–9, spec-author-blessed 2026-05-30). Specifically relevant here:
- **Halt-5 (unplanned anchor):** if E19/E20/E21 needs a T-D/C-D beyond T-D60/C-D25/C-D26 → halt, surface. Not expected (all three reuse existing decisions).
- **Halt-4 (estimate breach):** if any build slice's diff exceeds its LOC band by >50% → halt, re-slice. E21 (proposal contract + extractor + apply + frontend) is the most likely to breach — peel the frontend re-route control into a follow-on slice if it does.
- **Halt-1 (spec drift):** E19/E20/E21 each *close* a spec contradiction (the spec already mandates them); no drift. The E22 descopes are the sanctioned spec-amendment landing (not silent drift). The E1 correction is the sanctioned T-D60 landing.
- **Doc codification** of these extensions into `AUTO_CONTINUE_WORKFLOW.md` remains deferred to the **chain-close cohort hardener** (base-plan provenance note) — not edited mid-chain.

---

## What this plan does NOT do

- It does **not** flip draft→ready or merge — the overseer's gate.
- It does **not** execute any slice — authorship/revision only.
- It does **not** resolve F7-04 or the other un-ruled E17 items — OQ6 did not rule them; they stay open.
- It does **not** edit the merged base plan (`2026-05-30-phase-e-full-audit-close.md`) — the E1 correction is recorded here and applied by Session 3 at execution.
- It does **not** edit the C-D2 body — the OQ6 mandate is a T-D60 supersession note (the whole point of the anchor-mechanism correction).

---

## Convergence protocol (planner↔auditor)

Per the dispatch brief: this plan opens as a **DRAFT PR**; the planner subscribes and iterates with the auditor via PR comments — **revise** (commit + reply) or **justify** (reply only). Round-trips tracked per thread; **escalate to the spec author (via overseer) at 5 round-trips** on any thread. On every revision, an **audit-ID set-diff gate** runs vs the prior revision (finding IDs extracted from rev-N and rev-(N-1); drops surfaced/restored). Ground truth is `git ls-remote` + diff, never the event body. A wake-log line is committed alongside each review action (`phase-e-oq6-augmentation-wake-log.md`) to force a wake event. When all threads resolve, the planner appends the final-marker line and posts an explicit approval comment; the planner's role then ends. **Draft→ready + merge remain the overseer's gate.**

---

*Status line (updated on convergence): — DRAFT, awaiting auditor round 1.*
