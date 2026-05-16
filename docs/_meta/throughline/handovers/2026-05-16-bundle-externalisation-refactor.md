<!-- Template version: 1.0 -->

# Throughline — Bundle Externalisation Refactor Handover

**Generated:** 2026-05-16 (pre-merge)
**Last commit SHA:** see PR head — branch `claude/refactor-sitemesh-bundle-NfzJL`, 2026-05-16 (merge SHA not yet known at authoring time)
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-15-spec-clarification-gate-triggers.md` (spec clarification — gate-trigger gaps Q1–Q4)

This slice is **not a ROADMAP phase**. It prepares the repo to be made public after v1: the business-internal SiteMesh bundle is removed and a configurable mechanism (`bundle_path`, C-D14) is added so user-owned bundles live outside Throughline. `methodologies/` now ships only the freeform default and a generic, business-neutral `test-bundle` grammar fixture.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Optional `bundle_path` on project model + schema migration | built | `packages/backend/src/db/migrations/0007_project_bundle_path.sql`; `packages/shared/src/project.ts`; `projects/service.ts` | Nullable; `bundle_id` stays NOT NULL (T-D47). |
| Loader resolves `bundle_path` first, falls back to `methodologies/<bundle_id>/` | built | `packages/backend/src/methodology/loader.ts` `resolveBundle`/`hasBundle`; `test-bundle.test.ts` "resolves a bundle from an external bundle_path (C-D14)" | Per-project consumers (items policy, reconcile, dump-zone, project create/update) resolve through these. |
| External bundles get chokidar watch parity | built | `loader.ts` `registerProjectBundle`/`unregisterProjectBundle` + watcher external branch; `server.ts` startup re-register | Refcounted by project binding; registered on create / `bundle_path` change, unregistered on delete. |
| Generic `methodologies/test-bundle/bundle.md` fixture | built | `methodologies/test-bundle/bundle.md`; `test-bundle.test.ts` "parses cleanly through the bundle loader" | Two item types w/ per-type lifecycles, multi-gate `per-commit` moment (T-D42), anchors, markers. No business content. |
| Phase 7 tests retargeted to test-bundle; suites green | built | `packages/backend/test/test-bundle.test.ts` (renamed from `sitemesh.test.ts`); frontend mock ids `sitemesh`→`rich` | backend 132 passed, frontend 70 passed, typecheck + build clean. |
| `methodologies/sitemesh/` deleted | built | `git rm methodologies/sitemesh/bundle.md` | Repo no longer ships business-internal discipline. |
| Docs: CODE_SPEC + README | built | `CODE_SPEC.md` C-D3/C-D5 updated, C-D14 minted, bundle-loading section + tables; `README.md` "Configuring a user-owned bundle"; `CHECKLIST.md` refactor section | — |

---

## Last Decision Minted

- **C-D14 — Per-project `bundle_path` externalises user bundles; loader resolves external-first with watch parity.** Rule: when `bundle_path` is set the loader resolves `<bundle_path>/bundle.md` in preference to `methodologies/<bundle_id>/bundle.md`; `bundle_id` stays non-null (T-D47) as the declared identifier; external bundles are refcounted chokidar watch targets so they hot-reload like install-shipped ones. Rationale: minimum mechanism to keep proprietary discipline out of a public repo without forking or losing the freeform default / single-non-null-`bundle_id` invariant (C-D5); watch parity removes the canonical-vs-user asymmetry. Lands in: `CODE_SPEC.md` (C-D14), `packages/backend/src/methodology/loader.ts`, `packages/backend/src/projects/service.ts`, `packages/shared/src/project.ts`, migration `0007`.

No new T-D anchors. Implementation followed T-D41, T-D47; C-D3, C-D4, C-D5.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/backend/src/db/migrations/0007_project_bundle_path.sql` — `bundle_path` column.
- `methodologies/test-bundle/bundle.md` — generic eleven-section grammar fixture.
- `docs/_meta/throughline/handovers/2026-05-16-bundle-externalisation-refactor.md` — this handover.

**Modified:**
- `packages/backend/src/methodology/loader.ts` — external cache + `resolveBundle`/`hasBundle`/`registerProjectBundle`/`unregisterProjectBundle`; watcher external branch.
- `packages/backend/src/projects/service.ts` + `routes.ts` — `bundle_path` persisted, validated, audited; registry register/unregister wired.
- `packages/backend/src/server.ts` — re-register external watch targets at startup.
- `packages/backend/src/items/service.ts`, `reconcile/service.ts`, `dump-zone/service.ts` — resolve via `(bundle_id, bundle_path)`.
- `packages/shared/src/project.ts` — `bundle_path` on `Project` / inputs.
- `packages/backend/test/test-bundle.test.ts` (renamed from `sitemesh.test.ts`), `projects.test.ts`; frontend test fixtures (`mockApi.ts`, `commandPalette`, `directives`, `stubs`, `phase7`, `newProjectModal`) — retargeted + `bundle_path` literals + `sitemesh`→`rich` mock ids.
- `CODE_SPEC.md`, `README.md`, `CHECKLIST.md` — documentation.

**Deleted:**
- `methodologies/sitemesh/bundle.md` — business-internal discipline; must not ship in the public repo.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| External-watch tradeoff | `loader.ts` | Plan initially accepted "no chokidar watch on external paths" as a v1 tradeoff. | Reversed on user direction: external `bundle_path` files are now refcounted watch targets with full hot-reload parity. C-D14 reflects the final shape. |
| `Project.bundle_path` made required | `packages/shared/src/project.ts` | DB always returns the column (null when unset), so the type is `string \| null` (required), not optional — broke 5 frontend Project fixtures. | Added `bundle_path: null` to the affected fixtures; typecheck green. |
| Round-trip ref ordering | `test-bundle.test.ts` | `loadItemChildren` returns refs `ORDER BY column`, so the round-trip assertion needed alphabetically-ordered values. | Used `alpha`/`beta` and noted the ordering in a test comment. |
| `pnpm lint` is a no-op | repo | Carry-forward from 6a–7. | Relied on `pnpm typecheck` + full test suites as the static gate, consistent with prior slices. |

---

## Open Questions

- [ ] **Real lint wiring.** Still a no-op (carry-forward). Repo-infra slice.
- [ ] **`bundle_path` UI.** Field is API/model-only in v1; no project-settings control to set it. UI slice if/when needed.
- [ ] **README "Private / not public-distribution" disclaimer.** Left as-is — licensing/distribution wording is out of this slice's scope; revisit when the repo is actually opened.

---

## Recently Resolved

- **SiteMesh bundle in the repo** — was the Phase 7 deliverable (`docs/_meta/throughline/handovers/2026-05-15-phase-7-sitemesh.md`); removed here and replaced by the generic `test-bundle` fixture for runtime/tests.
- **Phase 7 SiteMesh-bound tests** — retargeted to `methodologies/test-bundle/`; frontend mock ids de-business-named.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- Phase 1 methodology registry + bundle parser (C-D3/C-D4); projects service + audit substrate (C-D5, T-D36).
- Phase 7 `ItemPolicy` derivation (C-D12) and modules endpoint (C-D13) — exercised by the new fixture.

**Downstream (consumes this slice's work):**
- **Phase 8 gate runtime** — fires against bundle-declared gates; the `test-bundle` multi-gate `per-commit` moment is the non-trivial target.
- **Phase 9 discipline-drift** — instantiates scanners from the fixture's `discipline_drift_categories`.
- **Any user-owned bundle** — resolved via `bundle_path` (C-D14); same loader/runtime path as install-shipped bundles.

---

## Reference

- Specs operated against: `CODE_SPEC.md` C-D3/C-D4/C-D5 + new C-D14; `SPEC.md` §7.2/§7.5/§7.11; T-D41, T-D47; `CHECKLIST.md` Refactor — Bundle externalisation.
- Previous handover: `docs/_meta/throughline/handovers/2026-05-15-spec-clarification-gate-triggers.md`.
- PR: opened at slice close on branch `claude/refactor-sitemesh-bundle-NfzJL`.
