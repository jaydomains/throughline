# Throughline Handover — Phase 19 Slice 2: init config-reader + git-remote auto-detect + re-init flow

**Generated:** 2026-05-27
**Last commit SHA:** pending — 2026-05-27
**Previous handover:** `2026-05-27-phase-19-slice-1-loader-third-arm-and-repo-path-normalisation.md` (Slice 1 — PR #47, merged 2026-05-27)

Second slice of the Phase 19 clone-and-go chain (tracking issue [#46](https://github.com/jaydomains/throughline/issues/46)).

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| C-D19 surface 2 — `.throughline/project.json` reader: validate against `docs/.throughline-schema.md`, reject unknown top-level keys, raise `bundle_id_mismatch` against sibling `bundle.md` §1 Identity | built | `packages/backend/src/init/config-reader.ts` (new); `test/init-config-reader.test.ts` (12 tests) | Returns `null` when the file is absent; throws `InvalidProjectConfigError` on JSON parse failure / schema violation / unknown keys; throws `BundleIdMismatchError` when project.json `bundle_id` disagrees with sibling bundle.md identity `name`. |
| C-D19 surface 3 — Git-remote auto-detection: `git remote get-url origin` parsed for SSH and HTTPS forms into `github_owner`/`github_repo` | built | `packages/backend/src/init/git-remote.ts` (new); `test/init-git-remote.test.ts` (12 tests) | Supports `git@github.com:owner/repo[.git]`, `https://github.com/owner/repo[.git]`, `https://token@github.com/owner/repo`, and `ssh://git@github.com/owner/repo[.git]`. Non-GitHub remotes return `null`; missing git binary or no origin remote returns `null`. |
| C-D19 surface 7 — Project-update endpoint accepts `reinit_throughline: true`; backend re-reads `.throughline/project.json` from persisted `repo_path` and applies only fields the file supplies; items/sessions/library/secrets/audit history untouched | built | `packages/backend/src/projects/service.ts` `update()` (new re-init code path); `packages/backend/src/projects/routes.ts` (PATCH body accepts the flag, surfaces 400 on `InvalidProjectConfigError` / `BundleIdMismatchError`); `packages/shared/src/project.ts` `UpdateProjectInput.reinit_throughline?: boolean`; `test/projects.test.ts` "re-init flow" describe block (7 tests) | Explicit fields in the same PATCH body override file fields (a caller can PATCH `{ reinit_throughline: true, name: "..." }` to force a rename). `github_owner`/`github_repo` are auto-filled from `git remote get-url origin` when the file is silent — same auto-detection helper as the CLI will use in Slice 3. |

---

## Last Decision Minted

No new decisions minted. Implementation followed T-D51 (per-repo namespace), T-D52 (backend single write/read path), and C-D19 (surfaces 2, 3, 7). Implementation-shape choices recorded inline:

- **Closed schema for `.throughline/project.json`.** Unknown top-level keys are rejected (`InvalidProjectConfigError`). The schema doc says "Forward-compat is by deliberate version-bump, not silent acceptance"; this slice enforces that literally.
- **Backend-side auto-detection on re-init.** When `.throughline/project.json` is silent on `github_owner`/`github_repo`, the re-init path calls `detectGitHubRemote(repo_path)` to fill the gap. The same helper is reused by the Slice 3 CLI during `throughline init`; placing the call inside the backend honours T-D52's single-validator discipline.
- **Soft-fail on unparseable sibling `bundle.md`.** When the cross-check finds `.throughline/bundle.md` present but unparseable, `readProjectConfig` does not raise — the loader's arm-2 path already audits the parse error on its own channel. `BundleIdMismatchError` is reserved for the case where both files parse and disagree.
- **Explicit override beats file.** On `{ reinit_throughline: true, name: "X" }`, the caller's `name` wins. The merge precedence is `effective = { ...input, <file fields not in input> }`.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/backend/src/init/config-reader.ts` — `.throughline/project.json` reader, schema validator, sibling-bundle cross-check. Exports `readProjectConfig`, `projectConfigExists`, `InvalidProjectConfigError`, `BundleIdMismatchError`, `ProjectConfig`.
- `packages/backend/src/init/git-remote.ts` — `detectGitHubRemote(repoPath)` + pure `parseGitHubRemote(url)`. Silent `null` return on any non-success exit (missing git, no origin, non-GitHub host).
- `packages/backend/test/init-config-reader.test.ts` — 12 tests covering: absent file → null, minimal valid config, all five fields, relative `bundle_path` resolution, unknown-key rejection, missing-bundle_id rejection, type-mismatched bundle_id, malformed JSON, non-object top-level (string and array), bundle_id mismatch against sibling bundle.md, matching bundle_id, soft-fail on unparseable sibling.
- `packages/backend/test/init-git-remote.test.ts` — 12 tests covering: SSH form, SSH-no-.git, HTTPS, HTTPS-no-.git, `ssh://` scheme, HTTPS-with-auth-token, non-GitHub host rejection, empty string, malformed URL; plus three `detectGitHubRemote` integration tests (not-a-repo, real GitHub origin, non-GitHub origin).
- `docs/_meta/throughline/handovers/2026-05-27-phase-19-slice-2-init-readers-and-reinit-flow.md` — this handover.

**Modified:**
- `packages/shared/src/project.ts` — `UpdateProjectInput.reinit_throughline?: boolean` (control flag; never persisted).
- `packages/backend/src/projects/service.ts` — `update()` honours `reinit_throughline: true`; reads `.throughline/project.json` via `readProjectConfig(before.repo_path)`; falls back to `detectGitHubRemote` for missing github coordinates; merges file → input precedence (`effective = { ...input, <file fields where input has undefined> }`). Down-flow code now uses `effective` instead of raw `input`.
- `packages/backend/src/projects/routes.ts` — PATCH body type accepts `reinit_throughline?: boolean`; 400 mapping for `InvalidProjectConfigError` (with `path` field) and `BundleIdMismatchError` (with `config_bundle_id` and `bundle_file_name` fields).
- `packages/backend/test/projects.test.ts` — seven new tests in a "re-init flow (C-D19 surface 7)" describe block: backend re-reads + applies fields; null file → unchanged project; explicit override wins; auto-detect from origin remote; `InvalidProjectConfigError` surfaced; `BundleIdMismatchError` surfaced; items not touched on re-init.
- `.claude-code/auto-continue-state.json` — Slice 1 marked merged (PR #47, 1 fix-round); Slice 2 opened (PR pending); `currentIndex: 1`.
- `docs/_meta/throughline/PLATFORM_STATUS.md` — Snapshot, Current Phase updated for Slice 2 in flight.
- `CHECKLIST.md` §19 — Slice 1 ticked; Slice 2 marked PR-pending.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Auto-detection on re-init wasn't strictly spec-mandated | `packages/backend/src/projects/service.ts` re-init code path | T-D52 / the schema doc say "auto-detected from `git remote get-url origin` if absent" in the context of CLI `throughline init`. This slice puts the same auto-detection on the backend re-init path so the CLI's `{ reinit_throughline: true }` payload (Slice 3) needs no extra orchestration. | Accepted as natural extension of the single-write-path discipline — same helper, same semantics, consistent with how the CLI will call it. Noted here for transparency. |

---

## Open Questions

- [ ] **Re-init when `repo_path` itself changes** — current implementation reads the file from `before.repo_path`. If the same PATCH also moves `repo_path` (`{ reinit_throughline: true, repo_path: "..." }`), the file is read from the OLD path. This is the more conservative reading (no file movement implied). Whether the spec wants the NEW path read instead is undefined in C-D19; the typical CLI flow won't hit this case. Landing site: Slice 3 PR if a concrete use case emerges, otherwise stays as-is.

---

## Recently Resolved

- **Slice 1 (Phase 19) merged** — was flagged in Slice 1's handover as "PR pending"; resolved by PR #47 merge with 1 fix-round folded inline.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- `parseBundle` (`packages/backend/src/methodology/bundle-parser/index.js`) — invoked by `readProjectConfig` to extract `identity.name` from sibling `.throughline/bundle.md` for the cross-check.
- `validateRepoPath` (Slice 1) — provides the canonical repo path that `update()` reads `.throughline/project.json` from on re-init.
- `node:child_process` `execFileSync` — wraps the `git remote get-url origin` invocation; same pattern as `gates/checks.ts` script-spawn path.

**Downstream (consumes this slice's work):**
- **Slice 3 (CLI `throughline init`)** — imports `readProjectConfig` and `detectGitHubRemote` from `packages/backend/src/init/` as library code (same-package resolution per T-D52); calls them locally to construct the create/update payload; ships HTTP calls to the backend with `reinit_throughline: true` (re-init) or as a plain create body (first-run).
- **Slice 4 (frontend SettingsView missing-config block)** — will read `throughline_status` from a backend-extended `GET /api/projects/:id` response; that endpoint may reuse `projectConfigExists` to determine whether `.throughline/project.json` is present.

---

## Reference

- `DECISIONS.md` T-D51, T-D52 (anchors for the namespace and write-contract).
- `CODE_SPEC.md` C-D19 (eight implementation surfaces; this slice landed 2, 3, 7).
- `SPEC.md` §7.26 (clone-and-go functional behaviour).
- `docs/.throughline-schema.md` (per-repo config schema fields).
- Chain plan: `/root/.claude/plans/plan-mode-phase-19-build-vast-sutherland.md` (session-local).
- Chain state: `.claude-code/auto-continue-state.json`.
- Tracking issue: [#46](https://github.com/jaydomains/throughline/issues/46).
- PR: pending.
