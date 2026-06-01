# Phase E / E17 — Product-decision gate: spec-author ruling record

- **Date:** 2026-06-01
- **Class:** product-decision gate (LBD-4, halt-class 9, blessed). The chain halted at E17 for the spec author; this document **encodes the ruling**. Builds become appended slices; descopes are SPEC amendments (landed in this slice); scheduled features go to the Phase-G register (below); accepts are documented (below).
- **Slice deliverable:** SPEC/CODE_SPEC amendments (4 descopes + the F4-04 C-D12 wording amendment) + the three registers below + the routing of build/ride rulings to appended slices. **No code; no tests** (per the base plan's E17 contract).
- **Augmentation cross-ref:** the OQ6-ruled feature builds (F7-03/F4-01/F5-04 → E19/E20/E21), descopes (F5-02/F7-01/F7-06/F7-07), and Phase-G schedule (F5-01/F5-03/F7-02) were planned in `plans/2026-05-31-phase-e-augmentation-feature-builds.md`; this record consolidates them with the *remaining* E17 surfaces the spec author ruled on 2026-06-01 (cluster B value-judgments, cluster C wrong-belief Lows, cluster D minors, W1).

---

## Cluster A — feature-completeness (build / descope / schedule)

| Finding | Ruling | Lands as |
|---|---|---|
| F7-03 (per-entry semantic search) | **BUILD** | slice **E19** (augmentation) |
| F4-01 (session-start full inputs) | **BUILD** | slice **E20** (augmentation; carries the T-D10 amendment) |
| F5-04 (dump-zone primary-unit re-route) | **BUILD** | slice **E21** (augmentation) |
| **F7-04 (audit-log filters)** | **BUILD** | **new slice E22** — audit log filterable by time-range / actor / trigger-type. *Rationale (spec author): audit-trail discipline is load-bearing; filters are required for it to scale.* |
| F5-02 (tree drag-retag) | **DESCOPE** | SPEC §7.11 amendment (this slice) |
| F7-01 (multi-list AI export) | **DESCOPE** | SPEC §7.20 amendment (this slice) |
| F7-06 (full command palette) | **DESCOPE** | SPEC §7.24 amendment (this slice) |
| F7-07 (list keyboard navigation) | **DESCOPE** | SPEC §7.24 amendment (this slice) |
| F5-01 (tree grouping — 3 missing dims) | **SCHEDULE** | Phase-G register (below) |
| F5-03 (detail-panel sections) | **SCHEDULE** | Phase-G register (below) |
| F7-02 (mermaid generation) | **SCHEDULE** | Phase-G register (below) |

## Cluster B — spec-silent / value-judgment

| Finding | Ruling | Disposition |
|---|---|---|
| **F6-02** (tier-1 match: path-stem vs message-substring) | **BUG (path-stem)** | The code comment documents path-stem intent; **SPEC §7.14 amended** to make path-stem match explicit, and the code is corrected to match the documented intent. Lands in **slice E25** (cluster-B residual bugs), with the §7.14 amendment in the same slice (spec + code together). |
| **F1-02** (re-init audit: single `project_reinit` row vs per-field) | **BUG (single row)** | Per-field rows are noise; a single `project_reinit` row carries the operational signal. If field-level detail is needed later, it lands as structured payload **on** the single row. Lands in **slice E25**. |
| **F3-01** (§7.14-vs-T-D57 scan-gate layer) | **DEFER** | **Surfaced back to the spec author as a separate decision** after E17 resolves (see "Open — re-surfaced" below). **No slice appended.** |
| **F4-04** (C-D12 transitions) | **RULE: status-only** | C-D12 amended (this slice, CODE_SPEC): one-line summary aligned to the body — *"validate status membership against the type's lifecycle"*; **no** transition-adjacency enforcement. F4-04 is **verified-closed in E18** (code already matches the body in all three write paths). |

## Cluster C — audit-4 wrong-belief Lows (ride-the-chain vs defer)

| Findings | Ruling | Lands as |
|---|---|---|
| **SF2-07, SF2-08** (methodology-parsing visibility — close cousins of E13) | **RIDE** | **new slice E23** |
| **SF5-07, SF5-09, SF5-10, SF6-13, SF6-14, SF6-15** (frontend swallows — close cousins of E15) | **RIDE** | **new slice E24** |
| **SF4-05, SF4-06** (cost under-count) | **DEFER → Phase F** | operational misbelief is narrow, fix non-trivial relative to value. Recorded in the Phase-F deferred-tail register (base plan). |

## Cluster D — minors register

| Findings | Ruling | Disposition |
|---|---|---|
| **F1-04** (`/health` vs `/api/health` doc-staleness), **F8-01** (companion badge color), **I8** (CI `concurrency` / `timeout-minutes`) | **DOC FIX** | **new slice E26** (minors-cleanup) |
| F1-05, F1-06, F2-01, F2-02, F3-02, F4-02, F4-03, F5-05, F7-05, S1-04, I2 | **ACCEPT** | documented here (accepted-minors register, below); no action. |

---

## Register: Phase G or later — scheduled features (named, not dropped)

A register distinct from the Phase-F quality-tail seed (dedup/perf/a11y). Phase G holds **scheduled features** the spec author wants built later. Carried forward at chain close so the next phase's planner finds them.

| Finding | Sev | Scheduled scope | Anchor in code/spec |
|---|---|---|---|
| F5-01 | Major | Tree grouping ships 2 of 5 spec dims (status, tag) + a non-spec `parent` dim; add the **3 missing spec dims — session, primary unit, blocker** | SPEC §7.11; `TreeView.tsx:10` |
| F5-03 | Major | Item-detail **verifier-rules** + **PR/git-context** sections (replace the `Phase 10` placeholder) | `ItemDetailPanel.tsx:691` |
| F7-02 | Major* | **Mermaid generation** export (per-scope + AI-from-paste; `.mmd` / SVG) | SPEC §7.21; §9 (Sonnet priced) |

\* roadmap-scope Major per audit-3's boxed caveat.

## Register: accepted advisories

| Item | Ruling | Basis |
|---|---|---|
| **W1 — fastify v5 advisory** | **ACCEPTED** (do not remediate in this chain) | LBD-5: the fastify v5 advisory is accepted; its major migration is a separate future phase. |
| **E17a — dependency remediation** | **DEFERRED-MAJOR** (2026-06-01 ruling, Option 1) | E17a was greenlit for the *in-range* protobufjs/vite/esbuild bumps, but the live registry (verified 2026-06-01) showed every remaining advisory now requires a **major** — the in-range premise is stale. Per the spec-author ruling, **all** dep remediation is deferred into the **future fastify-v5 major-migration phase** (LBD-5), bundled as one workstream. **No code change lands in this chain.** Carried-forward set below. |

### Carried-forward to the fastify-v5 major-migration phase (deferred-major handoff)

| Advisory | Current (pinned) | Fix requires | Notes |
|---|---|---|---|
| **fastify** | `4.29.1` | `5.x` (major) | The anchor of the migration phase (LBD-5). |
| **fast-uri** | `2.4.0` | rides fastify 5 | Pinned transitively by fastify 4. |
| **vite** | `5.4.21` | `6.x` (major) | Path-traversal fix is `>=6.4.2`; vite 5→6. |
| **esbuild** | `0.21.5` | rides vite 6 | Pinned by vite 5; fix `>=0.25.0`. |
| **protobufjs** | `6.11.6` | `7.x` (major) | Transitive via optional `@xenova/transformers > onnx-proto@4.0.4` (which wants `^6`); a forced 7.x override is runtime-risky for embeddings, so it rides the major-migration phase rather than a standalone override. |


## Register: accepted minors (documented, no action)

| Finding | Why accepted |
|---|---|
| F1-05 | minor / cosmetic — no operational misbelief. |
| F1-06 | minor / cosmetic — no operational misbelief. |
| F2-01 | minor — accepted. |
| F2-02 | minor — accepted. |
| F3-02 | minor — accepted. |
| F4-02 | minor — accepted. |
| F4-03 | minor — accepted. |
| F5-05 | minor — accepted. |
| F7-05 | minor — accepted. |
| S1-04 | accepted (audit-2 Low). |
| I2 | accepted (audit-1: shared no-op test). |

---

## Open — re-surfaced to the spec author (separate decision, no slice)

- **F3-01 (§7.14-vs-T-D57 scan-gate layer).** Ruled **DEFER**. The §7.14-drift-scanner-layer vs T-D57-periodic-review-layer placement is a genuine spec ambiguity that the spec author wants to consider separately, after E17 resolves. **No slice is appended for it in this chain.** It is carried here so the next decision cycle picks it up. *(This is the single deliberately-unresolved E17 item.)*

---

## Roster impact (post-ruling)

The base + augmentation floor was 22. The 2026-06-01 rulings append **E22** (F7-04 build), **E23** + **E24** (cluster-C rides), **E25** (cluster-B bugs F6-02 + F1-02), **E26** (cluster-D doc-fixes). New floor: **27 slices** (E1–E26 + E17a; E17/E18 already counted). F3-01 adds none (deferred); SF4-05/06 add none (Phase-F). Stated plainly per the base plan's sizing-honesty discipline — the E17 gate spawned the slices it was priced to spawn.

## Execution order (spec-author-ruled, 2026-06-01)

1. **E17** (this slice) — descope SPEC amendments + C-D12 F4-04 amendment + registers seeded.
2. **E17a** — ~~in-range dependency range-bumps~~ → **DEFERRED-MAJOR** (2026-06-01, Option 1): all remaining advisories now require majors; bundled into the future fastify-v5 migration phase. Recorded only (deferral PR), no code change.
3. **Appended build/bug slices:** E22 (F7-04 filters) → E23 (SF2 rides) → E24 (SF5/SF6 rides) → E25 (cluster-B bugs F6-02 + F1-02) → E26 (cluster-D doc-fixes).
4. **E18** — closure-verification appendix, including **F4-04 verified-closed**.
5. **E19 → E20 → E21** — the augmentation feature builds (E20 carries the T-D10 amendment).
