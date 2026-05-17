<!-- Template version: 1.0 -->

# Throughline — Pass 1a (docs, license, SiteMesh removal) Handover

**Generated:** 2026-05-17 (pre-merge)
**Last commit SHA:** see PR head — branch `claude/pass-1a-docs-license-sitemesh-scrub` (PR not yet merged; update to merge SHA on merge)
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-17-phase-16-dod.md` (Phase 16 — DoD walkthrough & v1 cut)

This slice is **not a ROADMAP phase**. It is the first remediation pass from the v1 pre-launch verification: purely textual public-readiness fixes — accurate README, an MIT license, and a full repo-wide scrub of the business-internal "SiteMesh" name (and the "Kunda Tech (Jay)" attribution). No functional code, no dependency, no test changes.

---

## Build State vs Spec

| Requirement | State | Evidence | Notes |
|---|---|---|---|
| README accurate on fresh clone | built | `README.md` | Status → "v1 complete"; auto-run softened to opt-in; CLI section points at no-arg usage (verified `cli/index.ts` prints usage on no args); owner → `jaydomains`; license section → MIT |
| MIT LICENSE at repo root | built | `LICENSE` (new) | `Copyright (c) 2026 jaydomains`; README license sentence reconciled |
| Development-discipline discoverable | built | `README.md` new "Development discipline" section | Points at `SESSION_START.md` + `HANDOVER_TEMPLATE.md`, explains the handover convention |
| SiteMesh removed repo-wide | built | `grep -rni sitemesh` → zero (excl. `.git`) | SPEC/CODE_SPEC/DECISIONS/ROADMAP/CHECKLIST + 4 code/UI sites + Semgrep template + all handover bodies + filename rename |
| Cluster-A contradictions reconciled | built | SPEC §11/§13/§14, T-D41/T-D47/T-D48, ROADMAP Phase 7, CHECKLIST Phase 7/§11 | All four docs now state: freeform default + generic `test-bundle` ship; rich bundles bind via `bundle_path` (C-D14) |
| Out-of-repo cross-refs dropped | built | SPEC.md (removed §13 SiteMesh-authoring bullet), ROADMAP.md (removed Phase-7 §13 informational bullet + the §13 table row) | `AUTHORING_DISCIPLINE.md §3.F` / internal `SESSION_START.md §4` refs gone |
| Handover-immutability rule amended | built | `HANDOVER_TEMPLATE.md` authoring rule 8; `SESSION_START.md` handover-discipline section | Records the confidentiality carve-out (see Drift Flags) |
| Typecheck clean | built | `pnpm -r typecheck` — 3/3 packages Done | Comment/string-only code edits; no behaviour change |
| GraphView DoD/stub untouched | as-planned | `SPEC.md` §11 GraphView bullet + `stubs.tsx` GraphView stub | Deferred to Pass 1b; only the SiteMesh substring inside the stub's body string was scrubbed (no implementation, DoD bullet unchanged) |

T-D anchor bodies revised in place (IDs retained, canonical via SPEC §14): **T-D41** (title + body → repo-shipped freeform + test-bundle, external `bundle_path`), **T-D47** (ships freeform + test-bundle), **T-D48** (SiteMesh→"bundle-specific" generic). Precedent: T-D27 lifecycle revision (Semble PR).

---

## Last Decision Minted

> No new T-D or C-D anchors. This slice reconciles existing docs to the already-minted **C-D14** (bundle externalisation) and revises **T-D41/T-D47/T-D48** bodies in place. The only discipline change is the handover-immutability carve-out (see Drift Flags) — a process rule recorded in `HANDOVER_TEMPLATE.md` / `SESSION_START.md`, not an anchor.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `LICENSE` — MIT, `Copyright (c) 2026 jaydomains`.
- `docs/_meta/throughline/handovers/2026-05-17-pass-1a-docs-license-sitemesh.md` — this handover.

**Modified (authority docs):**
- `README.md` — status, auto-run wording, dev-discipline section, owner, CLI, license section.
- `SPEC.md` — owner; §1/§7.1/§7.2/§7.4/§7.5/§7.12/§7.14/§7.16/§7.18 SiteMesh examples → `test-bundle`/"rich bundle"/generic; §11 DoD bullet; §13 (removed SiteMesh-authoring bullet; "Jay" → "the owner"); §14 T-D26/T-D33/T-D41/T-D47/T-D48 rows; §4 "single user" prose.
- `CODE_SPEC.md` — § S7/§S11/§S13 (companion modes, item-type example, modules-view label, verifier-rule example, Q6) SiteMesh → generic/`test-bundle`.
- `DECISIONS.md` — T-D? rationale blocks (T-D39/T-D40 context/rationale/implications), T-D26/T-D33 bodies, **T-D41 title+body revised in place with a revision note**, T-D42 context, T-D48 block — all generic/`test-bundle`.
- `ROADMAP.md` — Phase 7 retitled + superseding note + restated done-when against `test-bundle`; Phase 8/9/13 dependency lines; §13 table row removed; sequencing/templates bullets.
- `CHECKLIST.md` — Phase 7 retitled + supersession comment + rows restated against `test-bundle`; Refactor section name-neutralised; Phase 8 gate row comment; §11 bundle DoD row.

**Modified (discipline docs — itself a slice, per SESSION_START.md):**
- `SESSION_START.md` — handover-immutability carve-out added.
- `docs/_meta/throughline/HANDOVER_TEMPLATE.md` — authoring rule 8 added.

**Modified (code / template — comments & UI strings only):**
- `packages/shared/src/items.ts`, `packages/backend/src/items/policy.ts`, `packages/backend/src/methodology/session-start/engine.ts` — comment examples → `test-bundle`/generic.
- `packages/frontend/src/views/stubs.tsx` — GraphView stub body string SiteMesh ref → generic (stub itself unchanged).
- `templates/github-actions/throughline-semgrep.yml` — comment SiteMesh → "example bundle".

**Modified (handovers — see Drift Flags for the discipline exception):**
- Bodies scrubbed: `2026-05-12-phase-1-runtime-substrate.md`, `2026-05-12-phase-3-items-sessions.md`, `2026-05-13-phase-3-5-projects-create-ui.md`, `2026-05-13-phase-4-capture-surfaces.md`, `2026-05-13-phase-5-reconcile.md`, `2026-05-15-spec-clarification-gate-triggers.md`, `2026-05-16-bundle-externalisation-refactor.md`, `2026-05-16-phase-8-gate-runtime.md`, `2026-05-17-phase-13-session-start.md`.

**Renamed:**
- `docs/_meta/throughline/handovers/2026-05-15-phase-7-sitemesh.md` → `2026-05-15-phase-7-bundle-architecture.md` (`git mv`; body scrubbed; the two cross-referencing handovers' "Previous handover" pointers updated).

**Deleted:** _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| **Handover-immutability exception (deliberate)** | all scrubbed handovers + `HANDOVER_TEMPLATE.md` + `SESSION_START.md` | Handovers were previously treated as immutable historical record. Public-release confidentiality compelled scrubbing the business-internal name (and renaming a handover file) — a first-ever exception. | Applied as an explicit, one-time, meaning-preserving substitution (generic placeholders, narrative still reads truthfully); codified the rule going forward as `HANDOVER_TEMPLATE.md` authoring rule 8 + a `SESSION_START.md` note so future sessions know the carve-out and its bounds. |
| SiteMesh substring inside the GraphView stub | `packages/frontend/src/views/stubs.tsx` | Plan F said "don't touch the stub"; the stub's body string contained "SiteMesh bundle (Phase 7)". | Scrubbed only the SiteMesh substring (textual, in scope for "UI strings"); the stub remains a stub and the SPEC §11 GraphView DoD bullet is untouched — Pass 1b owns the implementation. |
| Replacement-bundle naming | SPEC/CODE_SPEC/DECISIONS/ROADMAP/CHECKLIST | Plan offered "the test-bundle" / "a non-trivial bundle" / "a rich bundle". | Used the concrete `test-bundle` for in-repo worked examples (parser/boards/gates) and "a rich bundle" only for hypothetical/illustrative phrasing — consistent with `methodologies/test-bundle/` reality. |
| `bundleItemPolicy(todo+decision)` wording in old handovers | `2026-05-12-phase-3-items-sessions.md` | Historical handover narrates the now-defunct `todo`/`decision` plan; not corrected to `task`/`note` (the rich bundle then *was* todo/decision). | Left as historical fact (only the business name scrubbed); accurate to what that slice actually planned. |

---

## Open Questions

- [ ] **Pass 1b — GraphView.** SPEC §11 "nine view modes functional" DoD bullet is still checked over a stub (Cat 1 blocker from the verification doc). Out of scope here by instruction; Pass 1b implements GraphView and makes the line true. Landing site: Pass 1b PR.
- [ ] Other verification-doc findings (Cat 2 CHECKLIST internal-consistency residue beyond Cluster A, Cat 3 code-discipline, `pnpm lint` no-op, open spec Qs, flaky `companion.test.ts:294`) are untouched here — separate remediation passes.

---

## Recently Resolved

- **README "Phase 3 in progress" stale status** — Cat 5 blocker; replaced with v1-complete status.
- **No LICENSE / "no license is included" disclaimer** — Cat 5 blocker; MIT `LICENSE` added, README reconciled.
- **Cluster A SiteMesh-ships contradictions (SPEC/DECISIONS/ROADMAP/CHECKLIST vs the externalisation refactor)** — Cat 2 blocker cluster; all four docs reconciled to C-D14.
- **"Kunda Tech (Jay)" attribution; SiteMesh as the running example in code+specs** — Cat 5 recommended; owner → `jaydomains`, name scrubbed repo-wide (zero occurrences).
- **README discipline-docs discoverability; auto-run / CLI wording** — Cat 5 recommended; addressed.
- **Out-of-repo cross-refs (SPEC §13 / ROADMAP §168, §390)** — Cat 2 recommended; bullets/row removed.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):** the bundle-externalisation refactor (C-D14) as the authoritative end state; `methodologies/test-bundle/bundle.md` facts (item types `task`/`note`, boards Tasks/Notes, two per-commit gates) for accurate worked-example substitution.

**Downstream (consumes this slice):** Pass 1b (GraphView) branches from this; the verification document's remaining findings reference these now-reconciled docs.

---

## Reference

- Verification source: the v1 pre-launch verification findings (Pass 1 diagnostic, this session).
- Spec / decisions / build-state docs: `SPEC.md` (§1, §7.x, §11, §13, §14), `CODE_SPEC.md` (C-D14, companion/modules), `DECISIONS.md` (T-D41/T-D47/T-D48 revised in place), `ROADMAP.md` (Phase 7), `CHECKLIST.md` (Phase 7, §11), `SESSION_START.md`, `HANDOVER_TEMPLATE.md`.
- PR: <fill on PR open>
