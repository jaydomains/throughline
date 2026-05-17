<!-- Template version: 1.0 -->

# Throughline — Phase 8: Methodology Gate Runtime Handover

**Generated:** 2026-05-16 (pre-merge)
**Last commit SHA:** see PR head — branch `claude/throughline-phase-8-v1pNr`, 2026-05-16 (merge SHA not yet known at authoring time)
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-16-bundle-externalisation-refactor.md` (bundle externalisation refactor — `bundle_path` / C-D14)

ROADMAP §Phase 8. Implements the C-D6 gate dispatcher against the resolved SPEC §7.12 trigger transport (loopback HTTP + git hooks + durable queue). `methodologies/test-bundle/` is the worked example (per-commit declares two independent mechanical gates).

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Gate dispatcher per C-D6 (resolve `gates_by_moment`, run independently, record) | built | `packages/backend/src/methodology/gates/runtime.ts`; `gates.test.ts` "per-commit dispatches the two independent gates" | Five moments; multi-gate verified against test-bundle. |
| Loopback gate-trigger channel (SPEC §7.12) | built | `gates/routes.ts` `POST /api/gate-trigger`; server binds 127.0.0.1 (T-D31) | Best-effort for CC moments. |
| Per-commit internal trigger (item state transition) | built | `items/service.ts` `onStatusTransition`; `server.ts` wiring; `gates.test.ts` "item status transition fires per-commit" | Same gate as the git hook (SPEC §7.12). |
| Durable git-hook event queue (drain-on-startup + quarantine) | built | `gates/hook-queue.ts`; `server.ts` startup drain; `gates.test.ts` "hook-event queue drains/quarantines" | Mirrors Phase 4 inbox idioms. |
| Consented idempotent advisory hook installer | built | `gates/hook-installer.ts`; `gates/routes.ts` install-hooks; `gates.test.ts` "installs idempotent advisory git hooks" | `git rev-parse --git-path hooks`; chains not replaces; `exit 0`. |
| Port-stable hooks via runtime URL file | built | `gates/runtime-file.ts`; `server.ts` `writeRuntimeFile`; `gates.test.ts` "runtime URL file round-trips" | `<dataDir>/runtime.json`. |
| `gate_firings` row + audit entry per firing (T-D36) | built | `runtime.ts` `persist`; migration `0008` indexes; `gates.test.ts` audit assertions | Table pre-existed in `0001_init.sql`; 0008 adds indexes only. |
| Mechanical gates → built-in check catalogue (C-D15) | built | `gates/checks.ts`; `gates.test.ts` banned-string fail case | Keyword-dispatched; unrecognised → non-blocking skipped. |
| Judgement gates → Anthropic | built | `gates/judgement.ts`; `gates.test.ts` judgement tests | `claude-sonnet-4-6` factory default-parameter; cost + fingerprint logged. |
| Methodology-gates view (proposals, override, fix-and-retry) | built | `packages/frontend/src/views/GatesView.tsx`; `gatesView.test.tsx` | Replaces the Phase-2 stub; hidden for freeform. |
| Never silently blocks the repo (T-D44) | built | advisory hooks `exit 0`; checks fail as proposals; `gates.test.ts` "never blocks" | _none_ |
| PR-open moment | partial | `runtime.runMoment(project,'pr-open')` seam | Trigger is the Phase-10 GitHub poller (not built here, per ROADMAP). |

---

## Last Decision Minted

- **C-D15 — Mechanical gates dispatch to a built-in generic check catalogue by gate-id keyword.** Rule: the bundle grammar carries no gate→check binding, so the runtime ships fixed generic primitives (banned-string / structural / anchor-resolution / blocking-marker / script-spawn) driven off the bundle's typed sections; a `GateSpec` dispatches by a documented gate-id keyword convention; unrecognised/erroring mechanical gates record a non-blocking `skipped`/`error` finding. Rationale: a 4th grammar token would be a spec-author / Phase-1 change; the keyword heuristic keeps C-D4 and the shipped `test-bundle` untouched, stays methodology-agnostic, and covers the worked example. Implementation-shape per spec-drift policy → CODE_SPEC.md only. Lands in: `CODE_SPEC.md` (C-D15 + §7), `packages/backend/src/methodology/gates/checks.ts`.

No new T-D anchors. Implementation followed T-D42, T-D44, T-D36, T-D31, T-D37; C-D6, C-D4, C-D5.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/backend/src/methodology/gates/{runtime,checks,judgement,hook-queue,hook-installer,runtime-file,routes}.ts` — gate runtime subsystem.
- `packages/backend/src/db/migrations/0008_gate_firings_indexes.sql` — query indexes (table pre-existed).
- `packages/backend/test/gates.test.ts` — runtime / checks / judgement / hook transport tests.
- `packages/frontend/src/views/GatesView.tsx` — real methodology-gates view.
- `packages/frontend/test/gatesView.test.tsx` — view tests.
- `packages/shared/src/gate.ts` — `GateFiring` / findings / API result types.
- `docs/_meta/throughline/handovers/2026-05-16-phase-8-gate-runtime.md` — this handover.

**Modified:**
- `packages/backend/src/server.ts` — gate runtime constructed before items; routes; startup hook re-install, runtime-file write, queue drain; gate-queue dirs `mkdir`.
- `packages/backend/src/items/service.ts` — optional `onStatusTransition` hook (internal per-commit trigger).
- `packages/backend/src/config.ts` — `gateHookQueueDir`, `gateHookFailuresDir`, `runtimeFilePath`.
- `packages/frontend/src/{App.tsx,api.ts,styles.css}` — GatesView wiring, gate API methods, gate styles.
- `packages/frontend/src/views/stubs.tsx`, `packages/frontend/test/stubs.test.tsx` — Phase-8 GatesView stub removed.
- `packages/frontend/test/fixtures/mockApi.ts` — gate API mocks.
- `packages/shared/src/index.ts` — export `gate.ts`.
- `CODE_SPEC.md` — C-D15 minted; §7 expanded (loopback route, C-D15 cross-ref, raw-git note, runtime.json). `CHECKLIST.md` — §Phase 8 closed.

**Deleted:**
- _none_ (the GatesView stub function was removed from `stubs.tsx`, file retained).

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| `simple-git` not used | `gates/hook-installer.ts` | CODE_SPEC §7 named `simple-git` for hook-path resolution; it is not an installed dependency and adding one risks the sandboxed install. | Used raw `git` via `child_process` for the one-shot `rev-parse --git-path hooks`; behaviour identical. Recorded in CODE_SPEC §7; `simple-git` still planned for §12 branch-read. |
| Provisional trigger wording | `CHECKLIST.md` §Phase 8 | ROADMAP §7.12 gap table / CHECKLIST said "signal file", "`.git/COMMIT_EDITMSG` watch", "marker file". | Superseded by the resolved SPEC §7.12 single loopback channel (spec-clarification PR #13). Items ticked against the resolved mechanism; old text struck through for history. No SPEC change (already resolved). |
| `gate-id` → check binding | `gates/checks.ts` | Plan flagged the mechanical-gate→check binding as an open design fork (no covering anchor). | Resolved with user as **C-D15** (built-in catalogue, keyword-dispatched) before coding; surfaced, not silently picked. |
| Rich-bundle checklist line | `CHECKLIST.md` §Phase 8 | Original checklist named the rich bundle's `verify-structure.sh`/`banned-string-sweep`. | The rich bundle was removed in the prior refactor; line retargeted to the test-bundle's two per-commit gates. |
| `pnpm lint` is a no-op | repo | Carry-forward from 6a–8. | Relied on `pnpm typecheck` + full suites (backend 145, frontend 73). |

---

## Open Questions

- [ ] **PR-open trigger.** Only the dispatch seam exists; the GitHub poller that fires `moment='pr-open'` is Phase 10 (ROADMAP Phase 8 → Phase 10).
- [ ] **Plan-mode / pre-write sender.** The loopback endpoint exists; the Claude Code side that POSTs plan-mode/pre-write messages is out of repo scope (best-effort by design).
- [ ] **`install_gate_hooks` UI.** Consent flag is read from `settings_json`; the default-checked new-project checkbox / project-settings opt-in control is a UI slice (API + startup re-install work today).
- [ ] **Anchor-resolution heuristic.** The generic "cited anchor resolves to a heading + non-live status nearby" check is intentionally shallow; a bundle declaring a richer anchor corpus may want a tighter resolver (revisit if felt).
- [ ] **Real lint wiring.** Still a no-op (carry-forward). Repo-infra slice.

---

## Recently Resolved

- **Q1–Q4 gate-trigger mechanisms** — flagged resolved in `2026-05-15-spec-clarification-gate-triggers.md`; Phase 8 consumes the resolved loopback/hook/queue spec and builds it.
- **Phase 8 downstream dependency from the bundle-externalisation refactor** — the `test-bundle` multi-gate per-commit moment named there as "the non-trivial target" is now the exercised worked example.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- Phase 1 bundle loader/parser (C-D4) — `state_machine.gates_by_moment`, `resolveBundle` (C-D14).
- Phase 3 items service — state-transition point for the internal per-commit trigger.
- Audit substrate (T-D36) + cost telemetry (T-D29) + prompt fingerprint (T-D24) + Anthropic client.
- Phase 4 inbox queue idioms — mirrored by the hook event queue.

**Downstream (consumes this slice's work):**
- **Phase 9 discipline-drift** — reuses the pre-write moment's dispatch path for write-time scanners.
- **Phase 10 GitHub integration** — drives `runMoment(project,'pr-open')` from the poller; PR-open gate enforcement (§7.13).
- **Phase 12 mechanical step execution** — shares the mechanical-check infrastructure (C-D15 primitives).

---

## Reference

- Specs operated against: `SPEC.md` §7.11/§7.12/§7.13; `CODE_SPEC.md` C-D6/C-D4/C-D5 + new C-D15 + §7; `DECISIONS.md` T-D42/T-D44/T-D36/T-D31/T-D37; `ROADMAP.md`/`CHECKLIST.md` §Phase 8.
- Previous handover: `docs/_meta/throughline/handovers/2026-05-16-bundle-externalisation-refactor.md`.
- PR: opened at phase close on branch `claude/throughline-phase-8-v1pNr`.
