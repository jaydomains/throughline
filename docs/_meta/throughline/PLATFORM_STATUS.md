# Throughline — Platform Status

*Living current-state snapshot. Updated at every session sign-off. Read first after `SESSION_START.md`.*

*Mutable file. Older entries are overwritten as they roll — history lives in handovers and `git log`, not here. To understand the past, read handovers. To understand the present, read this file.*

---

## Snapshot

**As of 2026-05-31.** **Phase E — Full Audit-Fix Close** chain is **in flight** (22-slice floor; one PR per slice). Plans on `main`: base `plans/2026-05-30-phase-e-full-audit-close.md` (E1–E18, E17a) + augmentation `plans/2026-05-31-phase-e-augmentation-feature-builds.md` (E19/E20/E21 + the E1 anchor-amendment mechanism). **Durable per-slice record (PR #, merge SHA, fix-rounds, halt/flake flags): `handovers/phase-e-execution-log.md` — read it for slice detail.** **Merged: E1–E11** (#88–#98). All three planned Phase E anchors are minted: **T-D60** (E1), **C-D26** (E5), **C-D25** (E6); E10 added the spec-author-ruled §7.10 clause (no anchor). **This slice — E12** — error→HTTP-status mapping: a stale `session_id` FK violation now maps to `SessionNotFoundError` (4xx, not a 500) at the items insert sites (S5-03), and a malformed `reconcile.apply` `diff.rows` is rejected as a 400 `ReconcileDiffShapeError` instead of a TypeError/500 (S6-01); both ride the Phase-B central handler. Records S6-02 closed (→ E18 verify test). No new anchor. **Pre-existing test flakes flagged for Phase-F** (out-of-scope, halt-8; pass on retry/isolation, not chain regressions): `rag.test.ts` (real embedder under parallel load) + `directives.test.tsx` (frontend). **Prior cohort:** audit-fix A–D + Phases 19–22 remain `production-ready`. **Next:** E13 (methodology-parsing robustness — S2-02, S3-02, SF2-03) off updated `main` after E12 merges.

---

## Current Phase

**Phase:** Phase E — Full Audit-Fix Close. Chain in flight, one PR per slice (22-slice floor). Audit-fix A–D and Phases 19–22 remain `production-ready`.
**Status:** E1–E11 merged (#88–#98); E12 (error→HTTP-status mapping) is the current slice. Anchors so far: **T-D60** (E1), **C-D26** (E5), **C-D25** (E6) — all three planned Phase E anchors minted. A T-D10 amendment is planned in E20 (augmentation); any anchor beyond T-D60/C-D25/C-D26/T-D10-amendment trips halt-class 5. E12–E16 + E17a mint no anchors.
**Next concrete action:** Merge E12 on green gate; branch E13 (methodology-parsing robustness) off updated `main`. Chain halts at **E17** for the spec-author product-decision gate (halt-class 9).

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
| _this PR_ | Phase E / E12 — Error→HTTP-status mapping (S5-03, S6-01): stale-session FK → `SessionNotFoundError`, malformed `diff.rows` → 400 | `handovers/phase-e-execution-log.md` (§E12) |
| #98 | Phase E / E11 — Transaction atomicity (S5-04, S6-03, S6-04): `items.update` txn, md-ingest per-file txn, atomic secrets write | `handovers/phase-e-execution-log.md` (§E11) |
| #97 | Phase E / E10 — Background-loop correctness (S4-02, S5-05): ETag-after-snapshots, recurrence coalesce + §7.10 SPEC clause | `handovers/phase-e-execution-log.md` (§E10) |
| #96 | Phase E / E9 — Loader robustness (S3-01/SF2-05, S3-03, SF5-08): unlink notifies all arms, dangling-symlink-safe hydration, guarded watch handler | `handovers/phase-e-execution-log.md` (§E9) |
| #95 | Phase E / E8 — Shutdown lifecycle completion (S7-02, SF5-11, S7-03): SSE `closeAll` + `unref` + guarded writes, global handlers, scheduler `drain()` | `handovers/phase-e-execution-log.md` (§E8) |

(PR #80 and earlier roll off — covered by their handovers in `docs/_meta/throughline/handovers/`. The Phase E chain uses a single append-only execution log rather than per-slice handover files; see its header for rationale.)

---

## Update Protocol

- **Refreshed at every session sign-off.** Last act of a session = update this file before merge. First act of next session = read it.
- **Every entry points at an artefact** — PR number, handover path, anchor ID, or file path. No floating claims.
- **Mutable.** Unlike handovers (immutable per `HANDOVER_TEMPLATE.md` rule 8), this file is rewritten in place. The Phase-22 carve-out for handovers does not apply here.
- **Roll semantics.** When entries roll (Recent Slice History past 5, Locked Decisions at cycle reset), older entries are *overwritten*. History lives in handovers and `git log`, not here.
- **Cycle reset.** "Locked Decisions This Cycle" rolls at a natural cohort boundary (phase close, multi-session stream close). The reset is triggered by the *next* cohort's first decision, not by the cohort-hardener pass itself. The hardener pass marks the cohort `production-ready`; the table retains the just-promoted cohort entries until the next phase mints its first T-D / C-D anchor, at which point the production-ready cohort rolls off and the new cycle begins.
- **Cross-references.** `SESSION_START.md` (reading order); `AUTHORING_DISCIPLINE.md` (post-work gate includes refreshing this file); `AUTO_CONTINUE_WORKFLOW.md` (slice-chain that lands the work this file reports).
