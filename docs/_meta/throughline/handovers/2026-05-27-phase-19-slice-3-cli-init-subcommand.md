# Throughline Handover — Phase 19 Slice 3: CLI `throughline init` subcommand + T-D52 doc amendment

**Generated:** 2026-05-27
**Last commit SHA:** pending — 2026-05-27
**Previous handover:** `2026-05-27-phase-19-slice-2-init-readers-and-reinit-flow.md` (Slice 2 — PR #48, merged 2026-05-27)

Third slice of the Phase 19 clone-and-go chain (tracking issue [#46](https://github.com/jaydomains/throughline/issues/46)).

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| C-D19 surface 4 — CLI `throughline init` subcommand wired into the binary; HTTP-only side effects per T-D52; probes `/health` and prints the canonical "Start the backend first: …" message + exit non-zero on failure | built | `packages/backend/src/cli/init.ts` (new); `packages/backend/src/cli/index.ts` (init dispatch + help text); `test/cli-init.test.ts` (8 tests) | Both the explicit non-2xx and the fetch-throws (connection refused) paths surface the same canonical message. Help text now includes `throughline init [--repo <path>]`. |
| C-D19 surface 4 — First-run vs re-init disambiguation: existing project bound to `repo_path` → PATCH `{ reinit_throughline: true }`; no existing → POST assembled payload | built | `packages/backend/src/cli/init.ts` `runInit()` lists `/api/projects?include_archived=true` and matches by exact `repo_path` | The match relies on Slice 1's normalisation having collapsed equivalent paths into a single persisted value. The CLI also `realpathSync.native`-canonicalises its own `--repo` arg (or `process.cwd()`) before the lookup so the comparison string matches the server's persisted form. |
| C-D19 surface 4 — First-run payload assembly: reads `.throughline/project.json`, fills github_owner/github_repo from origin remote when file is silent, defaults name to repo basename when `project_name` absent | built | `packages/backend/src/cli/init.ts` consumes Slice 2's `readProjectConfig` and `detectGitHubRemote` as same-package library imports per T-D52 | Re-init path delegates the read to the backend (T-D52 single-validator discipline; landed in Slice 2). First-run path reads locally because POST has no `init_throughline` flag in C-D19 scope. Same Slice 2 helpers either way — no schema knowledge duplicated. |
| Spec-author-confirmed decision 1 — T-D52 doc amendment from `/api/health` to `/health` | built | `DECISIONS.md:1096` line "On invocation the CLI probes `GET /health`…" | One-line amendment; doc text now matches the long-standing backend route at `packages/backend/src/routes/health.ts:4`. |

---

## Last Decision Minted

No new decisions minted. Implementation followed T-D52 (single write path through HTTP endpoints), C-D19 surface 4. The T-D52 health-probe path itself was amended from `/api/health` to `/health` per the spec-author-approved decision at chain open — that amendment was a clarification of which path was canonical, not a new rule.

Implementation-shape choices recorded inline:

- **First-run reads locally; re-init delegates to backend.** The asymmetry is intentional and small: `POST /api/projects` has no `init_throughline` flag in C-D19 scope, so the CLI assembles the create payload from the local file. `PATCH /api/projects/:id` with `reinit_throughline: true` lets the backend re-read (T-D52, surface 7). Both code paths use the same Slice 2 helpers (`readProjectConfig`, `detectGitHubRemote`) imported from `packages/backend/src/init/` as library code, so no schema-knowledge duplication occurs.
- **Realpath-canonicalised CLI repo path.** The CLI `realpathSync.native`-canonicalises its `--repo` argument (or `process.cwd()`) before the lookup, so the exact-string match against the server's normalised persisted `repo_path` (Slice 1) finds the right project. ENOENT falls back to `resolve()` for pre-materialisation invocations (matches Slice 1's `validateRepoPath` fallback semantics).
- **`fetchImpl` test seam.** `runInit` accepts an optional `fetchImpl` parameter so tests can stub HTTP without spinning up a real backend. The dispatching code path (`packages/backend/src/cli/index.ts`) does not pass it; production invocations use the built-in `fetch`.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/backend/src/cli/init.ts` — `runInit` orchestrator: probe → list projects → first-run POST or re-init PATCH. Exports `InitError`, `InitOptions`, `InitResult`. Same-package imports of `readProjectConfig` and `detectGitHubRemote` from Slice 2.
- `packages/backend/test/cli-init.test.ts` — 8 tests: probe failure on non-2xx, probe failure on fetch-throws, missing `project.json` error, first-run POST payload assembly, name default to basename, github auto-detect from origin remote, re-init PATCH with `reinit_throughline: true`, different `repo_path` falls through to first-run.
- `docs/_meta/throughline/handovers/2026-05-27-phase-19-slice-3-cli-init-subcommand.md` — this handover.

**Modified:**
- `packages/backend/src/cli/index.ts` — `init` subcommand dispatch (`initCmd`); help text adds `throughline init [--repo <path>]` line. Imports `runInit` and `InitError` from `./init.js`.
- `DECISIONS.md` T-D52 — health-probe path amended from `/api/health` to `/health` at line 1096. One-line fix per spec-author-confirmed decision 1 at chain open.
- `.claude-code/auto-continue-state.json` — Slice 2 marked merged (PR #48, 1 fix-round); Slice 3 opened (PR pending); `currentIndex: 2`.
- `docs/_meta/throughline/PLATFORM_STATUS.md` — Snapshot, Current Phase updated for Slice 3 in flight.
- `CHECKLIST.md` §19 — Slice 2 ticked; Slice 3 marked PR-pending.

---

## Drift Flags

_none_

---

## Open Questions

- [ ] **`--start-backend` polish flag** — T-D52 explicitly defers this: "a `--start-backend` flag that would spawn the backend process itself is polish and is deferred — adding it later does not change this decision's shape". Not part of C-D19. Landing site: a future polish slice if user demand materialises.
- [ ] **CLI exit codes for non-probe HTTP failures** — `runInit` throws plain `InitError` (default exit 1) for non-2xx responses on `/api/projects`. The CLI wrapper exits with the InitError's `exitCode` for InitError instances, or 1 for any other exception. C-D19 doesn't enumerate exit codes; current behaviour is a reasonable default but could be tightened. Landing site: future polish or driven by Slice 4 frontend test feedback.

---

## Recently Resolved

- **Slice 2 (Phase 19) merged** — was flagged in Slice 2's handover as "PR pending"; resolved by PR #48 merge with 1 fix-round folded inline.
- **T-D52 `/api/health` vs `/health` drift** — was identified in plan-mode as "spec/code drift" and resolved by spec-author decision 1 (amend doc, not code). Doc amendment lands in this slice's PR.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- Slice 2's `readProjectConfig` + `detectGitHubRemote` (`packages/backend/src/init/`) — used for first-run payload assembly.
- Slice 1's `validateRepoPath` semantics — the CLI canonicalises its `--repo` argument the same way the backend canonicalises `repo_path` on writes, so the lookup-match works.
- `/health` route (`packages/backend/src/routes/health.ts`) — health probe target.
- `/api/projects` endpoints — first-run POST + re-init PATCH targets.

**Downstream (consumes this slice's work):**
- **Slice 4 (frontend NewProjectModal + SettingsView)** — independent surface; no direct consumption. Slice 4 may surface `.throughline/` presence/status in the SettingsView via a new backend response field (`throughline_status`); whether that endpoint reuses Slice 2's `projectConfigExists` is left for Slice 4.

---

## Reference

- `DECISIONS.md` T-D52 — single-write-path discipline; amended in this slice from `/api/health` to `/health`.
- `CODE_SPEC.md` C-D19 — surface 4.
- `SPEC.md` §7.26 — clone-and-go functional behaviour.
- `docs/.throughline-schema.md` — per-repo config schema.
- Chain plan: `/root/.claude/plans/plan-mode-phase-19-build-vast-sutherland.md` (session-local).
- Chain state: `.claude-code/auto-continue-state.json`.
- Tracking issue: [#46](https://github.com/jaydomains/throughline/issues/46).
- PR: pending.
