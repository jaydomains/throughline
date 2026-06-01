# Throughline — Platform Status

*Living current-state snapshot. Updated at every session sign-off. Read first after `SESSION_START.md`.*

*Mutable file. Older entries are overwritten as they roll — history lives in handovers and `git log`, not here. To understand the past, read handovers. To understand the present, read this file.*

---

## Snapshot

**As of 2026-06-01.** **Phase E — Full Audit-Fix Close** chain is **in flight** (**27-slice floor** after the E17 ruling; one PR per slice). Plans on `main`: base `plans/2026-05-30-phase-e-full-audit-close.md` (E1–E18, E17a) + augmentation `plans/2026-05-31-phase-e-augmentation-feature-builds.md` (E19/E20/E21) + the **E17 decision-record** `handovers/phase-e-E17-decision-record.md` (the spec-author ruling that appended E22–E26). **Durable per-slice record (PR #, merge SHA, fix-rounds, halt/flake flags): `handovers/phase-e-execution-log.md` — read it for slice detail.** **Merged: E1–E16** (#88–#103; E16 at `95b3673`). All three planned Phase E anchors minted: **T-D60** (E1), **C-D26** (E5), **C-D25** (E6); a **T-D10 amendment** is planned for E20. **This slice — E17** — the spec-author product-decision gate (halt-class 9), now **resolved by the ruling**. E17 is doc/SPEC-only: 4 descope SPEC amendments (F5-02/F7-01/F7-06/F7-07), the F4-04 C-D12 wording amendment (status-membership-only, *not* transition-adjacency), and three seeded registers (Phase-G schedule F5-01/F5-03/F7-02; accepted-advisory W1-fastify-v5; accepted-minors). **The ruling appended five new slices** — **E22** (F7-04 audit-log filters, BUILD), **E23** (SF2-07/08 methodology-parsing rides), **E24** (SF5/SF6 frontend-swallow rides), **E25** (cluster-B bugs F6-02 + F1-02), **E26** (doc-fix F1-04 + F8-01 + I8) — plus the augmentation builds E19/E20/E21; F4-04 verified-closed in E18. **Deferred (no slice):** F3-01 (re-surfaced separately), SF4-05/06 (Phase F). No new anchor in E17. **Pre-existing test flakes flagged for Phase-F** (out-of-scope, halt-8): `rag.test.ts` + `directives.test.tsx`. **Prior cohort:** audit-fix A–D + Phases 19–22 remain `production-ready`. **Next:** merge E17, then run the appended chain in ruled order — **E17a → E22 → E23 → E24 → E25 → E26 → E18 → E19 → E20 → E21** — to chain close.

---

## Current Phase

**Phase:** Phase E — Full Audit-Fix Close. Chain in flight, one PR per slice (**27-slice floor** post-E17-ruling). Audit-fix A–D and Phases 19–22 remain `production-ready`.
**Status:** E1–E16 merged (#88–#103); E17 (product-decision gate — spec-author ruling encoded, doc/SPEC-only) is the current slice. Anchors so far: **T-D60** (E1), **C-D26** (E5), **C-D25** (E6) — all three planned Phase E anchors minted. A T-D10 amendment is planned in E20 (augmentation); any anchor beyond T-D60/C-D25/C-D26/T-D10-amendment trips halt-class 5. E17 + E17a mint no anchors.
**Next concrete action:** Merge E17 on green gate. Then run the appended chain to close in ruled order: **E17a** (dep range-bumps) → **E22** (F7-04 audit-log filters) → **E23** (SF2 rides) → **E24** (SF5/SF6 rides) → **E25** (cluster-B bugs F6-02 + F1-02) → **E26** (doc-fixes) → **E18** (closure-verification; F4-04 verified-closed) → **E19 → E20 → E21** (augmentation builds; E20 carries the T-D10 amendment).

---

## Locked Decisions This Cycle

The **Phase E** cycle holds its anchors here. T-D60 (E1) is Phase E's first anchor → it reset the cycle off the now-`production-ready` audit-fix A–D entries (C-D22, T-D58, C-D23, C-D24, T-D59; full bodies remain in `DECISIONS.md` / `CODE_SPEC.md` and `git log`). One line each; full bodies in `DECISIONS.md` / `CODE_SPEC.md`. The table rolls again only when a successor cohort mints its first anchor.

| Anchor | Phase | One-line |
|---|---|---|
| T-D60 | Phase E / E1 | Refuse-rather-than-fallback: a degraded or failed capability is **disclosed on the shared wire contract** (extends T-D59), never silently substituted or rendered as healthy-empty. Broad reach (LBD-1a). Supersedes audit-3's blessing of the silent C-D2 SHA1 embedding fallback; narrows C-D2 to capability-absent honest-distinct mode (recorded as a T-D60 supersession note, not a C-D2 body edit). Cited by E2/E3/E4. |
| C-D25 | Phase E / E6 | System-state visibility frontend component: shared `HealthStatus` (tri-state healthy/degraded/absent) rendered in-context (LBD-2), not a consolidated panel. E6 renders it for per-project methodology bundle health (SF2-02/SF2-06) and background-job health (E5/C-D26); E7 reuses it for the quarantine surface. Distinct from C-D26 backend model (LBD-3). |
| C-D26 | Phase E / E5 | Background-job health-state backend model: per-loop `JobHealth` (`last_run_at`/`last_error`/`healthy`) on the backup/reminder/poller loops + `JobHealthRegistry` + `GET /api/background-jobs/health`; a failing loop is now observable, not a silent catch-and-log. Distinct from the C-D25 frontend convention (LBD-3). |

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
| _this PR_ | Phase E / E17 — Product-decision gate (spec-author ruling encoded): 4 descope SPEC amendments (F5-02/F7-01/F7-06/F7-07), F4-04 C-D12 wording amendment, Phase-G + accepted-advisory + accepted-minors registers; appended E22–E26 | `handovers/phase-e-E17-decision-record.md` + `…/phase-e-execution-log.md` (§E17) |
| #103 | Phase E / E16 — Audit-3 spec-contradiction bugs (F6-01, SF3-04, F1-03; F4-04→E17): tier 1-3 done-item filter, tier-1 annotation-fetch refuse, create-time project.json validation | `handovers/phase-e-execution-log.md` (§E16) |
| #102 | Phase E / E15 — Frontend races & error surfacing (S8-01/02/03/04, SF6-09): refresh/search gen-guards, toast-timer cleanup, Board create-error surfacing, PrBadges + `/github/prs` poll-health disclosure | `handovers/phase-e-execution-log.md` (§E15) |
| #101 | Phase E / E14 — Audit-trail wiring (SF7-01, SF7-02, SF7-03, SF7-05): event-only secrets audit + settings_json audited on all 3 paths | `handovers/phase-e-execution-log.md` (§E14) |
| #100 | Phase E / E13 — Methodology-parsing robustness (S2-02, S3-02, SF2-03): safe-regex on the gate side, EOF-guarded item-type parse, drift-category parse warnings | `handovers/phase-e-execution-log.md` (§E13) |

(PR #80 and earlier roll off — covered by their handovers in `docs/_meta/throughline/handovers/`. The Phase E chain uses a single append-only execution log rather than per-slice handover files; see its header for rationale.)

---

## Update Protocol

- **Refreshed at every session sign-off.** Last act of a session = update this file before merge. First act of next session = read it.
- **Every entry points at an artefact** — PR number, handover path, anchor ID, or file path. No floating claims.
- **Mutable.** Unlike handovers (immutable per `HANDOVER_TEMPLATE.md` rule 8), this file is rewritten in place. The Phase-22 carve-out for handovers does not apply here.
- **Roll semantics.** When entries roll (Recent Slice History past 5, Locked Decisions at cycle reset), older entries are *overwritten*. History lives in handovers and `git log`, not here.
- **Cycle reset.** "Locked Decisions This Cycle" rolls at a natural cohort boundary (phase close, multi-session stream close). The reset is triggered by the *next* cohort's first decision, not by the cohort-hardener pass itself. The hardener pass marks the cohort `production-ready`; the table retains the just-promoted cohort entries until the next phase mints its first T-D / C-D anchor, at which point the production-ready cohort rolls off and the new cycle begins.
- **Cross-references.** `SESSION_START.md` (reading order); `AUTHORING_DISCIPLINE.md` (post-work gate includes refreshing this file); `AUTO_CONTINUE_WORKFLOW.md` (slice-chain that lands the work this file reports).
