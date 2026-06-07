# Throughline — Platform Status

*Living current-state snapshot. Updated at every session sign-off. Read first after `SESSION_START.md`.*

*Mutable file. Older entries are overwritten as they roll — history lives in handovers and `git log`, not here. To understand the past, read handovers. To understand the present, read this file.*

---

## Snapshot

**As of 2026-06-07.** The **audit-remediation cohort (Phase F / quality-tail)** is **COMPLETE** — all 14 reconciled findings (M-1…M-14) of the 2026-06-06 end-to-end audit (`audits/2026-06-06-end-to-end-summary.md`) addressed via a 14-slice execution chain run by the execution trio (plan `plans/2026-06-06-audit-remediation-plan.md`, #135; per-slice handovers in `handovers/2026-06-07-*`). **Dependency posture (M-1) — the load-bearing correction:** the production tree is hardened to **zero known advisories** (`pnpm audit --prod` **15 → 0**). The audited deferred set was **not "mere version bumps"** as this doc previously framed it — it carried a **Critical protobufjs RCE + 7 High advisories**, cleared by a **fastify v4→v5** major migration (A1, #140), a **full embeddings-stack replacement** `@xenova/transformers@2 → @huggingface/transformers@3` (A2, #141; **C-D2 amended**), and a residual sweep incl. **vite 5→8 / vitest 1→4** (A3, #142). **Deploy (M-2):** `start` runs the built artifact `node dist/index.js` + a single-command setup `scripts/setup.sh` (D1, #143). **Governance codified:** dual-context merge-method + **halt classes 4–9** in AUTO_CONTINUE (M-7/M-8, B1, #144), CI = the **required** gate (M-13, B2, #145), REQUIRED_READING tree/pointer (M-9, B3, #147). **Built (M-5):** per-session markdown export fast-path (C1, #150). **UX (M-3):** IntelligenceView UUID picker (D2, #151). **Docs reconciled:** mermaid deferred (M-4/B4, #148), bootstrap `merge_fields`/`archive` deferred (M-6/D3, #149), ROADMAP/CHECKLIST back-filled (M-11/B5, #152), README (M-12/B6, #153), this refresh (M-10). **Flake (M-14):** the `rag.test.ts` flake (A2-aggravated under concurrency) **stabilized** by pinning the deterministic fallback embedder in tests (#146); `directives.test.tsx` remains a watched flake. **Anchor touched:** C-D2 amendment (A2). **Honest status:** feature-complete · dependency-hardened · single-user local deploy — **not** the top `production-ready` taxonomy tier. **Prior cohorts (all complete):** Phase E audit-fix close (#88–#115), the role-file governance suite (#117–#138), Phases 19–22 — homed in ROADMAP/CHECKLIST "Post-v1 cohorts". **Next:** chain closed. Deferred to its **own future ROADMAP cohort** (OQ-1 ruling): the bootstrap `merge_fields`/`archive` feature build (per-field merge UI + an `archived_at` capability — needs design + anchors).

---

## Current Phase

**Phase:** Phase F — Audit-Remediation (quality-tail) — **COMPLETE** (all 14 slices merged; chain closed at M-10). Phase E, the role-file governance suite, and Phases 19–22 remain `production-ready`.
**Status:** **Chain complete.** Every reconciled finding (M-1…M-14) of the 2026-06-06 end-to-end audit is fixed-and-merged, built, or deferred with a recorded home — no finding silently dropped (the audit-ID set-diff gate held across all 14 slices). The load-bearing correction was **M-1 (deps):** `pnpm audit --prod` **15 → 0** via fastify v4→v5 (A1 #140), embeddings `@xenova→@huggingface` (A2 #141, **C-D2 amended**), and a residual sweep incl. vite 5→8 / vitest 1→4 (A3 #142). **M-2 (deploy):** `node dist/index.js` + `scripts/setup.sh` (D1 #143). Governance codified (B1 #144, B2 #145, B3 #147). Built: markdown export (C1 #150), UUID picker (D2 #151). Docs reconciled (B4 #148, D3 #149, B5 #152, B6 #153, M-10). Flake stabilized (#146). **Anchor touched:** C-D2 amendment (A2).
**Next concrete action:** No open Phase-F work; the chain is closed. Deferred to its **own future ROADMAP cohort** (OQ-1 ruling): the bootstrap `merge_fields`/`archive` feature build (per-field merge UI + an `archived_at` capability — needs design + new anchors). The `directives.test.tsx` flake remains a watched item.

---

## Locked Decisions This Cycle

The **Phase F (audit-remediation)** cycle holds its locked decisions here. Phase F is a quality-tail cohort: it **minted no new T-D/C-D anchor**; it **amended one** (C-D2, A2) and **codified one class-(iv) governance doctrine** (B1, in `AUTO_CONTINUE_WORKFLOW.md`). On the cohort close, Phase E's anchors (T-D60, C-D25, C-D26) roll to `production-ready` — full bodies remain in `DECISIONS.md` / `CODE_SPEC.md` and `git log`. One line each. The table rolls again only when a successor cohort mints or amends its first anchor.

| Anchor / Decision | Phase | One-line |
|---|---|---|
| C-D2 (amended) | Phase F / A2 | **Amended 2026-06-07 (M-1 supply-chain).** Embeddings package renamed `@xenova/transformers@2` → maintained `@huggingface/transformers@3` — the old stack transitively pinned the protobufjs Critical RCE (`onnxruntime-web@1.14 → onnx-proto@4 → protobufjs ^6.8.8`) which an override could not lift; the successor resolves `protobufjs@>=7.5.8`, clearing Critical + 4 High + 4 Moderate. Declaration correction: it is — and remains — an **`optionalDependency`** (lazy dynamic import + T-D60 capability-absent fallback), not a hard direct dep. Model/contract unchanged. Body in `CODE_SPEC.md §C-D2`. |
| B1 governance doctrine | Phase F / B1 | **Class-(iv) durable precedent** (not a T-D/C-D anchor; lives in `AUTO_CONTINUE_WORKFLOW.md`). Two codifications: (1) **dual-context merge-method** (M-7) — the merge method differs by context, parameter in `REQUIRED_READING.md §7`; (2) **halt classes 4–9** (M-8) — estimate-breach (4), unplanned-anchor (5), test-regression (6), doc-PR-collision (7), out-of-audit-silent-failure (8), blessed-decision-gate (9), promoting the prior ad-hoc set to a named, citable taxonomy. |

---

## Queued Work

- **Branch-protection required-check — DONE.** The `gate` workflow (`.github/workflows/ci.yml`) is now a required status check on `main`; it gated PR #76 (`mergeable_state: blocked` until `gate` + Gitar passed, then `clean`). The local `pnpm -r typecheck && pnpm -r test && pnpm -r lint && pnpm -r build` pass remains the chain runner's pre-PR check, but CI is now the enforcing gate at merge.
- **`throughline:pause` label — formally accepted-and-stop-surfacing** (settled in the 2026-05-28 Phases 19–22 hardener; see `AUTO_CONTINUE_WORKFLOW.md` § Kill Switch). Across Phases 19/20/21/22 the cohort ran end-to-end clean on the two canonical fallback signals (marker file at `.claude-code/auto-continue-pause`, `/pause` PR/issue comments). Per the PR #43 Session-1-handover-gap adjudication precedent, that pass demoted `throughline:pause` to optional/future. The label remains a valid third signal if the spec author later creates it; no further Queued Work entry until then. Recorded for posterity, not as work to do.

---

## Open Spec-Author Gaps

Mirrors `SESSION_START.md` §"Known spec-author gaps". Current state of each:

- **CODE_SPEC.md "Questions for the spec author" (two items)** — item 8 (voice input language default for the speech-recognition `lang` parameter, §13) and item 9 (cost meter daily threshold default value, §13 / §7.25). Items 1–7 closed by SPEC.md amendments and corresponding C-D anchors (refreshed by PR #43; the live state is in `CODE_SPEC.md`).
- **`<!-- RATIONALE NEEDED -->` markers in `DECISIONS.md` (four)** — T-D10, T-D15, T-D17, T-D23. All still open.

When work touches one of these, surface back to the spec author rather than picking an answer.

---

## Recent Slice History

Most recent merged PRs, one line each + handover path. Last five only; older entries roll off — history lives in `docs/_meta/throughline/handovers/` and `git log`.

| PR | Title | Handover |
|---|---|---|
| _this PR_ | Phase F / M-10 — final PLATFORM_STATUS refresh: Snapshot + Current Phase + Locked Decisions + Recent Slice History reset to the audit-remediation cohort-complete state; closes the chain | `handovers/2026-06-07-M-10-platform-status.md` |
| #153 | Phase F / B6 — README accuracy (M-12): stale test counts 500/182 → 610/214; "production-ready end-to-end" overclaim → now-true honest status (dependency-hardened, single-user local deploy) | `handovers/2026-06-07-B6-readme-accuracy.md` |
| #152 | Phase F / B5 — back-fill ROADMAP & CHECKLIST (M-11): post-Phase-22 cohorts (Phase E, role-file suite, Phase F) given a sequencing + build-state home, each artifact-cited | `handovers/2026-06-07-B5-roadmap-checklist.md` |
| #151 | Phase F / D2 — IntelligenceView UUID picker (M-3): replace raw-UUID text inputs with an entity picker (+2 tests) | `handovers/2026-06-07-D2-uuid-picker.md` |
| #150 | Phase F / C1 — build per-session markdown export fast-path (M-5): `sessionMarkdown.ts` + `CopySessionMarkdown.tsx` (+8 tests) | `handovers/2026-06-07-C1-markdown-export.md` |

(#149 D3 and earlier roll off — covered by their per-slice handovers in `docs/_meta/throughline/handovers/2026-06-07-*` and `git log`.)

---

## Update Protocol

- **Refreshed at every session sign-off.** Last act of a session = update this file before merge. First act of next session = read it.
- **Every entry points at an artefact** — PR number, handover path, anchor ID, or file path. No floating claims.
- **Mutable.** Unlike handovers (immutable per `HANDOVER_TEMPLATE.md` rule 8), this file is rewritten in place. The Phase-22 carve-out for handovers does not apply here.
- **Roll semantics.** When entries roll (Recent Slice History past 5, Locked Decisions at cycle reset), older entries are *overwritten*. History lives in handovers and `git log`, not here.
- **Cycle reset.** "Locked Decisions This Cycle" rolls at a natural cohort boundary (phase close, multi-session stream close). The reset is triggered by the *next* cohort's first decision, not by the cohort-hardener pass itself. The hardener pass marks the cohort `production-ready`; the table retains the just-promoted cohort entries until the next phase mints its first T-D / C-D anchor, at which point the production-ready cohort rolls off and the new cycle begins.
- **Cross-references.** `SESSION_START.md` (reading order); `AUTHORING_DISCIPLINE.md` (post-work gate includes refreshing this file); `AUTO_CONTINUE_WORKFLOW.md` (slice-chain that lands the work this file reports).
