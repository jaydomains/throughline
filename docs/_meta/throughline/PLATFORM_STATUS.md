# Throughline — Platform Status

*Living current-state snapshot. Updated at every session sign-off. Read first after `SESSION_START.md`.*

*Mutable file. Older entries are overwritten as they roll — history lives in handovers and `git log`, not here. To understand the past, read handovers. To understand the present, read this file.*

---

## Snapshot

**As of 2026-05-30.** Audit-fix **Phase C+D** chain in flight (chain `audit-fix-phase-c-d` — frontend error-surfacing + green-gate hardening). Merged so far: **#76** chain-open workflow absorption; **#77** Slice C-1 (`useResource`/`usePolledResource` pair, mints **C-D24**). **Slice C-2** (this PR) completes the Phase C half — the C-D24 error slot now reaches the UI via a shared `<LoadError>` banner across TreeView/GraphView/SessionView/SessionsIndex/HomeView/DriftInbox/LibraryView, `useDirectives`/`useDriftInbox` gain an `error` slot, `useCostMeter`/`useBackupStatus` move onto `usePolledResource` (`useBackendHealth` a documented exception), and fire-and-forget mutation handlers (ItemDetailPanel detach/delete, DriftInbox `act`, SettingsView `getSettings`, LibraryView refresh) now catch. Clears SF6-01/02 Criticals + SF6-03..07 Highs + SF6-08/10/11/12 Mediums. New `test/hooks.test.tsx` locks SF6-01/02. Green gate: typecheck, **187** frontend tests (+5), lint, build all green. Phase A (#67) + Phase B (#68 chain) remain `feature-complete`. **Phase D** (Slice D-1: wire-contract types → `@throughline/shared`) is next.

---

## Current Phase

**Phase:** Audit-fix **Phase C+D** chain in flight (chain `audit-fix-phase-c-d`). Merged: #76 (absorption), #77 (C-1). Slice **C-2** open (this PR) — closes the Phase C half. D-1 / D-2 / D-3 pending.
**Status:** Phases A & B `feature-complete`. Phases 19–22 build cohort `production-ready`.
**Next concrete action:** Slice **D-1** — move wire-contract response types from frontend-local to `@throughline/shared`, type-validate `jsonFetch` at the boundary, add a wire-contract test (mints **T-D59**), and flip AUTHORING_DISCIPLINE Gap 2 → Closed. Branch-protection `gate` check is live on `main`. A cohort-level hardener + `production-ready` promotion for the audit-fix cohort (A–D) follows once D lands.

---

## Locked Decisions This Cycle

The audit-fix cohort (Phases A → D) accumulates its anchors here. C-D22 (Phase A) reset the cycle off the now-`production-ready` Phases 19–22 entries (T-D49…T-D57, C-D19…C-D21; full bodies remain in `DECISIONS.md` / `CODE_SPEC.md` and `git log`); T-D58 (Phase B slice 1) is appended. One line each; full bodies in `DECISIONS.md` / `CODE_SPEC.md`. The table rolls when the audit-fix cohort closes and a successor cohort mints its first anchor.

| Anchor | Phase | One-line |
|---|---|---|
| C-D22 | Audit-fix A | Dual-condition `exports` for TS-source workspace packages: `types` / `development` → `src`, `default` → built `dist/`; backend tsx kept on source via `--conditions=development`. Makes `dist` node-runnable without forcing a build into the dev loop. |
| T-D58 | Audit-fix B/S1 | Shared domain-error hierarchy in `@throughline/shared`: domain errors carry canonical HTTP `statusCode` + stable `code`; routes never re-decide status (central handler reads it — slice 3 / C-D23). Closes 17+5+2 duplicate NotFound defs and the SF6-09 status drift. |
| C-D23 | Audit-fix B/S3 | Central Fastify `setErrorHandler` + `mapDomainError` reads `statusCode`/`code`/`details` off any thrown `DomainError` → canonical `ErrorResponse` body; ~50 hand-rolled try/catch blocks deleted. Spans slices 1+3. |
| C-D24 | Audit-fix C/S1 | `useResource` / `usePolledResource` frontend hook pair: one `ResourceState<T>` (`{ data, loading, error, refresh }`) owns the loading/error triple + `alive` unmount guard + stable refresh; callers pass a memoised fetcher (or `null` to disable). The `error` slot is the SF6 surface, made uniform here. |

---

## Queued Work

- **Branch-protection required-check — DONE.** The `gate` workflow (`.github/workflows/ci.yml`) is now a required status check on `main`; it gated PR #76 (`mergeable_state: blocked` until `gate` + Gitar passed, then `clean`). The local `pnpm -r typecheck && pnpm -r test && pnpm -r lint && pnpm -r build` pass remains the chain runner's pre-PR check, but CI is now the enforcing gate at merge.
- **`throughline:pause` label — formally accepted-and-stop-surfacing** (this hardener pass). The slot was open for five consecutive PLATFORM_STATUS rolls. Across Phases 19/20/21/22 the cohort ran end-to-end clean on the two canonical fallback signals (marker file at `.claude-code/auto-continue-pause`, `/pause` PR/issue comments). Per the PR #43 Session-1-handover-gap adjudication precedent, this hardener pass demoted `throughline:pause` in `AUTO_CONTINUE_WORKFLOW.md` to optional/future rather than carrying the gap forward to a sixth pass. The label remains a valid third signal if the spec author later creates it; no further Queued Work entry until then. Recorded for posterity, not as work to do.

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
| _this PR_ | Phase C / Slice 2 — surface data-hook errors in consumers + mutation catches (SF6), `<LoadError>` + regression test | `handovers/2026-05-30-phase-c-slice-2-error-surfacing.md` |
| #77 | Phase C / Slice 1 — `useResource` / `usePolledResource` hook pair + 3 proof adopters (mints C-D24) | `handovers/2026-05-30-phase-c-slice-1-useresource.md` |
| #76 | Phase C+D chain-open — absorb doc-PR collision + merge-on-green polling rules into `AUTO_CONTINUE_WORKFLOW.md` | (workflow-doc PR; reconciliation handover `handovers/2026-05-30-doc-pr-chain-collision-reconciliation.md`) |
| #74 | Phase B / Slice 4 — `resolveProjectBundle` + 4 call sites + T-D51 amendment (chain close) | `handovers/2026-05-30-phase-b-slice-4-resolve-project-bundle.md` |
| #73 | Phase B / Slice 3 — central Fastify error handler + delete ~50 hand-rolled try/catch (mints C-D23) | `handovers/2026-05-30-phase-b-slice-3-central-error-handler.md` |

(PRs #72/#69/#67/#66 roll off — covered by their handovers in `docs/_meta/throughline/handovers/`.)

---

## Update Protocol

- **Refreshed at every session sign-off.** Last act of a session = update this file before merge. First act of next session = read it.
- **Every entry points at an artefact** — PR number, handover path, anchor ID, or file path. No floating claims.
- **Mutable.** Unlike handovers (immutable per `HANDOVER_TEMPLATE.md` rule 8), this file is rewritten in place. The Phase-22 carve-out for handovers does not apply here.
- **Roll semantics.** When entries roll (Recent Slice History past 5, Locked Decisions at cycle reset), older entries are *overwritten*. History lives in handovers and `git log`, not here.
- **Cycle reset.** "Locked Decisions This Cycle" rolls at a natural cohort boundary (phase close, multi-session stream close). The reset is triggered by the *next* cohort's first decision, not by the cohort-hardener pass itself. The hardener pass marks the cohort `production-ready`; the table retains the just-promoted cohort entries until the next phase mints its first T-D / C-D anchor, at which point the production-ready cohort rolls off and the new cycle begins.
- **Cross-references.** `SESSION_START.md` (reading order); `AUTHORING_DISCIPLINE.md` (post-work gate includes refreshing this file); `AUTO_CONTINUE_WORKFLOW.md` (slice-chain that lands the work this file reports).
