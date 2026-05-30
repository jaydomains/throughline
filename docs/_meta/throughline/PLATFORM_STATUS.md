# Throughline — Platform Status

*Living current-state snapshot. Updated at every session sign-off. Read first after `SESSION_START.md`.*

*Mutable file. Older entries are overwritten as they roll — history lives in handovers and `git log`, not here. To understand the past, read handovers. To understand the present, read this file.*

---

## Snapshot

**As of 2026-05-30.** Audit-fix **Phase A** (foundation fixes) merged to `main` via PR #67 (2026-05-30) — first of four sequential audit-fix workstreams (A → B → C → D) derived from the 2026-05 five-audit cycle (build, bugs, functional, silent-failure, improvements). Single PR in the cohort-hardener shape (not a multi-slice chain). Five deliverables: **(1) F1** — `@throughline/shared` gains a dual-condition `exports` map (`types` / `development` → src, `default` → built `dist/`) so the build artifact is runnable under plain `node` while every dev/typecheck/test/bundle path stays on source; backend `dev` / `start` pass `--conditions=development` to keep tsx on source. Verified end-to-end: `node` → `dist` (17 exports), `tsx --conditions=development` → `src` with `dist` absent, plain `tsx` crashes without `dist` (proving the flag is load-bearing — tsx does not honour `development` by default). Convention recorded as **C-D22**; resolves the dead-weight-`dist` concern (it now has a real consumer). **(2) I1** — backend `test/**` brought into typecheck via new `packages/backend/tsconfig.test.json` (src + test, `noEmit`) wired into the backend `typecheck` script; the one pre-existing type error surfaced (`bootstrap-watcher.test.ts` — a `Partial<Project> & {repo_path: string | null}` intersection collapsed `repo_path` to non-nullable) fixed with `Omit`. Blast radius was 1 error, far under the 30-error halt threshold. Closes the green-gate's backend-test-typecheck blind spot and unblocks Phase D regression tests. **(3) W2** — `engines.node ">=22"` pinned, `.github/workflows/ci.yml` aligned to Node 22, `@types/node` bumped `^20`→`^22` (root + backend) to match the v22.22 dev runtime. **(4) W4** — React Router `v7_startTransition` + `v7_relativeSplatPath` future flags opted in across `main.tsx` and 27 test `MemoryRouter`s (the actual source of the warnings); frontend test stderr now warning-free. **(5)** AUTHORING_DISCIPLINE.md gains a "Green-Gate Coverage — Known Gaps (this cohort)" section honestly scoping what the four-command gate proves vs. doesn't — gap 1 (backend `test/**` excluded from typecheck) closed here; gap 2 (wire-contract response types frontend-local, `jsonFetch<T>(…) as T` unvalidated cast) to be closed by Phase D. Green gate verified: 3 typecheck scopes, 500 backend + 182 frontend tests, lint, build all green. C-D22 is the audit-fix cohort's first new anchor, so the Locked Decisions table rolls per the cycle-reset rule. With Phase A merged, audit-fix **Phase B** (error/bundle refactor) is chain-open — tracked in issue #68 (4 sequential slices); slice 1 (shared error hierarchy, mints T-D58) is pending first execution against the now-merged `main`.

---

## Current Phase

**Phase:** Audit-fix **Phase A** (foundation fixes) merged to `main` 2026-05-30 via PR #67 (single PR). Audit-fix **Phase B** (error/bundle refactor) now chain-open — tracked in issue #68, 4 sequential slices; Phases C / D queued behind it (all scopes derive from the same 2026-05 audit cycle).
**Status:** Phase A `feature-complete` — foundation fixes merged, green gate verified. Phase B slice 1 pending first execution against the merged `main`. Phases 19–22 build cohort remains `production-ready` end-to-end.
**Next concrete action:** audit-fix Phase B slice 1 executes against the merged `main` (issue #68). Branch-protection required-check setting for `.github/workflows/ci.yml` still pending (see Queued Work) — now more material, since Phase A widened CI's true typecheck coverage.

---

## Locked Decisions This Cycle

**C-D22** is the audit-fix cohort's first new anchor, minted by Phase A — per the Update Protocol cycle-reset rule it rolls off the just-promoted Phases 19–22 build cohort entries (T-D49…T-D57, C-D19…C-D21, all `production-ready` since 2026-05-28; full bodies remain in `DECISIONS.md` / `CODE_SPEC.md` and in `git log`). The new audit-fix cycle starts minimal. One line each; full bodies in `CODE_SPEC.md`. This table rolls again when audit-fix Phase B (or later) mints its first new anchor.

| Anchor | Phase | One-line |
|---|---|---|
| C-D22 | Audit-fix A | Dual-condition `exports` for TS-source workspace packages: `types` / `development` → `src`, `default` → built `dist/`; backend tsx kept on source via `--conditions=development`. Makes `dist` node-runnable without forcing a build into the dev loop. |

---

## Queued Work

- **Branch-protection required-check setting for `.github/workflows/ci.yml`** (manual repo-admin action). The hardener pass added the workflow; the spec author still needs to set it as a required status check in Settings → Branches → protection rule for it to actually gate merges. Until then the workflow runs advisory and the chain runner's local `pnpm -r typecheck && pnpm -r test && pnpm -r lint && pnpm -r build` pass remains the load-bearing check. Same out-of-band action class as the now-demoted label slot.
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
| _this PR_ | Audit-fix Phase A — foundation fixes (F1 dist resolution, I1 backend test typecheck, W2 Node 22 pin, W4 RR v7 flags) | `handovers/2026-05-29-audit-fix-phase-a-foundation-fixes.md` |
| #66 | Cohort-level heavy hardener — Phases 19–22 build outputs | `handovers/2026-05-28-cohort-hardener-phases-19-22-build.md` |
| #65 | Phase 22 / Slice 2 — SettingsView `DisciplineScanBlock` (chain close) | `handovers/2026-05-28-phase-22-slice-2-discipline-scan-block.md` |
| #64 | Phase 22 / Slice 1 — discipline-scan-state backend lifecycle (chain open) | `handovers/2026-05-28-phase-22-slice-1-discipline-scan-state-lifecycle.md` |
| #62 | Phase 21 / Slice 4 — unified Bootstrap & clone-and-go SettingsView block (chain close) | `handovers/2026-05-28-phase-21-slice-4-unified-bootstrap-block.md` |

(PR #61 rolls off — covered by its handover in `docs/_meta/throughline/handovers/`.)

---

## Update Protocol

- **Refreshed at every session sign-off.** Last act of a session = update this file before merge. First act of next session = read it.
- **Every entry points at an artefact** — PR number, handover path, anchor ID, or file path. No floating claims.
- **Mutable.** Unlike handovers (immutable per `HANDOVER_TEMPLATE.md` rule 8), this file is rewritten in place. The Phase-22 carve-out for handovers does not apply here.
- **Roll semantics.** When entries roll (Recent Slice History past 5, Locked Decisions at cycle reset), older entries are *overwritten*. History lives in handovers and `git log`, not here.
- **Cycle reset.** "Locked Decisions This Cycle" rolls at a natural cohort boundary (phase close, multi-session stream close). The reset is triggered by the *next* cohort's first decision, not by the cohort-hardener pass itself. The hardener pass marks the cohort `production-ready`; the table retains the just-promoted cohort entries until the next phase mints its first T-D / C-D anchor, at which point the production-ready cohort rolls off and the new cycle begins.
- **Cross-references.** `SESSION_START.md` (reading order); `AUTHORING_DISCIPLINE.md` (post-work gate includes refreshing this file); `AUTO_CONTINUE_WORKFLOW.md` (slice-chain that lands the work this file reports).
