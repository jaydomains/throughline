# Throughline Handover — Phase 21 Slice 1: bootstrap prompt template + render endpoint + path-guard + `.gitignore`

**Generated:** 2026-05-28
**Last commit SHA:** pending — 2026-05-28
**Previous handover:** `2026-05-27-carry-forwards-cleanup-pre-phase-21.md` (doc carry-forwards cleanup at Phase 20 → Phase 21 boundary)

First slice of the Phase 21 bootstrap-producer chain (tracking issue [#58](https://github.com/jaydomains/throughline/issues/58), `Auto-continue: phase-21-build-immutable-riddle`). Third implementation chain under the codified `AUTO_CONTINUE_WORKFLOW.md` rhythm.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| C-D21 surface 1 — repo-owned generic prompt template at `packages/backend/src/bootstrap/prompt-template.md` (T-D55); bundle-aware via runtime LLM file-read, not Throughline-side templating | built | `packages/backend/src/bootstrap/prompt-template.md` | Template walks Claude Code through reading the bundle at `bundle_path`, applying §2 / §5 / §6 / §7 as extraction policy, deriving `bootstrap_id` per T-D54 rules, populating the three sections (items / sessions / library_entries) per T-D53, and writing the JSON to `output_path`. Explicit exclusions (secrets per T-D4, audit history, embeddings, settings, methodology bindings) + graceful-degradation guidance (bundles without certain sections, repos without ROADMAP/CHECKLIST → fewer rows, not failure). |
| C-D21 surface 2 — `POST /api/projects/:id/bootstrap/render` reads template, prepends fixed parameter block (`bundle_path`, `repo_root`, `output_path`), writes `<repo_path>/.throughline/bootstrap-prompt.md`, returns the prompt path + copy-pasteable invocation command | built | `packages/backend/src/bootstrap/render.ts`; route registered in `packages/backend/src/bootstrap/routes.ts`; `packages/backend/test/bootstrap-render.test.ts` (11 tests) | YAML frontmatter format matches the dump-zone extractor convention. Idempotent — re-rendering produces byte-identical content (`render.test.ts` "re-rendering produces byte-identical prompt content"). Errors mapped: `project_not_found` → 404, `no_bundle_bound` → 400, `path_escape` → 400. |
| C-D21 implications — Throughline-managed `<repo_path>/.throughline/.gitignore` covering transient ingest state | built | `render.ts` `ensureGitignore()` writes the 4-line payload (`bootstrap-prompt.md`, `bootstrap-output.json`, `bootstrap-archive/`, `bootstrap-quarantine/`); idempotency tested in `render.test.ts` "writes .gitignore on first render and leaves it unchanged on re-render" | Writes only if content differs (avoids touch-storm on a hot endpoint). The user-authored `project.json` and `bundle.md` remain explicitly NOT gitignored per the transient-files schema doc. |
| C-D21 implications — path-canonicalisation so render endpoint cannot write outside `<repo_path>/.throughline/` | built | `packages/backend/src/bootstrap/path-guard.ts` `assertPathInsideThroughline(repoPath, candidatePath)`; `packages/backend/test/bootstrap-path-guard.test.ts` (8 tests) | Defence-in-depth: `validateRepoPath` (C-D19) already canonicalises `repo_path` via `realpathSync` before persistence; the guard arms callers against future code paths that might construct candidate paths from untrusted input. Rejects traversal segments (`..`), sibling directories (`/<repo>/elsewhere`), and prefix-match siblings (`.throughline-evil/`). |
| Three-arm bundle resolver consumed via existing `methodology/loader.ts` precedence (arm 1 explicit > arm 2 per-repo > arm 3 install-shipped); render endpoint derives the actual file path to inject into the parameter block | built | `render.ts` `resolveBundleFile(methodologiesDir, project)`; integration in `render.test.ts` "resolves arm-2 per-repo bundle when `<repo>/.throughline/bundle.md` exists" and "falls through to arm-3 install-shipped when arm 2 absent" | Outer call gates on `registry.resolveBundle()` returning `status === 'loaded'`. The helper walks the same precedence to derive the file path; no second `resolveBundle` call (a redundant call was Gitar's only finding on this slice — folded inline by removing it in commit `53377e6`). |
| Production layout — `import.meta.url` resolves both in `src/` (dev) and `dist/` (build); prompt template ships next to its `.js` consumer | built | `packages/backend/scripts/copy-migrations.mjs` extended to mirror `prompt-template.md` into `dist/bootstrap/`; verified by `pnpm build` | Sync `readFileSync` at module init matches the `packages/backend/src/routes/web.ts:86–88` precedent ("Startup-time read is single-shot — sync is fine here and avoids a top-level await"). |
| Chain-state file refreshed for Phase 21 chain-open per `AUTO_CONTINUE_WORKFLOW.md` §"Chain State Persistence" | built | `.claude-code/auto-continue-state.json` | Overwrites the chain-closed Phase 20 state. New shape: `chainId: "phase-21-build-immutable-riddle"`, four slices (1 open, 3 pending), tracking issue 58, `currentIndex: 0`. |
| `CHECKLIST.md` §21 four-slice decomposition (replaces placeholder line) | built | `CHECKLIST.md` §21 | Mirrors the post-chain-open shape used by §19 / §20. Slice 1 marked complete with evidence. |
| `PLATFORM_STATUS.md` Snapshot + Current Phase + Recent Slice History + Queued Work rolled for Phase 21 chain-open | built | `docs/_meta/throughline/PLATFORM_STATUS.md` | `throughline:pause` label entry under Queued Work re-surfaced as a fourth-pass gap (spec-author confirmed at chain-open they will create it manually out-of-band; not a blocker). |
| GitHub tracking issue opened with the spec-author-approved title + body | built | Issue [#58](https://github.com/jaydomains/throughline/issues/58) | Title `Auto-continue: phase-21-build-immutable-riddle`; labelled `auto-continue`. |

---

## Last Decision Minted

No new decisions minted. Implementation followed T-D55 (single repo-owned generic template, bundle-aware via runtime read), T-D56 (file-mediated invocation contract, `.throughline/` transient surface), and C-D21 surfaces 1–2 + the `.gitignore` write from the implications block. Implementation-shape choices recorded inline at the implementation site:

- **YAML frontmatter for the parameter block.** Matches the dump-zone extractor convention (`packages/backend/src/dump-zone/extractor.ts`); LLMs parse it natively. No general-purpose templating engine — T-D55 prescribes a fixed-shape parameter block, not a templating substrate.
- **`copy-migrations.mjs` reused for the production layout.** The script's name predates its actual job (it already mirrors non-migration assets like `dump-zone/extractor-prompt.md`). Slice extended it to include `bootstrap/prompt-template.md`; a future hygiene PR could rename the script to `copy-assets.mjs` once more non-migration assets accumulate, but Phase 21 does not earn that.
- **Path-guard with prefix-match rejection (`.throughline-evil/`).** Naïve `startsWith` on the joined path would accept `<repo>/.throughline-evil/foo.md` because the string starts with `<repo>/.throughline`. The guard appends the directory separator before checking, so the prefix match is exact.

---

## Active Blockers

_none_

The `throughline:pause` label gap is not a blocker — spec author confirmed at Phase 21 chain-open that the two fallback kill-switch signals (`.claude-code/auto-continue-pause` marker file, `/pause` PR or issue comment) operate; Phase 19 and Phase 20 both ran clean on these. The label will be created manually out-of-band during the chain run.

---

## Files Changed Since Last Handover

**New:**
- `packages/backend/src/bootstrap/prompt-template.md` — generic bootstrap prompt template (T-D55). Walks Claude Code through bundle read → §2/§5/§6/§7 extraction → T-D54 ID derivation → T-D53 row population → JSON write to `output_path`.
- `packages/backend/src/bootstrap/render.ts` — `renderBootstrapPrompt()` + `resolveBundleFile()` + `ensureGitignore()`. Reads the template via `import.meta.url` at module init.
- `packages/backend/src/bootstrap/path-guard.ts` — `assertPathInsideThroughline(repoPath, candidatePath)`; throws `ThroughlinePathEscapeError`.
- `packages/backend/test/bootstrap-render.test.ts` — 11 cases covering happy-path render, parameter-block content, `.gitignore` write + idempotency, byte-identical re-render, invocation command shape, `project_not_found`, `no_bundle_bound`, arm-2 vs arm-3 bundle resolution.
- `packages/backend/test/bootstrap-path-guard.test.ts` — 8 cases (accept inside, accept dir-itself, reject traversal, reject sibling, reject prefix-match sibling, reject non-absolute inputs).
- `docs/_meta/throughline/handovers/2026-05-28-phase-21-slice-1-prompt-template-render-endpoint-path-guard.md` — this handover.

**Modified:**
- `packages/backend/src/bootstrap/routes.ts` — registers `POST /api/projects/:id/bootstrap/render`; error mapping (404 / 400 / 400).
- `packages/backend/src/server.ts` — passes `registry` and `config.methodologiesDir` to `registerBootstrapRoutes` so the render endpoint can derive arm-3 bundle paths.
- `packages/backend/scripts/copy-migrations.mjs` — extended to mirror `prompt-template.md` into `dist/bootstrap/` for the production layout.
- `.claude-code/auto-continue-state.json` — overwritten with Phase 21 chain shape (4 slices, slice 1 open).
- `CHECKLIST.md` §21 — four-slice decomposition replaces the placeholder; slice 1 marked complete with evidence.
- `docs/_meta/throughline/PLATFORM_STATUS.md` — Snapshot, Current Phase, Recent Slice History, Queued Work rolled for Phase 21 chain-open.

**Deleted:** _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| `throughline:pause` label still absent (fourth consecutive chain-open without it) | `jaydomains/throughline` repo settings | Re-verified absent at Phase 21 chain-open 2026-05-28. Spec author committed at chain-open to create the label manually out-of-band; Phase 21 chain operates on the two fallback signals as planned. | Documented in `PLATFORM_STATUS.md` Queued Work as the fourth-pass entry. Will close when the label appears in the repo. |

---

## Open Questions

- [ ] **Slice 2 watcher-cleanup policy for the "user renders then abandons Claude Code" case.** C-D21 says the watcher "registered on render-endpoint first call, unregistered on project delete" — silent on the abandonment case. Spec-author lean at chain-open: **accept the leak, document it** (chokidar `depth: 0` on a single file is near-free, backend restart self-clears, render is a rare action). To be confirmed and documented explicitly at slice 2 open; do not let it become a silent gap.
- [ ] **Slice 3 GET endpoint shape — `GET /api/projects/:id/bootstrap/state`.** Slice 4 (unified SettingsView block) depends on a read endpoint for last-ingest summary and quarantine count. Slice 3 plan adds it; exact response shape lands then.
- [ ] **Slice 4 retained-behaviour test coverage.** Slice 4 replaces working components (`ThroughlineStatusBlock`, `BootstrapReviewBlock`) rather than landing greenfield UI. Slice plan flags that slice 4's `BootstrapBlock.test.tsx` must explicitly cover retained behaviour (status banner across `.throughline/` states; review-queue link still navigates correctly; stale-row count still displayed) — not only the new init affordance. Surfaced for slice 4's PR review.

---

## Recently Resolved

- **Phase 21 build chain open** — was flagged in `2026-05-27-carry-forwards-cleanup-pre-phase-21.md` as "next concrete action: plan-mode entry for the Phase 21 chain"; resolved by this slice (chain opened with tracking issue [#58](https://github.com/jaydomains/throughline/issues/58) and state file `.claude-code/auto-continue-state.json` overwritten with the Phase 21 chain shape).
- **C-D21 surfaces 1, 2, and the `.gitignore` write** — pending in `2026-05-26-doc-stream-session-4-phase-21-doc-prereqs.md` as "build prerequisites for Phase 21 surfaces 1, 2, and 7"; resolved by this slice (template, render endpoint, path-guard, and idempotent `.gitignore` write all land here).

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- `packages/backend/src/methodology/loader.ts` — `resolveBundle()` arm precedence (C-D14, C-D19). Render endpoint gates on `status === 'loaded'`; helper walks the same precedence to derive the file path for the parameter block.
- `packages/backend/src/projects/service.ts` — `validateRepoPath()` (C-D19 surface 8). Render endpoint reuses the canonical `project.repo_path` that has already been `realpathSync`'d at project-bind time.
- `packages/backend/src/config.ts:1–12` — `import.meta.url` + `fileURLToPath` pattern for resolving package-internal assets in both dev and build layouts.
- `packages/backend/src/routes/web.ts:86–88` — precedent for synchronous read-at-module-init of a packaged asset.

**Downstream (consumes this slice's work):**
- **Slice 2** (chokidar watcher) — depends on the rendered `bootstrap-prompt.md` existing (the watcher arms on first render call); no direct API dependency, but the `.throughline/` directory creation (here) is a precondition for the watcher's `existsSync` checks at startup-scan time.
- **Slice 3** (worker) — depends on the `.gitignore` write (here) covering `bootstrap-archive/` and `bootstrap-quarantine/` so the worker's archive/quarantine writes don't pollute git status. Worker re-uses the path-guard for its own write sites.
- **Slice 4** (unified SettingsView block) — depends on `POST /api/projects/:id/bootstrap/render` returning the prompt path + invocation command; copy-pasteable command displayed in the new block.

---

## Reference

- `DECISIONS.md` T-D55 — single repo-owned generic prompt template; bundle-aware via runtime LLM bundle-read, not Throughline-side templating.
- `DECISIONS.md` T-D56 — file-mediated invocation contract; rendered prompt at `<repo>/.throughline/bootstrap-prompt.md`, output declared at `<repo>/.throughline/bootstrap-output.json`; subprocess-spawning deferred.
- `CODE_SPEC.md` C-D21 — six implementation surfaces; this slice lands surfaces 1, 2, and the `.gitignore` write from the implications block.
- `SPEC.md` §7.28 — bootstrap prompt and Claude Code invocation.
- `ROADMAP.md` §21 — Scope / Dependencies / Done when / Sizing (medium).
- `docs/.throughline-schema.md` — transient-files section (bootstrap-prompt.md, bootstrap-output.json, bootstrap-archive/, bootstrap-quarantine/, `.throughline/.gitignore`).
- `docs/_meta/throughline/AUTO_CONTINUE_WORKFLOW.md` — chain mechanics, halt classes, kill switch.
- Plan: `/root/.claude/plans/plan-mode-phase-21-build-immutable-riddle.md` (session-local, not in repo).
- Tracking issue: [#58](https://github.com/jaydomains/throughline/issues/58) — `Auto-continue: phase-21-build-immutable-riddle`.
- Chain state: `.claude-code/auto-continue-state.json`.
- Prior handover (Phase 20 → Phase 21 boundary cleanup): `docs/_meta/throughline/handovers/2026-05-27-carry-forwards-cleanup-pre-phase-21.md`.
- PR: [#59](https://github.com/jaydomains/throughline/pull/59) — Phase 21 / Slice 1.
