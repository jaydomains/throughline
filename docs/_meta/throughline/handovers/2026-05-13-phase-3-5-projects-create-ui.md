<!-- Template version: 1.0 -->

# Throughline — Phase 3.5 Handover

**Generated:** 2026-05-13 (pre-merge)
**Last commit SHA:** see PR head — 2026-05-13
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-12-phase-3-items-sessions.md` (Phase 3 — items, sessions)

Hygiene slice. Phase 1 shipped project create/archive/delete via REST + CLI (`ROADMAP.md:39` said "UI not required this phase"). Phase 2 rendered the Projects view as a stub with "Create one via the CLI for now." Phase 3 wired items + sessions but left the projects-view stub in place. Phase 3.5 closes the create half of the multi-project UI; archive/delete UI remain deferred.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| "New project" CTA on the Projects view | built | `packages/frontend/src/views/stubs.tsx` ProjectsView; `packages/frontend/src/components/NewProjectModal.tsx` | Button replaces the previous "Create one via the CLI for now" prose; modal opens on click. |
| Modal collects name, repo path, methodology bundle | built | `NewProjectModal.tsx` form rows (`new-project-name`, `new-project-repo`, `new-project-bundle`) | Bundle dropdown populated from `useMethodologies` (filtered to `status === 'loaded'`); defaults to `freeform` when loaded, else first loaded bundle id. |
| Submit POSTs `/api/projects`, refreshes list, navigates to new project's home view | built | `api.createProject` in `packages/frontend/src/api.ts:43`; `onCreated` wiring in `packages/frontend/src/App.tsx` calls `refreshProjects()`, fire-and-forget `api.switchProject(id)`, `navigate('/projects/' + id)` | `/projects/:id` is `HomeView` per `App.tsx` Routes; matches the existing ProjectSwitcher click flow. |
| Cancel / Esc / click-outside close the modal | built | `useModalRegistration('new-project', open, onClose)` (`modalStack.tsx:70`); backdrop `onMouseDown` with `e.target === e.currentTarget` guard mirroring `HelpModal.tsx:18` | Three tests in `test/newProjectModal.test.tsx` cover Esc, backdrop click, and inner-body-click-does-not-close. |
| Tests cover the flow | built | `packages/frontend/test/newProjectModal.test.tsx` (8 cases); `packages/frontend/test/stubs.test.tsx` ProjectsView test updated for new props | 25 frontend tests pass total; backend 34 tests still pass (no backend changes). |
| CHECKLIST §11 multi-project DoD row reflects state | built | `CHECKLIST.md:359` annotated; Phase 3.5 section added between Phase 3 and Phase 4 | Row stays unticked because archive/delete UI remain outstanding. |

---

## Last Decision Minted

No new T-D or C-D anchors. Implementation followed existing patterns:
- Modal pattern (`useModalRegistration` + `.modal-backdrop` click-outside guard) from `HelpModal.tsx` / `CommandPalette.tsx`.
- API-helper shape from `api.createSession` (`packages/frontend/src/api.ts:54`).
- Fire-and-forget `switchProject` after creation mirrors `ProjectSwitcher.tsx:29` so the new project becomes `last_active_project_id`.
- Bundle filter (`status === 'loaded'`) keeps broken bundles out of the dropdown — methodology error bundles can't legitimately bind a new project.

Conventions adopted (apply going forward):

- **Mock-API fixture is state-backed for projects.** `test/fixtures/mockApi.ts` now keeps `state.projects` and `listProjects` returns it, so create+refresh round-trips are observable in tests (parallel to the existing `state.sessions` / `state.items` story). `resetMockApi` re-seeds the default `p1` demo project.
- **Modal form skeleton (`.new-project-modal .form-row` / `.form-actions` / `.form-error`) is scoped, not shared.** When the next form-bearing modal lands (archive confirm, session settings, etc.) extract the shared rules into a generic `.form-row`/`.form-actions` block — don't import from `.new-project-modal`. Convention: keep modal styles scoped under the modal's own class until two or more modals share them, then promote.

---

## Active Blockers

_none_

Provisional / parked items:
- **Archive / delete project UI** — backend + CLI exist (`PATCH /api/projects/:id` with `state: 'archived'`; `DELETE /api/projects/:id`); UI wiring lands in the next projects-view slice. The §11 DoD row stays unticked until it does.
- **Repo-path validation in the modal** — currently a non-empty-string check matching the backend's validation. No filesystem-existence check on submit. If the user types a non-existent path, the project is created and any feature that later needs the path (Phase 10 git, Phase 11 Semble) will surface the error. Acceptable for now.
- **GitHub owner/repo fields in the modal** — deferred. Backend accepts both optionally (`projects/routes.ts:27`); the modal omits them to keep the create surface minimal. Add when a feature reaches for them.

---

## Files Changed Since Last Handover

**New:**
- `packages/frontend/src/components/NewProjectModal.tsx` — the modal component (form + submit + error handling + modal-stack registration).
- `packages/frontend/test/newProjectModal.test.tsx` — 8 cases covering open/close, defaults, validation, submit, error path, Esc, backdrop click.
- `docs/_meta/throughline/handovers/2026-05-13-phase-3-5-projects-create-ui.md` — this file.

**Modified:**
- `packages/frontend/src/api.ts` — added `createProject(input: CreateProjectInput)` mirroring `createSession`.
- `packages/frontend/src/views/stubs.tsx` — `ProjectsView` now takes `bundles` + `onCreated` props, renders a toolbar with "New project" button, and mounts `NewProjectModal`.
- `packages/frontend/src/App.tsx` — destructured `refresh` from `useProjects`, threaded `bundles` + an `onCreated` handler into `<ProjectsView />` that refreshes, fire-and-forget `switchProject`, then `navigate('/projects/:id')`.
- `packages/frontend/src/styles.css` — added `.projects-toolbar` and `.new-project-modal` form/actions/error styles using existing tokens.
- `packages/frontend/test/fixtures/mockApi.ts` — added `Project` + `CreateProjectInput` imports; introduced `state.projects` seeded with the default demo project; `listProjects` now returns `state.projects`; added `createProject` mock that appends to state.
- `packages/frontend/test/stubs.test.tsx` — updated the ProjectsView test for the new props; wrapped in `ModalStackProvider`; asserts the new-project button renders.
- `CHECKLIST.md` — added a Phase 3.5 section between Phase 3 and Phase 4; annotated the §11 multi-project DoD row to note create+switch UI landed in 3.5 and archive/delete UI remain.

**Deleted:** _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| `onCreated` test typing | `packages/frontend/test/newProjectModal.test.tsx` | First draft typed the optional `onCreated` prop as `(p: { id: string }) => void` and cast it to `(p: never) => void` at the call site. The build under `exactOptionalPropertyTypes` correctly rejected the cast as a `Project`/`never` mismatch. | Typed the test helper's `onCreated?: (p: Project) => void` and dropped the cast. Build passes. Reminder to future contributors: the production tsconfig is stricter than vitest's transpile-only path; always run `pnpm -r build` before claiming green. |

---

## Open Questions

- [ ] **Archive / delete projects from the UI** — backend + CLI exist; UI wiring (likely as project-card hover actions + a confirm modal that reuses `.new-project-modal` form styles once those move out of the new-project scope) lands in the next projects-view slice.
- [ ] **GitHub owner / repo + project settings on create** — backend accepts both; the modal omits them. Add when Phase 10 (GitHub) needs the owner/repo and Phase 15 (settings polish) needs the per-project settings JSON.
- [ ] **Repo-path existence validation** — currently a string-length check only. When Phase 10's git wiring lands, decide whether to validate on submit or surface the error lazily at first git use.

---

## Recently Resolved

- **"Phase 2 ProjectsView stub with 'Create one via the CLI for now.'"** — flagged in the Phase 2 handover and implicitly carried through Phase 3. The CTA + modal land this slice; the empty-list copy now reads "No projects yet — click **New project** to create one."

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- Phase 1 backend: `POST /api/projects` (`packages/backend/src/projects/routes.ts:22`); `POST /api/projects/:id/switch` (line 85); `GET /api/methodologies` (`packages/backend/src/routes/methodologies.ts`).
- Phase 2 substrate: `useModalRegistration` (`packages/frontend/src/keyboard/modalStack.tsx:70`); `useProjects` (`hooks/useProjects.ts`); `useMethodologies` (`hooks/useMethodologies.ts`); the shared `.modal-backdrop` / `.modal` styles.
- Shared types: `CreateProjectInput` / `Project` (`packages/shared/src/project.ts:17`).

**Downstream (consumes this slice's work):**
- Future projects-view slice (archive/delete UI) — will reuse `NewProjectModal`'s form scaffold, the `.new-project-modal` style block, and the `mockApi.state.projects` test fixture pattern.
- Any view that wants to spawn a project programmatically (none today; SiteMesh bundle delivery in Phase 7 is the next likely consumer of project-from-template flows).

---

## Reference

- Specs operated against: `SPEC.md` §11 multi-project DoD; `ROADMAP.md:39` Phase 1 (UI not required at that phase); Phase 3 handover (`docs/_meta/throughline/handovers/2026-05-12-phase-3-items-sessions.md`).
- Plan file: `/root/.claude/plans/throughline-phase-3-5-squishy-aho.md`.
- PR: filled in at PR open.
