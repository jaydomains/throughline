# Phase E — Augmentation: Three Feature Builds + E17-Ruling Close (OQ6)

- **Date:** 2026-05-31
- **Author session:** Phase E augmentation planning (OQ6) — branch `claude/bold-pasteur-7wdTS`. Three-session pipeline (planner / auditor / overseer); this is the planner artifact.
- **Status: final — approved by planner (2026-05-31).** All auditor findings **A1–A8 resolved** (Session-2 converged at round 4); all spec-author rulings encoded (E17 build/descope/schedule dispositions; A7 designated-direct-read source; identifier = dedicated `project_spec`; placement = library-entry via **T-D10 amendment**, no carve-out). Audit-ID set-diff gate held across every revision (0 added / 0 dropped; roster floor 22). **Draft→ready conversion and merge remain the overseer session's gate — not flipped here.**
- **Base:** `docs/_meta/throughline/plans/2026-05-30-phase-e-full-audit-close.md` — the merged Phase E plan on `main` (verified `origin/main` = `b215a05`, the PR #85 merge; the plan file is present at that tree). 19-slice floor (E1–E16 bug-fix + E17a dep-remediation + E17 product-decision gate + E18 closure-verification).
- **Scope (OQ6):** encode the spec author's ruling on the Phase E **E17 product-decision gate (LBD-4, halt-class 9)** for the audit-3 F-cluster, and refine the E1 anchor-amendment mechanism:
  1. **Three feature builds** → appended as new slices **E19 (F7-03 per-entry semantic search)**, **E20 (F4-01 session-start full inputs)**, **E21 (F5-04 dump-zone primary-unit re-route)**.
  2. **Four descopes** → spec amendments landed inside the E17 slice: **F5-02** (tree drag-retag), **F7-01** (multi-list AI export), **F7-06** (full command palette), **F7-07** (list keyboard navigation).
  3. **Three scheduled** → a new **"Phase G or later" feature register** seeded inside E17: **F5-01** (tree grouping), **F5-03** (detail-panel sections), **F7-02** (mermaid generation).
  4. **One anchor amendment** → **T-D60 supersedes audit-3's blessing of the C-D2 silent SHA1 embedding fallback**; **C-D2 is narrowed to "capability-absent honest-distinct mode" only**, landed as a **T-D60 supersession note — NOT a direct C-D2 body edit** (this *revises the mechanism the base plan's E1 specified*).

> **What this artifact is.** It is the **encoding of the E17 gate ruling** (per the base plan: "chosen 'build' items become new appended slices, 'descope' items become targeted SPEC amendments, 'schedule' items go to a Phase G register, 'accept' items are documented") plus a single mechanism correction to E1. It **appends to** the base roster; it does not restate or supersede E1–E18, E17a, or E18 except for the named E1 mechanism revision. Section §"Anchor amendment" is the only place it overrides base-plan text.

---

## Provenance / preconditions checked (verify-before-write)

- **Base plan location verified.** `git ls-remote --heads origin` → `refs/heads/main = b215a05`; the base plan file is on that tree. This PR's diff is: the new augmentation artifact (this file) + a planner/auditor wake-log pair + **two one-line forward-pointer annotations to the base plan** at LBD-1c (line 167) and E1 detail (lines 250-251), added as the executor-coordination delivery mechanism for the anchor amendment (auditor A1; see §"Anchor amendment"). The base-plan edits are additive redirect notes only — no decision or roster content is changed.
- **Reconciliation doc `2026-05-30-phase-e-plan-A-vs-B.md`:** **not committed** (checked `docs/_meta/throughline/plans/` — only the base plan, `phase-e-audit-approval.md`, `phase-e-audit-wake-log.md` are present). The base plan's own *Provenance note* already records the PR #84 parallel track and the spec-author-accepted doc-PR collision; nothing in this augmentation depends on the A-vs-B reconciliation.
- **E17 ruling source:** the OQ6 dispatch (spec author via the overseer). This is exactly the **LBD-4 mid-chain decision gate** the base plan priced in (halt-class 9, blessed) — "any 'build' rulings append new slices." This artifact is that append.
- **Anchor impact (SPEC-AUTHOR RULED, 2026-05-31; A8 closed).** E19 and E21 mint no anchor (reuse C-D2/T-D60/C-D9). The E1 anchor-amendment refines only the *mechanism* of the already-planned T-D60 mint + C-D2 narrowing. **E20 carries a T-D10 amendment** — `project_spec` is added as a fifth library content type (library-entry stratum, one-per-project), keeping T-D47 (bundle-owned core item types) intact; **no new anchor number is minted** and **no methodology-agnostic carve-out** is introduced. Halt-class-5 fired (E20 needed an anchor beyond the planned T-D60/C-D25/C-D26) and is **resolved by the ruling** — surfaced via auditor A8, not silently absorbed.

---

## Verification (re-verified against current `main` = `b215a05`, file:line)

### The three builds

**E19 / F7-03 — per-entry semantic search is a permanent stub.**
- `packages/backend/src/library/service.ts:396-403` — `semanticSearch(_request, _projectScope)` returns `{ entries: [], via: 'semantic-stub', truncated: false }` unconditionally; the comment (`:23-24`, `:397-401`) names it a stub awaiting "Phase 14 (local embeddings via C-D2)."
- `packages/backend/src/library/routes.ts:202-211` — `POST /api/projects/:id/library/semantic-search` exists and calls `service.semanticSearch`; the route is live so "the frontend cross-substrate router binds today."
- **Substrate already exists.** `packages/backend/src/intelligence/text-index.ts` `createTextIndex` exposes `search(projectId, query, k): Promise<TextHit[]>` (`:35-44`, impl `:208-250`); `IndexedEntity.entity_type` is `'item' | 'library'` (`:19-25`) and the embeddings table already indexes library entries (CODE_SPEC §"Text (C-D2)" line ~1005: "top-k cosine over **library entries** + item descriptions + ingested project doc chunks"). The wiring gap is solely: route the library semantic-search at the *library-entry* substrate, not return a constant empty.
- **Spec basis:** SPEC §7.8 line 234 — "All library entries support … **AI semantic search (routed to Semble for code-related queries, local embeddings for text-content queries)**." Audit-3 F7-03 (`audits/2026-05-28-audit-3-functional-correctness.md:55`): the §7.8 per-entry semantic search "isn't delivered on its own surface."
- **Honesty dependency:** `text-index.ts:236` `if (!qv) return []` collapses embed-failure into honest-empty (distinct from the legitimate-empty path one line up, `:234` `rows.length === 0`) — this is **SF3-02**, fixed in **E1** to distinguish embed-failure from genuine-empty, and the embedder's silent SHA1 fallback is removed by **T-D60** (E1). So F7-03 must consume the **post-E1** honest embedder: an absent/degraded embedder yields a *disclosed* degraded result, never silent garbage or healthy-empty. **E19 depends on E1 merged.**

**E20 / F4-01 — session-start pulls 5 of 7 declared inputs.**
- `packages/backend/src/methodology/session-start/engine.ts` — `AssembledContext` (`:80-93`) carries `openItems`, `decisions`, `anchors`, `markers`, `dependencies`, `includeBlocks` and **no** spec-excerpt or execution-plan field; `assemble()` (`:193-247`) gathers exactly those; the render call (`:359-370`) passes `open_items_list`/`decisions_block`/`anchors_block`/`markers_block`/`dependencies_block` — **no** spec or execution-plan block.
- **Spec basis:** SPEC §7 line 392 — session-start assembles "**project spec** + relevant decisions + active anchors + open markers + **execution-plan slice** + cross-primary-unit dependencies." CODE_SPEC C-D9 step 2 (line 320) enumerates the implementation contract identically: "retrieve: **project spec excerpts**, decisions …, active anchors and open markers, **execution-plan slice for the chosen mode**, cross-primary-unit dependencies, and any items carrying include-in-prompt directives (T-D12)." Audit-3 F4-01 (`engine.ts:196-246`): omits 2 of 7 — **project-spec excerpts + execution-plan slice**.
- **Source-of-data verified:** *Execution-plan slice* — the bundle declares an `execution_plan` template (`packages/shared/src/bundle.ts:146`, parsed at `bundle-parser/templates.ts:40`). **It is a single bundle-global optional string, NOT mode-keyed** — the only mode-keyed template field is `session_start_by_mode` (`bundle.ts:148`), which `templateFor` (`engine.ts:122-123`) already uses for *template selection*. So C-D9 step 2's "execution-plan slice **for the chosen mode**" is satisfied by mode-driven *template selection*, not by any per-mode `execution_plan`: E20 includes the whole `execution_plan` string when present (absent for freeform / no-`execution_plan` bundles → block omitted gracefully). There is **no** per-mode `execution_plan` to read; see A2 disposition in E20 detail. *Project-spec excerpts* — **spec-author ruled (A7, 2026-05-31):** the canonical source is a **designated project-spec library item, read directly** — **NOT** the ingested-doc/RAG substrate. There is **no** first-class `Project.spec` field today (`packages/shared/src/project.ts:10-31`), so *marking an item canonical* may be a small net-new (project-level config field or item-type designation — identifier TBD; see E20 detail). E20 reads that designated item directly and includes its content; it runs **no** semantic/substrate query for the spec source. E19 may still *index* that item as part of its searchable corpus, but **E19 does not gate E20** — they remain **independent siblings** (see Sequencing). The open residual is now only the **item identifier**, surfaced to the spec author.

**E21 / F5-04 — dump-zone proposal has no primary-unit suggestion/route.**
- `packages/shared/src/capture.ts` — `ProposedItem` (`:18-37`) carries `target_session_id` (cross-session re-route, `:25`) but **no** primary-unit field; `ProposalPayload` (`:48-60`) carries `suggested_session_id` (`:57`) but **no** `suggested_primary_unit`. The file-header comment (`:13-16`) names cross-session re-route as the captured routing axis; primary-unit routing is absent.
- **Spec basis:** SPEC §7.6 (Session dump zone, line ~202) — "AI extracts items, classifies …, suggests **target session and primary unit**." Audit-3 F5-04 (line 133): "dump-zone proposal has no primary-unit re-route (`shared/src/capture.ts:25`)."
- **Primary-unit representation verified:** items carry `methodology_context.primary_unit_refs: string[]` (`packages/shared/src/items.ts:7`); the bundle declares `primary_unit: PrimaryUnitSpec | null` (`packages/shared/src/bundle.ts:21`); refs persist in `item_primary_unit_refs` (`packages/backend/src/items/service.ts:91`). Routing-by-primary-unit therefore means: the extractor suggests a `primary_unit_ref` per proposed item, editable in the review modal, written to the item's `primary_unit_refs` on apply. Freeform bundles (`primary_unit: null`) → suggestion absent, no routing (graceful).

### The four descopes (SPEC homes)

- **F5-02 (tree drag-retag):** SPEC §7.11 line 268 — "Drag-drop between folders re-tags items." Code: `packages/frontend/src/views/TreeView.tsx` has no drag/drop handlers (grep clean). Audit-3 F5-02: "tree drag-drop-retag absent."
- **F7-01 (multi-list AI export):** SPEC §7.20 lines 405-409 (multi-select combine + AI consolidation). Audit-3 F7-01: "§7.20 multi-list + AI consolidation export unimplemented (only `/api/backup/export`)."
- **F7-06 (full command palette):** SPEC §7.24 line 432 (jump to any project/session/item/library/directive/primary-unit/gate; run new-item/reconcile/export/switch-view/switch-project/settings). Code: `packages/frontend/src/components/CommandPalette.tsx` `PaletteItem.kind` is `'project' | 'view' | 'action'` (`:12`) with only project-open / view-jump / projects-list actions (`:40-86`) — partial. Audit-3 F7-06 (Major*).
- **F7-07 (list keyboard navigation):** SPEC §7.24 line 434 (tab/shift-tab indent, arrow nav, Enter edit, Esc close, `?` reference). Code: `TreeView.tsx` rows are `role="button" tabIndex={0} onClick` (`:48-56`) — focusable but **no** key handlers (no `onKeyDown`/arrow/Enter/Esc bindings). Audit-3 F7-07 (Mod).

### The three scheduled (Phase G or later)

- **F5-01 (tree grouping):** SPEC §7.11 line 268 — five grouping dims (by **tag, session, primary unit, status, blocker**). Code: `TreeView.tsx:10` `type GroupBy = 'status' | 'tag' | 'parent'` (the `<select>` at `:31-37` offers status/tag/parent) — ships **2 of the 5 spec dims** (status, tag) **plus a non-spec `parent` dim**; missing the spec dims **session, primary unit, blocker**. (Audit-3 F5-01 framed it "3 of 5" by counting `parent` as a spec dim, which it is not.)
- **F5-03 (detail-panel sections):** `packages/frontend/src/components/ItemDetailPanel.tsx:691` — `<p class="muted">Verifier rules · PR/git context: Phase 10.</p>` placeholder; verifier-rules + git-context sections absent. Audit-3 F5-03 (Major).
- **F7-02 (mermaid generation):** SPEC §7.21 lines 412-414 (mermaid as export format, AI-generated). Unimplemented. SPEC §9 line 545 already prices the model ("Mermaid generation | User triggers export | Sonnet"). Audit-3 F7-02 (Major*).

### The anchor amendment

- **C-D2 body:** `CODE_SPEC.md:43-65` — Decision/Rationale/Implications describe local Transformers.js embeddings; the body itself **does not** specify a SHA1 substitute. The silent SHA1 fallback lives in **code**: `packages/backend/src/intelligence/embeddings.ts:54` `createHash('sha1').update(g).digest()` (the bare-`catch` pin at `:101-112`, per the base plan's E1 verification).
- **Audit-3's blessing (the thing T-D60 supersedes):** `audits/2026-05-28-audit-3-functional-correctness.md:81` lists, under Segment-7 "shipped exceeds/diverges-but-intentional," **"C-D2 offline deterministic embedding fallback when `@xenova/transformers` absent (matches the codebase's capability-gating discipline)."** That is the sanction T-D60 overturns: the offline fallback is *intentional-but-silent*, which the refuse-rather-than-fallback principle (T-D60, LBD-1c) forbids.
- **Base-plan E1 mechanism being revised:** base plan **LBD-1c (line 167, a RESOLVED ruling)** and **E1 detail (lines 250-251)** both instruct "**edit the C-D2 body in `CODE_SPEC.md`** … with a `> Amendment` block." OQ6 re-rules the *mechanism* (substance preserved): land the narrowing as a **T-D60 supersession note**, **not** a C-D2 body edit. Both locations are named and forward-pointer-annotated in this PR (§"Anchor amendment" below).

---

## E17 gate ruling — disposition table (the encoding)

The base plan routed all of these to the E17 product-decision gate; the spec author has now ruled. Each row's bucket is the *ruling*, applied to the verified finding above.

| Finding | Base-plan class | **Ruling (OQ6)** | Lands as |
|---|---|---|---|
| **F7-03** semantic search | decision → E17 | **BUILD** | new slice **E19** (code + test) |
| **F4-01** session-start inputs | decision → E17 | **BUILD** | new slice **E20** (code + test) |
| **F5-04** dump-zone primary-unit | decision → E17 | **BUILD** | new slice **E21** (code + test) |
| **F5-02** tree drag-retag | decision → E17 | **DESCOPE** | SPEC §7.11 amendment, in **E17** |
| **F7-01** multi-list AI export | decision → E17 | **DESCOPE** | SPEC §7.20 amendment, in **E17** |
| **F7-06** full command palette | decision → E17 | **DESCOPE** | SPEC §7.24 amendment, in **E17** |
| **F7-07** list keyboard nav | decision → E17 | **DESCOPE** | SPEC §7.24 amendment, in **E17** |
| **F5-01** tree grouping | decision → E17 | **SCHEDULE** | Phase G register, in **E17** |
| **F5-03** detail-panel sections | decision → E17 | **SCHEDULE** | Phase G register, in **E17** |
| **F7-02** mermaid generation | decision → E17 | **SCHEDULE** | Phase G register, in **E17** |

E17 remains **one slice** (the gate-record); this ruling makes its previously-conditional deliverable concrete (the four SPEC amendments + the three Phase-G register rows + the existing accepted-advisory / minors registers). The other E17 surfaces named in the base plan (F6-02, F1-02, F3-01 value-judgments; the audit-4 wrong-belief Lows; W1 fastify-accept; the minors register) are **not** part of this OQ6 ruling and stay open in E17 for separate disposition. The build rulings append below as E19–E21.

---

## New build slices (append to roster after E18)

> Convention inherited from the base plan: paired regression test in the **same** slice; backend tests mirror `packages/backend/src/<path>` under `packages/backend/test/<path>`; frontend tests under `packages/frontend/test/`; wire-shape changes land in `packages/shared/src/` and are **verified, not cast** (T-D59). No new anchor (any beyond T-D60/C-D25/C-D26 trips halt-class 5).

### E19 — Per-entry semantic search (F7-03) · feature-build
- **Closes:** F7-03 (Mod). **Class:** feature-build (spec-required feature, spec-author ruled build).
- **Spec basis:** SPEC §7.8 (line 234); CODE_SPEC C-D2 (text substrate) + line ~1005 (substrate already indexes library entries).
- **Fix:** replace the `library/service.ts:396-403` constant-empty stub with a real query against the existing text-embedding substrate (`intelligence/text-index.ts` `search`), **filtered to `entity_type === 'library'` hits**, resolved back to `LibraryEntry` rows and shaped as `LibrarySearchResult` with an honest `via` (`'semantic'`, replacing `'semantic-stub'`). The Semble/code substrate stays on its dedicated `code-qa` endpoint (the stub comment's rationale holds — Semble returns code chunks, not library rows; not folded in here). **§7.8 text-content routing only.**
- **Honesty (T-D60, on-contract per LBD-1b):** when the embedder is capability-absent or degraded (post-E1 shape), the result discloses that state on the **shared wire type** (extend `LibrarySearchResult`/`via` in `packages/shared/src/library.ts` with an embedder-capability discriminator, verified per T-D59) — never silent empty (the `text-index.ts:236` `if (!qv) return []` embed-failure path — distinct from the `:234` `rows.length === 0` legitimate-empty — is already split in E1; E19 must surface, not re-bury, it).
- **Wiring note:** the library service does not currently hold the text-index (the stub needs no dependency). E19 injects the `TextIndex` (or a thin search port) into the library service, or composes at the route — a small composition-root change; **flag if it forces a wider refactor → halt-class 4 (estimate breach)**.
- **Wire-contract coverage (A4 — T-D59 enforcement):** annotating the `via`/embedder-capability field on `LibrarySearchResult` is only "verified per T-D59" if the **semantic-search response envelope is added to `packages/shared/src/wire.ts` and the `POST …/library/semantic-search` endpoint is added to `packages/backend/test/wire-contract.test.ts`** (which currently covers the core entity reads + the methodologies projection, not this envelope). Without it the new field is annotated-but-runtime-unverified — exactly the `as T` gap T-D59 closed (AUTHORING_DISCIPLINE §"Green-Gate Coverage" item 2). A library-local unit test alone does **not** satisfy T-D59.
- **Files:** `packages/backend/src/library/service.ts` (replace stub), `packages/backend/src/library/routes.ts` (unchanged or wiring only), `packages/backend/src/intelligence/text-index.ts` (expose library-filtered hits if needed), `packages/shared/src/library.ts` + **`packages/shared/src/wire.ts`** (`via` enum + embedder-capability field, on-contract), **`packages/backend/test/wire-contract.test.ts`** (add the semantic-search envelope), composition root (inject index).
- **Tests:** `test/library/semantic-search.test.ts` — seeded entries returned ranked by cosine; embedder-absent → disclosed degraded (not empty-as-healthy); embed-failure ≠ honest-empty (the SF3-02 split surfaces through to the library result). **Plus** the `wire-contract.test.ts` extension above (runtime contract assertion).
- **Anchor:** none (reuses C-D2 + T-D60). **Deps:** **E1 merged** (honest embedder + T-D60 wire shape); rebase coupling with E1/E2 on `intelligence/*` if those slices touch `text-index.ts`. **Est. LOC:** 120–180.

### E20 — Session-start full inputs (F4-01) · feature-build
- **Closes:** F4-01 (Mod). **Class:** feature-build.
- **Spec basis:** SPEC §7 line 392; CODE_SPEC C-D9 step 2 (line 320).
- **Fix:** wire the two missing inputs into the assembly pipeline:
  1. **Execution-plan slice:** read the bundle's `execution_plan` template (`bundle.ts:146`) and **include it whole when present**. **A2 disposition (auditor option a — honest to the shape):** `execution_plan` is a single bundle-**global** string, not mode-keyed (the only mode-keyed template field is `session_start_by_mode`, `bundle.ts:148`, already consumed by `templateFor`). C-D9 step 2's "for the chosen mode" is satisfied by mode-driven *template selection*, not by slicing this field — so E20 does **not** invent a per-mode derivation (that would be net-new behaviour outside the "wire the missing input" scope and would bear on the LOC band). Freeform / no-`execution_plan` bundle → block omitted (graceful, mirrors the existing minimum-spec path). *If the spec author wants a genuine per-mode plan slice, that is a separate scoped build, surfaced not assumed.*
  2. **Project-spec content:** **read the current state of the canonical `project_spec` library entry directly** and include its content (bounded length). Per the **A7 + identifier + placement rulings** (2026-05-31): `project_spec` is a **library-entry type** (added to the core-owned `LibraryEntryType` set — *not* a new core item type, keeping T-D47 / methodology-agnostic-core intact); canonical identity is **structural** = the type tag + a **one-per-project uniqueness constraint enforced at create-time validation** (no flag field, no config pointer). This is a **direct library-entry read, not a substrate/semantic query** — it does **not** route through E19 or `text-index.search` (resolves **A3 turn-2**). **Read semantics (ruled):** session-start reads the entry's **current state at read time**; no caching survives a spec edit (see the fingerprint guard below). E19 may index the entry in its corpus but does not gate this read.
- **Plumb both through:** add `executionPlanSlice` + `projectSpec` (the designated-item content, bounded) to `AssembledContext` (`engine.ts:80-93`); gather in `assemble()` (`:193-247`); add `execution_plan_block` + `project_spec_block` to the render call (`:359-370`) and the bundle templates' variable set. **Critical (silent-failure guard + ruled read semantics):** hash both new inputs — including the **current `project_spec` content** (e.g. its `updated_at`/body) — into `inputFingerprint` (the `assemble()` fp loop `:214-234`). This is what enforces the ruling's "no caching survives a spec edit": editing the spec moves the fingerprint, so the next session-start read reflects it; omitting it would re-serve a stale cached prompt (a fingerprint-staleness silent failure → halt-class 6 if a test reds it). The paired test asserts the fingerprint moves on a spec edit.
- **Spec-author rulings (A7 + identifier, 2026-05-31) — RESOLVED.** *Source:* the designated canonical item, read directly (not the substrate). *Identifier:* a **dedicated new `project_spec` type**; canonical-marking is **structural** = the type + a **one-per-project create-time uniqueness constraint** (no flag, no config pointer). *Mutability:* `project_spec` is **fully mutable** post-creation via normal item-edit flows (a *living* document, updated mid-project as the spec evolves) — "canonical" = structural identity (one-per-project, type-identified), **not** immutability. **LLM-assisted revision** is supported as a **user-mediated** suggest/draft/accept-reject surface (the same pattern as other item-edit AI-assist), **never auto-edit**.
- **Placement + anchor — SPEC-AUTHOR RULED (2026-05-31), resolves auditor A8.**
  - **(a) Placement = LIBRARY-ENTRY** (confirms the planner recommendation). `project_spec` is a **library entry**, type-tagged within the library, with the one-per-project constraint — **not** a new core item type. Structural identity (this *is* the project_spec) is carried by the **type tag + uniqueness**, so **T-D47 (bundle-owned core item types) stays intact** and no methodology-agnostic carve-out is introduced. Rationale (ruled): `project_spec` is **methodology content, not core platform machinery** → the library is the correct stratum. (The earlier "new item type" wording meant *identifiability*, not items-pool placement.)
  - **(b) Anchor form = the T-D10 amendment itself** — **no new carve-out T-D, no new anchor number.** T-D10 ("Library has four content types") is **amended to add `project_spec`** as a canonical fifth content type (with the one-per-project uniqueness property); T-D43's "four content types in v1" line is kept consistent in the same amendment (whiteboards remain deferred; `project_spec` is the distinct canonical-spec type). **Halt-class-5 status:** it *fired* (E20 needed an anchor touch beyond the planned T-D60/C-D25/C-D26) and is now **resolved by this ruling** — an amendment of the existing T-D10, not a new mint. **A8 closed.**
- **Files (E20 grows — per the identifier ruling "size E20 up"; placement = library):** add `project_spec` to **`packages/shared/src/library.ts` `LIBRARY_ENTRY_TYPES`** (the library schema type set; library-entry stratum, per the placement ruling); a **schema migration** adding the type tag; the **create-time one-per-project uniqueness validation** in the library service (mirrors the E16 create-time validators, e.g. F1-03/F4-04); edit is the **standard library-entry edit** flow plus the **LLM-assisted revision surface** (user-mediated suggest/draft/accept-reject, reusing the existing item-edit AI-assist pattern); the canonical-entry read + `packages/backend/src/methodology/session-start/engine.ts` plumb; **`DECISIONS.md` / `SPEC.md §14` — the T-D10 amendment** (+ T-D43 consistency); bundle template variable docs.
- **Tests:** `test/methodology/session-start/full-inputs.test.ts` — assembled prompt contains the `project_spec` block + execution-plan block; **second `project_spec` create in a project is rejected at create-time** (one-per-project); **editing the spec moves `inputFingerprint` so the next session-start read reflects it** (no stale cache — the ruled read semantics); LLM-assist is **user-mediated** (suggested, not auto-applied); freeform bundle → execution-plan block absent; project with no `project_spec` item yet → spec block cleanly absent (graceful).
- **Anchor: a T-D10 amendment** (SPEC-AUTHOR RULED; resolves auditor A8) — `project_spec` is added to T-D10's library content types (fifth canonical type, one-per-project), with T-D43 kept consistent. **No new anchor number is minted** (an amendment of the existing T-D10, not a new T-D/C-D); the methodology-agnostic-carve-out option is **declined**. Halt-class-5 fired and is resolved by the ruling. (Session-start *wiring* still extends C-D9; the amendment is for the new library type.) **Deps:** **independent of both E19 and E1** — E20's inputs are a **direct library-entry read** (project spec) + the **bundle `execution_plan` template**; neither touches the embedder or `text-index.search`. (Refines the spec author's "both depend only on E1" parenthetical: E19 rides E1's honest embedder; E20 does not — confirmed by the spec author's independence ruling.) No E19→E20 edge. **Est. LOC: ~220–340** (raised per "size E20 up": + library type tag + migration + create-time uniqueness validation + LLM-assist revision surface) — now the largest of the three builds; **watch halt-class 4 (estimate breach)** at execution.

### E21 — Dump-zone primary-unit re-route (F5-04) · feature-build
- **Closes:** F5-04 (Mod). **Class:** feature-build.
- **Spec basis:** SPEC §7.6 ("suggests target session **and primary unit**").
- **Fix:** add a `suggested_primary_unit_ref: string | null` to `ProposedItem` (and a payload-level default on `ProposalPayload`, mirroring `suggested_session_id`) in `packages/shared/src/capture.ts`; have the dump-zone extractor populate it (AI suggests the primary unit from the bundle's declared `primary_unit` vocabulary — bundle-agnostic, no baked unit names); surface it editable in the review modal; on **apply**, route the item by writing the (possibly user-edited) ref into the item's `primary_unit_refs` (`item_primary_unit_refs`, `items/service.ts:91`). Freeform bundle (`bundle.primary_unit === null`) → suggestion absent, no routing.
- **Files:** `packages/shared/src/capture.ts` (proposal shape); `packages/backend/src/dump-zone/service.ts` (extractor suggestion + apply routing); the extractor prompt; the frontend dump-zone review modal; `packages/backend/src/items/service.ts` apply path (write `primary_unit_refs`).
- **Tests:** `test/dump-zone/primary-unit-route.test.ts` — extraction suggests a primary unit for a primary-unit-declaring bundle; apply routes to the suggested (and to the user-overridden) ref; freeform bundle → no suggestion, no route.
- **Anchor:** none. **Deps:** rebase coupling with **E2** (dump-zone/md-ingest extractor) and **E11** (items.update transactionality) if the apply path overlaps — sequence after whichever of those touches `dump-zone/service.ts` / `items/service.ts`. **Est. LOC:** 120–190.

---

## E17 ruled output — descope SPEC amendments (4)

These land **inside the E17 slice** (its "descope → targeted SPEC amendments" deliverable). Each is a SPEC edit marking the feature deferred, with an anchor-free descope note pointing at this ruling. **No code; no test.**

- **F5-02 → SPEC §7.11 (line 268).** Amend the Tree bullet: the "Drag-drop between folders re-tags items" clause is **deferred to a later phase**; retag remains available via the item detail panel / board moves in v1. (Descope note: deferred by E17 ruling, 2026-05-31.)
- **F7-01 → SPEC §7.20 (lines 405-409).** Mark the multi-list combine + AI consolidation export **deferred**; the per-session markdown export fast-path and `/api/backup/export` remain the v1 export surface.
- **F7-06 → SPEC §7.24 (line 432).** Narrow the command-palette contract to the **shipped subset** (jump-to-project, jump-to-view, projects-list; the implemented `kind` set) and mark the full jump-targets/action set (sessions, items, library, directives, primary units, gates; new-item/reconcile/export/switch-project/settings) **deferred**.
- **F7-07 → SPEC §7.24 (line 434).** Mark the full keyboard-navigation contract (tab/shift-tab indent, arrow nav, Enter-edit, Esc-close, `?`-reference) **deferred**; v1 retains row focusability (`tabIndex`) and modal Esc only.

> SPEC §14 / anchors: these descopes mint **no** anchor (they narrow existing prose, consistent with the base plan's "SPEC.md only for ratified descopes"). The base plan's anchor-minting plan (T-D60/C-D25/C-D26) is unchanged.

## E17 ruled output — Phase G feature register (3)

A **new register**, distinct from the base plan's Phase F *quality-tail* seed (dedup/perf/a11y). Phase G holds **scheduled features** the spec author wants built later, not descoped. Seeded inside E17; carried forward at chain close. Each row is named, not dropped (so the next phase's planner finds it).

| Finding | Sev | Scheduled scope | Verified anchor in code/spec |
|---|---|---|---|
| **F5-01** | Major | Tree grouping: ships **2 of 5 spec dims** (status, tag) + a non-spec `parent` dim; add the **3 missing spec dims — session, primary unit, blocker** | SPEC §7.11:268; `TreeView.tsx:10` |
| **F5-03** | Major | Item-detail **verifier-rules** + **PR/git-context** sections | `ItemDetailPanel.tsx:691` placeholder |
| **F7-02** | Major* | **Mermaid generation** export (per-scope + AI-from-paste; `.mmd`/SVG) | SPEC §7.21:412-414; §9:545 (Sonnet priced) |

\* roadmap-scope Major per audit-3's boxed caveat — the spec author's schedule call is recorded here.

---

## Anchor amendment — T-D60 supersession note (revises base-plan E1 mechanism)

**This section overrides TWO load-bearing base-plan locations, both naming the now-superseded "edit the C-D2 body" mechanism:**
- **base-plan LBD-1c (line 167)** — a **RESOLVED 2026-05-30 spec-author ruling** merged on `main`: *"This is a real **C-D2 amendment** … amend the C-D2 body in `CODE_SPEC.md`."*
- **base-plan E1 detail (lines 250-251)** — *"edit the C-D2 body in `CODE_SPEC.md` … with a `> Amendment` block."*

**This is a spec-author re-ruling, not a silent reversal (auditor A1).** OQ6 (a spec-author instruction relayed via the overseer, 2026-05-31) **re-rules the *mechanism*** of LBD-1c while preserving its *substance*. Substance unchanged: C-D2 narrowed to capability-absent honest-distinct mode; the silent SHA1 fallback removed; T-D60 supersedes the offline-fallback sanction. **Only the *landing site* of the narrowing changes** — from an in-place C-D2 body edit to a T-D60 supersession note. LBD-1c (line 167) is named here explicitly so a reader reconciling the two docs sees the override, not a contradiction.

**Executor-coordination / delivery mechanism (auditor A1, blocker).** A Session-3 executor runs E1 from the canonical base roster on `main`, which still literally says "edit the C-D2 body." To prevent the executor performing the *superseded* action, this PR provides delivery two ways:
- **(i) Base-plan forward-pointers (this PR edits the base plan):** a one-line `> Mechanism re-ruled by OQ6 (2026-05-31) …` annotation is added at **both** base-plan LBD-1c (after line 167) and E1 detail (after line 251), each pointing to this augmentation §"Anchor amendment." The redirect sits *at* the canonical roster location the executor reads.
- **(ii) Normative executor directive (here):** **E1 executors MUST apply this section's mechanism in place of base-plan E1's C-D2 step.** The C-D2 narrowing is landed as a T-D60 note; the base plan's "edit the C-D2 body / `> Amendment` block" instruction is **void** for this chain.

Mechanism, as it executes in **E1** (still the slice that mints T-D60):

1. **`DECISIONS.md` — T-D60 body** carries the supersession explicitly. Two clauses:
   - **(a) Supersedes audit-3's blessing:** "T-D60 supersedes the Segment-7 'intentional-but-silent' sanction recorded in `audits/2026-05-28-audit-3-functional-correctness.md:81` ('C-D2 offline deterministic embedding fallback when `@xenova/transformers` absent') — a silent capability substitution is exactly the dishonest-degradation pattern T-D60 forbids."
   - **(b) Narrows C-D2:** "C-D2's operative scope is narrowed to **capability-absent honest-distinct mode** only: the local-embedding substrate may operate as an *honestly-disclosed* capability-absent mode, never as an undisclosed SHA1 substitute. The offline *silent* fallback is removed."
2. **`SPEC.md §14`** — append the T-D60 index row (the row text references the supersession + the C-D2 narrowing). T-D60 is the canonical home of the narrowing.
3. **`CODE_SPEC.md` — C-D2 Decision/Rationale/Implications prose is NOT rewritten** (the OQ6 directive: not a body edit). **But add a single non-normative status pointer line** to C-D2 — e.g. `> Narrowed-in-part by T-D60 (2026-05-31): capability-absent honest-distinct mode only; silent fallback removed — see DECISIONS.md / SPEC.md §14.` This is a one-line cross-reference, not a Decision/Rationale/Implications rewrite, so it honours "not a body edit" while giving in-place insurance against cross-doc drift (auditor A1: the cheapest guard against a reader missing the second document). The narrowing's *substance* still lives in T-D60; the pointer only routes a C-D2 reader to it. *(Reversed from the prior draft, which recommended against any pointer — the auditor correctly flagged that as the drift risk.)*
4. **`CODE_SPEC.md:9`** anchor-count narrative refreshes **59 → 60** (the T-D60 mint, unchanged from the base plan; the mint happens regardless of mechanism).
5. **Code (E1, unchanged from base plan):** the bare-`catch` SHA1 pin (`embeddings.ts:101-112`/`:54`) is removed in favour of the disclosed capability-absent shape on the shared `RagQueryResult` (LBD-1b on-contract).

**Why mechanism, not substance, changed.** The base plan and OQ6 agree on the *outcome* (C-D2 narrowed; silent fallback gone; T-D60 supersedes). OQ6 only relocates *where the narrowing is written* — into T-D60 (the superseding anchor) rather than as an in-place C-D2 body rewrite. This keeps C-D2's original text legible as the superseded baseline and makes T-D60 the single source of the supersession, consistent with `SESSION_START.md` anchor conventions (T-D anchors are canonical via SPEC §14; supersession is recorded at the superseding anchor).

---

## Roster delta & sizing honesty

- **Base floor:** 19 slices (E1–E16, E17a, E17, E18).
- **Augmentation adds:** **E19, E20, E21** (3 feature-build slices). The four descopes and three Phase-G entries land **inside the existing E17 slice** (its ruled output) — they add deliverable content, not slices. The anchor amendment is an **E1 mechanism revision** — no slice.
- **New floor:** **22 slices.**
- **Sizing honesty (carries the base plan's framing forward).** The base plan reported 19 as a floor with an "unbounded-until-ruled" tail = `19 + N(builds)`. **N = 3** (this ruling). **22 breaches the brief's 12–20 envelope** — stated plainly, not hidden. This is the priced-in consequence the base plan named: the E17 gate spawned slices. The remaining E17 surfaces (value-judgments, wrong-belief Lows, W1 fastify-accept, minors) are **not** ruled by OQ6 and could append further slices if a later ruling says "build" — the total remains a floor.
- **Added LOC (estimate):** E19 (120–180) + **E20 (220–340 — raised: the identifier ruling grows E20 with a new `project_spec` type + migration + create-time one-per-project validation + LLM-assist revision surface)** + E21 (120–190) ≈ **460–710 LOC** across 3 code/test slices, atop the base ~2,050–2,970. Calendar: +~4–5 working days atop the base ~3–4 weeks. (E20 also now carries an **unplanned anchor** — see Anchor impact / A8.)

---

## Sequencing & dependencies (data-shape / pattern — not commit-order)

- **E1 → E19 (hard):** E19 consumes the post-E1 honest embedder + T-D60 wire shape. E1 merges before E19.
- **E19 ∥ E20 (independent siblings, no edge):** **E19** wraps the pre-existing `text-index.search` into the library surface (filtered to `entity_type === 'library'`) and depends on **E1**'s honest embedder. **E20**, under the **A7 ruling**, reads a **designated project-spec library item directly** + the bundle `execution_plan` template — no embedder, no `text-index.search` — so it depends on **neither E19 nor E1**. E19 may index the spec item for its corpus but does not gate E20. No E19→E20 edge (the earlier "soft dep" was a substrate/slice conflation, corrected per auditor A3; the A7 ruling further decouples E20 from the substrate).
- **E21 ↔ E2 / E11 (rebase coupling):** E21 touches `dump-zone/service.ts` (E2 extractor) and `items/service.ts` apply (E11 transactionality). Don't run E21 in parallel with whichever lands first in those files; the second inherits a rebase.
- **E17 ruled output is doc/spec-only** — no code dependency; lands whenever the E17 gate slice runs (it already sits in the base sequence). The descope amendments + Phase-G register can land with the E17 slice independent of E19–E21.
- **Anchor amendment rides E1** — no separate sequencing.

---

## Chain-open / merge discipline

- This artifact opens as a **DRAFT PR** for the planner↔auditor loop. **CI must be green before any merge.** The **overseer** flips draft→ready and merges — **not** this session.
- The three build slices append to the base roster's `AUTO_CONTINUE_WORKFLOW.md` three-layer green gate (Gitar + CI + GitHub-mergeable) → merge → next slice off updated `main`, one PR per slice. Halt-class set (standard 3 + blessed 4–9) is inherited from the base plan unchanged.
- **Chain-close additions (atop the base plan's close list):** F7-03 / F4-01 / F5-04 each have a paired regression test; the four descope SPEC amendments are landed; the Phase-G register is carried forward beside the Phase-F seed register; the T-D60 supersession note records the audit-3 blessing supersession + C-D2 narrowing (C-D2 body untouched); `SPEC.md §14` + `CODE_SPEC.md:9` reflect the T-D60 mint (59→60).

---

*Planner final-marker: **final — approved by planner**. The auditor loop converged (A1–A8 resolved, round 4) and the audit-ID set-diff gate held across every revision (0/0). The overseer flips draft→ready and merges; CI must be green first.*
