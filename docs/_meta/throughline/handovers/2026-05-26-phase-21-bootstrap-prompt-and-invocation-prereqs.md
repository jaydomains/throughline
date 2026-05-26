# Throughline Handover — Phase 21 doc prerequisites (bootstrap prompt and Claude Code invocation)

**Generated:** 2026-05-26
**Last commit SHA:** _to be filled at merge_ — 2026-05-26
**Previous handover:** `2026-05-25-phase-20-bootstrap-server-prereqs.md` (Phase 20 — bootstrap server-side ingest doc prerequisites)

---

## Build State vs Spec

Doc-only slice. No code, no migrations, no schema, no fixtures. Three anchors introduced (T-D55, T-D56, C-D21), one new SPEC subsection (§7.28 Bootstrap prompt and Claude Code invocation), two §14 index rows added, the §7.27 trailing forward-pointer flipped to a back-reference, one working-note forward-pointer (Q5) flipped to a back-reference, the schema doc amended with a Throughline-managed transient files section, single-use prompt artefact removed.

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| T-D55 — bootstrap prompt template lives at `packages/backend/src/bootstrap/prompt-template.md`; bundle-aware via runtime bundle-read; fixed parameter block at render time; no Throughline-side bundle-section extractor | built | `DECISIONS.md` (after T-D54) | Content verbatim per pre-authorised block; wrapper already matched T-D51/T-D52 precedent (h2 + Date/Status/Sections + Decision/Context/Rationale/Implications) — no reshape needed this session. |
| T-D56 — Claude Code invocation is user-driven and file-mediated; chokidar watcher on `.throughline/bootstrap-output.json` mirroring `inbox/watcher.ts`+`worker.ts`; subprocess-spawning explicitly deferred | built | `DECISIONS.md` (after T-D55) | Content verbatim per pre-authorised block; no `resolves` line (no prior working note covers invocation). |
| C-D21 — six implementation surfaces: prompt template, render endpoint, bootstrap-output watcher, archive/quarantine worker, re-bootstrap, SettingsView init UX block | built | `CODE_SPEC.md` (after C-D20, before `## 1. Process model`) | Content verbatim per pre-authorised block; wrapper already matched C-D19/C-D20 precedent (h2 + Status/Cites + Decision/Rationale/Implications; no Context subsection on C-D anchors). |
| SPEC §7.28 Bootstrap prompt and Claude Code invocation (functional prose) | built | `SPEC.md` §7.28 (after §7.27, before §8) | ~350 words across five paragraphs; matches §7.26 / §7.27 voice (terse, decision-oriented, methodology-agnostic — T-D48 tone); cites T-D55, T-D56, T-D53, T-D54, T-D4, C-D20, C-D21, WN-clone-Q5, and `docs/.throughline-schema.md`. Slightly above the ~250–300 word working assumption — the producer-side pipeline has more moving parts than §7.27's consumer side; trimming further would drop required content beats. |
| SPEC §14 anchor index — two new rows | built | `SPEC.md` §14 table (after T-D54 row) | Row count grew by exactly 2 (T-D55 → §7.28; T-D56 → §7.28). |
| SPEC §7.27 trailing forward-pointer updated | built | `SPEC.md` §7.27 trailing sentence | `(forthcoming) bootstrap-prompt section` → `§7.28 (bootstrap prompt and Claude Code invocation)`. |
| `WN-clone-Q5` trailing sentence flipped from forward-pointer to back-reference | built | `DECISIONS.md` WN-clone-Q5 | Title-tag and body prose byte-identical to pre-PR; only trailing sentence changed (`Resolved by → T-D55 (Phase 21).` → `Resolved by T-D55 (introduced 2026-05-26).`). |
| `docs/.throughline-schema.md` amended with Throughline-managed transient files section | built | `docs/.throughline-schema.md` (new section between `bundle.md — when present` and `What .throughline/ does NOT carry`) | Documents `bootstrap-prompt.md`, `bootstrap-output.json`, `bootstrap-archive/`, `bootstrap-quarantine/`, `.throughline/.gitignore`. Top-of-file `Anchors:` line and bottom `See also` list extended with the new anchors (T-D53, T-D55, T-D56, C-D21, SPEC §7.28) and a couple of minor wording fixes (C-D19 label disambiguated from "Phase 19 implementation surfaces" to "clone-and-go implementation surfaces" now that there are two phases of implementation surfaces). |
| Single-use prompt artefact removed | built | `docs/_meta/throughline/prompts/2026-05-25-doc-session-4-bootstrap-prompt-prereqs.md` (deleted via `git rm`) | git history retains it. |

`WN-clone-Q6` and `WN-clone-Q7` are intentionally untouched — they resolve in Phase 22 / cross-phase (T-D57, and the cross-cutting Q7) and remain as forward pointers.

---

## Last Decision Minted

- **T-D55** — The bootstrap prompt template is a single repo-owned generic markdown file at `packages/backend/src/bootstrap/prompt-template.md`. Throughline ships and maintains exactly one template; per-bundle prompts are explicitly rejected. Bundle-awareness happens at run time — the prompt instructs Claude Code to read the project's resolved bundle file directly and walk its §2–§11 as extraction policy. Throughline does not run a bundle-section extractor; the only Throughline-side templating is a small fixed parameter block (bundle path, repo root, declared output path) prepended at render time. Lands in: `DECISIONS.md`.
- **T-D56** — Throughline does not spawn Claude Code as a subprocess. The invocation contract is file-mediated: Throughline writes the rendered prompt to `<repo_path>/.throughline/bootstrap-prompt.md`, declares the output path in the prompt's parameter block, the user invokes Claude Code in their normal environment, Claude Code writes the bootstrap import file to `<repo_path>/.throughline/bootstrap-output.json`, and a backend chokidar watcher (mirroring `inbox/watcher.ts` + `worker.ts`) routes the file to the Phase 20 ingest endpoint. Subprocess-spawning is deferred — every existing backend subprocess invocation targets short-running deterministic-output tools and Claude Code does not fit that idiom. Lands in: `DECISIONS.md`.
- **C-D21** — Phase 21 builds six surfaces: prompt template at `packages/backend/src/bootstrap/prompt-template.md`, `POST /api/projects/:id/bootstrap/render` render endpoint, `packages/backend/src/bootstrap/watcher.ts` chokidar watcher, `packages/backend/src/bootstrap/worker.ts` archive/quarantine worker, re-bootstrap as same-flow-re-run, SettingsView init UX block. Each surface reuses an existing precedent (bundle-resolver from C-D14 / C-D19; watcher/worker pattern from `inbox/watcher.ts`+`worker.ts`) or is additive to the existing `.throughline/` directory contract. Lands in: `CODE_SPEC.md`.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `docs/_meta/throughline/handovers/2026-05-26-phase-21-bootstrap-prompt-and-invocation-prereqs.md` — this handover.

**Modified:**
- `SPEC.md` — inserted §7.28 (Bootstrap prompt and Claude Code invocation) functional subsection after §7.27; updated §7.27 trailing forward-pointer from `(forthcoming) bootstrap-prompt section` to `§7.28 (bootstrap prompt and Claude Code invocation)`; appended T-D55 and T-D56 rows to the §14 anchor index.
- `DECISIONS.md` — appended T-D55 and T-D56 anchor bodies after T-D54; flipped trailing sentence of `WN-clone-Q5` from forward-pointer to back-reference form.
- `CODE_SPEC.md` — appended C-D21 anchor body after C-D20, before `## 1. Process model`.
- `docs/.throughline-schema.md` — added "Throughline-managed transient files" section between `bundle.md — when present` and `What .throughline/ does NOT carry`; extended top-of-file `Anchors:` line and bottom `See also` list with the new anchor references; minor label fix (`C-D19 — Phase 19 implementation surfaces` → `C-D19 — Phase 19 clone-and-go implementation surfaces`) to distinguish from C-D21's Phase 21 bootstrap producer surfaces.

**Deleted:**
- `docs/_meta/throughline/prompts/2026-05-25-doc-session-4-bootstrap-prompt-prereqs.md` — single-use prompt; deleted by `git rm` in the same commit. git history retains it.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Observed but not fixed | `CODE_SPEC.md:9` | Anchor-convention paragraph still says T-D anchors "remain canonical at" a count below the post-Session-4 total (54 → 56). Stale since T-D49/T-D50 (Phase 18) and noted in Sessions 2 and 3. | Surfaced in the PR description; not touched in this PR per the prompt's scoped brief — cleanup is a separate slice. |
| Observed but not fixed | `SPEC.md` §7.26 trailing paragraph | Still says "Importing existing repo state … is the bootstrap surface, defined in a later phase." §7.27 (bootstrap consumer side) and §7.28 (bootstrap producer side) now both exist; the sentence is stale. | Surfaced in the PR description; §7.26 is not in this session's file-touch manifest. Noted by Session 3 as well — cleanup is a single-sentence follow-up. |
| Observed but not fixed | `docs/.throughline-schema.md` `What .throughline/ carries` section | Top-of-file says "Configuration only. No state, no secrets, no derived data." `.throughline/` now also carries Throughline-managed transient files (bootstrap-prompt, bootstrap-output, archive, quarantine, .gitignore) per this PR's new section. The "Configuration only" wording becomes mildly stale. | Surfaced in the PR description. The new "Throughline-managed transient files" section opens with the user-authored vs Throughline-managed distinction so the conceptual contract is clear; tightening the top wording is a single-sentence follow-up scoped outside the prompt's content beats. |
| In-scope scope-extension | `docs/.throughline-schema.md` top `Anchors:` line and bottom `See also` list | The prompt specified only the new-section addition; the doc's own anchor metadata is not strictly part of the new section. | Extended both lists with T-D53 / T-D55 / T-D56 / C-D21 / SPEC §7.28 since the doc otherwise contains anchor references it does not declare. Treated as part of the same amendment because the file is already in this session's file-touch manifest and leaving the metadata stale would create a future-session puzzle. |

---

## Open Questions

The two working notes whose forward-pointers do not realise in Phase 21 stay as forward pointers and resolve in later phases. Each names its landing site:

- [ ] `WN-clone-Q6` — discipline-drift scanners do not auto-run on bind; user invokes via "Run discipline scan". Resolves to T-D57 in Phase 22.
- [ ] `WN-clone-Q7` — clone-and-go shapes every future adoption; resolution is cross-cutting across T-D51–T-D57 rather than a single anchor (informs design across Phases 19–22).

---

## Recently Resolved

- `WN-clone-Q5` — introduced as a forward-pointer working note in Session 1 of the doc-authoring stream (PR #32, commit `1da08b2` — "Doc session 1 — promote seven open questions to resolved working notes"). Trailing sentence flipped from `Resolved by → T-D55 (Phase 21).` to `Resolved by T-D55 (introduced 2026-05-26).` now that T-D55 exists.

The Session 1 PR introduced all seven `WN-clone-Q*` working notes simultaneously; Session 2 closed Q1/Q4 (Phase 19), Session 3 closed Q2/Q3 (Phase 20), this slice closes Q5 (Phase 21). Q6/Q7 remain open for Phase 22 / cross-phase.

---

## Cross-Module Dependencies

**Upstream (this module consumes):** _none_ (doc-only slice)

**Downstream (consumes this module):**
- Phase 21 implementation slice — consumes T-D55, T-D56, C-D21. Pending; builds the six named surfaces (prompt template file, `POST /api/projects/:id/bootstrap/render` endpoint, `bootstrap/watcher.ts`, `bootstrap/worker.ts`, re-bootstrap reuse-existing-flow path, SettingsView init UX block) plus the Throughline-managed `.throughline/.gitignore` write.
- Phase 22 doc-authoring session (Session 5) — resolves WN-clone-Q6 to T-D57 (discipline-drift scanner trigger model) and closes out WN-clone-Q7 (cross-cutting). Final session in the five-session doc-authoring stream.

---

## Reference

- Spec / decisions / build-state docs this slice operates against: `SESSION_START.md`, `SPEC.md` §7.26 / §7.27 / §14, `DECISIONS.md` T-D4 / T-D49 / T-D51 / T-D52 / T-D53 / T-D54 / WN-clone-Q5, `CODE_SPEC.md` C-D14 / C-D19 / C-D20, `docs/.throughline-schema.md`, `docs/_meta/throughline/HANDOVER_TEMPLATE.md`, prior handover `2026-05-25-phase-20-bootstrap-server-prereqs.md`, the single-use prompt artefact `docs/_meta/throughline/prompts/2026-05-25-doc-session-4-bootstrap-prompt-prereqs.md` (deleted in this commit).
- Precedent code files cited by T-D55 / T-D56 / C-D21 (read for shape only; not edited): `packages/backend/src/inbox/watcher.ts`, `packages/backend/src/inbox/worker.ts`, `packages/backend/src/md-ingest/watcher.ts`, `packages/backend/src/methodology/loader.ts`, `packages/backend/src/dump-zone/extractor.ts`, `packages/backend/src/audit/log.ts`, and (subprocess-deferral precedent) `packages/backend/src/github/local-git.ts`, `packages/backend/src/semble/client.ts`, `packages/backend/src/methodology/gates/checks.ts`, `packages/backend/src/methodology/gates/hook-installer.ts`. The C-D20-introduced `packages/backend/src/bootstrap/derive-id.ts` does not yet exist on disk (Phase 20 build is pending); T-D55 / C-D21 cite it as the co-location anchor for `prompt-template.md` and the planned Phase 21 producer surfaces (`watcher.ts`, `worker.ts`).
- PR: _to be filled at open_
