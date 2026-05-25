# Throughline Handover — Phase 19 doc prerequisites (clone-and-go)

**Generated:** 2026-05-25
**Last commit SHA:** _to be filled at merge_ — 2026-05-25
**Previous handover:** `2026-05-24-phase-18-communication-model.md` (Phase 18 — communication-model layer)

---

## Build State vs Spec

Doc-only slice. No code, no migrations, no schema, no fixtures. Three anchors introduced, one new doc file shipped, SPEC §7.26 placed, two §14 index rows added, two working-note forward pointers flipped to back-references, single-use prompt artefact removed.

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| T-D51 — `.throughline/` per-repo config convention; third bundle-resolution arm | built | `DECISIONS.md` (after T-D50) | Verbatim per pre-authorised block |
| T-D52 — `throughline init` requires running backend; CLI never writes datastore directly | built | `DECISIONS.md` (after T-D51) | Verbatim per pre-authorised block |
| C-D19 — eight Phase-19 implementation surfaces named | built | `CODE_SPEC.md` (after C-D18, before §1 Process model) | Verbatim per pre-authorised block |
| `docs/.throughline-schema.md` — schema for `project.json` and optional `bundle.md`, plus explicit "what `.throughline/` does NOT carry" | built | `docs/.throughline-schema.md` (new file) | JSON example rendered as fenced code block per prompt |
| SPEC §7.26 Clone-and-go (functional prose) | built | `SPEC.md` §7.26 (after §7.25, before §8) | ~220 words, matches §7.23/§7.25 tone; cites T-D51, T-D52, T-D4, C-D14, schema doc |
| SPEC §14 anchor index — two new rows | built | `SPEC.md` §14 table (after T-D50 row) | Row count grew by exactly 2 |
| `WN-clone-Q1` trailing sentence flipped from forward-pointer to back-reference | built | `DECISIONS.md` line 1099 | Title-tag and body prose byte-identical to pre-PR |
| `WN-clone-Q4` trailing sentence flipped | built | `DECISIONS.md` line 1111 | Title-tag and body prose byte-identical to pre-PR |
| Single-use prompt artefact removed | built | `docs/_meta/throughline/prompts/2026-05-24-doc-session-2-clone-and-go-prereqs.md` (deleted via `git rm`) | git history retains it |

`WN-clone-Q2`, `WN-clone-Q3`, `WN-clone-Q5`, `WN-clone-Q6`, `WN-clone-Q7` are intentionally untouched — they resolve in Phases 20–22 (T-D53 through T-D57) and remain as forward pointers.

---

## Last Decision Minted

- **T-D51** — `.throughline/` is the per-repo config convention; bundle loader gains a third resolution arm at `<repo_path>/.throughline/bundle.md`, slotted between the explicit `bundle_path` arm (C-D14) and the install-shipped fallback. Lands in: `DECISIONS.md`.
- **T-D52** — `throughline init` requires the backend running and writes only via existing HTTP endpoints; never the SQLite datastore directly. Probes `GET /api/health` and prints `Start the backend first: pnpm --filter @throughline/backend start` on probe failure. Lands in: `DECISIONS.md`.
- **C-D19** — names the eight Phase-19 implementation surfaces (bundle loader third arm, `.throughline/project.json` init config reader, git-remote auto-detection, CLI `init` subcommand, NewProjectModal `bundle_path` field, SettingsView missing-config component, re-init flow, repo-path normalisation). Lands in: `CODE_SPEC.md`.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `docs/.throughline-schema.md` — schema for the per-repo `.throughline/` directory (required `project.json`, optional `bundle.md`, explicit non-carriage list).
- `docs/_meta/throughline/handovers/2026-05-25-phase-19-clone-and-go-doc-prereqs.md` — this handover.

**Modified:**
- `SPEC.md` — added §7.26 (Clone-and-go) functional subsection; appended T-D51 and T-D52 rows to the §14 anchor index.
- `DECISIONS.md` — appended T-D51 and T-D52 anchor bodies after T-D50; flipped trailing sentences of `WN-clone-Q1` and `WN-clone-Q4` from forward-pointer to back-reference form.
- `CODE_SPEC.md` — appended C-D19 anchor body after C-D18, before `## 1. Process model`.

**Deleted:**
- `docs/_meta/throughline/prompts/2026-05-24-doc-session-2-clone-and-go-prereqs.md` — single-use prompt; deleted by `git rm` in the same commit. git history retains it.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Observed but not fixed | `CODE_SPEC.md:9` | Anchor-convention paragraph says T-D anchors "remain canonical at 48"; already stale after T-D49/T-D50 and now stale at 52 after this PR. | Surfaced in the PR description; not touched in this PR per the prompt's scoped brief. Cleanup is a separate slice. |

---

## Open Questions

The five working notes whose forward-pointers do not realise in Phase 19 stay as forward pointers and resolve in later phases. Each names its landing site:

- [ ] `WN-clone-Q2` — bootstrap imports decisions as library notes, not items. Resolves to T-D53 in Phase 20.
- [ ] `WN-clone-Q3` — bootstrap is re-runnable via idempotent upsert keyed on deterministic `bootstrap_id`. Resolves to T-D54 in Phase 20.
- [ ] `WN-clone-Q5` — bootstrap prompt is generic and bundle-aware at run time, not per-bundle. Resolves to T-D55 in Phase 21.
- [ ] `WN-clone-Q6` — discipline-drift scanners do not auto-run on bind; user invokes via "Run discipline scan". Resolves to T-D57 in Phase 22.
- [ ] `WN-clone-Q7` — landing site as recorded in `DECISIONS.md`'s working-note ledger.

---

## Recently Resolved

- `WN-clone-Q1` — introduced as a forward-pointer working note in Session 1 of the doc-authoring stream (PR #32, commit `1da08b2` — "Doc session 1 — promote seven open questions to resolved working notes"). Trailing sentence flipped from `Resolved by → T-D51 (Phase 19).` to `Resolved by T-D51 (introduced 2026-05-25).` now that T-D51 exists.
- `WN-clone-Q4` — introduced in the same Session 1 PR (#32, commit `1da08b2`). Trailing sentence flipped from `Resolved by → T-D52 (Phase 19).` to `Resolved by T-D52 (introduced 2026-05-25).` now that T-D52 exists.

The Session 1 PR introduced all seven `WN-clone-Q*` working notes simultaneously; this slice closes the two whose anchors land in Phase 19.

---

## Cross-Module Dependencies

**Upstream (this module consumes):** _none_ (doc-only slice)

**Downstream (consumes this module):**
- Phase 19 implementation slice — consumes T-D51, T-D52, C-D19, and `docs/.throughline-schema.md`. Pending; builds the eight named surfaces.
- Future Phase 20–22 doc-authoring sessions — resolve the remaining five `WN-clone-Q*` forward pointers (Q2/Q3 → Phase 20, Q5 → Phase 21, Q6/Q7 → Phase 22).

---

## Reference

- Spec / decisions / build-state docs this slice operates against: `SESSION_START.md`, `SPEC.md` §7.25 and §14, `DECISIONS.md` T-D4 / T-D49 / T-D50 / WN-clone-Q1 / WN-clone-Q4, `CODE_SPEC.md` C-D14 / C-D18, `docs/_meta/throughline/HANDOVER_TEMPLATE.md`, prior handover `2026-05-24-phase-18-communication-model.md`.
- PR: _to be filled at open_
