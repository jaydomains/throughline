# Throughline — Audit-Fix Phase A Handover

**Generated:** 2026-05-29 (UTC)
**Last commit SHA:** _filled at merge_ — 2026-05-29
**Previous handover:** `handovers/2026-05-28-cohort-hardener-phases-19-22-build.md` (cohort hardener, Phases 19–22 build)

---

## Build State vs Spec

First of four sequential audit-fix workstreams (A → B → C → D) from the 2026-05 five-audit cycle. Single PR, cohort-hardener shape.

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| **F1** — backend dist runtime resolution (dual-condition exports) | built | `packages/shared/package.json` (exports `types`/`development`→src, `default`→dist); `packages/backend/package.json` (`dev`/`start` `--conditions=development`) | Verified: `node`→dist (17 exports), `tsx --conditions=development`→src with dist absent, plain `tsx` crashes without dist (flag is load-bearing). |
| **I1** — backend `test/**` into typecheck | built | `packages/backend/tsconfig.test.json` (new); `packages/backend/package.json` `typecheck` → `tsc -p tsconfig.test.json` | 1 pre-existing error fixed in `test/bootstrap-watcher.test.ts`; under the 30-error halt threshold. Unblocks Phase D regression tests. |
| **W2** — Node engines pin (canonical 22) | built | root `package.json` `engines.node ">=22"` + `@types/node ^22`; `packages/backend/package.json` `@types/node ^22`; `.github/workflows/ci.yml` `node-version: 22` | Matches v22.22 dev runtime; lockfile refreshed (`@types/node` 22.19.19). |
| **W4** — React Router v7 future flags | built | `packages/frontend/src/main.tsx` (BrowserRouter); 27 `MemoryRouter`s across 19 `test/*.test.tsx` | Test stderr now free of future-flag warnings (verified). |
| **Doc** — green-gate coverage reckoning amendment | built | `docs/_meta/throughline/AUTHORING_DISCIPLINE.md` ("Green-Gate Coverage — Known Gaps (this cohort)") | Gap 1 (backend test typecheck) closed here; gap 2 (wire-contract cast) to be closed by Phase D. Revised when Phase D lands. |

Green gate verified end-to-end: typecheck (3 scopes), 500 backend + 182 frontend tests, lint, build — all green.

---

## Last Decision Minted

- **C-D22 — Source-vs-built export resolution for TS-source workspace packages.** Dual-condition `exports` (`types`/`development`→src, `default`→built `dist/`) so a TS-source package's `dist` is runnable under plain `node` while dev tooling stays on source; tsx kept on source via `--conditions=development`. Rationale: src-only `main`/`types`/`exports` emitted a `dist` nothing consumed and that `node` could not import (`.js`→`.ts` mapping fails); the split fixes the misleading artifact without forcing a build into the zero-build dev loop, keyed on the standard `development` condition rather than a bespoke one. Lands in: `CODE_SPEC.md` (C-D22 body). No governing T-D — pure build hygiene; no `SPEC.md §14` row (C-D anchors are implementation-only).

C-D22 is the audit-fix cohort's first anchor → triggered the `PLATFORM_STATUS.md` Locked Decisions cycle-reset roll.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/backend/tsconfig.test.json` — src + test typecheck config (`noEmit`, `rootDir: "."`), wired into the backend `typecheck` script (I1).
- `docs/_meta/throughline/handovers/2026-05-29-audit-fix-phase-a-foundation-fixes.md` — this handover.

**Modified:**
- `packages/shared/package.json` — dual-condition exports map + `main`/`types`→dist (F1).
- `packages/backend/package.json` — tsx `--conditions=development` on `dev`/`start`; `typecheck` → tsconfig.test.json; `@types/node ^22` (F1, I1, W2).
- `packages/backend/test/bootstrap-watcher.test.ts` — `makeProject` param uses `Omit<Partial<Project>, 'repo_path'>` so `repo_path: null` typechecks (I1 fix).
- `package.json` (root) — `engines.node ">=22"`; `@types/node ^22` (W2).
- `.github/workflows/ci.yml` — `node-version` 20 → 22 (W2).
- `packages/frontend/src/main.tsx` — `BrowserRouter future={{ v7_startTransition, v7_relativeSplatPath }}` (W4).
- `packages/frontend/test/*.test.tsx` (19 files, 27 `MemoryRouter`s) — same `future` prop (W4).
- `CODE_SPEC.md` — C-D22 anchor body.
- `docs/_meta/throughline/AUTHORING_DISCIPLINE.md` — Green-Gate Coverage section.
- `docs/_meta/throughline/PLATFORM_STATUS.md` — Snapshot, Current Phase, Locked Decisions roll (→ C-D22), Recent Slice History roll.
- `pnpm-lock.yaml` — `@types/node` 20 → 22.

**Deleted:**
- _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Plan lean vs reality (I1) | `packages/backend/tsconfig.test.json` | Plan-mode's tentative "single-config extend per frontend symmetry" lean didn't transfer — backend's main tsconfig is an emitting config (`rootDir ./src`, `build = tsc`); adding `test/**` would violate rootDir and emit tests into `dist/`. | Decided 1A: separate `tsconfig.test.json`. Spec-author approved pre-execution. |
| W4 scope vs "frontend-only, small" framing | `packages/frontend/test/*.test.tsx` | Warnings originate from `MemoryRouter` in ~19 test files, not `main.tsx` (not loaded in tests); silencing them required touching the test routers. | Decided 2A: `main.tsx` + inline prop on all 27 test `MemoryRouter`s. Spec-author approved. |
| tsx export-condition behaviour (F1) | `packages/backend/package.json` | tsx shares Node's `node`/`import`/`default` conditions, so a dist-pointing `default` would break `tsx` dev without a build. | Decided 3A: `--conditions=development` on `dev`/`start`. Verified tsx honours it; 3A-B (`predev` build) fallback not needed. |

---

## Open Questions

- [ ] Gap 2 of the green-gate reckoning (wire-contract response types frontend-local; `jsonFetch<T>(…) as T` unvalidated cast) — resolved by **audit-fix Phase D** (response types move to `@throughline/shared` + a wire-contract test). The AUTHORING_DISCIPLINE.md section is revised when D lands.
- [ ] Branch-protection required-check setting for `.github/workflows/ci.yml` — repo-admin action, still pending (carried from PR #66). More material now that Phase A widened CI's true typecheck coverage.

---

## Recently Resolved

- **Backend `test/**` excluded from typecheck** — was the green-gate's documented blind spot; closed by I1 (this PR). ~12.8k LOC of backend test code now typechecks; surfaced and fixed 1 latent type error.
- **Dead-weight `shared/dist`** — was flagged as build output nothing consumed; F1 gives it a real consumer (the plain-`node` runtime path).

---

## Cross-Module Dependencies

**Upstream (this work consumes):**
- `@throughline/shared` — F1 changes only its package resolution surface; named-import contract unchanged. Backend/frontend import sites untouched.

**Downstream (consumes this work):**
- **Audit-fix Phase D** — depends on I1 (backend test typecheck) so its regression tests typecheck; depends on the green-gate amendment to close gap 2. Pending.
- Any future TS-source workspace package — adopts the C-D22 exports shape. Pending (none yet).

---

## Reference

- Spec / decisions / build-state docs: `CODE_SPEC.md` (C-D22), `docs/_meta/throughline/AUTHORING_DISCIPLINE.md`, `docs/_meta/throughline/PLATFORM_STATUS.md`, `docs/_meta/throughline/AUTO_CONTINUE_WORKFLOW.md`.
- PR: _audit-fix Phase A (this PR)_.
