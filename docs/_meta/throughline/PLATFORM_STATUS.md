# Throughline — Platform Status

*Living current-state snapshot. Updated at every session sign-off. Read first after `SESSION_START.md`.*

*Mutable file. Older entries are overwritten as they roll — history lives in handovers and `git log`, not here. To understand the past, read handovers. To understand the present, read this file.*

---

## Snapshot

**As of 2026-05-30.** Audit-fix cohort (**Phases A–D**) **`production-ready`** — promoted by this cohort-level heavy hardener pass (the second under codified discipline; the first was PR #43). All four phases landed and verified: Phase A (dual-condition workspace `exports`, **C-D22**); Phase B (shared `DomainError` hierarchy + central Fastify handler + `resolveProjectBundle`, **T-D58** / **C-D23**); Phase C (`useResource` / `usePolledResource` error-surfacing hooks, **C-D24**); Phase D (wire-contract types in `@throughline/shared` + backend lifecycle locks, **T-D59**). This pass swept cross-doc drift: stale T-D index count (57→59 in `CODE_SPEC.md §1`), kill-switch wording in `SESSION_START.md`, the ROADMAP-backfill checklist example, and **corrected a compaction-inherited false claim that `SESSION_START.md` was absent** — the file is present at the repo root and authoritative (root cause now codified in `AUTO_CONTINUE_WORKFLOW.md` § Pre-Flight State Verification). `AUTO_CONTINUE_WORKFLOW.md` absorbed the arc's process findings (doc-PR collision and merge-on-green polling landed earlier via PR #76; this pass added pre-flight state verification, the poll-driven-not-subscription-driven directive, and the explicit one-PR-per-slice canonical rhythm). PR #76's missing handover was backfilled. **Next:** no chain in flight; the next phase/cohort opens a fresh cycle and rolls the Locked Decisions table on its first anchor.

---

## Current Phase

**Phase:** Audit-fix cohort (A–D) **complete and `production-ready`** — heavy hardener pass (this PR). Phases 19–22 build cohort remains `production-ready`.
**Status:** All audit-fix phases done and promoted. No chain in flight.
**Next concrete action:** Spec author opens the next phase/cohort. The Locked Decisions This Cycle table holds the audit-fix anchors until that cohort mints its first T-D / C-D anchor, then rolls per the Update Protocol.

---

## Locked Decisions This Cycle

The audit-fix cohort (Phases A → D), now **`production-ready`**, holds its anchors here. C-D22 (Phase A) reset the cycle off the now-`production-ready` Phases 19–22 entries (T-D49…T-D57, C-D19…C-D21; full bodies remain in `DECISIONS.md` / `CODE_SPEC.md` and `git log`). One line each; full bodies in `DECISIONS.md` / `CODE_SPEC.md`. Per the Update Protocol "Cycle reset" rule the table does **not** roll in the hardener pass; it rolls only when a successor cohort mints its first T-D / C-D anchor.

| Anchor | Phase | One-line |
|---|---|---|
| C-D22 | Audit-fix A | Dual-condition `exports` for TS-source workspace packages: `types` / `development` → `src`, `default` → built `dist/`; backend tsx kept on source via `--conditions=development`. Makes `dist` node-runnable without forcing a build into the dev loop. |
| T-D58 | Audit-fix B/S1 | Shared domain-error hierarchy in `@throughline/shared`: domain errors carry canonical HTTP `statusCode` + stable `code`; routes never re-decide status (central handler reads it — slice 3 / C-D23). Closes 17+5+2 duplicate NotFound defs and the SF6-09 status drift. |
| C-D23 | Audit-fix B/S3 | Central Fastify `setErrorHandler` + `mapDomainError` reads `statusCode`/`code`/`details` off any thrown `DomainError` → canonical `ErrorResponse` body; ~50 hand-rolled try/catch blocks deleted. Spans slices 1+3. |
| C-D24 | Audit-fix C/S1 | `useResource` / `usePolledResource` frontend hook pair: one `ResourceState<T>` (`{ data, loading, error, refresh }`) owns the loading/error triple + `alive` unmount guard + stable refresh; callers pass a memoised fetcher (or `null` to disable). The `error` slot is the SF6 surface, made uniform here. |
| T-D59 | Audit-fix D/S1 | Wire-contract response types live in `@throughline/shared` (`wire.ts`): backend handlers annotate their payload against the shared envelope, `jsonFetch` targets it, and `wire-contract.test.ts` asserts the running backend emits the shape — contract verified (compile time + runtime), not cast with `as T`. Closes green-gate Gap 2. |

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
| _this PR_ | Cohort-level heavy hardener — audit-fix A–D → `production-ready` (cross-doc drift sweep, workflow-finding absorption, PR #76 handover backfill) | `handovers/2026-05-30-cohort-hardener-audit-fix-a-d.md` |
| #81 | Phase D / Slice 3 — backend lifecycle locks: S4-01 dismissal idempotency, S7-01 shutdown ordering, F1-01 lock (chain close) | `handovers/2026-05-30-phase-d-slice-3-lifecycle-locks.md` |
| #80 | Phase D / Slice 2 — backend data-integrity locks: S2-01 ReDoS bypass, SF2-01 scanner-throw, S5-01 dump-zone atomicity | `handovers/2026-05-30-phase-d-slice-2-data-integrity-locks.md` |
| #79 | Phase D / Slice 1 — wire-contract types → `@throughline/shared` + contract test (mints T-D59, closes Gap 2) | `handovers/2026-05-30-phase-d-slice-1-wire-contract.md` |
| #78 | Phase C / Slice 2 — surface data-hook errors in consumers + mutation catches (SF6), `<LoadError>` + regression test | `handovers/2026-05-30-phase-c-slice-2-error-surfacing.md` |

(PR #77 and earlier roll off — covered by their handovers in `docs/_meta/throughline/handovers/`.)

---

## Update Protocol

- **Refreshed at every session sign-off.** Last act of a session = update this file before merge. First act of next session = read it.
- **Every entry points at an artefact** — PR number, handover path, anchor ID, or file path. No floating claims.
- **Mutable.** Unlike handovers (immutable per `HANDOVER_TEMPLATE.md` rule 8), this file is rewritten in place. The Phase-22 carve-out for handovers does not apply here.
- **Roll semantics.** When entries roll (Recent Slice History past 5, Locked Decisions at cycle reset), older entries are *overwritten*. History lives in handovers and `git log`, not here.
- **Cycle reset.** "Locked Decisions This Cycle" rolls at a natural cohort boundary (phase close, multi-session stream close). The reset is triggered by the *next* cohort's first decision, not by the cohort-hardener pass itself. The hardener pass marks the cohort `production-ready`; the table retains the just-promoted cohort entries until the next phase mints its first T-D / C-D anchor, at which point the production-ready cohort rolls off and the new cycle begins.
- **Cross-references.** `SESSION_START.md` (reading order); `AUTHORING_DISCIPLINE.md` (post-work gate includes refreshing this file); `AUTO_CONTINUE_WORKFLOW.md` (slice-chain that lands the work this file reports).
