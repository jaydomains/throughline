# Throughline Handover — Phase 20 doc prerequisites (bootstrap server-side ingest)

**Generated:** 2026-05-25
**Last commit SHA:** _to be filled at merge_ — 2026-05-25
**Previous handover:** `2026-05-25-phase-19-clone-and-go-doc-prereqs.md` (Phase 19 — clone-and-go doc prerequisites)

---

## Build State vs Spec

Doc-only slice. No code, no migrations, no schema, no fixtures. Three anchors introduced (T-D53, T-D54, C-D20), one new SPEC subsection (§7.27 Bootstrap), two §14 index rows added, two working-note forward pointers flipped to back-references, single-use prompt artefact removed.

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| T-D53 — bootstrap import file shape; bundle-aware validation; secrets and runtime state excluded | built | `DECISIONS.md` (after T-D52) | Content verbatim per pre-authorised block; wrapper reshaped to T-D51/T-D52 precedent (h2 + Date/Status/Sections + Decision/Context/Rationale/Implications). Context paragraph drafted from WN-clone-Q2 framing per session checkpoint. |
| T-D54 — bootstrap re-run is idempotent upsert on `(project_id, bootstrap_id)`; three row states; per-source-type derivation + universal `@bootstrap-id:` override | built | `DECISIONS.md` (after T-D53) | Content verbatim per pre-authorised block; wrapper reshaped to precedent. Context paragraph drafted from WN-clone-Q3 framing per session checkpoint. |
| C-D20 — bootstrap ingest path: schema + endpoint + derivation module + conflict-detection predicate + review queue UI | built | `CODE_SPEC.md` (after C-D19, before `## 1. Process model`) | Content verbatim per pre-authorised block; wrapper reshaped to C-D19 precedent (h2 + Status/Cites + Decision/Rationale/Implications). Opening Decision sentence ("five surfaces") modelled on C-D19; Rationale and Implications reorganised from pre-drafted prose. |
| SPEC §7.27 Bootstrap (functional prose) | built | `SPEC.md` §7.27 (after §7.26, before §8) | ~290 words; matches §7.23/§7.25/§7.26 voice; cites T-D53, T-D54, T-D4, T-D51, T-D52, §7.26, `docs/.throughline-schema.md`; forward-pointer to the (forthcoming) Phase 21 bootstrap-prompt section. |
| SPEC §14 anchor index — two new rows | built | `SPEC.md` §14 table (after T-D52 row) | Row count grew by exactly 2 (T-D53 → §7.27; T-D54 → §7.27). |
| `WN-clone-Q2` trailing sentence flipped from forward-pointer to back-reference | built | `DECISIONS.md` WN-clone-Q2 | Title-tag and body prose byte-identical to pre-PR; only trailing sentence changed (`Resolved by → T-D53 (Phase 20).` → `Resolved by T-D53 (introduced 2026-05-25).`). |
| `WN-clone-Q3` trailing sentence flipped | built | `DECISIONS.md` WN-clone-Q3 | Title-tag and body prose byte-identical to pre-PR; only trailing sentence changed (`Resolved by → T-D54 (Phase 20).` → `Resolved by T-D54 (introduced 2026-05-25).`). |
| Single-use prompt artefact removed | built | `docs/_meta/throughline/prompts/2026-05-25-doc-session-3-bootstrap-server-prereqs.md` (deleted via `git rm`) | git history retains it. |

`WN-clone-Q5`, `WN-clone-Q6`, `WN-clone-Q7` are intentionally untouched — they resolve in Phases 21–22 (T-D55, T-D57, and the cross-cutting Q7) and remain as forward pointers.

---

## Last Decision Minted

- **T-D53** — bootstrap import file is a structured per-source-row artifact carrying items, sessions, and library entries; bundle-aware validation against the project's bound methodology; DECISIONS-style anchors land as `library_entries` of type `note` tagged `decision`, never as items; secrets / audit history / embeddings / telemetry / settings / gate-firing history / methodology bindings are explicitly excluded. Lands in: `DECISIONS.md`.
- **T-D54** — bootstrap re-run is idempotent upsert on `(project_id, bootstrap_id)`; three row states (new / existing-no-edits / existing-with-edits) with conflict surfacing on the third; `bootstrap_id` derived per source type (`decision:<anchor>`, `roadmap:phase-<n>`, `handover:<filename>`, `checklist:<sha256-16-of-normalized-text>`); universal `@bootstrap-id:` override as the escape hatch; sha256/16-char/unsalted hash convention distinct from `promptFingerprint` (T-D24) and `contentHash`. Lands in: `DECISIONS.md`.
- **C-D20** — bootstrap ingest path names five surfaces: schema migration (nullable `bootstrap_id` column + unique partial index on `items` / `sessions` / `library_entries`), `POST /api/projects/:id/import` endpoint with transactional upsert and per-row result classification, `packages/backend/src/bootstrap/derive-id.ts` derivation module, `hasUserEditsSinceLastBootstrap` conflict-detection predicate as single source of truth, review queue UI for conflicted and stale rows. Lands in: `CODE_SPEC.md`.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `docs/_meta/throughline/handovers/2026-05-25-phase-20-bootstrap-server-prereqs.md` — this handover.

**Modified:**
- `SPEC.md` — inserted §7.27 (Bootstrap) functional subsection after §7.26; appended T-D53 and T-D54 rows to the §14 anchor index.
- `DECISIONS.md` — appended T-D53 and T-D54 anchor bodies after T-D52; flipped trailing sentences of `WN-clone-Q2` and `WN-clone-Q3` from forward-pointer to back-reference form.
- `CODE_SPEC.md` — appended C-D20 anchor body after C-D19, before `## 1. Process model`.

**Deleted:**
- `docs/_meta/throughline/prompts/2026-05-25-doc-session-3-bootstrap-server-prereqs.md` — single-use prompt; deleted by `git rm` in the same commit. git history retains it.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Observed but not fixed | `CODE_SPEC.md:9` | Anchor-convention paragraph still says T-D anchors "remain canonical at 48"; stale since T-D49/T-D50 (Phase 18) and now stale at 54 after this PR. | Surfaced in the PR description; not touched in this PR per the prompt's scoped brief. Cleanup is a separate slice — same observation as Session 2 made. |
| Observed but not fixed | `SPEC.md` §7.26 trailing paragraph | Says "Importing existing repo state … is the bootstrap surface, defined in a later phase." That "later phase" is now §7.27 in this PR; the sentence is mildly stale. | Surfaced in the PR description; not touched because §7.26 is not in this session's file-touch manifest (manifest is insert §7.27 after §7.26, not edit §7.26 itself). Cleanup is a single-sentence follow-up. |
| Pre-drafted-block shape mismatch | `prompt artefact` | Pre-drafted T-D53 / T-D54 / C-D20 blocks used h3 + italic Status + prose body; live precedent (T-D51/T-D52/C-D19) is h2 + bullet metadata + Decision/Context/Rationale/Implications subsections. | Surfaced to spec author at session open. Resolution: keep content verbatim, reshape wrapper to precedent. Context paragraphs for T-D53/T-D54 drafted from WN-clone-Q2/Q3 framing (the surfacing question + the Phase 20 producer/consumer split); C-D20 opening Decision sentence + Rationale + Implications reorganised from pre-drafted prose with no invented content. All four content choices reviewed and approved at content checkpoint before commit. |

---

## Open Questions

The three working notes whose forward-pointers do not realise in Phase 20 stay as forward pointers and resolve in later phases. Each names its landing site:

- [ ] `WN-clone-Q5` — bootstrap prompt is generic and bundle-aware at run time, not per-bundle. Resolves to T-D55 in Phase 21.
- [ ] `WN-clone-Q6` — discipline-drift scanners do not auto-run on bind; user invokes via "Run discipline scan". Resolves to T-D57 in Phase 22.
- [ ] `WN-clone-Q7` — clone-and-go shapes every future adoption; resolution is cross-cutting across T-D51–T-D57 rather than a single anchor (informs design across Phases 19–22).

---

## Recently Resolved

- `WN-clone-Q2` — introduced as a forward-pointer working note in Session 1 of the doc-authoring stream (PR #32, commit `1da08b2` — "Doc session 1 — promote seven open questions to resolved working notes"). Trailing sentence flipped from `Resolved by → T-D53 (Phase 20).` to `Resolved by T-D53 (introduced 2026-05-25).` now that T-D53 exists.
- `WN-clone-Q3` — introduced in the same Session 1 PR (#32, commit `1da08b2`). Trailing sentence flipped from `Resolved by → T-D54 (Phase 20).` to `Resolved by T-D54 (introduced 2026-05-25).` now that T-D54 exists.

The Session 1 PR introduced all seven `WN-clone-Q*` working notes simultaneously; Session 2 closed Q1/Q4 (Phase 19), this slice closes Q2/Q3 (Phase 20). Q5/Q6/Q7 remain open for Phases 21–22.

---

## Cross-Module Dependencies

**Upstream (this module consumes):** _none_ (doc-only slice)

**Downstream (consumes this module):**
- Phase 20 implementation slice — consumes T-D53, T-D54, C-D20. Pending; builds the five named surfaces (schema migration, `POST /api/projects/:id/import` endpoint, `derive-id.ts` module, `hasUserEditsSinceLastBootstrap` predicate, review queue UI).
- Phase 21 doc-authoring session — produces the bootstrap-prompt section (forward-referenced from §7.27) and resolves WN-clone-Q5 to T-D55. Will also produce a Phase 21 Claude Code prompt artefact that emits bootstrap import files of the shape T-D53 defines.
- Phase 22 doc-authoring session — resolves WN-clone-Q6 to T-D57 (discipline-drift scanner trigger model) and closes out WN-clone-Q7 (cross-cutting).

---

## Reference

- Spec / decisions / build-state docs this slice operates against: `SESSION_START.md`, `SPEC.md` §7.26 and §14, `DECISIONS.md` T-D4 / T-D24 / T-D36 / T-D51 / T-D52 / WN-clone-Q2 / WN-clone-Q3, `CODE_SPEC.md` C-D19, `docs/_meta/throughline/HANDOVER_TEMPLATE.md`, prior handover `2026-05-25-phase-19-clone-and-go-doc-prereqs.md`, the single-use prompt artefact `docs/_meta/throughline/prompts/2026-05-25-doc-session-3-bootstrap-server-prereqs.md` (deleted in this commit).
- Precedent code files cited by C-D20 (read for shape only; not edited): `packages/backend/src/md-ingest/service.ts`, `packages/backend/src/audit/log.ts`, `packages/backend/src/ai/fingerprint.ts`, `packages/backend/src/intelligence/text-index.ts`, `packages/backend/src/db/migrations/0001_init.sql`.
- PR: _to be filled at open_
