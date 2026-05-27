# Throughline Handover — Phase 20 Slice 1: schema migration (bootstrap_id + bootstrap_stale columns + unique partial indexes)

**Generated:** 2026-05-27
**Last commit SHA:** pending — 2026-05-27
**Previous handover:** `2026-05-27-carry-forwards-cleanup-pre-phase-20.md` (PR #51 — carry-forwards cleanup before Phase 20 chain-open)

First slice of the Phase 20 bootstrap-ingest chain (tracking issue [#52](https://github.com/jaydomains/throughline/issues/52), `Auto-continue: phase-20-bootstrap-ingest`). Second implementation chain under the codified `AUTO_CONTINUE_WORKFLOW.md` rhythm.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| C-D20 surface 1 — `bootstrap_id TEXT` (nullable) on items / sessions / library_entries; unique partial index per table on `(project_id, bootstrap_id) WHERE bootstrap_id IS NOT NULL`; existing creation paths unaffected | built | `packages/backend/src/db/migrations/0012_phase20_bootstrap.sql`; `packages/backend/test/bootstrap-migration.test.ts` (9 tests) | Migration is additive; no service-layer code in this slice. Slices 2–4 carry derivation, endpoint+upsert+predicate, and review-UI respectively. |
| T-D54 — `bootstrap_stale INTEGER NOT NULL DEFAULT 0` flag column for stale rows (never auto-deleted; surfaces in Slice 4's review queue) | built | `0012_phase20_bootstrap.sql` (three `ALTER TABLE ... ADD COLUMN bootstrap_stale ...` statements); `bootstrap-migration.test.ts` "defaults bootstrap_stale to 0 on all three tables" | INTEGER 0/1 convention follows 0006's `source_tracked INTEGER NOT NULL DEFAULT 0`; SQLite has no native BOOLEAN. The flag flips in Slice 3's upsert, not exercised in this slice. |
| Chain-state file refreshed for Phase 20 chain-open per `AUTO_CONTINUE_WORKFLOW.md` §"Chain State Persistence" | built | `.claude-code/auto-continue-state.json` | Overwrites the stale Phase 19 chain state (Phase 19 closed via PR #50 but the file was not refreshed at chain-close — captured as a Drift Flag below; resolved by overwrite). |
| `CHECKLIST.md` §20 four-slice decomposition (replaces placeholder line) | built | `CHECKLIST.md` §20 | Mirrors the post-chain-open shape used by Phase 19 §19. |
| `PLATFORM_STATUS.md` Snapshot + Current Phase + Queued Work rolled for Phase 20 chain-open | built | `docs/_meta/throughline/PLATFORM_STATUS.md` | `throughline:pause` label re-surfaced in Queued Work as a second-pass gap (spec author creates manually during chain run; not a blocker). |
| GitHub tracking issue opened with the spec-author-approved title + body | built | Issue [#52](https://github.com/jaydomains/throughline/issues/52) | Title `Auto-continue: phase-20-bootstrap-ingest`; labelled `auto-continue` (the `throughline:pause` label is still absent). |

---

## Last Decision Minted

No new decisions minted. Implementation followed T-D53 (file shape), T-D54 (idempotent upsert on `(project_id, bootstrap_id)` + per-source-type derivation + `@bootstrap-id:` override), and C-D20 surface 1 (schema migration). Implementation-shape choices recorded inline at the migration site:

- **INTEGER 0/1 for `bootstrap_stale`.** Matches the existing 0006 `source_tracked` convention; SQLite stores all BOOLEAN-typed columns as INTEGER anyway. A future polish PR could introduce a domain-wide BOOLEAN affinity declaration, but Phase 20 does not earn that.
- **Per-table partial-index naming.** `idx_items_bootstrap_id` / `idx_sessions_bootstrap_id` / `idx_library_entries_bootstrap_id` — follows 0006's `idx_library_source_tracked` precedent (table-scoped name, column hint, no per-condition suffix). The `WHERE bootstrap_id IS NOT NULL` predicate is the unique-scope expression; the index name does not encode it because every existing partial index in the codebase elides the predicate from its name.
- **Direct-SQL test inserts (not service.create).** Slice 1 deliberately has no service-layer code; the migration test validates the schema in isolation. Slice 3 will exercise the service-layer upsert against the same schema and overlap will be intentional.

---

## Active Blockers

_none_

The `throughline:pause` label gap is not a blocker — spec author confirmed at chain-open that the two fallback kill-switch signals (`.claude-code/auto-continue-pause` marker file, `/pause` PR or issue comment) operate; Phase 19 ran clean on these. The label will be created manually during the chain run.

---

## Files Changed Since Last Handover

**New:**
- `packages/backend/src/db/migrations/0012_phase20_bootstrap.sql` — Phase 20 schema migration: `bootstrap_id TEXT` (nullable) and `bootstrap_stale INTEGER NOT NULL DEFAULT 0` on items / sessions / library_entries, plus three unique partial indexes on `(project_id, bootstrap_id) WHERE bootstrap_id IS NOT NULL`.
- `packages/backend/test/bootstrap-migration.test.ts` — 9 schema-freshness tests: columns + indexes present, multi-NULL coexistence, same-bootstrap_id collision per table, cross-project independence, md-ingest keying unaffected, `bootstrap_stale` default.
- `docs/_meta/throughline/handovers/2026-05-27-phase-20-slice-1-schema-migration.md` — this handover.

**Modified:**
- `.claude-code/auto-continue-state.json` — overwrites the stale Phase 19 chain state (the prior file was not refreshed at Phase 19 chain-close). New state: `chainId: "phase-20-bootstrap-ingest"`, four slices (1 open, 3 pending), tracking issue 52, `currentIndex: 0`. The `notes` block carries the two cross-slice chain calibration items the spec author flagged at chain-open (Slice 3 sizing data point; Slice 4 placement decision documentation requirement).
- `CHECKLIST.md` §20 — replaces the "Slice splits land when this phase's build session opens" placeholder with the four-slice decomposition; mirrors the §19 chain-open shape.
- `docs/_meta/throughline/PLATFORM_STATUS.md` — Snapshot, Current Phase, Queued Work rolled for Phase 20 chain-open. Queued Work adds the `throughline:pause` label entry as a second-pass gap.

**Deleted:** _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Phase 19 chain-state file not refreshed at Phase 19 chain-close | `.claude-code/auto-continue-state.json` (pre-Phase-20-chain-open state) | Phase 19 closed via PR #50 / tracking issue [#46](https://github.com/jaydomains/throughline/issues/46) closed, but `.claude-code/auto-continue-state.json` still showed slice 4 `status: "open", prNumber: null`. Source of this drift: Phase 19 Slice 4's close commit did not roll the file forward to a chain-closed state. Visible at Phase 20 chain-open via direct file read. | Overwritten by this slice's update to the file (the file is the live Phase 20 chain state). Not a separate fix-up commit because the file is regenerated per chain. Captured here so the next cohort hardener pass sees the cause if it audits state-file lifecycle. |
| `throughline:pause` label still absent in repo (second consecutive chain-open without it) | `jaydomains/throughline` repo settings | PR #51 (`2026-05-27-carry-forwards-cleanup-pre-phase-20.md`) handed label creation to the spec author. Verified absent again at Phase 20 chain-open 2026-05-27 via `mcp__github__get_label`. The `auto-continue` label exists and was applied to issue #52. | Spec-author-confirmed at Phase 20 chain-open: not a blocker; chain operates on the two fallback kill-switch signals; label will be created manually during the chain run. Re-surfaced as a persistent entry in `PLATFORM_STATUS.md` Queued Work so it stays visible. |

---

## Open Questions

- [ ] **DB-level UNIQUE on `(project_id, bootstrap_id)` extends to the audit-scan covering index in Slice 3?** C-D20 notes that the existing `idx_audit_entity` index "should suffice for v1" and that a covering index on `(entity_type, entity_id, timestamp, field)` is a benchmark-driven follow-up if Slice 3's predicate dominates import latency at realistic row counts. Slice 1 does not touch `audit_log`; the question lands in Slice 3 or a follow-up perf-tuning slice.
- [ ] **`@bootstrap-id:` override carrier — the column itself does not enforce this.** The migration adds the column; T-D54's override syntax is a producer-side concern (Phase 21 prompt template) and a parser-side concern (Slice 2 derivation module + Slice 3 validator). Slice 1 leaves both unenforced — they land in Slices 2/3.

---

## Recently Resolved

- **Phase 20 build chain open** — was flagged in `2026-05-27-carry-forwards-cleanup-pre-phase-20.md` as "next concrete action: plan-mode entry for the Phase 20 chain"; resolved by this slice (chain opened with tracking issue [#52](https://github.com/jaydomains/throughline/issues/52) and state file `.claude-code/auto-continue-state.json` overwritten with the Phase 20 chain state).
- **Phase 20 schema substrate** — was flagged in `2026-05-25-phase-20-bootstrap-server-prereqs.md` as "C-D20 surface 1 — pending the Phase 20 build slice"; resolved by this slice (migration 0012 lands the nullable column, unique partial index, and stale-flag column on all three affected tables).

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- `packages/backend/src/db/migrate.ts` — existing migration runner; the new `0012_phase20_bootstrap.sql` is discovered and applied through the unchanged `runMigrations` path (alphabetic ordering + per-migration transaction).
- `packages/backend/test/helpers.ts` — existing `makeTmpConfig` test helper; `bootstrap-migration.test.ts` uses it for fresh per-test DBs.

**Downstream (consumes this slice's work):**
- **Slice 2** (derivation module) — does not depend on the schema directly; produces the IDs that Slice 3 writes into the `bootstrap_id` column.
- **Slice 3** (endpoint + upsert + predicate) — depends on the schema for the upsert's `(project_id, bootstrap_id)` keying and the `bootstrap_stale` flag write path. The predicate scans `audit_log` (unchanged schema; T-D36 polymorphic identity stands).
- **Slice 4** (review UI + GET/resolve endpoints) — depends on the `bootstrap_stale` flag and the per-row classification result shape from Slice 3.

---

## Reference

- `DECISIONS.md` T-D53 — bootstrap import file shape + bundle-aware validation + exclusions.
- `DECISIONS.md` T-D54 — idempotent upsert on `(project_id, bootstrap_id)` + three row states + per-source-type derivation + universal `@bootstrap-id:` override.
- `CODE_SPEC.md` C-D20 — five implementation surfaces; this slice lands surface 1.
- `SPEC.md` §7.27 — clone-and-go bootstrap functional behaviour.
- `ROADMAP.md` §20 — Scope / Dependencies / Done when / Sizing.
- `docs/.throughline-schema.md` — bootstrap file shape and transient-files contract (consumed downstream by Slice 3's validator and Phase 21's producer).
- `docs/_meta/throughline/AUTO_CONTINUE_WORKFLOW.md` — chain mechanics, halt classes, kill switch.
- Plan: `/root/.claude/plans/plan-mode-phase-20-build-misty-dove.md` (session-local, not in repo).
- Tracking issue: [#52](https://github.com/jaydomains/throughline/issues/52) — `Auto-continue: phase-20-bootstrap-ingest`.
- Chain state: `.claude-code/auto-continue-state.json`.
- Prior handover (Phase 19 chain-close cleanup): `docs/_meta/throughline/handovers/2026-05-27-carry-forwards-cleanup-pre-phase-20.md`.
- PR: pending.
