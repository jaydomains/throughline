<!-- Historical artifact. Audit 3 of 5, conducted 2026-05-28 against the repo state of that date. Committed retroactively 2026-05-30 (see handover 2026-05-30-audit-backfill-five-audit-reports.md). Transcribed verbatim from the original session deliverable — NOT edited, summarized, or updated. Findings later closed by subsequent phases are still listed here as originally found; closure is recorded in PLATFORM_STATUS / handovers, not here. -->

# Throughline — Functional-Correctness Audit (Audit 3 of 5)

**Date:** 2026-05-28 · Read-only; no fixes. Contract baseline: SPEC §7.1–7.28, C-D1–C-D21, T-D anchors.
**Method:** 8 segments walked "spec says X → code does Y → delta." Deltas are spec-vs-shipped; ambiguities and intentional-evolutions are tracked separately.

## Tally (deltas only)

| Severity | Count | IDs |
|---|---|---|
| **Major** | 7 | F1-01, F5-01, F5-02, F5-03, F7-01\*, F7-02\*, F7-06\* |
| **Moderate** | 9 | F1-02, F1-03, F3-01, F4-01, F5-04, F6-01, F7-03, F7-04, F7-07 |
| **Minor** | 13 | F1-04, F1-05, F1-06, F2-01, F2-02, F3-02, F4-02, F4-03, F4-04, F5-05, F6-02, F7-05, F8-01 |

\* **F7-01/02/06 carry a roadmap-scope caveat** — see the boxed note below; their bucket is a product decision, not a clear code-fix.

**Re-examination verdicts:** **S5-02 → confirmed & escalated to Major** (F1-01). **S1-04 → re-confirmed within-contract** (T-D54 State 2 *mandates* the reimport audit; not a delta). **S5-05 → re-confirmed not-a-delta** (§7.10 silent on missed-occurrence semantics → ambiguity).

---

> ### ⚠️ Scope caveat on F7-01 / F7-02 / F7-06 (export, mermaid, command palette)
> "Missing roadmap items" was excluded from scope. Cross-checked the ROADMAP/CHECKLIST:
> - **§7.20 export & §7.21 mermaid:** **no ROADMAP phase scopes either**, and **neither is in §12 deferred** — yet both are declared in SPEC §7 and the cost/dependency tables (mermaid even has T-D14). So they're a **spec-vs-roadmap gap**, not classic "roadmap items." Either genuinely-promised-but-unbuilt, or unscheduled-future the roadmap never captured. **Spec author's call** which bucket.
> - **§7.24 command palette:** the ROADMAP phase scoped only a **"skeleton"**; CHECKLIST marks the skeleton `[x]`; but **§11 DoD line 410 marks command palette `[x]` "functional."** The skeleton shipped (open/close, fuzzy-search, jump-across-projects); the full §7.24 jump/action surface did not. So this is best read as a **DoD/SPEC overclaim vs shipped**, not a failed phase.
>
> All three are kept in the findings (they are genuine spec-vs-shipped deltas) but flagged so they can move to a feature-completeness/roadmap track if that's the intent.

---

## MAJOR deltas

**F1-01 — Wrong methodology bundle applied (T-D51 arm-2 precedence skipped).** `reconcile/service.ts:124`, `dump-zone/service.ts:134`, `routes/communication-model.ts:49,100` call `resolveBundle(bundle_id, bundle_path)` without the 3rd `repo_path` arg, so resolution arm 2 (`.throughline/bundle.md`) never runs and repo-bundle projects silently get the install-shipped fallback. T-D51 declares arm 2 > arm 3; 11 sibling call sites pass `repo_path` correctly. Reconcile diffs and dump-zone item-policy run under the wrong methodology. *(Also audit-2 S5-02; trivial 4-site fix, high value.)*

**F5-01 — Tree grouping ships 2 of 5 declared dimensions.** §7.11: "grouping selector (by tag, session, primary unit, status, blocker)." `views/TreeView.tsx:9` ships `'status' | 'tag' | 'parent'` — **session, primary-unit, blocker missing**; `parent` added but not in spec.

**F5-02 — Tree drag-drop-retag absent.** §7.11: "Drag-drop between folders re-tags items." No `draggable`/`onDrop` anywhere in TreeView; rows are click-only.

**F5-03 — Item detail panel omits two declared sections.** §7.17 lists "Verifier rules (pass/fail from latest Actions run)" and "Git context (PR, commit, branch)." `ItemDetailPanel.tsx:672` renders a literal `"Verifier rules · PR/git context: Phase 10."` deferral placeholder; no endpoint surfaces per-item verifier state.

**F7-01\* — §7.20 multi-list + AI consolidation export entirely unimplemented.** No route/service/component/type for combine-sessions, AI consolidation, or per-session markdown copy. Only `/api/backup/export` exists.

**F7-02\* — §7.21 mermaid generation entirely unimplemented.** No `.mmd`/SVG/generator anywhere; the lone `'mermaid'` literal is a cost-meter category label.

**F7-06\* — §7.24 command palette delivers a fraction of its surface.** Ships jump-to-project, view-mode, "go to projects list" only. Missing every other declared jump target (session/item/library/directive/primary-unit/gate) and actions (new-item/reconcile/export/settings).

## MODERATE deltas

- **F1-02** — Re-init emits per-field audit rows, not the declared single `project_reinit` row (the kind doesn't exist in code). `projects/service.ts:304-324`.
- **F1-03** — `bundle_id_mismatch` validation enforced on update + CLI-first-run but **not on backend `POST /api/projects` create** — a direct create with a mismatched in-repo `bundle.md` isn't rejected. T-D51 says "project-create … validation error."
- **F3-01** — T-D57 scan-on-demand gate lives at the **periodic-review bucket layer, not the drift-inbox/scanner layer**, so a bootstrapped project's inbox *can* carry discipline signals (via file-change/pre-write triggers) before the first user scan — weaker than §7.14's literal "drift inbox carries no discipline signals until first scan." (Bootstrap-vs-ongoing *distinction* is correct.)
- **F4-01** — Session-start context retrieval omits two of seven declared inputs: "project spec excerpts" and "execution-plan slice for the chosen mode." `session-start/engine.ts:196-250`.
- **F5-04** — Dump-zone capture proposal models `target_session_id` re-route but not the §7.3 "different primary unit" re-route (`ProposedItem` has no primary-unit target).
- **F6-01** — Code-drift tiers 1/2/3 omit the spec-mandated **"done item"** status filter that tier-4 enforces; they can badge non-done items as drifted. `github/tiers.ts`.
- **F7-03** — `POST .../library/semantic-search` returns a permanent stub `{entries:[], via:'semantic-stub'}`; the §7.8 per-entry semantic search isn't delivered on its own surface (RAG embeds library entries but surfaces them only as citations).
- **F7-04** — §7.22 says the audit log is "searchable by time range, actor, or trigger type"; `/api/audit` accepts only `entity_type`/`entity_id`/`project_id`/`limit` — none of the three named filters.
- **F7-07** — §7.24 list keyboard nav (tab/shift-tab indent-outdent, arrow item-nav) registered only as help-text "consumers land in Phase 3"; no component binds it.

## MINOR deltas

F1-04 (SPEC §7.26 says `/api/health`; code probes `/health` per amended T-D52 — SPEC prose stale) · F1-05 (no `InitConfigError` discriminated union; two `Error` subclasses instead) · F1-06 (`cli/init.ts` vs declared `cli/init/`) · F2-01 (validator silently ignores excluded fields rather than rejecting; write path never persists them) · F2-02 (`merge_fields` conflict action declared, carved out of v1) · F3-02 (no discrete on-bind scan trigger exists for any project) · F4-02 (gate concurrency/ordering-dependencies declared in C-D6, no impl or grammar) · F4-03 (C-D4 "illustrative" typed-structure fields parsed as permanent empty stubs) · F4-04 (per-type transitions parsed but not enforced at create/update) · F5-05 (undeclared "Intelligence" 10th view mode) · F6-02 (tier-1 annotation path-stem match documented but not implemented; message-substring can over-match) · F7-05 (voice capture is click-toggle not hold-to-talk; no overlay destination toggle) · F8-01 (companion `pending`/`in-progress` steps render with the red "error" badge color; text is correct).

---

## Cross-cutting patterns (the aggregation view)

1. **The backend engines are faithful; the deltas concentrate in the frontend and in two unbuilt features.** Every methodology engine (parser, gates, mechanical catalogue, drift, companion, session-start), the persistence/ingest/reconcile/projects services, GitHub thresholds (0.80/0.70/7-day all exact), and the communication-model layer match their C-D anchors. The Major deltas are: one backend wiring bug (F1-01), three **declared-but-unbuilt frontend interactions** (F5-01/02/03), and three **unbuilt features/surfaces** (F7-01/02/06). The pattern is **"SPEC §7 is ahead of the shipped UI,"** not "the backend lies."

2. **Wire contract is excellent — the gap is missing UI, not mismatched UI.** Segment 8 examined ~25 endpoint↔consumer pairs and found **zero Major/Moderate** shape mismatches (one Minor cosmetic). Nearly every endpoint returns a `@throughline/shared` type via `satisfies`; the two inline-built responses and untyped boundaries (`settings`, SSE) are consumed with defensive guards. So "does the user see what the API returns?" → **yes, when the UI exists**; the deltas are UI surfaces that were never built (F5/F7), not wrong renders.

3. **Bootstrap arc invariants largely hold.** T-D53 shape, T-D54 idempotent upsert + three states + derivation + override, T-D55 single generic prompt (no server-side bundle templating), T-D56 file-mediated/no-subprocess + exact watched path, C-D21 archive/quarantine path shapes, and the T-D57 bootstrap-vs-ongoing distinction all verified faithful. The single real bootstrap-arc delta is **F3-01** (gate at the wrong layer); the arm-precedence Major (F1-01) touches the clone-and-go side (T-D51).

4. **SPEC/DoD prose drifts behind amendments and implementation.** F1-04 (`/api/health` vs amended `/health`), the §11 DoD "command palette functional" overclaim (F7-06), `useCostMeter` referencing an SSE "cost" producer that doesn't exist (seg-8 A1), C-D4 "illustrative" stub fields. Recurring shape: **the prose asserts a state the code moved past or never reached.**

## Ambiguities (spec-clarity workstream — NOT counted as deltas)

~15, the load-bearing ones: **§7.14 vs T-D57 wording** (does "drift inbox carries no signals" bind, or is the periodic-review gate sufficient? — determines F3-01 severity); **§7.10 missing-occurrence semantics** (the S5-05 reminder-burst — §13 is the natural home for a "coalesce missed fires" clause); **§7.8 semantic-search** (satisfied "somewhere" via RAG, or required on the library surface? — determines F7-03); **C-D12 transitions** (one-line summary says enforce, body says status-only); **"auto-run on bind"** (discrete scan vs watcher-arming). These point at **spec edits, not code fixes.**

## Intentional evolutions (NOT violations — older-code, deliberate, coherent)

C-D2 offline deterministic embedding fallback when `@xenova/transformers` absent (matches the codebase's capability-gating discipline); RAG router precedence + `cross_project` broadening beyond §7.18's keyword/override text; cost-meter rolling 7/30-day windows (aligned to the §13-adopted rolling home view) vs §7.25's "current week/month." Each tagged by Segment 7 as "shipped exceeds/diverges-but-intentional."

## Remediation paths (two distinct workstreams)

- **Code-fix (deltas):**
  - *fix-now:* **F1-01** (wrong methodology — also an audit-2 bug, 4-line fix), **F6-01** (done-item filter — semantic correctness), **F3-01** (T-D57 inbox guarantee — pending the §7.14 ambiguity call).
  - *smaller deltas:* F1-02, F1-03, F4-01, F5-04, F6-02, F2-01, F4-04, F8-01.
  - *feature-completeness backlog (the "SPEC ahead of UI" cluster — needs build-or-descope product decision):* F5-01/02/03, F7-03/06/07, and F7-01/02 (pending the roadmap-scope call above).
- **Spec-clarity (ambiguities + prose staleness):** resolve the 5 load-bearing ambiguities; update SPEC §7.26 `/health`, the §11 DoD command-palette claim, the SSE-cost-producer doc, and the C-D4 "illustrative" framing.
- **Roadmap reconciliation:** decide v1-in/out for §7.20/§7.21 and either schedule them or move them to §12 deferred so SPEC and ROADMAP agree.

---

### Per-segment notes (captured during the audit)

- **Seg 1 Clone-and-go + init (T-D51, T-D52, C-D19, §7.26):** loader 3-arm precedence + watch/cached-key clean; T-D52 single-write-path/exact-error-string/no-`.throughline/` clean. Deltas: F1-01 (Major), F1-02/F1-03 (Moderate), F1-04/05/06 (Minor). S5-02 re-examined → Major (F1-01).
- **Seg 2 Bootstrap ingest (T-D53, T-D54, C-D20, §7.27):** schema/migration, derivation, predicate, transactional endpoint, duplicate-rejection, three-state classifier all match. Deltas: F2-01 (excluded fields ignored not rejected; write path clean), F2-02 (`merge_fields` carved out of v1). S1-04 re-confirmed within-contract (T-D54 State 2 mandates the reimport audit).
- **Seg 3 Bootstrap production (T-D55, T-D56, T-D57, C-D21, §7.28, §7.14 carve-out):** prompt template generic (no server-side bundle templating), file-mediated invocation/no-subprocess/exact watched path, archive/quarantine path shapes, output-path canonicalisation, init UX block (testids) all clean. T-D57 bootstrap-vs-ongoing distinction CORRECT. Delta F3-01 (Moderate — gate at periodic-review layer, not drift-inbox); F3-02 (Minor — no discrete on-bind scan trigger for any project).
- **Seg 4 Methodology runtime (C-D3,4,6,7,8,9,12,15):** parser/dispatch/validation, gate runtime, mechanical catalogue (4 test-bundle gates covered), drift engine, companion state machine, session-start mode/classify/render all faithful. Deltas: F4-01 (Moderate — session-start context omits 2 of 7 inputs); F4-02/03/04 (Minor).
- **Seg 5 Content domains + views (C-D5,12,13,18):** items/sessions/reconcile/directives/projects + communication-model layer faithful (rule-level derivation confirmed). Deltas: F5-01/02/03 (Major, frontend Tree + detail panel), F5-04 (Moderate), F5-05 (Minor). S5-05 re-confirmed not-a-delta (ambiguity A1).
- **Seg 6 GitHub + code-drift + Semble + static (C-D16,17):** fetch-idiom client (no Octokit), local-git-first diff seam, confidence-thresholded auto-reconcile, tier-4 exact thresholds (0.80/0.70/7-day/24h-undo), AI confirmation, PR-linking, Semble per-query execFile keyless capability-gated all clean. Deltas: F6-01 (Moderate — tiers 1-3 omit done-item filter), F6-02 (Minor).
- **Seg 7 Intelligence/library/ingest/export/audit/backup/cost/palette/voice (C-D2,10,11):** md-ingest confinement/re-summarise/cost-meter, intelligence feature set, chat, backup, cost+settings, audit-write all faithful. Deltas: F7-01/02/06 (Major*), F7-03/04/07 (Moderate), F7-05 (Minor). Intentional-evolutions listed above. (Conservative framing applied per older-code instruction.)
- **Seg 8 Frontend display vs backend response shape (wire-contract):** ~25 endpoint↔consumer pairs, zero Major/Moderate mismatches; F8-01 (Minor cosmetic badge-color collapse for transient companion states); A1 ambiguity (referenced SSE 'cost' producer that does not exist, masked by polling).
