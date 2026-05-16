<!-- Template version: 1.0 -->

# Throughline — Phase 10: GitHub integration & code-drift detection Handover

**Generated:** 2026-05-16 (pre-merge)
**Last commit SHA:** see PR head — branch `claude/throughline-phase-10-github-DB2KA`, 2026-05-16 (merge SHA not known at authoring time)
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-16-phase-9-discipline-drift.md` (Phase 9 — discipline-drift engine)

ROADMAP §Phase 10. Implements the GitHub poller (T-D7), PR-state surfacing, confidence-thresholded auto-reconcile (T-D6/T-D18), manual item-to-PR linking (T-D34), code-drift tiers 1-4 (T-D21 code stream), the orphaned-rule lifecycle (T-D33), and PR-open gate enforcement (§7.13 via the Phase-8 C-D6 dispatcher). New anchor **C-D16** minted in `CODE_SPEC.md`.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| ETag-cached polling, 60s active / 5min idle (T-D7) | built | `github/poller.ts`, `github/state-cache.ts`; `github.test.ts` "caches… / 304" | "active" approximated — see Drift Flags / Open Questions. |
| PR badges + activity timestamp + link per session (§7.13) | built | `components/PrBadges.tsx`; `views/SessionView.tsx` | REST-poll + manual refresh (SSE deferred). |
| Auto-reconcile on merge, high/medium/low (T-D6/T-D18) | built | `github/auto-reconcile.ts`; `github.test.ts` "auto-reconcile" cases | Confidence + provenance audit-logged day 1; 24h in-memory undo. |
| Manual item-to-PR linking: detect / override / skip (T-D34) | built | `github/pr-linking.ts`; `ItemDetailPanel.tsx` PR section; `github.test.ts` | Re-association any time from the detail panel. |
| Code-drift tier-1 (Semgrep annotations → verifier rules) | built | `github/tiers.ts` `runTier1`; `github.test.ts` tier-1 case | Convention match; verifier-tool plurality gap surfaced. |
| Tier-2 revert detection | built | `tiers.ts` `runTier2`; `github.test.ts` tier-2 case | Revert-PR over `item_pr_associations`. |
| Tier-3 PR files ∩ `item_code_refs` | built (dormant) | `tiers.ts` `runTier3`; `github.test.ts` local + API-fallback cases | Produces no signals until Phase 11 populates code refs (per ROADMAP). |
| Tier-4 dedup ≥0.80 (+0.70-0.80 AI confirm), inbox, 7-day stale | built | `github/tier4.ts`; `github.test.ts` tier-4 case | Token-cosine; Phase-14 embedding swap point. |
| Drift inbox counts both streams; reasoning; re-verify; reopen | built | `drift/service.ts` `inbox`; `github/reverify.ts`; `views/DriftInbox.tsx`; `codeDrift.test.tsx` | Strong code tiers excluded (they badge items). |
| Per-item code-drift tier badge | built | `drift/service.ts` `codeDriftTierByItem`; `items/service.ts`; `ItemRow.tsx` | Derived `Item.code_drift_tier`, never persisted. |
| Orphaned-rule lifecycle (T-D33) | built / partial | `github/orphan-rules.ts`; items `onDelete` hook; `github.test.ts` | Settings/API surface built; periodic-review hygiene list is Phase 14 (ROADMAP). |
| Workflow-template warning (§7.16) | built | `poller.ts` `warnWorkflowIfMissing`; `templates/github-actions/throughline-semgrep.yml` | Fires once per project, audit-logged. |
| PR-open gate via Phase-8 dispatcher | built | `poller.ts` → `gateRuntime.runMoment(project,'pr-open')`; `github.test.ts` | Newly observed open PR only. |

Tests: backend 179 (160 baseline → 175 Phase-10 → 179 incl. post-review-fix tests), frontend 79 (was 77), typecheck clean across all 3 packages. `pnpm lint` is the documented no-op (carry-forward 6a-9).

---

## Last Decision Minted

> **C-D16** — GitHub poller + code-drift pipeline: fetch-idiom REST client (no `@octokit`), local-git-first diff seam (no `simple-git`), confidence-thresholded auto-reconcile. Rationale: 304s don't count against the rate limit so lifecycle polling stays cheap on the API; the single expensive payload (changed-file list / diff-stat) goes local-git-first with an API fallback; tiers 1/2 are GitHub-only facts and stay API-only. Approved with the user in plan-mode (incl. the explicit hybrid-evaluation exchange). Lands in `CODE_SPEC.md` (C-D16). No new T-D anchors; implementation followed T-D6/7/18/21/26/31/33/34.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/backend/src/github/{api,local-git,state-cache,poller,tiers,tier4,auto-reconcile,pr-linking,orphan-rules,reverify,routes}.ts` — the GitHub subsystem.
- `packages/backend/src/db/migrations/0009_phase10.sql` — index-only migration.
- `packages/shared/src/github.ts` — Phase-10 shared contracts.
- `packages/frontend/src/views/DriftInbox.tsx`, `components/PrBadges.tsx`, `hooks/useDriftInbox.ts` — surfacing.
- `packages/backend/test/github.test.ts`, `packages/frontend/test/codeDrift.test.tsx` — tests.
- `templates/github-actions/throughline-semgrep.yml` — recommended Semgrep CI workflow (T-D26).
- `docs/_meta/throughline/handovers/2026-05-16-phase-10-github.md` — this handover.

**Modified:**
- `packages/backend/src/drift/service.ts` — code-signal idempotent create / list / reopen / `inbox`; `codeDriftTierByItem` / `itemStrongestCodeTier`.
- `packages/backend/src/items/service.ts` — `onDelete` hook; derived `code_drift_tier`.
- `packages/backend/src/dump-zone/service.ts` — optional `onProposedItems` hook (tier-4).
- `packages/backend/src/server.ts` — GitHub subsystem wiring + poller lifecycle.
- `packages/shared/src/{index,items}.ts` — export `github.ts`; `Item.code_drift_tier`.
- `packages/frontend/src/{api.ts,App.tsx,components/Header.tsx,components/ItemRow.tsx,components/ItemDetailPanel.tsx,views/SessionView.tsx,styles.css}` — surfacing.
- `packages/frontend/test/fixtures/mockApi.ts`, `disciplineDriftItem.test.tsx` — fixtures + `code_drift_tier`.
- `CODE_SPEC.md` (C-D16 minted), `CHECKLIST.md` (§Phase 10 ticked).

**Deleted:** _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Dependency idiom | `github/api.ts`, `github/local-git.ts` / CODE_SPEC §4/§12 | §4 named `@octokit/rest`, §12 named `simple-git`; repo precedent (anthropic.ts, hook-installer) is SDK-free fetch + child_process git. | Followed precedent; recorded as C-D16 (CODE_SPEC-only, implementation-shape). Approved in plan-mode incl. the hybrid-seam exchange. |
| Hybrid diff seam | `github/local-git.ts` | Plan initially routed all diff via API; rate-limit analysis showed 304s are free and only file/diff payloads are costly. | Local-git-first for tier-3/diff-stat with API fallback; tiers 1/2 API-only. Recorded in C-D16 reasoning. |
| "Active session" signal | `github/poller.ts` | SPEC §7.13 "pinned or dumped within 2h" has no schema signal. | Approximated as session/reconcile-run touched within 2h; CODE_SPEC-only; surfaced as an Open Question. |
| SSE push | `routes/events.ts` | Spec lists polling-state SSE; no broadcast bus exists (ping-only). | Surfacing stays REST-poll (Phase-9 precedent); deferred, flagged in C-D16. |
| Post-review fixes | `poller.ts`, `auto-reconcile.ts`, `tiers.ts`, `api.ts`, `orphan-rules.ts` | Gitar review on PR #17: (1) concurrent-poll race, (2) in-memory undo lost on restart, (3) tier-2 ignored PR body, (4) hardcoded `main` base branch. | All four fixed in one follow-up commit: in-flight guard; audit-persisted undo snapshot; tier-2 reads title+body (`GhPull.body` added); orphan PR targets `getDefaultBranch`. +4 backend tests (179 total). |
| `pnpm lint` no-op | repo | Carry-forward 6a-9. | Relied on `pnpm typecheck` + full suites (backend 179, frontend 79). |

---

## Open Questions

- [ ] **"Active session" definition** (cadence 60s vs 5min). Approximated via session/reconcile-run recency. Landing site: SPEC §7.13 clarification (a first-class pin / last-dump timestamp), then CODE_SPEC C-D16.
- [ ] **Verifier-tool plurality** (CODE_SPEC Questions #7). Tier-1 matches annotations to `item_verifier_rules` by a Semgrep-shaped convention. Landing site: SPEC §7.16 / T-D26 clarification.
- [ ] **Tier-3 dormant until Phase 11.** Pipeline wired + tested; produces no signals until items accumulate `item_code_refs` (Semble). Landing site: Phase 11.
- [ ] **Orphan periodic-review hygiene list.** Settings/API surface delivered; the periodic-review hygiene list itself is Phase 14. Landing site: Phase 14.
- [x] **Auto-reconcile undo durability.** Resolved in the post-review fixes: the reversal snapshot is persisted in the `github_auto_reconcile` audit row and `undo()` falls back to it, so undo survives a backend restart within the 24h window (CODE_SPEC §6).

---

## Recently Resolved

- **Phase-9 downstream: shared `drift_signals` + drift-inbox/re-verify** — the Phase-9 handover named the header drift-inbox counter and re-verify-via-AI as "delivered with Phase 10 (code-drift)". Delivered: `drift/service.ts` `inbox` (both streams), `github/reverify.ts`, `views/DriftInbox.tsx`, header pill.
- **Phase-9 Open Question: mid-session new-project file-watching** — not in Phase-10 scope; the GitHub poller independently re-derives its project set each tick (`projects.list()`), so a mid-session project is polled without a restart.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- Phase-8 gate runtime (C-D6) — `runMoment(project,'pr-open')`.
- Phase-5 reconcile engine/service — auto-reconcile feeds PR text through `reconcile.propose/apply`.
- Phase-3 items + `item_pr_associations` / `item_code_refs` / `item_verifier_rules` — tier scoping + orphan capture.
- Audit substrate (T-D36); shared `drift_signals` (T-D21, C-D7); `secrets/store.ts` (`github_pat`, T-D4).

**Downstream (consumes this slice's work):**
- **Phase 11 (Semble)** — populates `item_code_refs`, activating tier-3 signals.
- **Phase 14 (RAG / periodic review)** — orphan hygiene list + drift-stream hygiene queries.

---

## Reference

- Specs operated against: `SPEC.md` §7.13/7.14/7.16; `CODE_SPEC.md` C-D16 (+ C-D6/C-D7 reused), §6/§9/§12/§13/§16; `DECISIONS.md` T-D6/7/18/21/26/31/33/34; `ROADMAP.md`/`CHECKLIST.md` §Phase 10.
- Previous handover: `docs/_meta/throughline/handovers/2026-05-16-phase-9-discipline-drift.md`.
- PR: opened at phase close on branch `claude/throughline-phase-10-github-DB2KA`.
