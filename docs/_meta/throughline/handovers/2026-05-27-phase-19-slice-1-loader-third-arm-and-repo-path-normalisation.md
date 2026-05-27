# Throughline Handover — Phase 19 Slice 1: loader third arm + repo-path normalisation

**Generated:** 2026-05-27
**Last commit SHA:** pending — 2026-05-27
**Previous handover:** `2026-05-27-authoring-discipline-cycle-reset-encoding.md` (PR #45 — AUTHORING_DISCIPLINE.md cycle-reset encoding)

First slice of the Phase 19 clone-and-go chain (tracking issue [#46](https://github.com/jaydomains/throughline/issues/46), `Auto-continue: phase-19-clone-and-go`). First implementation chain under the codified `AUTO_CONTINUE_WORKFLOW.md` rhythm.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| C-D19 surface 1 — Bundle loader third arm: `<repo_path>/.throughline/bundle.md` resolves between explicit `bundle_path` (arm 1) and install-shipped fallback (arm 3); chokidar watcher refcounts the per-repo file | built | `packages/backend/src/methodology/loader.ts` (extended `MethodologyRegistry` interface; new `repoCache`/`repoMeta` maps; `loadRepoFile`, `repoFileFor`, `projectsBoundToRepoFile`; watcher dispatch extended; `resolveBundle`/`hasBundle`/`registerProjectBundle` gain optional `repoPath` parameter); `test/loader.test.ts` "per-repo arm" describe block | Arm 2 watch is registered even when the file doesn't currently exist — chokidar's `add` event flips the binding from arm 3 to arm 2 reactively when a `.throughline/bundle.md` later appears (clone-and-go intent). |
| C-D19 surface 8 — Project create/update normalise `repo_path` to absolute symlink-resolved canonical form; second create against an equivalent path collides on uniqueness | built | `packages/backend/src/projects/service.ts` (new `validateRepoPath`, `findProjectByRepoPath`, `InvalidRepoPathError`, `DuplicateRepoPathError`; `create` + `update` thread normalised path); `packages/backend/src/projects/routes.ts` (409 mapping for `DuplicateRepoPathError`, 400 for `InvalidRepoPathError`); `test/projects.test.ts` "repo_path normalisation" describe block | Pre-materialisation paths (path doesn't exist on disk yet) fall back to `normalize()` rather than failing — tests and scripted setup may bind a project before the directory exists. |
| C-D19 surface 1 — Threading `repo_path` to all internal `registry.resolveBundle` callers so arm-2 projects don't silently fall to arm 3 in non-creation code paths | built | `packages/backend/src/server.ts:155-160`, `items/service.ts:232-251` (signature change), `intelligence/{periodic-review.ts,chat.ts}`, `methodology/{session-start/engine.ts,companion/engine.ts,gates/runtime.ts}`, `github/tier4.ts` | Eight call sites updated; the helper `bundleFor`/`policyFor` pair in `items/service.ts` gained a `repoPath` parameter rather than re-fetching project rows. |

---

## Last Decision Minted

No new decisions minted. Implementation followed T-D51 (`.throughline/` per-repo convention + third bundle-resolution arm), T-D52 (CLI write contract — not exercised in this slice; reserved for Slice 3), and C-D19 (eight implementation surfaces; this slice landed 1 and 8). Implementation-shape choices recorded inline at the relevant code sites:

- **Reactive arm-2 binding shift.** `registerProjectBundle` watches `<repoPath>/.throughline/bundle.md` even when the file does not currently exist; chokidar's `add` event flips the project's binding from arm 3 to arm 2 at the moment of file creation. The alternative (one-time check at register time, no later switching) would have left clone-and-go semantics half-built — a later `throughline init` against a repo that gains a `.throughline/bundle.md` would not re-bind without an explicit re-init.
- **Application-level uniqueness check.** A DB `UNIQUE` constraint on `repo_path` is feasible but interacts with decision 3 (no backfill of legacy rows) — pre-existing rows could already hold non-canonical duplicates that a `UNIQUE` index would refuse to build over. Application-level `findProjectByRepoPath` pre-check is sufficient for the new-writes-only contract C-D19 specifies; DB-level tightening is left to a future migration if/when legacy rows are normalised.
- **`realpathSync.native` with `normalize()` fallback.** `validateRepoPath` attempts realpath first; on ENOENT (path doesn't exist on disk yet) it falls back to `normalize()`. Existing tests and scripted setup legitimately bind a project before its repo is materialised; we don't demand existence.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `.claude-code/auto-continue-state.json` — chain state file for `phase-19-clone-and-go` (per `AUTO_CONTINUE_WORKFLOW.md` §"Chain State Persistence"). Atomic writes; committed to repo so chain state survives session restart.
- `docs/_meta/throughline/handovers/2026-05-27-phase-19-slice-1-loader-third-arm-and-repo-path-normalisation.md` — this handover.

**Modified:**
- `packages/backend/src/methodology/loader.ts` — third bundle-resolution arm. New `repoCache`/`repoMeta` refcount maps mirror the existing external arm. `MethodologyRegistry` interface methods (`resolveBundle`, `hasBundle`, `registerProjectBundle`) gain an optional `repoPath` parameter. Watcher dispatch in the `'all'` handler grew a third branch for per-repo files. `unregisterProjectBundle` iterates both external and repo meta maps.
- `packages/backend/src/projects/service.ts` — `validateRepoPath` normalises `repo_path` via `realpathSync.native` (with `normalize()` fallback on ENOENT). `findProjectByRepoPath` provides the application-level uniqueness check. New `InvalidRepoPathError` and `DuplicateRepoPathError` classes. `create` and `update` thread the normalised `repoPath` to the registry. `update` re-binds the watcher when arm-2 inputs shift even if `bundle_id`/`bundle_path` didn't.
- `packages/backend/src/projects/routes.ts` — POST and PATCH endpoints surface 400 for `InvalidRepoPathError`, 409 for `DuplicateRepoPathError`.
- `packages/backend/src/server.ts` — startup hydration registers per-repo arm in addition to external arm (`p.bundle_path || p.repo_path` gate).
- `packages/backend/src/items/service.ts` — `bundleFor` / `policyFor` helpers gain a `repoPath` parameter; four call sites updated.
- `packages/backend/src/intelligence/periodic-review.ts`, `packages/backend/src/intelligence/chat.ts`, `packages/backend/src/methodology/session-start/engine.ts`, `packages/backend/src/methodology/companion/engine.ts`, `packages/backend/src/methodology/gates/runtime.ts` (two call sites), `packages/backend/src/github/tier4.ts` — thread `project.repo_path` into `registry.resolveBundle` calls so arm-2 projects resolve correctly in non-creation code paths.
- `packages/backend/test/loader.test.ts` — five new tests in a "per-repo arm (C-D19 surface 1)" describe block: arm-2-wins-over-arm-3, fall-through-when-absent, arm-1-wins-over-arm-2, refcount-across-projects, parse-error-falls-through.
- `packages/backend/test/projects.test.ts` — six new tests in a "repo_path normalisation (C-D19 surface 8)" describe block: relative rejected, traversal rejected, symlink canonicalised, ENOENT-fallback-allowed, duplicate-create-collides, duplicate-update-collides.
- `packages/backend/test/companion.test.ts:271-275` — second project now uses a distinct `repo_path` (was sharing the first project's `repo_path` only incidentally; now uniqueness is enforced).
- `docs/_meta/throughline/PLATFORM_STATUS.md` — Snapshot, Current Phase, and Queued Work refreshed for chain open. New queued bullets: `AUTO_CONTINUE_WORKFLOW.md` line 74 wording fix (spec-author-flagged) and GitHub label creation for `auto-continue` / `throughline:pause`.
- `CHECKLIST.md` §19 — replaced "slice splits land when this phase's build session opens" with the spec-author-approved four-slice decomposition.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Repo-path normalisation does not backfill existing rows | `packages/backend/src/projects/service.ts` | C-D19 surface 8 says "project create and update normalise". Existing rows are left as-is; legacy rows with non-canonical paths continue to resolve via exact-string match in the loader's arm-2 lookup. | Spec-author-confirmed 2026-05-27: "observed and intentional, not fixed" (plan-mode decision 3, no backfill). A future migration is feasible if/when desired. |
| GitHub repo lacks `auto-continue` and `throughline:pause` labels | repo settings (`jaydomains/throughline`) | `AUTO_CONTINUE_WORKFLOW.md` kill-switch mechanism uses both labels; both currently absent. Tracking issue #46 was opened without labels. | Captured in `PLATFORM_STATUS.md` Queued Work. Kill-switch remains operable via the marker file (`.claude-code/auto-continue-pause`) and `/pause` PR/issue comments — both label-independent signals. |
| `AUTO_CONTINUE_WORKFLOW.md` line 74 wording reads ambiguously | `docs/_meta/throughline/AUTO_CONTINUE_WORKFLOW.md` | The line says the tracking issue "carries the `throughline:pause` label across the chain's entire lifetime"; the label is actually the operator-applied toggle (presence = halt). Spec-author-confirmed reading: the issue is the *durable carrier surface* for the label; the label is absent during normal run. | Captured in `PLATFORM_STATUS.md` Queued Work for a small standalone doc slice (not Phase 19 scope). |

---

## Open Questions

- [ ] **DB-level `UNIQUE` constraint on `projects.repo_path`** — application-level check is in place; DB-level tightening would require a backfill migration. Landing site: future migration slice if/when legacy non-canonical rows are normalised, or as a Phase 20+ side-effect if a clear forcing function emerges.
- [ ] **Arm-2 → arm-3 fall-back semantics on file unlink** — when a project's `.throughline/bundle.md` is deleted at runtime, the watcher's `'unlink'` event clears the repo cache and notifies bound projects via `onBundleReloaded`. Downstream consumers (e.g. discipline drift, gates) will then re-resolve via arm 3. This is the intended behaviour but lacks a dedicated integration test. Landing site: Slice 4 (frontend SettingsView surfaces this state transition) or a follow-up loader integration test.

---

## Recently Resolved

- **Phase 19 build chain open** — was flagged in `2026-05-26-cohort-hardener-phases-19-22.md` as "build session can open immediately after this PR merges"; resolved by this slice (chain opened with tracking issue #46 and state file `.claude-code/auto-continue-state.json`).
- **First implementation chain under codified auto-continue workflow** — was implicit in `2026-05-26-platform-discipline-polish.md` (PR #41 codified the workflow); resolved by this slice as the first chain run under the documented mechanics.
- **Fix-round 1 (Gitar) — `loadRepoFile` ENOENT noise on startup hydration** — Gitar review on PR #47 flagged that arm-2 register-time probe wrote an audit row + fired `notifyReloaded` on ENOENT, which is the expected state for clone-and-go projects. Folded inline at `packages/backend/src/methodology/loader.ts:228-262` by gating audit + notify on `code !== 'ENOENT'` (mirrors the pre-existing logger gate at the same site). Regression test: `packages/backend/test/loader.test.ts` — "startup hydration of a project without `.throughline/bundle.md` writes no audit (ENOENT is quiet)". Gitar's second finding (trailing-slash paths in `validateRepoPath`) was an informational note — Gitar explicitly stated "No actual bug here — noting for completeness that the validation is sound"; no action required.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- `chokidar` — existing per-bundle watcher infrastructure (C-D14). The per-repo arm reuses the existing watcher; no new watcher instance.
- `parseBundle` (`packages/backend/src/methodology/bundle-parser/`) — invoked for repo-local bundles via `loadRepoFile`; same parser, same eleven-section grammar (C-D3).
- `appendAudit` — `loadRepoFile` writes audit rows under `entity_type: 'bundle_binding'`, mirroring the external-arm audit pattern.

**Downstream (consumes this slice's work):**
- **Slice 2** (init readers + re-init flow) — will consume the normalised `repo_path` value persisted by `validateRepoPath` and pass it to `git remote get-url` and `.throughline/project.json` reads.
- **Slice 3** (CLI init subcommand) — relies on the canonical `repo_path` shape returned in the project-create response to drive idempotent re-init.
- **Slice 4** (frontend SettingsView missing-config block) — reads project rows where the new `repo_path` canonicalisation determines whether the per-repo `.throughline/` scan resolves uniformly.

---

## Reference

- `DECISIONS.md` T-D51 — `.throughline/` per-repo convention; third bundle-resolution arm.
- `DECISIONS.md` T-D52 — CLI write contract (consumed in Slice 3, not this slice).
- `CODE_SPEC.md` C-D19 — eight implementation surfaces for clone-and-go; this slice landed 1 and 8.
- `SPEC.md` §7.26 — clone-and-go functional behaviour.
- `docs/.throughline-schema.md` — per-repo config schema (consumed in Slice 2).
- `docs/_meta/throughline/AUTO_CONTINUE_WORKFLOW.md` — chain mechanics, halt classes, kill switch.
- `ROADMAP.md` §19 — Scope / Dependencies / Done when / Sizing.
- Plan: `/root/.claude/plans/plan-mode-phase-19-build-vast-sutherland.md` (session-local, not in repo).
- Tracking issue: [#46](https://github.com/jaydomains/throughline/issues/46) — `Auto-continue: phase-19-clone-and-go`.
- Chain state: `.claude-code/auto-continue-state.json`.
- PR: pending.
